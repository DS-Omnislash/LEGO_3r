import data from '../data/superpowered.json';
import type { Mission, RuleBook } from './types';
import { combinedMax, missionMax } from './engine';

export const RULES = data as unknown as RuleBook;
export const MISSIONS: Mission[] = RULES.missions;
export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const ENERGY_CAP = RULES.globalConstraints.find((g) => g.resource === 'energy')?.max ?? Infinity;

export function getMissions(ids: string[]): Mission[] {
  // Manté l'ordre oficial de la taula de puntuació.
  return MISSIONS.filter((m) => ids.includes(m.id));
}

export function maxFor(ids: string[]): number {
  return combinedMax(getMissions(ids), ENERGY_CAP);
}

export const FULL_GAME_MAX = combinedMax(MISSIONS, ENERGY_CAP);
export const FULL_GAME_MAX_SIMPLE = MISSIONS.reduce((s, m) => s + missionMax(m), 0);

export function flagsFor(missionId: string) {
  return RULES.reviewFlags.filter((f) => f.mission === missionId);
}
