/**
 * Problem responses (`application/problem+json`; contract schema `Problem`; architecture-delta.md section 2.1).
 *
 * Every error answer of the server is built here from a closed `code` and a `detail` of fixed text plus sanitized
 * parameters (T10-F10). Problems never carry an exception message, a stack trace, a request body, configuration
 * values, credentials or file paths. Modules signal a problem by throwing an `HttpProblem`; the platform error handler
 * turns it, and every other error, into a response.
 *
 * The code and reason lists mirror the http-api proposal (`1.0.0-proposed.2`); T20's schemas in `@edr/contracts`
 * and the contract tests (T43) check the parity.
 */

/** Media type of every problem response. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

/** Closed list of problem codes (contract `Problem.code`). */
export const PROBLEM_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'FORBIDDEN_ORIGIN',
  'MISDIRECTED_HOST',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'RUN_IN_PROGRESS',
  'NO_VERIFIED_RUN',
  'VERSION_CONFLICT',
  'APPROVAL_BLOCKED',
  'CONTENT_FLAGGED',
  'QA_FAILED',
  'QA_ACK_REQUIRED',
  'FINAL_APPROVAL_REFUSED',
  'FINAL_APPROVAL_REQUIRED',
  'EXPORT_FILES_MISSING',
  'EXPORT_FILES_CORRUPT',
  'DUPLICATE_ASSET',
  'DUPLICATE_SEASON',
  'DUPLICATE_TEAM',
  'DUPLICATE_PARTICIPANT',
  'DUPLICATE_COMPETITION_TEAM',
  'COMPETITION_TEAM_IN_USE',
  'TEAM_NOT_IN_COMPETITION',
  'DUPLICATE_STAGE',
  'DUPLICATE_ROUND',
  'DUPLICATE_MATCH',
  'ROUND_HAS_MATCHES',
  'TEAM_IN_USE',
  'PROVIDER_FAILED',
  'PROVIDER_BINDING_EXISTS',
  'PROVIDER_AMBIGUOUS',
  'PROVIDER_RATE_LIMITED',
  'SELECTION_UNAVAILABLE',
  'IMPORT_REJECTED',
  'MANUAL_APPROVAL_REFUSED',
  'INTERNAL',
  'PROVIDER_UNAVAILABLE',
  'IMPORT_PREVIEW_EXPIRED',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

/** Closed list of `refusalReason` values (MANUAL_APPROVAL_REFUSED, SELECTION_UNAVAILABLE). */
export const REFUSAL_REASONS = [
  'not_manual_data',
  'verified',
  'disputed',
  'team_identity_unmatched',
  'accepted_source_disagrees',
  'not_latest_run',
  'already_approved',
  'not_approved',
  'competition_unavailable',
  'season_unavailable',
  'stage_unavailable',
  'source_not_selectable',
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/** Closed lists of the contract `ImportError` fields. */
export const IMPORT_ERROR_LOCATIONS = ['file', 'form'] as const;
export const IMPORT_ERROR_PROBLEMS = [
  'parse_error',
  'encoding_invalid',
  'too_large',
  'too_many_rows',
  'header_invalid',
  'column_unknown',
  'person_field',
  'required_missing',
  'type_invalid',
  'value_out_of_range',
  'value_inconsistent',
  'duplicate_match',
  'unknown_team',
  'metadata_missing',
  'metadata_conflict',
  'finished_without_score',
  'score_not_allowed',
] as const;

/** One error of a rejected import (contract `ImportError`); `field` and `message` never contain imported values. */
export interface ImportErrorItem {
  readonly location: (typeof IMPORT_ERROR_LOCATIONS)[number];
  readonly record: string;
  readonly field: string | null;
  readonly problem: (typeof IMPORT_ERROR_PROBLEMS)[number];
  readonly message: string;
}

/** One validation error (contract `Problem.errors[]`). */
export interface ValidationErrorItem {
  readonly path: string;
  readonly message: string;
}

/** An element that prevents a final approval (contract `Problem.items[]`). */
export interface ProblemItem {
  readonly elementId: string;
  readonly reason: 'not_approved' | 'blocked' | 'flagged' | 'qa_failed' | 'qa_ack_required';
}

/** A fact that blocks an approval (contract `FactRef`), built by the review module from stored data. */
export type ProblemFactRef = Readonly<Record<string, unknown>> & { readonly factId: string };

/** Optional problem members, each allowed only with the codes named in the contract. */
export interface ProblemExtras {
  readonly errors?: readonly ValidationErrorItem[];
  readonly importErrors?: readonly ImportErrorItem[];
  readonly retryAfterSeconds?: number | null;
  readonly refusalReason?: RefusalReason | null;
  readonly facts?: readonly ProblemFactRef[];
  readonly items?: readonly ProblemItem[];
}

/** The JSON body of a problem response. */
export interface ProblemBody extends ProblemExtras {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: ProblemCode;
  readonly detail?: string;
}

/** Limits of the contract `Problem` schema. */
export const PROBLEM_LIMITS = Object.freeze({
  detail: 500,
  errors: 50,
  errorPath: 200,
  errorMessage: 200,
  importErrors: 500,
  importRecord: 120,
  importField: 80,
  importMessage: 200,
});

/** Fixed title of every code. */
const TITLES: Readonly<Record<ProblemCode, string>> = {
  VALIDATION_FAILED: 'The request is invalid',
  NOT_FOUND: 'Not found',
  FORBIDDEN_ORIGIN: 'The request origin is not allowed',
  MISDIRECTED_HOST: 'The request host is not allowed',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported media type',
  PAYLOAD_TOO_LARGE: 'The request body is too large',
  RUN_IN_PROGRESS: 'A run is in progress',
  NO_VERIFIED_RUN: 'No verified run exists',
  VERSION_CONFLICT: 'Version conflict',
  APPROVAL_BLOCKED: 'Approval is blocked',
  CONTENT_FLAGGED: 'The content is flagged',
  QA_FAILED: 'Visual QA failed',
  QA_ACK_REQUIRED: 'Visual QA warnings must be acknowledged',
  FINAL_APPROVAL_REFUSED: 'Final approval refused',
  FINAL_APPROVAL_REQUIRED: 'Final approval is required',
  EXPORT_FILES_MISSING: 'Export files are unavailable',
  EXPORT_FILES_CORRUPT: 'Export files failed verification',
  DUPLICATE_ASSET: 'The asset already exists',
  DUPLICATE_SEASON: 'The competition season already exists',
  DUPLICATE_TEAM: 'The local team already exists',
  DUPLICATE_PARTICIPANT: 'The team already participates in this season',
  DUPLICATE_COMPETITION_TEAM: 'The team already belongs to this competition',
  COMPETITION_TEAM_IN_USE: 'The competition team has season dependencies',
  TEAM_NOT_IN_COMPETITION: 'The team does not belong to this competition',
  DUPLICATE_STAGE: 'The competition stage already exists',
  DUPLICATE_ROUND: 'The round already exists in this calendar context',
  DUPLICATE_MATCH: 'A match with the same teams, context and kickoff already exists',
  ROUND_HAS_MATCHES: 'The round has matches or history and cannot be removed',
  TEAM_IN_USE: 'The team cannot be unlinked while the season has matches using it',
  PROVIDER_FAILED: 'The data provider failed',
  PROVIDER_BINDING_EXISTS: 'A provider is already linked to this competition',
  PROVIDER_AMBIGUOUS: 'The provider configuration is ambiguous',
  PROVIDER_UNAVAILABLE: 'The data provider is not configured',
  IMPORT_PREVIEW_EXPIRED: 'The import preview has expired',
  PROVIDER_RATE_LIMITED: 'The data provider request budget is exhausted',
  SELECTION_UNAVAILABLE: 'The selection is unavailable',
  IMPORT_REJECTED: 'The import was rejected',
  MANUAL_APPROVAL_REFUSED: 'Manual approval refused',
  INTERNAL: 'Internal error',
};

/** HTTP status of the codes the platform itself answers with. */
export const PLATFORM_PROBLEM_STATUS = Object.freeze({
  VALIDATION_FAILED: 400,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MISDIRECTED_HOST: 421,
  INTERNAL: 500,
} as const);

/** Fixed text of the 500 answer (T10-F10). */
export const INTERNAL_DETAIL = 'An internal error occurred.';

const UNSAFE_CHARACTERS = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/gu;

/** Removes control, format, private-use and separator characters and caps the length. */
export function sanitizeText(value: string, maxLength: number): string {
  const cleaned = value.replace(UNSAFE_CHARACTERS, ' ').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function isProblemCode(value: unknown): value is ProblemCode {
  return typeof value === 'string' && (PROBLEM_CODES as readonly string[]).includes(value);
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function checkExtras(code: ProblemCode, extras: ProblemExtras): void {
  const allowed: Readonly<Record<keyof ProblemExtras, readonly ProblemCode[]>> = {
    errors: ['VALIDATION_FAILED'],
    importErrors: ['IMPORT_REJECTED'],
    retryAfterSeconds: ['PROVIDER_RATE_LIMITED'],
    refusalReason: ['MANUAL_APPROVAL_REFUSED', 'SELECTION_UNAVAILABLE'],
    facts: ['APPROVAL_BLOCKED'],
    items: ['FINAL_APPROVAL_REFUSED'],
  };
  for (const key of Object.keys(extras) as (keyof ProblemExtras)[]) {
    const codes = allowed[key] as readonly ProblemCode[] | undefined;
    if (codes === undefined) {
      throw new TypeError('unknown problem member');
    }
    if (extras[key] !== undefined && !codes.includes(code)) {
      throw new TypeError(`the problem member ${key} is not allowed with ${code}`);
    }
  }
  const { retryAfterSeconds, refusalReason } = extras;
  if (
    retryAfterSeconds !== undefined &&
    retryAfterSeconds !== null &&
    (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 0)
  ) {
    throw new TypeError('retryAfterSeconds must be a non-negative integer or null');
  }
  if (refusalReason !== undefined && refusalReason !== null && !isOneOf(REFUSAL_REASONS, refusalReason)) {
    throw new TypeError('refusalReason is not a known reason');
  }
}

/**
 * A problem that a route handler throws. The constructor checks the code, the status and the members, so a module
 * cannot send an undocumented code or a member with the wrong code. `detail` must be fixed text plus sanitized
 * parameters; it is sanitized again and capped.
 *
 * `new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'The request budget is exhausted.', { retryAfterSeconds: 30 })`
 */
export class HttpProblem extends Error {
  override readonly name = 'HttpProblem';
  readonly status: number;
  readonly code: ProblemCode;
  readonly detail: string | undefined;
  readonly extras: ProblemExtras;

  constructor(status: number, code: ProblemCode, detail?: string, extras: ProblemExtras = {}) {
    super(code);
    if (!Number.isInteger(status) || status < 400 || status > 599) {
      throw new TypeError('a problem status must be an HTTP error status');
    }
    if (!isProblemCode(code)) {
      throw new TypeError('unknown problem code');
    }
    checkExtras(code, extras);
    this.status = status;
    this.code = code;
    this.detail = detail === undefined ? undefined : sanitizeText(detail, PROBLEM_LIMITS.detail);
    this.extras = extras;
  }
}

function boundedErrors(errors: readonly ValidationErrorItem[]): ValidationErrorItem[] {
  return errors.slice(0, PROBLEM_LIMITS.errors).map((error) => ({
    path: sanitizeText(error.path, PROBLEM_LIMITS.errorPath),
    message: sanitizeText(error.message, PROBLEM_LIMITS.errorMessage),
  }));
}

function boundedImportErrors(errors: readonly ImportErrorItem[]): ImportErrorItem[] {
  const result: ImportErrorItem[] = [];
  for (const error of errors.slice(0, PROBLEM_LIMITS.importErrors)) {
    if (!isOneOf(IMPORT_ERROR_LOCATIONS, error.location) || !isOneOf(IMPORT_ERROR_PROBLEMS, error.problem)) {
      continue;
    }
    result.push({
      location: error.location,
      record: sanitizeText(error.record, PROBLEM_LIMITS.importRecord),
      field: error.field === null ? null : sanitizeText(error.field, PROBLEM_LIMITS.importField),
      problem: error.problem,
      message: sanitizeText(error.message, PROBLEM_LIMITS.importMessage),
    });
  }
  return result;
}

/** Builds the response body of a problem; only contract members are copied, with the contract limits. */
export function problemBody(problem: HttpProblem): ProblemBody {
  const { extras } = problem;
  return {
    type: `urn:edr:problem:${problem.code}`,
    title: TITLES[problem.code],
    status: problem.status,
    code: problem.code,
    ...(problem.detail === undefined ? {} : { detail: problem.detail }),
    ...(extras.errors === undefined ? {} : { errors: boundedErrors(extras.errors) }),
    ...(extras.importErrors === undefined ? {} : { importErrors: boundedImportErrors(extras.importErrors) }),
    ...(extras.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: extras.retryAfterSeconds }),
    ...(extras.refusalReason === undefined ? {} : { refusalReason: extras.refusalReason }),
    ...(extras.facts === undefined ? {} : { facts: [...extras.facts] }),
    ...(extras.items === undefined ? {} : { items: extras.items.map((item) => ({ ...item })) }),
  };
}

/** Problems answered by the platform itself, with fixed detail texts. */
export const platformProblems = {
  misdirectedHost: (): HttpProblem =>
    new HttpProblem(421, 'MISDIRECTED_HOST', 'The Host header is not in the configured allow-list.'),
  forbiddenOrigin: (detail: string): HttpProblem => new HttpProblem(403, 'FORBIDDEN_ORIGIN', detail),
  unsupportedMediaType: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'The request body media type is not accepted by this operation.'),
  payloadTooLarge: (): HttpProblem =>
    new HttpProblem(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the limit of this operation.'),
  notFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The requested resource does not exist.'),
  invalidBody: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'The request body is not valid JSON.'),
  invalidRequest: (errors?: readonly ValidationErrorItem[]): HttpProblem =>
    new HttpProblem(400, 'VALIDATION_FAILED', 'The request is invalid.', errors === undefined ? {} : { errors }),
  internal: (): HttpProblem => new HttpProblem(500, 'INTERNAL', INTERNAL_DETAIL),
};
