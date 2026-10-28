/**
 * Support of the T52 ingestion suites (data modes, catalogue, manual import, credentials). It builds on the T41 test
 * support (read only) and adds:
 * - a scripted replay transport: an `EgressClient` over the recorded provider responses of `fixtures/` (found by
 *   shape, so no provider name is written here) whose answers a test can override per request, with an in-memory
 *   log of every request including its header values, so a test can assert where the synthetic marker token went;
 * - the LIVE-shaped configurations of `fixtures/config/` and the committed `config/live.config.json`, with the
 *   synthetic marker token as the only credential (never a real token);
 * - helpers for the manual import routes with the T23 samples of `fixtures/manual/`;
 * - a test app on a temporary project root, for the identity maps of AD-38 that the verification stage reads from
 *   `<root>/config/team-identities/` (the T41 factory always uses the repository root).
 *
 * Provider identifiers (codes, IDs, source IDs, hosts) are read from the fixture and configuration files, never
 * written here (AD-31). All data is synthetic; every directory is temporary and removed by its owner.
 */
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type ImportSummary,
  ImportSummarySchema,
  type Problem,
  ProblemSchema,
  type SelectionSnapshot,
  SelectionSnapshotSchema,
} from '@edr/contracts';
import { expect } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import type { ProviderFactories } from '../../../src/container.js';
import { startServer } from '../../../src/main.js';
import { createProjectsModule } from '../../../src/modules/projects/index.js';
import { serverModules } from '../../../src/modules/registry.js';
import {
  type EgressClient,
  EgressError,
  type EgressRequestInit,
  type EgressResponse,
} from '../../../src/platform/net/index.js';
import { createAiProvider } from '../../../src/providers/ai/index.js';
import { createSportsSources } from '../../../src/providers/sports/index.js';
import {
  API,
  FIXTURES_DIR,
  type Json,
  REPO_ROOT,
  type ProjectSelection,
  type ReplayResponse,
  TOKEN_VARIABLE,
  type TestApp,
  type TestAppOptions,
  captureLog,
  fixtureConfigDocument,
  freePort,
  generateConfigDocument,
  providerResponsesDirectory,
  readJson,
  readReplayResponses,
  recordingEgress,
  sourcesOf,
  startTestApp,
  temporaryDirectory,
  testLiveAdapter,
  workflowStages,
  writeConfig,
} from '../../support/index.js';

// ---------------------------------------------------------------------------------------------------------------
// Provider identifiers from the fixture files
// ---------------------------------------------------------------------------------------------------------------

export interface RecordedCompetition {
  readonly code: string;
  readonly id: number;
  readonly localKey: string;
  readonly name: string;
  readonly area: string;
}

const responsesManifest = readJson<Json>(join(providerResponsesDirectory(), '_manifest.json'));

/** The reference-shaped competition of the recorded responses (its code, ID, local key and name). */
export const REFERENCE = responsesManifest['referenceCompetition'] as RecordedCompetition;
/** The second, league-shaped competition of the recorded responses. */
export const SECOND = responsesManifest['secondCompetition'] as RecordedCompetition;
/** The synthetic `X-Authenticated-Client` value of the recorded responses (personal data, T11H-F04). */
export const CLIENT_MARKER = String((responsesManifest['markers'] as Json)['authenticatedClient']);
/** Path prefix of every recorded request (the API version segment), read from the recorded competition list. */
export const API_PREFIX = String(
  readReplayResponses()
    .find((response) => response.request.path.endsWith('/competitions'))
    ?.request.path.replace(/\/competitions$/, ''),
);

/** The provider-backed LIVE_DATA source of a configuration document (not the `test-live` double). */
export function liveSource(document: Json): Json {
  const source = sourcesOf(document).find(
    (entry) => entry['mode'] === 'LIVE_DATA' && entry['adapter'] !== testLiveAdapter.kind,
  );
  if (source === undefined) {
    throw new Error('the configuration has no provider-backed LIVE_DATA source');
  }
  return source;
}

/** The ID of the provider-backed LIVE_DATA source of `fixtures/config/live.config.json`. */
export const LIVE_SOURCE_ID = String(liveSource(fixtureConfigDocument('live'))['id']);
/** The process environment of a LIVE-shaped test app: the synthetic marker token only. */
export const LIVE_ENV: Readonly<Record<string, string>> = Object.freeze({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN });
/** The catalogue ID of an unlinked competition of the live source (`<sourceId>-<localKey>`). */
export const SECOND_ID = `${LIVE_SOURCE_ID}-${SECOND.localKey}`;

/** Sets options of the provider-backed LIVE_DATA source of a document. */
export function setLiveOptions(document: Json, options: Json): void {
  const source = liveSource(document);
  source['options'] = { ...(source['options'] as Json), ...options };
}

// ---------------------------------------------------------------------------------------------------------------
// Scripted replay transport
// ---------------------------------------------------------------------------------------------------------------

/** A response a test supplies instead of a recorded one. */
export interface ScriptedAnswer {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly text: string;
}

/** One request seen by the scripted transport (kept in memory only; header values included for the token checks). */
export interface ScriptedCall {
  readonly method: string;
  readonly url: string;
  readonly pathname: string;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  /** `Date.now()` when the request reached the transport. */
  readonly at: number;
  readonly status: number;
}

export interface ScriptedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly query: Readonly<Record<string, string>>;
  /** Number of earlier requests with the same method, path and query. */
  readonly attempt: number;
}

/** A transport failure instead of a response (a timeout or a refused connection, as the egress client reports it). */
export interface ScriptedFailure {
  readonly failure: 'timeout' | 'network';
}

/**
 * A rule answers a request with a recorded response (file name), a scripted answer, a transport failure, or
 * `undefined` to fall back.
 */
export type ScriptRule = (request: ScriptedRequest) => ScriptedAnswer | ScriptedFailure | string | undefined;

export interface ScriptedReplay extends EgressClient {
  readonly calls: readonly ScriptedCall[];
  /** Calls whose request matched no recorded response and no rule (answered 404). */
  readonly unmatched: readonly ScriptedCall[];
  /** Adds a rule, checked before the earlier rules and before the recorded responses. */
  use(rule: ScriptRule): void;
}

const ALL_RESPONSES = readReplayResponses();

/** A recorded response by file name. */
export function recorded(file: string): ReplayResponse {
  const response = ALL_RESPONSES.find((entry) => entry.file === file);
  if (response === undefined) {
    throw new Error(`no recorded response ${file}`);
  }
  return response;
}

/** The parsed body of a recorded response (deep copy). */
export function recordedBody(file: string): Json {
  return JSON.parse(recorded(file).text) as Json;
}

/** A scripted answer with a recorded response's status and headers and the given JSON body. */
export function answerWithBody(file: string, body: unknown): ScriptedAnswer {
  const response = recorded(file);
  return { status: response.status, headers: response.headers, text: JSON.stringify(body) };
}

/** The successful recorded responses served by default (one per request; reduced variants left out). */
function defaultResponses(): ReplayResponse[] {
  return ALL_RESPONSES.filter(
    (response) =>
      response.expect === 'ok' && !/(missing-optional|no-total|requests-available-zero)/.test(response.file),
  );
}

function queryOf(url: URL): Record<string, string> {
  return Object.fromEntries([...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function sameQuery(actual: Readonly<Record<string, string>>, expected: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(actual);
  return keys.length === Object.keys(expected).length && keys.every((key) => actual[key] === expected[key]);
}

/** Lower-cased header map of a request (values kept, in memory only). */
function headerMap(init: EgressRequestInit): Record<string, string> {
  return Object.fromEntries(Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
}

/**
 * A replay transport whose answers a test can script. Without rules it serves the default recorded responses (method,
 * path and query must match) and 404 otherwise; it never opens a connection.
 */
export function scriptedReplay(rules: readonly ScriptRule[] = []): ScriptedReplay {
  const served = defaultResponses();
  const active: ScriptRule[] = [...rules];
  const calls: ScriptedCall[] = [];
  const unmatched: ScriptedCall[] = [];
  return {
    calls,
    unmatched,
    use: (rule) => {
      active.unshift(rule);
    },
    request: async (url: string, init: EgressRequestInit): Promise<EgressResponse> => {
      await Promise.resolve();
      const parsed = new URL(url);
      const query = queryOf(parsed);
      const attempt = calls.filter(
        (call) => call.method === init.method && call.pathname === parsed.pathname && sameQuery(call.query, query),
      ).length;
      const request: ScriptedRequest = { method: init.method, pathname: parsed.pathname, query, attempt };
      let answer: ScriptedAnswer | undefined;
      for (const rule of active) {
        const result = rule(request);
        if (result === undefined) {
          continue;
        }
        if (typeof result === 'object' && 'failure' in result) {
          calls.push({
            method: init.method,
            url,
            pathname: parsed.pathname,
            query,
            headers: headerMap(init),
            at: Date.now(),
            status: 0,
          });
          throw new EgressError(
            result.failure,
            result.failure === 'timeout' ? 'request timed out' : 'connection failed',
          );
        }
        answer = typeof result === 'string' ? recorded(result) : result;
        break;
      }
      if (answer === undefined) {
        const match = served.find(
          (entry) =>
            entry.request.method === init.method &&
            entry.request.path === parsed.pathname &&
            sameQuery(query, entry.request.query),
        );
        if (match !== undefined) {
          answer = match;
        }
      }
      const status = answer?.status ?? 404;
      const call: ScriptedCall = {
        method: init.method,
        url,
        pathname: parsed.pathname,
        query,
        headers: headerMap(init),
        at: Date.now(),
        status,
      };
      calls.push(call);
      if (answer === undefined) {
        unmatched.push(call);
        return {
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: '{"message":"not found"}',
        };
      }
      return {
        status,
        headers: new Headers({ 'content-type': 'application/json', ...answer.headers }),
        text: 'text' in answer ? answer.text : '',
      };
    },
  };
}

/** A rule for one request path (and query, when given) of the reference or second competition. */
export function on(
  path: string,
  query: Readonly<Record<string, string>> | null,
  answer:
    | ScriptedAnswer
    | ScriptedFailure
    | string
    | ((request: ScriptedRequest) => ScriptedAnswer | ScriptedFailure | string | undefined),
): ScriptRule {
  const pathname = `${API_PREFIX}${path}`;
  return (request) => {
    if (request.pathname !== pathname || (query !== null && !sameQuery(request.query, query))) {
      return undefined;
    }
    return typeof answer === 'function' ? answer(request) : answer;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Test apps
// ---------------------------------------------------------------------------------------------------------------

export interface Cleanup {
  add(cleanup: () => Promise<void> | void): void;
  run(): Promise<void>;
}

/** Collects cleanups and runs them in reverse order (call `run` in `afterEach`). */
export function cleanups(): Cleanup {
  const list: (() => Promise<void> | void)[] = [];
  return {
    add: (cleanup) => {
      list.push(cleanup);
    },
    run: async () => {
      for (const cleanup of list.splice(0).reverse()) {
        await cleanup();
      }
    },
  };
}

/** Starts a test app and registers its `close` with the cleanup list. */
export async function start(cleanup: Cleanup, options: TestAppOptions): Promise<TestApp> {
  const app = await startTestApp(options);
  cleanup.add(() => app.close());
  return app;
}

/** The committed `config/live.config.json` (DEMO_DATA, MANUAL_DATA and LIVE_DATA sources), as a document. */
export function committedLiveDocument(): Json {
  return readJson<Json>(join(REPO_ROOT, 'config', 'live.config.json'));
}

/** Starts the LIVE-shaped configuration of `fixtures/config/live.config.json` over a scripted replay transport. */
export async function startLive(
  cleanup: Cleanup,
  egress: ScriptedReplay,
  options: Omit<TestAppOptions, 'egress' | 'env'> & { readonly env?: Readonly<Record<string, string>> } = {},
): Promise<TestApp> {
  return start(cleanup, { base: 'live', ...options, egress, env: { ...LIVE_ENV, ...options.env } });
}

/** The error of a startup that must fail (the app is closed when it starts anyway). */
export async function startupError(options: TestAppOptions): Promise<unknown> {
  return startTestApp(options).then(
    async (app) => {
      await app.close();
      return null;
    },
    (caught: unknown) => caught,
  );
}

/** Text of an error and its `issues` (configuration errors list their issues). */
export function errorText(error: unknown): string {
  if (error === null || error === undefined) {
    return '';
  }
  const issues = (error as { issues?: unknown }).issues;
  return `${String(error)} ${issues === undefined ? '' : JSON.stringify(issues)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Test app on a temporary project root (identity maps, AD-38)
// ---------------------------------------------------------------------------------------------------------------

export interface RootedApp {
  readonly root: string;
  readonly app: TestApp['app'];
  readonly container: TestApp['container'];
  readonly log: TestApp['log'];
  get: TestApp['get'];
  send: TestApp['send'];
  close(): Promise<void>;
}

/**
 * Starts the real server on a temporary project root: `config/languages.json` and `config/brand.json` are copied
 * from the repository (the brand uses the bundled font roles, OD-54), `fixtures/` is linked read only, the given
 * configuration, catalogue and identity maps are written by the test. Stages are the registered ones (placeholders
 * for the stages no module registers yet).
 */
export async function startRootedApp(options: {
  readonly document: Json;
  readonly catalogue?: Json;
  readonly identityMaps?: readonly Json[];
}): Promise<RootedApp> {
  const dir = temporaryDirectory('rooted');
  try {
    const root = dir.path;
    mkdirSync(join(root, 'config', 'team-identities'), { recursive: true });
    cpSync(join(REPO_ROOT, 'config', 'languages.json'), join(root, 'config', 'languages.json'));
    cpSync(join(REPO_ROOT, 'config', 'brand.json'), join(root, 'config', 'brand.json'));
    symlinkSync(FIXTURES_DIR, join(root, 'fixtures'), 'dir');
    for (const map of options.identityMaps ?? []) {
      const file = `${String(map['competitionId'])}-${String(map['seasonId'])}.json`;
      writeFileSync(join(root, 'config', 'team-identities', file), JSON.stringify(map), 'utf8');
    }
    const port = await freePort();
    const document = generateConfigDocument({
      base: options.document,
      server: { port },
      mutate: (doc) => {
        if (options.catalogue === undefined) {
          delete doc['catalogue'];
        } else {
          writeFileSync(join(root, 'config', 'catalogue.json'), JSON.stringify(options.catalogue), 'utf8');
          doc['catalogue'] = { linksFile: 'config/catalogue.json' };
        }
        delete doc['languagesFile'];
        delete doc['brandFile'];
      },
    });
    const written = writeConfig(join(root, 'config'), document, join(root, 'data'));
    const log = captureLog('debug');
    const providers: ProviderFactories = {
      createSportsSources: (config, deps) =>
        createSportsSources(config, { ...deps, egress: recordingEgress(deps.egress) }, {}),
      createAiProvider: (config, deps) => createAiProvider(config, deps),
    };
    const stages = workflowStages(serverModules);
    const projects = createProjectsModule({ stages: stages.provider });
    const modules = serverModules.map((entry) => (entry.name === 'projects' ? projects : entry));
    const server = await startServer({
      rootDir: root,
      env: written.env,
      providers,
      modules,
      logger: log.logger,
      webRoot: null,
    });
    const host = `127.0.0.1:${String(port)}`;
    const origin = `http://${host}`;
    const { app, container } = server;
    const get: TestApp['get'] = (path, headers = { host }) =>
      app.inject({ method: 'GET', url: `${API}${path}`, headers });
    const send: TestApp['send'] = (method, path, body) =>
      app.inject({
        method,
        url: `${API}${path}`,
        headers:
          body === undefined
            ? { host, origin, 'x-edr-client': 'web' }
            : { host, origin, 'x-edr-client': 'web', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    return {
      root,
      app,
      container,
      log,
      get,
      send,
      close: async () => {
        try {
          await server.close();
        } finally {
          dir.remove();
        }
      },
    };
  } catch (error) {
    dir.remove();
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Manual imports
// ---------------------------------------------------------------------------------------------------------------

export const MANUAL_FIXTURES_DIR = join(FIXTURES_DIR, 'manual');

export interface ManualSample {
  readonly file: string;
  readonly channel: 'json_file' | 'csv_file' | 'form';
  readonly valid: boolean;
  readonly problem?: string;
  readonly record?: string;
  readonly field?: string;
  readonly precondition?: string;
  readonly equivalence?: boolean;
  readonly layout?: string;
}

/** The samples of `fixtures/manual/_manifest.json`. */
export function manualSamples(): ManualSample[] {
  return readJson<{ samples: ManualSample[] }>(join(MANUAL_FIXTURES_DIR, '_manifest.json')).samples;
}

/** The raw bytes of a manual sample. */
export function manualBytes(file: string): Buffer {
  return readFileSync(join(MANUAL_FIXTURES_DIR, file));
}

/** The import request body of a manual sample: a file envelope with the exact bytes, or the form body as stored. */
export function sampleRequest(
  sample: Pick<ManualSample, 'file' | 'channel'>,
  declaredSource: string | null = null,
): Json {
  if (sample.channel === 'form') {
    const body = JSON.parse(manualBytes(sample.file).toString('utf8')) as Json;
    return declaredSource === null ? body : { ...body, declaredSource };
  }
  const name = sample.file.split('/').pop() ?? 'import';
  return {
    channel: sample.channel,
    fileName: name,
    declaredSource: declaredSource ?? 'Synthetic declared source',
    contentBase64: manualBytes(sample.file).toString('base64'),
  };
}

/** A JSON-file import request of a document. */
export function jsonImport(document: unknown, fileName = 'import.json', declaredSource = 'Synthetic record'): Json {
  return {
    channel: 'json_file',
    fileName,
    declaredSource,
    contentBase64: Buffer.from(JSON.stringify(document), 'utf8').toString('base64'),
  };
}

/** Posts an import; the response with its status. */
export async function postImport(t: Pick<TestApp, 'send'>, body: unknown) {
  return t.send('POST', '/imports', body);
}

/** Posts an import that must be applied; returns the summary. */
export async function importApplied(t: Pick<TestApp, 'send'>, body: unknown): Promise<ImportSummary> {
  const response = await postImport(t, body);
  expect(response.statusCode, response.body).toBe(201);
  return ImportSummarySchema.parse(response.json());
}

/** Posts an import that must be rejected; returns the problem. */
export async function importRejected(t: Pick<TestApp, 'send'>, body: unknown): Promise<Problem> {
  const response = await postImport(t, body);
  expect(response.statusCode, response.body).toBe(400);
  const problem = ProblemSchema.parse(response.json());
  expect(problem.code).toBe('IMPORT_REJECTED');
  return problem;
}

/** Row counts of the import tables (absence checks after a rejection). */
export function importCounts(t: Pick<TestApp, 'container'>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const table of ['imports', 'manual_selection_versions', 'manual_competitions', 'manual_seasons']) {
    const exists = t.container.db
      .prepare<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get([table]) as { n: number };
    if (exists.n === 0) {
      continue;
    }
    result[table] = (
      t.container.db.prepare<{ n: number }>('SELECT count(*) AS n FROM "' + table + '"').get() as {
        n: number;
      }
    ).n;
  }
  return result;
}

/** The manual source of `fixtures/config/demo-manual.config.json` (to add MANUAL_DATA to another document). */
export function manualSourceEntry(): Json {
  const source = sourcesOf(fixtureConfigDocument('demo-manual')).find((entry) => entry['mode'] === 'MANUAL_DATA');
  if (source === undefined) {
    throw new Error('no MANUAL_DATA source in demo-manual');
  }
  return structuredClone(source);
}

// ---------------------------------------------------------------------------------------------------------------
// Snapshots through the ingestion port
// ---------------------------------------------------------------------------------------------------------------

/**
 * The domain snapshot of a selection as research gets it: resolved through the catalogue service like a project, then
 * fetched from the chosen source through the ingestion port, and parsed with the one shared runtime schema (R-267).
 */
export async function snapshotFor(
  t: Pick<TestApp, 'container'>,
  selection: ProjectSelection,
): Promise<SelectionSnapshot> {
  const discovery = { signal: new AbortController().signal, purpose: 'discovery' as const };
  const resolution = await t.container.sources.catalogue.resolveSelection(selection, discovery);
  if (!resolution.ok) {
    throw new Error(`selection not resolved: ${resolution.reason}`);
  }
  const source = t.container.sources.get(selection.sourceId);
  if (source === undefined) {
    throw new Error('source not configured');
  }
  const snapshot = await source.fetchSelection(resolution.selection.selectionRef, {
    signal: new AbortController().signal,
    purpose: 'research',
  });
  return SelectionSnapshotSchema.parse(snapshot);
}
