/**
 * Test-only support of the projects integration tests: a temporary project root with synthetic DEMO_DATA fixture
 * files for the fixture adapter, a counting stub source kind registered through the `createSportsSources` test seam,
 * a container over an in-memory database and the app with the projects module. All data is invented; nothing opens
 * a non-loopback connection. Not used by production code.
 */
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../../../app.js';
import { type AppContainer, createContainer } from '../../../container.js';
import type { AppConfig } from '../../../platform/config/index.js';
import { type SqliteDatabase, openMigratedDatabase } from '../../../platform/db/index.js';
import { createLogger } from '../../../platform/http/index.js';
import { createAiProvider } from '../../../providers/ai/index.js';
import { createSportsSources } from '../../../providers/sports/index.js';
import {
  FIXED_NOW,
  type FixtureRoot,
  type Json,
  type StubAdapter,
  competition,
  config as buildConfig,
  createFixtureRoot,
  cup,
  demoSource,
  fixtureDocument,
  league,
  season,
  stage,
  stubAdapter,
  stubSource,
} from '../../../providers/sports/test/synthetic.js';
import type { StageProvider } from '../../../workflow/index.js';
import { type ProjectsModule, createProjectsModule } from '../index.js';

export const HOST = '127.0.0.1:4300';
export const ORIGIN = 'http://127.0.0.1:4300';

/** Headers of a well-formed mutating request from the UI. */
export const WRITE_HEADERS = Object.freeze({
  host: HOST,
  origin: ORIGIN,
  'x-edr-client': 'web',
  'content-type': 'application/json',
});

export const READ_HEADERS = Object.freeze({ host: HOST });

/** Adapter kind of the counting stub (declared mode LIVE_DATA). */
export const STUB_KIND = 'test-live';

/** The DEMO_DATA fixture of `demo-a` and `demo-b`: a league-style and a cup-style competition. */
export function demoFixture(): Json {
  return fixtureDocument([league('liga-demo', 'Liga Demo'), cup('copa-demo', 'Copa Demo')]);
}

/** The stub document of a LIVE-shaped source: one league and one competition with an empty season list. */
export function stubFixture(): Json {
  return fixtureDocument([
    league('liga-stub', 'Liga Stub'),
    competition('copa-stub', 'Copa Stub', [
      season('2026', [stage({ id: 'grupos', name: 'Fase de Grupos', order: 1, matchdays: [1] })]),
    ]),
  ]);
}

/** Catalogue links: the DEMO competitions across `demo-a` and `demo-b`; the stub league across two stub sources. */
export function testCatalogue(): Json {
  return {
    links: [
      {
        id: 'copa-demo',
        name: 'Copa Demo',
        reference: true,
        bindings: [
          { sourceId: 'demo-a', competitionRef: 'copa-demo' },
          { sourceId: 'demo-b', competitionRef: 'copa-demo' },
        ],
      },
      {
        id: 'liga-demo',
        name: 'Liga Demo',
        reference: false,
        bindings: [
          { sourceId: 'demo-a', competitionRef: 'liga-demo' },
          { sourceId: 'demo-b', competitionRef: 'liga-demo' },
        ],
      },
      {
        id: 'liga-stub',
        name: 'Liga Stub',
        reference: false,
        bindings: [
          { sourceId: 'stub-a', competitionRef: 'liga-stub' },
          { sourceId: 'stub-b', competitionRef: 'liga-stub' },
        ],
      },
    ],
    restrictToLinks: false,
  };
}

/** Sources: two DEMO fixture sources (primary and verification) and two stub sources of the LIVE-shaped kind. */
export function testSources(overrides: { readonly stubBEnabled?: boolean } = {}): Json[] {
  return [
    demoSource('demo-a'),
    demoSource('demo-b', { role: 'verification', officialPublication: true }),
    stubSource('stub-a', STUB_KIND, 'LIVE_DATA'),
    stubSource('stub-b', STUB_KIND, 'LIVE_DATA', { enabled: overrides.stubBEnabled ?? true }),
  ];
}

export interface ProjectsTestApp {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly db: SqliteDatabase;
  readonly config: AppConfig;
  readonly stub: StubAdapter;
  readonly fixtures: FixtureRoot;
  readonly module: ProjectsModule;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export interface ProjectsTestOptions {
  readonly sources?: readonly Json[];
  readonly catalogue?: Json;
  readonly stages?: StageProvider;
  /** Extra settings merged into the application document. */
  readonly app?: Json;
  /** Reuses a fixture root and stub (to restart with another configuration). */
  readonly fixtures?: FixtureRoot;
  readonly stub?: StubAdapter;
  /** Run the module's startup hook (default true). */
  readonly startup?: boolean;
}

/** Builds the app with the projects module over a fresh in-memory database. */
export async function projectsTestApp(options: ProjectsTestOptions = {}): Promise<ProjectsTestApp> {
  const fixtures = options.fixtures ?? createFixtureRoot();
  if (options.fixtures === undefined) {
    fixtures.write('default', 'demo-a', demoFixture());
    fixtures.write('default', 'demo-b', demoFixture());
  }
  const stub = options.stub ?? stubAdapter(STUB_KIND, 'LIVE_DATA');
  if (options.stub === undefined) {
    stub.documents.set('stub-a', stubFixture());
    stub.documents.set('stub-b', stubFixture());
  }
  const config = buildConfig(options.sources ?? testSources(), options.catalogue ?? testCatalogue(), fixtures.rootDir);
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    clock: { now: () => new Date(FIXED_NOW) },
    logger: createLogger({ level: 'silent' }),
    providers: {
      createSportsSources: (sportsConfig, deps) =>
        createSportsSources(sportsConfig, deps, { extraAdapters: [stub.registration] }),
      createAiProvider,
    },
  });
  const module = createProjectsModule(options.stages === undefined ? {} : { stages: options.stages });
  if (options.startup !== false) {
    await module.onStartup?.(container);
  }
  const app = await buildApp(container, { webRoot: null, modules: [module] });
  await app.ready();
  return {
    app,
    container,
    db,
    config,
    stub,
    fixtures,
    module,
    inject: (request) => app.inject(request),
    close: async () => {
      await app.close();
      db.close();
      if (options.fixtures === undefined) {
        fixtures.remove();
      }
    },
  };
}

/** A project creation body. */
export function selectionBody(
  competitionId: string,
  sourceId: string,
  seasonId: string,
  stageId: string,
  matchday: number | null,
  extra: Json = {},
): Json {
  return { competitionId, sourceId, seasonId, stageId, matchday, ...extra };
}
