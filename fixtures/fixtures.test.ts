/**
 * Validation of every T23 synthetic fixture (tracker T23; R-205, R-224, R-229, R-230, R-232, R-237, R-241, R-267,
 * R-283):
 * - DEMO_DATA scenarios (`fixtures/sports/`): the multi-competition file format, then every listing and selection
 *   read through the real FixtureDataProvider and the T20 domain schemas; expected-invalid selections fail; the
 *   seeded agreements, disagreements, statuses, names and stages hold; no network request (R-241);
 * - football-data-shaped responses (`fixtures/football-data/`): status, documented headers, synthetic markers, JSON
 *   bodies parsed and checked against the mapped fields, expected-invalid bodies fail;
 * - manual samples (`fixtures/manual/`): the `ManualImportDocument` and form schemas, CSV layouts, and one sample per
 *   import error class that fails with its class;
 * - the equivalence set (R-267) and the `test-live` data (R-256);
 * - AI stub fixtures (`fixtures/ai/`): `parseAiStubFixture`, the stub adapter, and the T10-F05 bypass classes;
 * - test configurations (`fixtures/config/`): valid ones load with the T17 rules, the two OD-24 configurations are
 *   refused, and every scenario has the files its configuration needs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CompetitionListingSchema,
  ImportFormCreateSchema,
  type ManualImportDocument,
  ManualImportDocumentSchema,
  SeasonListingSchema,
  type SelectionSnapshot,
  SelectionSnapshotSchema,
  StageListingSchema,
  TeamNameSchema,
} from '@edr/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { createStubAiProvider, parseAiStubFixture, type DraftRequest } from '../apps/server/src/providers/ai/index.js';
import { ConfigError, loadConfig, type AppConfig } from '../apps/server/src/platform/config/index.js';
import { fixtureFileSchema } from '../apps/server/src/providers/sports/adapters/fixture/file-format.js';
import { createFixtureSource } from '../apps/server/src/providers/sports/adapters/fixture/index.js';
import {
  type IngestionSource,
  type SourceRef,
  SourceError,
  toDescriptor,
} from '../apps/server/src/providers/sports/ingestion/index.js';
import {
  type TestDeps,
  config,
  deps,
  demoSource,
  discovery,
  research,
} from '../apps/server/src/providers/sports/test/synthetic.js';

import {
  type ComparableSelection,
  FIXTURES_DIR,
  FOOTBALL_DATA_HEADERS,
  FOOTBALL_DATA_STATUS,
  type FootballDataResponse,
  type Json,
  MATCHES_LAYOUT,
  PROJECT_ROOT,
  STANDINGS_LAYOUT,
  comparableFromFootballData,
  comparableFromManual,
  comparableFromSnapshot,
  documentFromCsv,
  footballDataMatchProblems,
  isRecord,
  manualSampleProblem,
  normalizedName,
  parseCsv,
  readFixtureJson,
  readFixtureText,
  teamKeyOf,
} from './support.js';

// ---------------------------------------------------------------------------------------------------------------
// Manifests
// ---------------------------------------------------------------------------------------------------------------

interface ScenarioEntry {
  id: string;
  config: string;
  sources?: string[];
  simulate?: Record<string, string>;
  invalidSelections?: Record<string, Record<string, string>>;
  teamName?: string;
  officialNames?: string[];
  aliases?: string[];
  statuses?: string[];
  disagreement?: { matchIndex: number; footballDataMatchId: number };
}
interface ConfigEntry {
  file: string;
  valid: boolean;
  expectProblem?: string;
  needsTestSeam?: string;
}
interface ManualEntry {
  file: string;
  channel: 'json_file' | 'csv_file' | 'form';
  valid: boolean;
  problem?: string;
  layout?: 'matches' | 'standings';
  equals?: string;
  equivalence?: boolean;
  precondition?: string;
}
interface AiEntry {
  file: string;
  scenario: string;
  expectFlag?: string;
  expectFailure?: string;
  bypassClass?: boolean;
}
interface FootballDataEntry {
  file: string;
  expect: string;
  path?: string;
  equivalence?: boolean;
  retryAfterSeconds?: number;
}

const sportsManifest = readFixtureJson<{ scenarios: ScenarioEntry[] }>('sports/_manifest.json');
const configManifest = readFixtureJson<{ configs: ConfigEntry[] }>('config/_manifest.json');
const manualManifest = readFixtureJson<{ samples: ManualEntry[] }>('manual/_manifest.json');
const aiManifest = readFixtureJson<{ fixtures: AiEntry[] }>('ai/_manifest.json');
const footballDataManifest = readFixtureJson<{
  referenceCompetition: { code: string; id: number; localKey: string; name: string };
  secondCompetition: { code: string; id: number; localKey: string };
  markers: { authenticatedClient: string; personPrefix: string };
  responses: FootballDataEntry[];
}>('football-data/_manifest.json');

const PERSON_PREFIX = footballDataManifest.markers.personPrefix;
const MATCH_STATUSES = [
  'scheduled',
  'in_play',
  'finished',
  'postponed',
  'suspended',
  'cancelled',
  'abandoned',
  'awarded',
];

function listFiles(relativeDirectory: string): string[] {
  return readdirSync(join(FIXTURES_DIR, relativeDirectory)).filter((name) => !name.startsWith('_'));
}

// ---------------------------------------------------------------------------------------------------------------
// DEMO_DATA scenarios through the FixtureDataProvider
// ---------------------------------------------------------------------------------------------------------------

interface SelectionResult {
  readonly competition: string;
  readonly season: string;
  readonly stage: string;
  readonly matchday: number | null;
  readonly snapshot: SelectionSnapshot | null;
  readonly error: SourceError | null;
}

interface SourceRead {
  readonly simulateError: SourceError | null;
  readonly selections: SelectionResult[];
  readonly stages: Map<string, { name: string; standings: string; matchdays: number[]; whole: boolean }>;
  readonly deps: TestDeps;
}

function fixtureSource(sourceId: string, scenario: string): { source: IngestionSource; deps: TestDeps } {
  const testDeps = deps(PROJECT_ROOT);
  const configured = config([demoSource(sourceId, { options: { scenario } })]).providers.sports.sources[0];
  if (configured === undefined) {
    throw new Error('source missing');
  }
  const source = createFixtureSource({
    source: configured,
    descriptor: toDescriptor(configured),
    setting: 'providers.sports.sources[0]',
    options: configured.options,
    deps: testDeps,
  });
  return { source, deps: testDeps };
}

async function readSource(sourceId: string, scenario: string): Promise<SourceRead> {
  const { source, deps: testDeps } = fixtureSource(sourceId, scenario);
  const selections: SelectionResult[] = [];
  const stagesOut = new Map<string, { name: string; standings: string; matchdays: number[]; whole: boolean }>();
  let competitions;
  try {
    competitions = await source.listCompetitions(discovery());
  } catch (error) {
    if (error instanceof SourceError) {
      return { simulateError: error, selections, stages: stagesOut, deps: testDeps };
    }
    throw error;
  }
  expect(CompetitionListingSchema.safeParse(competitions).success).toBe(true);
  for (const competition of competitions.items) {
    const seasons = await source.listSeasons(competition.ref, discovery());
    expect(SeasonListingSchema.safeParse(seasons).success).toBe(true);
    for (const season of seasons.items) {
      const stages = await source.listStages(competition.ref, season.ref, discovery());
      expect(StageListingSchema.safeParse(stages).success).toBe(true);
      for (const stage of stages.items) {
        stagesOut.set(`${competition.localKey}/${season.id}/${stage.id}`, {
          name: stage.name,
          standings: stage.standings,
          matchdays: stage.matchdays.map((m) => m.number),
          whole: stage.wholeStageRef !== null,
        });
        const refs: [number | null, SourceRef][] = stage.matchdays.map((m) => [m.number, m.ref]);
        if (stage.wholeStageRef !== null) {
          refs.push([null, stage.wholeStageRef]);
        }
        for (const [matchday, ref] of refs) {
          const base = { competition: competition.localKey, season: season.id, stage: stage.id, matchday };
          try {
            const snapshot = await source.fetchSelection(ref, research());
            expect(SelectionSnapshotSchema.safeParse(snapshot).success).toBe(true);
            selections.push({ ...base, snapshot, error: null });
          } catch (error) {
            if (!(error instanceof SourceError)) throw error;
            selections.push({ ...base, snapshot: null, error });
          }
        }
      }
    }
  }
  return { simulateError: null, selections, stages: stagesOut, deps: testDeps };
}

const scenarioDirectories = readdirSync(join(FIXTURES_DIR, 'sports')).filter((name) =>
  statSync(join(FIXTURES_DIR, 'sports', name)).isDirectory(),
);
const reads = new Map<string, SourceRead>();

function readOf(scenario: string, sourceId: string): SourceRead {
  const read = reads.get(`${scenario}/${sourceId}`);
  if (read === undefined) throw new Error(`no read for ${scenario}/${sourceId}`);
  return read;
}

function snapshotOf(
  scenario: string,
  sourceId: string,
  competition: string,
  stage: string,
  matchday: number | null,
): SelectionSnapshot {
  const found = readOf(scenario, sourceId).selections.find(
    (s) => s.competition === competition && s.stage === stage && s.matchday === matchday,
  );
  if (found?.snapshot === undefined || found.snapshot === null) {
    throw new Error(`no snapshot ${scenario}/${sourceId}/${competition}/${stage}/${String(matchday)}`);
  }
  return found.snapshot;
}

const ligaMd1 = (scenario: string, sourceId: string): SelectionSnapshot =>
  snapshotOf(scenario, sourceId, 'liga-demo', 'temporada-regular', 1);

function scoreOf(snapshot: SelectionSnapshot, index: number): string {
  const match = snapshot.matches[index];
  return match?.score ? `${String(match.score.home)}-${String(match.score.away)}` : 'none';
}

beforeAll(async () => {
  for (const scenario of scenarioDirectories) {
    for (const file of listFiles(`sports/${scenario}`)) {
      const sourceId = file.replace(/\.json$/, '');
      reads.set(`${scenario}/${sourceId}`, await readSource(sourceId, scenario));
    }
  }
}, 120_000);

describe('DEMO_DATA scenarios (fixtures/sports)', () => {
  const REQUIRED = [
    'default',
    'single-source',
    'unaccepted-source',
    'disputed-resolved',
    'disputed-unavailable',
    'disputed-no-match',
    'disputed-same-source',
    'player-fields',
    'malformed',
    'provider-unavailable',
    'rate-limited',
    'access-refused',
    'not-available',
    'accented-names',
    'unfinished-matches',
    'stage-no-standings',
    'standings-missing',
    'unmatched-team',
    'too-many-slides',
    'equivalence',
    'injection-rejected',
    'injection-plain',
    'live-secondary-agree',
    'live-secondary-disagree',
  ];

  it('has every required scenario, and the manifest lists exactly the scenario directories', () => {
    const listed = sportsManifest.scenarios.map((s) => s.id);
    expect([...listed].sort()).toEqual([...scenarioDirectories].sort());
    for (const id of REQUIRED) expect(listed).toContain(id);
  });

  it('every file matches the multi-competition file format and stays under the 2 MiB cap', () => {
    for (const scenario of scenarioDirectories) {
      for (const file of listFiles(`sports/${scenario}`)) {
        const text = readFixtureText(`sports/${scenario}/${file}`);
        expect(Buffer.byteLength(text)).toBeLessThan(2 * 1024 * 1024);
        expect(fixtureFileSchema.safeParse(JSON.parse(text)).success, `${scenario}/${file}`).toBe(true);
      }
    }
  });

  it('every selection passes the domain schema except the declared invalid ones, which fail as invalid', () => {
    for (const entry of sportsManifest.scenarios) {
      for (const sourceId of entry.sources ?? ['demo-a', 'demo-b']) {
        const read = readOf(entry.id, sourceId);
        const simulate = entry.simulate?.[sourceId];
        if (simulate !== undefined) {
          expect(read.simulateError?.code, `${entry.id}/${sourceId}`).toBe(simulate);
          continue;
        }
        expect(read.simulateError, `${entry.id}/${sourceId}`).toBeNull();
        expect(read.selections.length, `${entry.id}/${sourceId}`).toBeGreaterThan(0);
        const invalid = entry.invalidSelections?.[sourceId] ?? {};
        const injected = entry.id === 'injection-rejected' && sourceId === 'demo-a';
        for (const selection of read.selections) {
          const label = `${entry.id}/${sourceId}/${selection.stage}/${String(selection.matchday)}`;
          if (injected || String(selection.matchday) in invalid) {
            expect(selection.error?.code, label).toBe('invalid');
            expect(selection.error?.path, label).toMatch(/^\//);
          } else {
            expect(selection.error, label).toBeNull();
          }
        }
        if (Object.keys(invalid).length > 0) {
          expect(read.selections.map((s) => String(s.matchday)).sort()).toEqual(Object.keys(invalid).sort());
        }
      }
    }
  });

  it('makes no network request (R-241)', () => {
    for (const read of reads.values()) expect(read.deps.egress.calls).toEqual([]);
  });

  it('default: liga-demo has numbered matchdays and standings; copa-demo has 36 teams and named stages (R-283)', () => {
    const stages = readOf('default', 'demo-a').stages;
    expect(stages.get('liga-demo/2026/temporada-regular')).toEqual({
      name: 'Temporada Regular',
      standings: 'expected',
      matchdays: [1, 2, 3],
      whole: false,
    });
    const copa = [...stages.entries()].filter(([key]) => key.startsWith('copa-demo/'));
    expect(copa.map(([, s]) => s.name)).toEqual([
      'Fase de Liga',
      'Eliminatoria Previa',
      'Octavos de Final',
      'Cuartos de Final',
      'Semifinales',
      'Final',
    ]);
    expect(copa[0]?.[1]).toEqual({
      name: 'Fase de Liga',
      standings: 'expected',
      matchdays: [1, 2, 3, 4, 5, 6, 7, 8],
      whole: false,
    });
    for (const [, stage] of copa.slice(1)) expect(stage.standings).toBe('not_expected');
    expect(copa[5]?.[1]).toMatchObject({ matchdays: [], whole: true });

    for (let md = 1; md <= 8; md += 1) {
      const snapshot = snapshotOf('default', 'demo-a', 'copa-demo', 'fase-de-liga', md);
      expect(snapshot.teams).toHaveLength(36);
      expect(snapshot.matches).toHaveLength(18);
      expect(snapshot.standings.available && snapshot.standings.rows.length).toBe(36);
    }
    for (const stage of ['eliminatoria-previa', 'octavos-de-final', 'cuartos-de-final', 'semifinales']) {
      expect(snapshotOf('default', 'demo-a', 'copa-demo', stage, 1).standings).toEqual({
        available: false,
        reason: 'not_provided_for_stage',
      });
    }
    expect(snapshotOf('default', 'demo-a', 'copa-demo', 'final', null).matches).toHaveLength(1);
  });

  it('default: standings agree with the results of the league stages, and all three sources agree', () => {
    for (const [competition, stage, mds] of [
      ['copa-demo', 'fase-de-liga', 8],
      ['liga-demo', 'temporada-regular', 3],
    ] as const) {
      const points = new Map<string, number>();
      for (let md = 1; md <= mds; md += 1) {
        const snapshot = snapshotOf('default', 'demo-a', competition, stage, md);
        for (const m of snapshot.matches) {
          const [h, a] = m.score ? [m.score.home, m.score.away] : [0, 0];
          points.set(m.homeTeamKey, (points.get(m.homeTeamKey) ?? 0) + (h > a ? 3 : h === a ? 1 : 0));
          points.set(m.awayTeamKey, (points.get(m.awayTeamKey) ?? 0) + (a > h ? 3 : h === a ? 1 : 0));
        }
        if (!snapshot.standings.available) throw new Error('standings expected');
        for (const row of snapshot.standings.rows)
          expect(row.points, `${competition} md${String(md)}`).toBe(points.get(row.teamKey));
      }
    }
    const a = readOf('default', 'demo-a').selections;
    for (const other of ['demo-b', 'demo-official']) {
      const b = readOf('default', other).selections;
      expect(b).toHaveLength(a.length);
      a.forEach((selection, i) => {
        const counterpart = b[i];
        if (selection.snapshot === null || counterpart?.snapshot === null || counterpart === undefined)
          throw new Error('snapshot missing');
        expect(comparableFromSnapshot(counterpart.snapshot)).toEqual(comparableFromSnapshot(selection.snapshot));
      });
    }
  });

  it('single-source and unaccepted-source: the seeded presence of values (R-229)', () => {
    const a = ligaMd1('single-source', 'demo-a');
    const b = ligaMd1('single-source', 'demo-b');
    expect(b.matches).toHaveLength(a.matches.length - 1);
    const first = comparableFromSnapshot(a).matches.filter((m) => !comparableFromSnapshot(b).matches.includes(m));
    expect(first).toHaveLength(1);
    expect(comparableFromSnapshot(ligaMd1('unaccepted-source', 'demo-b'))).toEqual(
      comparableFromSnapshot(ligaMd1('unaccepted-source', 'demo-a')),
    );
  });

  it('disputed scenarios: seeded score disagreement and official publication values (R-205, R-230)', () => {
    for (const scenario of ['disputed-resolved', 'disputed-unavailable', 'disputed-no-match', 'disputed-same-source']) {
      expect(scoreOf(ligaMd1(scenario, 'demo-a'), 0)).toBe('2-1');
      expect(scoreOf(ligaMd1(scenario, 'demo-b'), 0)).toBe('1-1');
      const a = comparableFromSnapshot(ligaMd1(scenario, 'demo-a'));
      const b = comparableFromSnapshot(ligaMd1(scenario, 'demo-b'));
      expect(a.matches.filter((m) => !b.matches.includes(m))).toHaveLength(1);
      expect(a.standings).toBeNull();
    }
    expect(scoreOf(ligaMd1('disputed-resolved', 'demo-official'), 0)).toBe('2-1');
    expect(scoreOf(ligaMd1('disputed-no-match', 'demo-official'), 0)).toBe('2-2');
    expect(readOf('disputed-unavailable', 'demo-official').simulateError?.code).toBe('unavailable');
    expect(reads.has('disputed-same-source/demo-official')).toBe(false);
  });

  it('player-fields: person-level fields are in the files and absent from the snapshots (R-232)', () => {
    for (const sourceId of ['demo-a', 'demo-b']) {
      expect(readFixtureText(`sports/player-fields/${sourceId}.json`)).toContain(PERSON_PREFIX);
      const read = readOf('player-fields', sourceId);
      expect(JSON.stringify(read.selections.map((s) => s.snapshot))).not.toContain(PERSON_PREFIX);
      const stripped = read.deps.logger.lines.map((line) => line.fields['strippedKeys']);
      expect(stripped.some((count) => typeof count === 'number' && count > 0)).toBe(true);
      expect(read.deps.logger.text()).not.toContain(PERSON_PREFIX);
    }
  });

  it('accented-names: official names with accents and special characters, matched by normalized name (R-237)', () => {
    const entry = sportsManifest.scenarios.find((s) => s.id === 'accented-names');
    const official = ligaMd1('accented-names', 'demo-b').teams;
    const plain = ligaMd1('accented-names', 'demo-a').teams;
    for (const name of entry?.officialNames ?? []) {
      expect(official.map((t) => t.name)).toContain(name);
      expect(name).toMatch(/[^\x20-\x7e]|[.'&()-]/);
    }
    expect(entry?.officialNames).toHaveLength(4);
    expect(plain.map((t) => normalizedName(t.name)).sort()).toEqual(official.map((t) => normalizedName(t.name)).sort());
    const aliases = [...official, ...plain].flatMap((t) => t.aliases);
    for (const alias of ['Ebony River Athletic', 'At. Río Ébano']) expect(aliases).toContain(alias);
  });

  it('unfinished-matches: one match per provider-neutral status, only the finished one with a score', () => {
    const snapshot = ligaMd1('unfinished-matches', 'demo-a');
    expect(snapshot.matches.map((m) => m.status).sort()).toEqual([...MATCH_STATUSES].sort());
    for (const m of snapshot.matches) expect(m.score === null).toBe(m.status !== 'finished');
  });

  it('stage-no-standings and standings-missing: standings unavailable with the stated reason (R-283)', () => {
    const stages = readOf('stage-no-standings', 'demo-a').stages;
    expect([...stages.values()].map((s) => [s.name, s.standings, s.whole])).toEqual([
      ['Octavos de Final', 'not_expected', false],
      ['Final', 'not_expected', true],
    ]);
    for (const s of readOf('stage-no-standings', 'demo-a').selections) {
      expect(s.snapshot?.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    }
    expect(readOf('standings-missing', 'demo-a').stages.get('liga-demo/2026/temporada-regular')?.standings).toBe(
      'expected',
    );
    expect(ligaMd1('standings-missing', 'demo-b').standings).toEqual({
      available: false,
      reason: 'not_provided_by_source',
    });
  });

  it('unmatched-team: exactly one team without a normalized-name counterpart', () => {
    const a = new Set(ligaMd1('unmatched-team', 'demo-a').teams.map((t) => normalizedName(t.name)));
    const unmatched = ligaMd1('unmatched-team', 'demo-b').teams.filter((t) => !a.has(normalizedName(t.name)));
    expect(unmatched.map((t) => t.name)).toEqual(['Brisamar Royal Club']);
  });

  it('too-many-slides: the selection needs more slides than one carousel holds', () => {
    const snapshot = snapshotOf('too-many-slides', 'demo-a', 'copa-demo', 'fase-de-liga', 1);
    const rows = snapshot.standings.available ? snapshot.standings.rows.length : 0;
    const slides = 1 + snapshot.matches.filter((m) => m.status === 'finished').length + Math.ceil(rows / 12) + 1;
    expect(slides).toBeGreaterThan(20);
  });

  it('injection fixtures: rejected names break the team-name rule, plain names pass it (T10-F06)', () => {
    const rejected = sportsManifest.scenarios.find((s) => s.id === 'injection-rejected')?.teamName ?? '';
    const plain = sportsManifest.scenarios.find((s) => s.id === 'injection-plain')?.teamName ?? '';
    expect(TeamNameSchema.safeParse(rejected).success).toBe(false);
    expect(readOf('injection-rejected', 'demo-a').selections[0]?.error?.path).toBe('/teams/0/name');
    expect(TeamNameSchema.safeParse(plain).success).toBe(true);
    for (const sourceId of ['demo-a', 'demo-b']) {
      expect(ligaMd1('injection-plain', sourceId).teams.map((t) => t.name)).toContain(plain);
    }
  });

  it('untrusted-keys: inherited member names are plain data keys (T11H-F07)', () => {
    const keys = ligaMd1('untrusted-keys', 'demo-a').teams.map((t) => t.teamKey);
    for (const key of ['__proto__', 'constructor', 'prototype', 'toString']) expect(keys).toContain(key);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// football-data-shaped responses
// ---------------------------------------------------------------------------------------------------------------

function footballData(file: string): FootballDataResponse {
  return readFixtureJson<FootballDataResponse>(`football-data/${file}`);
}

describe('football-data-shaped responses (fixtures/football-data)', () => {
  const marker = footballDataManifest.markers.authenticatedClient;

  it('the manifest lists every response file', () => {
    expect(footballDataManifest.responses.map((r) => r.file).sort()).toEqual(listFiles('football-data').sort());
    expect(marker).toBe('edr-test-client-marker-0000');
  });

  it('every response has a status, documented headers with bounded counters and a body', () => {
    for (const { file } of footballDataManifest.responses) {
      const response = footballData(file);
      expect(response.request.method).toBe('GET');
      expect(response.request.path).toMatch(/^\/v4\/competitions/);
      expect(Number.isInteger(response.status)).toBe(true);
      const names = Object.keys(response.headers);
      for (const name of names) expect(FOOTBALL_DATA_HEADERS).toContain(name);
      expect(response.headers['X-API-Version']).toBe('v4');
      expect(response.headers['X-RequestCounter-Reset']).toMatch(/^[0-9]{1,6}$/);
      expect(response.headers['X-RequestsAvailable']).toMatch(/^[0-9]{1,6}$/);
      const client = response.headers['X-Authenticated-Client'];
      if (client !== undefined) expect(client).toBe(marker);
      expect((response.body === undefined) !== (response.bodyText === undefined), file).toBe(true);
    }
    expect(footballData('error-403-anonymous.json').headers['X-Authenticated-Client']).toBeUndefined();
    expect(footballData('error-403-authenticated.json').headers['X-Authenticated-Client']).toBe(marker);
    expect(footballData('error-429.json').headers).toMatchObject({
      'X-RequestCounter-Reset': '42',
      'X-RequestsAvailable': '0',
    });
    expect(footballData('requests-available-zero.json').headers['X-RequestsAvailable']).toBe('0');
  });

  it('every body meant to be JSON parses; error bodies carry only an error text; the non-JSON body does not parse', () => {
    for (const entry of footballDataManifest.responses) {
      const response = footballData(entry.file);
      if (response.bodyText !== undefined) {
        expect(() => JSON.parse(response.bodyText as string) as unknown, entry.file).toThrow();
        expect(entry.expect).toBe('invalid');
        continue;
      }
      expect(JSON.parse(JSON.stringify(response.body)) as unknown).toEqual(response.body);
      if (response.status >= 400) {
        expect(Object.keys(response.body as Json)).toEqual(['error']);
        expect(entry.expect).not.toBe('ok');
      }
    }
    const expected = new Map([
      [400, 'bad_request'],
      [404, 'not_available'],
      [429, 'rate_limited'],
      [500, 'unavailable'],
      [503, 'unavailable'],
    ]);
    for (const entry of footballDataManifest.responses) {
      const status = footballData(entry.file).status;
      if (expected.has(status)) expect(entry.expect).toBe(expected.get(status));
    }
  });

  it('ok match lists hold valid mapped fields; each invalid body fails at its stated path (R-247)', () => {
    for (const entry of footballDataManifest.responses) {
      const response = footballData(entry.file);
      const body = response.body;
      if (!isRecord(body) || !Array.isArray(body['matches'])) continue;
      const problems = (body['matches'] as unknown[]).flatMap((m, i) =>
        footballDataMatchProblems(m, `/matches/${String(i)}`),
      );
      if (entry.expect === 'ok') {
        expect(problems, entry.file).toEqual([]);
      } else {
        expect(problems.length, entry.file).toBe(1);
        expect(problems[0]?.startsWith(entry.path ?? '?'), entry.file).toBe(true);
      }
    }
  });

  it('competitions: the reference-shaped code and ID and the synthetic second league', () => {
    const body = footballData('competitions.json').body as { competitions: Json[] };
    const ref = footballDataManifest.referenceCompetition;
    expect(body.competitions.map((c) => [c['code'], c['id']])).toEqual([
      [ref.code, ref.id],
      [footballDataManifest.secondCompetition.code, footballDataManifest.secondCompetition.id],
    ]);
    expect(ref.localKey).toBe(teamKeyOf(ref.code));
    const detail = footballData('competition-cl.json').body as { seasons: Json[] };
    expect(detail.seasons).toHaveLength(2);
  });

  it('person fields and crests are present to be dropped, and person values are synthetic markers (R-119, R-280)', () => {
    const md1 = footballData('cl-matches-2026-md1.json').body as { matches: Json[] };
    for (const match of md1.matches) {
      const referees = match['referees'] as Json[];
      expect(referees.length).toBeGreaterThan(0);
      for (const r of referees) expect(r['name']).toMatch(new RegExp(`^${PERSON_PREFIX}`));
      for (const side of ['homeTeam', 'awayTeam']) {
        const team = match[side] as Json;
        expect(team['crest']).toMatch(/^https:\/\/crests\.invalid\//);
        expect((team['coach'] as Json)['name']).toMatch(new RegExp(`^${PERSON_PREFIX}`));
      }
    }
    for (const { file } of footballDataManifest.responses) {
      for (const [, name] of readFixtureText(`football-data/${file}`).matchAll(
        /"name":"([^"]*)","(type|nationality)"/g,
      )) {
        expect(name).toMatch(new RegExp(`^${PERSON_PREFIX}`));
      }
    }
  });

  it('the incomplete matchday holds every status; seasons offer every stage; standings have TOTAL, HOME and AWAY', () => {
    const md2 = footballData('cl-matches-2026-md2.json').body as { matches: Json[] };
    expect(new Set(md2.matches.map((m) => m['status']))).toEqual(new Set(FOOTBALL_DATA_STATUS.keys()));
    const season25 = footballData('cl-matches-2025.json').body as { matches: Json[] };
    const stages = [...new Set(season25.matches.map((m) => m['stage']))];
    expect(stages).toEqual(['LEAGUE_STAGE', 'PLAYOFFS', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']);
    for (const m of season25.matches) expect(m['matchday'] === null).toBe(m['stage'] !== 'LEAGUE_STAGE');
    for (const file of ['cl-standings-2026-md1.json', 'tl1-standings-2026-md1.json']) {
      const body = footballData(file).body as { standings: Json[] };
      expect(body.standings.map((s) => s['type'])).toEqual(['TOTAL', 'HOME', 'AWAY']);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Manual samples
// ---------------------------------------------------------------------------------------------------------------

function sampleBytes(file: string): Uint8Array {
  return readFileSync(join(FIXTURES_DIR, 'manual', file));
}

describe('manual import samples (fixtures/manual)', () => {
  const validDocument = ManualImportDocumentSchema.parse(readFixtureJson('manual/valid/liga-manual.json'));

  it('the manifest lists every sample, with one invalid sample per import error class', () => {
    const files = ['valid', 'invalid', 'equivalence'].flatMap((d) => listFiles(`manual/${d}`).map((f) => `${d}/${f}`));
    expect(manualManifest.samples.map((s) => s.file).sort()).toEqual(files.sort());
    const problems = manualManifest.samples.filter((s) => !s.valid).map((s) => s.problem);
    for (const problem of [
      'parse_error',
      'header_invalid',
      'required_missing',
      'type_invalid',
      'value_out_of_range',
      'duplicate_match',
      'finished_without_score',
      'person_field',
      'metadata_conflict',
      'too_large',
      'too_many_rows',
      'encoding_invalid',
      'value_inconsistent',
      'metadata_missing',
    ]) {
      expect(problems).toContain(problem);
    }
  });

  it('valid samples pass the ManualImportDocument schema (strict) and the semantic checks', () => {
    for (const sample of manualManifest.samples.filter((s) => s.valid)) {
      expect(manualSampleProblem(sampleBytes(sample.file), sample.channel), sample.file).toBeNull();
      if (sample.channel === 'json_file') {
        expect(ManualImportDocumentSchema.safeParse(readFixtureJson(`manual/${sample.file}`)).success).toBe(true);
      }
      if (sample.channel === 'form') {
        expect(ImportFormCreateSchema.safeParse(readFixtureJson(`manual/${sample.file}`)).success).toBe(true);
      }
      if (sample.channel === 'csv_file') {
        const header = parseCsv(readFixtureText(`manual/${sample.file}`))[0];
        expect(header).toEqual([...(sample.layout === 'matches' ? MATCHES_LAYOUT : STANDINGS_LAYOUT)]);
      }
    }
  });

  it('the domestic league has named stages with and without standings, and its CSV files equal its JSON file', () => {
    expect(validDocument.selections.map((s) => [s.stage.name, s.matchday, s.standings !== null])).toEqual([
      ['Torneo Apertura', 1, true],
      ['Torneo Apertura', 2, true],
      ['Cuartos de Final', null, false],
    ]);
    const fromCsv = documentFromCsv([
      readFixtureText('manual/valid/liga-manual-matches.csv'),
      readFixtureText('manual/valid/liga-manual-standings.csv'),
    ]);
    expect(ManualImportDocumentSchema.safeParse(fromCsv).success).toBe(true);
    validDocument.selections.forEach((_, i) => {
      expect(comparableFromManual(fromCsv, i)).toEqual(comparableFromManual(validDocument, i));
    });
  });

  it('every invalid sample fails with its import error class', () => {
    for (const sample of manualManifest.samples.filter((s) => !s.valid)) {
      const earlier: ManualImportDocument[] = sample.precondition === undefined ? [] : [validDocument];
      expect(manualSampleProblem(sampleBytes(sample.file), sample.channel, earlier), sample.file).toBe(sample.problem);
      if (sample.precondition !== undefined) {
        expect(manualSampleProblem(sampleBytes(sample.file), sample.channel), sample.file).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Equivalence set (R-267) and test-live data (R-256)
// ---------------------------------------------------------------------------------------------------------------

describe('equivalence set (R-267) and the test-live data (R-256)', () => {
  const footballDataForm = (): ComparableSelection =>
    comparableFromFootballData(
      footballData('cl-matches-2026-md1.json').body as Json,
      footballData('cl-standings-2026-md1.json').body as Json,
    );

  it('DEMO, manual JSON, CSV, form and football-data forms of the matchday are equal', () => {
    const reference = footballDataForm();
    expect(reference.matches).toHaveLength(18);
    expect(reference.standings).toHaveLength(36);
    const demo = snapshotOf('equivalence', 'demo-a', 'copa-continental', 'league-stage', 1);
    expect(comparableFromSnapshot(demo)).toEqual(reference);
    expect(comparableFromSnapshot(snapshotOf('equivalence', 'demo-b', 'copa-continental', 'league-stage', 1))).toEqual(
      reference,
    );
    const json = ManualImportDocumentSchema.parse(readFixtureJson('manual/equivalence/equivalence.json'));
    expect(comparableFromManual(json)).toEqual(reference);
    const form = ImportFormCreateSchema.parse(readFixtureJson('manual/equivalence/equivalence.form.json'));
    if (form.channel !== 'form') throw new Error('form expected');
    expect(comparableFromManual(form.document)).toEqual(reference);
    const csv = documentFromCsv([
      readFixtureText('manual/equivalence/equivalence-matches.csv'),
      readFixtureText('manual/equivalence/equivalence-standings.csv'),
    ]);
    expect(comparableFromManual(csv)).toEqual(reference);
    expect(demo.teams.map((t) => t.teamKey).sort()).toEqual(json.selections[0]?.teams.map((t) => t.key).sort());
    const missingOptional = comparableFromFootballData(
      footballData('cl-matches-2026-md1-missing-optional.json').body as Json,
      footballData('cl-standings-2026-md1-missing-optional.json').body as Json,
    );
    expect(missingOptional).toEqual(reference);
  });

  it('live-secondary-agree equals the football-data matchday; live-secondary-disagree differs in one score', () => {
    const reference = footballDataForm();
    const agree = snapshotOf('live-secondary-agree', 'live-secondary', 'copa-continental', 'league-stage', 1);
    expect(comparableFromSnapshot(agree)).toEqual(reference);
    expect(agree.sourceRef.startsWith('fixture:') || agree.sourceRef.startsWith('source:')).toBe(true);
    for (const team of agree.teams) expect(team.ref.startsWith('source:live-secondary/')).toBe(true);
    const disagree = comparableFromSnapshot(
      snapshotOf('live-secondary-disagree', 'live-secondary', 'copa-continental', 'league-stage', 1),
    );
    const differing = disagree.matches.filter((m) => !reference.matches.includes(m));
    expect(differing).toHaveLength(1);
    expect(disagree.standings).toEqual(reference.standings);
    const entry = sportsManifest.scenarios.find((s) => s.id === 'live-secondary-disagree');
    const md1 = footballData('cl-matches-2026-md1.json').body as { matches: Json[] };
    const seeded = md1.matches[entry?.disagreement?.matchIndex ?? -1];
    expect(seeded?.['id']).toBe(entry?.disagreement?.footballDataMatchId);
    expect(differing[0]?.startsWith(`${String((seeded?.['homeTeam'] as Json)['name'])} |`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// AI stub fixtures
// ---------------------------------------------------------------------------------------------------------------

const BYPASS_PATTERNS: ReadonlyMap<string, RegExp> = new Map([
  ['bypass-fullwidth-digits', /[\uFF10-\uFF19]/u],
  ['bypass-other-script-digits', /[\u0660-\u0669\u0966-\u096F]/u],
  ['bypass-superscript-digits', /[\u00B2\u00B3\u00B9\u2070-\u2079]/u],
  ['bypass-circled-numbers', /[\u2460-\u24FF]/u],
  ['bypass-number-words', /veintitrés|forty-two/iu],
  ['bypass-ordinal-words', /tercera|third/iu],
  ['bypass-multiplier-words', /doblete|triplete|media docena|hat-trick|treble/iu],
  ['bypass-zero-width-split', /[0-9][\u200B-\u200D]+[0-9-]/u],
  ['bypass-bidi-split', /[\u202A-\u202E\u2066-\u2069]/u],
  ['bypass-cyrillic-homoglyph', /[\u0400-\u04FF]/u],
]);

function draftRequest(): DraftRequest {
  return {
    language: 'es',
    brand: { name: 'Synthetic Brand', handle: '@SyntheticBrand' },
    limits: { headlineMaxChars: 120, descriptionMaxChars: 400, captionMaxChars: 600, maxHashtags: 5 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      {
        slideKey: 'match:m1',
        slideType: 'match_result',
        facts: [{ placeholder: '{{t:club-a}}', kind: 'team', display: 'Club A' }],
      },
      { slideKey: 'closing', slideType: 'closing', facts: [] },
    ],
    captionFacts: [],
  };
}

describe('AI stub fixtures (fixtures/ai)', () => {
  it('the manifest lists every fixture; every fixture passes parseAiStubFixture', () => {
    expect(aiManifest.fixtures.map((f) => f.file).sort()).toEqual(listFiles('ai').sort());
    for (const entry of aiManifest.fixtures) {
      expect(() => parseAiStubFixture(readFixtureJson(`ai/${entry.file}`)), entry.file).not.toThrow();
      expect(entry.scenario).toMatch(/^[a-z0-9-]{1,60}$/);
    }
  });

  it('has one fixture per T10-F05 bypass class, each carrying its class characters', () => {
    const bypass = aiManifest.fixtures.filter((f) => f.bypassClass === true).map((f) => f.scenario);
    expect(bypass.sort()).toEqual([...BYPASS_PATTERNS.keys()].sort());
    for (const [scenario, pattern] of BYPASS_PATTERNS) {
      expect(readFixtureJson<Json>(`ai/${scenario}.json`)['slides'], scenario).toBeDefined();
      expect(JSON.stringify(readFixtureJson(`ai/${scenario}.json`)), scenario).toMatch(pattern);
    }
    expect(JSON.stringify(readFixtureJson('ai/invented-score.json'))).toMatch(/[0-9]-[0-9]/);
  });

  it('the stub adapter serves each fixture (texts reach the content checks) or fails as declared', async () => {
    for (const entry of aiManifest.fixtures) {
      const provider = createStubAiProvider({ scenario: entry.scenario }, { paths: { rootDir: PROJECT_ROOT } });
      const draft = provider.generateDraft(draftRequest(), { signal: new AbortController().signal });
      if (entry.expectFailure !== undefined) {
        await expect(draft, entry.file).rejects.toMatchObject({ code: entry.expectFailure });
        continue;
      }
      const response = await draft;
      expect(entry.expectFlag, entry.file).toMatch(/^(UNVERIFIED_NUMBER|NON_OFFICIAL_TEAM_NAME|FORBIDDEN_CONTENT)$/);
      const fixture = parseAiStubFixture(readFixtureJson(`ai/${entry.file}`));
      for (const slide of response.slides) {
        const type = draftRequest().slides.find((s) => s.slideKey === slide.slideKey)?.slideType ?? '';
        const text = fixture.slides.get(type);
        if (text !== undefined) expect(slide.headline).toBe(text.headline);
      }
      if (fixture.caption !== undefined) expect(response.caption).toBe(fixture.caption);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Test configurations
// ---------------------------------------------------------------------------------------------------------------

function loadFixtureConfig(file: string): AppConfig {
  return loadConfig({ rootDir: PROJECT_ROOT, env: { EDR_CONFIG: `fixtures/config/${file}` } });
}

describe('test configurations (fixtures/config)', () => {
  it('the manifest lists every configuration file', () => {
    expect(configManifest.configs.map((c) => c.file).sort()).toEqual(
      listFiles('config')
        .filter((f) => f.endsWith('.config.json'))
        .sort(),
    );
    expect(configManifest.configs.map((c) => c.file)).toContain('demo-manual.config.json');
  });

  it('valid configurations load with the startup rules; the OD-24 configurations are refused naming the problem', () => {
    for (const entry of configManifest.configs) {
      if (entry.valid) {
        expect(() => loadFixtureConfig(entry.file), entry.file).not.toThrow();
      } else {
        let error: unknown;
        try {
          loadFixtureConfig(entry.file);
        } catch (caught) {
          error = caught;
        }
        expect(error, entry.file).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).message).toContain(entry.expectProblem ?? '?');
      }
    }
  });

  it('no valid configuration links a DEMO_DATA source with a LIVE_DATA or MANUAL_DATA source (OD-24)', () => {
    for (const entry of configManifest.configs.filter((c) => c.valid)) {
      const loaded = loadFixtureConfig(entry.file);
      const modes = new Map(loaded.providers.sports.sources.map((s) => [s.id, s.mode]));
      for (const link of loaded.catalogue.links) {
        const linked = new Set(link.bindings.map((b) => modes.get(b.sourceId)));
        expect(linked.has('DEMO_DATA') && (linked.has('LIVE_DATA') || linked.has('MANUAL_DATA')), entry.file).toBe(
          false,
        );
      }
    }
  });

  it('catalogue bindings name competitions the bound sources list', async () => {
    const localKeys = async (sourceId: string, scenario: string): Promise<string[]> =>
      (await fixtureSource(sourceId, scenario).source.listCompetitions(discovery())).items.map((c) => c.localKey);
    const footballDataKeys = (footballData('competitions.json').body as { competitions: Json[] }).competitions.map(
      (c) => teamKeyOf(String(c['code'] ?? c['id'])),
    );
    for (const entry of configManifest.configs.filter((c) => c.valid)) {
      const loaded = loadFixtureConfig(entry.file);
      for (const link of loaded.catalogue.links) {
        for (const binding of link.bindings) {
          const source = loaded.providers.sports.sources.find((s) => s.id === binding.sourceId);
          const keys =
            source?.adapter === 'fixture'
              ? await localKeys(binding.sourceId, 'default')
              : source?.adapter === 'test-live'
                ? await localKeys(binding.sourceId, String(source.options['scenario']))
                : footballDataKeys;
          expect(keys, `${entry.file} ${binding.sourceId}`).toContain(binding.competitionRef);
        }
      }
    }
  });

  it('every scenario has a fixture file for each enabled DEMO_DATA source of its configuration', () => {
    for (const scenario of sportsManifest.scenarios) {
      const loaded = loadFixtureConfig(`${scenario.config}.config.json`);
      const fixtureSources = loaded.providers.sports.sources.filter(
        (s) => s.enabled && (s.adapter === 'fixture' || s.adapter === 'test-live'),
      );
      expect(fixtureSources.length, scenario.id).toBeGreaterThan(0);
      for (const configured of fixtureSources) {
        const { source } = fixtureSource(configured.id, scenario.id);
        expect(() => source.validateStartup?.(), `${scenario.id}/${configured.id}`).not.toThrow();
      }
    }
  });
});
