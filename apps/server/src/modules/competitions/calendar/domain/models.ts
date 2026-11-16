import type { LocalTeam } from '../../domain/models.js';

export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'postponed' | 'cancelled';

export interface CompetitionStage {
  readonly id: string;
  readonly seasonId: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly createdAt: string;
}

export interface CompetitionRound {
  readonly id: string;
  readonly seasonId: string;
  readonly stageId: string | null;
  readonly name: string;
  readonly displayOrder: number;
  readonly createdAt: string;
}

export interface CompetitionMatch {
  readonly id: string;
  readonly seasonId: string;
  readonly stage: { readonly id: string; readonly name: string } | null;
  readonly round: { readonly id: string; readonly name: string } | null;
  readonly homeTeam: LocalTeam;
  readonly awayTeam: LocalTeam;
  readonly kickoffAt: string | null;
  readonly status: MatchStatus;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type MatchChangeType =
  'created' | 'schedule_updated' | 'status_updated' | 'result_recorded' | 'result_corrected';

export interface MatchResultHistory {
  readonly id: string;
  readonly matchId: string;
  readonly changeType: MatchChangeType;
  readonly stageId: string | null;
  readonly roundId: string | null;
  readonly status: MatchStatus;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly kickoffAt: string | null;
  readonly recordedAt: string;
}
