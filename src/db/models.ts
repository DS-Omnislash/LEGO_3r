import type { Adjustment, AttemptInputs } from '../scoring/types';

export interface Team {
  id: string;
  name: string;
  number?: string;
  members: string[];
  notes: string;
  color: string;
  emoji: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'draft' | 'completed';
/** Pràctica (entrenament setmanal) o competició oficial/simulacre organitzat. */
export type SessionType = 'practice' | 'official';

export interface SessionLogEntry {
  at: string;
  action: 'created' | 'edited' | 'completed' | 'reopened' | 'attempt-deleted' | 'restored';
  detail?: string;
}

export interface Session {
  id: string;
  date: string; // AAAA-MM-DD
  title: string;
  notes: string;
  missionIds: string[];
  teamIds: string[];
  status: SessionStatus;
  type: SessionType;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  log: SessionLogEntry[];
}

export interface AttemptRevision {
  at: string;
  note: string;
  inputs: AttemptInputs;
  adjustments: Adjustment[];
  gp: number | null;
  total: number;
}

export interface Attempt {
  id: string;
  sessionId: string;
  teamId: string;
  number: number;
  inputs: AttemptInputs;
  adjustments: Adjustment[];
  /** Gracious Professionalism® (2/3/4). No suma al joc del robot. */
  gp: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  revisions: AttemptRevision[];
}

export type RankingMethod = 'cumulative' | 'bestPerMission' | 'session' | 'bestMatch';
export type SessionAggregation = 'best' | 'last';
export type TieBreak = 'none' | 'nextBest';
export type ResultScope = 'all' | 'practice' | 'official';

export interface Settings {
  id: 'app';
  competitionName: string;
  rankingMethod: RankingMethod;
  sessionAggregation: SessionAggregation;
  tieBreak: TieBreak;
  scope: ResultScope;
  includeAdjustments: boolean;
  showOfficialText: boolean;
  defaultMissionIds: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  competitionName: 'Lliga SUPERPOWERED de l\'aula',
  rankingMethod: 'cumulative',
  sessionAggregation: 'best',
  tieBreak: 'none',
  scope: 'all',
  includeAdjustments: true,
  showOfficialText: false,
  defaultMissionIds: ['PT'],
};

export interface Snapshot {
  id: string;
  at: string;
  reason: string;
  backup: Backup;
}

export interface Backup {
  app: 'fll-superpowered-tracker';
  version: 1;
  exportedAt: string;
  rulesVersion: string;
  data: {
    teams: Team[];
    sessions: Session[];
    attempts: Attempt[];
    settings: Settings[];
  };
}
