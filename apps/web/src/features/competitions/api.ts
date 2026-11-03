import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionSchema,
  SportsProviderListResponseSchema,
  SportsProviderParamsSchema,
  ExternalCompetitionListResponseSchema,
  CompetitionProviderBindingParamsSchema,
  CompetitionProviderBindingCreateSchema,
  CompetitionProviderBindingResponseSchema,
  CompetitionStageCreateSchema,
  CompetitionCalendarNameUpdateSchema,
  CompetitionRoundUpdateSchema,
  CompetitionStageListResponseSchema,
  CompetitionStageParamsSchema,
  CompetitionStageSchema,
  CompetitionRoundCreateSchema,
  CompetitionRoundListResponseSchema,
  CompetitionRoundParamsSchema,
  CompetitionRoundsParamsSchema,
  CompetitionRoundSchema,
  CompetitionStageRoundsParamsSchema,
  CompetitionMatchCreateSchema,
  CompetitionMatchListResponseSchema,
  CompetitionMatchParamsSchema,
  CompetitionMatchResultUpdateSchema,
  CompetitionMatchScheduleUpdateSchema,
  CompetitionMatchSchema,
  CompetitionMatchesParamsSchema,
  MatchResultHistoryListResponseSchema,
  ManagedSeasonCreateSchema,
  ManagedSeasonUpdateSchema,
  ManagedSeasonListResponseSchema,
  ManagedSeasonParamsSchema,
  ManagedSeasonSchema,
  ManagedTeamCreateSchema,
  ManagedTeamUpdateSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamParamsSchema,
  ManagedTeamSchema,
  CompetitionTeamAddSchema,
  CompetitionTeamListResponseSchema,
  CompetitionTeamSchema,
  CompetitionTeamsParamsSchema,
  CompetitionTeamParamsSchema,
  SeasonParticipantBatchCreateSchema,
  SeasonParticipantCreateSchema,
  SeasonParticipantListResponseSchema,
  SeasonParticipantParamsSchema,
  SeasonParticipantsParamsSchema,
  SeasonParticipantSchema,
  operations,
  type ManagedCompetition,
  type ManagedCompetitionCreate,
  type SportsProvider,
  type ExternalCompetition,
  type CompetitionProviderBinding,
  type ManagedSeason,
  type ManagedSeasonCreate,
  type ManagedSeasonUpdate,
  type ManagedTeam,
  type ManagedTeamCreate,
  type ManagedTeamUpdate,
  type CompetitionTeam,
  type CompetitionTeamAdd,
  type SeasonParticipant,
  type OperationId,
  type CompetitionStage,
  type CompetitionStageCreate,
  type CompetitionCalendarNameUpdate,
  type CompetitionRoundUpdate,
  type CompetitionRound,
  type CompetitionRoundCreate,
  type CompetitionMatch,
  type CompetitionMatchCreate,
  type CompetitionMatchScheduleUpdate,
  type CompetitionMatchResultUpdate,
  type MatchResultHistory,
} from '@edr/contracts';
import { apiClient, type ApiClient } from '../../api/client';

function path(id: OperationId, params: Record<string, string> = {}): string {
  return operations[id].path.replace(/\{([A-Za-z]+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) throw new TypeError(`Missing path parameter ${key}`);
    return encodeURIComponent(value);
  });
}

export interface CompetitionsApi {
  listSportsProviders(signal?: AbortSignal): Promise<SportsProvider[]>;
  listExternalCompetitions(providerKey: string, signal?: AbortSignal): Promise<ExternalCompetition[]>;
  getProviderBinding(competitionId: string, signal?: AbortSignal): Promise<CompetitionProviderBinding | null>;
  setProviderBinding(
    competitionId: string,
    input: {
      providerKey: string;
      externalCompetitionId: string;
      mode: 'provider' | 'hybrid';
      replaceExisting?: boolean;
    },
  ): Promise<CompetitionProviderBinding>;
  removeProviderBinding(competitionId: string): Promise<void>;
  list(signal?: AbortSignal): Promise<ManagedCompetition[]>;
  create(input: ManagedCompetitionCreate): Promise<ManagedCompetition>;
  get(id: string, signal?: AbortSignal): Promise<ManagedCompetition>;
  listSeasons(competitionId: string, signal?: AbortSignal): Promise<ManagedSeason[]>;
  createSeason(competitionId: string, input: ManagedSeasonCreate): Promise<ManagedSeason>;
  updateSeason(competitionId: string, seasonId: string, input: ManagedSeasonUpdate): Promise<ManagedSeason>;
  getSeason(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<ManagedSeason>;
  listTeams(signal?: AbortSignal): Promise<ManagedTeam[]>;
  createTeam(input: ManagedTeamCreate): Promise<ManagedTeam>;
  updateTeam(teamId: string, input: ManagedTeamUpdate): Promise<ManagedTeam>;
  getTeam(teamId: string, signal?: AbortSignal): Promise<ManagedTeam>;
  listCompetitionTeams(competitionId: string, signal?: AbortSignal): Promise<CompetitionTeam[]>;
  addCompetitionTeam(competitionId: string, input: CompetitionTeamAdd): Promise<CompetitionTeam>;
  removeCompetitionTeam(competitionId: string, teamId: string): Promise<void>;
  listParticipants(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<SeasonParticipant[]>;
  addParticipant(competitionId: string, seasonId: string, teamId: string): Promise<SeasonParticipant>;
  addParticipants(competitionId: string, seasonId: string, teamIds: string[]): Promise<SeasonParticipant[]>;
  removeParticipant(competitionId: string, seasonId: string, teamId: string): Promise<void>;
  listStages(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionStage[]>;
  createStage(competitionId: string, seasonId: string, input: CompetitionStageCreate): Promise<CompetitionStage>;
  updateStage(
    competitionId: string,
    seasonId: string,
    stageId: string,
    input: CompetitionCalendarNameUpdate,
  ): Promise<CompetitionStage>;
  getStage(competitionId: string, seasonId: string, stageId: string, signal?: AbortSignal): Promise<CompetitionStage>;
  listSeasonRounds(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionRound[]>;
  createSeasonRound(competitionId: string, seasonId: string, input: CompetitionRoundCreate): Promise<CompetitionRound>;
  updateRound(
    competitionId: string,
    seasonId: string,
    roundId: string,
    input: CompetitionRoundUpdate,
  ): Promise<CompetitionRound>;
  deleteRound(competitionId: string, seasonId: string, roundId: string): Promise<void>;
  listStageRounds(
    competitionId: string,
    seasonId: string,
    stageId: string,
    signal?: AbortSignal,
  ): Promise<CompetitionRound[]>;
  createStageRound(
    competitionId: string,
    seasonId: string,
    stageId: string,
    input: CompetitionRoundCreate,
  ): Promise<CompetitionRound>;
  getSeasonRound(
    competitionId: string,
    seasonId: string,
    roundId: string,
    signal?: AbortSignal,
  ): Promise<CompetitionRound>;
  listMatches(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionMatch[]>;
  createMatch(competitionId: string, seasonId: string, input: CompetitionMatchCreate): Promise<CompetitionMatch>;
  updateMatchSchedule(
    competitionId: string,
    seasonId: string,
    matchId: string,
    input: CompetitionMatchScheduleUpdate,
  ): Promise<CompetitionMatch>;
  updateMatchResult(
    competitionId: string,
    seasonId: string,
    matchId: string,
    input: CompetitionMatchResultUpdate,
  ): Promise<CompetitionMatch>;
  listMatchHistory(
    competitionId: string,
    seasonId: string,
    matchId: string,
    signal?: AbortSignal,
  ): Promise<MatchResultHistory[]>;
}

export function createCompetitionsApi(client: ApiClient): CompetitionsApi {
  return {
    async listSportsProviders(signal) {
      const result = await client.get(path('listSportsProviders'), {
        schema: SportsProviderListResponseSchema,
        ...(signal ? { signal } : {}),
      });
      return result.providers;
    },
    async listExternalCompetitions(providerKey, signal) {
      const params = SportsProviderParamsSchema.parse({ providerKey });
      const result = await client.get(path('listExternalCompetitions', params), {
        schema: ExternalCompetitionListResponseSchema,
        ...(signal ? { signal } : {}),
      });
      return result.competitions;
    },
    async getProviderBinding(competitionId, signal) {
      const params = CompetitionProviderBindingParamsSchema.parse({ competitionId });
      const result = await client.get(path('getCompetitionProviderBinding', params), {
        schema: CompetitionProviderBindingResponseSchema,
        ...(signal ? { signal } : {}),
      });
      return result.binding;
    },
    async setProviderBinding(competitionId, input) {
      const params = CompetitionProviderBindingParamsSchema.parse({ competitionId });
      const body = CompetitionProviderBindingCreateSchema.parse(input);
      const result = await client.post(path('setCompetitionProviderBinding', params), body, {
        schema: CompetitionProviderBindingResponseSchema,
      });
      if (!result.binding) throw new Error('La vinculación no fue devuelta por el servidor.');
      return result.binding;
    },
    async removeProviderBinding(competitionId) {
      const params = CompetitionProviderBindingParamsSchema.parse({ competitionId });
      await client.delete(path('removeCompetitionProviderBinding', params));
    },
    async list(signal) {
      const result = await client.get(path('listManagedCompetitions'), {
        schema: ManagedCompetitionListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.competitions;
    },
    create(input) {
      const body = ManagedCompetitionCreateSchema.parse(input);
      return client.post(path('createCompetition'), body, { schema: ManagedCompetitionSchema });
    },
    get(id, signal) {
      return client.get(path('getCompetition', { competitionId: id }), {
        schema: ManagedCompetitionSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listSeasons(competitionId, signal) {
      const result = await client.get(path('listManagedSeasons', { competitionId }), {
        schema: ManagedSeasonListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.seasons;
    },
    createSeason(competitionId, input) {
      const body = ManagedSeasonCreateSchema.parse(input);
      return client.post(path('createManagedSeason', { competitionId }), body, { schema: ManagedSeasonSchema });
    },
    updateSeason(competitionId, seasonId, input) {
      const params = ManagedSeasonParamsSchema.parse({ competitionId, seasonId });
      return client.patch(path('updateManagedSeason', params), ManagedSeasonUpdateSchema.parse(input), {
        schema: ManagedSeasonSchema,
      });
    },
    getSeason(competitionId, seasonId, signal) {
      const params = ManagedSeasonParamsSchema.parse({ competitionId, seasonId });
      return client.get(path('getManagedSeason', params), {
        schema: ManagedSeasonSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listTeams(signal) {
      const result = await client.get(path('listManagedTeams'), {
        schema: ManagedTeamListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.teams;
    },
    createTeam(input) {
      const body = ManagedTeamCreateSchema.parse(input);
      return client.post(path('createManagedTeam'), body, { schema: ManagedTeamSchema });
    },
    updateTeam(teamId, input) {
      const params = ManagedTeamParamsSchema.parse({ teamId });
      return client.patch(path('updateManagedTeam', params), ManagedTeamUpdateSchema.parse(input), {
        schema: ManagedTeamSchema,
      });
    },
    getTeam(teamId, signal) {
      const params = ManagedTeamParamsSchema.parse({ teamId });
      return client.get(path('getManagedTeam', params), {
        schema: ManagedTeamSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listCompetitionTeams(competitionId, signal) {
      const params = CompetitionTeamsParamsSchema.parse({ competitionId });
      const result = await client.get(path('listCompetitionTeams', params), {
        schema: CompetitionTeamListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.teams;
    },
    addCompetitionTeam(competitionId, input) {
      const params = CompetitionTeamsParamsSchema.parse({ competitionId });
      return client.post(path('addCompetitionTeam', params), CompetitionTeamAddSchema.parse(input), {
        schema: CompetitionTeamSchema,
      });
    },
    async removeCompetitionTeam(competitionId, teamId) {
      const params = CompetitionTeamParamsSchema.parse({ competitionId, teamId });
      await client.delete(path('removeCompetitionTeam', params));
    },
    async listParticipants(competitionId, seasonId, signal) {
      const params = SeasonParticipantsParamsSchema.parse({ competitionId, seasonId });
      const result = await client.get(path('listSeasonParticipants', params), {
        schema: SeasonParticipantListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.participants;
    },
    addParticipant(competitionId, seasonId, teamId) {
      const params = SeasonParticipantsParamsSchema.parse({ competitionId, seasonId });
      const body = SeasonParticipantCreateSchema.parse({ teamId });
      return client.post(path('addSeasonParticipant', params), body, { schema: SeasonParticipantSchema });
    },
    async addParticipants(competitionId, seasonId, teamIds) {
      const params = SeasonParticipantsParamsSchema.parse({ competitionId, seasonId });
      const body = SeasonParticipantBatchCreateSchema.parse({ teamIds });
      const result = await client.post(path('addSeasonParticipantsBatch', params), body, {
        schema: SeasonParticipantListResponseSchema,
      });
      return result.participants;
    },
    async removeParticipant(competitionId, seasonId, teamId) {
      const params = SeasonParticipantParamsSchema.parse({ competitionId, seasonId, teamId });
      await client.delete(path('removeSeasonParticipant', params));
    },
    async listStages(competitionId, seasonId, signal) {
      const params = CompetitionRoundsParamsSchema.parse({ competitionId, seasonId });
      const result = await client.get(path('listCompetitionStages', params), {
        schema: CompetitionStageListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.stages;
    },
    createStage(competitionId, seasonId, input) {
      const params = CompetitionRoundsParamsSchema.parse({ competitionId, seasonId });
      return client.post(path('createCompetitionStage', params), CompetitionStageCreateSchema.parse(input), {
        schema: CompetitionStageSchema,
      });
    },
    updateStage(competitionId, seasonId, stageId, input) {
      const params = CompetitionStageParamsSchema.parse({ competitionId, seasonId, stageId });
      return client.patch(path('updateCompetitionStage', params), CompetitionCalendarNameUpdateSchema.parse(input), {
        schema: CompetitionStageSchema,
      });
    },
    getStage(competitionId, seasonId, stageId, signal) {
      const params = CompetitionStageParamsSchema.parse({ competitionId, seasonId, stageId });
      return client.get(path('getCompetitionStage', params), {
        schema: CompetitionStageSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listSeasonRounds(competitionId, seasonId, signal) {
      const params = CompetitionRoundsParamsSchema.parse({ competitionId, seasonId });
      const result = await client.get(path('listSeasonRounds', params), {
        schema: CompetitionRoundListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.rounds;
    },
    createSeasonRound(competitionId, seasonId, input) {
      const params = CompetitionRoundsParamsSchema.parse({ competitionId, seasonId });
      return client.post(path('createSeasonRound', params), CompetitionRoundCreateSchema.parse(input), {
        schema: CompetitionRoundSchema,
      });
    },
    updateRound(competitionId, seasonId, roundId, input) {
      const params = CompetitionRoundParamsSchema.parse({ competitionId, seasonId, roundId });
      return client.patch(path('updateCompetitionRound', params), CompetitionRoundUpdateSchema.parse(input), {
        schema: CompetitionRoundSchema,
      });
    },
    async deleteRound(competitionId, seasonId, roundId) {
      const params = CompetitionRoundParamsSchema.parse({ competitionId, seasonId, roundId });
      await client.delete(path('deleteCompetitionRound', params));
    },
    async listStageRounds(competitionId, seasonId, stageId, signal) {
      const params = CompetitionStageRoundsParamsSchema.parse({ competitionId, seasonId, stageId });
      const result = await client.get(path('listStageRounds', params), {
        schema: CompetitionRoundListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.rounds;
    },
    createStageRound(competitionId, seasonId, stageId, input) {
      const params = CompetitionStageRoundsParamsSchema.parse({ competitionId, seasonId, stageId });
      return client.post(path('createStageRound', params), CompetitionRoundCreateSchema.parse(input), {
        schema: CompetitionRoundSchema,
      });
    },
    getSeasonRound(competitionId, seasonId, roundId, signal) {
      const params = CompetitionRoundParamsSchema.parse({ competitionId, seasonId, roundId });
      return client.get(path('getSeasonRound', params), {
        schema: CompetitionRoundSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listMatches(competitionId, seasonId, signal) {
      const params = CompetitionMatchesParamsSchema.parse({ competitionId, seasonId });
      const result = await client.get(path('listCompetitionMatches', params), {
        schema: CompetitionMatchListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.matches;
    },
    createMatch(competitionId, seasonId, input) {
      const params = CompetitionMatchesParamsSchema.parse({ competitionId, seasonId });
      return client.post(path('createCompetitionMatch', params), CompetitionMatchCreateSchema.parse(input), {
        schema: CompetitionMatchSchema,
      });
    },
    updateMatchSchedule(competitionId, seasonId, matchId, input) {
      const params = CompetitionMatchParamsSchema.parse({ competitionId, seasonId, matchId });
      return client.patch(
        path('updateCompetitionMatchSchedule', params),
        CompetitionMatchScheduleUpdateSchema.parse(input),
        { schema: CompetitionMatchSchema },
      );
    },
    updateMatchResult(competitionId, seasonId, matchId, input) {
      const params = CompetitionMatchParamsSchema.parse({ competitionId, seasonId, matchId });
      return client.post(
        path('updateCompetitionMatchResult', params),
        CompetitionMatchResultUpdateSchema.parse(input),
        { schema: CompetitionMatchSchema },
      );
    },
    async listMatchHistory(competitionId, seasonId, matchId, signal) {
      const params = CompetitionMatchParamsSchema.parse({ competitionId, seasonId, matchId });
      const result = await client.get(path('listCompetitionMatchResultHistory', params), {
        schema: MatchResultHistoryListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return result.history;
    },
  };
}

export const defaultCompetitionsApi = createCompetitionsApi(apiClient);
