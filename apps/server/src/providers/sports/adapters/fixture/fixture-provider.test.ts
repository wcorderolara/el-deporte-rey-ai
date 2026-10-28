/**
 * FixtureDataProvider (contracts/provider-ports.md section 1.5): multi-competition file format, refs, `simulate`
 * modes, confinement to `fixtures/sports/`, no network request (R-241), removal without code change (R-282),
 * untrusted keys (T11H-F07) and errors without paths or values (T10-F10). Fixture files are written to a temporary
 * project root from inline synthetic payloads.
 */
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigError } from '../../../../platform/config/index.js';
import { type IngestionSource, type SourceRef, SourceError, asSourceRef, toDescriptor } from '../../ingestion/index.js';
import {
  FIXED_NOW,
  type FixtureRoot,
  type Json,
  type TestDeps,
  config,
  createFixtureRoot,
  cup,
  demoSource,
  deps,
  discovery,
  fixtureDocument,
  league,
  selection,
  stage,
  season,
  competition,
} from '../../test/synthetic.js';

import { SIMULATE_CODES, createFixtureSource } from './index.js';

let root: FixtureRoot;

beforeEach(() => {
  root = createFixtureRoot();
});

afterEach(() => {
  root.remove();
});

function fixture(
  sourceId = 'demo-a',
  options: Json = { scenario: 'default' },
): { source: IngestionSource; deps: TestDeps } {
  const testDeps = deps(root.rootDir);
  const configured = config([demoSource(sourceId, { options })]).providers.sports.sources[0]!;
  const source = createFixtureSource({
    source: configured,
    descriptor: toDescriptor(configured),
    setting: 'providers.sports.sources[0]',
    options: configured.options,
    deps: testDeps,
  });
  return { source, deps: testDeps };
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

describe('FixtureDataProvider listings', () => {
  it('lists competitions, seasons and stages with refs built from the file keys', async () => {
    root.write('default', 'demo-a', fixtureDocument([league(), cup()]));
    const { source } = fixture();
    const ctx = discovery();

    const competitions = await source.listCompetitions(ctx);
    expect(competitions.availability).toEqual({ available: true });
    expect(competitions.retrievedAt).toBe(FIXED_NOW);
    expect(competitions.items.map((item) => [item.localKey, item.name, item.ref])).toEqual([
      ['liga-sint', 'Liga Sintetica', '{"c":"liga-sint"}'],
      ['copa-sint', 'Copa Sintetica', '{"c":"copa-sint"}'],
    ]);

    const seasons = await source.listSeasons(competitions.items[1]!.ref, ctx);
    expect(seasons.items).toEqual([
      {
        ref: '{"c":"copa-sint","s":"2026"}',
        id: '2026',
        label: '2026/27',
        current: true,
        startDate: '2026-08-01',
        endDate: '2027-05-31',
        startYear: 2026,
      },
    ]);

    const stages = await source.listStages(competitions.items[1]!.ref, seasons.items[0]!.ref, ctx);
    expect(stages.items.map((item) => [item.id, item.name, item.order, item.standings])).toEqual([
      ['fase-liga', 'Fase de Liga', 1, 'expected'],
      ['octavos', 'Octavos de Final', 2, 'not_expected'],
      ['semifinal', 'Semifinal', 3, 'not_expected'],
      ['final', 'Final', 4, 'not_expected'],
    ]);
    expect(stages.items[0]?.matchdays.map((matchday) => matchday.number)).toEqual([1, 2]);
    expect(stages.items[0]?.matchdays[0]?.ref).toBe('{"c":"copa-sint","s":"2026","st":"fase-liga","md":1}');
    expect(stages.items[0]?.wholeStageRef).toBeNull();
    expect(stages.items[1]?.wholeStageRef).toBe('{"c":"copa-sint","s":"2026","st":"octavos","md":null}');
    expect(stages.items[1]?.matchdays).toEqual([]);
  });

  it('serves a selection with the source fields, the clock time and the default sourceRef', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    const { source } = fixture();
    const ref = asSourceRef('{"c":"liga-sint","s":"2026","st":"regular","md":2}');

    const snapshot = await source.fetchSelection(ref, discovery());
    expect(snapshot.sourceId).toBe('demo-a');
    expect(snapshot.mode).toBe('DEMO_DATA');
    expect(snapshot.retrievedAt).toBe(FIXED_NOW);
    expect(snapshot.fromCache).toBe(false);
    expect(snapshot.importVersionId).toBeNull();
    expect(snapshot.sourceRef).toBe('fixture:default/demo-a.json');
    expect(snapshot.stage).toEqual({ name: 'Fase Regular', matchday: 2, totalMatchdays: 6 });
  });

  it('keeps a sourceRef given in the file, and the file cannot override the source fields', async () => {
    const payload = { ...selection(), sourceRef: 'fixture:custom/file.json', sourceId: 'demo-b', mode: 'LIVE_DATA' };
    const doc = fixtureDocument([
      competition('liga', 'Liga', [
        season('2026', [{ ...stage({ id: 's', name: 'S', order: 1 }), matchdays: { '1': payload } }]),
      ]),
    ]);
    root.write('default', 'demo-a', doc);
    const snapshot = await fixture().source.fetchSelection(
      asSourceRef('{"c":"liga","s":"2026","st":"s","md":1}'),
      discovery(),
    );
    expect(snapshot.sourceRef).toBe('fixture:custom/file.json');
    expect(snapshot.sourceId).toBe('demo-a');
    expect(snapshot.mode).toBe('DEMO_DATA');
  });

  it('drops player-level fields from the selection and logs only the count (R-232)', async () => {
    const payload = selection();
    (payload['matches'] as Json[])[0]!['scorers'] = [{ player: 'Jugador Sintetico' }];
    const doc = fixtureDocument([
      competition('liga', 'Liga', [
        season('2026', [{ ...stage({ id: 's', name: 'S', order: 1 }), matchdays: { '1': payload } }]),
      ]),
    ]);
    root.write('default', 'demo-a', doc);
    const { source, deps: testDeps } = fixture();
    const snapshot = await source.fetchSelection(asSourceRef('{"c":"liga","s":"2026","st":"s","md":1}'), discovery());
    expect(JSON.stringify(snapshot)).not.toContain('Jugador');
    expect(testDeps.logger.lines[0]?.fields['strippedKeys']).toBe(1);
    expect(testDeps.logger.text()).not.toContain('Jugador');
  });

  it('rejects a malformed selection with a validation error naming the path (R-224)', async () => {
    const payload = selection();
    (payload['matches'] as Json[])[1]!['score'] = null;
    const doc = fixtureDocument([
      competition('liga', 'Liga', [
        season('2026', [{ ...stage({ id: 's', name: 'S', order: 1 }), matchdays: { '1': payload } }]),
      ]),
    ]);
    root.write('default', 'demo-a', doc);
    const error = await sourceError(
      fixture().source.fetchSelection(asSourceRef('{"c":"liga","s":"2026","st":"s","md":1}'), discovery()),
    );
    expect(error.code).toBe('invalid');
    expect(error.path).toBe('/matches/1/score');
  });

  it('performs no network request: the egress client is never called (R-241)', async () => {
    root.write('default', 'demo-a', fixtureDocument([league(), cup()]));
    const { source, deps: testDeps } = fixture();
    const ctx = discovery();
    const competitions = await source.listCompetitions(ctx);
    for (const item of competitions.items) {
      const seasons = await source.listSeasons(item.ref, ctx);
      for (const seasonItem of seasons.items) {
        const stages = await source.listStages(item.ref, seasonItem.ref, ctx);
        for (const stageItem of stages.items) {
          const refs: SourceRef[] = stageItem.matchdays.map((matchday) => matchday.ref);
          if (stageItem.wholeStageRef !== null) {
            refs.push(stageItem.wholeStageRef);
          }
          for (const ref of refs) {
            await source.fetchSelection(ref, ctx);
          }
        }
      }
    }
    expect(testDeps.egress.calls).toEqual([]);
  });

  it('reads the file on every call: a removed competition disappears without code change (R-282)', async () => {
    root.write('default', 'demo-a', fixtureDocument([league(), cup()]));
    const { source } = fixture();
    expect((await source.listCompetitions(discovery())).items).toHaveLength(2);
    root.write('default', 'demo-a', fixtureDocument([cup()]));
    expect((await source.listCompetitions(discovery())).items.map((item) => item.localKey)).toEqual(['copa-sint']);
    const error = await sourceError(source.listSeasons(asSourceRef('{"c":"liga-sint"}'), discovery()));
    expect(error.code).toBe('no_data');
  });
});

describe('FixtureDataProvider failures', () => {
  it.each(SIMULATE_CODES)('simulate %s makes every method throw that SourceError', async (code) => {
    root.write('default', 'demo-a', fixtureDocument([league()], code));
    const { source } = fixture();
    const ref = asSourceRef('{"c":"liga-sint","s":"2026","st":"regular","md":1}');
    for (const call of [
      () => source.listCompetitions(discovery()),
      () => source.listSeasons(ref, discovery()),
      () => source.listStages(ref, ref, discovery()),
      () => source.fetchSelection(ref, discovery()),
    ]) {
      const error = await sourceError(call());
      expect(error.code).toBe(code);
      expect(error.sourceId).toBe('demo-a');
      expect(error.retryAfterSeconds).toBe(code === 'rate_limited' ? 60 : null);
    }
  });

  it('rejects a file that is not JSON or not in the fixture format, without paths or values', async () => {
    root.write('default', 'demo-a', '{ not json');
    let error = await sourceError(fixture().source.listCompetitions(discovery()));
    expect(error.code).toBe('invalid');
    expect(error.message).not.toContain(root.rootDir);

    root.write('default', 'demo-a', { simulate: null, competitions: [{ localKey: 'x', name: 'X' }] });
    error = await sourceError(fixture().source.listCompetitions(discovery()));
    expect(error.code).toBe('invalid');
    expect(error.path).toBe('/competitions/0/areaName');

    root.write('default', 'demo-a', { simulate: 'explode', competitions: [] });
    expect((await sourceError(fixture().source.listCompetitions(discovery()))).path).toBe('/simulate');
  });

  it('rejects repeated keys in the file', async () => {
    root.write('default', 'demo-a', fixtureDocument([league(), league()]));
    const error = await sourceError(fixture().source.listCompetitions(discovery()));
    expect(error.code).toBe('invalid');
    expect(error.path).toBe('/competitions/1/localKey');
  });

  it('reports a missing file as unavailable without naming its path', async () => {
    const error = await sourceError(fixture().source.listCompetitions(discovery()));
    expect(error.code).toBe('unavailable');
    expect(JSON.stringify({ message: error.message, error })).not.toContain(root.rootDir);
  });

  it('refuses malformed refs and refs to entries the file does not contain', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    const { source } = fixture();
    expect((await sourceError(source.fetchSelection(asSourceRef('not json'), discovery()))).code).toBe('bad_request');
    expect((await sourceError(source.fetchSelection(asSourceRef('{"c":"liga-sint","x":1}'), discovery()))).code).toBe(
      'bad_request',
    );
    expect(
      (await sourceError(source.fetchSelection(asSourceRef('{"c":"liga-sint","s":"2026"}'), discovery()))).code,
    ).toBe('bad_request');
    const missing = asSourceRef('{"c":"liga-sint","s":"2026","st":"regular","md":9}');
    expect((await sourceError(source.fetchSelection(missing, discovery()))).code).toBe('no_data');
    const noWhole = asSourceRef('{"c":"liga-sint","s":"2026","st":"regular","md":null}');
    expect((await sourceError(source.fetchSelection(noWhole, discovery()))).code).toBe('no_data');
  });

  it('handles __proto__, constructor, prototype and toString as keys and names (T11H-F07)', async () => {
    const stages = [
      stage({ id: 'constructor', name: '__proto__', order: 1, matchdays: [1] }),
      stage({ id: 'prototype', name: 'toString', order: 2, matchdays: [1] }),
      stage({ id: 'tostring', name: 'constructor', order: 3, wholeStage: true }),
    ];
    root.write(
      'default',
      'demo-a',
      fixtureDocument([competition('constructor', 'Liga Proto', [season('prototype', stages)])]),
    );
    const { source } = fixture();
    const [entry] = (await source.listCompetitions(discovery())).items;
    expect(entry?.localKey).toBe('constructor');
    const [seasonItem] = (await source.listSeasons(entry!.ref, discovery())).items;
    const listed = await source.listStages(entry!.ref, seasonItem!.ref, discovery());
    expect(listed.items.map((item) => [item.id, item.name])).toEqual([
      ['constructor', '__proto__'],
      ['prototype', 'toString'],
      ['tostring', 'constructor'],
    ]);
    expect(
      (
        await source.fetchSelection(
          asSourceRef('{"c":"constructor","s":"prototype","st":"tostring","md":null}'),
          discovery(),
        )
      ).stage.name,
    ).toBe('constructor');
    // Lookups of inherited member names that are not in the file find nothing.
    expect((await sourceError(source.listSeasons(asSourceRef('{"c":"toString"}'), discovery()))).code).toBe('no_data');
    expect((await sourceError(source.listSeasons(asSourceRef('{"c":"__proto__"}'), discovery()))).code).toBe('no_data');

    // A __proto__ matchday key is not a matchday number: the file is rejected.
    root.write(
      'default',
      'demo-a',
      '{"simulate":null,"competitions":[{"localKey":"x","name":"X","areaName":null,"seasons":[{"id":"s","label":"S","current":true,"startDate":null,"endDate":null,"startYear":null,"stages":[{"id":"a","name":"A","order":1,"standings":"unknown","wholeStage":null,"matchdays":{"__proto__":{}}}]}]}]}',
    );
    expect((await sourceError(source.listCompetitions(discovery()))).code).toBe('invalid');
  });
});

describe('FixtureDataProvider startup validation', () => {
  it('accepts an existing scenario file', () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    expect(() => fixture().source.validateStartup?.()).not.toThrow();
  });

  it.each([{ scenario: '../escape' }, { scenario: 'UPPER' }, { scenario: '' }, {}, { scenario: 'default', extra: 1 }])(
    'refuses invalid options %j naming options.scenario',
    (options) => {
      const error = configError(() => fixture('demo-a', options).source.validateStartup?.());
      expect(error.setting).toBe('providers.sports.sources[0].options.scenario');
      expect(error.message).not.toContain('escape');
    },
  );

  it('refuses a scenario without a file for the source', () => {
    const error = configError(() => fixture().source.validateStartup?.());
    expect(error.message).toContain("fixture file for the source 'demo-a'");
    expect(error.message).not.toContain(root.rootDir);
  });

  it('refuses a fixture file that links outside fixtures/sports', async () => {
    const outside = join(root.rootDir, 'outside.json');
    writeFileSync(outside, JSON.stringify(fixtureDocument([league()])));
    mkdirSync(join(root.rootDir, 'fixtures', 'sports', 'default'), { recursive: true });
    symlinkSync(outside, join(root.rootDir, 'fixtures', 'sports', 'default', 'demo-a.json'));
    const { source } = fixture();
    expect(() => source.validateStartup?.()).toThrow(ConfigError);
    expect((await sourceError(source.listCompetitions(discovery()))).code).toBe('unavailable');
  });
});
