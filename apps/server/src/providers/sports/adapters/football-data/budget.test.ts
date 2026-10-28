/**
 * FootballDataProvider request budget with many competitions, through the public entry point and the catalogue
 * service (contracts/provider-ports.md section 1.4 "Request budget" and "Cache"; R-141, R-249, R-291; T11H-F06): the
 * catalogue costs one request, no 60-second window ever holds more than the budget, repeats within validity make no
 * request, an exhausted budget gives a stale listing or the wait, research keeps its reserved slots during a
 * discovery flood, identical concurrent misses share one request and the discovery waiters are bounded.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import { createSportsSources } from '../../index.js';
import { SourceError, type SourceRef } from '../../ingestion/index.js';
import { VirtualClock } from '../../support/test/virtual-clock.js';
import { CapturingLogger, config } from '../../test/synthetic.js';

import { TOKEN_VARIABLE } from './constants.js';
import { HARNESS_START, discoveryCtx, harness, researchCtx } from './test/harness.js';
import { BASE_OPTIONS, type Json, type ReplayCall, ReplayEgress, jsonReply, projectRootDir } from './test/replay.js';

const COMPETITIONS = 40;

function code(index: number): string {
  return `C${String(index).padStart(2, '0')}`;
}

/** A synthetic competition list of `count` invented competitions. */
function competitionList(count = COMPETITIONS): Json {
  return {
    competitions: Array.from({ length: count }, (_, index) => ({
      id: 9000 + index,
      code: code(index),
      name: `Liga Sintética ${String(index)}`,
      area: { name: 'Synthetic Area' },
    })),
  };
}

function detail(competitionCode: string): Json {
  const season = { id: 1, startDate: '2026-08-01', endDate: '2027-05-30', currentMatchday: 3 };
  return {
    id: 1,
    code: competitionCode,
    name: `Liga Sintética ${competitionCode}`,
    currentSeason: season,
    seasons: [season],
  };
}

/** Answers every competition detail with a synthetic one, after `delayMs` of virtual time. */
function serveDetails(egress: ReplayEgress, delayMs = 0): void {
  egress.fallback((key) => {
    const match = /^GET \/v4\/competitions\/(C[0-9]{2})$/.exec(key);
    if (match === null) {
      return undefined;
    }
    return { ...jsonReply(200, detail(match[1] ?? '')), ...(delayMs > 0 ? { delayMs } : {}) };
  });
}

/** The largest number of requests sent in any 60-second window. */
function maxPerWindow(calls: readonly ReplayCall[]): number {
  const times = calls.map((call) => call.atMs);
  return Math.max(0, ...times.map((at) => times.filter((t) => t > at - 60_000 && t <= at).length));
}

function liveConfig() {
  return config([
    {
      id: 'football-data',
      name: 'Synthetic live source',
      mode: 'LIVE_DATA',
      role: 'primary',
      accepted: true,
      adapter: 'football-data',
      options: BASE_OPTIONS,
    },
  ]);
}

function registryWith(egress: ReplayEgress, clock: VirtualClock) {
  return createSportsSources(liveConfig(), {
    egress,
    env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
    clock,
    db: {} as never,
    paths: { rootDir: projectRootDir(), dataDir: join(projectRootDir(), 'data') },
    logger: new CapturingLogger(),
  });
}

describe('many competitions on a 10 requests per minute budget (R-291, R-249)', () => {
  it('lists the catalogue in one request and never exceeds the budget while browsing and researching', async () => {
    const clock = new VirtualClock(HARNESS_START);
    const egress = new ReplayEgress(clock);
    egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(egress);
    const registry = registryWith(egress, clock);

    const catalogue = await clock.run(registry.catalogue.listCatalogue(discoveryCtx()));
    expect(catalogue.competitions).toHaveLength(COMPETITIONS);
    expect(egress.calls).toHaveLength(1);

    // An operator opens one competition per second; research runs on some of them meanwhile.
    const views = [];
    for (const competition of catalogue.competitions) {
      views.push(await clock.run(registry.catalogue.listSeasons(competition.id, 'football-data', discoveryCtx())));
      if (views.length % 5 === 0) {
        const source = registry.get('football-data');
        const listing = await clock.run(
          source?.listCompetitions(researchCtx()) ?? Promise.reject(new Error('no source')),
        );
        const ref = listing.items[(views.length * 7) % COMPETITIONS]?.ref ?? ('' as SourceRef);
        await clock.run(source?.listSeasons(ref, researchCtx()) ?? Promise.reject(new Error('no source')));
      }
      await clock.advance(1000);
    }

    expect(maxPerWindow(egress.calls)).toBeLessThanOrEqual(10);
    const refused = views.filter((view) => view.found && !view.listing.availability.available);
    expect(refused.length).toBeGreaterThan(0);
    for (const view of refused) {
      expect(view.found && view.listing.availability).toEqual({ available: false, reason: 'rate_limited' });
      expect(view.found && (view.listing.retryAfterSeconds ?? 0)).toBeGreaterThan(0);
    }

    // A repeat view within validity makes no request.
    const before = egress.calls.length;
    const again = await clock.run(registry.catalogue.listCatalogue(discoveryCtx()));
    expect(again.sources[0]?.listing).toMatchObject({ fromCache: true, stale: false });
    const served = views.findIndex((view) => view.found && view.listing.availability.available);
    const repeat = await clock.run(
      registry.catalogue.listSeasons(catalogue.competitions[served]?.id ?? '', 'football-data', discoveryCtx()),
    );
    expect(repeat.found && repeat.listing.fromCache).toBe(true);
    expect(egress.calls).toHaveLength(before);
  });

  it('serves the expired catalogue as stale with its retrieval time while the budget is exhausted', async () => {
    const clock = new VirtualClock(HARNESS_START);
    const egress = new ReplayEgress(clock);
    egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(egress);
    const registry = registryWith(egress, clock);
    const first = await clock.run(registry.catalogue.listCatalogue(discoveryCtx()));
    const retrievedAt = first.sources[0]?.listing.retrievedAt;

    await clock.advance(86_400_000 + 1000);
    const source = registry.get('football-data');
    const listing = await clock.run(source?.listCompetitions(researchCtx()) ?? Promise.reject(new Error('no source')));
    // Research refreshed the list; expire it again and spend the discovery share of the window.
    await clock.advance(86_400_000 + 1000);
    for (const item of listing.items.slice(0, 8)) {
      await clock.run(source?.listSeasons(item.ref, discoveryCtx()) ?? Promise.reject(new Error('no source')));
    }
    const calls = egress.calls.length;
    const stale = await clock.run(registry.catalogue.listCatalogue(discoveryCtx()));
    expect(stale.competitions).toHaveLength(COMPETITIONS);
    expect(stale.sources[0]?.listing).toMatchObject({ fromCache: true, stale: true });
    expect(stale.sources[0]?.listing.retrievedAt).not.toBe(retrievedAt);
    expect(stale.sources[0]?.listing.retrievedAt).toBe(listing.retrievedAt);
    expect(stale.sources[0]?.listing.retryAfterSeconds ?? 0).toBeGreaterThan(0);
    expect(egress.calls).toHaveLength(calls);
  });

  it('gives the wait when the budget is exhausted and nothing is cached', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(h.egress);
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const results = [];
    for (const item of listing.items.slice(0, 9)) {
      results.push(await h.clock.run(h.source.listSeasons(item.ref, discoveryCtx())).catch((error: unknown) => error));
    }
    const last = results.at(-1);
    expect(last).toBeInstanceOf(SourceError);
    expect(last).toMatchObject({ code: 'rate_limited' });
    expect((last as SourceError).retryAfterSeconds ?? 0).toBeGreaterThan(5);
    expect(h.egress.calls).toHaveLength(8);
  });
});

describe('priority, single-flight and bounded waiters (T11H-F06)', () => {
  it('a discovery flood never delays research beyond its reserved slots', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(h.egress, 100);
    const listing = await h.clock.run(h.source.listCompetitions(researchCtx()));
    await h.clock.advance(60_000);
    const start = h.clock.nowMs();

    const flood = listing.items.slice(0, 30).map((item) =>
      h.source.listSeasons(item.ref, discoveryCtx()).then(
        () => 'ok',
        (error: unknown) => error,
      ),
    );
    const researchItems = listing.items.slice(30, 32);
    const research = researchItems.map((item) => h.source.listSeasons(item.ref, researchCtx()));
    const outcomes = await h.clock.run(Promise.all([...flood, ...research]));

    const researchKeys = new Set(researchItems.map((_, index) => `GET /v4/competitions/${code(30 + index)}`));
    const order = h.egress.calls.filter((call) => call.atMs >= start).map((call) => call.key);
    // Research is admitted before every waiting discovery request (after the one already in flight).
    expect(order.slice(1, 3).every((key) => researchKeys.has(key))).toBe(true);
    const discoverySent = order.filter((key) => !researchKeys.has(key));
    expect(discoverySent.length).toBeLessThanOrEqual(8);
    const refused = outcomes.slice(0, 30).filter((outcome) => outcome instanceof SourceError);
    expect(refused).toHaveLength(30 - discoverySent.length);
    expect(refused.every((error) => (error as SourceError).code === 'rate_limited')).toBe(true);
    expect(maxPerWindow(h.egress.calls.filter((call) => call.atMs >= start))).toBeLessThanOrEqual(10);
  });

  it('concurrent identical misses make one request', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(h.egress, 500);
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const ref = listing.items[0]?.ref ?? ('' as SourceRef);
    const results = await h.clock.run(
      Promise.all([
        h.source.listSeasons(ref, discoveryCtx()),
        h.source.listSeasons(ref, discoveryCtx()),
        h.source.listSeasons(ref, discoveryCtx()),
      ]),
    );
    expect(h.egress.callsTo(`GET /v4/competitions/${code(0)}`)).toHaveLength(1);
    expect(results[1]?.items).toEqual(results[0]?.items);
    expect(results[2]?.items).toEqual(results[0]?.items);
  });

  it('answers a discovery request beyond the waiter bound at once', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, options: { ...BASE_OPTIONS, maxDiscoveryWaiters: 3 } });
    h.egress.on('GET /v4/competitions', jsonReply(200, competitionList()));
    serveDetails(h.egress, 1000);
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const start = h.clock.nowMs();
    const refusedAt: number[] = [];
    const pending = listing.items.slice(0, 6).map((item) =>
      h.source.listSeasons(item.ref, discoveryCtx()).then(
        () => null,
        (error: unknown) => {
          refusedAt.push(h.clock.nowMs());
          return error;
        },
      ),
    );
    const outcomes = await h.clock.run(Promise.all(pending));
    // One in flight, three waiting, two refused at once.
    expect(outcomes.filter((outcome) => outcome instanceof SourceError)).toHaveLength(2);
    expect(refusedAt).toEqual([start, start]);
    expect(h.egress.calls).toHaveLength(1 + 4);
  });
});
