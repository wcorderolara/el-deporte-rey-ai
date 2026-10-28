/**
 * Egress HTTP client (contracts/provider-ports.md section 4; T10-F07, T10-F08). `platform/net` is the only module
 * allowed to open network connections (ESLint rules of architecture-delta.md section 7.1).
 *
 * - Every URL is checked against the allow-list before any connection is opened (`EgressAllowList.check`).
 * - Redirects are failures (`redirect: 'error'`).
 * - One total deadline (`AbortSignal.timeout`, combined with the caller's signal) covers connecting, the headers and
 *   the whole body.
 * - The body is read as a stream and the request is aborted as soon as the decoded bytes (after the transparent gzip,
 *   br or deflate decompression of `fetch`) exceed `maxResponseBytes`; `Content-Length` is not trusted.
 * - TLS verification is never disabled: no custom dispatcher and no TLS option is used.
 * - Nothing is logged here; request and response bodies and the credential headers are never logged.
 */
import type { EgressAllowList } from './allow-list.js';
import { EgressError } from './errors.js';

/** Default response cap of sports-data requests (T10-F07). */
export const DEFAULT_SPORTS_MAX_RESPONSE_BYTES = 512 * 1024;
/** Default response cap of AI requests (T10-F07). */
export const DEFAULT_AI_MAX_RESPONSE_BYTES = 256 * 1024;
/** Upper bound of any response cap (schema maximum, T10-F07, T11H-F20). */
export const MAX_RESPONSE_BYTES_LIMIT = 2 * 1024 * 1024;
/** Upper bound of a request deadline. */
export const MAX_TIMEOUT_MS = 120_000;
/** Upper bound of a request body. */
export const MAX_REQUEST_BODY_CHARACTERS = 2 * 1024 * 1024;

export interface EgressRequestInit {
  readonly method: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Total deadline in milliseconds, covering the body read; 1 to 120000. */
  readonly timeoutMs: number;
  /** Cap on the decoded response bytes; 1 to 2 MiB. */
  readonly maxResponseBytes: number;
  readonly signal?: AbortSignal;
}

export interface EgressResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
}

export interface EgressClient {
  request(url: string, init: EgressRequestInit): Promise<EgressResponse>;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function checkInit(init: EgressRequestInit): void {
  if (init.method !== 'GET' && init.method !== 'POST') {
    throw new EgressError('invalid_request', 'egress refused: method must be GET or POST');
  }
  if (!isIntegerInRange(init.timeoutMs, 1, MAX_TIMEOUT_MS)) {
    throw new EgressError('invalid_request', 'egress refused: timeoutMs is out of range');
  }
  if (!isIntegerInRange(init.maxResponseBytes, 1, MAX_RESPONSE_BYTES_LIMIT)) {
    throw new EgressError('invalid_request', 'egress refused: maxResponseBytes is out of range');
  }
  if (init.body !== undefined && (init.method !== 'POST' || init.body.length > MAX_REQUEST_BODY_CHARACTERS)) {
    throw new EgressError('invalid_request', 'egress refused: a body is allowed only on POST and within its limit');
  }
}

/** Maps a fetch or body-read failure to a closed kind; the original error is dropped (it may name the URL). */
function classify(error: unknown, deadline: AbortSignal, caller: AbortSignal | undefined): EgressError {
  if (error instanceof EgressError) {
    return error;
  }
  if (deadline.aborted) {
    return new EgressError('timeout', 'egress request exceeded its deadline');
  }
  if (caller?.aborted === true) {
    return new EgressError('aborted', 'egress request was cancelled');
  }
  const cause = error instanceof Error ? (error.cause as unknown) : undefined;
  if (cause instanceof Error && /redirect/i.test(cause.message)) {
    return new EgressError('redirect', 'egress refused: redirect responses are not followed');
  }
  return new EgressError('network', 'egress request failed');
}

/** Reads the body as a stream, counting decoded bytes, and aborts when the cap is exceeded. */
async function readCapped(response: Response, maxBytes: number, stop: AbortController): Promise<string> {
  if (response.body === null) {
    return '';
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      stop.abort();
      void reader.cancel().catch(() => undefined);
      throw new EgressError('too_large', 'egress response exceeded its size cap');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function send(allowList: EgressAllowList, url: string, init: EgressRequestInit): Promise<EgressResponse> {
  checkInit(init);
  const target = allowList.check(url);
  if (init.signal?.aborted === true) {
    throw new EgressError('aborted', 'egress request was cancelled');
  }

  const deadline = AbortSignal.timeout(init.timeoutMs);
  const stop = new AbortController();
  const signal = AbortSignal.any(
    init.signal === undefined ? [deadline, stop.signal] : [deadline, stop.signal, init.signal],
  );

  try {
    const response = await fetch(target.href, {
      method: init.method,
      headers: init.headers === undefined ? undefined : { ...init.headers },
      body: init.body,
      redirect: 'error',
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      stop.abort();
      throw new EgressError('redirect', 'egress refused: redirect responses are not followed');
    }
    const text = await readCapped(response, init.maxResponseBytes, stop);
    return { status: response.status, headers: response.headers, text };
  } catch (error) {
    throw classify(error, deadline, init.signal);
  }
}

/** Creates the egress client over an allow-list (built from the configuration by `buildEgressAllowList`). */
export function createEgressClient(allowList: EgressAllowList): EgressClient {
  return Object.freeze({
    request: (url: string, init: EgressRequestInit): Promise<EgressResponse> => send(allowList, url, init),
  });
}
