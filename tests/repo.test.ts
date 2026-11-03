import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import * as repo from '../src/db/repo';
import { computeRanking } from '../src/lib/rankings';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function workflow() {
  const a = await repo.createTeam({ name: 'Alfa', members: ['Anna'], notes: '' });
  const b = await repo.createTeam({ name: 'Beta', members: [], notes: '' });
  const s = await repo.createSession({ date: '2026-10-22', title: 'Setmana 1', notes: '', missionIds: ['M07', 'PT'], teamIds: [a.id, b.id], type: 'practice' });
  const at = await repo.createAttempt(s.id, a.id);
  await repo.saveAttempt(at.id, { inputs: { M07: { released: 2 }, PT: { tokens: '5' } } });
  const bt = await repo.createAttempt(s.id, b.id);
  await repo.saveAttempt(bt.id, { inputs: { M07: { released: 3 }, PT: { tokens: '2' } } });
  await repo.completeSession(s.id);
  return { a, b, s, at, bt };
}

async function ranking() {
  const [teams, sessions, attempts, settings] = await Promise.all([db.teams.toArray(), db.sessions.toArray(), db.attempts.toArray(), repo.getSettings()]);
  return computeRanking({ teams, sessions, attempts, settings });
}

describe('flux complet amb IndexedDB', () => {
  it('equips → sessió → resultats → classificació', async () => {
    await workflow();
    const r = await ranking();
    expect(r.map((x) => [x.team.name, x.value])).toEqual([['Alfa', 70], ['Beta', 45]]);
  });

  it('reobrir i corregir conserva l\'historial', async () => {
    const { s, at } = await workflow();
    await repo.reopenSession(s.id, 'Error en les fitxes');
    await repo.saveAttempt(at.id, { inputs: { M07: { released: 2 }, PT: { tokens: '6' } } });
    await repo.completeSession(s.id);
    const saved = (await db.attempts.get(at.id))!;
    expect(saved.revisions.length).toBe(1);
    expect(saved.revisions[0].total).toBe(70);
    const sess = (await db.sessions.get(s.id))!;
    expect(sess.log.map((l) => l.action)).toEqual(['created', 'completed', 'reopened', 'completed']);
    expect((await ranking())[0].value).toBe(70);
  });

  it('esborrar un intent d\'una sessió ja completada és recuperable', async () => {
    const { s, at } = await workflow();
    await repo.reopenSession(s.id, '');
    await repo.deleteAttempt(at.id);
    expect((await db.attempts.get(at.id))!.deletedAt).toBeTruthy();
    expect((await ranking()).find((x) => x.team.name === 'Alfa')!.hasResults).toBe(false);
    await repo.restoreAttempt(at.id);
    expect((await db.attempts.get(at.id))!.deletedAt).toBeFalsy();
  });

  it('exportar i restaurar una còpia completa', async () => {
    await workflow();
    const backup = JSON.parse(JSON.stringify(await repo.exportBackup()));
    await repo.resetAll();
    expect(await db.teams.count()).toBe(0);
    const res = await repo.restoreBackup(backup);
    expect(res).toEqual({ teams: 2, sessions: 1, attempts: 2 });
    expect((await ranking()).map((x) => x.value)).toEqual([70, 45]);
    expect(await db.snapshots.count()).toBe(2);
  });

  it('esborrar un equip elimina els seus intents', async () => {
    const { a, s } = await workflow();
    await repo.deleteTeam(a.id);
    expect(await db.attempts.where('teamId').equals(a.id).count()).toBe(0);
    expect((await db.sessions.get(s.id))!.teamIds).not.toContain(a.id);
  });
});
