/**
 * problem+json error handling, body limits and JSON parsing (T10-F10, T10-F12, T11H-F12, NV-5, NV-9).
 */
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { IMPORT_BODY_LIMIT, routeBodyLimit } from './body.js';
import { pointer } from './errors.js';
import { createLogger } from './logger.js';
import { HttpProblem, INTERNAL_DETAIL } from './problem.js';
import { createHttpServer, registerStaticUi } from './server.js';

const HOST = '127.0.0.1:4300';
const UI = { host: HOST, 'x-edr-client': 'web', 'content-type': 'application/json' };

let current: FastifyInstance | null = null;
let logText: () => string = () => '';

async function platform(): Promise<FastifyInstance> {
  const chunks: string[] = [];
  logText = () => chunks.join('');
  const app = createHttpServer({
    allowedHosts: [HOST],
    allowedOrigins: [`http://${HOST}`],
    logger: createLogger({ level: 'trace', destination: { write: (line: string) => chunks.push(line) } }),
  });
  app.get('/api/v1/rate-limited', async () => {
    throw new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'The request budget is exhausted.', { retryAfterSeconds: 30 });
  });
  app.get('/api/v1/selection', async () => {
    throw new HttpProblem(409, 'SELECTION_UNAVAILABLE', 'The season is not available.', {
      refusalReason: 'season_unavailable',
    });
  });
  app.post('/api/v1/facts/approve', async () => {
    throw new HttpProblem(409, 'MANUAL_APPROVAL_REFUSED', 'The fact is not eligible.', {
      refusalReason: 'verified',
    });
  });
  app.get('/api/v1/crash', async () => {
    throw new Error(`database at /home/operator/secret failed with ${TEST_MARKER_TOKEN}`);
  });
  app.get('/api/v1/crash-value', async () => {
    // A thrown non-error value.
    throw TEST_MARKER_TOKEN as unknown as Error;
  });
  app.post('/api/v1/validate', async (request) => {
    z.strictObject({ name: z.string().max(5), counts: z.record(z.string(), z.number()) }).parse(request.body);
    return { ok: true };
  });
  app.post('/api/v1/echo', async (request) => ({ received: request.body }));
  app.post('/api/v1/imports', { bodyLimit: routeBodyLimit(IMPORT_BODY_LIMIT) }, async (request) => {
    const body = request.body as { rows?: unknown } | null;
    if (body === null || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.rows)) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'The import request is invalid.');
    }
    throw new HttpProblem(400, 'IMPORT_REJECTED', 'The import was rejected.', {
      importErrors: [
        {
          location: 'file',
          record: '2',
          field: 'homeTeam',
          problem: 'person_field',
          message: 'person data is refused',
        },
      ],
    });
  });
  await registerStaticUi(app, null);
  await app.ready();
  current = app;
  return app;
}

afterEach(async () => {
  await current?.close();
  current = null;
});

describe('problem responses of modules (T11G codes and members)', () => {
  it('answers PROVIDER_RATE_LIMITED with retryAfterSeconds', async () => {
    const app = await platform();
    const response = await app.inject({ method: 'GET', url: '/api/v1/rate-limited', headers: { host: HOST } });
    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8');
    expect(response.json()).toEqual({
      type: 'urn:edr:problem:PROVIDER_RATE_LIMITED',
      title: 'The data provider request budget is exhausted',
      status: 503,
      code: 'PROVIDER_RATE_LIMITED',
      detail: 'The request budget is exhausted.',
      retryAfterSeconds: 30,
    });
  });

  it('answers SELECTION_UNAVAILABLE and MANUAL_APPROVAL_REFUSED with refusalReason', async () => {
    const app = await platform();
    const selection = await app.inject({ method: 'GET', url: '/api/v1/selection', headers: { host: HOST } });
    expect(selection.json()).toMatchObject({
      status: 409,
      code: 'SELECTION_UNAVAILABLE',
      refusalReason: 'season_unavailable',
    });
    const approval = await app.inject({ method: 'POST', url: '/api/v1/facts/approve', headers: UI, payload: '{}' });
    expect(approval.json()).toMatchObject({ status: 409, code: 'MANUAL_APPROVAL_REFUSED', refusalReason: 'verified' });
  });

  it('answers IMPORT_REJECTED with importErrors and never logs the body (T11H-F12)', async () => {
    const app = await platform();
    const payload = JSON.stringify({ rows: [{ homeTeam: TEST_MARKER_TOKEN, cells: [TEST_MARKER_TOKEN] }] });
    const response = await app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'IMPORT_REJECTED',
      importErrors: [{ location: 'file', record: '2', field: 'homeTeam', problem: 'person_field' }],
    });
    expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    expect(logText()).not.toContain(TEST_MARKER_TOKEN);
    expect(logText()).toContain('request completed');
  });
});

describe('internal errors (T10-F10)', () => {
  it('answers 500 INTERNAL with fixed text: no message, path, stack or marker in the response or the log', async () => {
    const app = await platform();
    for (const url of ['/api/v1/crash', '/api/v1/crash-value']) {
      const response = await app.inject({ method: 'GET', url, headers: { host: HOST } });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        type: 'urn:edr:problem:INTERNAL',
        title: 'Internal error',
        status: 500,
        code: 'INTERNAL',
        detail: INTERNAL_DETAIL,
      });
      expect(response.body).not.toContain(TEST_MARKER_TOKEN);
      expect(response.body).not.toContain('/home/operator');
      expect(response.body).not.toMatch(/\bat\s.+:\d+:\d+/);
    }
    expect(logText()).not.toContain(TEST_MARKER_TOKEN);
    expect(logText()).not.toContain('/home/operator');
    expect(logText()).toContain('request failed');
  });
});

describe('validation errors', () => {
  it('maps a ZodError to VALIDATION_FAILED with pointers and fixed messages, never input values', async () => {
    const app = await platform();
    const payload = JSON.stringify({ name: TEST_MARKER_TOKEN, counts: { [TEST_MARKER_TOKEN]: 'x' }, extra: 1 });
    const response = await app.inject({ method: 'POST', url: '/api/v1/validate', headers: UI, payload });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { code: string; errors: { path: string; message: string }[] };
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { path: '/name', message: 'is too large or too long' },
        { path: '/counts/*', message: 'has the wrong type' },
        { path: '', message: 'contains an unknown field' },
      ]),
    );
    expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    expect(logText()).not.toContain(TEST_MARKER_TOKEN);
  });

  it('builds pointers from plain segments only', () => {
    expect(pointer(['rows', 0, 'homeTeam'])).toBe('/rows/0/homeTeam');
    expect(pointer(['a b', Symbol('s'), '../x', 'b_c', 'x-y', '0abc'])).toBe('/*/*/*/*/*/*');
  });

  it('answers invalid and empty JSON with VALIDATION_FAILED without echoing the body', async () => {
    const app = await platform();
    for (const payload of [`{"a":"${TEST_MARKER_TOKEN}`, `${TEST_MARKER_TOKEN}`, '']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/echo',
        headers: { ...UI, 'content-length': String(Buffer.byteLength(payload)) },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    }
    expect(logText()).not.toContain(TEST_MARKER_TOKEN);
  });

  it('refuses prototype and constructor poisoning with 400 (onProtoPoisoning and onConstructorPoisoning error)', async () => {
    const app = await platform();
    for (const payload of ['{"__proto__":{"polluted":true}}', '{"constructor":{"prototype":{"polluted":true}}}']) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/echo', headers: UI, payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    }
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('body limits (T10-F12)', () => {
  it('refuses bodies over the global 64 KiB limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const app = await platform();
    const payload = JSON.stringify({ a: 'x'.repeat(64 * 1024) });
    const response = await app.inject({ method: 'POST', url: '/api/v1/echo', headers: UI, payload });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('applies the 1.5 MiB route override to the import route only', async () => {
    const app = await platform();
    const oneMiB = JSON.stringify({ rows: [], pad: 'x'.repeat(1024 * 1024) });
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI, payload: oneMiB })).json(),
    ).toMatchObject({ code: 'IMPORT_REJECTED' });
    expect((await app.inject({ method: 'POST', url: '/api/v1/echo', headers: UI, payload: oneMiB })).statusCode).toBe(
      413,
    );
    const tooLarge = JSON.stringify({ rows: [], pad: 'x'.repeat(IMPORT_BODY_LIMIT) });
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI, payload: tooLarge })).statusCode,
    ).toBe(413);
  });

  it('refuses a deeply nested 1.5 MiB JSON body on the import route with 400 quickly (NV-9)', async () => {
    const app = await platform();
    const depth = 786000;
    for (const payload of [
      '['.repeat(depth) + ']'.repeat(depth),
      `{"rows":${'['.repeat(depth)}${']'.repeat(depth)}}`,
    ]) {
      expect(Buffer.byteLength(payload)).toBeLessThanOrEqual(IMPORT_BODY_LIMIT);
      const started = performance.now();
      const response = await app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI, payload });
      const elapsed = performance.now() - started;
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(elapsed).toBeLessThan(2000);
    }
  });
});

describe('errors raised before routing', () => {
  it('answers an invalid URL escape with a problem, the security headers and no echo of the path', async () => {
    const app = await platform();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/%zz${TEST_MARKER_TOKEN}`,
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('applies the Host check to them', async () => {
    const app = await platform();
    const response = await app.inject({ method: 'GET', url: '/api/v1/%zz', headers: { host: 'evil.example' } });
    expect(response.statusCode).toBe(421);
    expect(response.json()).toMatchObject({ code: 'MISDIRECTED_HOST' });
  });

  it('answers HEAD problems without a body', async () => {
    const app = await platform();
    const response = await app.inject({ method: 'HEAD', url: '/api/v1/missing', headers: { host: HOST } });
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('');
  });
});
