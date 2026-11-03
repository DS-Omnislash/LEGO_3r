import { scoreAttempt } from '../scoring/engine';
import { getMissions, RULES } from '../scoring/rules';
import type { AttemptResult } from '../scoring/types';
import type { Attempt, Session } from '../db/models';

const cache = new Map<string, { key: string; result: AttemptResult }>();

/** Resultat calculat d'un intent amb les missions de la seva sessió (amb memòria cau). */
export function attemptResult(a: Attempt, s: Pick<Session, 'missionIds'>): AttemptResult {
  const key = `${a.updatedAt}|${s.missionIds.join(',')}`;
  const hit = cache.get(a.id);
  if (hit && hit.key === key) return hit.result;
  const result = scoreAttempt(getMissions(s.missionIds), a.inputs, a.adjustments, {
    globalConstraints: RULES.globalConstraints,
  });
  cache.set(a.id, { key, result });
  return result;
}
