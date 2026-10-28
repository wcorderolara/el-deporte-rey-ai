/**
 * FootballDataProvider: status classification, retries, timeouts, rate limits and the `X-Authenticated-Client`
 * handling, against recorded-shape synthetic responses through a replay transport on a virtual clock
 * (contracts/provider-ports.md section 1.4 "Error classification" and "Request budget"; R-248 to R-251, R-253,
 * R-286; T11H-F04, T11H-F05). No socket is opened.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import { EgressError } from '../../../../platform/net/index.js';
import {
  SourceError,
  type SourceRef,
  availabilityReasonOf,
  createCatalogueService,
  createSourceRegistry,
} from '../../ingestion/index.js';
import { CatalogueConfig } from '../../../../platform/config/index.js';
import { CapturingLogger } from '../../test/synthetic.js';
import { VirtualClock } from '../../support/test/virtual-clock.js';

import { footballDataRegistration } from './provider.js';
import {
  HARNESS_START,
  type Harness,
  discoveryCtx,
  harness,
  refOf,
  researchCtx,
  walkReference,
} from './test/harness.js';
import { ReplayEgress, keyOfRecorded, liveSourceConfig, recorded, replyOf, throwReply } from './test/replay.js';

const CLIENT_MARKER = 'edr-test-client-marker-0000';
const MD1 = 'GET /v4/competitions/CL/matches?matchday=1&season=2026';
const STANDINGS_MD1 = 'GET /v4/competitions/CL/standings?matchday=1&season=2026';

async function failureOf(promise: Promise<unknown>): Promise<SourceError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(SourceError);
    return error as SourceError;
  }
  throw new Error('expected a SourceError');
}

/** Everything a failure could leak through: logs, the error, its serialization, the cache. */
function outputsOf(h: Harness, failure: SourceError | null): string {
  return JSON.stringify([
    h.logger.lines,
    failure === null ? null : [failure.message, failure.toJSON(), String(failure), failure.stack ?? ''],
    h.source.cacheEntries(),
  ]);
}

async function md1Ref(h: Harness): Promise<SourceRef> {
  const { stages } = await walkReference(h);
  return refOf(stages.items[0]?.matchdays[0]?.ref);
}

describe('authentication failures (R-248)', () => {
  it.each([
    ['401', replyOf('error-403-anonymous.json', { status: 401 })],
    ['403 without X-Authenticated-Client', replyOf('error-403-anonymous.json')],
  ])('%s is provider access refused, never retried, with no token in reason or logs', async (_label, reply) => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    const before = h.egress.calls.length;
    h.egress.on(MD1, reply);
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('access_refused');
    expect(failure.message).toBe('provider access refused');
    expect(availabilityReasonOf(failure)).toBe('access_refused');
    expect(h.egress.calls.length - before).toBe(1);
    expect(outputsOf(h, failure)).not.toContain(TEST_MARKER_TOKEN);
  });

  it('treats a 403 with an empty X-Authenticated-Client as access refused', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on(
      'GET /v4/competitions',
      replyOf('error-403-authenticated.json', { headers: { 'X-Authenticated-Client': ' ' } }),
    );
    const failure = await failureOf(h.clock.run(h.source.listCompetitions(discoveryCtx())));
    expect(failure.code).toBe('access_refused');
  });
});

describe('unavailable competitions and seasons (R-253, R-286)', () => {
  it('maps 403 with a positive X-Authenticated-Client to not available with the subscription, no retry', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json').on('GET /v4/competitions/TL1', replyOf('error-403-authenticated.json'));
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const tl1 = competitions.items.find((item) => item.localKey === 'tl1');
    const failure = await failureOf(h.clock.run(h.source.listSeasons(refOf(tl1?.ref), discoveryCtx())));
    expect(failure).toMatchObject({ code: 'not_available', httpStatus: 403 });
    expect(availabilityReasonOf(failure)).toBe('subscription_restricted');
    expect(h.egress.callsTo('GET /v4/competitions/TL1')).toHaveLength(1);
  });

  it('maps 404 to not available (not found), no retry', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json').on('GET /v4/competitions/TL1', replyOf('error-404.json'));
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const tl1 = competitions.items.find((item) => item.localKey === 'tl1');
    const failure = await failureOf(h.clock.run(h.source.listSeasons(refOf(tl1?.ref), discoveryCtx())));
    expect(failure).toMatchObject({ code: 'not_available', httpStatus: 404 });
    expect(availabilityReasonOf(failure)).toBe('not_found');
    expect(h.egress.callsTo('GET /v4/competitions/TL1')).toHaveLength(1);
  });

  it('maps 400 to bad request, never retried', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    h.egress.on(MD1, replyOf('error-400.json'));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure).toMatchObject({ code: 'bad_request', httpStatus: 400 });
    expect(h.egress.callsTo(MD1)).toHaveLength(1);
  });

  it('shows a 403 competition as unavailable with a reason in the catalogue; other competitions stay usable', async () => {
    const clock = new VirtualClock(HARNESS_START);
    const egress = new ReplayEgress(clock);
    egress
      .serve('competitions.json')
      .serve('competition-cl.json')
      .on('GET /v4/competitions/TL1', replyOf('error-403-authenticated.json'));
    const source = liveSourceConfig();
    const registry = createSourceRegistry(
      { providers: { sports: { sources: [source] } }, catalogue: CatalogueConfig.empty() },
      {
        egress,
        env: { FOOTBALL_DATA_API_TOKEN: TEST_MARKER_TOKEN },
        clock,
        db: {} as never,
        paths: { rootDir: '/srv/edr-test-root', dataDir: '/srv/edr-test-root/data' },
        logger: new CapturingLogger(),
      },
      [footballDataRegistration()],
    );
    registry.validateStartup();
    const catalogue = createCatalogueService(registry, CatalogueConfig.empty());
    const listed = await clock.run(catalogue.listCatalogue(discoveryCtx()));
    expect(listed.competitions.map((item) => item.id)).toEqual(['football-data-cl', 'football-data-tl1']);
    const restricted = await clock.run(catalogue.listSeasons('football-data-tl1', 'football-data', discoveryCtx()));
    expect(JSON.stringify(restricted)).toContain('subscription_restricted');
    const usable = await clock.run(catalogue.listSeasons('football-data-cl', 'football-data', discoveryCtx()));
    expect(JSON.stringify(usable)).toContain('2026/27');
    const unknown = await clock.run(catalogue.listStages('football-data-cl', 'football-data', '1999', discoveryCtx()));
    expect(unknown).toEqual({ found: false });
    expect(egress.calls.map((call) => call.key)).toEqual([
      'GET /v4/competitions',
      'GET /v4/competitions/TL1',
      'GET /v4/competitions/CL',
    ]);
  });
});

describe('rate limits (R-249)', () => {
  it('sends no request before the reset after X-RequestsAvailable 0', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('requests-available-zero.json').serve('competition-cl.json');
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const start = h.clock.nowMs();
    const seasons = await h.clock.run(h.source.listSeasons(refOf(competitions.items[0]?.ref), researchCtx()));
    expect(seasons.items).toHaveLength(2);
    const [first, second] = h.egress.calls;
    expect((second?.atMs ?? 0) - (first?.atMs ?? 0)).toBeGreaterThanOrEqual(23_000);
    expect((second?.atMs ?? 0) - start).toBe(23_000);
    // The counters are recorded in the request log line (never another header value).
    expect(h.logger.lines.find((line) => line.message === 'source request')?.fields).toMatchObject({
      requestsAvailable: 0,
      counterResetSeconds: 23,
      path: '/competitions',
      params: [],
      status: 200,
    });
  });

  it('a discovery request during the reset wait fails at once with the wait', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('requests-available-zero.json');
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const failure = await failureOf(
      h.clock.run(h.source.listSeasons(refOf(competitions.items[0]?.ref), discoveryCtx())),
    );
    expect(failure).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 23 });
    expect(h.egress.calls).toHaveLength(1);
  });

  it('waits for the counter reset after a 429 and retries research once', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    h.egress.on(MD1, replyOf('error-429.json'), replyOf('cl-matches-2026-md1.json'));
    h.egress.serve('cl-standings-2026-md1.json');
    const snapshot = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(snapshot.matches).toHaveLength(18);
    const calls = h.egress.callsTo(MD1);
    expect(calls).toHaveLength(2);
    expect((calls[1]?.atMs ?? 0) - (calls[0]?.atMs ?? 0)).toBe(42_000);
  });

  it('fails a 429 with retryAfterSeconds when the reset is beyond the purpose limit, retried at most once', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json').serve('competition-cl.json');
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const seasons = await h.clock.run(h.source.listSeasons(refOf(competitions.items[0]?.ref), discoveryCtx()));
    h.egress.on(keyOfRecorded('cl-matches-2026.json'), replyOf('error-429.json'));
    // Discovery waits at most 5 seconds: the 42-second reset is refused at once.
    const discoveryFailure = await failureOf(
      h.clock.run(h.source.listStages(refOf(competitions.items[0]?.ref), refOf(seasons.items[0]?.ref), discoveryCtx())),
    );
    expect(discoveryFailure).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 42, httpStatus: 429 });
    expect(h.egress.callsTo(keyOfRecorded('cl-matches-2026.json'))).toHaveLength(1);

    // Research retries once after the wait; a second 429 fails.
    await h.clock.advance(60_000);
    const researchFailure = await failureOf(
      h.clock.run(h.source.listStages(refOf(competitions.items[0]?.ref), refOf(seasons.items[0]?.ref), researchCtx())),
    );
    expect(researchFailure).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 42 });
    expect(h.egress.callsTo(keyOfRecorded('cl-matches-2026.json'))).toHaveLength(3);
  });
});

describe('transient failures and timeouts (R-250, R-251)', () => {
  it('retries 5xx at most maxRetries times with doubling backoff, then names unavailability; research restarts', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    h.egress.on(MD1, replyOf('error-500.json'), replyOf('error-503.json'), replyOf('error-500.json'));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure).toMatchObject({ code: 'unavailable', httpStatus: 500 });
    expect(availabilityReasonOf(failure)).toBe('source_unavailable');
    const calls = h.egress.callsTo(MD1);
    expect(calls).toHaveLength(3);
    expect((calls[1]?.atMs ?? 0) - (calls[0]?.atMs ?? 0)).toBe(1000);
    expect((calls[2]?.atMs ?? 0) - (calls[1]?.atMs ?? 0)).toBe(2000);
    expect(h.source.cacheEntries().some((entry) => entry.key.includes('selection'))).toBe(false);

    h.egress.on(MD1, replyOf('cl-matches-2026-md1.json'));
    h.egress.serve('cl-standings-2026-md1.json');
    const snapshot = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(snapshot.matches).toHaveLength(18);
  });

  it('applies the deterministic jitter of the injected random source', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, random: [0, 1] });
    const ref = await md1Ref(h);
    h.egress.on(MD1, replyOf('error-503.json'), replyOf('error-503.json'), replyOf('error-503.json'));
    await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    const calls = h.egress.callsTo(MD1);
    expect((calls[1]?.atMs ?? 0) - (calls[0]?.atMs ?? 0)).toBe(800);
    expect((calls[2]?.atMs ?? 0) - (calls[1]?.atMs ?? 0)).toBe(2400);
  });

  it('retries connection failures and timeouts within the bound, then fails with timeout', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    const timeout = (): ReturnType<typeof throwReply> =>
      throwReply(new EgressError('timeout', 'egress request exceeded its deadline'), 10_000);
    h.egress.on(MD1, throwReply(new EgressError('network', 'egress request failed')), timeout(), timeout());
    const started = h.clock.nowMs();
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('timeout');
    expect(availabilityReasonOf(failure)).toBe('source_unavailable');
    const calls = h.egress.callsTo(MD1);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.timeoutMs === 10_000)).toBe(true);
    expect(h.clock.nowMs() - started).toBeLessThanOrEqual(30_000 + 10_000);
  });

  it('stops retrying when the total retry time would exceed 30 seconds', async () => {
    const h = harness({
      token: TEST_MARKER_TOKEN,
      options: { baseUrl: 'https://api.football-data.org/v4', timeoutMs: 30_000, maxRetries: 3 },
    });
    h.egress.on(
      'GET /v4/competitions',
      throwReply(new EgressError('timeout', 'egress request exceeded its deadline'), 30_000),
    );
    const failure = await failureOf(h.clock.run(h.source.listCompetitions(researchCtx())));
    expect(failure.code).toBe('timeout');
    expect(h.egress.calls).toHaveLength(1);
  });

  it('never retries an egress refusal (redirect, oversize, foreign origin)', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on('GET /v4/competitions', throwReply(new EgressError('redirect', 'egress refused: redirect')));
    const failure = await failureOf(h.clock.run(h.source.listCompetitions(discoveryCtx())));
    expect(failure.code).toBe('invalid');
    expect(h.egress.calls).toHaveLength(1);
  });
});

describe('X-Authenticated-Client (T11H-F04)', () => {
  it('classifies with a boolean only: the value is never logged, cached, returned or observed', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    const ref = await md1Ref(h);
    h.egress.on(MD1, replyOf('error-403-authenticated.json'));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('not_available');
    const outputs = outputsOf(h, failure) + JSON.stringify(h.observations);
    expect(outputs).not.toContain(CLIENT_MARKER);
    expect(outputs).not.toContain(TEST_MARKER_TOKEN);
    const response = h.observations.filter((o) => o.type === 'response').at(-1);
    expect(response).toMatchObject({
      status: 403,
      authenticatedClientPresent: true,
      authenticatedClientSameAsFirst: true,
      classifiedPositive: true,
    });
    expect(recorded('error-403-authenticated.json').headers['X-Authenticated-Client']).toBe(CLIENT_MARKER);
  });
});

describe('rate-limit header bounds (T11H-F05)', () => {
  it.each([['-1'], ['1.5'], ['1e3'], [''], ['0, 0'], ['9999999'], ['3601'], ['3 0']])(
    'ignores the reset value %j: the source is not blocked by it',
    async (reset) => {
      const h = harness({ token: TEST_MARKER_TOKEN });
      h.egress
        .on(
          'GET /v4/competitions',
          replyOf('competitions.json', { headers: { 'X-RequestsAvailable': '0', 'X-RequestCounter-Reset': reset } }),
        )
        .serve('competition-cl.json');
      const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
      await h.clock.run(h.source.listSeasons(refOf(competitions.items[0]?.ref), discoveryCtx()));
      const [first, second] = h.egress.calls;
      expect(second?.atMs).toBe(first?.atMs);
    },
  );

  it('ignores an X-RequestsAvailable above 10000 or malformed', async () => {
    for (const available of ['10001', '-0', '0.0', '0x0']) {
      const h = harness({ token: TEST_MARKER_TOKEN });
      h.egress
        .on(
          'GET /v4/competitions',
          replyOf('competitions.json', {
            headers: { 'X-RequestsAvailable': available, 'X-RequestCounter-Reset': '60' },
          }),
        )
        .serve('competition-cl.json');
      const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
      await h.clock.run(h.source.listSeasons(refOf(competitions.items[0]?.ref), discoveryCtx()));
      expect(h.egress.calls[1]?.atMs).toBe(h.egress.calls[0]?.atMs);
    }
  });

  it('waits one window after a 429 whose reset is invalid', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    h.egress.on(
      MD1,
      replyOf('error-429.json', { headers: { 'X-RequestCounter-Reset': '1e9' } }),
      replyOf('cl-matches-2026-md1.json'),
    );
    h.egress.on(STANDINGS_MD1, replyOf('cl-standings-2026-md1.json'));
    await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    const calls = h.egress.callsTo(MD1);
    expect((calls[1]?.atMs ?? 0) - (calls[0]?.atMs ?? 0)).toBe(60_000);
  });
});
