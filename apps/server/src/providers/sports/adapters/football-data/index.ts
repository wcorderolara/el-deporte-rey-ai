/**
 * FootballDataProvider (LIVE_DATA; contracts/provider-ports.md section 1.4; T49). Replaces the T21 stub with the same
 * registration shape: adapter kind `football-data`, declared mode LIVE_DATA, and `validateStartup`.
 */
export {
  ANONYMOUS_CLIENT_MARKER,
  AUTH_HEADER,
  FOOTBALL_DATA_ADAPTER_KIND,
  HEADER_API_VERSION,
  HEADER_AUTHENTICATED_CLIENT,
  HEADER_COUNTER_RESET,
  HEADER_REQUESTS_AVAILABLE,
  PINNED_ORIGIN,
  TOKEN_VARIABLE,
} from './constants.js';
export { TOKEN_ISSUE, authHeadersFor } from './credentials.js';
export { attributionRef, competitionCodeOfRef } from './mapping.js';
export {
  type BodyObservation,
  DIAGNOSTIC_FIELD_NAMES,
  DIAGNOSTIC_RESOURCES,
  type DiagnosticResource,
  EGRESS_REFUSAL_KINDS,
  type EgressRefusalKind,
  type FieldPresence,
  MAPPED_FIELDS,
  REJECTION_STAGES,
  type RejectionObservation,
  type RejectionStage,
  type RequestKind,
  type RequestObservation,
  type RequestObserver,
  type ResponseObservation,
  diagnosticPath,
} from './observation.js';
export {
  COMPETITION_CODE_PATTERN,
  type FootballDataOptions,
  ORIGIN_PROBLEM,
  parseFootballDataOptions,
} from './options.js';
export {
  type FootballDataSeams,
  type FootballDataSource,
  createFootballDataSource,
  footballDataAdapter,
  footballDataRegistration,
  isPositiveClient,
} from './provider.js';
