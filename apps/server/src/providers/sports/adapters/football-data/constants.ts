/**
 * Provider constants of the football-data adapter (contracts/provider-ports.md section 1.4). Adapter code may hold
 * provider identifiers (AD-31); nothing outside `adapters/**` and `apps/server/scripts/**` does.
 */

/** Adapter kind referenced by `providers.sports.sources[].adapter`. */
export const FOOTBALL_DATA_ADAPTER_KIND = 'football-data';

/**
 * The only origin the adapter talks to and the only origin that ever receives the credential (origin pinning,
 * T11H-F03). `options.baseUrl` must use it.
 */
export const PINNED_ORIGIN = 'https://api.football-data.org';

/** Environment variable holding the token (PD-12, OD-20, AD-30). */
export const TOKEN_VARIABLE = 'FOOTBALL_DATA_API_TOKEN';

/** Request header carrying the token (verified, `architecture-delta.md` section 11.10). */
export const AUTH_HEADER = 'X-Auth-Token';

/** Response headers (verified). Only the two counters and the API version are ever recorded. */
export const HEADER_REQUESTS_AVAILABLE = 'X-RequestsAvailable';
export const HEADER_COUNTER_RESET = 'X-RequestCounter-Reset';
export const HEADER_API_VERSION = 'X-API-Version';
/**
 * Identifies the token's registered owner: personal data (T11H-F04). Its value is read only to compute booleans in
 * memory; it is never logged, stored, cached, returned or written into findings.
 */
export const HEADER_AUTHENTICATED_CLIENT = 'X-Authenticated-Client';

/**
 * The provider's anonymous marker value of `X-Authenticated-Client` (FU-5, OD-60; T11H-F04). Source: the provider's
 * documentation, which describes the header as the detected client or "anonymous" (`provider-research.md` section 2.4
 * item 8, C8). Not yet observed: every request of the capability probe (T53) was authenticated. A 403 carrying it is
 * `access_refused`, like a 403 without the header (a stricter classification only).
 */
export const ANONYMOUS_CLIENT_MARKER = 'anonymous';

/** Longest wait of a discovery request for the budget or a counter reset. */
export const DISCOVERY_MAX_WAIT_MS = 5_000;

/** Wait assumed after a 429 whose counter reset value is missing or invalid: one sliding window. */
export const DEFAULT_RATE_LIMIT_WAIT_SECONDS = 60;
