import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionSchema,
  operations,
  type ManagedCompetition,
  type ManagedCompetitionCreate,
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
  };
}

export const defaultCompetitionsApi = createCompetitionsApi(apiClient);
