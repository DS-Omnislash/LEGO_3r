// Tipus del fitxer de regles (src/data/superpowered.json) i del motor de puntuació.

export type ResourceKey = 'energy' | 'fuel' | 'waterLoop';
export type Uses = Partial<Record<ResourceKey, number>>;
export type Origin = 'official' | 'derived';

export interface Requirement {
  cond: string;
  op: 'is' | 'gte';
  value: boolean | number | string;
  reason: string;
}

interface ConditionBase {
  id: string;
  label: string;
  /** Text literal del PDF oficial (castellà). */
  official: string;
  page: number;
  bonus?: boolean;
  requires?: Requirement[];
}

export interface BooleanCondition extends ConditionBase {
  type: 'boolean';
  points: number;
  uses?: Uses;
}

export interface CountCondition extends ConditionBase {
  type: 'count';
  pointsEach: number;
  max: number;
  maxOrigin: Origin;
  maxSource?: string;
  uses?: Uses;
}

export interface SelectOption {
  value: string;
  label: string;
  points: number;
  uses?: Uses;
  origin?: Origin;
}

export interface SelectCondition extends ConditionBase {
  type: 'select';
  default: string;
  options: SelectOption[];
}

/** Verificació de l'àrbitre: no dona punts, però en pot bloquejar. */
export interface CheckCondition extends ConditionBase {
  type: 'check';
  default: boolean;
}

/** Bonificació calculada automàticament a partir d'altres condicions. */
export interface AutoCondition extends ConditionBase {
  type: 'auto';
  points: number;
}

export type Condition =
  | BooleanCondition
  | CountCondition
  | SelectCondition
  | CheckCondition
  | AutoCondition;

export interface SumMaxConstraint {
  type: 'sumMax';
  conds: string[];
  max: number;
  origin: Origin;
  reason: string;
}

export interface Mission {
  id: string;
  number: string;
  kind: 'mission' | 'general';
  journey?: string;
  name: string;
  officialName: string;
  pages: number[];
  position?: { x: number; y: number };
  story: string;
  storyOfficial: string;
  task: string;
  taskOfficial: string;
  setup: string;
  setupPage: number;
  conditions: Condition[];
  constraints?: SumMaxConstraint[];
  reviewFlags?: string[];
}

export interface GlobalConstraint {
  id: string;
  type: 'resourceMax';
  resource: ResourceKey;
  max: number;
  origin: Origin;
  source: string;
  reason: string;
}

export interface ReviewFlag {
  id: string;
  mission: string | null;
  text: string;
}

export interface RuleBook {
  meta: { season: string; source: string; rulesVersion: string; matchDuration: string; extractedOn: string; notes: string[] };
  resources: Record<ResourceKey, { label: string; total: number; source: string }>;
  globalConstraints: GlobalConstraint[];
  missions: Mission[];
  graciousProfessionalism: {
    name: string;
    pages: number[];
    countsTowardRobotScore: boolean;
    official: string;
    note: string;
    default: number;
    options: { value: number; label: string; official: string }[];
  };
  journeys: Record<string, { label: string; session: number; color: string }>;
  officialRules: { title: string; text: string; page: number }[];
  reviewFlags: ReviewFlag[];
}

// ---- Entrades i resultats -------------------------------------------------

export type InputValue = boolean | number | string;
/** Valors introduïts per a una missió: condId → valor. */
export type MissionInputs = Record<string, InputValue>;
/** Valors d'un intent: missionId → condicions. */
export type AttemptInputs = Record<string, MissionInputs>;

export interface Adjustment {
  id: string;
  points: number;
  reason: string;
  at: string;
}

export type LineStatus = 'scored' | 'zero' | 'blocked';

export interface LineResult {
  condId: string;
  label: string;
  type: Condition['type'];
  value: InputValue;
  points: number;
  /** Punts que donaria la condició si no estigués bloquejada. */
  wouldScore: number;
  maxPoints: number;
  status: LineStatus;
  reasons: string[];
  bonus: boolean;
}

export interface Violation {
  scope: 'mission' | 'global';
  missionId?: string;
  message: string;
}

export interface MissionResult {
  missionId: string;
  total: number;
  max: number;
  lines: LineResult[];
  violations: Violation[];
  uses: Uses;
}

export interface AttemptResult {
  missions: MissionResult[];
  missionPoints: number;
  adjustmentPoints: number;
  total: number;
  /** Màxim teòric de les missions seleccionades (té en compte el límit d'unitats d'energia). */
  max: number;
  /** Suma simple dels màxims de cada missió (sense límits globals). */
  maxSimple: number;
  violations: Violation[];
  valid: boolean;
}
