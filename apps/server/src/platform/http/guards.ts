/**
 * Local-origin protection (AD-14; architecture-delta.md section 4 TB-1; architecture.md section 12.1; T10-F02,
 * T10-F04, T10-F12).
 *
 * One `onRequest` hook on the root instance, so it runs for every request (API, static files, SPA fallback, 404,
 * OPTIONS) before any body is read:
 * 1. Host: the raw `Host` header must equal one of the configured `server.allowedHosts` values (exact
 *    `host:port`, compared case-insensitively). The list comes only from the configuration, never from request
 *    headers; `trustProxy` is false, so `X-Forwarded-*` headers are ignored. Otherwise 421 `MISDIRECTED_HOST`.
 * 2. Fetch Metadata: `/api` requests with `Sec-Fetch-Site: cross-site` or `same-site` are refused with 403
 *    `FORBIDDEN_ORIGIN`; `same-origin`, `none` and an absent header are allowed.
 * 3. Every method other than GET and HEAD (deny by default, OPTIONS included) needs `X-EDR-Client: web` and, when an
 *    `Origin` header is present, an origin in the configured `server.allowedOrigins` (`Origin: null` is refused).
 *    Otherwise 403 `FORBIDDEN_ORIGIN`.
 * 4. Such a request with a body needs the route's body media type: `application/json`, or `image/png` and
 *    `image/jpeg` on routes with the binary exception. Otherwise 415 `UNSUPPORTED_MEDIA_TYPE`.
 *
 * No CORS header is ever sent (`headers.ts` removes any `Access-Control-*` header).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { acceptedBodyMediaTypes, hasRequestBody, mediaTypeOf } from './body.js';
import { type HttpProblem, platformProblems } from './problem.js';

/** Name of the client header required on every method other than GET and HEAD (contract `ClientHeader`). */
export const CLIENT_HEADER = 'x-edr-client';
/** The only accepted value of the client header. */
export const CLIENT_HEADER_VALUE = 'web';

/** Methods without the mutating-request guard. Everything else is guarded (deny by default). */
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/** `Sec-Fetch-Site` values refused on `/api` requests. */
const REFUSED_FETCH_SITES: ReadonlySet<string> = new Set(['cross-site', 'same-site']);

/** The configured allow-lists (`AppConfig.server`). */
export interface GuardOptions {
  readonly allowedHosts: readonly string[];
  readonly allowedOrigins: readonly string[];
}

/** Values that may never appear in an allow-list, whatever the configuration says. */
function checkAllowList(values: readonly string[], kind: string): ReadonlySet<string> {
  const set = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string' || value === '' || value.includes('*') || value.includes('0.0.0.0')) {
      throw new TypeError(`the ${kind} allow-list must hold exact loopback values`);
    }
    set.add(value.toLowerCase());
  }
  if (set.size === 0) {
    throw new TypeError(`the ${kind} allow-list must not be empty`);
  }
  return set;
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

/**
 * The request path as the platform classifies it: percent-decoded where valid, repeated slashes collapsed,
 * lowercase, without the query.
 */
export function normalizedPath(url: string): string {
  const raw = url.split('?', 1)[0] ?? '';
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // Keep the raw path; an invalid escape is not an API route either way.
  }
  return path.replace(/\/{2,}/g, '/').toLowerCase();
}

/** True for `/api` and every path below it, whatever the route matched. */
export function isApiPath(url: string): boolean {
  const path = normalizedPath(url);
  return path === '/api' || path.startsWith('/api/');
}

/** Checks the Host header against the allow-list (step 1). */
export function hostAllowed(request: FastifyRequest, allowedHosts: ReadonlySet<string>): boolean {
  const host = singleHeader(request.headers.host);
  return host !== undefined && allowedHosts.has(host.toLowerCase());
}

/** Runs the guard steps and returns the refusal, or null when the request may proceed. */
export function checkRequest(
  request: FastifyRequest,
  hosts: ReadonlySet<string>,
  origins: ReadonlySet<string>,
): HttpProblem | null {
  if (!hostAllowed(request, hosts)) {
    return platformProblems.misdirectedHost();
  }

  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite !== undefined && isApiPath(request.url)) {
    const value = Array.isArray(fetchSite) ? fetchSite.join(',') : fetchSite;
    if (REFUSED_FETCH_SITES.has(value.trim().toLowerCase()) || Array.isArray(fetchSite)) {
      return platformProblems.forbiddenOrigin('Cross-site and same-site API requests are refused.');
    }
  }

  if (SAFE_METHODS.has(request.method)) {
    return null;
  }

  if (singleHeader(request.headers[CLIENT_HEADER]) !== CLIENT_HEADER_VALUE) {
    return platformProblems.forbiddenOrigin('The X-EDR-Client header is required on this method.');
  }
  const origin = request.headers.origin;
  if (origin !== undefined) {
    const value = singleHeader(origin);
    if (value === undefined || value === 'null' || !origins.has(value.toLowerCase())) {
      return platformProblems.forbiddenOrigin('The request origin is not in the configured allow-list.');
    }
  }

  if (hasRequestBody(request)) {
    const mediaType = mediaTypeOf(singleHeader(request.headers['content-type']));
    if (mediaType === null || !acceptedBodyMediaTypes(request).includes(mediaType)) {
      return platformProblems.unsupportedMediaType();
    }
  }
  return null;
}

/**
 * Installs the guard as an `onRequest` hook of the root instance. Call it on the root instance before any route or
 * plugin is registered, so that every route, the static files and the not-found handler inherit it.
 */
export function installRequestGuards(app: FastifyInstance, options: GuardOptions): void {
  const hosts = checkAllowList(options.allowedHosts, 'Host');
  const origins = checkAllowList(options.allowedOrigins, 'Origin');
  app.addHook('onRequest', async (request) => {
    const refusal = checkRequest(request, hosts, origins);
    if (refusal !== null) {
      throw refusal;
    }
  });
}
