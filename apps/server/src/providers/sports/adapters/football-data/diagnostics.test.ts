/**
 * Failure diagnostics of the adapter for the capability probe (FU-2, OD-60; T11H-F02, T11H-F04): the egress refusal
 * kind (closed list), the rejecting stage (closed list), the resource kind (closed list) and the failing validation
 * path reduced to schema field names and numeric indices. Recorded-shape fixtures with planted values (team names
 * with unusual characters, scores, the marker token, header values, URLs) prove that no value reaches an observation.
 * No socket is opened.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import { EGRESS_FAILURE_KINDS, EgressError } from '../../../../platform/net/index.js';
import { SourceError, type SourceRef } from '../../ingestion/index.js';

import {
  DIAGNOSTIC_FIELD_NAMES,
  DIAGNOSTIC_RESOURCES,
  EGRESS_REFUSAL_KINDS,
  REJECTION_STAGES,
  type RequestObservation,
  diagnosticPath,
  egressRefusalKind,
} from './observation.js';
import { type Harness, harness, pick, refOf, researchCtx, walkReference } from './test/harness.js';
import { BASE_OPTIONS, type Reply, jsonReply, replyOf, throwReply } from './test/replay.js';

const CLIENT_MARKER = 'edr-test-client-marker-0000';
const MD1 = 'GET /v4/competitions/CL/matches?matchday=1&season=2026';
const STANDINGS_MD1 = 'GET /v4/competitions/CL/standings?matchday=1&season=2026';
const TL1_MD1 = 'GET /v4/competitions/TL1/matches?matchday=1&season=2026';

/** Values planted in the fixtures and replies of these tests; none may appear in an observation. */
const PLANTED_TEXT = [
  'edr-planted',
  'planted.invalid',
  'https://',
  TEST_MARKER_TOKEN,
  CLIENT_MARKER,
  'Ñandú',
  '’',
  '“',
] as const;
const PLANTED_NUMBERS = [/\b917\b/, /\b853\b/] as const;

/** Header values planted on the replies of the planted fixtures (fixture files hold only documented headers). */
const PLANTED_HEADERS = {
  'X-Planted-Header': 'edr-planted-header-value-0000',
  Location: `https://planted.invalid/redirect?token=${TEST_MARKER_TOKEN}`,
  'X-Auth-Token': TEST_MARKER_TOKEN,
  'X-Authenticated-Client': CLIENT_MARKER,
} as const;

function planted(file: string): Reply {
  return replyOf(file, { headers: PLANTED_HEADERS });
}

function expectNothingPlanted(text: string): void {
  for (const value of PLANTED_TEXT) {
    expect(text.includes(value), value).toBe(false);
  }
  for (const pattern of PLANTED_NUMBERS) {
    expect(pattern.test(text), String(pattern)).toBe(false);
  }
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

function rejections(h: Harness): RequestObservation[] {
  return h.observations.filter((observation) => observation.type === 'rejection');
}

async function md1Ref(h: Harness): Promise<SourceRef> {
  const { stages } = await walkReference(h);
  return refOf(stages.items[0]?.matchdays[0]?.ref);
}

async function tl1Md1Ref(h: Harness): Promise<SourceRef> {
  h.egress.serve('competitions.json').serve('competition-tl1.json').serve('tl1-matches-2026.json');
  const competitions = await h.clock.run(h.source.listCompetitions(researchCtx()));
  const tl1 = pick(competitions, (item) => item.localKey === 'tl1');
  const seasons = await h.clock.run(h.source.listSeasons(tl1.ref, researchCtx()));
  const season = pick(seasons, (item) => item.current);
  const stages = await h.clock.run(h.source.listStages(tl1.ref, season.ref, researchCtx()));
  return refOf(stages.items[0]?.matchdays[0]?.ref);
}

describe('diagnosticPath: schema field names and numeric indices only (T11H-F02)', () => {
  it.each([
    ['/teams/12/name', '/teams/12/name'],
    ['/matches/0/score/fullTime/home', '/matches/0/score/fullTime/home'],
    ['/standings/rows/3/played', '/standings/rows/3/played'],
    ['/items/4/localKey', '/items/4/localKey'],
    ['/', '/'],
    ['/teams/edr-planted-team/name', '/teams/*/name'],
    [`/${TEST_MARKER_TOKEN}`, '/*'],
    [`/matches/0/${CLIENT_MARKER}`, '/matches/0/*'],
    ['/https:~1~1planted.invalid~1x/name', '/*/name'],
    ['/Atlético Valdoria/name', '/*/name'],
    ['/917/853', '/917/853'],
    ['/123456/name', '/*/name'],
    ['/007/-1/1.5/1e3', '/*/*/*/*'],
    ['/LEAGUE_STAGE/FINISHED/TOTAL', '/*/*/*'],
    ['/__proto__/constructor/prototype', '/*/*/*'],
    ['/teams//name', '/teams/*/name'],
  ])('%s -> %s', (path, expected) => {
    expect(diagnosticPath(path)).toBe(expected);
    expect(diagnosticPath(diagnosticPath(path))).toBe(expected);
  });

  it('refuses anything that is not a validation path', () => {
    for (const value of [null, undefined, 42, {}, '', 'teams/1/name', `https://planted.invalid/${TEST_MARKER_TOKEN}`]) {
      expect(diagnosticPath(value)).toBeNull();
    }
    expect(diagnosticPath(`/${'a'.repeat(200)}`)).toBeNull();
  });

  it('keeps at most 24 segments', () => {
    const path = Array.from({ length: 30 }, () => '/teams').join('');
    expect(diagnosticPath(path)?.split('/').length).toBe(25);
  });

  it('holds only identifier-shaped names declared by the schemas, never literal or enum values', () => {
    for (const name of [
      'teams',
      'name',
      'matches',
      'score',
      'fullTime',
      'home',
      'away',
      'standings',
      'rows',
      'played',
      'position',
      'goalDifference',
      'items',
      'localKey',
      'homeTeam',
      'utcDate',
      'table',
      'playedGames',
    ]) {
      expect(DIAGNOSTIC_FIELD_NAMES.has(name), name).toBe(true);
    }
    for (const value of [
      'LEAGUE_STAGE',
      'TOTAL',
      'FINISHED',
      'finished',
      'LIVE_DATA',
      'not_provided_for_stage',
      'matchday_of_total',
      'teams_in_table',
      'REGULAR_SEASON',
    ]) {
      expect(DIAGNOSTIC_FIELD_NAMES.has(value), value).toBe(false);
    }
    for (const name of DIAGNOSTIC_FIELD_NAMES) {
      expect(name).toMatch(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
    }
  });
});

describe('egress refusal kinds (closed list)', () => {
  it('maps every egress failure kind to a refusal kind or to none', () => {
    const mapped = EGRESS_FAILURE_KINDS.map((kind) => [kind, egressRefusalKind(new EgressError(kind, 'x'))]);
    expect(mapped).toEqual([
      ['denied', 'other'],
      ['invalid_request', 'other'],
      ['timeout', null],
      ['aborted', null],
      ['too_large', 'too_large'],
      ['redirect', 'redirect'],
      ['network', null],
    ]);
    expect(EGRESS_REFUSAL_KINDS).toEqual(['too_large', 'redirect', 'other']);
    expect(REJECTION_STAGES).toEqual(['not_json', 'allow_list', 'domain']);
    expect(DIAGNOSTIC_RESOURCES).toEqual([
      'competitions',
      'competition',
      'stageDiscovery',
      'matches',
      'standings',
      'selection',
    ]);
  });
});

describe('adapter observations of refused and rejected responses (FU-2)', () => {
  it('a selection whose team names break the shared rule: domain stage, path /teams/2/name, no planted value', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    const ref = await md1Ref(h);
    h.egress.on(MD1, planted('planted-cl-matches-2026-md1.json')).serve('cl-standings-2026-md1.json');
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure).toMatchObject({ code: 'invalid', path: '/teams/2/name' });
    expect(rejections(h)).toEqual([
      { type: 'rejection', resource: 'selection', stage: 'domain', path: '/teams/2/name' },
    ]);
    expectNothingPlanted(JSON.stringify(h.observations));
    expect(h.source.cacheEntries().filter((entry) => entry.key.includes('selection'))).toEqual([]);
  });

  it('a selection whose standings break won + drawn + lost = played: path /standings/rows/3/played', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    const ref = await md1Ref(h);
    h.egress.serve('cl-matches-2026-md1.json').on(STANDINGS_MD1, planted('planted-cl-standings-2026-md1.json'));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('invalid');
    expect(rejections(h)).toEqual([
      { type: 'rejection', resource: 'selection', stage: 'domain', path: '/standings/rows/3/played' },
    ]);
    expectNothingPlanted(JSON.stringify(h.observations));
  });

  it('a match list whose score is a planted string: allow-list stage on matches', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    const ref = await tl1Md1Ref(h);
    h.egress.on(TL1_MD1, planted('planted-tl1-matches-2026-md1.json'));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('invalid');
    expect(rejections(h)).toEqual([
      { type: 'rejection', resource: 'matches', stage: 'allow_list', path: '/matches/0/score/fullTime/home' },
    ]);
    expectNothingPlanted(JSON.stringify(h.observations));
  });

  it('a body that is not JSON: not_json stage, no path', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    const ref = await md1Ref(h);
    h.egress.on(MD1, {
      kind: 'response',
      status: 200,
      headers: { 'X-Planted-Header': 'edr-planted-header-value-0000' },
      text: `<html>${TEST_MARKER_TOKEN} https://planted.invalid/x Ñandú 917</html>`,
    });
    await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(rejections(h)).toEqual([{ type: 'rejection', resource: 'matches', stage: 'not_json', path: null }]);
    expectNothingPlanted(JSON.stringify(h.observations));
  });

  it.each([
    ['too_large', (): ReturnType<typeof jsonReply> => oversizeReply()],
    [
      'redirect',
      () =>
        throwReply(
          new EgressError(
            'redirect',
            `redirect to https://planted.invalid/x?token=${TEST_MARKER_TOKEN} ${CLIENT_MARKER}`,
          ),
        ),
    ],
    ['other', () => throwReply(new EgressError('denied', `denied https://planted.invalid/ ${TEST_MARKER_TOKEN}`))],
  ] as const)('an egress refusal (%s) of stage discovery is observed by kind only', async (kind, reply) => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true });
    h.egress
      .serve('competitions.json')
      .serve('competition-cl.json')
      .on('GET /v4/competitions/CL/matches?season=2026', reply());
    const competitions = await h.clock.run(h.source.listCompetitions(researchCtx()));
    const cl = pick(competitions, (item) => item.localKey === 'cl');
    const seasons = await h.clock.run(h.source.listSeasons(cl.ref, researchCtx()));
    const season = pick(seasons, (item) => item.current);
    const failure = await failureOf(h.clock.run(h.source.listStages(cl.ref, season.ref, researchCtx())));
    expect(failure.code).toBe('invalid');
    const last = h.observations.at(-1);
    expect(last).toMatchObject({ type: 'response', kind: 'stageDiscovery', status: null, failure: 'invalid' });
    expect(last?.type === 'response' ? last.refusal : undefined).toBe(kind);
    expect(rejections(h)).toEqual([]);
    expectNothingPlanted(JSON.stringify(h.observations));
  });

  it('a timeout is not a refusal', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN, observe: true, options: { ...BASE_OPTIONS, maxRetries: 0 } });
    const ref = await md1Ref(h);
    h.egress.on(MD1, throwReply(new EgressError('timeout', 'egress deadline')));
    const failure = await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(failure.code).toBe('timeout');
    const failures = h.observations.filter((o) => o.type === 'response' && o.status === null);
    expect(failures.length).toBeGreaterThan(0);
    for (const observation of failures) {
      expect(observation.type === 'response' ? observation.refusal : undefined).toBeNull();
    }
  });

  it('observes nothing without an observer (production)', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const ref = await md1Ref(h);
    h.egress.on(MD1, planted('planted-cl-matches-2026-md1.json')).serve('cl-standings-2026-md1.json');
    await failureOf(h.clock.run(h.source.fetchSelection(ref, researchCtx())));
    expect(h.observations).toEqual([]);
    expectNothingPlanted(JSON.stringify(h.logger.lines));
  });
});

/** A stage-discovery reply above the 512 KiB default cap, its padding made of planted values. */
function oversizeReply(): ReturnType<typeof jsonReply> {
  const padding = `${TEST_MARKER_TOKEN} https://planted.invalid/x ${CLIENT_MARKER} Ñandú 917 `.repeat(9000);
  return jsonReply(
    200,
    { filters: { season: '2026' }, padding, matches: [] },
    { 'X-Planted-Header': padding.slice(0, 80) },
  );
}
