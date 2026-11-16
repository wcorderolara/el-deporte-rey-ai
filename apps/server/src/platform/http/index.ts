/**
 * HTTP platform (architecture.md section 4 `platform/http`; AD-14): loopback Host and Origin guards, client-header
 * and media-type checks, security headers, body limits, problem+json errors, redacting logger and the static UI.
 * Modules import from this file only.
 */
export {
  BINARY_BODY_MEDIA_TYPES,
  BRAND_UPLOAD_BODY_LIMIT,
  type BinaryBodyMediaType,
  type EdrRouteConfig,
  GLOBAL_BODY_LIMIT,
  IMPORT_BODY_LIMIT,
  JSON_MEDIA_TYPE,
  MAX_JSON_DEPTH,
  binaryBodyRoute,
  routeBodyLimit,
} from './body.js';
export { sendProblem, toProblem } from './errors.js';
export { CLIENT_HEADER, CLIENT_HEADER_VALUE, type GuardOptions, isApiPath } from './guards.js';
export { CONTENT_SECURITY_POLICY, SANDBOXED_FILE_CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from './headers.js';
export {
  type LogDestination,
  type Logger,
  type LoggerOptions,
  REDACTED,
  REDACT_PATHS,
  createLogger,
  summarizeError,
} from './logger.js';
export {
  HttpProblem,
  IMPORT_ERROR_LOCATIONS,
  IMPORT_ERROR_PROBLEMS,
  INTERNAL_DETAIL,
  type ImportErrorItem,
  PROBLEM_CODES,
  PROBLEM_CONTENT_TYPE,
  type ProblemBody,
  type ProblemCode,
  type ProblemExtras,
  type ProblemFactRef,
  type ProblemItem,
  REFUSAL_REASONS,
  type RefusalReason,
  type ValidationErrorItem,
  problemBody,
} from './problem.js';
export { streamEvents } from './sse.js';
export {
  type HttpServerOptions,
  SPA_INDEX,
  createHttpServer,
  defaultWebRoot,
  isWebRoot,
  registerStaticUi,
} from './server.js';
