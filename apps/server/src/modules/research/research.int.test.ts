/**
 * Integration of the research stage with the real source registry, the DEMO_DATA fixture adapter, the counting stub
 * kinds of the `createSportsSources` test seam (LIVE_DATA and MANUAL_DATA shapes), the projects routes and the
 * workflow runner over an in-memory database (R-202, R-204, R-224, R-225, R-232, R-254, R-268, R-287; AD-34;
 * T10-F10). Synthetic data only; the network guard confines everything to loopback.
 */
import { ProjectSchema, RunSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import {
  FIXED_NOW,
  type Json,
  TEST_IMPORT_VERSION_ID,
  selection,
  stubAdapter,
  stubSource,
} from '../../providers/sports/test/synthetic.js';
import { type AnyStage, STAGE_ORDER } from '../../workflow/index.js';
import { fakeStage } from '../../workflow/test/support.js';
import {
  READ_HEADERS,
  WRITE_HEADERS,
  type ProjectsTestApp,
  projectsTestApp,
  selectionBody,
  stubFixture,
} from '../projects/test/support.js';

import { ResearchRepository } from './repository.js';
import { serverModule } from './index.js';
import { insertImportVersion } from './test/support.js';

const apps: ProjectsTestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

/** The registered research stage followed by fake stages. */
function stages(): AnyStage[] {
  const research = serverModule.stages?.[0];
  if (research === undefined) {
    throw new Error('the research module registers no stage');
  }
  return [research, ...STAGE_ORDER.filter((name) => name !== 'research').map((name) => fakeStage(name, []))];
}

async function start(options: Parameters<typeof projectsTestApp>[0] = {}): Promise<ProjectsTestApp> {
  const app = await projectsTestApp({ stages: stages, ...options });
  apps.push(app);
  return app;
}

function send(app: ProjectsTestApp, url: string, body: unknown) {
  return app.inject({ method: 'POST', url: `/api/v1${url}`, headers: WRITE_HEADERS, payload: JSON.stringify(body) });
}

async function createProject(app: ProjectsTestApp, body: Json) {
  const response = await send(app, '/projects', body);
  expect(response.statusCode, response.body).toBe(201);
  return ProjectSchema.parse(response.json());
}

async function fullRun(app: ProjectsTestApp, projectId: string) {
  const response = await send(app, `/projects/${projectId}/runs`, { kind: 'full' });
  expect(response.statusCode, response.body).toBe(202);
  const created = RunSchema.parse(response.json());
  await app.module.runnerFor(app.container).settled(created.id);
  const read = await app.inject({
    method: 'GET',
    url: `/api/v1/projects/${projectId}/runs/${created.id}`,
    headers: READ_HEADERS,
  });
  expect(read.statusCode).toBe(200);
  return { run: RunSchema.parse(read.json()), body: read.body };
}

function storedText(app: ProjectsTestApp): string {
  return JSON.stringify([
    ...app.db.prepare('SELECT * FROM retrievals').all(),
    ...app.db.prepare('SELECT * FROM observations').all(),
    ...app.db.prepare('SELECT failure, standings_availability FROM workflow_runs').all(),
    ...app.db.prepare('SELECT failure FROM stage_runs').all(),
  ]);
}

describe('research with the DEMO_DATA fixture adapter (R-202, R-204, R-287)', () => {
  it('stores every match, score, kickoff, standings row and context item equal to the fixture values', async () => {
    const app = await start();
    const project = await createProject(app, selectionBody('liga-demo', 'demo-a', '2026', 'regular', 1));
    const { run } = await fullRun(app, project.id);
    expect(run.status).toBe('completed');
    expect(run.stages.map((stage) => stage.status)).toEqual(Array(5).fill('completed'));

    const expected = selection({ stage: 'Fase Regular', matchday: 1 }) as {
      teams: { teamKey: string; name: string; aliases: string[]; ref: string }[];
      matches: {
        matchKey: string;
        homeTeamKey: string;
        awayTeamKey: string;
        kickoff: string;
        status: string;
        score: { home: number; away: number } | null;
        ref: string;
      }[];
      standings: { rows: Record<string, unknown>[] };
      context: { type: string; count: number; ref: string }[];
    };
    const repository = new ResearchRepository(app.db);
    const observations = repository.observations(run.id);
    const values = new Map(observations.map((observation) => [observation.factKey, observation.value]));

    for (const match of expected.matches) {
      expect(values.get(`match:${match.matchKey}:teams`)).toEqual({
        kind: 'match_teams',
        matchKey: match.matchKey,
        homeTeamKey: match.homeTeamKey,
        awayTeamKey: match.awayTeamKey,
      });
      expect(values.get(`match:${match.matchKey}:kickoff`)).toEqual({
        kind: 'match_kickoff',
        matchKey: match.matchKey,
        kickoff: match.kickoff,
      });
      expect(values.get(`match:${match.matchKey}:status`)).toEqual({
        kind: 'match_status',
        matchKey: match.matchKey,
        matchStatus: match.status,
      });
      expect(values.get(`match:${match.matchKey}:score`)).toEqual({
        kind: 'match_score',
        matchKey: match.matchKey,
        ...match.score,
      });
    }
    const rows = observations.filter((observation) => observation.value.kind === 'standing_row');
    expect(rows.map((row) => row.value)).toEqual(
      expected.standings.rows.map(({ ref: _ref, ...row }) => ({ kind: 'standing_row', ...row })),
    );
    expect(values.get('context:matches_in_selection:0')).toEqual({
      kind: 'context_item',
      index: 0,
      item: { type: 'matches_in_selection', count: 2 },
    });
    expect(values.get('matchday:info')).toEqual({
      kind: 'matchday_info',
      stageLabel: 'Fase Regular',
      matchdayNumber: 1,
      totalMatchdays: 6,
    });
    for (const team of expected.teams) {
      expect(values.get(`team:${team.teamKey}:name`)).toEqual({
        kind: 'team',
        teamKey: team.teamKey,
        name: team.name,
        aliases: team.aliases,
      });
    }

    const retrievals = repository.retrievals(run.id);
    expect(retrievals).toEqual([
      {
        id: expect.any(String) as string,
        sourceId: 'demo-a',
        dataMode: 'DEMO_DATA',
        resource: 'selection',
        retrievedAt: FIXED_NOW,
        fromCache: false,
        outcome: 'ok',
        failure: null,
        importVersionId: null,
      },
    ]);
    for (const observation of observations) {
      expect(observation).toMatchObject({
        retrievalId: retrievals[0]?.id,
        sourceId: 'demo-a',
        dataMode: 'DEMO_DATA',
        importVersionId: null,
        retrievedAt: FIXED_NOW,
      });
      expect(observation.sourceRef).toMatch(/^fixture:/);
    }
    expect(repository.standingsAvailability(run.id)).toEqual({ available: true, reason: null });
  });

  it('records the source the operator chose when the competition has two sources (R-287)', async () => {
    const app = await start();
    const first = await createProject(app, selectionBody('liga-stub', 'stub-a', '2026', 'regular', 2));
    const second = await createProject(app, selectionBody('liga-stub', 'stub-b', '2026', 'regular', 2));
    const runA = (await fullRun(app, first.id)).run;
    const runB = (await fullRun(app, second.id)).run;
    expect([runA.status, runB.status]).toEqual(['completed', 'completed']);
    expect([app.stub.count('stub-a', 'fetchSelection'), app.stub.count('stub-b', 'fetchSelection')]).toEqual([1, 1]);
    const repository = new ResearchRepository(app.db);
    expect(repository.retrievals(runA.id).map((retrieval) => retrieval.sourceId)).toEqual(['stub-a']);
    expect(repository.retrievals(runB.id).map((retrieval) => retrieval.sourceId)).toEqual(['stub-b']);
    expect(new Set(repository.observations(runA.id).map((observation) => observation.sourceId))).toEqual(
      new Set(['stub-a']),
    );
    expect(new Set(repository.observations(runB.id).map((observation) => observation.sourceId))).toEqual(
      new Set(['stub-b']),
    );
  });

  it('records missing standings of a stage selected as a whole and derives no row (R-254)', async () => {
    const app = await start();
    const project = await createProject(app, selectionBody('copa-demo', 'demo-a', '2026', 'octavos', null));
    const { run } = await fullRun(app, project.id);
    expect(run.status).toBe('completed');
    const repository = new ResearchRepository(app.db);
    expect(repository.standingsAvailability(run.id)).toEqual({ available: false, reason: 'not_provided_for_stage' });
    const observations = repository.observations(run.id);
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.some((observation) => observation.value.kind === 'standing_row')).toBe(false);
    expect(observations.find((observation) => observation.factKey === 'matchday:info')?.value).toMatchObject({
      matchdayNumber: null,
    });
  });
});

describe('research with a LIVE_DATA-shaped source (R-224, R-232, T10-F10)', () => {
  it('stores no person field or value that the registry stripped from the source output', async () => {
    const app = await start();
    const project = await createProject(app, selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
    const payload = selection({ refPrefix: 'source:stub-a/matches@2026-10-27T12:00:00.000Z' }) as Json & {
      matches: Json[];
      teams: Json[];
    };
    app.stub.overrides.set('stub-a/fetchSelection', {
      ...payload,
      sourceId: 'stub-a',
      mode: 'LIVE_DATA',
      retrievedAt: FIXED_NOW,
      fromCache: false,
      sourceRef: 'source:stub-a/matches@2026-10-27T12:00:00.000Z',
      importVersionId: null,
      referees: [{ name: `${TEST_MARKER_TOKEN} Referee` }],
      matches: payload.matches.map((match) => ({ ...match, goals: [{ scorer: `${TEST_MARKER_TOKEN} Scorer` }] })),
      teams: payload.teams.map((team) => ({ ...team, coach: { name: `${TEST_MARKER_TOKEN} Coach` } })),
    });
    const { run } = await fullRun(app, project.id);
    expect(run.status).toBe('completed');
    const repository = new ResearchRepository(app.db);
    expect(repository.observations(run.id).length).toBeGreaterThan(0);
    expect(repository.retrievals(run.id)[0]).toMatchObject({ sourceId: 'stub-a', dataMode: 'LIVE_DATA' });
    const text = storedText(app);
    expect(text).not.toContain(TEST_MARKER_TOKEN);
    expect(text).not.toMatch(/referee|scorer|coach|"goals"/i);
  });

  it('refuses an output that violates the domain schema and stores no observation (R-224)', async () => {
    const app = await start();
    const project = await createProject(app, selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
    const payload = selection() as Json & { matches: Json[] };
    app.stub.overrides.set('stub-a/fetchSelection', {
      ...payload,
      sourceId: 'stub-a',
      mode: 'LIVE_DATA',
      retrievedAt: FIXED_NOW,
      fromCache: false,
      sourceRef: 'source:stub-a/matches@2026-10-27T12:00:00.000Z',
      importVersionId: null,
      matches: payload.matches.map((match) => ({ ...match, homeTeamKey: 'unknown-team' })),
    });
    const { run } = await fullRun(app, project.id);
    expect(run.failure).toEqual({
      code: 'invalid',
      sourceId: 'stub-a',
      path: '/matches/0/homeTeamKey',
      httpStatus: null,
    });
    const repository = new ResearchRepository(app.db);
    expect(repository.retrievals(run.id)[0]).toMatchObject({ outcome: 'failed', failure: run.failure });
    expect(repository.observations(run.id)).toEqual([]);
  });

  it.each(['access_refused', 'not_available', 'rate_limited', 'timeout', 'no_data'] as const)(
    'fails the run with %s, records the failed retrieval and returns only the closed failure',
    async (code) => {
      const app = await start();
      const project = await createProject(app, selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
      app.stub.documents.set('stub-a', { ...stubFixture(), simulate: code });
      const { run, body } = await fullRun(app, project.id);
      const expected = { code, sourceId: 'stub-a', path: null, httpStatus: null };
      expect(run.status).toBe('failed');
      expect(run.failure).toEqual(expected);
      expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual([
        ['research', 'failed'],
        ['verification', 'skipped'],
        ['content', 'skipped'],
        ['rendering', 'skipped'],
        ['visual_qa', 'skipped'],
      ]);
      const repository = new ResearchRepository(app.db);
      expect(repository.retrievals(run.id)).toEqual([
        expect.objectContaining({
          sourceId: 'stub-a',
          dataMode: 'LIVE_DATA',
          outcome: code === 'not_available' ? 'not_available' : 'failed',
          failure: expected,
        }),
      ]);
      expect(repository.observations(run.id)).toEqual([]);
      expect(repository.standingsAvailability(run.id)).toBeNull();
      expect(body).not.toContain('simulated');
    },
  );
});

describe('research with a MANUAL_DATA-shaped source (R-067, R-287)', () => {
  it('records the import version on the retrieval and on every observation', async () => {
    const stub = stubAdapter('test-manual', 'MANUAL_DATA');
    stub.documents.set('manual-a', stubFixture());
    const app = await start({
      sources: [stubSource('manual-a', 'test-manual', 'MANUAL_DATA')],
      catalogue: { links: [], restrictToLinks: false },
      stub,
    });
    insertImportVersion(app.db, 'manual-a', TEST_IMPORT_VERSION_ID);
    const project = await createProject(app, selectionBody('manual-a-liga-stub', 'manual-a', '2026', 'regular', 1));
    expect(project.dataMode).toBe('MANUAL_DATA');
    const { run } = await fullRun(app, project.id);
    expect(run.status).toBe('completed');
    const repository = new ResearchRepository(app.db);
    expect(repository.retrievals(run.id)).toEqual([
      expect.objectContaining({
        sourceId: 'manual-a',
        dataMode: 'MANUAL_DATA',
        outcome: 'ok',
        importVersionId: TEST_IMPORT_VERSION_ID,
      }),
    ]);
    const observations = repository.observations(run.id);
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(observation).toMatchObject({
        sourceId: 'manual-a',
        dataMode: 'MANUAL_DATA',
        importVersionId: TEST_IMPORT_VERSION_ID,
      });
    }
    expect(observations.find((observation) => observation.factKey === 'matchday:info')?.sourceRef).toBe(
      `import:${TEST_IMPORT_VERSION_ID}/v1`,
    );
  });
});
