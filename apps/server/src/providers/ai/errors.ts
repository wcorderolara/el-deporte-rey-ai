/**
 * AI provider failures (contracts/provider-ports.md section 2; architecture.md section 6; T10-F10).
 *
 * Every failure has a closed `code` and sanitized parameters only: the HTTP status of a provider response and, for a
 * refused request, the validation path built from schema field names and array indexes. The message is fixed text
 * built from those values. A failure never carries a provider response body, the API key, the request body, an
 * exception message, a URL or a file path, and it has no `cause`.
 */

/**
 * Closed failure codes of the AI port, a subset of the contract `Failure.code` enumeration:
 * - `unavailable`, `rate_limited`, `timeout`, `ai_response_invalid`: provider failures (provider-ports section 2);
 * - `invalid`: the `DraftRequest` was refused by the strict request schema before any adapter sent it (T11H-F16).
 */
export const AI_FAILURE_CODES = ['unavailable', 'rate_limited', 'timeout', 'ai_response_invalid', 'invalid'] as const;

export type AiFailureCode = (typeof AI_FAILURE_CODES)[number];

/** Longest validation path kept on a failure (T10-F10: reason parameters are length-capped). */
export const MAX_FAILURE_PATH_LENGTH = 200;

const FIXED_TEXT: Readonly<Record<AiFailureCode, string>> = {
  unavailable: 'AI provider unavailable',
  rate_limited: 'AI provider rate limited',
  timeout: 'AI provider timed out',
  ai_response_invalid: 'AI response invalid',
  invalid: 'AI draft request invalid',
};

export interface AiFailureDetails {
  /** HTTP status of the provider response, when there was one. */
  readonly httpStatus?: number | null;
  /** Validation path of a refused request (schema field names and indexes only). */
  readonly path?: string | null;
}

function sanitizeStatus(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function sanitizePath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const printable = value.replace(/[^A-Za-z0-9_.[\]-]/g, '?');
  return printable.length > MAX_FAILURE_PATH_LENGTH ? printable.slice(0, MAX_FAILURE_PATH_LENGTH) : printable;
}

export class AiProviderError extends Error {
  override readonly name = 'AiProviderError';
  readonly code: AiFailureCode;
  readonly httpStatus: number | null;
  readonly path: string | null;

  constructor(code: AiFailureCode, details: AiFailureDetails = {}) {
    const httpStatus = sanitizeStatus(details.httpStatus);
    const path = sanitizePath(details.path);
    let message = FIXED_TEXT[code];
    if (httpStatus !== null) {
      message += ` (HTTP ${String(httpStatus)})`;
    }
    if (path !== null) {
      message += ` at ${path}`;
    }
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.path = path;
  }

  /** The sanitized failure parameters, for the stage failure record (`{ code, path, httpStatus }`). */
  toJSON(): { code: AiFailureCode; httpStatus: number | null; path: string | null } {
    return { code: this.code, httpStatus: this.httpStatus, path: this.path };
  }
}

/** True for a failure of the AI port. */
export function isAiProviderError(value: unknown): value is AiProviderError {
  return value instanceof AiProviderError;
}
