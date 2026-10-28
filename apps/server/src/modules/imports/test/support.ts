/**
 * Test-only support of the import module tests (T50): synthetic import documents and CSV files, base64 helpers, an
 * import service on an in-memory database with a temporary data directory, and an application with the import routes
 * and the real source registry (the manual adapter). Every name is invented (SC-04); nothing here is used by
 * production code, and nothing opens a network connection (`app.inject` only).
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../../../app.js';
import { type AppContainer, createContainer } from '../../../container.js';
import { type AppConfig, buildAppConfig } from '../../../platform/config/index.js';
import { type Db, openMigratedDatabase } from '../../../platform/db/index.js';
import { type Logger, createLogger } from '../../../platform/http/index.js';
import { serverModule } from '../index.js';
import { ImportService } from '../service.js';

export type Json = Record<string, unknown>;

/** The repository root (rootDir of generated configurations). */
export const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..');

export const FIXED_NOW = '2026-10-27T12:00:00.000Z';
export const TEST_HOST = '127.0.0.1:4300';
export const TEST_ORIGIN = 'http://127.0.0.1:4300';
export const UI_HEADERS = Object.freeze({
  host: TEST_HOST,
  origin: TEST_ORIGIN,
  'x-edr-client': 'web',
  'content-type': 'application/json',
});

/** The configured MANUAL_DATA source of the tests. */
export const MANUAL_SOURCE: Json = Object.freeze({
  id: 'manual',
  name: 'Operator import',
  mode: 'MANUAL_DATA',
  role: 'primary',
  adapter: 'manual',
  options: {},
});

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

/** A validated configuration with the given sources and a data directory. */
export function importConfig(dataDir: string, sources: readonly Json[] = [MANUAL_SOURCE], catalogue?: Json): AppConfig {
  return buildAppConfig(
    {
      app: { providers: { sports: { sources }, ai: { adapter: 'stub' } } },
      catalogue,
      languages: LANGUAGES,
      brand: BRAND,
    },
    { rootDir: REPO_ROOT, environment: { configFile: null, dataDir, port: null } },
  );
}

/** A temporary directory, removed by `remove`. */
export function temporaryDirectory(prefix: string): { path: string; remove: () => void } {
  const path = mkdtempSync(join(tmpdir(), `edr-${prefix}-`));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------------------------------------------
// Synthetic content
// ---------------------------------------------------------------------------------------------------------------

export function base64(content: string | Uint8Array): string {
  return (typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)).toString('base64');
}

export const TEAMS = [
  { key: 'club-alfa', name: 'Club Alfa' },
  { key: 'deportivo-beta', name: 'Deportivo Beta' },
  { key: 'atletico-gamma', name: 'Atlético Gamma' },
  { key: 'union-delta', name: 'Unión Delta' },
] as const;

export interface DocumentOptions {
  readonly competitionId?: string;
  readonly competitionName?: string;
  readonly seasonId?: string;
  readonly seasonLabel?: string;
  readonly matchday?: number | null;
  readonly homeScore?: number;
  readonly standings?: boolean;
}

/** A valid selection: two finished matches among four teams, with standings. */
export function sampleSelection(options: DocumentOptions = {}): Json {
  const [a, b, c, d] = TEAMS;
  return {
    stage: { id: 'fase-regular', name: 'Fase Regular', order: 1 },
    matchday: options.matchday === undefined ? 1 : options.matchday,
    teams: TEAMS.map((team) => ({ key: team.key, name: team.name })),
    matches: [
      {
        home: a.key,
        away: b.key,
        kickoff: '2026-10-20T18:00:00Z',
        status: 'finished',
        score: { home: options.homeScore ?? 2, away: 1 },
      },
      { home: c.key, away: d.key, kickoff: '2026-10-20T20:00:00Z', status: 'finished', score: { home: 0, away: 0 } },
    ],
    standings:
      options.standings === false
        ? null
        : {
            asOf: '2026-10-21T00:00:00Z',
            rows: [
              standingRow(1, a.key, 1, 0, 0, options.homeScore ?? 2, 1, 3),
              standingRow(2, c.key, 0, 1, 0, 0, 0, 1),
              standingRow(3, d.key, 0, 1, 0, 0, 0, 1),
              standingRow(4, b.key, 0, 0, 1, 1, options.homeScore ?? 2, 0),
            ],
          },
  };
}

export function standingRow(
  position: number,
  team: string,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  points: number,
): Json {
  return {
    position,
    team,
    played: won + drawn + lost,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
  };
}

/** A valid import document of a synthetic domestic league. */
export function sampleDocument(options: DocumentOptions = {}): Json {
  return {
    format: 'edr-manual-import/1',
    competition: {
      id: options.competitionId ?? 'liga-ficticia',
      name: options.competitionName ?? 'Liga Ficticia',
      areaName: 'Pais Ficticio',
    },
    season: { id: options.seasonId ?? '2026-27', label: options.seasonLabel ?? '2026/27' },
    selections: [sampleSelection(options)],
  };
}

export const MATCHES_HEADER =
  'competition_id,competition_name,season_id,season_label,stage_id,stage_name,stage_order,matchday,home_team,away_team,kickoff,status,home_score,away_score';
export const STANDINGS_HEADER =
  'competition_id,competition_name,season_id,season_label,stage_id,stage_name,stage_order,matchday,as_of,position,team,played,won,drawn,lost,goals_for,goals_against,goal_difference,points';

const CSV_PREFIX = 'liga-ficticia,Liga Ficticia,2026-27,2026/27,fase-regular,Fase Regular,1';

/** One matches-layout data row of matchday `matchday` ('' for the stage as a whole). */
export function matchRow(
  home: string,
  away: string,
  status = 'finished',
  homeScore = '1',
  awayScore = '0',
  matchday = '1',
): string {
  return `${CSV_PREFIX},${matchday},${home},${away},2026-10-20T18:00:00Z,${status},${homeScore},${awayScore}`;
}

/** One standings-layout data row. */
export function standingsCsvRow(
  position: number,
  team: string,
  won: number,
  drawn: number,
  lost: number,
  matchday = '1',
): string {
  const played = won + drawn + lost;
  const goalsFor = won * 2 + drawn;
  const goalsAgainst = lost * 2 + drawn;
  return [
    CSV_PREFIX,
    matchday,
    '2026-10-21T00:00:00Z',
    position,
    team,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalsFor - goalsAgainst,
    won * 3 + drawn,
  ].join(',');
}

/** A valid matches CSV (LF line ends, final newline) for the four synthetic teams. */
export function matchesCsv(rows?: readonly string[]): string {
  const body = rows ?? [
    matchRow('Club Alfa', 'Deportivo Beta', 'finished', '2', '1'),
    matchRow('Atlético Gamma', 'Unión Delta', 'finished', '0', '0'),
  ];
  return `${[MATCHES_HEADER, ...body].join('\n')}\n`;
}

/** A valid standings CSV matching `matchesCsv()`. */
export function standingsCsv(rows?: readonly string[]): string {
  const body = rows ?? [
    standingsCsvRow(1, 'Club Alfa', 1, 0, 0),
    standingsCsvRow(2, 'Atlético Gamma', 0, 1, 0),
    standingsCsvRow(3, 'Unión Delta', 0, 1, 0),
    standingsCsvRow(4, 'Deportivo Beta', 0, 0, 1),
  ];
  return `${[STANDINGS_HEADER, ...body].join('\n')}\n`;
}

export function fileRequest(channel: 'json_file' | 'csv_file', content: string | Uint8Array, fileName?: string): Json {
  return {
    channel,
    fileName: fileName ?? (channel === 'csv_file' ? 'resultados.csv' : 'resultados.json'),
    declaredSource: 'Acta ficticia de la liga',
    contentBase64: base64(content),
  };
}

export function formRequest(document: unknown): Json {
  return { channel: 'form', declaredSource: null, document };
}

// ---------------------------------------------------------------------------------------------------------------
// Harnesses
// ---------------------------------------------------------------------------------------------------------------

export interface ServiceHarness {
  readonly service: ImportService;
  readonly db: Db;
  readonly dataDir: string;
  readonly logLines: Array<{ fields: Readonly<Record<string, unknown>>; message: string }>;
  /** Number of rows in the import tables. */
  counts(): Record<string, number>;
  /** Entries under `<dataDir>/imports` (empty when the directory does not exist). */
  storedFiles(): string[];
  close(): void;
}

function countRows(db: Db): Record<string, number> {
  const counts: Record<string, number> = {};
  counts['imports'] = Number(db.prepare<{ n: number }>('SELECT count(*) AS n FROM imports').get()?.n ?? -1);
  counts['manual_competitions'] = Number(
    db.prepare<{ n: number }>('SELECT count(*) AS n FROM manual_competitions').get()?.n ?? -1,
  );
  counts['manual_seasons'] = Number(
    db.prepare<{ n: number }>('SELECT count(*) AS n FROM manual_seasons').get()?.n ?? -1,
  );
  counts['manual_selection_versions'] = Number(
    db.prepare<{ n: number }>('SELECT count(*) AS n FROM manual_selection_versions').get()?.n ?? -1,
  );
  return counts;
}

function listStored(dataDir: string): string[] {
  try {
    return readdirSync(join(dataDir, 'imports'), { recursive: true }).map(String).sort();
  } catch {
    return [];
  }
}

/** An import service on an in-memory migrated database and a temporary data directory. */
export function serviceHarness(options: { sources?: readonly Json[]; now?: () => Date } = {}): ServiceHarness {
  const dir = temporaryDirectory('imports');
  const config = importConfig(dir.path, options.sources);
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const logLines: ServiceHarness['logLines'] = [];
  const service = new ImportService({
    db,
    clock: { now: options.now ?? (() => new Date(FIXED_NOW)) },
    dataDir: dir.path,
    logger: { info: (fields, message) => logLines.push({ fields, message }) },
    sources: config.providers.sports.sources,
    catalogue: config.catalogue,
  });
  return {
    service,
    db,
    dataDir: dir.path,
    logLines,
    counts: () => countRows(db),
    storedFiles: () => listStored(dir.path),
    close: () => {
      db.close();
      dir.remove();
    },
  };
}

export interface AppHarness {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly db: Db;
  readonly dataDir: string;
  /** Captured log text (every level). */
  logText(): string;
  counts(): Record<string, number>;
  storedFiles(): string[];
  post(body: unknown): Promise<LightMyRequestResponse>;
  get(url: string): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

/** The application with the import routes, the real source registry (manual adapter) and a capturing logger. */
export async function appHarness(options: { sources?: readonly Json[]; catalogue?: Json } = {}): Promise<AppHarness> {
  const dir = temporaryDirectory('imports-app');
  const config = importConfig(dir.path, options.sources, options.catalogue);
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const chunks: string[] = [];
  const logger: Logger = createLogger({ level: 'trace', destination: { write: (line: string) => chunks.push(line) } });
  let tick = 0;
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    logger,
    // Each call one millisecond later, so imports have distinct receipt times.
    clock: { now: () => new Date(Date.parse(FIXED_NOW) + tick++) },
  });
  const app = await buildApp(container, { webRoot: null, modules: [serverModule] });
  await app.ready();
  return {
    app,
    container,
    db,
    dataDir: dir.path,
    logText: () => chunks.join(''),
    counts: () => countRows(db),
    storedFiles: () => listStored(dir.path),
    post: (body: unknown) =>
      app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI_HEADERS, payload: JSON.stringify(body) }),
    get: (url: string) => app.inject({ method: 'GET', url, headers: { host: TEST_HOST } }),
    close: async () => {
      await app.close();
      db.close();
      dir.remove();
    },
  };
}
