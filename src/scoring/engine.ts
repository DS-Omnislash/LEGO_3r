// Motor de puntuació: funcions pures que interpreten les regles declarades a superpowered.json.
// No depèn de React ni de la base de dades, i té tests a tests/engine.test.ts.

import type {
  Adjustment,
  AttemptInputs,
  AttemptResult,
  Condition,
  GlobalConstraint,
  InputValue,
  LineResult,
  Mission,
  MissionInputs,
  MissionResult,
  Requirement,
  ResourceKey,
  Uses,
  Violation,
} from './types';

export function defaultValue(c: Condition): InputValue {
  switch (c.type) {
    case 'boolean':
      return false;
    case 'count':
      return 0;
    case 'select':
      return c.default;
    case 'check':
      return c.default;
    case 'auto':
      return false;
  }
}

export function defaultInputs(m: Mission): MissionInputs {
  const out: MissionInputs = {};
  for (const c of m.conditions) if (c.type !== 'auto') out[c.id] = defaultValue(c);
  return out;
}

/** Normalitza un valor introduït al domini vàlid de la condició. */
export function normalize(c: Condition, raw: InputValue | undefined): InputValue {
  if (raw === undefined || raw === null) return defaultValue(c);
  switch (c.type) {
    case 'boolean':
    case 'check':
    case 'auto':
      return raw === true || raw === 'true' || raw === 1;
    case 'count': {
      const n = Math.floor(Number(raw));
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    case 'select': {
      const v = String(raw);
      return c.options.some((o) => o.value === v) ? v : c.default;
    }
  }
}

function resolveValues(m: Mission, inputs: MissionInputs | undefined): MissionInputs {
  const vals: MissionInputs = {};
  for (const c of m.conditions) {
    if (c.type === 'auto') continue;
    vals[c.id] = normalize(c, inputs?.[c.id]);
  }
  return vals;
}

function requirementMet(r: Requirement, vals: MissionInputs): boolean {
  const v = vals[r.cond];
  if (r.op === 'is') return v === r.value;
  return Number(v) >= Number(r.value);
}

function addUses(target: Uses, u: Uses | undefined, times = 1) {
  if (!u || times <= 0) return;
  for (const k of Object.keys(u) as ResourceKey[]) target[k] = (target[k] ?? 0) + (u[k] ?? 0) * times;
}

function maxPointsOf(c: Condition): number {
  switch (c.type) {
    case 'boolean':
    case 'auto':
      return c.points;
    case 'count':
      return c.pointsEach * c.max;
    case 'select':
      return Math.max(...c.options.map((o) => o.points));
    case 'check':
      return 0;
  }
}

/** Puntua una missió tal com està (sense calcular-ne el màxim). */
function evaluate(m: Mission, vals: MissionInputs): Omit<MissionResult, 'max'> {
  const lines: LineResult[] = [];
  const violations: Violation[] = [];
  const uses: Uses = {};
  let total = 0;

  for (const c of m.conditions) {
    if (c.type === 'check') {
      lines.push({
        condId: c.id, label: c.label, type: c.type, value: vals[c.id], points: 0, wouldScore: 0,
        maxPoints: 0, status: 'zero', reasons: [], bonus: false,
      });
      continue;
    }
    let value: InputValue;
    let wouldScore = 0;
    let lineUses: Uses | undefined;
    let times = 1;
    const reasons: string[] = [];

    if (c.type === 'auto') {
      const met = (c.requires ?? []).every((r) => requirementMet(r, vals));
      value = met;
      wouldScore = met ? c.points : 0;
    } else if (c.type === 'boolean') {
      value = vals[c.id];
      wouldScore = value ? c.points : 0;
      lineUses = value ? c.uses : undefined;
    } else if (c.type === 'count') {
      const raw = vals[c.id] as number;
      if (raw > c.max) {
        violations.push({
          scope: 'mission', missionId: m.id,
          message: `${c.label}: el màxim és ${c.max} (introduït: ${raw}).`,
        });
      }
      const n = Math.min(raw, c.max);
      value = n;
      wouldScore = n * c.pointsEach;
      lineUses = c.uses;
      times = n;
    } else {
      value = vals[c.id];
      const opt = c.options.find((o) => o.value === value)!;
      wouldScore = opt.points;
      lineUses = opt.uses;
    }

    // Les dependències només s'expliquen si la condició donaria punts.
    let blocked = false;
    if (c.type !== 'auto' && wouldScore > 0) {
      for (const r of c.requires ?? []) {
        if (!requirementMet(r, vals)) {
          blocked = true;
          reasons.push(r.reason);
        }
      }
    }
    // Els recursos (unitats col·locades) existeixen físicament encara que la condició quedi bloquejada.
    addUses(uses, lineUses, times);

    const points = blocked ? 0 : wouldScore;
    total += points;
    lines.push({
      condId: c.id, label: c.label, type: c.type, value, points, wouldScore,
      maxPoints: maxPointsOf(c), status: blocked ? 'blocked' : points > 0 ? 'scored' : 'zero',
      reasons, bonus: !!c.bonus,
    });
  }

  for (const k of m.constraints ?? []) {
    const sum = k.conds.reduce((s, id) => s + Number(vals[id] ?? 0), 0);
    if (sum > k.max) violations.push({ scope: 'mission', missionId: m.id, message: k.reason });
  }

  return { missionId: m.id, total, lines, violations, uses };
}

// ---- Màxims ------------------------------------------------------------

function domain(c: Condition): InputValue[] {
  switch (c.type) {
    case 'boolean':
    case 'check':
      return [false, true];
    case 'count':
      return Array.from({ length: c.max + 1 }, (_, i) => i);
    case 'select':
      return c.options.map((o) => o.value);
    case 'auto':
      return [];
  }
}

/** Totes les combinacions vàlides (sense violacions) d'una missió: [punts, unitats d'energia]. */
function enumerateOutcomes(m: Mission): Array<{ score: number; energy: number }> {
  const conds = m.conditions.filter((c) => c.type !== 'auto');
  const out = new Map<string, { score: number; energy: number }>();
  const vals: MissionInputs = {};
  const rec = (i: number) => {
    if (i === conds.length) {
      const r = evaluate(m, vals);
      if (r.violations.length) return;
      const e = r.uses.energy ?? 0;
      const key = `${e}`;
      const prev = out.get(key);
      if (!prev || prev.score < r.total) out.set(key, { score: r.total, energy: e });
      return;
    }
    for (const v of domain(conds[i])) {
      vals[conds[i].id] = v;
      rec(i + 1);
    }
  };
  rec(0);
  return [...out.values()];
}

const outcomeCache = new Map<string, Array<{ score: number; energy: number }>>();
function outcomes(m: Mission) {
  let o = outcomeCache.get(m.id);
  if (!o) {
    o = enumerateOutcomes(m);
    outcomeCache.set(m.id, o);
  }
  return o;
}

/** Màxim possible d'una missió considerada sola. */
export function missionMax(m: Mission): number {
  return Math.max(0, ...outcomes(m).map((o) => o.score));
}

/**
 * Màxim conjunt d'un grup de missions respectant el límit global d'unitats d'energia
 * (programació dinàmica sobre les unitats d'energia consumides).
 */
export function combinedMax(missions: Mission[], energyCap = Infinity): number {
  const cap = Number.isFinite(energyCap) ? energyCap : 1000;
  let best = new Map<number, number>([[0, 0]]);
  for (const m of missions) {
    const next = new Map<number, number>();
    for (const [e, s] of best) {
      for (const o of outcomes(m)) {
        const ne = e + o.energy;
        if (ne > cap) continue;
        const ns = s + o.score;
        if ((next.get(ne) ?? -1) < ns) next.set(ne, ns);
      }
    }
    best = next;
  }
  return Math.max(0, ...best.values());
}

// ---- API pública ---------------------------------------------------------

export function scoreMission(m: Mission, inputs: MissionInputs | undefined): MissionResult {
  const r = evaluate(m, resolveValues(m, inputs));
  return { ...r, max: missionMax(m) };
}

export interface ScoreOptions {
  globalConstraints?: GlobalConstraint[];
}

export function scoreAttempt(
  missions: Mission[],
  inputs: AttemptInputs,
  adjustments: Adjustment[] = [],
  opts: ScoreOptions = {},
): AttemptResult {
  const results = missions.map((m) => scoreMission(m, inputs[m.id]));
  const violations: Violation[] = results.flatMap((r) => r.violations);
  const energyCap = opts.globalConstraints?.find((g) => g.resource === 'energy')?.max ?? Infinity;

  for (const g of opts.globalConstraints ?? []) {
    const used = results.reduce((s, r) => s + (r.uses[g.resource] ?? 0), 0);
    if (used > g.max) {
      violations.push({ scope: 'global', message: `${g.reason} (comptades: ${used}).` });
    }
  }

  const missionPoints = results.reduce((s, r) => s + r.total, 0);
  const adjustmentPoints = adjustments.reduce((s, a) => s + (Number(a.points) || 0), 0);
  return {
    missions: results,
    missionPoints,
    adjustmentPoints,
    total: missionPoints + adjustmentPoints,
    max: combinedMax(missions, energyCap),
    maxSimple: results.reduce((s, r) => s + r.max, 0),
    violations,
    valid: violations.length === 0,
  };
}

/** Energia que encara es pot col·locar en destinacions sense superar el límit global. */
export function energyUsed(missions: Mission[], inputs: AttemptInputs): number {
  return missions.reduce((s, m) => s + (scoreMission(m, inputs[m.id]).uses.energy ?? 0), 0);
}
