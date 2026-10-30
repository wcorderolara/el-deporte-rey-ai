import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionSchema,
  ManagedSeasonCreateSchema,
  ManagedSeasonListResponseSchema,
  ManagedSeasonParamsSchema,
  ManagedSeasonSchema,
  ManagedTeamCreateSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamParamsSchema,
  ManagedTeamSchema,
  SeasonParticipantCreateSchema,
  SeasonParticipantListResponseSchema,
  SeasonParticipantParamsSchema,
  SeasonParticipantsParamsSchema,
  SeasonParticipantSchema,
  operations,
  type ManagedCompetition,
  type ManagedCompetitionCreate,
  type ManagedSeason,
  type ManagedSeasonCreate,
  type ManagedTeam,
  type ManagedTeamCreate,
  type SeasonParticipant,
  type OperationId,
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
  list(signal?: AbortSignal): Promise<ManagedCompetition[]>;
  create(input: ManagedCompetitionCreate): Promise<ManagedCompetition>;
  get(id: string, signal?: AbortSignal): Promise<ManagedCompetition>;
  listSeasons(competitionId: string, signal?: AbortSignal): Promise<ManagedSeason[]>;
  createSeason(competitionId: string, input: ManagedSeasonCreate): Promise<ManagedSeason>;
  getSeason(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<ManagedSeason>;
  listTeams(signal?: AbortSignal): Promise<ManagedTeam[]>;
  createTeam(input: ManagedTeamCreate): Promise<ManagedTeam>;
  getTeam(teamId: string, signal?: AbortSignal): Promise<ManagedTeam>;
  listParticipants(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<SeasonParticipant[]>;
  addParticipant(competitionId: string, seasonId: string, teamId: string): Promise<SeasonParticipant>;
  removeParticipant(competitionId: string, seasonId: string, teamId: string): Promise<void>;
}

export function createCompetitionsApi(client: ApiClient): CompetitionsApi {
  return {
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
    getTeam(teamId, signal) {
      const params = ManagedTeamParamsSchema.parse({ teamId });
      return client.get(path('getManagedTeam', params), {
        schema: ManagedTeamSchema,
        ...(signal === undefined ? {} : { signal }),
      });
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
    async removeParticipant(competitionId, seasonId, teamId) {
      const params = SeasonParticipantParamsSchema.parse({ competitionId, seasonId, teamId });
      await client.delete(path('removeSeasonParticipant', params));
    },
  };
}

export const defaultCompetitionsApi = createCompetitionsApi(apiClient);
