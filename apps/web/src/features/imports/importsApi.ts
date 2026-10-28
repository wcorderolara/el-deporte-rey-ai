/**
 * Manual import operations of the HTTP contract (`contracts/http-api.openapi.yaml` 1.0.0): listImports,
 * createImport, getImport, listManualSelections, getManualVersion and the URL of getImportOriginal.
 *
 * Every request goes through the shared API client: same origin, `X-EDR-Client: web` on the POST, a JSON body
 * (file content travels as `contentBase64` inside it, AD-35), problem+json parsed into an `ApiError` (including the
 * `importErrors` of IMPORT_REJECTED) and every response validated with the `@edr/contracts` schemas.
 */
import {
  ImportListResponseSchema,
  ImportSummarySchema,
  ManualSelectionHistorySchema,
  ManualVersionSchema,
  type ImportCreate,
  type ImportSummary,
  type ManualSelectionHistory,
  type ManualVersion,
} from '@edr/contracts';

import { API_BASE_PATH, createApiClient, type FetchFunction } from '../../api/client';

export interface ImportsApi {
  /** Applied imports, newest first. */
  listImports(signal?: AbortSignal): Promise<ImportSummary[]>;
  /** Sends one import; resolves with the applied import, rejects with an `ApiError` (IMPORT_REJECTED and others). */
  createImport(body: ImportCreate, signal?: AbortSignal): Promise<ImportSummary>;
  /** One applied import with the selection versions it created. */
  getImport(importId: string, signal?: AbortSignal): Promise<ImportSummary>;
  /** Version history of every selection of a competition season. */
  listManualSelections(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<ManualSelectionHistory>;
  /** One version of a selection, current or superseded. */
  getManualVersion(versionId: string, signal?: AbortSignal): Promise<ManualVersion>;
  /** URL of getImportOriginal (an attachment with a server-generated ASCII file name, T11H-F11). */
  originalUrl(importId: string): string;
}

export interface ImportsApiOptions {
  /** Base path of the API; same origin. Defaults to `/api/v1`. */
  basePath?: string;
  /** Injected for tests; defaults to the platform `fetch`. */
  fetch?: FetchFunction;
}

function withSignal(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

export function createImportsApi(options: ImportsApiOptions = {}): ImportsApi {
  const basePath = options.basePath ?? API_BASE_PATH;
  const client = createApiClient(options.fetch === undefined ? { basePath } : { basePath, fetch: options.fetch });

  return {
    async listImports(signal) {
      const body = await client.get('/imports', { schema: ImportListResponseSchema, ...withSignal(signal) });
      return body.imports;
    },
    createImport(body, signal) {
      return client.post('/imports', body, { schema: ImportSummarySchema, ...withSignal(signal) });
    },
    getImport(importId, signal) {
      return client.get(`/imports/${encodeURIComponent(importId)}`, {
        schema: ImportSummarySchema,
        ...withSignal(signal),
      });
    },
    listManualSelections(competitionId, seasonId, signal) {
      const query = new URLSearchParams({ competitionId, seasonId });
      return client.get(`/manual-data/selections?${query.toString()}`, {
        schema: ManualSelectionHistorySchema,
        ...withSignal(signal),
      });
    },
    getManualVersion(versionId, signal) {
      return client.get(`/manual-data/versions/${encodeURIComponent(versionId)}`, {
        schema: ManualVersionSchema,
        ...withSignal(signal),
      });
    },
    originalUrl(importId) {
      return `${basePath}/imports/${encodeURIComponent(importId)}/original`;
    },
  };
}

/** API used by the imports feature in the application. */
export const importsApi: ImportsApi = createImportsApi();
