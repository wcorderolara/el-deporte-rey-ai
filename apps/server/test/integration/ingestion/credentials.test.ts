/**
 * Credentials and provider failures with the real FootballDataProvider over replayed responses and the synthetic
 * marker token (never a real token): R-248, R-250, R-260, R-262, R-263; T11H-F04, T11H-F14.
 * - the marker travels only in the `X-Auth-Token` header of the replayed requests: never in a URL, a query, another
 *   header, an http-api response, a problem detail, a run failure, a stored row or a captured log line, after success,
 *   access-refused, rate-limit, timeout, refused-connection and validation-failure scenarios;
 * - access refused fails research with `access_refused`, without a retry and without the token;
 * - provider unavailability is retried within the configured bound, then fails research with `unavailable`, and
 *   research can be started again;
 * - the `X-Authenticated-Client` value of the replayed responses (personal data) never leaves the adapter;
 * - no attribution reference in any response is a URL or names the provider host.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import {
  type Json,
  type TestApp,
  expectNoNetworkViolations,
  expectNoProviderCredentials,
  fixtureConfigDocument,
} from '../../support/index.js';

import {
  CLIENT_MARKER,
  LIVE_SOURCE_ID,
  REFERENCE,
  SECOND,
  SECOND_ID,
  type ScriptRule,
  type ScriptedReplay,
  cleanups,
  liveSource,
  on,
  recorded,
  scriptedReplay,
  setLiveOptions,
  startLive,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const SELECTION = {
  competitionId: 'copa-continental',
  sourceId: LIVE_SOURCE_ID,
  seasonId: '2026',
  stageId: 'league-stage',
  matchday: 1,
} as const;
const MD1 = { season: '2026', matchday: '1' } as const;
const MATCHES = `/competitions/${REFERENCE.code}/matches`;
const STANDINGS = `/competitions/${REFERENCE.code}/standings`;
const PROVIDER_HOST = new URL(String((liveSource(fixtureConfigDocument('live'))['options'] as Json)['baseUrl'])).host;

/** Fields a provider request log line may carry (R-133): never a header value, a body or a URL with query values. */
const REQUEST_LOG_FIELDS = new Set([
  'level',
  'time',
  'msg',
  'sourceId',
  'path',
  'params',
  'status',
  'failure',
  'durationMs',
  'cache',
  'remaining',
  'requestsAvailable',
  'counterResetSeconds',
]);

interface ApiRead {
  readonly path: string;
  readonly status: number;
  readonly body: string;
  readonly headers: string;
}

/** Every http-api read of a project and its run, with status, body and headers. */
async function readEverything(t: TestApp, projectId: string, runId: string): Promise<ApiRead[]> {
  const reads: ApiRead[] = [];
  for (const path of [
    '/health',
    '/settings',
    '/catalog/competitions',
    `/catalog/competitions/${SELECTION.competitionId}/sources/${LIVE_SOURCE_ID}/seasons`,
    `/catalog/competitions/${SELECTION.competitionId}/sources/${LIVE_SOURCE_ID}/seasons/2026/stages`,
    `/catalog/competitions/${SECOND_ID}/sources/${LIVE_SOURCE_ID}/seasons`,
    '/projects',
    `/projects/${projectId}`,
    `/projects/${projectId}/runs`,
    `/projects/${projectId}/runs/${runId}`,
    `/projects/${projectId}/runs/${runId}/facts`,
  ]) {
    const response = await t.get(path);
    reads.push({ path, status: response.statusCode, body: response.body, headers: JSON.stringify(response.headers) });
  }
  return reads;
}

const textsOf = (reads: readonly ApiRead[]): string[] => reads.map((read) => `${read.body} ${read.headers}`);

/** Asserts that neither the marker token nor the authenticated-client value appears anywhere observable. */
function expectNothingLeaked(t: TestApp, egress: ScriptedReplay, extra: readonly string[]): void {
  const observable = [t.log.text(), t.databaseText(), ...extra].join('\n');
  expect(observable).not.toContain(TEST_MARKER_TOKEN);
  expect(observable).not.toContain(CLIENT_MARKER);
  // Provider request log lines carry only the documented fields: the header is absent, never logged (R-263).
  const lines = t.log.lines().filter((line) => line['msg'] === 'source request');
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(
      Object.keys(line).filter((key) => !REQUEST_LOG_FIELDS.has(key)),
      JSON.stringify(line),
    ).toEqual([]);
  }
  expect(t.log.text()).not.toMatch(/x-auth-token|authenticated-client/i);
  // Every replayed request carried the marker in X-Auth-Token and nowhere else (R-260).
  expect(egress.calls.length).toBeGreaterThan(0);
  for (const call of egress.calls) {
    expect(call.headers['x-auth-token'], call.url).toBe(TEST_MARKER_TOKEN);
    expect(Object.keys(call.headers).sort()).toEqual(['accept', 'x-auth-token']);
    expect(call.url).not.toContain(TEST_MARKER_TOKEN);
    expect(Object.values(call.query).join(' ')).not.toContain(TEST_MARKER_TOKEN);
    expect(Object.keys(call.query).filter((key) => /token|key|auth|secret/i.test(key))).toEqual([]);
    expect(new URL(call.url).username).toBe('');
  }
  expect(process.env['FOOTBALL_DATA_API_TOKEN']).toBeUndefined();
  expectNoNetworkViolations();
}

interface Scenario {
  readonly t: TestApp;
  readonly egress: ScriptedReplay;
  readonly projectId: string;
  readonly runId: string;
  readonly run: Awaited<ReturnType<TestApp['runWorkflow']>>;
  readonly reads: ApiRead[];
  readonly texts: string[];
}

/** Starts the LIVE-shaped app, creates the reference project, applies `rules` and runs the workflow once. */
async function scenario(rules: readonly ScriptRule[], options: Json = {}): Promise<Scenario> {
  const egress = scriptedReplay();
  const t = await startLive(cleanup, egress, {
    mutate: (document) => setLiveOptions(document, { backoffMs: 100, ...options }),
  });
  const project = await t.createProject(SELECTION);
  for (const rule of rules) {
    egress.use(rule);
  }
  const run = await t.runWorkflow(project.id);
  const reads = await readEverything(t, project.id, run.id);
  const texts = [JSON.stringify(run), ...textsOf(reads)];
  return { t, egress, projectId: project.id, runId: run.id, run, reads, texts };
}

const callsTo = (egress: ScriptedReplay, path: string): number =>
  egress.calls.filter((call) => call.pathname.endsWith(path) && call.query['matchday'] === '1').length;

// ---------------------------------------------------------------------------------------------------------------
// R-260, R-262, R-263, T11H-F04, T11H-F14: success
// ---------------------------------------------------------------------------------------------------------------

describe('the marker token on success (R-260, R-262, R-263, T11H-F04, T11H-F14)', () => {
  it('goes only into the X-Auth-Token header; responses, rows and logs never carry it or the client value', async () => {
    expectNoProviderCredentials();
    const { t, egress, run, reads, texts } = await scenario([]);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    // Problem responses carry neither: an unknown ID, an unavailable selection, a refused write.
    const problems = [
      await t.get(`/catalog/competitions/${LIVE_SOURCE_ID}-zz9/sources/${LIVE_SOURCE_ID}/seasons`),
      await t.send('POST', '/projects', { ...SELECTION, seasonId: '2024' }),
      await t.send('POST', '/projects', { ...SELECTION, matchday: 'uno' }),
    ];
    expect(problems.map((response) => response.statusCode)).toEqual([404, 409, 400]);
    texts.push(...problems.map((response) => `${response.body} ${JSON.stringify(response.headers)}`));
    expectNothingLeaked(t, egress, texts);
    expect(egress.unmatched).toEqual([]);
    // The settings view shows sources without options, base URLs or credentials.
    const settings = reads.find((read) => read.path === '/settings');
    expect(settings?.body).not.toMatch(/baseUrl|https?:\/\/|token/i);
  });

  it('gives no attribution reference that is a URL or names the provider host (T11H-F14)', async () => {
    const { t, reads, texts } = await scenario([]);
    const references: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          if ((key === 'sourceRef' || key === 'ref') && typeof entry === 'string') {
            references.push(entry);
          }
          walk(entry);
        }
      }
    };
    for (const read of reads) {
      expect(read.status, read.path).toBe(200);
      walk(JSON.parse(read.body) as unknown);
    }
    expect(references.length).toBeGreaterThan(100);
    for (const reference of references) {
      expect(reference).not.toMatch(/^[a-z][a-z0-9+.-]*:\/\//i);
      expect(reference).not.toContain(PROVIDER_HOST);
      expect(reference).toMatch(/^(source|fixture|import):/);
    }
    expect(texts.join('\n')).not.toContain(PROVIDER_HOST);
    expect(t.databaseText()).not.toContain(PROVIDER_HOST);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-248: access refused
// ---------------------------------------------------------------------------------------------------------------

describe('access refused (R-248)', () => {
  it.each([
    ['403 without an authenticated client', recorded('error-403-anonymous.json')],
    ['401', { ...recorded('error-403-anonymous.json'), status: 401 }],
  ])('%s: research fails as provider access refused, without retry or token', async (_name, response) => {
    const answer = { status: response.status, headers: response.headers, text: response.text };
    const { t, egress, run, texts } = await scenario([on(MATCHES, MD1, answer)]);
    expect(run.status).toBe('failed');
    expect(run.failure).toEqual({
      code: 'access_refused',
      sourceId: LIVE_SOURCE_ID,
      path: null,
      httpStatus: response.status,
    });
    expect(run.stages.map((stage) => stage.status)).toEqual(['failed', 'skipped', 'skipped', 'skipped', 'skipped']);
    expect(callsTo(egress, '/matches')).toBe(1);
    expect(callsTo(egress, '/standings')).toBe(0);
    expectNothingLeaked(t, egress, texts);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-250: provider unavailable
// ---------------------------------------------------------------------------------------------------------------

describe('provider unavailability (R-250)', () => {
  it.each([
    ['server errors (500)', 'error-500.json' as const],
    ['a refused connection', { failure: 'network' } as const],
  ])(
    '%s: retried up to maxRetries, research fails as unavailable, and research can start again',
    async (_name, failure) => {
      let failing = true;
      const rule = on(STANDINGS, MD1, () => (failing ? failure : undefined));
      const { t, egress, projectId, run, texts } = await scenario([rule], { maxRetries: 2 });
      expect(run.status).toBe('failed');
      expect(run.failure).toMatchObject({ code: 'unavailable', sourceId: LIVE_SOURCE_ID });
      expect(callsTo(egress, '/standings')).toBe(3);
      expectNothingLeaked(t, egress, texts);

      failing = false;
      const again = await t.runWorkflow(projectId);
      expect(again.status, JSON.stringify(again.failure)).toBe('completed');
      expect(again.runNumber).toBe(run.runNumber + 1);
      expect(callsTo(egress, '/standings')).toBe(4);
    },
  );

  it('a timeout is retried within the bound and reported as a timeout', async () => {
    const { t, egress, run, texts } = await scenario([on(MATCHES, MD1, { failure: 'timeout' })], { maxRetries: 1 });
    expect(run.status).toBe('failed');
    expect(run.failure).toMatchObject({ code: 'timeout', sourceId: LIVE_SOURCE_ID });
    expect(callsTo(egress, '/matches')).toBe(2);
    expectNothingLeaked(t, egress, texts);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-263: rate limit and validation failure
// ---------------------------------------------------------------------------------------------------------------

describe('rate limit and validation failure leave no marker (R-263)', () => {
  it('a 429 beyond the allowed wait fails research as rate limited; discovery answers 503 with the wait', async () => {
    const { t, egress, run, texts } = await scenario([on(MATCHES, MD1, 'error-429.json')], {
      maxRateLimitWaitSeconds: 1,
    });
    expect(run.status).toBe('failed');
    expect(run.failure).toMatchObject({ code: 'rate_limited', sourceId: LIVE_SOURCE_ID, httpStatus: 429 });
    expect(callsTo(egress, '/matches')).toBe(1);
    // The 429 blocks the source until its counter reset: discovery is refused at once with the wait, no request.
    const before = egress.calls.length;
    const seasons = await t.get(`/catalog/competitions/${SECOND_ID}/sources/${LIVE_SOURCE_ID}/seasons`);
    expect(seasons.statusCode).toBe(503);
    expect(seasons.json()).toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect((seasons.json() as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(30);
    expect(egress.calls.length).toBe(before);
    expect(egress.calls.some((call) => call.pathname.endsWith(`/${SECOND.code}`))).toBe(false);
    expectNothingLeaked(t, egress, [...texts, seasons.body]);
  });

  it.each([
    ['a body that is not JSON', 'invalid-non-json.json', null],
    ['a score of the wrong type', 'invalid-wrong-type.json', '/matches/1/score/fullTime/home'],
    ['an unknown match status', 'invalid-unknown-status.json', '/matches/0/status'],
  ])('%s fails research as invalid, without retry, data or marker', async (_name, file, path) => {
    const { t, egress, run, texts } = await scenario([on(MATCHES, MD1, file)]);
    expect(run.status).toBe('failed');
    expect(run.failure).toMatchObject({ code: 'invalid', sourceId: LIVE_SOURCE_ID });
    if (path !== null) {
      expect(run.failure?.path).toBe(path);
    }
    expect(callsTo(egress, '/matches')).toBe(1);
    const count = (
      t.container.db.prepare<{ n: number }>('SELECT count(*) AS n FROM observations').get() as { n: number }
    ).n;
    expect(count).toBe(0);
    expectNothingLeaked(t, egress, texts);
  });
});
