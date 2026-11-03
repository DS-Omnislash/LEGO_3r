// Classificacions i estadístiques. Funcions pures sobre equips, sessions i intents.
import type { Attempt, RankingMethod, ResultScope, Session, SessionAggregation, Settings, Team, TieBreak } from '../db/models';
import { attemptResult } from './compute';
import { MISSION_BY_ID, maxFor } from '../scoring/rules';
import { missionMax } from '../scoring/engine';

export interface Filters {
  teamIds?: string[];
  missionIds?: string[];
  from?: string;
  to?: string;
  sessionId?: string;
}

export interface ScoredAttempt {
  attempt: Attempt;
  session: Session;
  total: number;
  missionPoints: number;
  adjustmentPoints: number;
  max: number;
  byMission: Record<string, number>;
  valid: boolean;
}

export interface RankingRow {
  team: Team;
  rank: number;
  tied: boolean;
  value: number;
  /** Desglossament de desempat (si s'aplica). */
  tieKey: number[];
  sessionsPlayed: number;
  attemptsCount: number;
  bySession: Record<string, number | null>;
  bestByMission: Record<string, number>;
  bestAttempt: number | null;
  hasResults: boolean;
}

export const METHOD_LABELS: Record<RankingMethod, { title: string; short: string; help: string }> = {
  cumulative: {
    title: 'Puntuació acumulada',
    short: 'Acumulada',
    help: 'Suma de la puntuació de cada equip a totes les sessions completades.',
  },
  bestPerMission: {
    title: 'Millor intent per missió',
    short: 'Millor per missió',
    help: 'Suma de la millor puntuació de cada equip a cada missió (sense ajustos manuals).',
  },
  session: {
    title: 'Sessió individual',
    short: 'Sessió',
    help: 'Classificació d\'una sola sessió setmanal.',
  },
  bestMatch: {
    title: 'Millor partida (format oficial)',
    short: 'Millor partida',
    help: 'Com en un torneig oficial: només compta la puntuació més alta d\'un intent (p. 6, p. 21).',
  },
};

export const SCOPE_LABELS: Record<ResultScope, string> = {
  all: 'Pràctica + oficial',
  practice: 'Només pràctica',
  official: 'Només oficial',
};

export const TIEBREAK_LABELS: Record<TieBreak, string> = {
  none: 'Sense desempat (es mostren els empats)',
  nextBest: 'Desempat per la 2a i 3a millor partida (criteri oficial, p. 21)',
};

export const AGG_LABELS: Record<SessionAggregation, string> = {
  best: 'Millor intent de la sessió',
  last: 'Últim intent de la sessió',
};

function inScope(s: Session, scope: ResultScope) {
  return scope === 'all' || s.type === scope;
}

function inDates(s: Session, f: Filters) {
  return (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to);
}

/** Intents vàlids (no esborrats) amb puntuació calculada. */
export function scoreAll(sessions: Session[], attempts: Attempt[]): ScoredAttempt[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const out: ScoredAttempt[] = [];
  for (const a of attempts) {
    if (a.deletedAt) continue;
    const s = byId.get(a.sessionId);
    if (!s) continue;
    const r = attemptResult(a, s);
    out.push({
      attempt: a,
      session: s,
      total: r.total,
      missionPoints: r.missionPoints,
      adjustmentPoints: r.adjustmentPoints,
      max: r.max,
      byMission: Object.fromEntries(r.missions.map((m) => [m.missionId, m.total])),
      valid: r.valid,
    });
  }
  return out;
}

/** Valor d'un intent segons la configuració i el filtre de missions. */
export function attemptValue(sa: ScoredAttempt, settings: Pick<Settings, 'includeAdjustments'>, missionIds?: string[]) {
  if (missionIds?.length) return missionIds.reduce((s, id) => s + (sa.byMission[id] ?? 0), 0);
  return settings.includeAdjustments ? sa.total : sa.missionPoints;
}

/** Puntuació d'un equip en una sessió: millor intent o últim intent. */
export function sessionScore(list: ScoredAttempt[], agg: SessionAggregation, value: (s: ScoredAttempt) => number): number | null {
  if (!list.length) return null;
  if (agg === 'last') return value([...list].sort((a, b) => a.attempt.number - b.attempt.number)[list.length - 1]);
  return Math.max(...list.map(value));
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? -Infinity) - (a[i] ?? -Infinity);
    if (d !== 0) return d;
  }
  return 0;
}

export interface RankingInput {
  teams: Team[];
  sessions: Session[];
  attempts: Attempt[];
  settings: Settings;
  method?: RankingMethod;
  filters?: Filters;
}

export function computeRanking({ teams, sessions, attempts, settings, method = settings.rankingMethod, filters = {} }: RankingInput): RankingRow[] {
  const scored = scoreAll(sessions, attempts);
  const activeTeams = teams.filter((t) => !t.archived);
  const value = (sa: ScoredAttempt) => attemptValue(sa, settings, filters.missionIds);

  // Sessions que compten: completades, dins de l'abast i de les dates. La «sessió individual» admet esborranys.
  const relevant = (sa: ScoredAttempt) => {
    if (method === 'session') return sa.session.id === filters.sessionId;
    return sa.session.status === 'completed' && inScope(sa.session, settings.scope) && inDates(sa.session, filters);
  };
  const pool = scored.filter(relevant);

  const rows: RankingRow[] = activeTeams.map((team) => {
    const mine = pool.filter((sa) => sa.attempt.teamId === team.id);
    const bySessionList = new Map<string, ScoredAttempt[]>();
    for (const sa of mine) bySessionList.set(sa.session.id, [...(bySessionList.get(sa.session.id) ?? []), sa]);
    const bySession: Record<string, number | null> = {};
    for (const [sid, list] of bySessionList) bySession[sid] = sessionScore(list, settings.sessionAggregation, value);

    const bestByMission: Record<string, number> = {};
    for (const sa of mine) {
      for (const [mid, pts] of Object.entries(sa.byMission)) {
        if (filters.missionIds?.length && !filters.missionIds.includes(mid)) continue;
        bestByMission[mid] = Math.max(bestByMission[mid] ?? 0, pts);
      }
    }

    const attemptTotals = mine.map(value).sort((a, b) => b - a);
    let v = 0;
    let tieKey: number[] = [];
    switch (method) {
      case 'cumulative':
      case 'session':
        v = Object.values(bySession).reduce<number>((s, x) => s + (x ?? 0), 0);
        tieKey = attemptTotals.slice(0, 3);
        break;
      case 'bestPerMission':
        v = Object.values(bestByMission).reduce((s, x) => s + x, 0);
        tieKey = attemptTotals.slice(0, 3);
        break;
      case 'bestMatch':
        v = attemptTotals[0] ?? 0;
        tieKey = attemptTotals.slice(1, 3);
        break;
    }
    return {
      team,
      rank: 0,
      tied: false,
      value: v,
      tieKey,
      sessionsPlayed: bySessionList.size,
      attemptsCount: mine.length,
      bySession,
      bestByMission,
      bestAttempt: attemptTotals[0] ?? null,
      hasResults: mine.length > 0,
    };
  });

  const useTieBreak = settings.tieBreak === 'nextBest';
  const cmp = (a: RankingRow, b: RankingRow) => {
    if (b.value !== a.value) return b.value - a.value;
    if (useTieBreak) return compareKeys(a.tieKey, b.tieKey);
    return 0;
  };
  rows.sort((a, b) => cmp(a, b) || a.team.name.localeCompare(b.team.name, 'ca'));
  // Rànquing de competició (1, 1, 3): els equips empatats comparteixen posició.
  rows.forEach((r, i) => {
    if (i > 0 && cmp(rows[i - 1], r) === 0) {
      r.rank = rows[i - 1].rank;
      r.tied = true;
      rows[i - 1].tied = true;
    } else r.rank = i + 1;
  });

  if (filters.teamIds?.length) return rows.filter((r) => filters.teamIds!.includes(r.team.id));
  return rows;
}

// ---- Estadístiques ----------------------------------------------------------

export function relevantSessions(sessions: Session[], settings: Settings, filters: Filters = {}) {
  return sessions
    .filter((s) => s.status === 'completed' && inScope(s, settings.scope) && inDates(s, filters))
    .filter((s) => !filters.missionIds?.length || s.missionIds.some((m) => filters.missionIds!.includes(m)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export interface ProgressPoint {
  sessionId: string;
  label: string;
  date: string;
  [teamId: string]: number | string | null;
}

/** Evolució per sessió: puntuació o % del màxim de la sessió. */
export function progressSeries(
  teams: Team[], sessions: Session[], attempts: Attempt[], settings: Settings, filters: Filters = {}, mode: 'points' | 'percent' = 'points',
): ProgressPoint[] {
  const scored = scoreAll(sessions, attempts);
  return relevantSessions(sessions, settings, filters).map((s) => {
    const p: ProgressPoint = { sessionId: s.id, label: s.title, date: s.date };
    const max = filters.missionIds?.length
      ? filters.missionIds.filter((m) => s.missionIds.includes(m)).reduce((acc, m) => acc + missionMax(MISSION_BY_ID[m]), 0)
      : maxFor(s.missionIds);
    for (const t of teams) {
      const list = scored.filter((sa) => sa.session.id === s.id && sa.attempt.teamId === t.id);
      const v = sessionScore(list, settings.sessionAggregation, (sa) => attemptValue(sa, settings, filters.missionIds));
      p[t.id] = v === null ? null : mode === 'percent' ? (max ? Math.round((v / max) * 100) : 0) : v;
    }
    return p;
  });
}

export interface MissionStat {
  missionId: string;
  attempts: number;
  avg: number;
  best: number;
  max: number;
  avgPct: number;
  fullScoreRate: number;
  teamsTried: number;
}

export function missionStats(sessions: Session[], attempts: Attempt[], settings: Settings, filters: Filters = {}): MissionStat[] {
  const ok = new Set(relevantSessions(sessions, settings, filters).map((s) => s.id));
  const scored = scoreAll(sessions, attempts).filter(
    (sa) => ok.has(sa.session.id) && (!filters.teamIds?.length || filters.teamIds.includes(sa.attempt.teamId)),
  );
  const ids = new Set<string>();
  for (const sa of scored) for (const id of Object.keys(sa.byMission)) ids.add(id);
  return [...ids]
    .filter((id) => MISSION_BY_ID[id] && (!filters.missionIds?.length || filters.missionIds.includes(id)))
    .map((id) => {
      const vals = scored.filter((sa) => id in sa.byMission).map((sa) => sa.byMission[id]);
      const max = missionMax(MISSION_BY_ID[id]);
      const avg = vals.reduce((s, x) => s + x, 0) / (vals.length || 1);
      return {
        missionId: id,
        attempts: vals.length,
        avg: Math.round(avg * 10) / 10,
        best: Math.max(0, ...vals),
        max,
        avgPct: max ? Math.round((avg / max) * 100) : 0,
        fullScoreRate: vals.length ? Math.round((vals.filter((v) => v >= max).length / vals.length) * 100) : 0,
        teamsTried: new Set(scored.filter((sa) => id in sa.byMission).map((sa) => sa.attempt.teamId)).size,
      };
    })
    .sort((a, b) => a.missionId.localeCompare(b.missionId));
}

export interface Improvement {
  team: Team;
  fromPct: number;
  toPct: number;
  delta: number;
  fromSession: Session;
  toSession: Session;
}

/** Millora entre les dues últimes sessions de cada equip, en % del màxim (comparable entre missions diferents). */
export function improvements(teams: Team[], sessions: Session[], attempts: Attempt[], settings: Settings, filters: Filters = {}): Improvement[] {
  const series = progressSeries(teams, sessions, attempts, settings, filters, 'percent');
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const out: Improvement[] = [];
  for (const t of teams.filter((x) => !x.archived)) {
    const pts = series.filter((p) => p[t.id] !== null && p[t.id] !== undefined);
    if (pts.length < 2) continue;
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    out.push({
      team: t,
      fromPct: a[t.id] as number,
      toPct: b[t.id] as number,
      delta: (b[t.id] as number) - (a[t.id] as number),
      fromSession: byId.get(a.sessionId)!,
      toSession: byId.get(b.sessionId)!,
    });
  }
  return out.sort((x, y) => y.delta - x.delta);
}

export function recentResults(sessions: Session[], attempts: Attempt[], limit = 8) {
  return scoreAll(sessions, attempts)
    .filter((sa) => sa.attempt.updatedAt)
    .sort((a, b) => b.attempt.updatedAt.localeCompare(a.attempt.updatedAt))
    .slice(0, limit);
}

export function highestScore(sessions: Session[], attempts: Attempt[], settings: Settings) {
  const ok = new Set(relevantSessions(sessions, settings).map((s) => s.id));
  const list = scoreAll(sessions, attempts).filter((sa) => ok.has(sa.session.id));
  if (!list.length) return null;
  return list.reduce((best, sa) => (attemptValue(sa, settings) > attemptValue(best, settings) ? sa : best));
}
