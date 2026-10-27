import { HealthResponseSchema } from '@edr/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  CLIENT_HEADER,
  createApiClient,
  isAccessRefusal,
  isRetryable,
  parseProblem,
  type FetchFunction,
} from './client';

interface RecordedCall {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
}

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

function problemResponse(body: Record<string, unknown>): Response {
  return jsonResponse(body, Number(body.status), 'application/problem+json');
}

/**
 * Fake fetch: records every call and answers with the given responses in order; any other value is thrown (as a
 * failed connection or an abort). No network is used.
 */
function fakeFetch(...responses: unknown[]) {
  const calls: RecordedCall[] = [];
  const fetch = vi.fn<FetchFunction>(async (url, init) => {
    calls.push({ url, init, headers: { ...(init.headers as Record<string, string>) } });
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('unexpected request');
    }
    if (!(next instanceof Response)) {
      throw next;
    }
    return next;
  });
  return { fetch, calls };
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('API client: requests', () => {
  it('sends GET requests to /api/v1 without the client header and validates with the contract schema', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse({ status: 'ok' }));
    const client = createApiClient({ fetch });

    const health = await client.get('/health', { schema: HealthResponseSchema });

    expect(health).toEqual({ status: 'ok' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/v1/health');
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.headers[CLIENT_HEADER]).toBeUndefined();
    expect(calls[0]?.headers['Content-Type']).toBeUndefined();
    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.init.credentials).toBe('same-origin');
    expect(calls[0]?.init.redirect).toBe('error');
  });

  it('does not send the client header on HEAD requests and returns no body', async () => {
    const { fetch, calls } = fakeFetch(new Response(null, { status: 200 }));
    const client = createApiClient({ fetch });

    await expect(client.request('HEAD', '/health')).resolves.toBeUndefined();
    expect(calls[0]?.headers[CLIENT_HEADER]).toBeUndefined();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('sends X-EDR-Client: web on %s', async (method) => {
    const { fetch, calls } = fakeFetch(new Response(null, { status: 204 }));
    const client = createApiClient({ fetch });

    await client.request(method, '/projects/x');

    expect(calls[0]?.init.method).toBe(method);
    expect(calls[0]?.headers['X-EDR-Client']).toBe('web');
  });

  it('sends a JSON body with the JSON content type on mutating requests', async () => {
    const { fetch, calls } = fakeFetch(jsonResponse({ id: 'created' }, 201));
    const client = createApiClient({ fetch });

    const result = await client.post('/projects', { title: 'Jornada 1', language: 'es' });

    expect(result).toEqual({ id: 'created' });
    expect(calls[0]?.headers['X-EDR-Client']).toBe('web');
    expect(calls[0]?.headers['Content-Type']).toBe('application/json');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ title: 'Jornada 1', language: 'es' }));
  });

  it('sends no body and no content type on a mutating request without a body', async () => {
    const { fetch, calls } = fakeFetch(new Response(null, { status: 204 }));
    const client = createApiClient({ fetch });

    await client.post('/projects/x/runs');

    expect(calls[0]?.init.body).toBeUndefined();
    expect(calls[0]?.headers['Content-Type']).toBeUndefined();
    expect(calls[0]?.headers['X-EDR-Client']).toBe('web');
  });

  it.each(['https://example.invalid/api', '//example.invalid/api', 'health', '/a\\b'])(
    'refuses the non-relative path %s without making a request',
    async (path) => {
      const { fetch } = fakeFetch(jsonResponse({}));
      const client = createApiClient({ fetch });

      await expect(client.get(path)).rejects.toBeInstanceOf(TypeError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('API client: response validation', () => {
  it('rejects a response that does not match the contract schema', async () => {
    const { fetch } = fakeFetch(jsonResponse({ status: 'ok', extra: true }));
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/health', { schema: HealthResponseSchema }));

    expect(error.kind).toBe('invalid_response');
    expect(error.status).toBe(200);
    expect(isRetryable(error)).toBe(false);
  });

  it('rejects a successful response that is not JSON', async () => {
    const { fetch } = fakeFetch(
      new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/health'));

    expect(error.kind).toBe('invalid_response');
  });

  it('rejects a malformed JSON body', async () => {
    const { fetch } = fakeFetch(
      new Response('{"status":', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/health'));

    expect(error.kind).toBe('invalid_response');
  });
});

describe('API client: problem+json errors', () => {
  it('parses an IMPORT_REJECTED problem with every import error', async () => {
    const importErrors = [
      { location: 'file', record: '3', field: 'homeScore', problem: 'type_invalid', message: 'Expected an integer' },
      { location: 'file', record: '4', field: 'referee', problem: 'person_field', message: 'Person field refused' },
      { location: 'form', record: '/matches/0', field: null, problem: 'required_missing', message: 'Missing value' },
    ];
    const { fetch } = fakeFetch(
      problemResponse({
        type: 'urn:edr:problem:IMPORT_REJECTED',
        title: 'Import rejected',
        status: 422,
        code: 'IMPORT_REJECTED',
        detail: 'The import was rejected; nothing was stored.',
        importErrors,
      }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.post('/imports', { channel: 'form' }));

    expect(error.kind).toBe('problem');
    expect(error.status).toBe(422);
    expect(error.problem?.code).toBe('IMPORT_REJECTED');
    expect(error.problem?.importErrors).toEqual(importErrors);
    expect(error.problem?.detail).toBe('The import was rejected; nothing was stored.');
    expect(isRetryable(error)).toBe(false);
  });

  it('parses retryAfterSeconds of a PROVIDER_RATE_LIMITED problem and marks it retryable', async () => {
    const { fetch } = fakeFetch(
      problemResponse({
        type: 'urn:edr:problem:PROVIDER_RATE_LIMITED',
        title: 'Rate limited',
        status: 503,
        code: 'PROVIDER_RATE_LIMITED',
        retryAfterSeconds: 42,
      }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/catalog/competitions'));

    expect(error.problem?.retryAfterSeconds).toBe(42);
    expect(isRetryable(error)).toBe(true);
  });

  it('parses refusalReason of MANUAL_APPROVAL_REFUSED and SELECTION_UNAVAILABLE problems', async () => {
    const { fetch } = fakeFetch(
      problemResponse({
        type: 'about:blank',
        title: 'Refused',
        status: 409,
        code: 'MANUAL_APPROVAL_REFUSED',
        refusalReason: 'disputed',
      }),
      problemResponse({
        type: 'about:blank',
        title: 'Unavailable',
        status: 409,
        code: 'SELECTION_UNAVAILABLE',
        refusalReason: 'season_unavailable',
      }),
    );
    const client = createApiClient({ fetch });

    const manual = await captureError(client.post('/facts/x/manual-approval'));
    const selection = await captureError(client.post('/projects', {}));

    expect(manual.problem?.refusalReason).toBe('disputed');
    expect(selection.problem?.refusalReason).toBe('season_unavailable');
  });

  it('drops malformed or unknown optional members instead of trusting them', () => {
    const problem = parseProblem(
      {
        type: 'about:blank',
        title: 'Rejected',
        status: 422,
        code: 'IMPORT_REJECTED',
        refusalReason: 'some_new_reason',
        retryAfterSeconds: -5,
        errors: [{ path: '/title', message: 'Too long' }, { path: 3 }],
        importErrors: [
          { location: 'file', record: '1', field: null, problem: 'parse_error', message: 'Bad' },
          { location: 'elsewhere', record: '2', field: null, problem: 'parse_error', message: 'Bad' },
          { location: 'file', record: '3', field: null, problem: 'not_a_problem', message: 'Bad' },
          'not an object',
        ],
      },
      422,
    );

    expect(problem?.refusalReason).toBeNull();
    expect(problem?.retryAfterSeconds).toBeNull();
    expect(problem?.errors).toEqual([{ path: '/title', message: 'Too long' }]);
    expect(problem?.importErrors).toEqual([
      { location: 'file', record: '1', field: null, problem: 'parse_error', message: 'Bad' },
    ]);
  });

  it('caps the number of import errors at 500', () => {
    const many = Array.from({ length: 600 }, (_, index) => ({
      location: 'file',
      record: String(index + 1),
      field: null,
      problem: 'parse_error',
      message: 'Bad',
    }));
    expect(parseProblem({ code: 'IMPORT_REJECTED', importErrors: many }, 422)?.importErrors).toHaveLength(500);
  });

  it('treats a body with an unknown code as a plain HTTP error', async () => {
    const { fetch } = fakeFetch(
      problemResponse({ type: 'about:blank', title: 'x', status: 500, code: 'SOMETHING_NEW' }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/projects'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.problem).toBeNull();
    expect(isRetryable(error)).toBe(true);
  });

  it('treats a non-JSON error response as a plain HTTP error', async () => {
    const { fetch } = fakeFetch(
      new Response('Bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    );
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/projects'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(502);
    expect(isRetryable(error)).toBe(true);
  });

  it.each([
    ['FORBIDDEN_ORIGIN', 403],
    ['MISDIRECTED_HOST', 421],
  ])('reports the local access refusal %s as not retryable', async (code, status) => {
    const { fetch } = fakeFetch(problemResponse({ type: 'about:blank', title: 'Refused', status, code }));
    const client = createApiClient({ fetch });

    const error = await captureError(client.post('/projects', {}));

    expect(error.problem?.code).toBe(code);
    expect(isAccessRefusal(error)).toBe(true);
    expect(isRetryable(error)).toBe(false);
  });

  it('reports an unauthorized response without a problem body as an access refusal', async () => {
    const { fetch } = fakeFetch(new Response('', { status: 401 }));
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/projects'));

    expect(error.kind).toBe('http');
    expect(isAccessRefusal(error)).toBe(true);
    expect(isRetryable(error)).toBe(false);
  });
});

describe('API client: transport failures', () => {
  it('reports a failed connection as a retryable network error', async () => {
    const { fetch } = fakeFetch(new TypeError('Failed to fetch'));
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/projects'));

    expect(error.kind).toBe('network');
    expect(error.status).toBeNull();
    expect(isRetryable(error)).toBe(true);
  });

  it('reports an aborted request as aborted and not retryable', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const { fetch, calls } = fakeFetch(abortError);
    const client = createApiClient({ fetch });

    const error = await captureError(client.get('/projects', { signal: controller.signal }));

    expect(calls[0]?.init.signal).toBe(controller.signal);
    expect(error.kind).toBe('aborted');
    expect(isRetryable(error)).toBe(false);
  });
});
