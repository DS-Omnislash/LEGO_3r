import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS, type Attempt, type Session, type Settings, type Team } from './models';

const EMPTY: never[] = [];

/** Consultes reactives: qualsevol canvi a la base de dades actualitza tota la interfície. */
export function useTeams(includeArchived = true): Team[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.teams.toArray();
    // Equips amb número primer (ordre numèric), després la resta per nom.
    all.sort((a, b) => (a.number ? 0 : 1) - (b.number ? 0 : 1) || (a.number ?? '').localeCompare(b.number ?? '', 'ca', { numeric: true }) || a.name.localeCompare(b.name, 'ca'));
    return includeArchived ? all : all.filter((t) => !t.archived);
  }, [includeArchived]);
}

export function useSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.sessions.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  });
}

export function useSession(id: string | undefined): Session | undefined | null {
  return useLiveQuery(async () => (id ? (await db.sessions.get(id)) ?? null : null), [id]);
}

export function useAttempts(sessionId?: string): Attempt[] | undefined {
  return useLiveQuery(
    () => (sessionId ? db.attempts.where('sessionId').equals(sessionId).toArray() : db.attempts.toArray()),
    [sessionId],
  );
}

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('app'));
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export function useSnapshots() {
  return useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray()) ?? EMPTY;
}

/** Dades bàsiques per a les pàgines d'anàlisi. */
export function useAllData() {
  const teams = useTeams();
  const sessions = useSessions();
  const attempts = useAttempts();
  const settings = useSettings();
  const loading = !teams || !sessions || !attempts;
  return { teams: teams ?? EMPTY, sessions: sessions ?? EMPTY, attempts: attempts ?? EMPTY, settings, loading };
}
