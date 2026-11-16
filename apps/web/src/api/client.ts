/**
 * Typed client of the local HTTP API (`/api/v1`; contract `http-api.openapi.yaml`, AD-06).
 *
 * - Same origin only: paths are relative to the API base; absolute or protocol-relative URLs are refused, so the
 *   browser never calls another host (R-262, T11H-F14).
 * - Every method other than GET and HEAD sends `X-EDR-Client: web` (local request protection, AD-14); a request body is
 *   sent as `application/json`.
 * - Successful JSON responses are validated with the schema passed by the caller (the Zod schemas of
 *   `@edr/contracts`), when one is given.
 * - Error responses in `application/problem+json` are parsed into a `Problem` (including `importErrors`,
 *   `retryAfterSeconds` and `refusalReason`); every other failure becomes an `ApiError` of a closed kind.
 */
import {
  IMPORT_ERROR_LOCATIONS,
  IMPORT_ERROR_PROBLEMS,
  PROBLEM_CODES,
  REFUSAL_REASONS,
  type ImportError,
  type Problem,
  type ProblemCode,
  type ValidationIssue,
} from './types';

export const API_BASE_PATH = '/api/v1';

/** Header and value required on every mutating request (contract parameter `ClientHeader`). */
export const CLIENT_HEADER = 'X-EDR-Client';
export const CLIENT_HEADER_VALUE = 'web';

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Structural view of a Zod schema (`safeParse`), so that any `@edr/contracts` schema can be passed. */
export interface ResponseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

export interface RequestOptions<T> {
  /** JSON request body; omitted when undefined. */
  body?: unknown;
  /**
   * A binary request body sent as is with its own media type (a PNG or JPEG upload, PD-ARCH-01G-D); takes the place
   * of `body`.
   */
  file?: Blob;
  /** Contract schema that the successful response body must satisfy. */
  schema?: ResponseSchema<T>;
  signal?: AbortSignal;
}

/**
 * - `problem`: the server answered with a problem+json body (`problem` is set);
 * - `http`: the server answered with an error status and no usable problem body;
 * - `network`: the request did not reach the server or the connection failed;
 * - `invalid_response`: a successful response whose body is not JSON or does not match the contract schema;
 * - `aborted`: the caller aborted the request.
 */
export type ApiErrorKind = 'problem' | 'http' | 'network' | 'invalid_response' | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly problem: Problem | null;

  constructor(kind: ApiErrorKind, details: { status?: number | null; problem?: Problem | null; cause?: unknown } = {}) {
    const status = details.status ?? null;
    const problem = details.problem ?? null;
    super(
      `API request failed (${kind}${problem ? ` ${problem.code}` : ''}${status === null ? '' : ` ${status}`})`,
      details.cause === undefined ? undefined : { cause: details.cause },
    );
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.problem = problem;
  }
}

const RETRYABLE_PROBLEM_CODES: ReadonlySet<ProblemCode> = new Set([
  'PROVIDER_FAILED',
  'PROVIDER_RATE_LIMITED',
  'RUN_IN_PROGRESS',
  'INTERNAL',
]);

/** True when repeating the same request later may succeed (the UI then offers a retry). */
export function isRetryable(error: ApiError): boolean {
  switch (error.kind) {
    case 'network':
      return true;
    case 'problem':
      return error.problem !== null && RETRYABLE_PROBLEM_CODES.has(error.problem.code);
    case 'http':
      return error.status !== null && (error.status >= 500 || error.status === 408 || error.status === 429);
    default:
      return false;
  }
}

const ACCESS_REFUSAL_CODES: ReadonlySet<ProblemCode> = new Set(['FORBIDDEN_ORIGIN', 'MISDIRECTED_HOST']);

/**
 * True when the local request protection refused the request (403 FORBIDDEN_ORIGIN, 421 MISDIRECTED_HOST), or
 * the server answered 401 or 403 without a problem body. There is no login (PD-05): the remedy is to open the
 * interface from its local address, never to sign in.
 */
export function isAccessRefusal(error: ApiError): boolean {
  if (error.kind === 'problem') {
    return error.problem !== null && ACCESS_REFUSAL_CODES.has(error.problem.code);
  }
  return error.kind === 'http' && (error.status === 401 || error.status === 403 || error.status === 421);
}

// ---------------------------------------------------------------------------------------------------------------
// problem+json parsing
// ---------------------------------------------------------------------------------------------------------------

const MAX_VALIDATION_ISSUES = 50;
const MAX_IMPORT_ERRORS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function parseValidationIssue(value: unknown): ValidationIssue | null {
  if (!isRecord(value)) {
    return null;
  }
  const path = boundedString(value.path, 200);
  const message = boundedString(value.message, 200);
  return path === null || message === null ? null : { path, message };
}

function parseImportError(value: unknown): ImportError | null {
  if (!isRecord(value)) {
    return null;
  }
  const record = boundedString(value.record, 120);
  const message = boundedString(value.message, 200);
  const field = value.field === null ? null : boundedString(value.field, 80);
  if (
    !isOneOf(IMPORT_ERROR_LOCATIONS, value.location) ||
    !isOneOf(IMPORT_ERROR_PROBLEMS, value.problem) ||
    record === null ||
    message === null ||
    (value.field !== null && field === null)
  ) {
    return null;
  }
  return { location: value.location, record, field, problem: value.problem, message };
}

function parseList<T>(value: unknown, max: number, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: T[] = [];
  for (const item of value.slice(0, max)) {
    const parsed = parse(item);
    if (parsed !== null) {
      result.push(parsed);
    }
  }
  return result;
}

/**
 * Parses a problem+json body. Returns null when the body is not a problem object with a known `code`; unknown or
 * malformed optional members are dropped rather than trusted.
 */
export function parseProblem(body: unknown, responseStatus: number): Problem | null {
  if (!isRecord(body) || !isOneOf(PROBLEM_CODES, body.code)) {
    return null;
  }
  const retryAfter = body.retryAfterSeconds;
  return {
    type: boundedString(body.type, 200) ?? 'about:blank',
    title: boundedString(body.title, 200) ?? '',
    status: typeof body.status === 'number' && Number.isInteger(body.status) ? body.status : responseStatus,
    code: body.code,
    detail: boundedString(body.detail, 500),
    errors: parseList(body.errors, MAX_VALIDATION_ISSUES, parseValidationIssue),
    importErrors: parseList(body.importErrors, MAX_IMPORT_ERRORS, parseImportError),
    retryAfterSeconds:
      typeof retryAfter === 'number' && Number.isInteger(retryAfter) && retryAfter >= 0 ? retryAfter : null,
    refusalReason: isOneOf(REFUSAL_REASONS, body.refusalReason) ? body.refusalReason : null,
    facts: Array.isArray(body.facts) ? body.facts : [],
    items: Array.isArray(body.items) ? body.items : [],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------------------------

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Base path of the API; same origin. Defaults to `/api/v1`. */
  basePath?: string;
  /** Injected for tests; defaults to the platform `fetch`. */
  fetch?: FetchFunction;
}

export interface ApiClient {
  request<T = unknown>(method: HttpMethod, path: string, options?: RequestOptions<T>): Promise<T>;
  get<T = unknown>(path: string, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>;
  getBlob(path: string, options?: { signal?: AbortSignal }): Promise<Blob>;
  post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>;
  delete<T = unknown>(path: string, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>;
}

const JSON_TYPE = 'application/json';
const PROBLEM_TYPE = 'application/problem+json';

function mediaType(response: Response): string {
  return (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function assertRelativePath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new TypeError('API paths must be relative to the API base path and start with a single "/"');
  }
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false; cause: unknown }> {
  try {
    return { ok: true, value: (await response.json()) as unknown };
  } catch (cause) {
    return { ok: false, cause };
  }
}

async function toError(response: Response): Promise<ApiError> {
  const type = mediaType(response);
  if (type === PROBLEM_TYPE || type === JSON_TYPE) {
    const body = await readJson(response);
    const problem = body.ok ? parseProblem(body.value, response.status) : null;
    if (problem !== null) {
      return new ApiError('problem', { status: response.status, problem });
    }
  }
  return new ApiError('http', { status: response.status });
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const basePath = options.basePath ?? API_BASE_PATH;
  const fetchFunction: FetchFunction = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function request<T = unknown>(method: HttpMethod, path: string, init: RequestOptions<T> = {}): Promise<T> {
    assertRelativePath(path);
    const headers: Record<string, string> = { Accept: `${JSON_TYPE}, ${PROBLEM_TYPE}` };
    if (method !== 'GET' && method !== 'HEAD') {
      headers[CLIENT_HEADER] = CLIENT_HEADER_VALUE;
    }
    const requestInit: RequestInit = {
      method,
      headers,
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
    };
    if (init.file !== undefined) {
      headers['Content-Type'] = init.file.type;
      requestInit.body = init.file;
    } else if (init.body !== undefined) {
      headers['Content-Type'] = JSON_TYPE;
      requestInit.body = JSON.stringify(init.body);
    }
    if (init.signal !== undefined) {
      requestInit.signal = init.signal;
    }

    let response: Response;
    try {
      response = await fetchFunction(`${basePath}${path}`, requestInit);
    } catch (cause) {
      throw new ApiError(isAbortError(cause) || init.signal?.aborted === true ? 'aborted' : 'network', { cause });
    }

    if (!response.ok) {
      throw await toError(response);
    }
    if (method === 'HEAD' || response.status === 204) {
      return undefined as T;
    }
    if (mediaType(response) !== JSON_TYPE) {
      throw new ApiError('invalid_response', { status: response.status });
    }
    const body = await readJson(response);
    if (!body.ok) {
      throw new ApiError(isAbortError(body.cause) ? 'aborted' : 'invalid_response', {
        status: response.status,
        cause: body.cause,
      });
    }
    if (init.schema === undefined) {
      return body.value as T;
    }
    const parsed = init.schema.safeParse(body.value);
    if (!parsed.success) {
      throw new ApiError('invalid_response', { status: response.status });
    }
    return parsed.data;
  }

  async function getBlob(path: string, init: { signal?: AbortSignal } = {}): Promise<Blob> {
    assertRelativePath(path);
    let response: Response;
    try {
      response = await fetchFunction(`${basePath}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/zip, application/problem+json' },
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (cause) {
      throw new ApiError(isAbortError(cause) || init.signal?.aborted === true ? 'aborted' : 'network', { cause });
    }
    if (!response.ok) throw await toError(response);
    if (mediaType(response) !== 'application/zip') throw new ApiError('invalid_response', { status: response.status });
    try {
      return await response.blob();
    } catch (cause) {
      throw new ApiError(isAbortError(cause) ? 'aborted' : 'invalid_response', { status: response.status, cause });
    }
  }

  return {
    request,
    get: (path, options) => request('GET', path, options),
    getBlob,
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  };
}

/** Client used by the features. */
export const apiClient: ApiClient = createApiClient();
