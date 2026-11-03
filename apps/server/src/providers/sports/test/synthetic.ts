/**
 * Test-only synthetic builders for the sports-data unit tests (T21). Everything here is invented data: no real team,
 * competition or provider. Host names use the reserved `.test` domain. Not used by production code.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type AppConfig, type ConfigEnvironment, buildAppConfig } from '../../../platform/config/index.js';
import type { Db } from '../../../platform/db/index.js';
import type { EgressClient, EgressRequestInit, EgressResponse } from '../../../platform/net/index.js';
import {
  type AdapterRegistration,
  type DataMode,
  type IngestionContext,
  type IngestionSource,
  type Listing,
  type SourceRef,
  type SportsDeps,
  type SportsLogger,
  SourceError,
  asSourceRef,
} from '../ingestion/index.js';

export type Json = Record<string, unknown>;

export const FIXED_NOW = '2026-10-27T12:00:00.000Z';
export const TEST_IMPORT_VERSION_ID = '00000000-0000-4000-8000-000000000001';

export function discovery(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'discovery' };
}

export function research(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'research' };
}

// ---------------------------------------------------------------------------------------------------------------
// Selections and fixture documents
// ---------------------------------------------------------------------------------------------------------------

export interface SelectionOptions {
  readonly competition?: string;
  readonly season?: string;
  readonly stage?: string;
  readonly matchday?: number | null;
  readonly totalMatchdays?: number | null;
  readonly teams?: readonly string[];
  readonly standings?: boolean;
  readonly refPrefix?: string;
}

/** A valid selection payload (without source fields): two finished matches among four teams. */
export function selection(options: SelectionOptions = {}): Json {
  const teams = options.teams ?? ['alfa', 'beta', 'gamma', 'delta'];
  const ref = options.refPrefix ?? 'fixture:synthetic/selection';
  const name = (key: string): string => {
    const word = key.replace(/[^\p{L}\p{N}]/gu, '');
    return `Club ${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  };
  const matchday = options.matchday === undefined ? 1 : options.matchday;
  const [a = 'alfa', b = 'beta', c = 'gamma', d = 'delta'] = teams;
  return {
    competition: { name: options.competition ?? 'Liga Sintetica' },
    season: { label: options.season ?? '2026/27' },
    stage: {
      name: options.stage ?? 'Fase Regular',
      matchday,
      totalMatchdays: options.totalMatchdays === undefined ? 6 : options.totalMatchdays,
    },
    teams: teams.map((key) => ({ teamKey: key, name: name(key), aliases: [], ref: `${ref}#team-${key}` })),
    matches: [
      {
        matchKey: 'm1',
        homeTeamKey: a,
        awayTeamKey: b,
        kickoff: '2026-10-20T18:00:00Z',
        status: 'finished',
        score: { home: 2, away: 1 },
        ref: `${ref}#m1`,
      },
      {
        matchKey: 'm2',
        homeTeamKey: c,
        awayTeamKey: d,
        kickoff: '2026-10-20T20:00:00Z',
        status: 'finished',
        score: { home: 0, away: 0 },
        ref: `${ref}#m2`,
      },
    ],
    standings:
      options.standings === false
        ? { available: false, reason: 'not_provided_for_stage' }
        : {
            available: true,
            asOf: '2026-10-21T00:00:00Z',
            ref: `${ref}#table`,
            rows: [
              row(1, a, 1, 0, 0, 2, 1, 3, ref),
              row(2, c, 0, 1, 0, 0, 0, 1, ref),
              row(3, d, 0, 1, 0, 0, 0, 1, ref),
              row(4, b, 0, 0, 1, 1, 2, 0, ref),
            ],
          },
    context: [{ type: 'matches_in_selection', count: 2, ref: `${ref}#count` }],
  };
}

function row(
  position: number,
  teamKey: string,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  points: number,
  ref: string,
): Json {
  return {
    position,
    teamKey,
    played: won + drawn + lost,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    ref: `${ref}#row-${String(position)}`,
  };
}

export interface StageOptions {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly standings?: 'expected' | 'not_expected' | 'unknown';
  readonly matchdays?: readonly number[];
  readonly wholeStage?: boolean;
}

export function stage(options: StageOptions): Json {
  const matchdays: Json = {};
  for (const number of options.matchdays ?? []) {
    matchdays[String(number)] = selection({ stage: options.name, matchday: number });
  }
  return {
    id: options.id,
    name: options.name,
    order: options.order,
    standings: options.standings ?? 'expected',
    wholeStage:
      options.wholeStage === true
        ? selection({ stage: options.name, matchday: null, totalMatchdays: null, standings: false })
        : null,
    matchdays,
  };
}

export function season(id: string, stages: readonly Json[], extra: Json = {}): Json {
  const startYear = /^[0-9]{4}/.test(id) ? Number(id.slice(0, 4)) : null;
  return {
    id,
    label: startYear === null ? id : `${String(startYear)}/${String((startYear + 1) % 100).padStart(2, '0')}`,
    current: true,
    startDate: startYear === null ? null : `${String(startYear)}-08-01`,
    endDate: startYear === null ? null : `${String(startYear + 1)}-05-31`,
    startYear,
    stages,
    ...extra,
  };
}

export function competition(
  localKey: string,
  name: string,
  seasons: readonly Json[],
  areaName: string | null = null,
): Json {
  return { localKey, name, areaName, seasons };
}

/** A league-style competition: one stage with numbered matchdays and standings. */
export function league(localKey = 'liga-sint', name = 'Liga Sintetica'): Json {
  return competition(localKey, name, [
    season('2026', [stage({ id: 'regular', name: 'Fase Regular', order: 1, matchdays: [1, 2, 3] })]),
  ]);
}

/** A reference-shaped competition: a league-style stage, then named stages without standings. */
export function cup(localKey = 'copa-sint', name = 'Copa Sintetica'): Json {
  return competition(localKey, name, [
    season('2026', [
      stage({ id: 'fase-liga', name: 'Fase de Liga', order: 1, matchdays: [1, 2] }),
      stage({ id: 'octavos', name: 'Octavos de Final', order: 2, standings: 'not_expected', wholeStage: true }),
      stage({ id: 'semifinal', name: 'Semifinal', order: 3, standings: 'not_expected', matchdays: [1, 2] }),
      stage({ id: 'final', name: 'Final', order: 4, standings: 'not_expected', wholeStage: true }),
    ]),
  ]);
}

export function fixtureDocument(competitions: readonly Json[], simulate: string | null = null): Json {
  return { simulate, competitions };
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture directories
// ---------------------------------------------------------------------------------------------------------------

export interface FixtureRoot {
  readonly rootDir: string;
  /** Writes `fixtures/sports/<scenario>/<sourceId>.json` (raw text or a JSON value). */
  write(scenario: string, sourceId: string, content: unknown): void;
  remove(): void;
}

export function createFixtureRoot(): FixtureRoot {
  const rootDir = mkdtempSync(join(tmpdir(), 'edr-t21-'));
  return {
    rootDir,
    write(scenario, sourceId, content): void {
      const directory = join(rootDir, 'fixtures', 'sports', scenario);
      mkdirSync(directory, { recursive: true });
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      writeFileSync(join(directory, `${sourceId}.json`), text, 'utf8');
    },
    remove(): void {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Configuration and dependencies
// ---------------------------------------------------------------------------------------------------------------

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
  // The bundled font roles of config/brand.json (assets/fonts, OD-52), so that workflow tests can render slides.
  fonts: {
    heading: { family: 'Montserrat', weight: 800 },
    body: { family: 'Inter', weight: 400 },
    numeric: { family: 'Inter', weight: 700 },
  },
};

const NO_ENVIRONMENT: ConfigEnvironment = { configFile: null, dataDir: null, port: null };

export function demoSource(id: string, overrides: Json = {}): Json {
  return {
    id,
    name: `Synthetic ${id}`,
    mode: 'DEMO_DATA',
    role: 'primary',
    accepted: true,
    adapter: 'fixture',
    options: { scenario: 'default' },
    ...overrides,
  };
}

export function stubSource(id: string, adapter: string, mode: DataMode, overrides: Json = {}): Json {
  return {
    id,
    name: `Stub ${id}`,
    mode,
    role: 'primary',
    accepted: mode !== 'MANUAL_DATA',
    adapter,
    options: mode === 'LIVE_DATA' ? { baseUrl: `https://${id}.example.test/v1` } : {},
    ...overrides,
  };
}

/** A validated application configuration (T17 rules applied) with the given sources and catalogue links. */
export function config(sources: readonly Json[], catalogue?: Json, rootDir = '/srv/edr-test-root'): AppConfig {
  return buildAppConfig(
    {
      app: { providers: { sports: { sources }, ai: { adapter: 'stub' } } },
      catalogue,
      languages: LANGUAGES,
      brand: BRAND,
    },
    { rootDir, environment: NO_ENVIRONMENT },
  );
}

/** An egress client that records calls and never opens a connection. */
export class RecordingEgress implements EgressClient {
  readonly calls: string[] = [];

  request(url: string, _init: EgressRequestInit): Promise<EgressResponse> {
    this.calls.push(url);
    return Promise.reject(new Error('egress not allowed in this test'));
  }
}

export interface LogLine {
  readonly level: 'debug' | 'warn';
  readonly fields: Readonly<Record<string, unknown>>;
  readonly message: string;
}

export class CapturingLogger implements SportsLogger {
  readonly lines: LogLine[] = [];

  debug(fields: Readonly<Record<string, unknown>>, message: string): void {
    this.lines.push({ level: 'debug', fields, message });
  }

  warn(fields: Readonly<Record<string, unknown>>, message: string): void {
    this.lines.push({ level: 'warn', fields, message });
  }

  text(): string {
    return JSON.stringify(this.lines);
  }
}

/** A database handle that fails on any use (the adapters under test never touch it). */
export const UNUSED_DB = new Proxy(
  {},
  {
    get(): never {
      throw new Error('the database is not used in this test');
    },
  },
) as unknown as Db;

export interface TestDeps extends SportsDeps {
  readonly egress: RecordingEgress;
  readonly logger: CapturingLogger;
}

export function deps(rootDir: string, env: Readonly<Record<string, string | undefined>> = {}): TestDeps {
  return {
    egress: new RecordingEgress(),
    env,
    clock: { now: () => new Date(FIXED_NOW) },
    db: UNUSED_DB,
    paths: { rootDir, dataDir: join(rootDir, 'data') },
    logger: new CapturingLogger(),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Counting stub adapter (in-memory, fixture-shaped documents keyed by source ID)
// ---------------------------------------------------------------------------------------------------------------

export type StubMethod = 'listCompetitions' | 'listSeasons' | 'listStages' | 'fetchSelection';

export interface StubAdapter {
  readonly registration: AdapterRegistration;
  /** Fixture-format documents served per source ID; tests may replace them. */
  readonly documents: Map<string, Json>;
  /** Calls per source ID and method. */
  count(sourceId: string, method: StubMethod): number;
  /** Calls of every method except `listCompetitions` (calls that target a specific ID). */
  targetedCalls(): number;
  /** Per `<sourceId>/<method>`: a raw output replacing the computed one, or an `Error` to throw. */
  readonly overrides: Map<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function listingOf<T>(items: T[]): Listing<T> {
  return {
    items,
    availability: { available: true },
    retrievedAt: FIXED_NOW,
    fromCache: false,
    stale: false,
    retryAfterSeconds: null,
  };
}

function findBy(items: Record<string, unknown>[], key: string, value: unknown): Record<string, unknown> | undefined {
  return items.find((item) => item[key] === value);
}

/**
 * A stub adapter kind for any mode, serving fixture-format documents from memory and counting calls. Snapshots get
 * the source fields of their mode (MANUAL_DATA: an import version and an `import:` reference; LIVE_DATA: a
 * `source:` reference).
 */
export function stubAdapter(kind: string, mode: DataMode): StubAdapter {
  const documents = new Map<string, Json>();
  const overrides = new Map<string, unknown>();
  const counts = new Map<string, number>();
  const bump = (sourceId: string, method: StubMethod): void => {
    const key = `${sourceId}/${method}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  const registration: AdapterRegistration = {
    kind,
    mode,
    ...(mode === 'LIVE_DATA'
      ? {
          provider: {
            name: 'Test live provider',
            capabilities: { competitionCatalogue: true, seasons: true, stages: true },
          },
        }
      : {}),
    create({ descriptor }): IngestionSource {
      const id = descriptor.id;
      const doc = (): Record<string, unknown> => {
        const document = asRecord(documents.get(id));
        const simulate = document['simulate'];
        if (typeof simulate === 'string') {
          throw new SourceError(simulate as SourceError['code'], 'simulated stub failure', id, null, null, 30);
        }
        return document;
      };
      const parse = (ref: SourceRef): Record<string, unknown> => asRecord(JSON.parse(ref));
      const override = (method: StubMethod): unknown => {
        const value = overrides.get(`${id}/${method}`);
        if (value instanceof Error) {
          throw value;
        }
        return value;
      };
      const competitionOf = (ref: Record<string, unknown>) =>
        findBy(asArray(doc()['competitions']), 'localKey', ref['c']);
      const seasonOf = (ref: Record<string, unknown>) =>
        findBy(asArray(competitionOf(ref)?.['seasons']), 'id', ref['s']);

      return {
        descriptor,
        async listCompetitions() {
          bump(id, 'listCompetitions');
          await Promise.resolve();
          const raw = override('listCompetitions');
          if (raw !== undefined) {
            return raw as Listing<never>;
          }
          return listingOf(
            asArray(doc()['competitions']).map((item) => ({
              ref: asSourceRef(JSON.stringify({ c: item['localKey'] })),
              localKey: String(item['localKey']),
              name: String(item['name']),
              areaName: (item['areaName'] as string | null | undefined) ?? null,
            })),
          );
        },
        async listSeasons(competitionRef) {
          bump(id, 'listSeasons');
          await Promise.resolve();
          const seasonsOverride = override('listSeasons');
          if (seasonsOverride !== undefined) {
            return seasonsOverride as Listing<never>;
          }
          const ref = parse(competitionRef);
          return listingOf(
            asArray(competitionOf(ref)?.['seasons']).map((item) => ({
              ref: asSourceRef(JSON.stringify({ c: ref['c'], s: item['id'] })),
              id: String(item['id']),
              label: String(item['label']),
              current: item['current'] === true,
              startDate: (item['startDate'] as string | null) ?? null,
              endDate: (item['endDate'] as string | null) ?? null,
              startYear: (item['startYear'] as number | null) ?? null,
            })),
          );
        },
        async listStages(_competitionRef, seasonRef) {
          bump(id, 'listStages');
          await Promise.resolve();
          const stagesOverride = override('listStages');
          if (stagesOverride !== undefined) {
            return stagesOverride as Listing<never>;
          }
          const ref = parse(seasonRef);
          return listingOf(
            asArray(seasonOf(ref)?.['stages']).map((item) => {
              const make = (md: number | null): SourceRef =>
                asSourceRef(JSON.stringify({ c: ref['c'], s: ref['s'], st: item['id'], md }));
              return {
                id: String(item['id']),
                name: String(item['name']),
                order: Number(item['order']),
                standings: item['standings'] as 'expected',
                wholeStageRef: item['wholeStage'] ? make(null) : null,
                matchdays: Object.keys(asRecord(item['matchdays']))
                  .map(Number)
                  .sort((x, y) => x - y)
                  .map((number) => ({ number, ref: make(number) })),
              };
            }),
          );
        },
        async fetchSelection(selectionRef) {
          bump(id, 'fetchSelection');
          await Promise.resolve();
          const raw = override('fetchSelection');
          if (raw !== undefined) {
            return raw as never;
          }
          const ref = parse(selectionRef);
          const stageItem = findBy(asArray(seasonOf(ref)?.['stages']), 'id', ref['st']);
          const payload = asRecord(
            ref['md'] === null ? stageItem?.['wholeStage'] : asRecord(stageItem?.['matchdays'])[String(ref['md'])],
          );
          const sourceRef =
            mode === 'MANUAL_DATA'
              ? `import:${TEST_IMPORT_VERSION_ID}/v1`
              : mode === 'LIVE_DATA'
                ? `source:${id}/matches@${FIXED_NOW}`
                : `fixture:stub/${id}.json`;
          return {
            competition: payload['competition'],
            season: payload['season'],
            stage: payload['stage'],
            teams: payload['teams'],
            matches: payload['matches'],
            standings: payload['standings'],
            context: payload['context'],
            sourceId: id,
            mode,
            retrievedAt: FIXED_NOW,
            fromCache: false,
            sourceRef,
            importVersionId: mode === 'MANUAL_DATA' ? TEST_IMPORT_VERSION_ID : null,
          } as never;
        },
      };
    },
  };

  return {
    registration,
    documents,
    overrides,
    count: (sourceId, method) => counts.get(`${sourceId}/${method}`) ?? 0,
    targetedCalls: () =>
      [...counts.entries()]
        .filter(([key]) => !key.endsWith('/listCompetitions'))
        .reduce((total, [, value]) => total + value, 0),
  };
}
