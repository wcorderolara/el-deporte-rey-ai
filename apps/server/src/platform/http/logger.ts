/**
 * Server logger (architecture-delta.md section 4 TB-6; T10-F11, T11H-F03, T11H-F12; R-263).
 *
 * - Fastify's pino logger with explicit redaction paths for credentials, also under top-level keys.
 * - Serializers that reduce requests to method and route, replies to the status code and errors to their type and
 *   code: no URL query, header, body, exception message or stack text ever reaches the log through them.
 * - Request logs are one line per request with method, route, status and duration only (T10-F11); Fastify's own
 *   request logging is disabled. No request body is logged at any level (T11H-F12).
 *
 * The logger is created before the HTTP application (the composition root hands it to providers), through
 * Fastify's public logger options, so no direct dependency on pino is needed.
 */
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyLoggerOptions,
  type FastifyRequest,
} from 'fastify';

/** The logger type used by the container, providers and modules. */
export type Logger = FastifyBaseLogger;

/** Replacement text of redacted values. */
export const REDACTED = '[REDACTED]';

/** Field names whose values are always redacted. */
const SECRET_FIELDS = ['apiKey', 'key', 'token', 'authToken', 'secret', 'password'] as const;

/**
 * Redaction paths (pino path syntax). The explicit list of T10-F11 and T11H-F03, plus the same secret field names as
 * top-level keys.
 */
export const REDACT_PATHS: readonly string[] = Object.freeze([
  'req.headers.authorization',
  'headers.authorization',
  'req.headers["x-auth-token"]',
  'headers["x-auth-token"]',
  ...SECRET_FIELDS.map((field) => `*.${field}`),
  'authorization',
  ...SECRET_FIELDS,
]);

/** Writable destination of log lines (for example `process.stdout`, or a capture stream in tests). */
export interface LogDestination {
  write(line: string): unknown;
}

export interface LoggerOptions {
  /** Default `info`. */
  readonly level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** Default `process.stdout`. */
  readonly destination?: LogDestination;
}

const SAFE_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/** Error summary for logs: type and code only, and the stack frames without the message line. */
export function summarizeError(error: unknown): { type: string; code?: string; frames?: string[] } {
  if (!(error instanceof Error)) {
    return { type: typeof error };
  }
  const code = (error as { code?: unknown }).code;
  const frames = (error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at\s/.test(line))
    .slice(0, 15)
    .map((line) => line.trim());
  return {
    type: SAFE_CODE.test(error.name) ? error.name : 'Error',
    ...(typeof code === 'string' && SAFE_CODE.test(code) ? { code } : {}),
    ...(frames.length > 0 ? { frames } : {}),
  };
}

function routeOf(request: FastifyRequest): string | null {
  const route = (request as Partial<FastifyRequest>).routeOptions?.url;
  return typeof route === 'string' ? route : null;
}

// Fastify's types expect the error serializer to keep the message and stack; these serializers deliberately drop them.
const serializers = {
  req: (request: FastifyRequest) => ({ method: request.method, route: routeOf(request) }),
  res: (reply: { statusCode: number }) => ({ statusCode: reply.statusCode }),
  err: summarizeError,
} as unknown as FastifyLoggerOptions['serializers'];

/** Creates the redacting logger. */
export function createLogger(options: LoggerOptions = {}): Logger {
  // Fastify builds its pino logger from these options; the instance is only used for that and never started.
  const factory = Fastify({
    logger: {
      level: options.level ?? 'info',
      base: null,
      redact: { paths: [...REDACT_PATHS], censor: REDACTED },
      serializers,
      stream: options.destination ?? process.stdout,
    },
  });
  return factory.log;
}

/**
 * Logs one line per completed request: method, route pattern (never the raw URL or query), status and duration.
 * Install on the root instance.
 */
export function installRequestLogging(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: routeOf(request),
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request completed',
    );
  });
}
