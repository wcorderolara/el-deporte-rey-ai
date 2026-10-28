/**
 * Local-origin protection (AD-14; TB-1; architecture.md section 12.1; T10-F02, T10-F04, T10-F12; R-234, R-235).
 */
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { BRAND_UPLOAD_BODY_LIMIT, IMPORT_BODY_LIMIT, binaryBodyRoute, routeBodyLimit } from './body.js';
import { installRequestGuards } from './guards.js';
import { CONTENT_SECURITY_POLICY } from './headers.js';
import { createLogger } from './logger.js';
import { createHttpServer, registerStaticUi } from './server.js';

const HOST = '127.0.0.1:4300';
const ORIGIN = 'http://127.0.0.1:4300';
const PRODUCTION = {
  allowedHosts: ['127.0.0.1:4300', 'localhost:4300'],
  allowedOrigins: ['http://127.0.0.1:4300', 'http://localhost:4300'],
};
const DEVELOPMENT = {
  allowedHosts: [...PRODUCTION.allowedHosts, '127.0.0.1:5173', 'localhost:5173'],
  allowedOrigins: [...PRODUCTION.allowedOrigins, 'http://127.0.0.1:5173', 'http://localhost:5173'],
};
const UI = { host: HOST, origin: ORIGIN, 'x-edr-client': 'web' };
const JSON_UI = { ...UI, 'content-type': 'application/json' };

let current: FastifyInstance | null = null;

async function platform(lists: typeof PRODUCTION = PRODUCTION): Promise<FastifyInstance> {
  const app = createHttpServer({ ...lists, logger: createLogger({ level: 'silent' }) });
  app.get('/api/v1/ping', async () => ({ ok: true }));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    app.route({ method, url: '/api/v1/echo', handler: async (request) => ({ received: request.body ?? null }) });
  }
  app.post(
    '/api/v1/upload',
    {
      config: binaryBodyRoute(['image/png', 'image/jpeg']),
      bodyLimit: routeBodyLimit(BRAND_UPLOAD_BODY_LIMIT),
    },
    async (request) => ({ bytes: (request.body as Buffer).length }),
  );
  app.post('/api/v1/imports', { bodyLimit: routeBodyLimit(IMPORT_BODY_LIMIT) }, async () => ({ ok: true }));
  app.get('/api/v1/cors', async (_request, reply) => {
    reply.header('access-control-allow-origin', '*').header('access-control-allow-credentials', 'true');
    return { ok: true };
  });
  app.get('/ui-page', async (_request, reply) => reply.type('text/html').send('<!doctype html><title>x</title>'));
  await registerStaticUi(app, null);
  await app.ready();
  current = app;
  return app;
}

afterEach(async () => {
  await current?.close();
  current = null;
});

async function send(app: FastifyInstance, options: InjectOptions) {
  const response = await app.inject(options);
  return { response, body: response.body === '' ? null : (response.json() as Record<string, unknown>) };
}

function expectNoCors(headers: Record<string, unknown>): void {
  expect(Object.keys(headers).filter((name) => name.toLowerCase().startsWith('access-control-'))).toEqual([]);
}

describe('Host allow-list (421 MISDIRECTED_HOST)', () => {
  it('accepts the configured exact host:port values, case-insensitively', async () => {
    const app = await platform();
    for (const host of ['127.0.0.1:4300', 'localhost:4300', 'LOCALHOST:4300']) {
      const { response } = await send(app, { method: 'GET', url: '/api/v1/ping', headers: { host } });
      expect(response.statusCode).toBe(200);
    }
  });

  it.each([
    'evil.example:4300',
    'evil.example',
    '127.0.0.1',
    '127.0.0.1:4301',
    '0.0.0.0:4300',
    'localhost.:4300',
    '127.0.0.1:5173',
    '[::1]:4300',
  ])('refuses Host %s on every kind of request', async (host) => {
    const app = await platform();
    const requests: InjectOptions[] = [
      { method: 'GET', url: '/api/v1/ping', headers: { host } },
      { method: 'HEAD', url: '/api/v1/ping', headers: { host } },
      { method: 'GET', url: '/api/v1/missing', headers: { host } },
      { method: 'GET', url: '/some/page', headers: { host } },
      { method: 'OPTIONS', url: '/api/v1/ping', headers: { host, 'x-edr-client': 'web' } },
      { method: 'POST', url: '/api/v1/echo', headers: { ...JSON_UI, host }, payload: '{}' },
    ];
    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(421);
      if (request.method !== 'HEAD') {
        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
        expect(response.json()).toMatchObject({ status: 421, code: 'MISDIRECTED_HOST' });
      }
      expect(response.headers['content-security-policy']).toBe(CONTENT_SECURITY_POLICY);
    }
  });

  it('ignores X-Forwarded-* headers (trustProxy false)', async () => {
    const app = await platform();
    const { response } = await send(app, {
      method: 'GET',
      url: '/api/v1/ping',
      headers: { host: 'evil.example', 'x-forwarded-host': HOST, 'x-forwarded-for': '127.0.0.1' },
    });
    expect(response.statusCode).toBe(421);
  });

  it('refuses allow-lists with wildcards, 0.0.0.0 or no entry', () => {
    const app = createHttpServer({ ...PRODUCTION, logger: createLogger({ level: 'silent' }) });
    expect(() => installRequestGuards(app, { ...PRODUCTION, allowedHosts: ['0.0.0.0:4300'] })).toThrow(TypeError);
    expect(() => installRequestGuards(app, { ...PRODUCTION, allowedHosts: ['*'] })).toThrow(TypeError);
    expect(() => installRequestGuards(app, { ...PRODUCTION, allowedOrigins: [] })).toThrow(TypeError);
    void app.close();
  });
});

describe('development origin set (T10-F02)', () => {
  const devRequest = (host: string, origin: string): InjectOptions => ({
    method: 'POST',
    url: '/api/v1/echo',
    headers: { host, origin, 'x-edr-client': 'web', 'content-type': 'application/json' },
    payload: '{"a":1}',
  });

  it('accepts the Vite dev server Host and Origin when they are configured', async () => {
    const app = await platform(DEVELOPMENT);
    for (const [host, origin] of [
      ['127.0.0.1:5173', 'http://127.0.0.1:5173'],
      ['localhost:5173', 'http://localhost:5173'],
    ] as const) {
      const { response, body } = await send(app, devRequest(host, origin));
      expect(response.statusCode).toBe(200);
      expect(body).toEqual({ received: { a: 1 } });
    }
  });

  it('refuses them with the production configuration', async () => {
    const app = await platform(PRODUCTION);
    expect((await app.inject(devRequest('127.0.0.1:5173', 'http://127.0.0.1:5173'))).statusCode).toBe(421);
    const crossOrigin = await send(app, devRequest(HOST, 'http://127.0.0.1:5173'));
    expect(crossOrigin.response.statusCode).toBe(403);
    expect(crossOrigin.body).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
  });
});

describe('Fetch Metadata (T10-F04)', () => {
  it.each(['cross-site', 'same-site', 'CROSS-SITE'])('refuses /api requests with Sec-Fetch-Site %s', async (site) => {
    const app = await platform();
    for (const url of ['/api/v1/ping', '/api/v1/missing', '//api/v1/ping', '/%61pi/v1/ping', '/api']) {
      const { response, body } = await send(app, {
        method: 'GET',
        url,
        headers: { host: HOST, 'sec-fetch-site': site },
      });
      expect(response.statusCode).toBe(403);
      expect(body).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
    }
  });

  it.each(['same-origin', 'none', undefined])('allows /api requests with Sec-Fetch-Site %s', async (site) => {
    const app = await platform();
    const headers = site === undefined ? { host: HOST } : { host: HOST, 'sec-fetch-site': site };
    expect((await app.inject({ method: 'GET', url: '/api/v1/ping', headers })).statusCode).toBe(200);
  });

  it('does not apply to UI navigations outside /api', async () => {
    const app = await platform();
    const response = await app.inject({
      method: 'GET',
      url: '/ui-page',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('mutating-request guard (403 FORBIDDEN_ORIGIN, deny by default)', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('%s needs X-EDR-Client: web', async (method) => {
    const app = await platform();
    for (const headers of [
      { host: HOST },
      { host: HOST, 'x-edr-client': 'WEB' },
      { host: HOST, 'x-edr-client': 'webx' },
      { host: HOST, 'x-edr-client': '' },
    ]) {
      const { response, body } = await send(app, { method, url: '/api/v1/echo', headers });
      expect(response.statusCode).toBe(403);
      expect(body).toMatchObject({ status: 403, code: 'FORBIDDEN_ORIGIN' });
    }
    expect((await app.inject({ method, url: '/api/v1/echo', headers: UI })).statusCode).toBe(200);
  });

  it('refuses foreign origins and Origin: null; accepts configured origins and an absent Origin', async () => {
    const app = await platform();
    for (const origin of [
      'http://evil.example',
      'null',
      'http://127.0.0.1:4300.evil.example',
      'https://127.0.0.1:4300',
      'http://127.0.0.1:5173',
    ]) {
      const { response, body } = await send(app, {
        method: 'POST',
        url: '/api/v1/echo',
        headers: { ...JSON_UI, origin },
        payload: '{}',
      });
      expect(response.statusCode).toBe(403);
      expect(body).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
    }
    for (const headers of [JSON_UI, { ...JSON_UI, origin: 'http://localhost:4300' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/echo', headers, payload: '{}' })).statusCode).toBe(200);
    }
    const { origin: _omitted, ...withoutOrigin } = JSON_UI;
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/echo', headers: withoutOrigin, payload: '{}' })).statusCode,
    ).toBe(200);
  });

  it('guards OPTIONS and other methods too, and never answers a preflight with CORS headers', async () => {
    const app = await platform();
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/echo',
      headers: {
        host: HOST,
        origin: 'http://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-edr-client, content-type',
      },
    });
    expect(preflight.statusCode).toBe(403);
    expectNoCors(preflight.headers);

    const withHeader = await app.inject({ method: 'OPTIONS', url: '/api/v1/echo', headers: UI });
    expect(withHeader.statusCode).toBe(404);
    expectNoCors(withHeader.headers);

    expect((await app.inject({ method: 'PROPFIND', url: '/api/v1/echo', headers: { host: HOST } })).statusCode).toBe(
      403,
    );
  });

  it('removes CORS headers that a handler sets', async () => {
    const app = await platform();
    const response = await app.inject({ method: 'GET', url: '/api/v1/cors', headers: { host: HOST } });
    expect(response.statusCode).toBe(200);
    expectNoCors(response.headers);
  });
});

describe('body media type (415 UNSUPPORTED_MEDIA_TYPE)', () => {
  it('requires application/json for a body on JSON routes', async () => {
    const app = await platform();
    for (const contentType of [
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data; b=x',
      'image/png',
    ]) {
      const { response, body } = await send(app, {
        method: 'POST',
        url: '/api/v1/echo',
        headers: { ...UI, 'content-type': contentType },
        payload: '{"a":1}',
      });
      expect(response.statusCode).toBe(415);
      expect(body).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    }
    const missing = await app.inject({ method: 'POST', url: '/api/v1/echo', headers: UI, payload: Buffer.from('{}') });
    expect(missing.statusCode).toBe(415);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { ...UI, 'content-type': 'application/json; charset=utf-8' },
      payload: '{"a":1}',
    });
    expect(ok.json()).toEqual({ received: { a: 1 } });
  });

  it('accepts image/png and image/jpeg only on routes with the binary exception (T10-F12)', async () => {
    const app = await platform();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const contentType of ['image/png', 'image/jpeg']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/upload',
        headers: { ...UI, 'content-type': contentType },
        payload: png,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ bytes: 8 });
    }
    for (const contentType of ['application/json', 'image/gif', 'image/svg+xml']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/upload',
        headers: { ...UI, 'content-type': contentType },
        payload: png,
      });
      expect(response.statusCode).toBe(415);
    }
  });

  it('runs before the body is parsed: refusals win over invalid or oversized bodies (T10-F12)', async () => {
    const app = await platform();
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { ...JSON_UI, origin: 'http://evil.example' },
      payload: '{not json',
    });
    expect(invalid.statusCode).toBe(403);
    const oversized = await app.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: JSON.stringify({ a: 'x'.repeat(200 * 1024) }),
    });
    expect(oversized.statusCode).toBe(403);
  });
});

describe('security headers (T10-F04, R-262)', () => {
  it('sets the CSP with connect-src self and the isolation headers on success and error responses', async () => {
    const app = await platform();
    for (const request of [
      { method: 'GET', url: '/api/v1/ping', headers: { host: HOST } },
      { method: 'GET', url: '/api/v1/missing', headers: { host: HOST } },
      { method: 'POST', url: '/api/v1/echo', headers: { host: HOST } },
      { method: 'GET', url: '/ui-page', headers: { host: HOST } },
    ] as InjectOptions[]) {
      const response = await app.inject(request);
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'",
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expectNoCors(response.headers);
    }
  });
});
