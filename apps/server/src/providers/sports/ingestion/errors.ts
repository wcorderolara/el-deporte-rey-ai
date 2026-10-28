/**
 * `SourceError` (contracts/provider-ports.md section 1.2; T10-F10): the only error a source returns to core code.
 *
 * - `code` is one of a closed list (the contract's `Failure` codes for sources).
 * - The stored and displayed failure is `{ code, sourceId, path, httpStatus }` only (`toSourceFailure`). `message` is
 *   for the server log at debug level; it is never stored, returned by the API or shown in the UI, and adapters build
 *   it from fixed text only (never a credential, a provider body, a request URL with query values or a file path).
 * - Every parameter is sanitized on construction: a path that is not a payload validation path, an HTTP status
 *   outside 100 to 599 or a negative or fractional wait becomes null.
 */
import type { SourceUnavailableReason } from '@edr/contracts';

import type { EgressError } from '../../../platform/net/index.js';

/** Closed source failure codes (contract schema `Failure`). */
export const SOURCE_ERROR_CODES = [
  'unavailable',
  'rate_limited',
  'timeout',
  'no_data',
  'invalid',
  'access_refused',
  'not_available',
  'bad_request',
] as const;

export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

const CODES: ReadonlySet<string> = new Set(SOURCE_ERROR_CODES);
const SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
/** A payload validation path: `/` or JSON-pointer segments of schema keys and indexes (never a file path). */
const VALIDATION_PATH = /^(\/|(\/[A-Za-z0-9_-]{1,64}){1,24})$/;
const MAX_PATH_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 200;
/** Longest wait a source error may announce (one day); anything else is dropped. */
export const MAX_RETRY_AFTER_SECONDS = 86_400;

/** True for one of the closed codes. */
export function isSourceErrorCode(value: unknown): value is SourceErrorCode {
  return typeof value === 'string' && CODES.has(value);
}

/** A payload validation path, or null. */
export function sanitizeValidationPath(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_PATH_LENGTH && VALIDATION_PATH.test(value) ? value : null;
}

function sanitizeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function sanitizeRetryAfter(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_RETRY_AFTER_SECONDS
    ? value
    : null;
}

function sanitizeMessage(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, ' ') : '';
  return text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : text;
}

/** The stored and displayed form of a source failure (contract `Failure` for sources; T10-F10). */
export interface SourceFailure {
  readonly code: SourceErrorCode;
  readonly sourceId: string | null;
  readonly path: string | null;
  readonly httpStatus: number | null;
}

export class SourceError extends Error {
  override readonly name = 'SourceError';
  readonly code: SourceErrorCode;
  readonly sourceId: string;
  readonly path: string | null;
  readonly httpStatus: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: SourceErrorCode,
    message: string,
    sourceId: string,
    path: string | null = null,
    httpStatus: number | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(sanitizeMessage(message));
    this.code = isSourceErrorCode(code) ? code : 'invalid';
    this.sourceId = sourceId;
    this.path = sanitizeValidationPath(path);
    this.httpStatus = sanitizeHttpStatus(httpStatus);
    this.retryAfterSeconds = sanitizeRetryAfter(retryAfterSeconds);
  }

  /** Serialization never includes the message (T10-F10). */
  toJSON(): SourceFailure {
    return toSourceFailure(this);
  }
}

/** The failure to store and return: closed code and sanitized parameters only, never the message (T10-F10). */
export function toSourceFailure(error: SourceError): SourceFailure {
  return Object.freeze({
    code: isSourceErrorCode(error.code) ? error.code : 'invalid',
    sourceId: SOURCE_ID.test(error.sourceId) ? error.sourceId : null,
    path: sanitizeValidationPath(error.path),
    httpStatus: sanitizeHttpStatus(error.httpStatus),
  });
}

/**
 * Maps an egress failure to a source error (platform/net/errors.ts): `denied`, `redirect`, `too_large` and
 * `invalid_request` are egress refusals (`invalid`, never retried); `timeout` is `timeout`; `network` and the
 * caller's own cancellation (`aborted`) are `unavailable`. The egress message is not reused.
 */
export function sourceErrorFromEgress(error: EgressError, sourceId: string): SourceError {
  switch (error.kind) {
    case 'timeout':
      return new SourceError('timeout', 'source request exceeded its deadline', sourceId);
    case 'network':
      return new SourceError('unavailable', 'source connection failed', sourceId);
    case 'aborted':
      return new SourceError('unavailable', 'source request was cancelled', sourceId);
    case 'denied':
    case 'redirect':
    case 'too_large':
    case 'invalid_request':
      return new SourceError('invalid', 'source request refused by the egress client', sourceId);
  }
}

/**
 * Normalizes anything an adapter threw into a `SourceError` of the given source: a `SourceError` keeps its code and
 * sanitized parameters (re-attributed to the source when another ID was given); anything else becomes `unavailable`
 * with fixed text, because its message may carry a path, a URL or a provider body.
 */
export function toSourceError(error: unknown, sourceId: string): SourceError {
  if (error instanceof SourceError) {
    return error.sourceId === sourceId
      ? error
      : new SourceError(error.code, error.message, sourceId, error.path, error.httpStatus, error.retryAfterSeconds);
  }
  return new SourceError('unavailable', 'source adapter failed', sourceId);
}

/**
 * Availability reason shown for a source error on a listing (R-075, R-286): `not_available` is `not_found` for an
 * HTTP 404 and a subscription restriction otherwise; `access_refused` stays itself; `rate_limited` stays itself;
 * `no_data` is `not_provided`; transport failures and invalid responses are `source_unavailable`.
 */
export function availabilityReasonOf(error: SourceError): SourceUnavailableReason {
  switch (error.code) {
    case 'not_available':
      return error.httpStatus === 404 ? 'not_found' : 'subscription_restricted';
    case 'access_refused':
      return 'access_refused';
    case 'rate_limited':
      return 'rate_limited';
    case 'no_data':
      return 'not_provided';
    case 'unavailable':
    case 'timeout':
    case 'invalid':
    case 'bad_request':
      return 'source_unavailable';
  }
}
