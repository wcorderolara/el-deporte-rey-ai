/**
 * FootballDataProvider: listings, selection mapping, cache, person-data dropping and references, against the
 * recorded-shape synthetic responses of `fixtures/football-data/` through a replay transport on a virtual clock
 * (contracts/provider-ports.md section 1.4; R-244 to R-247, R-252, R-254, R-255, the adapter part of R-256, R-280;
 * T11H-F07, T11H-F14, Q8). No socket is opened.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import {
  type Json as FixtureJson,
  comparableFromFootballData,
  comparableFromSnapshot,
} from '../../../../../../../fixtures/support.js';
import { SourceError, type SelectionSnapshot } from '../../ingestion/index.js';

import { discoveryCtx, harness, pick, refOf, researchCtx, walkReference } from './test/harness.js';
import { BASE_OPTIONS, jsonReply, recorded, replyOf } from './test/replay.js';

const PERSON_MARKER = 'edr-person-marker-';
const CREST_HOST = 'crests.invalid';

function body(file: string): FixtureJson {
  return recorded(file).body as FixtureJson;
}

async function failureOf(promise: Promise<unknown>): Promise<SourceError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(SourceError);
    return error as SourceError;
  }
  throw new Error('expected a SourceError');
}

describe('listings of the reference-shaped competition (R-244)', () => {
  it('lists the competitions in one request, the reference competition first', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json');
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    expect(listing.items.map((item) => [item.localKey, item.name, item.areaName])).toEqual([
      ['cl', 'Copa Continental Sintética', 'Synthetic Continent'],
      ['tl1', 'Liga Sintética del Norte', 'Synthetic Republic'],
    ]);
    expect(listing).toMatchObject({
      availability: { available: true },
      retrievedAt: h.clock.iso(),
      fromCache: false,
      stale: false,
      retryAfterSeconds: null,
    });
    expect(h.egress.calls.map((call) => call.key)).toEqual(['GET /v4/competitions']);
  });

  it('lists the reference competition before the others even when the provider lists it later', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const raw = body('competitions.json');
    const reversed = { ...raw, competitions: [...(raw['competitions'] as unknown[])].reverse() };
    h.egress.on('GET /v4/competitions', jsonReply(200, reversed));
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    expect(listing.items.map((item) => item.localKey)).toEqual(['cl', 'tl1']);
  });

  it('offers only the seasons the provider reports, with labels, start years and the current season', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { seasons } = await walkReference(h);
    expect(
      seasons.items.map(({ id, label, current, startDate, endDate, startYear }) => ({
        id,
        label,
        current,
        startDate,
        endDate,
        startYear,
      })),
    ).toEqual([
      { id: '2026', label: '2026/27', current: true, startDate: '2026-09-15', endDate: '2027-05-29', startYear: 2026 },
      { id: '2025', label: '2025/26', current: false, startDate: '2025-09-16', endDate: '2026-05-30', startYear: 2025 },
    ]);
  });

  it('lists the matchdays of the current season in one season-wide request', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    expect(stages.items).toHaveLength(1);
    const stage = stages.items[0];
    expect(stage).toMatchObject({ id: 'league-stage', name: 'LEAGUE_STAGE', order: 1, standings: 'expected' });
    expect(stage?.wholeStageRef).toBeNull();
    expect(stage?.matchdays.map((matchday) => matchday.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(h.egress.callsTo('GET /v4/competitions/CL/matches')).toHaveLength(1);
    expect(h.egress.callsTo('GET /v4/competitions/CL/matches')[0]?.key).toBe(
      'GET /v4/competitions/CL/matches?season=2026',
    );
  });

  it('lists the stages of a complete season by the source names, knockout stages selectable as a whole', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h, '2025');
    expect(stages.items.map((stage) => [stage.order, stage.id, stage.name, stage.standings])).toEqual([
      [1, 'league-stage', 'LEAGUE_STAGE', 'expected'],
      [2, 'playoffs', 'PLAYOFFS', 'unknown'],
      [3, 'last-16', 'LAST_16', 'unknown'],
      [4, 'quarter-finals', 'QUARTER_FINALS', 'unknown'],
      [5, 'semi-finals', 'SEMI_FINALS', 'unknown'],
      [6, 'final', 'FINAL', 'unknown'],
    ]);
    for (const stage of stages.items.slice(1)) {
      expect(stage.matchdays).toEqual([]);
      expect(stage.wholeStageRef).not.toBeNull();
    }
    expect(stages.items[0]?.matchdays).toHaveLength(8);
  });
});

describe('selection mapping (R-245, R-256 adapter part)', () => {
  it('maps matches by season and matchday and the TOTAL standings to the recorded values', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-md1.json');
    const matchday = pick({ ...stages, items: stages.items[0]?.matchdays ?? [] }, (item) => item.number === 1);
    const snapshot = await h.clock.run(h.source.fetchSelection(matchday.ref, researchCtx()));

    expect(comparableFromSnapshot(snapshot)).toEqual(
      comparableFromFootballData(body('cl-matches-2026-md1.json'), body('cl-standings-2026-md1.json')),
    );
    expect(snapshot).toMatchObject({
      sourceId: 'football-data',
      mode: 'LIVE_DATA',
      retrievedAt: h.clock.iso(),
      fromCache: false,
      sourceRef: `source:football-data/matches@${h.clock.iso()}`,
      importVersionId: null,
      competition: { name: 'Copa Continental Sintética' },
      season: { label: '2026/27' },
      stage: { name: 'LEAGUE_STAGE', matchday: 1, totalMatchdays: 8 },
    });
    expect(snapshot.context).toEqual([
      { type: 'matchday_of_total', matchday: 1, totalMatchdays: 8, ref: snapshot.sourceRef },
      { type: 'teams_in_table', count: 36, ref: `source:football-data/standings@${h.clock.iso()}` },
      { type: 'matches_in_selection', count: 18, ref: snapshot.sourceRef },
    ]);
    // Team keys come from the provider IDs; short names and TLAs are aliases (comparable across sources).
    const first = (body('cl-matches-2026-md1.json')['matches'] as FixtureJson[])[0] as FixtureJson;
    const home = first['homeTeam'] as FixtureJson;
    expect(snapshot.teams.find((team) => team.teamKey === String(home['id']))).toMatchObject({
      name: home['name'],
      aliases: [home['shortName'], home['tla']],
    });
    expect(h.egress.calls.slice(-2).map((call) => call.key)).toEqual([
      'GET /v4/competitions/CL/matches?matchday=1&season=2026',
      'GET /v4/competitions/CL/standings?matchday=1&season=2026',
    ]);
  });

  it('maps a whole knockout stage with the stage filter and no standings request', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h, '2025');
    const last16 = pick(stages, (stage) => stage.name === 'LAST_16');
    h.egress.serve('cl-matches-2025-stage-last-16.json');
    const snapshot = await h.clock.run(h.source.fetchSelection(refOf(last16.wholeStageRef), researchCtx()));
    expect(snapshot.stage).toEqual({ name: 'LAST_16', matchday: null, totalMatchdays: null });
    expect(snapshot.matches).toHaveLength(16);
    expect(snapshot.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(h.egress.callsTo('GET /v4/competitions/CL/standings')).toHaveLength(0);
    expect(h.egress.calls.at(-1)?.key).toBe('GET /v4/competitions/CL/matches?season=2025&stage=LAST_16');
  });
});

describe('missing optional fields (R-246)', () => {
  it('accepts competitions without optional fields; the local key falls back to the ID; nothing invented', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions-missing-optional.json');
    const listing = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    expect(listing.items.map((item) => [item.localKey, item.areaName])).toEqual([
      ['cl', 'Synthetic Continent'],
      ['9901', null],
    ]);
  });

  it('accepts a competition detail without optional fields', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json').serve('competition-cl-missing-optional.json');
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const cl = pick(competitions, (item) => item.localKey === 'cl');
    const seasons = await h.clock.run(h.source.listSeasons(cl.ref, discoveryCtx()));
    expect(seasons.items.map((season) => [season.id, season.current])).toEqual([
      ['2026', true],
      ['2025', false],
    ]);
  });

  it('accepts a matchday and standings without optional fields: no aliases, no invented values', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress.serve('cl-matches-2026-md1-missing-optional.json').serve('cl-standings-2026-md1-missing-optional.json');
    const ref = refOf(stages.items[0]?.matchdays[0]?.ref);
    const snapshot = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(snapshot.teams.every((team) => team.aliases.length === 0)).toBe(true);
    expect(comparableFromSnapshot(snapshot)).toEqual(
      comparableFromFootballData(
        body('cl-matches-2026-md1-missing-optional.json'),
        body('cl-standings-2026-md1-missing-optional.json'),
      ),
    );
  });
});

describe('invalid responses (R-247)', () => {
  const cases: Array<[string, string | null]> = [
    ['invalid-non-json.json', null],
    ['invalid-missing-required.json', '/matches/2/utcDate'],
    ['invalid-wrong-type.json', '/matches/1/score/fullTime/home'],
    ['invalid-unknown-status.json', '/matches/0/status'],
  ];

  it.each(cases)('%s is rejected as invalid with its path, not retried and not cached', async (file, path) => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    const before = h.egress.calls.length;
    const cached = h.source.cacheEntries().length;
    h.egress.serve(file);
    const ref = refOf(stages.items[0]?.matchdays[0]?.ref);
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('invalid');
    expect(failure.path).toBe(path);
    expect(h.egress.calls.length - before).toBe(1);
    expect(h.source.cacheEntries()).toHaveLength(cached);
  });
});

describe('cache (R-252)', () => {
  it('serves a repeat within validity from the cache with the original time, and requests again after expiry', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.serve('competitions.json');
    const first = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    await h.clock.advance(3_600_000);
    const repeat = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    expect(repeat).toMatchObject({ fromCache: true, stale: false, retrievedAt: first.retrievedAt });
    expect(repeat.items).toEqual(first.items);
    expect(h.egress.calls).toHaveLength(1);

    await h.clock.advance(86_400_000);
    const fresh = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    expect(fresh).toMatchObject({ fromCache: false, retrievedAt: h.clock.iso() });
    expect(h.egress.calls).toHaveLength(2);
  });

  it('caches a selection with its retrieval time and keeps a live matchday for 60 seconds only', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress
      .serve('cl-matches-2026-md2.json')
      .on('GET /v4/competitions/CL/standings?matchday=2&season=2026', replyOf('cl-standings-2026-md1.json'));
    const ref = refOf(stages.items[0]?.matchdays[1]?.ref);
    const first = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    await h.clock.advance(30_000);
    const repeat = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(repeat.fromCache).toBe(true);
    expect(repeat.retrievedAt).toBe(first.retrievedAt);
    const requests = h.egress.calls.length;
    await h.clock.advance(31_000);
    const again = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(again.fromCache).toBe(false);
    expect(h.egress.calls.length).toBeGreaterThan(requests);
  });

  it('never caches an error response', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress.on('GET /v4/competitions', replyOf('error-404.json'));
    await failureOf(h.clock.run(h.source.listCompetitions(discoveryCtx())));
    await failureOf(h.clock.run(h.source.listCompetitions(discoveryCtx())));
    expect(h.egress.calls).toHaveLength(2);
    expect(h.source.cacheEntries()).toEqual([]);
  });
});

describe('person data and crests (R-280, R-119)', () => {
  it('drops referees, coaches and crests from projections, the cache and the logs', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    // The detail carries a 2025 winner team with a crest; the 2026 matchday carries referees, coaches and crests;
    // the standings rows carry crests and form.
    const current = await walkReference(h);
    const past = await walkReference(h, '2025');
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-md1.json');
    const snapshot = await h.clock.run(
      h.source.fetchSelection(refOf(current.stages.items[0]?.matchdays[0]?.ref), researchCtx()),
    );
    const outputs = JSON.stringify([current, past, snapshot, h.source.cacheEntries(), h.logger.lines]);
    for (const forbidden of [PERSON_MARKER, CREST_HOST, 'referees', 'coach', 'crest', 'winner', '"form"']) {
      expect(outputs).not.toContain(forbidden);
    }
    expect(h.logger.lines.some((line) => (line.fields['strippedKeys'] as number | undefined) !== undefined)).toBe(true);
  });
});

describe('incomplete matchdays (R-255)', () => {
  it('maps every provider status; only finished matches keep a result; in-play scores are dropped', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress
      .serve('cl-matches-2026-md2.json')
      .on('GET /v4/competitions/CL/standings?matchday=2&season=2026', replyOf('cl-standings-2026-md1.json'));
    const snapshot = await h.clock.run(
      h.source.fetchSelection(refOf(stages.items[0]?.matchdays[1]?.ref), researchCtx()),
    );
    const raw = body('cl-matches-2026-md2.json')['matches'] as FixtureJson[];
    const expected = new Map([
      ['SCHEDULED', 'scheduled'],
      ['TIMED', 'scheduled'],
      ['IN_PLAY', 'in_play'],
      ['PAUSED', 'in_play'],
      ['EXTRA_TIME', 'in_play'],
      ['PENALTY_SHOOTOUT', 'in_play'],
      ['FINISHED', 'finished'],
      ['POSTPONED', 'postponed'],
      ['SUSPENDED', 'suspended'],
      ['CANCELLED', 'cancelled'],
      ['AWARDED', 'awarded'],
    ]);
    expect(snapshot.matches).toHaveLength(raw.length);
    for (const match of raw) {
      const mapped = snapshot.matches.find((item) => item.matchKey === String(match['id']));
      expect(mapped?.status).toBe(expected.get(match['status'] as string));
      if (match['status'] === 'FINISHED') {
        const fullTime = (match['score'] as FixtureJson)['fullTime'];
        expect(mapped?.score).toEqual(fullTime);
      } else {
        expect(mapped?.score).toBeNull();
      }
    }
  });
});

describe('missing standings (R-254)', () => {
  it('records standings as unavailable when no TOTAL table is provided; matches stay intact', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-no-total.json');
    const snapshot = await h.clock.run(
      h.source.fetchSelection(refOf(stages.items[0]?.matchdays[0]?.ref), researchCtx()),
    );
    expect(snapshot.standings).toEqual({ available: false, reason: 'not_provided_by_source' });
    expect(snapshot.matches).toHaveLength(18);
    expect(snapshot.context.map((item) => item.type)).toEqual(['matchday_of_total', 'matches_in_selection']);
  });

  it('records standings refused for the subscription (403) as unavailable with that reason', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress
      .serve('cl-matches-2026-md1.json')
      .on('GET /v4/competitions/CL/standings?matchday=1&season=2026', replyOf('error-403-authenticated.json'));
    const snapshot = await h.clock.run(
      h.source.fetchSelection(refOf(stages.items[0]?.matchdays[0]?.ref), researchCtx()),
    );
    expect(snapshot.standings).toEqual({ available: false, reason: 'not_available_with_subscription' });
  });
});

describe('untrusted keys (T11H-F07) and attribution references (T11H-F14)', () => {
  const NAMES = ['__proto__', 'constructor', 'prototype', 'toString'];

  function syntheticMatches(): FixtureJson {
    const matches = NAMES.flatMap((stage, index) => [
      {
        id: `m-${String(index)}`,
        utcDate: `2026-09-${String(10 + index)}T18:00:00Z`,
        status: 'FINISHED',
        matchday: index === 0 ? 1 : null,
        stage,
        homeTeam: { id: NAMES[index], name: `Club Uno ${String(index)}` },
        awayTeam: { id: NAMES[(index + 1) % NAMES.length], name: `Club Dos ${String(index)}` },
        score: { fullTime: { home: 1, away: 0 } },
      },
    ]);
    return { competition: { name: 'Copa Continental Sintética' }, matches };
  }

  it('groups stage values and team keys such as __proto__ and constructor in maps', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress
      .serve('competitions.json')
      .serve('competition-cl.json')
      .on('GET /v4/competitions/CL/matches?season=2026', jsonReply(200, syntheticMatches()));
    const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
    const cl = pick(competitions, (item) => item.localKey === 'cl');
    const seasons = await h.clock.run(h.source.listSeasons(cl.ref, discoveryCtx()));
    const stages = await h.clock.run(h.source.listStages(cl.ref, refOf(seasons.items[0]?.ref), discoveryCtx()));
    expect(stages.items.map((stage) => [stage.id, stage.name])).toEqual([
      ['proto', '__proto__'],
      ['constructor', 'constructor'],
      ['prototype', 'prototype'],
      ['tostring', 'toString'],
    ]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();

    const proto = stages.items[0];
    h.egress.on('GET /v4/competitions/CL/matches?matchday=1&season=2026', jsonReply(200, syntheticMatches()));
    h.egress.on('GET /v4/competitions/CL/standings?matchday=1&season=2026', jsonReply(200, { standings: [] }));
    const snapshot = await h.clock.run(h.source.fetchSelection(refOf(proto?.matchdays[0]?.ref), researchCtx()));
    expect(snapshot.matches).toEqual([
      expect.objectContaining({ matchKey: 'm-0', homeTeamKey: '__proto__', awayTeamKey: 'constructor' }),
    ]);
    expect(snapshot.teams.map((team) => team.teamKey).sort()).toEqual(['__proto__', 'constructor']);
  });

  it('gives source:<sourceId>/<resourceKind>@<retrievedAt> references, never a URL', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-md1.json');
    const snapshot: SelectionSnapshot = await h.clock.run(
      h.source.fetchSelection(refOf(stages.items[0]?.matchdays[0]?.ref), researchCtx()),
    );
    const refs = [
      snapshot.sourceRef,
      ...snapshot.teams.map((team) => team.ref),
      ...snapshot.matches.map((match) => match.ref),
      ...(snapshot.standings.available ? [snapshot.standings.ref, ...snapshot.standings.rows.map((r) => r.ref)] : []),
      ...snapshot.context.map((item) => item.ref),
    ];
    for (const ref of refs) {
      expect(ref).toMatch(/^source:football-data\/(matches|standings)@2026-10-27T12:00:00\.000Z$/);
      expect(ref).not.toContain('://');
    }
    expect(JSON.stringify(snapshot)).not.toContain('football-data.org');
  });
});

describe('stage-discovery cap override (Q8)', () => {
  it('applies the override only to the season-wide match list; every other resource keeps 512 KiB', async () => {
    const h = harness({
      token: TEST_MARKER_TOKEN,
      options: { ...BASE_OPTIONS, maxResponseBytesByResource: { stageDiscovery: 2_097_152 } },
    });
    const { stages } = await walkReference(h);
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-md1.json');
    await h.clock.run(h.source.fetchSelection(refOf(stages.items[0]?.matchdays[0]?.ref), researchCtx()));
    expect(h.egress.calls.map((call) => [call.key, call.maxResponseBytes])).toEqual([
      ['GET /v4/competitions', 524_288],
      ['GET /v4/competitions/CL', 524_288],
      ['GET /v4/competitions/CL/matches?season=2026', 2_097_152],
      ['GET /v4/competitions/CL/matches?matchday=1&season=2026', 524_288],
      ['GET /v4/competitions/CL/standings?matchday=1&season=2026', 524_288],
    ]);
  });

  it('refuses a response over the cap as invalid without retrying it', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, options: { ...BASE_OPTIONS, maxResponseBytes: 200 } });
    h.egress.serve('competitions.json');
    const failure = await failureOf(h.clock.run(h.source.listCompetitions(discoveryCtx())));
    expect(failure.code).toBe('invalid');
    expect(h.egress.calls).toHaveLength(1);
  });

  it('keeps the stage-discovery request at 512 KiB when no override is set', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    await walkReference(h);
    expect(h.egress.calls.every((call) => call.maxResponseBytes === 524_288)).toBe(true);
  });
});
