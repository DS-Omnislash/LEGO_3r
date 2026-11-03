import Dexie, { type Table } from 'dexie';
import type { Attempt, Session, Settings, Snapshot, Team } from './models';

/** Base de dades local del navegador (IndexedDB). Persisteix entre recàrregues i reinicis. */
export class TrackerDB extends Dexie {
  teams!: Table<Team, string>;
  sessions!: Table<Session, string>;
  attempts!: Table<Attempt, string>;
  settings!: Table<Settings, string>;
  snapshots!: Table<Snapshot, string>;

  constructor(name = 'fll-superpowered-tracker') {
    super(name);
    this.version(1).stores({
      teams: 'id, name, number',
      sessions: 'id, date, status',
      attempts: 'id, sessionId, teamId, [sessionId+teamId]',
      settings: 'id',
      snapshots: 'id, at',
    });
  }
}

export const db = new TrackerDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const now = () => new Date().toISOString();

/** Demana al navegador que no esborri les dades automàticament. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignorat */
  }
  return null;
}
