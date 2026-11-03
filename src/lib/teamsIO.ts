import Papa from 'papaparse';
import type { Team } from '../db/models';

export interface TeamRow {
  name: string;
  number?: string;
  members: string[];
  notes: string;
  color?: string;
  emoji?: string;
}

export interface TeamImportIssue {
  row: number; // 1-based (fila de dades)
  level: 'error' | 'warning';
  message: string;
}

export interface TeamImportResult {
  rows: TeamRow[];
  issues: TeamImportIssue[];
  /** Files que coincideixen amb equips existents (per número o nom). */
  matches: Record<number, string>;
}

// Accepta capçaleres en català, castellà o anglès.
const FIELD_ALIASES: Record<keyof TeamRow, string[]> = {
  name: ['nom', 'name', 'nombre', 'equip', 'equipo', 'team'],
  number: ['numero', 'número', 'number', 'num', 'id', 'codi'],
  members: ['membres', 'members', 'miembros', 'integrants', 'integrantes'],
  notes: ['notes', 'notas', 'observacions', 'comentaris'],
  color: ['color', 'colour'],
  emoji: ['emoji', 'avatar', 'icona'],
};

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function mapKey(header: string): keyof TeamRow | null {
  const h = norm(header);
  for (const [k, aliases] of Object.entries(FIELD_ALIASES)) if (aliases.map(norm).includes(h)) return k as keyof TeamRow;
  return null;
}

function splitMembers(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v !== 'string') return [];
  return v.split(/[;|\n]/).map((s) => s.trim()).filter(Boolean);
}

function toRow(obj: Record<string, unknown>): TeamRow {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = mapKey(k);
    if (key) r[key] = v;
  }
  return {
    name: String(r.name ?? '').trim(),
    number: r.number !== undefined && String(r.number).trim() !== '' ? String(r.number).trim() : undefined,
    members: splitMembers(r.members),
    notes: String(r.notes ?? '').trim(),
    color: r.color ? String(r.color).trim() : undefined,
    emoji: r.emoji ? String(r.emoji).trim() : undefined,
  };
}

/** Llegeix un fitxer d'equips en CSV o JSON i en valida el contingut. */
export function parseTeamsFile(text: string, fileName: string, existing: Team[] = []): TeamImportResult {
  const issues: TeamImportIssue[] = [];
  let objects: Record<string, unknown>[] = [];
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);

  if (isJson) {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.teams) ? parsed.teams : null;
      if (!arr) {
        issues.push({ row: 0, level: 'error', message: 'El JSON ha de ser una llista d\'equips o un objecte amb la propietat «teams».' });
      } else {
        objects = arr.filter((x: unknown) => typeof x === 'object' && x !== null);
        if (objects.length !== arr.length) issues.push({ row: 0, level: 'warning', message: 'Alguns elements no eren objectes i s\'han ignorat.' });
      }
    } catch (e) {
      issues.push({ row: 0, level: 'error', message: `JSON no vàlid: ${(e as Error).message}` });
    }
  } else {
    const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' });
    for (const e of res.errors) issues.push({ row: (e.row ?? 0) + 1, level: 'warning', message: `CSV: ${e.message}` });
    const headers = res.meta.fields ?? [];
    if (!headers.some((h) => mapKey(h) === 'name')) {
      issues.push({ row: 0, level: 'error', message: 'Falta la columna obligatòria «nom» (o «name»).' });
    }
    const unknown = headers.filter((h) => h.trim() && !mapKey(h));
    if (unknown.length) issues.push({ row: 0, level: 'warning', message: `Columnes ignorades: ${unknown.join(', ')}` });
    objects = res.data;
  }

  const rows = objects.map(toRow);
  const seenNum = new Map<string, number>();
  const seenName = new Map<string, number>();
  const matches: Record<number, string> = {};

  rows.forEach((r, i) => {
    const n = i + 1;
    if (!r.name) issues.push({ row: n, level: 'error', message: 'Falta el nom de l\'equip.' });
    if (r.number) {
      if (seenNum.has(r.number)) issues.push({ row: n, level: 'error', message: `Número d'equip duplicat «${r.number}» (també a la fila ${seenNum.get(r.number)}).` });
      else seenNum.set(r.number, n);
    }
    if (r.name) {
      const key = norm(r.name);
      if (seenName.has(key)) issues.push({ row: n, level: 'error', message: `Nom d'equip duplicat «${r.name}» (també a la fila ${seenName.get(key)}).` });
      else seenName.set(key, n);
    }
    if (r.color && !/^#[0-9a-f]{6}$/i.test(r.color)) {
      issues.push({ row: n, level: 'warning', message: `Color «${r.color}» no vàlid (format #RRGGBB); se n'assignarà un automàticament.` });
      r.color = undefined;
    }
    if (!r.members.length) issues.push({ row: n, level: 'warning', message: 'Sense membres (camp opcional).' });
    const match = existing.find((t) => (r.number && t.number === r.number) || (r.name && norm(t.name) === norm(r.name)));
    if (match) matches[n] = match.id;
  });

  if (!rows.length && !issues.some((x) => x.level === 'error')) {
    issues.push({ row: 0, level: 'error', message: 'El fitxer no conté cap equip.' });
  }
  return { rows, issues, matches };
}

export function teamsToCSV(teams: Team[]): string {
  return Papa.unparse(
    teams.map((t) => ({ numero: t.number ?? '', nom: t.name, membres: t.members.join('; '), notes: t.notes, color: t.color, emoji: t.emoji })),
    { columns: ['numero', 'nom', 'membres', 'notes', 'color', 'emoji'] },
  );
}

export function teamsToJSON(teams: Team[]): string {
  return JSON.stringify(
    { teams: teams.map((t) => ({ number: t.number ?? '', name: t.name, members: t.members, notes: t.notes, color: t.color, emoji: t.emoji })) },
    null,
    2,
  );
}

export const CSV_TEMPLATE = `numero,nom,membres,notes,color
101,Els Energètics,Anna; Pau; Martina; Jan,Grup de 3r A,#e3000b
102,Robo-Volts,Laia; Marc; Noa,,#006cb7
103,Super Bricks,Biel; Júlia; Ona; Arnau,Necessita portàtil propi,
`;

export const JSON_TEMPLATE = JSON.stringify(
  {
    teams: [
      { number: '101', name: 'Els Energètics', members: ['Anna', 'Pau', 'Martina', 'Jan'], notes: 'Grup de 3r A', color: '#e3000b' },
      { number: '102', name: 'Robo-Volts', members: ['Laia', 'Marc', 'Noa'], notes: '' },
    ],
  },
  null,
  2,
);
