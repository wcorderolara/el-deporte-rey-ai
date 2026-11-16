/**
 * Image provider failures (PD-ARCH-01G-B; the rules of the AI port, T10-F10). Every failure has a closed `code`, the
 * HTTP status of a provider response when there was one, and a bounded `retryAfterSeconds` for a rate limit. A
 * failure never carries a provider message or body, the API key, the request body, an exception message or a URL.
 */

export const IMAGE_FAILURE_CODES = [
  'not_configured',
  'missing_api_key',
  'model_unavailable',
  'not_authorized',
  'rate_limited',
  'quota_exceeded',
  'rejected',
  'invalid_request',
  'timeout',
  'response_invalid',
  'unavailable',
  'busy',
  'aborted',
] as const;

export type ImageFailureCode = (typeof IMAGE_FAILURE_CODES)[number];

const FIXED_TEXT: Readonly<Record<ImageFailureCode, string>> = {
  not_configured: 'image provider not configured',
  missing_api_key: 'image provider API key missing',
  model_unavailable: 'image model unavailable',
  not_authorized: 'image provider account not authorized',
  rate_limited: 'image provider rate limited',
  quota_exceeded: 'image provider quota or spend limit exceeded',
  rejected: 'image request rejected by the provider',
  invalid_request: 'image request refused by the provider',
  timeout: 'image provider timed out',
  response_invalid: 'image provider response invalid',
  unavailable: 'image provider unavailable',
  busy: 'image provider concurrency limit reached',
  aborted: 'image request cancelled',
};

/** Longest Retry-After kept, in seconds. */
export const MAX_RETRY_AFTER_SECONDS = 3600;

export interface ImageFailureDetails {
  readonly httpStatus?: number | null;
  readonly retryAfterSeconds?: number | null;
}

function sanitizeStatus(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function sanitizeRetryAfter(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_RETRY_AFTER_SECONDS)
    : null;
}

export class ImageProviderError extends Error {
  override readonly name = 'ImageProviderError';
  readonly code: ImageFailureCode;
  readonly httpStatus: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(code: ImageFailureCode, details: ImageFailureDetails = {}) {
    const httpStatus = sanitizeStatus(details.httpStatus);
    super(httpStatus === null ? FIXED_TEXT[code] : `${FIXED_TEXT[code]} (HTTP ${String(httpStatus)})`);
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = sanitizeRetryAfter(details.retryAfterSeconds);
  }

  toJSON(): { code: ImageFailureCode; httpStatus: number | null; retryAfterSeconds: number | null } {
    return { code: this.code, httpStatus: this.httpStatus, retryAfterSeconds: this.retryAfterSeconds };
  }
}

export function isImageProviderError(value: unknown): value is ImageProviderError {
  return value instanceof ImageProviderError;
}
