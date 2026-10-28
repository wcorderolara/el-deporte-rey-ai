/**
 * Request bodies (architecture-delta.md section 4 TB-1 and TB-4; T10-F12; NV-9).
 *
 * - Global body limit 64 KiB. A route raises it with Fastify's route option `bodyLimit`, through `routeBodyLimit`,
 *   which refuses values above the brand-upload limit: `POST /api/v1/imports` uses `IMPORT_BODY_LIMIT` (1.5 MiB, JSON
 *   only) and the brand upload uses `BRAND_UPLOAD_BODY_LIMIT` (5 MiB).
 * - Bodies are JSON (`application/json`) unless the route declares the binary exception with `binaryBodyRoute`
 *   (`image/png` and `image/jpeg` only, used by the brand upload, T33). The media-type check runs in the request
 *   guard, before the body is read (`guards.ts`).
 * - JSON is parsed by Fastify's default parser (`onProtoPoisoning` and `onConstructorPoisoning` `error`), after a
 *   linear, iterative nesting-depth scan that refuses documents nested deeper than `MAX_JSON_DEPTH`, so a deeply
 *   nested envelope is refused quickly without recursion.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** EDR route settings read by the platform guards. */
    edr?: EdrRouteConfig;
  }
}

/** Route settings read by the platform. */
export interface EdrRouteConfig {
  /** Media types accepted instead of JSON for this route's body (binary exception, T10-F12). */
  readonly bodyMediaTypes?: readonly BinaryBodyMediaType[];
}

const KIB = 1024;

/** Global JSON body limit. */
export const GLOBAL_BODY_LIMIT = 64 * KIB;
/** Body limit of `POST /api/v1/imports` (JSON only; contract `createImport`). */
export const IMPORT_BODY_LIMIT = 1536 * KIB;
/** Body limit of the brand upload (`image/png` or `image/jpeg`; T10-F12). The largest route limit. */
export const BRAND_UPLOAD_BODY_LIMIT = 5 * KIB * KIB;
/** Deepest JSON nesting accepted in a request body; no contract request comes close. */
export const MAX_JSON_DEPTH = 64;

/** The only media types of the binary body exception. */
export const BINARY_BODY_MEDIA_TYPES = ['image/png', 'image/jpeg'] as const;
export type BinaryBodyMediaType = (typeof BINARY_BODY_MEDIA_TYPES)[number];

/** The JSON media type. */
export const JSON_MEDIA_TYPE = 'application/json';

/**
 * Returns a route `bodyLimit` value; refuses limits that are not positive integers or that exceed
 * `BRAND_UPLOAD_BODY_LIMIT`. `app.post(url, { bodyLimit: routeBodyLimit(IMPORT_BODY_LIMIT) }, handler)`.
 */
export function routeBodyLimit(bytes: number): number {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > BRAND_UPLOAD_BODY_LIMIT) {
    throw new RangeError(`a route body limit must be an integer from 1 to ${String(BRAND_UPLOAD_BODY_LIMIT)}`);
  }
  return bytes;
}

/**
 * Route `config` for the binary body exception: the route accepts only the given image media types (no JSON) and
 * receives the body as a `Buffer`. `app.post(url, { config: binaryBodyRoute(['image/png', 'image/jpeg']) }, handler)`.
 */
export function binaryBodyRoute(mediaTypes: readonly BinaryBodyMediaType[]): { edr: EdrRouteConfig } {
  if (
    mediaTypes.length === 0 ||
    mediaTypes.some((type) => !(BINARY_BODY_MEDIA_TYPES as readonly string[]).includes(type))
  ) {
    throw new TypeError('the binary body exception allows image/png and image/jpeg only');
  }
  return { edr: Object.freeze({ bodyMediaTypes: Object.freeze([...mediaTypes]) }) };
}

/** The media type of a Content-Type header value, lowercase without parameters, or null. */
export function mediaTypeOf(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const essence = header.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return essence === '' ? null : essence;
}

/** The media types the route accepts for a request body. */
export function acceptedBodyMediaTypes(request: FastifyRequest): readonly string[] {
  const configured = request.routeOptions.config.edr?.bodyMediaTypes;
  return configured !== undefined && configured.length > 0 ? configured : [JSON_MEDIA_TYPE];
}

/** True when the request announces a body (a non-zero Content-Length or a Transfer-Encoding). */
export function hasRequestBody(request: FastifyRequest): boolean {
  const length = request.headers['content-length'];
  if (request.headers['transfer-encoding'] !== undefined) {
    return true;
  }
  return length !== undefined && length !== '0';
}

const OPEN_OBJECT = 0x7b;
const OPEN_ARRAY = 0x5b;
const CLOSE_OBJECT = 0x7d;
const CLOSE_ARRAY = 0x5d;
const QUOTE = 0x22;
const BACKSLASH = 0x5c;

/**
 * True when the nesting depth of a JSON text exceeds `limit`. One linear pass without recursion; brackets inside
 * strings are ignored; stops at the first level beyond the limit. The text is not otherwise validated.
 */
export function jsonDepthExceeds(text: string, limit: number): boolean {
  let depth = 0;
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (inString) {
      if (code === BACKSLASH) {
        index += 1;
      } else if (code === QUOTE) {
        inString = false;
      }
    } else if (code === QUOTE) {
      inString = true;
    } else if (code === OPEN_OBJECT || code === OPEN_ARRAY) {
      depth += 1;
      if (depth > limit) {
        return true;
      }
    } else if (code === CLOSE_OBJECT || code === CLOSE_ARRAY) {
      depth -= 1;
    }
  }
  return false;
}

/** Error of a JSON body nested deeper than `MAX_JSON_DEPTH` (answered 400 `VALIDATION_FAILED`). */
export class JsonTooDeepError extends Error {
  override readonly name = 'JsonTooDeepError';
  readonly statusCode = 400;
  readonly code = 'EDR_JSON_TOO_DEEP';

  constructor() {
    super('The JSON body is nested too deeply');
  }
}

/**
 * Replaces the default body parsers: JSON with the depth scan in front of Fastify's default (poisoning-safe) parser,
 * the binary image types as buffers (accepted only on routes with the binary exception), and nothing else
 * (`text/plain` is removed).
 */
export function installBodyParsers(app: FastifyInstance): void {
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');
  app.removeAllContentTypeParsers();
  app.addContentTypeParser(JSON_MEDIA_TYPE, { parseAs: 'string' }, (request, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (jsonDepthExceeds(text, MAX_JSON_DEPTH)) {
      done(new JsonTooDeepError(), undefined);
      return;
    }
    defaultJsonParser(request, text, done);
  });
  app.addContentTypeParser([...BINARY_BODY_MEDIA_TYPES], { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });
}
