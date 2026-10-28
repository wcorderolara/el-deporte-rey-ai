/**
 * Stage and run failures (architecture.md section 6; T10-F10).
 *
 * A failure is stored and returned only as the contract's closed `Failure` object: `{ code, sourceId, path,
 * httpStatus }` with a code from the closed list and sanitized, length-capped parameters. It never carries an
 * exception message, a provider body, a credential or a file path. `failureOf` turns anything a stage threw into
 * such an object:
 * - a `StageFailure` (thrown by a stage with a closed failure it built itself) keeps its failure after re-validation;
 * - a `SourceError` gives `toSourceFailure` (code, source ID, validation path, HTTP status);
 * - an `AiProviderError` gives its code, validation path and HTTP status;
 * - a `ZodError` (stage input or output refused by its schema) gives `invalid` with a pointer of field names only;
 * - a cancelled run gives `interrupted`;
 * - anything else gives `internal`.
 */
import { type Failure, type FailureCode, FailureCodeSchema, FailureSchema } from '@edr/contracts';
import { ZodError } from 'zod';

import { isAiProviderError } from '../providers/ai/index.js';
import { SourceError, toSourceFailure } from '../providers/sports/index.js';

export type { Failure, FailureCode };

/** Longest stored validation path (contract `Failure.path`). */
export const MAX_FAILURE_PATH_LENGTH = 200;

const SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
/** Pointer segments kept as written: camelCase schema field names. Anything else becomes `*`. */
const SAFE_SEGMENT = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
/** Characters allowed in a stored validation path (pointers and dotted paths of field names and indexes). */
const PATH_CHARACTERS = /^[A-Za-z0-9_.*/[\]-]+$/;

/** A failure with the given code and no parameters. */
export function failure(code: FailureCode): Failure {
  return { code, sourceId: null, path: null, httpStatus: null };
}

/**
 * Error a stage throws to fail with a closed failure it built itself (for example `no_data` for an empty selection).
 * The message is fixed text derived from the code; the failure parameters are re-validated before storage.
 */
export class StageFailure extends Error {
  override readonly name = 'StageFailure';
  readonly failure: Failure;

  constructor(code: FailureCode, details: Partial<Omit<Failure, 'code'>> = {}) {
    super(`stage failed: ${code}`);
    this.failure = sanitizeFailure({
      code,
      sourceId: details.sourceId ?? null,
      path: details.path ?? null,
      httpStatus: details.httpStatus ?? null,
    });
  }
}

function sanitizePath(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || !PATH_CHARACTERS.test(value) || value.includes('..')) {
    return null;
  }
  return value.length > MAX_FAILURE_PATH_LENGTH ? value.slice(0, MAX_FAILURE_PATH_LENGTH) : value;
}

function sanitizeSourceId(value: unknown): string | null {
  return typeof value === 'string' && SOURCE_ID.test(value) ? value : null;
}

function sanitizeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

/** Re-validates a failure: an unknown code becomes `internal`, each parameter is kept only when it is safe. */
export function sanitizeFailure(value: {
  readonly code: unknown;
  readonly sourceId?: unknown;
  readonly path?: unknown;
  readonly httpStatus?: unknown;
}): Failure {
  const code = FailureCodeSchema.safeParse(value.code);
  const result: Failure = {
    code: code.success ? code.data : 'internal',
    sourceId: sanitizeSourceId(value.sourceId),
    path: sanitizePath(value.path),
    httpStatus: sanitizeHttpStatus(value.httpStatus),
  };
  return FailureSchema.parse(result);
}

/** A JSON pointer of the first issue of a Zod error, built from field names and indexes only. */
export function issuePointer(error: ZodError): string | null {
  const issue = error.issues[0];
  if (issue === undefined) {
    return null;
  }
  const pointer = issue.path
    .slice(0, 24)
    .map((segment) => {
      if (typeof segment === 'number') {
        return `/${String(segment)}`;
      }
      return typeof segment === 'string' && SAFE_SEGMENT.test(segment) ? `/${segment}` : '/*';
    })
    .join('');
  return pointer === '' ? '/' : pointer;
}

/** The closed failure of anything a stage threw (T10-F10). `aborted` is true when the run was cancelled. */
export function failureOf(error: unknown, aborted = false): Failure {
  if (error instanceof StageFailure) {
    return sanitizeFailure(error.failure);
  }
  if (error instanceof SourceError) {
    return sanitizeFailure(toSourceFailure(error));
  }
  if (isAiProviderError(error)) {
    const { code, path, httpStatus } = error.toJSON();
    return sanitizeFailure({ code, sourceId: null, path, httpStatus });
  }
  if (aborted) {
    return failure('interrupted');
  }
  if (error instanceof ZodError) {
    return sanitizeFailure({ code: 'invalid', path: issuePointer(error) });
  }
  return failure('internal');
}
