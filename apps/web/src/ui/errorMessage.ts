import { ApiError, isAccessRefusal, isRetryable } from '../api/client';
import type { ImportError, ValidationIssue } from '../api/types';
import { errorCopy, pageCopy, problemCodeMessage, refusalReasonLabel } from './copy';

/** Operator-facing description of a failed request or an unexpected error, built only from the copy tables. */
export interface ErrorDescription {
  message: string;
  /** Refusal reason of MANUAL_APPROVAL_REFUSED or SELECTION_UNAVAILABLE, in clear text. */
  reason: string | null;
  /** Hint shown for a refused local request (no login exists, PD-05). */
  hint: string | null;
  retryAfterSeconds: number | null;
  validationIssues: ValidationIssue[];
  importErrors: ImportError[];
  retryable: boolean;
}

/** Describes any thrown value. Messages of unknown errors are never shown, only fixed text. */
export function describeError(error: unknown): ErrorDescription {
  const description: ErrorDescription = {
    message: pageCopy.routeErrorBody,
    reason: null,
    hint: null,
    retryAfterSeconds: null,
    validationIssues: [],
    importErrors: [],
    retryable: false,
  };
  if (!(error instanceof ApiError)) {
    return description;
  }
  description.retryable = isRetryable(error);
  description.hint = isAccessRefusal(error) ? errorCopy.accessRefused : null;
  switch (error.kind) {
    case 'problem': {
      const problem = error.problem;
      if (problem === null) {
        description.message = errorCopy.http(error.status);
        break;
      }
      description.message = problemCodeMessage[problem.code];
      description.reason = problem.refusalReason === null ? null : refusalReasonLabel[problem.refusalReason];
      description.retryAfterSeconds = problem.retryAfterSeconds;
      description.validationIssues = problem.errors;
      description.importErrors = problem.importErrors;
      break;
    }
    case 'network':
      description.message = errorCopy.network;
      break;
    case 'invalid_response':
      description.message = errorCopy.invalidResponse;
      break;
    case 'aborted':
      description.message = errorCopy.aborted;
      break;
    case 'http':
      description.message = errorCopy.http(error.status);
      break;
  }
  return description;
}
