/**
 * Test-only support of the verification integration tests: a temporary project root with synthetic DEMO_DATA
 * fixtures and identity maps, stub adapter kinds `test-live` (LIVE_DATA) and `test-manual` (MANUAL_DATA) registered
 * through the `createSportsSources` test seam (AD-37), a container over an in-memory database, the projects module
 * with the real research and verification stages and fake later stages, and the facts routes. All data is invented;
 * nothing opens a non-loopback connection. Not used by production code.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../../../app.js';
import { type AppContainer, createContainer } from '../../../container.js';
import { type SqliteDatabase, openMigratedDatabase } from '../../../platform/db/index.js';
import { createLogger } from '../../../platform/http/index.js';
import { createAiProvider } from '../../../providers/ai/index.js';
import { createSportsSources } from '../../../providers/sports/index.js';
import {
  FIXED_NOW,
  type FixtureRoot,
  type Json,
  type StubAdapter,
  TEST_IMPORT_VERSION_ID,
  config as buildConfig,
  createFixtureRoot,
  demoSource,
  fixtureDocument,
  league,
  stubAdapter,
  stubSource,
} from '../../../providers/sports/test/synthetic.js';
import { fakeStage } from '../../../workflow/test/support.js';
import { type ProjectsModule, createProjectsModule } from '../../projects/index.js';
import { researchStage } from '../../research/index.js';
import { TEAM_IDENTITIES_DIRECTORY } from '../identity.js';
import { serverModule as verificationModule } from '../index.js';
import { verificationStage } from '../stage.js';

export const HOST = '127.0.0.1:4300';
export const WRITE_HEADERS = Object.freeze({ host: HOST, origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' });
export const READ_HEADERS = Object.freeze({ host: HOST });

export const LIVE_KIND = 'test-live';
export const MANUAL_KIND = 'test-manual';

export function liveDocument(): Json {
  return fixtureDocument([
    league('liga-live', 'Liga Live'),
    league('liga-solo', 'Liga Solo'),
    league('liga-mixta', 'Liga Mixta'),
  ]);
}

export function manualDocument(): Json {
  return fixtureDocument([
    league('liga-local', 'Liga Local'),
    league('copa-manual', 'Copa Manual'),
    league('liga-mixta', 'Liga Mixta'),
  ]);
}

/** The selection payload of matchday 1 of a league document (mutable). */
export function matchday1(document: Json, localKey: string): Json {
  const competitions = document['competitions'] as Json[];
  const competition = competitions.find((entry) => entry['localKey'] === localKey) as Json;
  const season = (competition['seasons'] as Json[])[0] as Json;
  const stage = (season['stages'] as Json[])[0] as Json;
  return (stage['matchdays'] as Json)['1'] as Json;
}

export function testCatalogue(options: SourceOptions = {}): Json {
  const liveOfficial = options.liveOfficial === true ? [{ sourceId: 'live-o', competitionRef: 'liga-live' }] : [];
  return {
    links: [
      {
        id: 'liga-demo',
        name: 'Liga Demo',
        bindings: [
          { sourceId: 'demo-a', competitionRef: 'liga-demo' },
          { sourceId: 'demo-b', competitionRef: 'liga-demo' },
        ],
      },
      {
        id: 'liga-live',
        name: 'Liga Live',
        bindings: [
          { sourceId: 'live-a', competitionRef: 'liga-live' },
          { sourceId: 'live-b', competitionRef: 'liga-live' },
          ...liveOfficial,
        ],
      },
      {
        id: 'liga-local',
        name: 'Liga Local',
        noAcceptedPublicSource: true,
        bindings: [{ sourceId: 'manual-a', competitionRef: 'liga-local' }],
      },
      {
        id: 'liga-mixta',
        name: 'Liga Mixta',
        bindings: [
          { sourceId: 'manual-a', competitionRef: 'liga-mixta' },
          { sourceId: 'live-b', competitionRef: 'liga-mixta' },
          { sourceId: 'live-c', competitionRef: 'liga-mixta' },
        ],
      },
    ],
    restrictToLinks: false,
  };
}

export interface SourceOptions {
  readonly liveBPermission?: 'unconfirmed' | 'confirmed';
  readonly liveCEnabled?: boolean;
  /**
   * Adds `live-o`, an enabled LIVE_DATA official-publication verification source of its own independence group,
   * bound to `liga-live` after `live-a` and `live-b` (the official consultation of a dispute, OD-56). Off by default.
   */
  readonly liveOfficial?: boolean;
}

export function testSources(options: SourceOptions = {}): Json[] {
  const confirmed =
    options.liveBPermission === 'confirmed'
      ? { publicationPermission: 'confirmed', publicationPermissionDecision: 'PD-18' }
      : {};
  return [
    demoSource('demo-a'),
    demoSource('demo-b', { role: 'verification', officialPublication: true }),
    stubSource('live-a', LIVE_KIND, 'LIVE_DATA', confirmed),
    stubSource('live-b', LIVE_KIND, 'LIVE_DATA', { role: 'verification', ...confirmed }),
    stubSource('live-c', LIVE_KIND, 'LIVE_DATA', { role: 'verification', enabled: options.liveCEnabled ?? false }),
    stubSource('manual-a', MANUAL_KIND, 'MANUAL_DATA'),
    ...(options.liveOfficial === true
      ? [stubSource('live-o', LIVE_KIND, 'LIVE_DATA', { role: 'verification', officialPublication: true })]
      : []),
  ];
}

export interface VerificationTestApp {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly db: SqliteDatabase;
  readonly live: StubAdapter;
  readonly manual: StubAdapter;
  readonly fixtures: FixtureRoot;
  readonly projects: ProjectsModule;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

/** Writes an identity map under the fixture root's `config/team-identities/`. */
export function writeIdentityMap(fixtures: FixtureRoot, name: string, content: Json): void {
  const directory = join(fixtures.rootDir, TEAM_IDENTITIES_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), JSON.stringify(content), 'utf8');
}

/** Inserts the synthetic MANUAL_DATA import version that the manual stub's snapshots name (foreign keys). */
function insertManualVersion(db: SqliteDatabase): void {
  const importId = '00000000-0000-4000-8000-0000000000a1';
  db.prepare(
    'INSERT INTO imports (id, source_id, channel, file_name, declared_source, competition_id, season_id, ' +
      'original_path, original_sha256, original_bytes, received_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)',
  ).run([
    importId,
    'manual-a',
    'json_file',
    'datos.json',
    'liga-local',
    '2026',
    'imports/x',
    'a'.repeat(64),
    10,
    FIXED_NOW,
  ]);
  db.prepare(
    'INSERT INTO manual_competitions (competition_id, source_id, name, area_name, first_import_id) VALUES (?, ?, ?, NULL, ?)',
  ).run(['liga-local', 'manual-a', 'Liga Local', importId]);
  db.prepare('INSERT INTO manual_seasons (competition_id, season_id, label) VALUES (?, ?, ?)').run([
    'liga-local',
    '2026',
    '2026/27',
  ]);
  db.prepare(
    'INSERT INTO manual_selection_versions (id, import_id, competition_id, season_id, stage_id, stage_name, ' +
      "stage_order, matchday_key, version_number, data, created_at, superseded_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, '{}', ?, NULL)",
  ).run([TEST_IMPORT_VERSION_ID, importId, 'liga-local', '2026', 'regular', 'Fase Regular', FIXED_NOW]);
}

/** A clock that advances one millisecond per reading from the fixed synthetic time. */
function steppingClock(): { now(): Date } {
  let time = Date.parse(FIXED_NOW);
  return {
    now: () => {
      time += 1;
      return new Date(time);
    },
  };
}

export async function verificationTestApp(options: SourceOptions = {}): Promise<VerificationTestApp> {
  const fixtures = createFixtureRoot();
  fixtures.write('default', 'demo-a', fixtureDocument([league('liga-demo', 'Liga Demo')]));
  fixtures.write('default', 'demo-b', fixtureDocument([league('liga-demo', 'Liga Demo')]));
  const live = stubAdapter(LIVE_KIND, 'LIVE_DATA');
  for (const id of ['live-a', 'live-b', 'live-c', 'live-o']) {
    live.documents.set(id, liveDocument());
  }
  const manual = stubAdapter(MANUAL_KIND, 'MANUAL_DATA');
  manual.documents.set('manual-a', manualDocument());
  const config = buildConfig(testSources(options), testCatalogue(options), fixtures.rootDir);
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    clock: steppingClock(),
    logger: createLogger({ level: 'silent' }),
    providers: {
      createSportsSources: (sportsConfig, deps) =>
        createSportsSources(sportsConfig, deps, { extraAdapters: [live.registration, manual.registration] }),
      createAiProvider,
    },
  });
  const projects = createProjectsModule({
    stages: () => [
      researchStage,
      verificationStage,
      fakeStage('content', []),
      fakeStage('rendering', []),
      fakeStage('visual_qa', []),
    ],
  });
  await projects.onStartup?.(container);
  insertManualVersion(db);
  const app = await buildApp(container, { webRoot: null, modules: [projects, verificationModule] });
  await app.ready();
  return {
    app,
    container,
    db,
    live,
    manual,
    fixtures,
    projects,
    inject: (request) => app.inject(request),
    close: async () => {
      await app.close();
      db.close();
      fixtures.remove();
    },
  };
}
