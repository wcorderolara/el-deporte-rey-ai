/**
 * Local-origin protections of the running server (AD-14; architecture-delta.md section 4 TB-1; T10-F04, T10-F12;
 * R-262, R-235): Fetch-Metadata refusal of `cross-site` and `same-site` `/api` requests, `Origin: null` refused,
 * deny by default for PUT, PATCH, DELETE, OPTIONS and unknown methods without the client header, no
 * `Access-Control-*` header on any response (OPTIONS included), CORP, COOP and the CSP directives (with
 * `connect-src 'self'`) on every response, and no login or account route. Requests go over TCP to the loopback
 * listener of a server started on a generated DEMO_DATA configuration.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API, type RawResponse, type TestApp, expectNoNetworkViolations, startTestApp } from '../../support/index.js';

let t: TestApp;

beforeAll(async () => {
  t = await startTestApp({ base: 'demo-only', scenario: 'default' });
});

afterAll(async () => {
  await t.close();
});

function problemCode(response: RawResponse): unknown {
  return (JSON.parse(response.body) as { code?: unknown }).code;
}

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
];

/** The security headers every response carries, and no CORS header. */
function expectSecurityHeaders(response: RawResponse): void {
  const csp = String(response.headers['content-security-policy'] ?? '');
  for (const directive of CSP_DIRECTIVES) {
    expect(csp, `CSP directive ${directive}`).toContain(directive);
  }
  expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['referrer-policy']).toBe('no-referrer');
  expect(response.headers['x-frame-options']).toBe('DENY');
  expect(Object.keys(response.headers).filter((name) => name.toLowerCase().startsWith('access-control-'))).toEqual([]);
}

describe('Fetch Metadata on /api (T10-F04)', () => {
  it.each(['cross-site', 'same-site'])(
    'refuses a GET and a POST with Sec-Fetch-Site: %s (403 FORBIDDEN_ORIGIN)',
    async (site) => {
      const get = await t.request({ path: `${API}/projects`, headers: { host: t.host, 'sec-fetch-site': site } });
      expect(get.status).toBe(403);
      expect(problemCode(get)).toBe('FORBIDDEN_ORIGIN');
      expectSecurityHeaders(get);

      const post = await t.request({
        method: 'POST',
        path: `${API}/projects`,
        headers: { ...t.writeHeaders, 'sec-fetch-site': site },
        body: '{}',
      });
      expect(post.status).toBe(403);
      expect(problemCode(post)).toBe('FORBIDDEN_ORIGIN');
    },
  );

  it.each(['same-origin', 'none'])('allows Sec-Fetch-Site: %s', async (site) => {
    const response = await t.request({ path: `${API}/health`, headers: { host: t.host, 'sec-fetch-site': site } });
    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });
});

describe('mutating requests: deny by default (T10-F04, AD-14)', () => {
  it('refuses Origin: null even with the client header', async () => {
    const response = await t.request({
      method: 'POST',
      path: `${API}/projects`,
      headers: { host: t.host, origin: 'null', 'x-edr-client': 'web', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN_ORIGIN');
  });

  it('refuses a foreign origin with the client header', async () => {
    const response = await t.request({
      method: 'POST',
      path: `${API}/projects`,
      headers: {
        host: t.host,
        origin: 'http://192.0.2.10:4300',
        'x-edr-client': 'web',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('refuses %s without X-EDR-Client (403)', async (method) => {
    const response = await t.request({
      method,
      path: `${API}/projects`,
      headers: { host: t.host, origin: t.origin, 'content-type': 'application/json' },
      ...(method === 'OPTIONS' || method === 'DELETE' ? {} : { body: '{}' }),
    });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN_ORIGIN');
    expectSecurityHeaders(response);
  });

  it.each(['PROPFIND', 'MKCOL', 'TRACE', 'PURGE', 'LOCK'])(
    'refuses the unknown method %s without the client header (403), and routes none of them',
    async (method) => {
      const refused = await t.request({ method, path: `${API}/projects`, headers: { host: t.host } });
      expect(refused.status).toBe(403);
      expect(problemCode(refused)).toBe('FORBIDDEN_ORIGIN');
      expectSecurityHeaders(refused);
      const withHeader = await t.request({
        method,
        path: `${API}/projects`,
        headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web' },
      });
      expect(withHeader.status).toBe(404);
    },
  );

  it('answers a CORS preflight without any Access-Control-* header', async () => {
    const response = await t.request({
      method: 'OPTIONS',
      path: `${API}/projects`,
      headers: {
        host: t.host,
        origin: 'http://192.0.2.10:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-edr-client, content-type',
      },
    });
    expect(response.status).toBe(403);
    expectSecurityHeaders(response);
  });
});

describe('security headers on every response (T10-F04, R-262)', () => {
  it('sets CORP, COOP and the CSP with connect-src self on success, problem, not-found and Host refusals', async () => {
    const responses = [
      await t.request({ path: `${API}/health`, headers: { host: t.host } }),
      await t.request({ path: `${API}/settings`, headers: { host: t.host } }),
      await t.request({ path: `${API}/projects/not-a-uuid`, headers: { host: t.host } }),
      await t.request({ path: `${API}/unknown`, headers: { host: t.host } }),
      await t.request({ path: '/', headers: { host: t.host } }),
      await t.request({ path: `${API}/health`, headers: { host: 'evil.example:4300' } }),
    ];
    expect(responses.map((response) => response.status)).toEqual([200, 200, 400, 404, 404, 421]);
    for (const response of responses) {
      expectSecurityHeaders(response);
    }
  });
});

describe('no login or account route (R-235, PD-05)', () => {
  it('registers no authentication, session, user or account route', () => {
    const routes = t.app.printRoutes({ commonPrefix: false });
    expect(routes).not.toMatch(
      /login|logout|signin|signup|sign-in|register\b|session|account|password|oauth|users?\b|auth\b/i,
    );
  });

  it.each(['/login', '/auth', '/session', '/account', '/users', '/signin'])('answers 404 for %s', async (path) => {
    const response = await t.request({ path: `${API}${path}`, headers: { host: t.host } });
    expect(response.status).toBe(404);
  });

  it('opened no non-loopback connection', () => {
    expectNoNetworkViolations();
  });
});
