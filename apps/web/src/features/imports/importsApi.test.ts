/**
 * Import operations through the shared client: paths, the client header on createImport, a JSON body, contract
 * validation of responses and IMPORT_REJECTED parsed with every import error.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { createImportsApi } from './importsApi';
import {
  bodyOf,
  fakeFetch,
  HISTORY_V1,
  IMPORT_ID_1,
  IMPORT_V1,
  importErrors,
  jsonResponse,
  problemResponse,
  VERSION_1,
  VERSION_ID_1,
} from './testSupport';

describe('createImportsApi', () => {
  it('lists imports and validates them with the contract schema', async () => {
    const { fetch, requests } = fakeFetch({ 'GET /imports': () => jsonResponse({ imports: [IMPORT_V1] }) });
    const api = createImportsApi({ fetch });
    await expect(api.listImports()).resolves.toEqual([IMPORT_V1]);
    expect(requests[0]?.url).toBe('/api/v1/imports');
    expect(requests[0]?.headers['X-EDR-Client']).toBeUndefined();
  });

  it('refuses a response that does not match the contract', async () => {
    const { fetch } = fakeFetch({ 'GET /imports': () => jsonResponse({ imports: [{ ...IMPORT_V1, extra: 1 }] }) });
    await expect(createImportsApi({ fetch }).listImports()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('posts createImport as JSON with the client header', async () => {
    const { fetch, requests } = fakeFetch({ 'POST /imports': () => jsonResponse(IMPORT_V1, 201) });
    const body = { channel: 'csv_file' as const, fileName: 'datos.csv', declaredSource: null, contentBase64: 'YQ==' };
    await expect(createImportsApi({ fetch }).createImport(body)).resolves.toEqual(IMPORT_V1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.headers['X-EDR-Client']).toBe('web');
    expect(requests[0]?.headers['Content-Type']).toBe('application/json');
    expect(bodyOf(requests[0])).toEqual(body);
  });

  it('rejects with IMPORT_REJECTED and every import error', async () => {
    const errors = importErrors(3);
    const { fetch } = fakeFetch({
      'POST /imports': () => problemResponse(400, 'IMPORT_REJECTED', { importErrors: errors }),
    });
    const failure = await createImportsApi({ fetch })
      .createImport({ channel: 'json_file', fileName: 'x.json', declaredSource: null, contentBase64: 'YQ==' })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).problem?.code).toBe('IMPORT_REJECTED');
    expect((failure as ApiError).problem?.importErrors).toEqual(errors);
  });

  it('reads one import by its identifier', async () => {
    const { fetch, requests } = fakeFetch({ [`GET /imports/${IMPORT_ID_1}`]: () => jsonResponse(IMPORT_V1) });
    await expect(createImportsApi({ fetch }).getImport(IMPORT_ID_1)).resolves.toEqual(IMPORT_V1);
    expect(requests[0]?.url).toBe(`/api/v1/imports/${IMPORT_ID_1}`);
  });

  it('reads selection versions and one version, and builds the original URL', async () => {
    const { fetch, requests } = fakeFetch({
      'GET /manual-data/selections': () => jsonResponse(HISTORY_V1),
      [`GET /manual-data/versions/${VERSION_ID_1}`]: () => jsonResponse(VERSION_1),
    });
    const api = createImportsApi({ fetch });
    await expect(api.listManualSelections('liga-sintetica', 'temporada-2026')).resolves.toEqual(HISTORY_V1);
    expect(requests[0]?.url).toBe(
      '/api/v1/manual-data/selections?competitionId=liga-sintetica&seasonId=temporada-2026',
    );
    await expect(api.getManualVersion(VERSION_ID_1)).resolves.toEqual(VERSION_1);
    expect(api.originalUrl(IMPORT_ID_1)).toBe(`/api/v1/imports/${IMPORT_ID_1}/original`);
  });
});
