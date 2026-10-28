/**
 * Test-only replay transport and builders for the football-data adapter tests (T49; contracts/provider-ports.md
 * section 1.4, "Tests"). The replay `EgressClient` serves the recorded-shape synthetic responses of
 * `fixtures/football-data/` (T23) with their status and headers; it opens no socket. Like the real egress client it
 * refuses a foreign origin before anything else (the same allow-list class) and enforces the decoded-byte cap, so the
 * adapter's handling of those refusals is exercised. Not used by production code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type EnvironmentSource, type SourceConfig, buildAppConfig } from '../../../../../platform/config/index.js';
import {
  EgressAllowList,
  type EgressClient,
  EgressError,
  type EgressRequestInit,
  type EgressResponse,
} from '../../../../../platform/net/index.js';
import { type AdapterContext, type Clock, type SportsLogger, toDescriptor } from '../../../ingestion/index.js';
import { FOOTBALL_DATA_ADAPTER_KIND, PINNED_ORIGIN } from '../constants.js';

export type Json = Record<string, unknown>;

/** One recorded response file of `fixtures/football-data/`. */
export interface RecordedResponse {
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly query: Readonly<Record<string, string>>;
  };
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly bodyText?: string;
}

/** The project root: the nearest ancestor holding `fixtures/football-data/_manifest.json`. */
export function projectRootDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(join(dir, 'fixtures', FOOTBALL_DATA_ADAPTER_KIND, '_manifest.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error('replay: project root not found');
}

export const FIXTURES_DIR = join(projectRootDir(), 'fixtures', FOOTBALL_DATA_ADAPTER_KIND);

/** The reference-shaped competition of the fixtures (AD-31: tests take provider identifiers from `fixtures/`). */
export const REFERENCE_CODE: string = (
  JSON.parse(readFileSync(join(FIXTURES_DIR, '_manifest.json'), 'utf8')) as { referenceCompetition: { code: string } }
).referenceCompetition.code;

/** Reads one recorded response file. */
export function recorded(file: string): RecordedResponse {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as RecordedResponse;
}

/** A reply of the replay transport. */
export type Reply =
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly headers: Readonly<Record<string, string>>;
      readonly text: string;
      /** Virtual time the response takes. */
      readonly delayMs?: number;
    }
  | { readonly kind: 'throw'; readonly error: Error; readonly delayMs?: number };

/** The reply of a recorded file, with optional header and status overrides. */
export function replyOf(
  source: string | RecordedResponse,
  overrides: { status?: number; headers?: Readonly<Record<string, string>>; delayMs?: number } = {},
): Reply {
  const file = typeof source === 'string' ? recorded(source) : source;
  const text = file.bodyText ?? JSON.stringify(file.body);
  return {
    kind: 'response',
    status: overrides.status ?? file.status,
    headers: { ...file.headers, ...(overrides.headers ?? {}) },
    text,
    ...(overrides.delayMs === undefined ? {} : { delayMs: overrides.delayMs }),
  };
}

/** A JSON reply built in a test (synthetic body). */
export function jsonReply(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): Reply {
  return { kind: 'response', status, headers: { 'X-API-Version': 'v4', ...headers }, text: JSON.stringify(body) };
}

/** A reply that throws (a transport failure). */
export function throwReply(error: Error, delayMs?: number): Reply {
  return { kind: 'throw', error, ...(delayMs === undefined ? {} : { delayMs }) };
}

/** Request key: `GET /v4/competitions/CL/matches?matchday=1&season=2026` (query sorted). */
export function requestKey(method: string, path: string, query: Readonly<Record<string, string>>): string {
  const params = Object.keys(query)
    .sort()
    .map((name) => `${name}=${query[name] ?? ''}`)
    .join('&');
  return `${method} ${path}${params === '' ? '' : `?${params}`}`;
}

/** Key of a recorded file's request. */
export function keyOfRecorded(file: string | RecordedResponse): string {
  const response = typeof file === 'string' ? recorded(file) : file;
  return requestKey(response.request.method, response.request.path, response.request.query);
}

export interface ReplayCall {
  readonly url: string;
  readonly key: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  /** Time of the call on the replay's clock. */
  readonly atMs: number;
}

/** Waits on the test's clock (a virtual clock's timers). */
export interface ReplayTimers {
  nowMs(): number;
  setTimer(delayMs: number, callback: () => void): () => void;
}

const REAL_TIMERS: ReplayTimers = {
  nowMs: () => Date.now(),
  setTimer: (delayMs, callback) => {
    const handle = setTimeout(callback, delayMs);
    return () => clearTimeout(handle);
  },
};

/**
 * Replay `EgressClient`: replies are queued per request key; the last reply of a key keeps answering. A request
 * without a reply fails the test through `unmatched`.
 */
export class ReplayEgress implements EgressClient {
  readonly calls: ReplayCall[] = [];
  readonly unmatched: string[] = [];
  readonly #routes = new Map<string, Reply[]>();
  readonly #allowList = new EgressAllowList([PINNED_ORIGIN]);
  readonly #timers: ReplayTimers;
  #fallback: ((key: string) => Reply | undefined) | null = null;

  constructor(timers: ReplayTimers = REAL_TIMERS) {
    this.#timers = timers;
  }

  /** Serves a recorded file (or a reply) for its request key; several calls for one key queue replies. */
  serve(file: string | RecordedResponse, reply: Reply = replyOf(file)): this {
    return this.on(keyOfRecorded(file), reply);
  }

  /** Queues `replies` for a request key. */
  on(key: string, ...replies: Reply[]): this {
    const queue = this.#routes.get(key) ?? [];
    queue.push(...replies);
    this.#routes.set(key, queue);
    return this;
  }

  /** Answers keys without a route (for generated scenarios). */
  fallback(answer: (key: string) => Reply | undefined): this {
    this.#fallback = answer;
    return this;
  }

  /** Calls whose key starts with `prefix`. */
  callsTo(prefix: string): ReplayCall[] {
    return this.calls.filter((call) => call.key.startsWith(prefix));
  }

  async request(url: string, init: EgressRequestInit): Promise<EgressResponse> {
    const target = this.#allowList.check(url);
    const query: Record<string, string> = {};
    for (const [name, value] of target.searchParams) {
      query[name] = value;
    }
    const key = requestKey(init.method, decodeURIComponent(target.pathname), query);
    this.calls.push({
      url,
      key,
      headers: { ...(init.headers ?? {}) },
      timeoutMs: init.timeoutMs,
      maxResponseBytes: init.maxResponseBytes,
      atMs: this.#timers.nowMs(),
    });
    const queue = this.#routes.get(key);
    const reply = queue !== undefined && queue.length > 0 ? (queue.length > 1 ? queue.shift() : queue[0]) : undefined;
    const chosen = reply ?? this.#fallback?.(key);
    if (chosen === undefined) {
      this.unmatched.push(key);
      throw new EgressError('network', 'replay: no recorded response');
    }
    if (chosen.delayMs !== undefined && chosen.delayMs > 0) {
      await new Promise<void>((resolve) => this.#timers.setTimer(chosen.delayMs ?? 0, resolve));
    }
    if (chosen.kind === 'throw') {
      throw chosen.error;
    }
    if (Buffer.byteLength(chosen.text, 'utf8') > init.maxResponseBytes) {
      throw new EgressError('too_large', 'egress response exceeded its size cap');
    }
    return { status: chosen.status, headers: new Headers(chosen.headers), text: chosen.text };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Configuration and adapter context
// ---------------------------------------------------------------------------------------------------------------

export const LIVE_SOURCE_ID = FOOTBALL_DATA_ADAPTER_KIND;

const LANGUAGES: Json = {
  defaultLanguage: 'es',
  languages: [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ],
};

const BRAND: Json = {
  name: 'Synthetic Brand',
  handle: '@SyntheticBrand',
  provisional: true,
  palette: { primary: '#5B2A86', primaryDark: '#2E1145', accent: '#D4AF37', secondary: '#1F4FB8', light: '#FFFFFF' },
  fonts: {
    heading: { family: 'Heading Sans', weight: 800 },
    body: { family: 'Body Sans', weight: 400 },
    numeric: { family: 'Body Sans', weight: 700 },
  },
};

/** Options of the committed example with the PD-12 reference competition. */
export const BASE_OPTIONS: Json = {
  baseUrl: `${PINNED_ORIGIN}/v4`,
  referenceCompetitionRefs: [REFERENCE_CODE],
  requestsPerMinute: 10,
};

/** The live source as a validated configuration entry (configuration rules of T17 applied). */
export function liveSourceConfig(options: Json = BASE_OPTIONS, overrides: Json = {}): SourceConfig {
  const source: Json = {
    id: LIVE_SOURCE_ID,
    name: 'Synthetic live source',
    mode: 'LIVE_DATA',
    role: 'primary',
    accepted: true,
    independenceGroup: LIVE_SOURCE_ID,
    publicationPermission: 'unconfirmed',
    adapter: FOOTBALL_DATA_ADAPTER_KIND,
    options,
    ...overrides,
  };
  const config = buildAppConfig(
    {
      app: { providers: { sports: { sources: [source] }, ai: { adapter: 'stub' } } },
      languages: LANGUAGES,
      brand: BRAND,
    },
    { rootDir: projectRootDir(), environment: { configFile: null, dataDir: null, port: null } },
  );
  const first = config.providers.sports.sources[0];
  if (first === undefined) {
    throw new Error('replay: no source');
  }
  return first;
}

export interface ContextParts {
  readonly egress: EgressClient;
  readonly clock: Clock;
  readonly logger: SportsLogger;
  readonly env?: EnvironmentSource;
  readonly options?: unknown;
  readonly source?: SourceConfig;
}

/** An adapter context for the live source (index 0 of the sources). */
export function adapterContext(parts: ContextParts): AdapterContext {
  const source = parts.source ?? liveSourceConfig();
  return {
    source,
    descriptor: toDescriptor(source),
    setting: 'providers.sports.sources[0]',
    options: (parts.options ?? source.options) as SourceConfig['options'],
    deps: {
      egress: parts.egress,
      env: parts.env ?? {},
      clock: parts.clock,
      db: new Proxy(
        {},
        {
          get(): never {
            throw new Error('the database is not used by this adapter');
          },
        },
      ) as AdapterContext['deps']['db'],
      paths: { rootDir: projectRootDir(), dataDir: join(projectRootDir(), 'data') },
      logger: parts.logger,
    },
  };
}
