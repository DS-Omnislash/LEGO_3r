import { db, now, uid } from './db';
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type Backup,
  type Session,
  type SessionLogEntry,
  type Settings,
  type Team,
} from './models';
import { RULES } from '../scoring/rules';
import { attemptResult } from '../lib/compute';
import { validateBackup } from '../lib/backup';

export const TEAM_COLORS = [
  '#e3000b', '#006cb7', '#ffd500', '#00af4d', '#f57d20', '#7a3c96',
  '#00a3da', '#e95da2', '#8fc13f', '#a05a2c', '#1b2a4a', '#00897b',
];
export const TEAM_EMOJIS = ['🤖', '⚡', '🔋', '🌞', '💧', '🌬️', '🦖', '🚀', '🧱', '🔧', '🏭', '🛢️', '📺', '🚗', '🌱', '🦾'];

export function pickColor(i: number) {
  return TEAM_COLORS[i % TEAM_COLORS.length];
}
export function pickEmoji(i: number) {
  return TEAM_EMOJIS[i % TEAM_EMOJIS.length];
}

// ---- Configuració ----------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'app' });
}

// ---- Equips ------------------------------------------------------------------

export type TeamDraft = Pick<Team, 'name' | 'members' | 'notes'> & Partial<Pick<Team, 'number' | 'color' | 'emoji' | 'archived'>>;

export async function createTeam(d: TeamDraft): Promise<Team> {
  const count = await db.teams.count();
  const t: Team = {
    id: uid(),
    name: d.name.trim(),
    number: d.number?.trim() || undefined,
    members: d.members.map((m) => m.trim()).filter(Boolean),
    notes: d.notes ?? '',
    color: d.color || pickColor(count),
    emoji: d.emoji || pickEmoji(count),
    archived: !!d.archived,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.teams.add(t);
  return t;
}

export async function updateTeam(id: string, patch: Partial<Team>) {
  await db.teams.update(id, { ...patch, updatedAt: now() });
}

export async function deleteTeam(id: string) {
  await db.transaction('rw', db.teams, db.attempts, db.sessions, async () => {
    await db.attempts.where('teamId').equals(id).delete();
    const sessions = await db.sessions.toArray();
    for (const s of sessions) {
      if (s.teamIds.includes(id)) await db.sessions.update(s.id, { teamIds: s.teamIds.filter((t) => t !== id) });
    }
    await db.teams.delete(id);
  });
}

export async function teamHasResults(id: string) {
  return (await db.attempts.where('teamId').equals(id).filter((a) => !a.deletedAt).count()) > 0;
}

// ---- Sessions ----------------------------------------------------------------

export type SessionDraft = Pick<Session, 'date' | 'title' | 'notes' | 'missionIds' | 'teamIds' | 'type'>;

const log = (action: SessionLogEntry['action'], detail?: string): SessionLogEntry => ({ at: now(), action, detail });

export async function createSession(d: SessionDraft): Promise<Session> {
  const s: Session = {
    ...d,
    id: uid(),
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
    log: [log('created')],
  };
  await db.sessions.add(s);
  return s;
}

export async function updateSession(id: string, patch: Partial<SessionDraft>) {
  const s = await db.sessions.get(id);
  if (!s) return;
  await db.sessions.put({ ...s, ...patch, updatedAt: now(), log: [...s.log, log('edited')] });
}

export async function completeSession(id: string) {
  const s = await db.sessions.get(id);
  if (!s) return;
  await db.sessions.put({ ...s, status: 'completed', completedAt: now(), updatedAt: now(), log: [...s.log, log('completed')] });
}

/** Reobre una sessió completada desant una revisió de cada intent per no perdre l'historial. */
export async function reopenSession(id: string, reason: string) {
  await db.transaction('rw', db.sessions, db.attempts, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    const attempts = await db.attempts.where('sessionId').equals(id).toArray();
    for (const a of attempts) {
      if (a.deletedAt) continue;
      const total = attemptResult(a, s).total;
      await db.attempts.put({
        ...a,
        revisions: [
          ...a.revisions,
          { at: now(), note: `Estat abans de reobrir la sessió${reason ? `: ${reason}` : ''}`, inputs: a.inputs, adjustments: a.adjustments, gp: a.gp, total },
        ],
      });
    }
    await db.sessions.put({ ...s, status: 'draft', updatedAt: now(), log: [...s.log, log('reopened', reason)] });
  });
}

export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.attempts, async () => {
    await db.attempts.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

export async function duplicateSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id);
  if (!s) return;
  return createSession({
    date: new Date().toISOString().slice(0, 10),
    title: `${s.title} (còpia)`,
    notes: s.notes,
    missionIds: s.missionIds,
    teamIds: s.teamIds,
    type: s.type,
  });
}

// ---- Intents -----------------------------------------------------------------

export async function createAttempt(sessionId: string, teamId: string): Promise<Attempt> {
  const existing = await db.attempts.where('[sessionId+teamId]').equals([sessionId, teamId]).toArray();
  const a: Attempt = {
    id: uid(),
    sessionId,
    teamId,
    number: existing.reduce((m, x) => Math.max(m, x.number), 0) + 1,
    inputs: {},
    adjustments: [],
    gp: RULES.graciousProfessionalism.default,
    notes: '',
    createdAt: now(),
    updatedAt: now(),
    revisions: [],
  };
  await db.attempts.add(a);
  return a;
}

export async function saveAttempt(id: string, patch: Partial<Pick<Attempt, 'inputs' | 'adjustments' | 'gp' | 'notes'>>) {
  await db.attempts.update(id, { ...patch, updatedAt: now() });
}

/** Esborra un intent. Si la sessió ja s'havia completat alguna vegada, l'intent es marca com a esborrat (recuperable). */
export async function deleteAttempt(id: string) {
  await db.transaction('rw', db.attempts, db.sessions, async () => {
    const a = await db.attempts.get(id);
    if (!a) return;
    const s = await db.sessions.get(a.sessionId);
    if (s?.completedAt) {
      await db.attempts.update(id, { deletedAt: now(), updatedAt: now() });
      await db.sessions.update(s.id, { log: [...s.log, log('attempt-deleted', `Intent ${a.number}`)] });
    } else {
      await db.attempts.delete(id);
    }
  });
}

export async function restoreAttempt(id: string) {
  const a = await db.attempts.get(id);
  if (!a) return;
  await db.attempts.put({ ...a, deletedAt: undefined, updatedAt: now() });
}

// ---- Còpies de seguretat ----------------------------------------------------

export async function exportBackup(): Promise<Backup> {
  const [teams, sessions, attempts, settings] = await Promise.all([
    db.teams.toArray(),
    db.sessions.toArray(),
    db.attempts.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: 'fll-superpowered-tracker',
    version: 1,
    exportedAt: now(),
    rulesVersion: RULES.meta.rulesVersion,
    data: { teams, sessions, attempts, settings },
  };
}

async function takeSnapshot(reason: string) {
  const backup = await exportBackup();
  await db.snapshots.add({ id: uid(), at: now(), reason, backup });
  const all = await db.snapshots.orderBy('at').toArray();
  for (const s of all.slice(0, Math.max(0, all.length - 5))) await db.snapshots.delete(s.id);
}

/** Restaura una còpia completa (substitueix totes les dades). Desa abans una instantània automàtica. */
export async function restoreBackup(raw: unknown): Promise<{ teams: number; sessions: number; attempts: number }> {
  const v = validateBackup(raw);
  if (!v.ok) throw new Error(v.errors.join('\n'));
  await takeSnapshot('Abans de restaurar una còpia');
  return replaceAllData(v.backup);
}

/** Substitueix totes les dades per les d'una còpia ja validada (sense instantània). */
export async function replaceAllData(b: Backup): Promise<{ teams: number; sessions: number; attempts: number }> {
  await db.transaction('rw', db.teams, db.sessions, db.attempts, db.settings, async () => {
    await Promise.all([db.teams.clear(), db.sessions.clear(), db.attempts.clear(), db.settings.clear()]);
    await db.teams.bulkAdd(b.data.teams);
    await db.sessions.bulkAdd(b.data.sessions);
    await db.attempts.bulkAdd(b.data.attempts);
    if (b.data.settings.length) await db.settings.bulkAdd(b.data.settings);
  });
  return { teams: b.data.teams.length, sessions: b.data.sessions.length, attempts: b.data.attempts.length };
}

export async function restoreSnapshot(id: string) {
  const s = await db.snapshots.get(id);
  if (!s) throw new Error('Instantània no trobada');
  return restoreBackup(s.backup);
}

export async function resetAll() {
  await takeSnapshot('Abans d\'esborrar totes les dades');
  await db.transaction('rw', db.teams, db.sessions, db.attempts, db.settings, async () => {
    await Promise.all([db.teams.clear(), db.sessions.clear(), db.attempts.clear(), db.settings.clear()]);
  });
}
