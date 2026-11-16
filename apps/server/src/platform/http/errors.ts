/**
 * problem+json error handling (architecture-delta.md section 2.1; T10-F10, T11H-F12).
 *
 * Every error becomes a problem with a closed code and a fixed or sanitized `detail`. Nothing of an exception
 * message, a stack, the request body, the configuration or a credential reaches the response; a 500 answers
 * `INTERNAL` with fixed text. The handler logs server errors with the error type, code and stack frames only, and
 * never logs a request body or an exception message.
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ContractResponseError } from '../../modules/projects/respond.js';

import { applySecurityHeaders } from './headers.js';
import {
  HttpProblem,
  PROBLEM_CONTENT_TYPE,
  type ValidationErrorItem,
  platformProblems,
  problemBody,
} from './problem.js';

/**
 * Path segments kept in validation pointers: camelCase field names as the contract uses them. Anything else (record
 * keys taken from the input, names with dashes, spaces or symbols) becomes `*`, so no input text is echoed (T11H-F12).
 */
const SAFE_SEGMENT = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

/** Fixed messages per Zod issue code; Zod's own messages are never used. */
const ISSUE_MESSAGES: Readonly<Record<string, string>> = {
  invalid_type: 'has the wrong type',
  too_big: 'is too large or too long',
  too_small: 'is too small or too short',
  invalid_format: 'has an invalid format',
  unrecognized_keys: 'contains an unknown field',
  invalid_value: 'is not an allowed value',
  invalid_union: 'does not match any allowed form',
  not_multiple_of: 'is not an allowed multiple',
};

/** A JSON pointer built from field names and indexes; segments that are not plain field names become `*`. */
export function pointer(path: readonly PropertyKey[]): string {
  return path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `/${String(segment)}`;
      }
      return typeof segment === 'string' && SAFE_SEGMENT.test(segment) ? `/${segment}` : '/*';
    })
    .join('');
}

function zodErrors(error: ZodError): ValidationErrorItem[] {
  return error.issues.map((issue) => ({
    path: pointer(issue.path),
    message: ISSUE_MESSAGES[issue.code] ?? 'is invalid',
  }));
}

function schemaErrors(validation: readonly unknown[]): ValidationErrorItem[] {
  return validation.map((item) => {
    const instancePath = (item as { instancePath?: unknown }).instancePath;
    const segments = typeof instancePath === 'string' ? instancePath.split('/').slice(1) : [];
    return { path: pointer(segments), message: 'is invalid' };
  });
}

function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && Number.isInteger(status) ? status : null;
}

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

const INVALID_JSON_CODES: ReadonlySet<string> = new Set([
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
  'EDR_JSON_TOO_DEEP',
]);

/** Maps any thrown value to the problem answered for it. */
export function toProblem(error: unknown): HttpProblem {
  if (error instanceof HttpProblem) {
    return error;
  }
  if (error instanceof ZodError) {
    return platformProblems.invalidRequest(zodErrors(error));
  }
  if (typeof error !== 'object' || error === null) {
    return platformProblems.internal();
  }
  const validation = (error as { validation?: unknown }).validation;
  if (Array.isArray(validation)) {
    return platformProblems.invalidRequest(schemaErrors(validation));
  }
  const code = codeOf(error);
  if (code !== null && INVALID_JSON_CODES.has(code)) {
    return platformProblems.invalidBody();
  }
  const status = statusOf(error);
  if (status === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return platformProblems.payloadTooLarge();
  }
  if (status === 415 || code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return platformProblems.unsupportedMediaType();
  }
  // 403 from the static file server (dotfiles, traversal) and 404 reveal nothing beyond "not found".
  if (status === 403 || status === 404) {
    return platformProblems.notFound();
  }
  if (status !== null && status >= 400 && status < 500) {
    return platformProblems.invalidRequest();
  }
  return platformProblems.internal();
}

/** Sends a problem response with the security headers. */
export function sendProblem(reply: FastifyReply, problem: HttpProblem): FastifyReply {
  applySecurityHeaders(reply);
  reply.code(problem.status).header('content-type', PROBLEM_CONTENT_TYPE).header('cache-control', 'no-store');
  return reply.send(reply.request.method === 'HEAD' ? '' : JSON.stringify(problemBody(problem)));
}

/** Fastify error handler: every error is answered as a problem; server errors are logged without messages. */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const problem = toProblem(error);
  if (problem.status >= 500) {
    request.log.error(
      {
        err: error,
        route: request.routeOptions.url ?? null,
        ...(error instanceof ContractResponseError ? { contract: error.contract, responsePaths: error.paths } : {}),
      },
      'request failed',
    );
  } else {
    request.log.debug({ problem: problem.code }, 'request refused');
  }
  return sendProblem(reply, problem);
}

/**
 * Handler of errors Fastify raises before routing (an invalid URL escape, an overlong parameter). They bypass the
 * hooks, so the Host check and the security headers are applied here.
 */
export function frameworkErrorHandler(
  hostAllowed: (request: FastifyRequest) => boolean,
): (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => void {
  return (error, request, reply) => {
    const problem = hostAllowed(request) ? toProblem(error) : platformProblems.misdirectedHost();
    void sendProblem(reply, problem);
  };
}
