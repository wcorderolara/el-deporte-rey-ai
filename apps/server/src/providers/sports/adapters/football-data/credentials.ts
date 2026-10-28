/**
 * Credential handling of the football-data adapter (PD-12 credential rules 1 to 7; contracts/provider-ports.md
 * section 1.4, "Credential" and "Credential containment"; AD-30; OD-20; R-120 to R-127, R-260, R-263, R-266;
 * T11H-F03).
 *
 * - The token is read only from the injected environment (`FOOTBALL_DATA_API_TOKEN`), never from the configuration,
 *   once, when the adapter of an enabled source is constructed. No adapter exists for a disabled source, so a
 *   configuration without an enabled football-data source never reads the variable.
 * - It is held in a closure: no property, no enumerable member, nothing that serializing or inspecting an object shows.
 * - It is attached only as the `X-Auth-Token` header, and only to a request whose WHATWG-parsed origin equals the
 *   pinned origin; never in a URL or a query.
 * - A missing, empty or malformed token fails startup with one fixed text naming the variable, never echoing a value.
 */
import type { ConfigIssue, EnvironmentSource } from '../../../../platform/config/index.js';

import { AUTH_HEADER, PINNED_ORIGIN, TOKEN_VARIABLE } from './constants.js';

/** Printable ASCII without spaces, 1 to 256 characters. */
const TOKEN_FORMAT = /^[\x21-\x7e]{1,256}$/;

/** The one startup issue of a missing, empty or malformed token (fixed text, OD-20). */
export const TOKEN_ISSUE: ConfigIssue = Object.freeze({
  setting: TOKEN_VARIABLE,
  problem: 'is required when an enabled LIVE_DATA source uses the football-data adapter',
});

/** The credential of one adapter instance, kept in a closure. */
export interface Credential {
  /** True when a well-formed token was found. */
  readonly present: boolean;
  /** Request headers for `url`: `X-Auth-Token` only when the URL's origin is the pinned origin. */
  headersFor(url: string): Record<string, string>;
}

/** The headers of a request to `url` carrying `token`: the token only for the pinned origin (T11H-F03). */
export function authHeadersFor(url: string, token: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token === null) {
    return headers;
  }
  let origin: string | null;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = null;
  }
  if (origin === PINNED_ORIGIN) {
    headers[AUTH_HEADER] = token;
  }
  return headers;
}

/** Reads the token from the injected environment (an own property only) and keeps it in a closure. */
export function readCredential(env: EnvironmentSource): Credential {
  const raw = Object.hasOwn(env, TOKEN_VARIABLE) ? env[TOKEN_VARIABLE] : undefined;
  const token = typeof raw === 'string' && TOKEN_FORMAT.test(raw) ? raw : null;
  return Object.freeze({
    present: token !== null,
    headersFor: (url: string): Record<string, string> => authHeadersFor(url, token),
  });
}
