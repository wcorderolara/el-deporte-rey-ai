/**
 * `createSportsSources` and the source registry (contracts/provider-ports.md section 1.2; AD-22, AD-37, OD-20,
 * OD-24): startup rules, the `extraAdapters` test seam, validation of every adapter output (R-224, R-267), swapping a
 * source's adapter by configuration only (R-223), and no adapter import in the ingestion layer (R-118, R-268).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SelectionSnapshotSchema } from '@edr/contracts';
import { type FastifyBaseLogger, fastify } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { ConfigError, type PathsConfig } from '../../platform/config/index.js';
import { EgressError } from '../../platform/net/index.js';

import {
  ADAPTER_KINDS,
  type AdapterRegistration,
  type IngestionSource,
  type SourceRegistry,
  SourceError,
  createSportsSources,
} from './index.js';
import {
  type FixtureRoot,
  type Json,
  config,
  createFixtureRoot,
  demoSource,
  deps,
  discovery,
  fixtureDocument,
  league,
  stubAdapter,
  stubSource,
} from './test/synthetic.js';

let root: FixtureRoot;

beforeEach(() => {
  root = createFixtureRoot();
});

afterEach(() => {
  root.remove();
});

function configError(action: () => unknown): ConfigError {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a ConfigError');
}

async function sourceError(promise: Promise<unknown>): Promise<SourceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SourceError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a SourceError');
}

/** A registration whose sources fail startup with the given error. */
function failingStartup(kind: string, error: () => Error): AdapterRegistration {
  return {
    kind,
    mode: 'DEMO_DATA',
    create: ({ descriptor }): IngestionSource => ({
      descriptor,
      listCompetitions: () => Promise.reject(new Error('unused')),
      listSeasons: () => Promise.reject(new Error('unused')),
      listStages: () => Promise.reject(new Error('unused')),
      fetchSelection: () => Promise.reject(new Error('unused')),
      validateStartup: () => {
        throw error();
      },
    }),
  };
}

/** The same selection flow for any registry: catalogue, seasons, stages, selection, snapshot. */
async function firstMatchday(registry: SourceRegistry, sourceId: string): Promise<Json> {
  const ctx = discovery();
  const catalogue = await registry.catalogue.listCatalogue(ctx);
  const entry = catalogue.competitions.find((competition) => competition.sources.some((s) => s.sourceId === sourceId));
  const seasons = await registry.catalogue.listSeasons(entry!.id, sourceId, ctx);
  const seasonId = seasons.found ? seasons.listing.items[0]!.id : '';
  const stages = await registry.catalogue.listStages(entry!.id, sourceId, seasonId, ctx);
  const stageItem = stages.found ? stages.listing.items[0]! : undefined;
  const resolved = await registry.catalogue.resolveSelection(
    { competitionId: entry!.id, sourceId, seasonId, stageId: stageItem!.id, matchday: stageItem!.matchdays[0]!.number },
    ctx,
  );
  if (!resolved.ok) {
    throw new Error('selection not resolved');
  }
  const snapshot = await registry
    .get(sourceId)!
    .fetchSelection(resolved.selection.selectionRef, { ...ctx, purpose: 'research' });
  return {
    catalogueId: entry!.id,
    labels: [resolved.selection.competitionName, resolved.selection.stageName],
    snapshot,
  };
}

function core(snapshot: unknown): Json {
  const value = snapshot as Json;
  return {
    competition: value['competition'],
    season: value['season'],
    stage: value['stage'],
    teams: value['teams'],
    matches: value['matches'],
    standings: value['standings'],
    context: value['context'],
  };
}

describe('createSportsSources startup rules', () => {
  it('lists the production adapter kinds without any test-only kind', () => {
    expect(ADAPTER_KINDS).toContain('fixture');
    expect(ADAPTER_KINDS).toContain('manual');
    expect(ADAPTER_KINDS).not.toContain('test-live');
  });

  it('registers only enabled sources, in configuration order', () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    root.write('default', 'demo-c', fixtureDocument([league()]));
    const registry = createSportsSources(
      config([demoSource('demo-a'), demoSource('demo-b', { enabled: false }), demoSource('demo-c')]),
      deps(root.rootDir),
    );
    expect(registry.sourceIds).toEqual(['demo-a', 'demo-c']);
    expect(registry.get('demo-b')).toBeUndefined();
    expect(registry.descriptors[0]).toEqual({
      id: 'demo-a',
      name: 'Synthetic demo-a',
      mode: 'DEMO_DATA',
      adapter: 'fixture',
      role: 'primary',
      officialPublication: false,
      accepted: true,
      independenceGroup: 'demo-a',
      publicationPermission: 'not_applicable',
      enabled: true,
    });
  });

  it('refuses an adapter kind that is not registered, naming the setting and never the value', () => {
    const error = configError(() =>
      createSportsSources(config([demoSource('demo-a', { adapter: 'test-live' })]), deps(root.rootDir)),
    );
    expect(error.setting).toBe('providers.sports.sources[0].adapter');
    expect(error.message).toContain("source 'demo-a'");
    expect(error.message).not.toContain('test-live');
  });

  it('refuses a source whose mode differs from its adapter mode (OD-20)', () => {
    const error = configError(() =>
      createSportsSources(config([demoSource('demo-a', { mode: 'MANUAL_DATA', accepted: false })]), deps(root.rootDir)),
    );
    expect(error.setting).toBe('providers.sports.sources[0].mode');
    expect(error.message).toContain('declared mode of its adapter (DEMO_DATA)');
  });

  it('refuses a catalogue link name that is not a display name (T10-F06)', () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    const links = {
      links: [
        { id: 'liga', name: 'Liga\u200BSintetica', bindings: [{ sourceId: 'demo-a', competitionRef: 'liga-sint' }] },
      ],
    };
    const error = configError(() => createSportsSources(config([demoSource('demo-a')], links), deps(root.rootDir)));
    expect(error.setting).toBe('catalogue.links[0].name');
  });

  it('runs every enabled adapter validateStartup and reports all problems in one error without values', () => {
    const extraAdapters = [
      failingStartup('broken-config', () => new ConfigError('providers.sports.sources[0].options.x', 'is invalid')),
      failingStartup('broken-other', () => new Error(`leaked ${TEST_MARKER_TOKEN} /Users/someone/file.json`)),
    ];
    const sources = [
      demoSource('demo-a', { adapter: 'broken-config', options: {} }),
      demoSource('demo-b', { adapter: 'broken-other', options: {} }),
      demoSource('demo-c', { adapter: 'broken-other', options: {}, enabled: false }),
    ];
    const error = configError(() => createSportsSources(config(sources), deps(root.rootDir), { extraAdapters }));
    expect(error.issues.map((issue) => issue.setting)).toEqual([
      'providers.sports.sources[0].options.x',
      'providers.sports.sources[1].options',
    ]);
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    expect(error.message).not.toContain('/Users');
  });

  it('turns a factory failure into a configuration error with fixed text', () => {
    const throwing: AdapterRegistration = {
      kind: 'throwing',
      mode: 'DEMO_DATA',
      create: () => {
        throw new Error(TEST_MARKER_TOKEN);
      },
    };
    const error = configError(() =>
      createSportsSources(config([demoSource('demo-a', { adapter: 'throwing' })]), deps(root.rootDir), {
        extraAdapters: [throwing],
      }),
    );
    expect(error.setting).toBe('providers.sports.sources[0].options');
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
  });
});

describe('createSportsSources test seam (OD-24, AD-37)', () => {
  it('registers a test-only LIVE_DATA kind only when the seam passes it', async () => {
    const testLive = stubAdapter('test-live', 'LIVE_DATA');
    testLive.documents.set('live-b', fixtureDocument([league()]));
    const appConfig = config([stubSource('live-b', 'test-live', 'LIVE_DATA')]);

    expect(() => createSportsSources(appConfig, deps(root.rootDir))).toThrow(ConfigError);

    const registry = createSportsSources(appConfig, deps(root.rootDir), { extraAdapters: [testLive.registration] });
    expect(registry.descriptors.map((d) => [d.id, d.mode, d.adapter])).toEqual([['live-b', 'LIVE_DATA', 'test-live']]);
    const result = await firstMatchday(registry, 'live-b');
    expect((result['snapshot'] as Json)['sourceRef']).toBe('source:live-b/matches@2026-10-27T12:00:00.000Z');
  });

  it('refuses a test-only kind that repeats a registered kind', () => {
    const duplicate = stubAdapter('fixture', 'DEMO_DATA');
    expect(() =>
      createSportsSources(config([demoSource('demo-a')]), deps(root.rootDir), {
        extraAdapters: [duplicate.registration],
      }),
    ).toThrow('adapter kind registered twice');
  });
});

describe('registry validation of adapter output', () => {
  function stubRegistry(): { registry: SourceRegistry; stub: ReturnType<typeof stubAdapter> } {
    const stub = stubAdapter('stub-demo', 'DEMO_DATA');
    stub.documents.set('demo-a', fixtureDocument([league()]));
    const registry = createSportsSources(
      config([demoSource('demo-a', { adapter: 'stub-demo', options: {} })]),
      deps(root.rootDir),
      { extraAdapters: [stub.registration] },
    );
    return { registry, stub };
  }

  it('rejects malformed adapter output with a validation error (R-224)', async () => {
    const { registry, stub } = stubRegistry();
    stub.overrides.set('demo-a/fetchSelection', { sourceId: 'demo-a', mode: 'DEMO_DATA', teams: 'none' });
    const error = await sourceError(registry.get('demo-a')!.fetchSelection('{}' as never, discovery()));
    expect(error.code).toBe('invalid');
    expect(error.path).not.toBeNull();

    stub.overrides.set('demo-a/listCompetitions', { items: [{ localKey: 'x' }] });
    expect((await sourceError(registry.get('demo-a')!.listCompetitions(discovery()))).code).toBe('invalid');
  });

  it('drops person fields from adapter output before it reaches core code (R-232, R-280)', async () => {
    const { registry } = stubRegistry();
    const { snapshot } = (await firstMatchday(registry, 'demo-a')) as { snapshot: Json };
    expect(JSON.stringify(snapshot)).not.toMatch(/scorer|referee|coach|squad|player/i);
    const withPersons = createFixtureDocWithPersons();
    root.write('default', 'demo-x', withPersons);
    const fixtureRegistry = createSportsSources(config([demoSource('demo-x')]), deps(root.rootDir));
    const result = (await firstMatchday(fixtureRegistry, 'demo-x')) as { snapshot: Json };
    expect(JSON.stringify(result.snapshot)).not.toMatch(/Jugador|Arbitro|scorers|referees/);
  });

  it('normalizes adapter failures: unknown errors, egress errors, other sources and cancellation', async () => {
    const { registry, stub } = stubRegistry();
    const source = registry.get('demo-a')!;

    stub.overrides.set('demo-a/listCompetitions', new TypeError('/Users/someone/secret.json'));
    let error = await sourceError(source.listCompetitions(discovery()));
    expect([error.code, error.sourceId, error.message]).toEqual(['unavailable', 'demo-a', 'source adapter failed']);

    stub.overrides.set('demo-a/listCompetitions', new EgressError('timeout', 'https://host.example.test/?q=1'));
    error = await sourceError(source.listCompetitions(discovery()));
    expect(error.code).toBe('timeout');
    expect(error.message).not.toContain('example.test');

    stub.overrides.set(
      'demo-a/listCompetitions',
      new SourceError('access_refused', 'fixed', 'other-source', null, 401),
    );
    error = await sourceError(source.listCompetitions(discovery()));
    expect([error.code, error.sourceId, error.httpStatus]).toEqual(['access_refused', 'demo-a', 401]);

    stub.overrides.delete('demo-a/listCompetitions');
    const controller = new AbortController();
    controller.abort();
    const before = stub.count('demo-a', 'listCompetitions');
    error = await sourceError(source.listCompetitions({ signal: controller.signal, purpose: 'discovery' }));
    expect(error.code).toBe('unavailable');
    expect(stub.count('demo-a', 'listCompetitions')).toBe(before);
  });
});

function createFixtureDocWithPersons(): Json {
  const doc = fixtureDocument([league()]);
  const stageItem = (((doc['competitions'] as Json[])[0]!['seasons'] as Json[])[0]!['stages'] as Json[])[0]! as Json;
  const payload = (stageItem['matchdays'] as Json)['1'] as Json;
  (payload['matches'] as Json[])[0]!['scorers'] = [{ name: 'Jugador Sintetico' }];
  (payload['matches'] as Json[])[0]!['referees'] = [{ name: 'Arbitro Sintetico' }];
  return doc;
}

describe('swapping adapters and modes', () => {
  it('swaps a source adapter by configuration only and the same flow runs unchanged (R-223)', async () => {
    root.write('default', 'main', fixtureDocument([league()]));
    const stub = stubAdapter('stub-demo', 'DEMO_DATA');
    stub.documents.set('main', fixtureDocument([league()]));

    const withFixture = createSportsSources(config([demoSource('main')]), deps(root.rootDir), {
      extraAdapters: [stub.registration],
    });
    const withStub = createSportsSources(
      config([demoSource('main', { adapter: 'stub-demo', options: {} })]),
      deps(root.rootDir),
      { extraAdapters: [stub.registration] },
    );

    const a = await firstMatchday(withFixture, 'main');
    const b = await firstMatchday(withStub, 'main');
    expect(a['catalogueId']).toBe('main-liga-sint');
    expect(b['catalogueId']).toBe(a['catalogueId']);
    expect(b['labels']).toEqual(a['labels']);
    expect(core(b['snapshot'])).toEqual(core(a['snapshot']));
    expect(stub.count('main', 'fetchSelection')).toBe(1);
  });

  it('gives every mode one schema: equal representations apart from mode, source metadata and times (R-267)', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    const live = stubAdapter('test-live', 'LIVE_DATA');
    const manual = stubAdapter('stub-manual', 'MANUAL_DATA');
    live.documents.set('live-a', fixtureDocument([league()]));
    manual.documents.set('manual-a', fixtureDocument([league()]));
    const registry = createSportsSources(
      config([
        demoSource('demo-a'),
        stubSource('live-a', 'test-live', 'LIVE_DATA'),
        stubSource('manual-a', 'stub-manual', 'MANUAL_DATA'),
      ]),
      deps(root.rootDir),
      { extraAdapters: [live.registration, manual.registration] },
    );

    const snapshots = await Promise.all(
      ['demo-a', 'live-a', 'manual-a'].map(async (id) => (await firstMatchday(registry, id))['snapshot']),
    );
    for (const snapshot of snapshots) {
      expect(SelectionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    }
    expect(snapshots.map((s) => (s as Json)['mode'])).toEqual(['DEMO_DATA', 'LIVE_DATA', 'MANUAL_DATA']);
    expect(core(snapshots[1])).toEqual(core(snapshots[0]));
    expect(core(snapshots[2])).toEqual(core(snapshots[0]));
  });
});

describe('ingestion layer boundaries (R-118, R-268)', () => {
  it('imports no adapter outside the entry point and the adapter registry', () => {
    const directory = fileURLToPath(new URL('./ingestion/', import.meta.url));
    const files = readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(readFileSync(join(directory, name), 'utf8')).not.toMatch(/from '[^']*adapters\//);
    }
    const entry = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');
    expect(entry.match(/from '[^']*adapters\/[^']*'/g)).toEqual(["from './adapters/index.js'"]);
  });
});

describe('composition root seam (T19)', () => {
  it('accepts the container dependencies: a Fastify logger, a frozen null-prototype environment and PathsConfig', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    const app = fastify({ logger: false });
    const logger: FastifyBaseLogger = app.log;
    const env = Object.freeze(
      Object.assign(Object.create(null) as Record<string, string | undefined>, { EDR_PORT: '4300' }),
    );
    const paths: PathsConfig = { rootDir: root.rootDir, dataDir: join(root.rootDir, 'data') };
    const testDeps = deps(root.rootDir);
    const registry: SourceRegistry = createSportsSources(config([demoSource('demo-a')], undefined, root.rootDir), {
      egress: testDeps.egress,
      env,
      clock: { now: () => new Date('2026-10-27T12:00:00.000Z') },
      db: testDeps.db,
      paths,
      logger,
    });
    expect(() => registry.validateStartup()).not.toThrow();
    expect((await registry.catalogue.listCatalogue(discovery())).competitions.map((entry) => entry.id)).toEqual([
      'demo-a-liga-sint',
    ]);
    await app.close();
  });
});
