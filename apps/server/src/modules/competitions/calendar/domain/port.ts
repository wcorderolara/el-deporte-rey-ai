import type { LocalTeam } from '../../domain/models.js';
import type {
  CompetitionMatch,
  CompetitionRound,
  CompetitionStage,
  MatchResultHistory,
  MatchStatus,
} from './models.js';

export interface NewStage {
  id: string;
  seasonId: string;
  name: string;
  normalizedName: string;
  displayOrder: number;
  createdAt: string;
}
export interface NewRound {
  id: string;
  seasonId: string;
  stageId: string | null;
  name: string;
  normalizedName: string;
  displayOrder: number;
  createdAt: string;
}
export interface NewMatch {
  id: string;
  historyId: string;
  seasonId: string;
  stageId: string | null;
  roundId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MatchSchedulePatch {
  kickoffAt?: string | null;
  stageId?: string | null;
  roundId?: string | null;
}
export interface CalendarNamePatch {
  name: string;
  normalizedName: string;
}
export interface RoundUpdatePatch {
  name?: string;
  normalizedName?: string;
  stageId?: string | null;
}
export interface RoundHistoryEntry {
  matchId: string;
  id: string;
}
export interface MatchCurrent {
  id: string;
  seasonId: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string | null;
  stageId: string | null;
  roundId: string | null;
}
export interface CompetitionCalendarPort {
  listStages(competitionId: string, seasonId: string): CompetitionStage[];
  getStage(competitionId: string, seasonId: string, stageId: string): CompetitionStage;
  createStage(competitionId: string, input: NewStage): CompetitionStage;
  updateStage(competitionId: string, seasonId: string, stageId: string, patch: CalendarNamePatch): CompetitionStage;
  listRounds(competitionId: string, seasonId: string, stageId: string | null): CompetitionRound[];
  getRound(competitionId: string, seasonId: string, roundId: string): CompetitionRound;
  createRound(competitionId: string, input: NewRound): CompetitionRound;
  updateRound(
    competitionId: string,
    seasonId: string,
    roundId: string,
    patch: RoundUpdatePatch,
    history: readonly RoundHistoryEntry[],
    at: string,
  ): CompetitionRound;
  deleteRound(competitionId: string, seasonId: string, roundId: string): void;
  listParticipants(competitionId: string, seasonId: string): LocalTeam[];
  listMatches(competitionId: string, seasonId: string): CompetitionMatch[];
  getMatch(competitionId: string, seasonId: string, matchId: string): CompetitionMatch;
  getMatchCurrent(competitionId: string, seasonId: string, matchId: string): MatchCurrent;
  createMatch(competitionId: string, input: NewMatch): CompetitionMatch;
  updateSchedule(
    competitionId: string,
    seasonId: string,
    matchId: string,
    patch: MatchSchedulePatch,
    historyId: string,
    at: string,
  ): CompetitionMatch;
  updateResult(
    competitionId: string,
    seasonId: string,
    matchId: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    historyId: string,
    at: string,
    changeType: string,
  ): CompetitionMatch;
  listResultHistory(competitionId: string, seasonId: string, matchId: string): MatchResultHistory[];
}
