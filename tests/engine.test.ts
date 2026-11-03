import { describe, expect, it } from 'vitest';
import { scoreAttempt, scoreMission, missionMax, combinedMax, defaultInputs } from '../src/scoring/engine';
import { MISSIONS, MISSION_BY_ID, RULES, ENERGY_CAP, FULL_GAME_MAX, FULL_GAME_MAX_SIMPLE } from '../src/scoring/rules';

const M = (id: string) => MISSION_BY_ID[id];
const score = (id: string, inputs: Record<string, unknown>) => scoreMission(M(id), inputs as never).total;

describe('integritat del fitxer de regles', () => {
  it('conté les 15 missions oficials + inspecció + fitxes de precisió', () => {
    const ids = MISSIONS.map((m) => m.id);
    for (let i = 1; i <= 15; i++) expect(ids).toContain(`M${String(i).padStart(2, '0')}`);
    expect(ids).toContain('EI');
    expect(ids).toContain('PT');
  });

  it('cada requisit fa referència a una condició existent de la mateixa missió', () => {
    for (const m of MISSIONS) {
      const ids = new Set(m.conditions.map((c) => c.id));
      for (const c of m.conditions) for (const r of c.requires ?? []) expect(ids.has(r.cond), `${m.id}.${c.id} → ${r.cond}`).toBe(true);
      for (const k of m.constraints ?? []) for (const id of k.conds) expect(ids.has(id)).toBe(true);
    }
  });

  it('les marques de revisió referenciades existeixen', () => {
    const flagIds = new Set(RULES.reviewFlags.map((f) => f.id));
    for (const m of MISSIONS) for (const f of m.reviewFlags ?? []) expect(flagIds.has(f)).toBe(true);
  });
});

describe('màxims per missió (calculats a partir del PDF)', () => {
  const expected: Record<string, number> = {
    EI: 20, M01: 10, M02: 25, M03: 35, M04: 20, M05: 30, M06: 20, M07: 30, M08: 20,
    M09: 30, M10: 25, M11: 20, M12: 25, M13: 15, M14: 25, M15: 15, PT: 50,
  };
  for (const [id, max] of Object.entries(expected)) {
    it(`${id} = ${max}`, () => expect(missionMax(M(id))).toBe(max));
  }
  it('la suma simple dels màxims és 415', () => expect(FULL_GAME_MAX_SIMPLE).toBe(415));
  it('amb el límit de 12 unitats d\'energia el màxim teòric és 410', () => {
    expect(ENERGY_CAP).toBe(12);
    expect(FULL_GAME_MAX).toBe(410);
    expect(combinedMax(MISSIONS, Infinity)).toBe(415);
  });
});

describe('Inspecció i M01', () => {
  it('inspecció: 20 si cap en una àrea', () => {
    expect(score('EI', { fits: true })).toBe(20);
    expect(score('EI', {})).toBe(0);
  });
  it('M01 requereix les tres verificacions del model', () => {
    expect(score('M01', { inArea: true })).toBe(0);
    expect(score('M01', { inArea: true, single: true, white: true })).toBe(0);
    expect(score('M01', { inArea: true, single: true, white: true, studs: true })).toBe(10);
    const r = scoreMission(M('M01'), { inArea: true, single: true });
    const line = r.lines.find((l) => l.condId === 'inArea')!;
    expect(line.status).toBe('blocked');
    expect(line.reasons.length).toBe(2);
  });
});

describe('M02 Plataforma petroliera', () => {
  it('5 per unitat de combustible', () => {
    expect(score('M02', { fuelInTruck: 1 })).toBe(5);
    expect(score('M02', { fuelInTruck: 3 })).toBe(15);
  });
  it('la bonificació requereix almenys 1 unitat al camió', () => {
    expect(score('M02', { truckAtStation: true })).toBe(0);
    expect(score('M02', { fuelInTruck: 1, truckAtStation: true })).toBe(15);
    expect(score('M02', { fuelInTruck: 3, truckAtStation: true })).toBe(25);
  });
  it('més de 3 unitats és una violació i es limita a 3', () => {
    const r = scoreMission(M('M02'), { fuelInTruck: 5 });
    expect(r.total).toBe(15);
    expect(r.violations.length).toBe(1);
  });
});

describe('M03 Emmagatzematge d\'energia', () => {
  it('exemples de la p. 9: 10 / 30 / 35', () => {
    expect(score('M03', { inContainer: 1 })).toBe(10);
    expect(score('M03', { inContainer: 3 })).toBe(30);
    expect(score('M03', { inContainer: 3, trayRemoved: true })).toBe(35);
  });
  it('si les unitats toquen l\'equipament no puntuen (la safata sí)', () => {
    expect(score('M03', { inContainer: 3, trayRemoved: true, noTouch: false })).toBe(5);
  });
});

describe('M04 i M10: bonificacions automàtiques', () => {
  it('M04: 5 c/u + 5 si les 3', () => {
    expect(score('M04', { removed: 2 })).toBe(10);
    expect(score('M04', { removed: 3 })).toBe(20);
  });
  it('M10: 5 c/u + 10 si les 3', () => {
    expect(score('M10', { released: 2 })).toBe(10);
    expect(score('M10', { released: 3 })).toBe(25);
  });
});

describe('M05 Xarxa intel·ligent', () => {
  it('20 + 10 de bonificació si els dos connectors estan aixecats', () => {
    expect(score('M05', { raised: true })).toBe(20);
    expect(score('M05', { raised: true, bothRaised: true })).toBe(30);
  });
  it('la bonificació no compta si el connector propi no està aixecat', () => {
    expect(score('M05', { bothRaised: true })).toBe(0);
  });
  it('si el model toca l\'equipament, res no puntua', () => {
    expect(score('M05', { raised: true, bothRaised: true, noTouch: false })).toBe(0);
  });
});

describe('M06, M07, M08, M11', () => {
  it('M06: 10 + 10 independents', () => {
    expect(score('M06', { offRamp: true })).toBe(10);
    expect(score('M06', { hybridInCar: true })).toBe(10);
    expect(score('M06', { offRamp: true, hybridInCar: true })).toBe(20);
  });
  it('M07: 10 c/u', () => expect(score('M07', { released: 2 })).toBe(20));
  it('M08: 10 + 10 i restricció de contacte', () => {
    expect(score('M08', { tvRaised: true, unitInSlot: true })).toBe(20);
    expect(score('M08', { tvRaised: true, unitInSlot: true, noTouch: false })).toBe(0);
  });
  it('M11: 20', () => expect(score('M11', { released: true })).toBe(20));
});

describe('M09 Dinosaure de joguina', () => {
  it('10 a casa esquerra', () => expect(score('M09', { inLeftHome: true })).toBe(10));
  it('el contingut només compta amb la tapa tancada', () => {
    expect(score('M09', { contents: 'battery' })).toBe(0);
    expect(score('M09', { contents: 'energy', lidClosed: true })).toBe(10);
    expect(score('M09', { contents: 'battery', lidClosed: true })).toBe(20);
    expect(score('M09', { inLeftHome: true, contents: 'battery', lidClosed: true })).toBe(30);
  });
  it('una unitat d\'energia dins compta com a ús d\'energia; la bateria no', () => {
    expect(scoreMission(M('M09'), { contents: 'energy', lidClosed: true }).uses.energy).toBe(1);
    expect(scoreMission(M('M09'), { contents: 'battery', lidClosed: true }).uses.energy ?? 0).toBe(0);
  });
});

describe('M12 Embassament d\'aigua', () => {
  it('5 per unitat a l\'embassament i 10 per ganxo', () => {
    expect(score('M12', { inReservoir: 1, hooks: 1 })).toBe(15);
    expect(score('M12', { inReservoir: 1, hooks: 2 })).toBe(25);
  });
  it('no hi pot haver més de 3 unitats entre embassament i ganxos', () => {
    const r = scoreMission(M('M12'), { inReservoir: 2, hooks: 2 });
    expect(r.violations.length).toBe(1);
  });
  it('màxim 2 ganxos', () => {
    expect(scoreMission(M('M12'), { hooks: 3 }).violations.length).toBe(1);
  });
});

describe('M13, M14, M15', () => {
  it('M13: 5 c/u, màx. 3', () => expect(score('M13', { inArea: 3 })).toBe(15));
  it('M14: 5 c/u + 10 minidinosaure', () => {
    expect(score('M14', { inFactory: 3, miniDino: true })).toBe(25);
    expect(score('M14', { inFactory: 3, miniDino: true, noTouch: false })).toBe(10);
  });
  it('M15: 5 c/u', () => {
    expect(score('M15', { inArea: 3 })).toBe(15);
    expect(score('M15', { inArea: 3, noTouch: false })).toBe(0);
  });
});

describe('Fitxes de precisió', () => {
  const table: Record<string, number> = { '6': 50, '5': 50, '4': 35, '3': 25, '2': 15, '1': 10, '0': 0 };
  for (const [t, p] of Object.entries(table)) {
    it(`${t} fitxes → ${p}`, () => expect(score('PT', { tokens: t })).toBe(p));
  }
  it('per defecte es comença amb 6 fitxes', () => expect(scoreMission(M('PT'), undefined).total).toBe(50));
});

describe('scoreAttempt', () => {
  it('suma missions i ajustos per separat', () => {
    const missions = [M('M02'), M('M11')];
    const r = scoreAttempt(missions, { M02: { fuelInTruck: 2 }, M11: { released: true } }, [
      { id: 'a', points: -5, reason: 'prova', at: '' },
    ]);
    expect(r.missionPoints).toBe(30);
    expect(r.adjustmentPoints).toBe(-5);
    expect(r.total).toBe(25);
    expect(r.max).toBe(45);
  });

  it('detecta més de 12 unitats d\'energia col·locades en destinacions', () => {
    const missions = [M('M03'), M('M08'), M('M09'), M('M13'), M('M14'), M('M15')];
    const inputs = {
      M03: { inContainer: 3 }, M08: { unitInSlot: true }, M09: { lidClosed: true, contents: 'energy' },
      M13: { inArea: 3 }, M14: { inFactory: 3 }, M15: { inArea: 3 },
    };
    const r = scoreAttempt(missions, inputs, [], { globalConstraints: RULES.globalConstraints });
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => v.scope === 'global')).toBe(true);
  });

  it('valors per defecte: 0 punts excepte fitxes de precisió', () => {
    const r = scoreAttempt(MISSIONS, Object.fromEntries(MISSIONS.map((m) => [m.id, defaultInputs(m)])));
    expect(r.missionPoints).toBe(50);
    expect(r.valid).toBe(true);
  });

  it('valors impossibles s\'ignoren de manera segura', () => {
    expect(score('PT', { tokens: 'xyz' })).toBe(50);
    expect(score('M07', { released: -4 })).toBe(0);
    expect(score('M07', { released: 'abc' })).toBe(0);
  });
});
