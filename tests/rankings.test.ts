import { describe, expect, it } from 'vitest';
import { computeRanking, improvements, missionStats } from '../src/lib/rankings';
import { DEFAULT_SETTINGS, type Attempt, type Session, type Settings, type Team } from '../src/db/models';
import type { AttemptInputs } from '../src/scoring/types';

const team = (id: string, name: string): Team => ({ id, name, members: [], notes: '', color: '#000', emoji: '🤖', createdAt: '', updatedAt: '' });
const session = (id: string, date: string, missionIds: string[], extra: Partial<Session> = {}): Session => ({
  id, date, title: id, notes: '', missionIds, teamIds: ['a', 'b', 'c'], status: 'completed', type: 'practice', createdAt: date, updatedAt: date, log: [], ...extra,
});
let n = 0;
const attempt = (sessionId: string, teamId: string, inputs: AttemptInputs, extra: Partial<Attempt> = {}): Attempt => ({
  id: `x${++n}`, sessionId, teamId, number: 1, inputs, adjustments: [], gp: 3, notes: '', createdAt: '', updatedAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`, revisions: [], ...extra,
});

const teams = [team('a', 'Alfa'), team('b', 'Beta'), team('c', 'Gamma')];
const sessions = [
  session('s1', '2026-10-01', ['M11']),
  session('s2', '2026-10-08', ['M07']),
  session('s3', '2026-10-15', ['M07'], { status: 'draft' }),
  session('s4', '2026-10-20', ['M11'], { type: 'official' }),
];
const attempts = [
  attempt('s1', 'a', { M11: { released: true } }), // 20
  attempt('s1', 'b', {}), // 0
  attempt('s2', 'a', { M07: { released: 1 } }), // 10
  attempt('s2', 'a', { M07: { released: 3 } }, { number: 2 }), // 30
  attempt('s2', 'b', { M07: { released: 3 } }), // 30
  attempt('s2', 'c', { M07: { released: 2 } }), // 20
  attempt('s3', 'c', { M07: { released: 3 } }), // esborrany: no compta a l'acumulada
  attempt('s4', 'b', { M11: { released: true } }), // oficial: 20
];
const S = (p: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...p });
const rank = (p: Partial<Settings>, extra: object = {}) => computeRanking({ teams, sessions, attempts, settings: S(p), ...extra });

describe('classificació acumulada', () => {
  it('suma el millor intent de cada sessió completada', () => {
    const r = rank({});
    const by = Object.fromEntries(r.map((x) => [x.team.id, x.value]));
    expect(by).toEqual({ a: 50, b: 50, c: 20 });
  });
  it('mostra empats sense regla de desempat', () => {
    const r = rank({});
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(1);
    expect(r[0].tied && r[1].tied).toBe(true);
    expect(r[2].rank).toBe(3);
  });
  it('«últim intent» fa servir l\'últim intent de cada sessió', () => {
    const attempts2 = [...attempts, attempt('s2', 'a', { M07: { released: 0 } }, { number: 3 })];
    const r = computeRanking({ teams, sessions, attempts: attempts2, settings: S({ sessionAggregation: 'last' }) });
    expect(r.find((x) => x.team.id === 'a')!.value).toBe(20);
  });
  it('filtra per abast (pràctica / oficial)', () => {
    expect(rank({ scope: 'practice' }).find((x) => x.team.id === 'b')!.value).toBe(30);
    expect(rank({ scope: 'official' }).find((x) => x.team.id === 'b')!.value).toBe(20);
  });
  it('filtra per dates', () => {
    const r = rank({}, { filters: { from: '2026-10-05', to: '2026-10-10' } });
    expect(r.find((x) => x.team.id === 'a')!.value).toBe(30);
  });
  it('els intents esborrats no compten', () => {
    const attempts2 = attempts.map((a) => (a.sessionId === 's1' && a.teamId === 'a' ? { ...a, deletedAt: 'x' } : a));
    const r = computeRanking({ teams, sessions, attempts: attempts2, settings: S() });
    expect(r.find((x) => x.team.id === 'a')!.value).toBe(30);
  });
  it('els ajustos manuals es poden excloure', () => {
    const attempts2 = [...attempts, attempt('s1', 'c', {}, { adjustments: [{ id: 'j', points: 7, reason: 'r', at: '' }] })];
    expect(computeRanking({ teams, sessions, attempts: attempts2, settings: S() }).find((x) => x.team.id === 'c')!.value).toBe(27);
    expect(computeRanking({ teams, sessions, attempts: attempts2, settings: S({ includeAdjustments: false }) }).find((x) => x.team.id === 'c')!.value).toBe(20);
  });
});

describe('altres mètodes', () => {
  it('millor intent per missió', () => {
    const r = rank({}, { method: 'bestPerMission' });
    const by = Object.fromEntries(r.map((x) => [x.team.id, x.value]));
    expect(by).toEqual({ a: 50, b: 50, c: 20 });
  });
  it('millor partida amb desempat oficial (2a millor)', () => {
    const r = rank({ tieBreak: 'nextBest' }, { method: 'bestMatch' });
    // a: [30,20,10], b: [30,20,0] → a guanya per la 3a millor.
    expect(r[0].team.id).toBe('a');
    expect(r[0].tied).toBe(false);
    expect(r[1].team.id).toBe('b');
  });
  it('sessió individual inclou esborranys de la sessió triada', () => {
    const r = rank({}, { method: 'session', filters: { sessionId: 's3' } });
    expect(r[0].team.id).toBe('c');
    expect(r[0].value).toBe(30);
  });
});

describe('estadístiques', () => {
  it('estadístiques per missió', () => {
    const st = missionStats(sessions, attempts, S());
    const m07 = st.find((m) => m.missionId === 'M07')!;
    expect(m07.attempts).toBe(4);
    expect(m07.best).toBe(30);
    expect(m07.max).toBe(30);
    expect(m07.fullScoreRate).toBe(50);
  });
  it('millora en % del màxim entre les dues últimes sessions', () => {
    const imp = improvements(teams, sessions, attempts, S());
    const b = imp.find((i) => i.team.id === 'b')!;
    expect(b.fromPct).toBe(100); // s2: 30/30
    expect(b.toPct).toBe(100); // s4: 20/20
  });
});
