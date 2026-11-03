import type { Backup } from '../db/models';
import { DEFAULT_SETTINGS } from '../db/models';
import { MISSION_BY_ID } from '../scoring/rules';

export type BackupValidation = { ok: true; backup: Backup; warnings: string[] } | { ok: false; errors: string[] };

const def = <T,>(defaults: Partial<T>, x: T): T => ({ ...defaults, ...x });
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Valida una còpia de seguretat completa abans de restaurar-la. */
export function validateBackup(raw: unknown): BackupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['El fitxer no és un objecte JSON vàlid.'] };
  if (raw.app !== 'fll-superpowered-tracker') errors.push('El fitxer no és una còpia d\'aquesta aplicació (camp «app»).');
  if (raw.version !== 1) errors.push(`Versió de còpia no compatible: ${String(raw.version)}.`);
  const data = raw.data;
  if (!isObj(data)) return { ok: false, errors: [...errors, 'Falta l\'apartat «data».'] };
  for (const k of ['teams', 'sessions', 'attempts'] as const) {
    if (!Array.isArray(data[k])) errors.push(`Falta la llista «${k}».`);
  }
  if (errors.length) return { ok: false, errors };

  const teams = data.teams as Backup['data']['teams'];
  const sessions = data.sessions as Backup['data']['sessions'];
  const attempts = data.attempts as Backup['data']['attempts'];
  const settings = (Array.isArray(data.settings) ? data.settings : []) as Backup['data']['settings'];

  const teamIds = new Set<string>();
  teams.forEach((t, i) => {
    if (!isObj(t) || typeof t.id !== 'string' || typeof t.name !== 'string') errors.push(`Equip #${i + 1}: falta «id» o «name».`);
    else if (teamIds.has(t.id)) errors.push(`Equip duplicat: ${t.id}.`);
    else teamIds.add(t.id);
  });
  const sessionIds = new Set<string>();
  sessions.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || !Array.isArray(s.missionIds) || !Array.isArray(s.teamIds)) {
      errors.push(`Sessió #${i + 1}: estructura incorrecta.`);
      return;
    }
    if (sessionIds.has(s.id)) errors.push(`Sessió duplicada: ${s.id}.`);
    sessionIds.add(s.id);
    const unknown = s.missionIds.filter((m) => !MISSION_BY_ID[m]);
    if (unknown.length) warnings.push(`Sessió «${s.title}»: missions desconegudes (${unknown.join(', ')}) s'ignoraran.`);
  });
  const attemptIds = new Set<string>();
  attempts.forEach((a, i) => {
    if (!isObj(a) || typeof a.id !== 'string' || typeof a.sessionId !== 'string' || typeof a.teamId !== 'string') {
      errors.push(`Intent #${i + 1}: estructura incorrecta.`);
      return;
    }
    if (attemptIds.has(a.id)) errors.push(`Intent duplicat: ${a.id}.`);
    attemptIds.add(a.id);
    if (!sessionIds.has(a.sessionId)) errors.push(`Intent #${i + 1}: la sessió ${a.sessionId} no existeix.`);
    if (!teamIds.has(a.teamId)) errors.push(`Intent #${i + 1}: l'equip ${a.teamId} no existeix.`);
  });
  if (raw.rulesVersion && raw.rulesVersion !== 'superpowered-es-v1') {
    warnings.push(`La còpia es va fer amb una altra versió de regles (${String(raw.rulesVersion)}).`);
  }
  if (errors.length) return { ok: false, errors };

  // Completa camps opcionals que podrien faltar en còpies antigues o editades a mà.
  const backup: Backup = {
    app: 'fll-superpowered-tracker',
    version: 1,
    exportedAt: String(raw.exportedAt ?? ''),
    rulesVersion: String(raw.rulesVersion ?? ''),
    data: {
      teams: teams.map((t) => def({ members: [], notes: '', color: '#e3000b', emoji: '🤖', createdAt: '', updatedAt: '' }, t)),
      sessions: sessions.map((s) => def({ notes: '', type: 'practice', status: 'draft', log: [], createdAt: '', updatedAt: '' }, s)),
      attempts: attempts.map((a) => def({ inputs: {}, adjustments: [], gp: null, notes: '', revisions: [], number: 1, createdAt: '', updatedAt: '' }, a)),
      settings: settings.filter(isObj).map((s) => ({ ...DEFAULT_SETTINGS, ...s, id: 'app' as const })).slice(0, 1),
    },
  };
  return { ok: true, backup, warnings };
}
