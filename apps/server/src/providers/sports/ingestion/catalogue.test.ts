/**
 * Catalogue service (contracts/provider-ports.md section 1.2, architecture.md section 15.2): merge of all enabled
 * sources (R-243, R-282), stages by the source's names (R-283), every stage selectable (R-284), availability with
 * reasons (R-286), links, `restrictToLinks` and `selectableStages`, counterpart resolution, IDs resolved only against
 * the current listings with no adapter call for an unknown ID (T11H-F06), and `Map` lookups on untrusted keys
 * (T11H-F07). Inline synthetic data only.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type SourceRegistry, createSportsSources } from '../index.js';
import {
  type FixtureRoot,
  type Json,
  type StubAdapter,
  competition,
  config,
  createFixtureRoot,
  cup,
  demoSource,
  deps,
  discovery,
  fixtureDocument,
  league,
  season,
  stage,
  stubAdapter,
  stubSource,
} from '../test/synthetic.js';

import { type CounterpartSourceFailure, type SelectionRequest, counterpartFailureCode } from './catalogue.js';
import { SOURCE_ERROR_CODES, SourceError, availabilityReasonOf } from './errors.js';

let root: FixtureRoot;
let manual: StubAdapter;
let live: StubAdapter;

beforeEach(() => {
  root = createFixtureRoot();
  manual = stubAdapter('stub-manual', 'MANUAL_DATA');
  live = stubAdapter('test-live', 'LIVE_DATA');
});

afterEach(() => {
  root.remove();
});

function build(sources: Json[], catalogue?: Json): SourceRegistry {
  return createSportsSources(config(sources, catalogue), deps(root.rootDir), {
    extraAdapters: [manual.registration, live.registration],
  });
}

const ctx = discovery;

function link(id: string, name: string, bindings: Array<[string, string]>, extra: Json = {}): Json {
  return { id, name, bindings: bindings.map(([sourceId, competitionRef]) => ({ sourceId, competitionRef })), ...extra };
}

/** Two fixture sources and a stub MANUAL_DATA source (the manual adapter itself is replaced later by T50). */
function mixed(catalogue?: Json): SourceRegistry {
  root.write('default', 'demo-a', fixtureDocument([league(), cup()]));
  root.write('default', 'demo-b', fixtureDocument([league()]));
  manual.documents.set('manual-a', fixtureDocument([league('liga-nac', 'Liga Nacional Sintetica')]));
  return build(
    [demoSource('demo-a'), demoSource('demo-b'), stubSource('manual-a', 'stub-manual', 'MANUAL_DATA')],
    catalogue,
  );
}

describe('catalogue merge', () => {
  it('shows the competitions of two fixture sources and a manual source together with their sources (R-243, R-282)', async () => {
    const catalogue = await mixed().catalogue.listCatalogue(ctx());
    expect(
      catalogue.competitions.map((entry) => [entry.id, entry.name, entry.sources.map((s) => [s.sourceId, s.mode])]),
    ).toEqual([
      ['demo-a-liga-sint', 'Liga Sintetica', [['demo-a', 'DEMO_DATA']]],
      ['demo-a-copa-sint', 'Copa Sintetica', [['demo-a', 'DEMO_DATA']]],
      ['demo-b-liga-sint', 'Liga Sintetica', [['demo-b', 'DEMO_DATA']]],
      ['manual-a-liga-nac', 'Liga Nacional Sintetica', [['manual-a', 'MANUAL_DATA']]],
    ]);
    expect(catalogue.sources.map((s) => [s.sourceId, s.mode, s.availability, s.listing.retrievedAt])).toEqual([
      ['demo-a', 'DEMO_DATA', { available: true }, '2026-10-27T12:00:00.000Z'],
      ['demo-b', 'DEMO_DATA', { available: true }, '2026-10-27T12:00:00.000Z'],
      ['manual-a', 'MANUAL_DATA', { available: true }, '2026-10-27T12:00:00.000Z'],
    ]);
    expect(catalogue.competitions[0]?.sources[0]?.selectable).toBe(true);
  });

  it('drops a competition removed from a fixture file and adds one added to a source, without code change (R-282)', async () => {
    const registry = mixed();
    root.write('default', 'demo-a', fixtureDocument([cup()]));
    manual.documents.set(
      'manual-a',
      fixtureDocument([league('liga-nac', 'Liga Nacional Sintetica'), league('copa-nac', 'Copa Nacional')]),
    );
    const ids = (await registry.catalogue.listCatalogue(ctx())).competitions.map((entry) => entry.id);
    expect(ids).toEqual(['demo-a-copa-sint', 'demo-b-liga-sint', 'manual-a-liga-nac', 'manual-a-copa-nac']);
  });

  it('merges two sources under a link, lists reference links first and never merges by name', async () => {
    const registry = mixed({
      links: [
        link('liga-demo', 'Liga Demo', [
          ['demo-a', 'liga-sint'],
          ['demo-b', 'liga-sint'],
        ]),
        link('copa-demo', 'Copa Demo', [['demo-a', 'copa-sint']], { reference: true }),
      ],
    });
    const catalogue = await registry.catalogue.listCatalogue(ctx());
    expect(
      catalogue.competitions.map((entry) => [
        entry.id,
        entry.reference,
        entry.linkId,
        entry.sources.map((s) => s.sourceId),
      ]),
    ).toEqual([
      ['copa-demo', true, 'copa-demo', ['demo-a']],
      ['liga-demo', false, 'liga-demo', ['demo-a', 'demo-b']],
      // Same name as the linked league, but another source's competition: not merged.
      ['manual-a-liga-nac', false, null, ['manual-a']],
    ]);
    expect(catalogue.competitions[1]?.name).toBe('Liga Demo');
  });

  it('marks a bound source that no longer lists the competition, and drops the link when none lists it', async () => {
    const links = {
      links: [
        link('liga-demo', 'Liga Demo', [
          ['demo-a', 'liga-sint'],
          ['demo-b', 'liga-sint'],
        ]),
      ],
    };
    const registry = mixed(links);
    root.write('default', 'demo-b', fixtureDocument([]));
    let entry = (await registry.catalogue.listCatalogue(ctx())).competitions.find((c) => c.id === 'liga-demo');
    expect(entry?.sources.map((s) => [s.sourceId, s.availability, s.selectable])).toEqual([
      ['demo-a', { available: true }, true],
      ['demo-b', { available: false, reason: 'not_found' }, false],
    ]);
    root.write('default', 'demo-a', fixtureDocument([cup()]));
    entry = (await registry.catalogue.listCatalogue(ctx())).competitions.find((c) => c.id === 'liga-demo');
    expect(entry).toBeUndefined();
  });

  it('offers only linked competitions with restrictToLinks', async () => {
    const registry = mixed({
      links: [link('liga-demo', 'Liga Demo', [['demo-a', 'liga-sint']])],
      restrictToLinks: true,
    });
    expect((await registry.catalogue.listCatalogue(ctx())).competitions.map((entry) => entry.id)).toEqual([
      'liga-demo',
    ]);
    expect((await registry.catalogue.listSeasons('demo-a-copa-sint', 'demo-a', ctx())).found).toBe(false);
  });

  it('marks verification-role sources as not selectable', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    root.write('default', 'demo-b', fixtureDocument([league()]));
    const registry = build([demoSource('demo-a'), demoSource('demo-b', { role: 'verification' })], {
      links: [
        link('liga-demo', 'Liga Demo', [
          ['demo-a', 'liga-sint'],
          ['demo-b', 'liga-sint'],
        ]),
      ],
    });
    const entry = (await registry.catalogue.listCatalogue(ctx())).competitions[0];
    expect(entry?.sources.map((s) => [s.sourceId, s.role, s.selectable])).toEqual([
      ['demo-a', 'primary', true],
      ['demo-b', 'verification', false],
    ]);
    const refused = await registry.catalogue.resolveSelection(
      { competitionId: 'liga-demo', sourceId: 'demo-b', seasonId: '2026', stageId: 'regular', matchday: 1 },
      ctx(),
    );
    expect(refused).toMatchObject({ ok: false, reason: 'source_not_selectable' });
    expect(registry.catalogue.linkedSources('liga-demo').map((d) => d.id)).toEqual(['demo-a', 'demo-b']);
    expect(registry.catalogue.linkedSources('demo-a-liga-sint')).toEqual([]);
  });
});

describe('seasons, stages and selections', () => {
  it('lists a league stage with matchdays and named stages by the source names (R-283)', async () => {
    const registry = mixed();
    const league = await registry.catalogue.listStages('demo-a-liga-sint', 'demo-a', '2026', ctx());
    expect(league.found && league.listing.items.map((s) => [s.name, s.matchdays.map((m) => m.number)])).toEqual([
      ['Fase Regular', [1, 2, 3]],
    ]);
    const cupStages = await registry.catalogue.listStages('demo-a-copa-sint', 'demo-a', '2026', ctx());
    expect(
      cupStages.found && cupStages.listing.items.map((s) => [s.id, s.name, s.standings, s.wholeStageRef !== null]),
    ).toEqual([
      ['fase-liga', 'Fase de Liga', 'expected', false],
      ['octavos', 'Octavos de Final', 'not_expected', true],
      ['semifinal', 'Semifinal', 'not_expected', false],
      ['final', 'Final', 'not_expected', true],
    ]);
    const seasons = await registry.catalogue.listSeasons('demo-a-copa-sint', 'demo-a', ctx());
    expect(seasons.found && seasons.listing.items.map((s) => [s.id, s.label])).toEqual([['2026', '2026/27']]);
  });

  it('makes every stage of the reference-shaped competition selectable, after the league stage too (R-284)', async () => {
    const registry = mixed({ links: [link('copa-demo', 'Copa Demo', [['demo-a', 'copa-sint']], { reference: true })] });
    const selections: Array<[string, number | null]> = [
      ['fase-liga', 1],
      ['octavos', null],
      ['semifinal', 2],
      ['final', null],
    ];
    for (const [stageId, matchday] of selections) {
      const resolved = await registry.catalogue.resolveSelection(
        { competitionId: 'copa-demo', sourceId: 'demo-a', seasonId: '2026', stageId, matchday },
        ctx(),
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) {
        continue;
      }
      expect(resolved.selection.competitionName).toBe('Copa Demo');
      expect(resolved.selection.seasonLabel).toBe('2026/27');
      expect(resolved.selection.mode).toBe('DEMO_DATA');
      const snapshot = await registry
        .get('demo-a')!
        .fetchSelection(resolved.selection.selectionRef, { ...ctx(), purpose: 'research' });
      expect(snapshot.stage.matchday).toBe(matchday);
      if (stageId === 'final') {
        expect(resolved.selection.standingsExpected).toBe('not_expected');
        expect(snapshot.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
      }
    }
  });

  it('refuses unknown seasons, stages, matchdays and whole-stage selections with closed reasons', async () => {
    const registry = mixed();
    const base = {
      competitionId: 'demo-a-copa-sint',
      sourceId: 'demo-a',
      seasonId: '2026',
      stageId: 'fase-liga',
      matchday: 1,
    };
    const cases: Array<[Json, string]> = [
      [{ competitionId: 'demo-a-unknown' }, 'competition_unavailable'],
      [{ seasonId: '1999' }, 'season_unavailable'],
      [{ stageId: 'cuartos' }, 'stage_unavailable'],
      [{ matchday: 9 }, 'stage_unavailable'],
      [{ matchday: null }, 'stage_unavailable'],
      [{ stageId: 'octavos', matchday: 1 }, 'stage_unavailable'],
    ];
    for (const [change, reason] of cases) {
      const refused = await registry.catalogue.resolveSelection({ ...base, ...change } as typeof base, ctx());
      expect(refused).toMatchObject({ ok: false, reason, availability: { available: false, reason: 'not_found' } });
    }
  });

  it('restricts stages with selectableStages through stage aliases', async () => {
    const registry = mixed({
      links: [
        link('copa-demo', 'Copa Demo', [['demo-a', 'copa-sint']], {
          selectableStages: ['league', 'final'],
          stageAliases: { 'demo-a': { 'fase-liga': 'league' } },
        }),
      ],
    });
    const stages = await registry.catalogue.listStages('copa-demo', 'demo-a', '2026', ctx());
    expect(stages.found && stages.listing.items.map((s) => s.id)).toEqual(['fase-liga', 'final']);
    const refused = await registry.catalogue.resolveSelection(
      { competitionId: 'copa-demo', sourceId: 'demo-a', seasonId: '2026', stageId: 'octavos', matchday: null },
      ctx(),
    );
    expect(refused).toMatchObject({ ok: false, reason: 'stage_unavailable' });
  });
});

describe('availability with reasons (R-286)', () => {
  it('keeps other sources usable when a source is restricted, and carries its reason', async () => {
    root.write('default', 'demo-a', fixtureDocument([league()]));
    root.write('default', 'demo-b', fixtureDocument([league()], 'not_available'));
    const registry = build([demoSource('demo-a'), demoSource('demo-b')], {
      links: [
        link('liga-demo', 'Liga Demo', [
          ['demo-a', 'liga-sint'],
          ['demo-b', 'liga-sint'],
        ]),
      ],
    });
    const catalogue = await registry.catalogue.listCatalogue(ctx());
    expect(catalogue.sources[1]?.availability).toEqual({ available: false, reason: 'subscription_restricted' });
    expect(catalogue.competitions[0]?.sources.map((s) => [s.sourceId, s.availability])).toEqual([
      ['demo-a', { available: true }],
      ['demo-b', { available: false, reason: 'subscription_restricted' }],
    ]);
    const seasons = await registry.catalogue.listSeasons('liga-demo', 'demo-b', ctx());
    expect(seasons).toMatchObject({
      found: true,
      listing: { items: [], availability: { available: false, reason: 'subscription_restricted' } },
    });
    const refused = await registry.catalogue.resolveSelection(
      { competitionId: 'liga-demo', sourceId: 'demo-b', seasonId: '2026', stageId: 'regular', matchday: 1 },
      ctx(),
    );
    expect(refused).toMatchObject({
      ok: false,
      reason: 'competition_unavailable',
      availability: { reason: 'subscription_restricted' },
    });
    const usable = await registry.catalogue.resolveSelection(
      { competitionId: 'liga-demo', sourceId: 'demo-a', seasonId: '2026', stageId: 'regular', matchday: 1 },
      ctx(),
    );
    expect(usable.ok).toBe(true);
  });

  it('marks unavailable seasons and competitions with their reason, and carries the wait of a rate limit', async () => {
    live.documents.set('live-a', fixtureDocument([league(), cup()]));
    const registry = build([stubSource('live-a', 'test-live', 'LIVE_DATA')]);
    live.overrides.set('live-a/listSeasons', new SourceError('not_available', 'restricted', 'live-a', null, 403));
    const seasons = await registry.catalogue.listSeasons('live-a-copa-sint', 'live-a', ctx());
    expect(seasons).toMatchObject({
      found: true,
      listing: { availability: { available: false, reason: 'subscription_restricted' } },
    });

    live.overrides.set('live-a/listSeasons', new SourceError('not_available', 'missing', 'live-a', null, 404));
    const missing = await registry.catalogue.listSeasons('live-a-copa-sint', 'live-a', ctx());
    expect(missing).toMatchObject({
      found: true,
      listing: { availability: { available: false, reason: 'not_found' } },
    });

    live.overrides.delete('live-a/listSeasons');
    live.overrides.set('live-a/listStages', new SourceError('rate_limited', 'limited', 'live-a', null, 429, 42));
    const stages = await registry.catalogue.listStages('live-a-copa-sint', 'live-a', '2026', ctx());
    expect(stages).toMatchObject({
      found: true,
      listing: { availability: { available: false, reason: 'rate_limited' }, retryAfterSeconds: 42 },
    });
    const refused = await registry.catalogue.resolveSelection(
      { competitionId: 'live-a-copa-sint', sourceId: 'live-a', seasonId: '2026', stageId: 'final', matchday: null },
      ctx(),
    );
    expect(refused).toEqual({
      ok: false,
      reason: 'stage_unavailable',
      availability: { available: false, reason: 'rate_limited' },
      retryAfterSeconds: 42,
    });

    live.documents.set('live-a', { simulate: 'access_refused', competitions: [] });
    const catalogue = await registry.catalogue.listCatalogue(ctx());
    expect(catalogue.competitions).toEqual([]);
    expect(catalogue.sources[0]?.availability).toEqual({ available: false, reason: 'access_refused' });
  });
});

describe('ID resolution against the current listings (T11H-F06)', () => {
  function counting(): SourceRegistry {
    live.documents.set('live-a', fixtureDocument([league(), cup()]));
    return build([stubSource('live-a', 'test-live', 'LIVE_DATA')], {
      links: [link('copa-live', 'Copa Live', [['live-a', 'copa-sint']])],
    });
  }

  it('answers not found for unknown competition and source IDs without any adapter call for them', async () => {
    const registry = counting();
    const unknown: Array<[string, string]> = [
      ['live-a-unknown', 'live-a'],
      ['other-copa-sint', 'live-a'],
      ['live-a-copa-sint', 'live-a'], // bound by a link: only offered under the link ID
      ['copa-live', 'live-b'],
      ['live-a-liga-sint', 'unknown-source'],
      ['no-such-link', 'live-a'],
    ];
    for (const [competitionId, sourceId] of unknown) {
      expect(await registry.catalogue.listSeasons(competitionId, sourceId, ctx())).toEqual({ found: false });
      expect(await registry.catalogue.listStages(competitionId, sourceId, '2026', ctx())).toEqual({ found: false });
      const refused = await registry.catalogue.resolveSelection(
        { competitionId, sourceId, seasonId: '2026', stageId: 'regular', matchday: 1 },
        ctx(),
      );
      expect(refused).toMatchObject({ ok: false, reason: 'competition_unavailable' });
    }
    expect(live.targetedCalls()).toBe(0);
  });

  it('answers not found for a season that the source does not list, without a stage request', async () => {
    const registry = counting();
    expect(await registry.catalogue.listStages('copa-live', 'live-a', '1999', ctx())).toEqual({ found: false });
    expect(live.count('live-a', 'listSeasons')).toBe(1);
    expect(live.count('live-a', 'listStages')).toBe(0);
  });

  it('stops resolving a competition that is no longer listed', async () => {
    const registry = counting();
    expect((await registry.catalogue.listSeasons('live-a-liga-sint', 'live-a', ctx())).found).toBe(true);
    live.documents.set('live-a', fixtureDocument([cup()]));
    const before = live.targetedCalls();
    expect(await registry.catalogue.listSeasons('live-a-liga-sint', 'live-a', ctx())).toEqual({ found: false });
    expect(live.targetedCalls()).toBe(before);
  });
});

describe('untrusted keys (T11H-F07)', () => {
  it('never resolves inherited member names as catalogue, source, season or stage IDs', async () => {
    const registry = mixed({ links: [link('liga-demo', 'Liga Demo', [['demo-a', 'liga-sint']])] });
    for (const name of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty']) {
      expect(await registry.catalogue.listSeasons(name, 'demo-a', ctx())).toEqual({ found: false });
      expect(await registry.catalogue.listSeasons('liga-demo', name, ctx())).toEqual({ found: false });
      expect(await registry.catalogue.listStages('liga-demo', 'demo-a', name, ctx())).toEqual({ found: false });
      const refused = await registry.catalogue.resolveSelection(
        { competitionId: 'liga-demo', sourceId: 'demo-a', seasonId: '2026', stageId: name, matchday: 1 },
        ctx(),
      );
      expect(refused).toMatchObject({ ok: false, reason: 'stage_unavailable' });
      expect(registry.catalogue.linkedSources(name)).toEqual([]);
    }
  });

  it('handles constructor, prototype and tostring as local keys, and __proto__ and toString as stage names', async () => {
    const stages = [
      stage({ id: 'constructor', name: '__proto__', order: 1, matchdays: [1] }),
      stage({ id: 'prototype', name: 'toString', order: 2, wholeStage: true }),
    ];
    live.documents.set(
      'live-a',
      fixtureDocument([
        competition('constructor', 'Liga Constructor', [season('prototype', stages)]),
        competition('prototype', 'Liga Prototype', []),
        competition('tostring', 'Liga Tostring', []),
      ]),
    );
    const registry = build([stubSource('live-a', 'test-live', 'LIVE_DATA')]);
    const ids = (await registry.catalogue.listCatalogue(ctx())).competitions.map((entry) => entry.id);
    expect(ids).toEqual(['live-a-constructor', 'live-a-prototype', 'live-a-tostring']);
    const listed = await registry.catalogue.listStages('live-a-constructor', 'live-a', 'prototype', ctx());
    expect(listed.found && listed.listing.items.map((s) => s.name)).toEqual(['__proto__', 'toString']);
    const resolved = await registry.catalogue.resolveSelection(
      {
        competitionId: 'live-a-constructor',
        sourceId: 'live-a',
        seasonId: 'prototype',
        stageId: 'prototype',
        matchday: null,
      },
      ctx(),
    );
    expect(resolved.ok && resolved.selection.stageName).toBe('toString');
  });
});

describe('counterpart resolution', () => {
  function counterpartSetup(demoB: Json, extra: Json = {}): SourceRegistry {
    root.write('default', 'demo-a', fixtureDocument([cup()]));
    root.write('default', 'demo-b', fixtureDocument([demoB]));
    return build([demoSource('demo-a'), demoSource('demo-b', { role: 'verification' })], {
      links: [
        link(
          'copa-demo',
          'Copa Demo',
          [
            ['demo-a', 'copa-sint'],
            ['demo-b', 'copa-b'],
          ],
          extra,
        ),
      ],
    });
  }

  const project: SelectionRequest = {
    competitionId: 'copa-demo',
    sourceId: 'demo-a',
    seasonId: '2026',
    stageId: 'fase-liga',
    matchday: 2,
  };

  it('matches the season by start year, the stage by normalized name and the matchday by number', async () => {
    const other = competition('copa-b', 'Copa B', [
      season('temporada-2026', [stage({ id: 'liga', name: 'FASE_DE_LIGA', order: 1, matchdays: [1, 2] })], {
        label: '2026-2027',
        startYear: 2026,
      }),
    ]);
    const registry = counterpartSetup(other);
    const resolved = await registry.catalogue.resolveCounterpart(project, 'demo-b', {
      ...ctx(),
      purpose: 'verification',
    });
    expect(resolved).toMatchObject({
      resolved: true,
      sourceId: 'demo-b',
      seasonId: 'temporada-2026',
      stageId: 'liga',
      matchday: 2,
    });
    if (resolved.resolved) {
      const snapshot = await registry.get('demo-b')!.fetchSelection(resolved.selectionRef, ctx());
      expect(snapshot.stage.matchday).toBe(2);
    }
  });

  it('matches the stage through the link stage aliases, and the season by exact label without start years', async () => {
    const other = competition('copa-b', 'Copa B', [
      season('s1', [stage({ id: 'league-phase', name: 'League Phase', order: 1, matchdays: [2] })], {
        label: '2026/27',
        startYear: null,
      }),
    ]);
    const registry = counterpartSetup(other, { stageAliases: { 'demo-b': { 'league-phase': 'fase-liga' } } });
    const resolved = await registry.catalogue.resolveCounterpart(project, 'demo-b', ctx());
    expect(resolved).toMatchObject({ resolved: true, seasonId: 's1', stageId: 'league-phase' });
  });

  it('contributes no observation when it cannot resolve, with a closed reason', async () => {
    const other = competition('copa-b', 'Copa B', [
      season('2026', [
        stage({ id: 'liga', name: 'Fase de Liga', order: 1, matchdays: [1] }),
        stage({ id: 'otra', name: 'constructor', order: 2, matchdays: [1] }),
      ]),
      season('2025', [stage({ id: 'liga', name: 'Fase de Liga', order: 1, matchdays: [2] })]),
    ]);
    const registry = counterpartSetup(other);
    const reason = async (selection: typeof project, sourceId = 'demo-b'): Promise<unknown> => {
      const result = await registry.catalogue.resolveCounterpart(selection, sourceId, ctx());
      return result.resolved ? 'resolved' : result.reason;
    };
    expect(await reason(project)).toBe('matchday_not_matched');
    expect(await reason({ ...project, matchday: 1 })).toBe('resolved');
    expect(await reason({ ...project, stageId: 'octavos', matchday: null })).toBe('stage_not_matched');
    expect(await reason({ ...project, stageId: 'constructor' })).toBe('selection_not_listed');
    expect(await reason(project, 'demo-a')).toBe('source_not_bound');
    expect(await reason(project, 'toString')).toBe('source_not_bound');
    expect(await reason({ ...project, competitionId: 'demo-a-copa-sint' })).toBe('not_linked');
    expect(await reason({ ...project, competitionId: '__proto__' })).toBe('not_linked');

    root.write('default', 'demo-b', fixtureDocument([competition('copa-b', 'Copa B', [season('2030', [])])]));
    expect(await reason(project)).toBe('season_not_matched');
    root.write('default', 'demo-b', fixtureDocument([]));
    expect(await reason(project)).toBe('competition_not_listed');
    root.write('default', 'demo-b', fixtureDocument([], 'unavailable'));
    expect(await reason(project)).toBe('source_unavailable');
  });
});

describe('counterpart source failure (architecture.md 7.3, OD-56)', () => {
  /** A synthetic secret-looking message: it must never leave the SourceError (T10-F10). */
  const LEAK = 'Bearer synthetic-token https://provider.example.test/v4/competitions?key=abc provider body';

  const selection: SelectionRequest = {
    competitionId: 'copa-live',
    sourceId: 'live-a',
    seasonId: '2026',
    stageId: 'fase-liga',
    matchday: 2,
  };

  function liveSetup(): SourceRegistry {
    live.documents.set('live-a', fixtureDocument([cup()]));
    live.documents.set('live-b', fixtureDocument([cup()]));
    return build(
      [
        stubSource('live-a', 'test-live', 'LIVE_DATA'),
        stubSource('live-b', 'test-live', 'LIVE_DATA', { role: 'verification' }),
      ],
      {
        links: [
          link('copa-live', 'Copa Live', [
            ['live-a', 'copa-sint'],
            ['live-b', 'copa-sint'],
          ]),
        ],
      },
    );
  }

  const unavailableListing = (reason: string): unknown => ({
    items: [],
    availability: { available: false, reason },
    retrievedAt: null,
    fromCache: false,
    stale: false,
    retryAfterSeconds: null,
  });

  it('resolves when every counterpart listing answers (baseline of the cases below)', async () => {
    const resolved = await liveSetup().catalogue.resolveCounterpart(selection, 'live-b', ctx());
    expect(resolved).toMatchObject({ resolved: true, sourceId: 'live-b', stageId: 'fase-liga', matchday: 2 });
  });

  for (const method of ['listCompetitions', 'listSeasons', 'listStages'] as const) {
    it.each(SOURCE_ERROR_CODES)(
      `a ${method} SourceError %s keeps its code and HTTP status, without its text`,
      async (code) => {
        const registry = liveSetup();
        live.overrides.set(`live-b/${method}`, new SourceError(code, LEAK, 'live-b', '/competitions', 418, 30));
        const resolved = await registry.catalogue.resolveCounterpart(selection, 'live-b', ctx());
        expect(resolved).toEqual({
          resolved: false,
          sourceId: 'live-b',
          reason: 'source_unavailable',
          failure: { kind: 'source_error', code, httpStatus: 418 },
        });
        if (!resolved.resolved && resolved.reason === 'source_unavailable') {
          expect(counterpartFailureCode(resolved.failure)).toBe(code);
        }
        const serialized = JSON.stringify(resolved);
        for (const fragment of ['Bearer', 'synthetic-token', 'https:', 'key=abc', 'provider body', '/competitions']) {
          expect(serialized).not.toContain(fragment);
        }
      },
    );
  }

  it('a SourceError of another source is re-attributed and keeps its code; an HTTP status outside 100-599 is null', async () => {
    const registry = liveSetup();
    live.overrides.set('live-b/listSeasons', new SourceError('timeout', LEAK, 'live-a', null, 700));
    const resolved = await registry.catalogue.resolveCounterpart(selection, 'live-b', ctx());
    expect(resolved).toEqual({
      resolved: false,
      sourceId: 'live-b',
      reason: 'source_unavailable',
      failure: { kind: 'source_error', code: 'timeout', httpStatus: null },
    });
  });

  it('anything else an adapter throws is unavailable with no HTTP status and none of its text', async () => {
    const registry = liveSetup();
    live.overrides.set('live-b/listStages', new Error(LEAK));
    const resolved = await registry.catalogue.resolveCounterpart(selection, 'live-b', ctx());
    expect(resolved).toEqual({
      resolved: false,
      sourceId: 'live-b',
      reason: 'source_unavailable',
      failure: { kind: 'source_error', code: 'unavailable', httpStatus: null },
    });
    expect(JSON.stringify(resolved)).not.toContain('synthetic-token');
  });

  it.each([
    ['subscription_restricted', 'not_available'],
    ['not_found', 'not_available'],
    ['access_refused', 'access_refused'],
    ['rate_limited', 'rate_limited'],
    ['not_provided', 'no_data'],
    ['source_unavailable', 'unavailable'],
  ] as const)('a listing that answered unavailable (%s) keeps its reason, code %s', async (reason, code) => {
    for (const method of ['listCompetitions', 'listSeasons', 'listStages'] as const) {
      const registry = liveSetup();
      live.overrides.clear();
      live.overrides.set(`live-b/${method}`, unavailableListing(reason));
      const resolved = await registry.catalogue.resolveCounterpart(selection, 'live-b', ctx());
      expect(resolved, method).toEqual({
        resolved: false,
        sourceId: 'live-b',
        reason: 'source_unavailable',
        failure: { kind: 'listing_unavailable', reason },
      });
      if (!resolved.resolved && resolved.reason === 'source_unavailable') {
        expect(counterpartFailureCode(resolved.failure)).toBe(code);
      }
    }
  });

  it('the code of a listing reason is the inverse of availabilityReasonOf for every closed code', () => {
    for (const code of SOURCE_ERROR_CODES) {
      const error = new SourceError(code, 'synthetic', 'live-b');
      const listing: CounterpartSourceFailure = { kind: 'listing_unavailable', reason: availabilityReasonOf(error) };
      const back = counterpartFailureCode(listing);
      // Transport and payload failures share the listing reason `source_unavailable`; the others round-trip.
      expect(availabilityReasonOf(new SourceError(back, 'synthetic', 'live-b'))).toBe(listing.reason);
    }
  });

  it("a failure of the selection's own source is not a counterpart source failure", async () => {
    const registry = liveSetup();
    live.overrides.set('live-a/listCompetitions', new SourceError('rate_limited', LEAK, 'live-a', null, 429));
    const resolved = await registry.catalogue.resolveCounterpart(selection, 'live-b', ctx());
    expect(resolved).toEqual({ resolved: false, sourceId: 'live-b', reason: 'selection_not_listed' });
  });
});
