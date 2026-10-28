/**
 * The research stage in the workflow runner over an in-memory database and scripted sources (R-225; no adapter, no
 * network): load, retrieval through the source registry with purpose `research`, one `retrievals` row, attributed
 * observations and the standings availability (R-202, R-204, R-254, R-287; AD-34); provider failures as stage
 * failures with the closed codes and a failed retrieval row (T10-F10); invalid source output refused (R-224);
 * stripped fields never stored (R-232). Synthetic data only.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { selection } from '../../providers/sports/test/synthetic.js';
import { SourceError } from '../../providers/sports/index.js';
import type { RunView } from '../../workflow/index.js';

import { ResearchRepository } from './repository.js';
import {
  IMPORT_VERSION_ID,
  type ResearchFixture,
  SELECTION_REF,
  SOURCES,
  insertProject,
  researchFixture,
} from './test/support.js';

const PROJECT_ID = '1a1a1a1a-0000-4000-8000-00000000001a';
const RETRIEVED_AT = '2026-10-21T10:15:00.000Z';

const fixtures: ResearchFixture[] = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.close();
  }
});

function open(options: Parameters<typeof researchFixture>[0] = {}): ResearchFixture {
  const fixture = researchFixture(options);
  fixtures.push(fixture);
  return fixture;
}

/** A raw selection snapshot of a source (the synthetic matchday of the T21 helpers plus the source fields). */
function rawSnapshot(sourceId: string, mode: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...selection({ refPrefix: `fixture:research/${sourceId}` }),
    sourceId,
    mode,
    retrievedAt: RETRIEVED_AT,
    fromCache: false,
    sourceRef: `fixture:research/${sourceId}.json`,
    importVersionId: null,
    ...extra,
  };
}

async function runResearch(fixture: ResearchFixture, source = SOURCES.demoA): Promise<RunView> {
  insertProject(fixture.db, PROJECT_ID, source);
  const run = fixture.runner.start(PROJECT_ID, 'full');
  await fixture.runner.settled(run.id);
  const view = fixture.runner.runs.view(run.id);
  if (view === null) {
    throw new Error('run not found');
  }
  return view;
}

function count(fixture: ResearchFixture, table: 'retrievals' | 'observations'): number {
  const sql = {
    retrievals: 'SELECT COUNT(*) AS n FROM retrievals',
    observations: 'SELECT COUNT(*) AS n FROM observations',
  };
  return (fixture.db.prepare<{ n: number }>(sql[table]).get() as { n: number }).n;
}

function storedText(fixture: ResearchFixture): string {
  const rows = [
    ...fixture.db.prepare('SELECT * FROM retrievals').all(),
    ...fixture.db.prepare('SELECT * FROM observations').all(),
    ...fixture.db.prepare('SELECT failure, standings_availability FROM workflow_runs').all(),
    ...fixture.db.prepare('SELECT failure FROM stage_runs').all(),
  ];
  return JSON.stringify(rows);
}

describe('research stage: a retrieved selection', () => {
  it('asks the project source for its opaque selection with purpose research and stores the results', async () => {
    const fixture = open();
    fixture.sources.demoA.script = { output: rawSnapshot('demo-a', 'DEMO_DATA') };
    const run = await runResearch(fixture);

    expect(run.status).toBe('completed');
    expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'completed'],
      ['verification', 'completed'],
      ['content', 'completed'],
      ['rendering', 'completed'],
      ['visual_qa', 'completed'],
    ]);
    expect(fixture.sources.demoA.calls).toEqual([{ selection: SELECTION_REF, purpose: 'research' }]);
    expect(fixture.sources.demoB.calls).toEqual([]);

    const repository = new ResearchRepository(fixture.db);
    const retrievals = repository.retrievals(run.id);
    expect(retrievals).toEqual([
      {
        id: expect.any(String) as string,
        sourceId: 'demo-a',
        dataMode: 'DEMO_DATA',
        resource: 'selection',
        retrievedAt: RETRIEVED_AT,
        fromCache: false,
        outcome: 'ok',
        failure: null,
        importVersionId: null,
      },
    ]);
    const observations = repository.observations(run.id);
    // 1 matchday + 4 teams + 2 matches x 4 (both finished) + 4 rows + 1 context item.
    expect(observations).toHaveLength(1 + 4 + 8 + 4 + 1);
    for (const observation of observations) {
      expect(observation).toMatchObject({
        retrievalId: retrievals[0]?.id,
        sourceId: 'demo-a',
        dataMode: 'DEMO_DATA',
        importVersionId: null,
        retrievedAt: RETRIEVED_AT,
      });
      expect(observation.sourceRef).toMatch(/^fixture:research\/demo-a/);
    }
    expect(observations.find((observation) => observation.factKey === 'match:m1:score')?.value).toEqual({
      kind: 'match_score',
      matchKey: 'm1',
      home: 2,
      away: 1,
    });
    expect(repository.standingsAvailability(run.id)).toEqual({ available: true, reason: null });
  });

  it('uses the injected ID generator for the retrieval and the observations', async () => {
    let next = 0;
    const fixture = open({ newId: () => `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}` });
    fixture.sources.demoA.script = { output: rawSnapshot('demo-a', 'DEMO_DATA') };
    const run = await runResearch(fixture);
    const repository = new ResearchRepository(fixture.db);
    expect(repository.retrievals(run.id)[0]?.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(repository.observations(run.id)[0]?.id).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('records a selection without standings as unavailable with its reason and derives no row (R-254)', async () => {
    const fixture = open();
    fixture.sources.demoA.script = {
      output: rawSnapshot('demo-a', 'DEMO_DATA', { standings: { available: false, reason: 'not_provided_for_stage' } }),
    };
    const run = await runResearch(fixture);
    expect(run.status).toBe('completed');
    const repository = new ResearchRepository(fixture.db);
    expect(repository.standingsAvailability(run.id)).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(repository.observations(run.id).some((observation) => observation.value.kind === 'standing_row')).toBe(
      false,
    );
  });

  it('records the import version of a MANUAL_DATA selection on the retrieval and every observation', async () => {
    const fixture = open();
    fixture.sources.manual.script = {
      output: rawSnapshot('manual-a', 'MANUAL_DATA', {
        sourceRef: `import:${IMPORT_VERSION_ID}/v1`,
        importVersionId: IMPORT_VERSION_ID,
      }),
    };
    const run = await runResearch(fixture, SOURCES.manual);
    expect(run.status).toBe('completed');
    const repository = new ResearchRepository(fixture.db);
    expect(repository.retrievals(run.id)[0]).toMatchObject({
      sourceId: 'manual-a',
      dataMode: 'MANUAL_DATA',
      importVersionId: IMPORT_VERSION_ID,
    });
    const observations = repository.observations(run.id);
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every((observation) => observation.importVersionId === IMPORT_VERSION_ID)).toBe(true);
    expect(observations.every((observation) => observation.dataMode === 'MANUAL_DATA')).toBe(true);
  });

  it('records a LIVE_DATA selection served from the cache with its original retrieval time', async () => {
    const fixture = open();
    fixture.sources.live.script = {
      output: rawSnapshot('live-a', 'LIVE_DATA', {
        fromCache: true,
        retrievedAt: '2026-10-21T12:15:00+02:00',
        sourceRef: 'source:live-a/matches@2026-10-21T10:15:00.000Z',
      }),
    };
    const run = await runResearch(fixture, SOURCES.live);
    const repository = new ResearchRepository(fixture.db);
    expect(repository.retrievals(run.id)[0]).toMatchObject({
      sourceId: 'live-a',
      dataMode: 'LIVE_DATA',
      fromCache: true,
      retrievedAt: RETRIEVED_AT,
    });
    expect(repository.observations(run.id).every((observation) => observation.retrievedAt === RETRIEVED_AT)).toBe(true);
  });

  it('never stores a field that the domain schema strips, person fields included (R-232)', async () => {
    const fixture = open();
    const raw = rawSnapshot('demo-a', 'DEMO_DATA', { referee: `${TEST_MARKER_TOKEN} Person` });
    const matches = (raw['matches'] as Record<string, unknown>[]).map((match) => ({
      ...match,
      scorers: [{ name: `${TEST_MARKER_TOKEN} Scorer`, minute: 12 }],
      lineups: [`${TEST_MARKER_TOKEN} Player`],
    }));
    const teams = (raw['teams'] as Record<string, unknown>[]).map((team) => ({
      ...team,
      coach: `${TEST_MARKER_TOKEN} Coach`,
      squad: [`${TEST_MARKER_TOKEN} Player`],
    }));
    fixture.sources.demoA.script = { output: { ...raw, matches, teams } };
    const run = await runResearch(fixture);
    expect(run.status).toBe('completed');
    expect(count(fixture, 'observations')).toBeGreaterThan(0);
    const text = storedText(fixture);
    expect(text).not.toContain(TEST_MARKER_TOKEN);
    expect(text).not.toMatch(/referee|scorer|lineup|coach|squad|player/i);
  });
});

describe('research stage: provider failures (T10-F10)', () => {
  const codes = [
    'access_refused',
    'not_available',
    'rate_limited',
    'unavailable',
    'timeout',
    'invalid',
    'no_data',
    'bad_request',
  ] as const;

  it.each(codes)('fails the stage with %s, records the failed retrieval and stores no observation', async (code) => {
    const fixture = open();
    fixture.sources.live.script = {
      error: new SourceError(
        code,
        `${TEST_MARKER_TOKEN} provider body https://x.example.test/?t=1`,
        'live-a',
        null,
        403,
      ),
    };
    const run = await runResearch(fixture, SOURCES.live);
    const expected = { code, sourceId: 'live-a', path: null, httpStatus: 403 };

    expect(run.status).toBe('failed');
    expect(run.failure).toEqual(expected);
    expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'failed'],
      ['verification', 'skipped'],
      ['content', 'skipped'],
      ['rendering', 'skipped'],
      ['visual_qa', 'skipped'],
    ]);
    expect(run.stages[0]?.failure).toEqual(expected);
    expect(fixture.calls).toEqual([]);

    const repository = new ResearchRepository(fixture.db);
    expect(repository.retrievals(run.id)).toEqual([
      {
        id: expect.any(String) as string,
        sourceId: 'live-a',
        dataMode: 'LIVE_DATA',
        resource: 'selection',
        retrievedAt: expect.stringMatching(/^2026-10-27T12:00:0\d\.000Z$/) as string,
        fromCache: false,
        outcome: code === 'not_available' ? 'not_available' : 'failed',
        failure: expected,
        importVersionId: null,
      },
    ]);
    expect(count(fixture, 'observations')).toBe(0);
    expect(repository.standingsAvailability(run.id)).toBeNull();
    const text = storedText(fixture);
    expect(text).not.toContain(TEST_MARKER_TOKEN);
    expect(text).not.toContain('example.test');
  });

  it('refuses a source output that violates the domain schema as invalid with its path (R-224)', async () => {
    const fixture = open();
    const raw = rawSnapshot('demo-a', 'DEMO_DATA');
    const matches = (raw['matches'] as Record<string, unknown>[]).map((match, index) =>
      index === 1 ? { ...match, score: null } : match,
    );
    fixture.sources.demoA.script = { output: { ...raw, matches } };
    const run = await runResearch(fixture);
    const expected = { code: 'invalid', sourceId: 'demo-a', path: '/matches/1/score', httpStatus: null };
    expect(run.failure).toEqual(expected);
    expect(new ResearchRepository(fixture.db).retrievals(run.id)[0]).toMatchObject({
      outcome: 'failed',
      failure: expected,
    });
    expect(count(fixture, 'observations')).toBe(0);
  });

  it('refuses a snapshot attributed to another source or mode than the project source', async () => {
    const fixture = open();
    fixture.sources.demoA.script = { output: rawSnapshot('demo-b', 'DEMO_DATA') };
    const run = await runResearch(fixture);
    expect(run.failure).toEqual({ code: 'invalid', sourceId: 'demo-a', path: '/sourceId', httpStatus: null });

    const second = open();
    second.sources.demoA.script = { output: rawSnapshot('demo-a', 'LIVE_DATA') };
    const other = await runResearch(second);
    expect(other.failure).toEqual({ code: 'invalid', sourceId: 'demo-a', path: '/mode', httpStatus: null });
  });

  it('fails as unavailable without a retrieval when the project source is not configured or not enabled', async () => {
    const fixture = open({ registered: ['demoB'] });
    const run = await runResearch(fixture);
    expect(run.failure).toEqual({ code: 'unavailable', sourceId: 'demo-a', path: null, httpStatus: null });
    expect(count(fixture, 'retrievals')).toBe(0);
  });

  it('fails as invalid without a retrieval when the source mode differs from the project mode', async () => {
    const fixture = open();
    insertProject(fixture.db, PROJECT_ID, { ...SOURCES.live, id: 'demo-a' });
    const run = fixture.runner.start(PROJECT_ID, 'full');
    await fixture.runner.settled(run.id);
    expect(fixture.runner.runs.view(run.id)?.failure).toEqual({
      code: 'invalid',
      sourceId: 'demo-a',
      path: '/dataMode',
      httpStatus: null,
    });
    expect(fixture.sources.demoA.calls).toEqual([]);
    expect(count(fixture, 'retrievals')).toBe(0);
  });

  it('fails as internal without storing the message when the source throws something else', async () => {
    const fixture = open();
    fixture.sources.demoA.script = { error: new Error(`${TEST_MARKER_TOKEN} /secret/path`) };
    const run = await runResearch(fixture);
    expect(run.failure).toEqual({ code: 'internal', sourceId: null, path: null, httpStatus: null });
    expect(count(fixture, 'retrievals')).toBe(0);
    expect(storedText(fixture)).not.toContain(TEST_MARKER_TOKEN);
  });

  it('fails as interrupted and stores nothing when the run is cancelled during the retrieval', async () => {
    const fixture = open();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = fixture.sources.demoA;
    source.fetchSelection = async (selectionRef, ctx) => {
      source.calls.push({ selection: selectionRef, purpose: ctx.purpose });
      await gate;
      throw new SourceError('unavailable', 'source request was cancelled', 'demo-a');
    };
    insertProject(fixture.db, PROJECT_ID, SOURCES.demoA);
    const run = fixture.runner.start(PROJECT_ID, 'full');
    while (source.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const stopped = fixture.runner.shutdown();
    release();
    await stopped;
    expect(fixture.runner.runs.view(run.id)?.failure).toEqual({
      code: 'interrupted',
      sourceId: null,
      path: null,
      httpStatus: null,
    });
    expect(count(fixture, 'retrievals')).toBe(0);
  });
});
