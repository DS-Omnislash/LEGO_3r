import { describe, expect, it } from 'vitest';
import { parseTeamsFile, CSV_TEMPLATE, JSON_TEMPLATE, teamsToCSV } from '../src/lib/teamsIO';
import { validateBackup } from '../src/lib/backup';
import type { Team } from '../src/db/models';

describe('importació d\'equips', () => {
  it('llegeix la plantilla CSV', () => {
    const r = parseTeamsFile(CSV_TEMPLATE, 'equips.csv');
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]).toMatchObject({ name: 'Els Energètics', number: '101', members: ['Anna', 'Pau', 'Martina', 'Jan'] });
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
  });
  it('llegeix la plantilla JSON', () => {
    const r = parseTeamsFile(JSON_TEMPLATE, 'equips.json');
    expect(r.rows.length).toBe(2);
    expect(r.rows[1].members).toEqual(['Laia', 'Marc', 'Noa']);
  });
  it('accepta capçaleres en castellà/anglès', () => {
    const r = parseTeamsFile('Nombre;Número;Miembros\nRobots;7;Ana|Luis\n', 'x.csv');
    expect(r.rows[0]).toMatchObject({ name: 'Robots', number: '7', members: ['Ana', 'Luis'] });
  });
  it('detecta noms buits i identificadors duplicats', () => {
    const r = parseTeamsFile('nom,numero\nA,1\n,2\nB,1\na,3\n', 'x.csv');
    const errs = r.issues.filter((i) => i.level === 'error');
    expect(errs.some((e) => e.row === 2 && /nom/.test(e.message))).toBe(true);
    expect(errs.some((e) => e.row === 3 && /Número d'equip duplicat/.test(e.message))).toBe(true);
    expect(errs.some((e) => e.row === 4 && /Nom d'equip duplicat/.test(e.message))).toBe(true);
  });
  it('error si falta la columna de nom', () => {
    const r = parseTeamsFile('numero,membres\n1,Anna\n', 'x.csv');
    expect(r.issues.some((i) => i.level === 'error' && /columna/.test(i.message))).toBe(true);
  });
  it('JSON mal format', () => {
    expect(parseTeamsFile('{ hola', 'x.json').issues[0].level).toBe('error');
  });
  it('detecta coincidències amb equips existents', () => {
    const existing = [{ id: 't1', name: 'Robo-Volts', number: '999' } as Team];
    const r = parseTeamsFile(CSV_TEMPLATE, 'x.csv', existing);
    expect(r.matches[2]).toBe('t1');
  });
  it('exporta i torna a importar el mateix contingut', () => {
    const teams = parseTeamsFile(CSV_TEMPLATE, 'x.csv').rows.map((r, i) => ({ ...r, id: String(i), color: r.color ?? '#000000', emoji: '🤖', createdAt: '', updatedAt: '' })) as Team[];
    const again = parseTeamsFile(teamsToCSV(teams), 'y.csv');
    expect(again.rows.map((r) => r.name)).toEqual(teams.map((t) => t.name));
    expect(again.rows[0].members).toEqual(teams[0].members);
  });
});

describe('validació de còpies de seguretat', () => {
  const good = {
    app: 'fll-superpowered-tracker', version: 1, exportedAt: 'x', rulesVersion: 'superpowered-es-v1',
    data: {
      teams: [{ id: 't', name: 'T' }],
      sessions: [{ id: 's', title: 'S', missionIds: ['M01'], teamIds: ['t'] }],
      attempts: [{ id: 'a', sessionId: 's', teamId: 't' }],
      settings: [],
    },
  };
  it('accepta una còpia correcta i completa camps per defecte', () => {
    const v = validateBackup(good);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.backup.data.attempts[0].revisions).toEqual([]);
  });
  it('rebutja fitxers d\'una altra aplicació', () => {
    expect(validateBackup({ ...good, app: 'altra' }).ok).toBe(false);
  });
  it('rebutja intents que apunten a equips inexistents', () => {
    const bad = { ...good, data: { ...good.data, attempts: [{ id: 'a', sessionId: 's', teamId: 'zz' }] } };
    expect(validateBackup(bad).ok).toBe(false);
  });
});
