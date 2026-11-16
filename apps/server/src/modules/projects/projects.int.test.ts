/**
 * Integration tests of the project, run and exclusion routes with DEMO fixtures, a counting stub source and fake
 * stages (architecture.md sections 6 and 15.2; R-200, R-203, R-236, R-243, R-269, R-284, R-286, R-287; T10-F10,
 * T10-F11, T10-F15; AD-10, AD-14).
 */
import { ProjectListResponseSchema, ProjectSchema, RunListResponseSchema, RunSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { SourceError } from '../../providers/sports/index.js';
import type { AnyStage } from '../../workflow/index.js';
import { type StageCall, deferred, fakeStage } from '../../workflow/test/support.js';

import { READ_HEADERS, WRITE_HEADERS, type ProjectsTestApp, projectsTestApp, selectionBody } from './test/support.js';

const apps: ProjectsTestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  delete process.env['EDR_AI_API_KEY'];
  delete process.env['FOOTBALL_DATA_API_TOKEN'];
});

const NAMES = ['research', 'verification', 'content', 'rendering', 'visual_qa'] as const;

function stagesOf(calls: StageCall[], overrides: Partial<Record<AnyStage['name'], AnyStage>> = {}): AnyStage[] {
  return NAMES.map((name) => overrides[name] ?? fakeStage(name, calls));
}

async function start(options: Parameters<typeof projectsTestApp>[0] = {}): Promise<ProjectsTestApp> {
  const app = await projectsTestApp({ stages: () => stagesOf([]), ...options });
  apps.push(app);
  return app;
}

function get(app: ProjectsTestApp, url: string) {
  return app.inject({ method: 'GET', url: `/api/v1${url}`, headers: READ_HEADERS });
}

function send(app: ProjectsTestApp, method: 'POST' | 'PATCH' | 'PUT', url: string, body: unknown) {
  return app.inject({ method, url: `/api/v1${url}`, headers: WRITE_HEADERS, payload: JSON.stringify(body) });
}

async function createProject(app: ProjectsTestApp, body = selectionBody('liga-demo', 'demo-a', '2026', 'regular', 1)) {
  const response = await send(app, 'POST', '/projects', body);
  expect(response.statusCode, response.body).toBe(201);
  return ProjectSchema.parse(response.json());
}

function count(app: ProjectsTestApp, table: 'projects' | 'workflow_runs' | 'content_drafts'): number {
  const sql = {
    projects: 'SELECT COUNT(*) AS n FROM projects',
    workflow_runs: 'SELECT COUNT(*) AS n FROM workflow_runs',
    content_drafts: 'SELECT COUNT(*) AS n FROM content_drafts WHERE superseded_at IS NULL',
  }[table];
  return (app.db.prepare(sql).get() as { n: number }).n;
}

/** Inserts an active synthetic draft for the project (made by a completed run). */
function insertActiveDraft(app: ProjectsTestApp, projectId: string, runId: string): string {
  const id = '22222222-2222-4222-8222-222222222222';
  app.db
    .prepare(
      'INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, ' +
        "excluded_match_keys, left_out_matches, created_at, superseded_at) VALUES (?, ?, ?, ?, 'es', 1, '[]', '[]', ?, NULL)",
    )
    .run([id, projectId, runId, runId, '2026-10-27T12:00:00.000Z']);
  return id;
}

async function completedRun(app: ProjectsTestApp, projectId: string): Promise<string> {
  const response = await send(app, 'POST', `/projects/${projectId}/runs`, { kind: 'full' });
  expect(response.statusCode).toBe(202);
  const run = RunSchema.parse(response.json());
  await app.module.runnerFor(app.container).settled(run.id);
  return run.id;
}

describe('create, list and open projects (R-200, R-243, R-269, R-287)', () => {
  it('creates a DEMO_DATA project from a catalogue selection, lists it and opens it', async () => {
    const app = await start();
    const project = await createProject(app);
    expect(project).toMatchObject({
      competitionId: 'liga-demo',
      competitionName: 'Liga Demo',
      sourceId: 'demo-a',
      sourceName: 'Synthetic demo-a',
      dataMode: 'DEMO_DATA',
      demonstration: true,
      seasonId: '2026',
      seasonLabel: '2026/27',
      stageId: 'regular',
      stageLabel: 'Fase Regular',
      matchday: 1,
      language: 'es',
      approvalState: 'no_draft',
      lastExportAt: null,
      latestRun: null,
      activeDraftId: null,
      title: 'Liga Demo 2026/27 · Fase Regular · Jornada 1',
    });

    const list = ProjectListResponseSchema.parse((await get(app, '/projects')).json());
    expect(list.projects.map((entry) => [entry.id, entry.demonstration, entry.dataMode, entry.sourceName])).toEqual([
      [project.id, true, 'DEMO_DATA', 'Synthetic demo-a'],
    ]);
    const opened = ProjectSchema.parse((await get(app, `/projects/${project.id}`)).json());
    expect(opened).toEqual(project);

    // The project records the source, the data mode and the opaque selection reference (R-056, R-287).
    const row = app.db
      .prepare('SELECT source_id, data_mode, selection_ref, standings_expected FROM projects WHERE id = ?')
      .get([project.id]) as Record<string, string>;
    expect(row['source_id']).toBe('demo-a');
    expect(row['data_mode']).toBe('DEMO_DATA');
    expect(() => JSON.parse(row['selection_ref'] ?? '') as unknown).not.toThrow();
    expect(row['standings_expected']).toBe('expected');
  });

  it('accepts every stage the source reports, a whole stage after the league stage and its matchdays (R-284)', async () => {
    const app = await start();
    const whole = await createProject(app, selectionBody('copa-demo', 'demo-a', '2026', 'octavos', null));
    expect(whole).toMatchObject({
      stageLabel: 'Octavos de Final',
      matchday: null,
      title: 'Copa Demo 2026/27 · Octavos de Final',
    });
    const semifinal = await createProject(app, selectionBody('copa-demo', 'demo-a', '2026', 'semifinal', 2));
    expect(semifinal).toMatchObject({ stageLabel: 'Semifinal', matchday: 2 });
    const stored = app.db.prepare('SELECT standings_expected FROM projects WHERE id = ?').get([whole.id]) as {
      standings_expected: string;
    };
    expect(stored.standings_expected).toBe('not_expected');
  });

  it('records the chosen source for a competition with two sources (R-287, OD-16)', async () => {
    const app = await start();
    const first = await createProject(
      app,
      selectionBody('liga-stub', 'stub-a', '2026', 'regular', 2, { language: 'en' }),
    );
    const second = await createProject(app, selectionBody('liga-stub', 'stub-b', '2026', 'regular', 2));
    expect([first.sourceId, first.dataMode, first.demonstration, first.language]).toEqual([
      'stub-a',
      'LIVE_DATA',
      false,
      'en',
    ]);
    expect(first.title).toBe('Liga Stub 2026/27 · Fase Regular · Matchday 2');
    expect([second.sourceId, second.sourceName, second.language]).toEqual(['stub-b', 'Stub stub-b', 'es']);
    // Newest first.
    const list = ProjectListResponseSchema.parse((await get(app, '/projects')).json());
    expect(list.projects.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it.each([
    ['an unknown competition', selectionBody('copa-nada', 'demo-a', '2026', 'regular', 1), 'competition_unavailable'],
    [
      'a source the link does not bind',
      selectionBody('liga-demo', 'stub-a', '2026', 'regular', 1),
      'competition_unavailable',
    ],
    ['a verification-role source', selectionBody('liga-demo', 'demo-b', '2026', 'regular', 1), 'source_not_selectable'],
    ['an unknown season', selectionBody('liga-demo', 'demo-a', '1999', 'regular', 1), 'season_unavailable'],
    ['an unknown stage', selectionBody('liga-demo', 'demo-a', '2026', 'playoff', 1), 'stage_unavailable'],
    ['an unknown matchday', selectionBody('liga-demo', 'demo-a', '2026', 'regular', 9), 'stage_unavailable'],
    [
      'a whole stage that is not selectable as a whole',
      selectionBody('liga-demo', 'demo-a', '2026', 'regular', null),
      'stage_unavailable',
    ],
    ['a matchday of a whole-only stage', selectionBody('copa-demo', 'demo-a', '2026', 'final', 1), 'stage_unavailable'],
  ])('refuses %s with SELECTION_UNAVAILABLE and a reason (R-243, R-286)', async (_label, body, reason) => {
    const app = await start();
    const response = await send(app, 'POST', '/projects', body);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'SELECTION_UNAVAILABLE', refusalReason: reason });
    expect(count(app, 'projects')).toBe(0);
  });

  it('refuses a selection the source restricts (subscription) without fetching the selection (R-286)', async () => {
    const app = await start();
    app.stub.overrides.set('stub-a/listSeasons', new SourceError('not_available', 'restricted', 'stub-a', null, 403));
    const response = await send(app, 'POST', '/projects', selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'SELECTION_UNAVAILABLE', refusalReason: 'season_unavailable' });
    expect(app.stub.count('stub-a', 'fetchSelection')).toBe(0);
  });

  it('answers PROVIDER_RATE_LIMITED or PROVIDER_FAILED when the source cannot be asked', async () => {
    const app = await start();
    app.stub.overrides.set('stub-a/listStages', new SourceError('rate_limited', 'x', 'stub-a', null, null, 15));
    const limited = await send(app, 'POST', '/projects', selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
    expect(limited.statusCode).toBe(503);
    expect(limited.json()).toMatchObject({ code: 'PROVIDER_RATE_LIMITED', retryAfterSeconds: 15 });

    app.stub.overrides.set('stub-b/listStages', new SourceError('timeout', 'provider body <html>', 'stub-b'));
    const failed = await send(app, 'POST', '/projects', selectionBody('liga-stub', 'stub-b', '2026', 'regular', 1));
    expect(failed.statusCode).toBe(502);
    expect(failed.json()).toMatchObject({ code: 'PROVIDER_FAILED' });
    expect(failed.body).not.toContain('<html>');
    expect(count(app, 'projects')).toBe(0);
  });

  it('refuses incomplete or invalid bodies with 400 and closed pointers', async () => {
    const app = await start();
    const missing = await send(app, 'POST', '/projects', { competitionId: 'liga-demo', sourceId: 'demo-a' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    const extra = await send(
      app,
      'POST',
      '/projects',
      selectionBody('liga-demo', 'demo-a', '2026', 'regular', 1, { 'x-evil': 1 }),
    );
    expect(extra.statusCode).toBe(400);
    expect(extra.body).not.toContain('x-evil');
    const language = await send(
      app,
      'POST',
      '/projects',
      selectionBody('liga-demo', 'demo-a', '2026', 'regular', 1, { language: 'fr' }),
    );
    expect(language.statusCode).toBe(400);
    expect(count(app, 'projects')).toBe(0);
  });

  it('keeps the local request protections on the routes (AD-14)', async () => {
    const app = await start();
    const body = JSON.stringify(selectionBody('liga-demo', 'demo-a', '2026', 'regular', 1));
    const noClient = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { host: WRITE_HEADERS.host, 'content-type': 'application/json' },
      payload: body,
    });
    expect(noClient.statusCode).toBe(403);
    const foreignOrigin = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...WRITE_HEADERS, origin: 'http://evil.example' },
      payload: body,
    });
    expect(foreignOrigin.statusCode).toBe(403);
    const text = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...WRITE_HEADERS, 'content-type': 'text/plain' },
      payload: body,
    });
    expect(text.statusCode).toBe(415);
    const host = await app.inject({ method: 'GET', url: '/api/v1/projects', headers: { host: 'evil.example:4300' } });
    expect(host.statusCode).toBe(421);
    expect(count(app, 'projects')).toBe(0);
  });

  it('answers 404 for an unknown project and 400 for a malformed ID', async () => {
    const app = await start();
    const unknown = await get(app, '/projects/33333333-3333-4333-8333-333333333333');
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toMatchObject({ code: 'NOT_FOUND' });
    expect((await get(app, '/projects/not-a-uuid')).statusCode).toBe(400);
  });
});

describe('content language (R-236, R-051)', () => {
  it('changes the language and supersedes the active draft; refuses during a run', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    let gated = false;
    const research = fakeStage('research', calls);
    const slow: AnyStage = {
      ...research,
      run: async (input, ctx) => {
        if (gated) {
          await gate.promise;
        }
        return research.run(input, ctx);
      },
    };
    const app = await start({ stages: () => stagesOf(calls, { research: slow }) });
    const project = await createProject(app);
    const runId = await completedRun(app, project.id);
    const draftId = insertActiveDraft(app, project.id, runId);
    expect(ProjectSchema.parse((await get(app, `/projects/${project.id}`)).json())).toMatchObject({
      activeDraftId: draftId,
      approvalState: 'in_review',
    });

    const changed = await send(app, 'PATCH', `/projects/${project.id}`, { language: 'en' });
    expect(changed.statusCode).toBe(200);
    expect(ProjectSchema.parse(changed.json())).toMatchObject({
      language: 'en',
      activeDraftId: null,
      approvalState: 'no_draft',
    });
    expect(count(app, 'content_drafts')).toBe(0);

    gated = true;
    const running = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(running.statusCode).toBe(202);
    const refused = await send(app, 'PATCH', `/projects/${project.id}`, { language: 'es' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'RUN_IN_PROGRESS' });
    gate.resolve();
    await app.module.runnerFor(app.container).idle();
    expect(ProjectSchema.parse((await get(app, `/projects/${project.id}`)).json()).language).toBe('en');

    expect((await send(app, 'PATCH', `/projects/${project.id}`, { language: 'xx' })).statusCode).toBe(400);
    expect(
      (await send(app, 'PATCH', '/projects/33333333-3333-4333-8333-333333333333', { language: 'es' })).statusCode,
    ).toBe(404);
  });
});

describe('runs (R-203, AD-10)', () => {
  it('starts a full run, reports per-stage status while polling and completes', async () => {
    const calls: StageCall[] = [];
    const app = await start({ stages: () => stagesOf(calls) });
    const project = await createProject(app);
    const response = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(response.statusCode).toBe(202);
    const run = RunSchema.parse(response.json());
    expect(run).toMatchObject({ projectId: project.id, runNumber: 1, kind: 'full', status: 'pending' });
    expect(run.stages.map((stage) => stage.stage)).toEqual([...NAMES]);

    await app.module.runnerFor(app.container).settled(run.id);
    const polled = RunSchema.parse((await get(app, `/projects/${project.id}/runs/${run.id}`)).json());
    expect(polled.status).toBe('completed');
    expect(polled.stages.every((stage) => stage.status === 'completed')).toBe(true);
    expect(ProjectSchema.parse((await get(app, `/projects/${project.id}`)).json()).latestRun?.id).toBe(run.id);
  });

  it('shows a simulated provider failure as a failed stage with its reason, and a new run can be started', async () => {
    const calls: StageCall[] = [];
    let attempts = 0;
    const base = fakeStage('research', calls);
    const research: AnyStage = {
      ...base,
      run: async (input, ctx) => {
        attempts += 1;
        if (attempts === 1) {
          throw new SourceError('unavailable', `${TEST_MARKER_TOKEN} provider body`, 'stub-a', null, 503);
        }
        return base.run(input, ctx);
      },
    };
    const app = await start({ stages: () => stagesOf(calls, { research }) });
    const project = await createProject(app);

    const failedRunId = await completedRun(app, project.id);
    const failed = await get(app, `/projects/${project.id}/runs/${failedRunId}`);
    const failedRun = RunSchema.parse(failed.json());
    const expected = { code: 'unavailable', sourceId: 'stub-a', path: null, httpStatus: 503 };
    expect(failedRun.status).toBe('failed');
    expect(failedRun.failure).toEqual(expected);
    expect(failedRun.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'failed'],
      ['verification', 'skipped'],
      ['content', 'skipped'],
      ['rendering', 'skipped'],
      ['visual_qa', 'skipped'],
    ]);
    expect(failedRun.stages[0]?.failure).toEqual(expected);
    expect(failed.body).not.toContain(TEST_MARKER_TOKEN);

    const retryId = await completedRun(app, project.id);
    const runs = RunListResponseSchema.parse((await get(app, `/projects/${project.id}/runs`)).json()).runs;
    expect(runs.map((run) => [run.id, run.runNumber, run.status])).toEqual([
      [retryId, 2, 'completed'],
      [failedRunId, 1, 'failed'],
    ]);
  });

  it('refuses a second run while one is active (RUN_IN_PROGRESS)', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    const app = await start({
      stages: () => stagesOf(calls, { research: fakeStage('research', calls, { gate: gate.promise }) }),
    });
    const project = await createProject(app);
    const first = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(first.statusCode).toBe(202);
    const second = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ code: 'RUN_IN_PROGRESS' });
    expect(count(app, 'workflow_runs')).toBe(1);
    gate.resolve();
    await app.module.runnerFor(app.container).idle();
  });

  it('refuses a redraft without a completed verification, then runs it on the latest verified run', async () => {
    const calls: StageCall[] = [];
    const app = await start({ stages: () => stagesOf(calls) });
    const project = await createProject(app);
    const refused = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'redraft' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'NO_VERIFIED_RUN' });

    const fullId = await completedRun(app, project.id);
    const redraft = await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'redraft' });
    expect(redraft.statusCode).toBe(202);
    const run = RunSchema.parse(redraft.json());
    expect(run.stages.map((stage) => stage.stage)).toEqual(['content', 'rendering', 'visual_qa']);
    await app.module.runnerFor(app.container).settled(run.id);
    const base = app.db.prepare('SELECT base_run_id FROM workflow_runs WHERE id = ?').get([run.id]) as {
      base_run_id: string;
    };
    expect(base.base_run_id).toBe(fullId);
  });

  it('fails a run with stage_not_available when no registered module provides a stage of the run', async () => {
    // Every stage is registered except one (here `rendering`); the run stops there (R-203, AD-10).
    const calls: StageCall[] = [];
    const app = await start({ stages: () => stagesOf(calls).filter((stage) => stage.name !== 'rendering') });
    const project = await createProject(app);
    const runId = await completedRun(app, project.id);
    const run = RunSchema.parse((await get(app, `/projects/${project.id}/runs/${runId}`)).json());
    const notAvailable = { code: 'stage_not_available', sourceId: null, path: null, httpStatus: null };
    expect(run.status).toBe('failed');
    expect(run.failure).toEqual(notAvailable);
    expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'completed'],
      ['verification', 'completed'],
      ['content', 'completed'],
      ['rendering', 'failed'],
      ['visual_qa', 'skipped'],
    ]);
    expect(run.stages.find((stage) => stage.stage === 'rendering')?.failure).toEqual(notAvailable);
    // No stage after the missing one ran.
    expect([...new Set(calls.map((call) => call.stage))]).toEqual(['research', 'verification', 'content']);
  });

  it('answers 404 for a run of another project and 400 for an invalid kind', async () => {
    const app = await start();
    const project = await createProject(app);
    const other = await createProject(app, selectionBody('liga-demo', 'demo-a', '2026', 'regular', 2));
    const runId = await completedRun(app, project.id);
    expect((await get(app, `/projects/${other.id}/runs/${runId}`)).statusCode).toBe(404);
    expect((await get(app, '/projects/33333333-3333-4333-8333-333333333333/runs')).statusCode).toBe(404);
    expect((await send(app, 'POST', `/projects/${project.id}/runs`, { kind: 'partial' })).statusCode).toBe(400);
    expect(
      (await send(app, 'POST', '/projects/33333333-3333-4333-8333-333333333333/runs', { kind: 'full' })).statusCode,
    ).toBe(404);
  });

  it('stores a configuration snapshot without the environment credentials (T10-F11)', async () => {
    process.env['EDR_AI_API_KEY'] = TEST_DUMMY_API_KEY;
    process.env['FOOTBALL_DATA_API_TOKEN'] = TEST_MARKER_TOKEN;
    const app = await start();
    const project = await createProject(app, selectionBody('liga-stub', 'stub-a', '2026', 'regular', 1));
    await completedRun(app, project.id);
    const stored = JSON.stringify(app.db.prepare('SELECT config_snapshot FROM workflow_runs').all());
    expect(stored).toContain('stub-a');
    expect(stored).toContain('unconfirmed');
    expect(stored).not.toContain(TEST_DUMMY_API_KEY);
    expect(stored).not.toContain(TEST_MARKER_TOKEN);
    expect(stored).not.toContain('example.test');
  });
});

describe('startup hook (AD-10)', () => {
  it('fails runs left running with interrupted and keeps the sources table in step with the configuration', async () => {
    const app = await start();
    const project = await createProject(app);
    const runId = await completedRun(app, project.id);
    app.db
      .prepare("UPDATE workflow_runs SET status = 'running', failure = NULL, finished_at = NULL WHERE id = ?")
      .run([runId]);
    app.db.prepare("UPDATE stage_runs SET status = 'running' WHERE run_id = ? AND stage = 'content'").run([runId]);
    app.db
      .prepare("UPDATE stage_runs SET status = 'pending' WHERE run_id = ? AND stage IN ('rendering', 'visual_qa')")
      .run([runId]);

    await app.module.onStartup?.(app.container);
    const run = RunSchema.parse((await get(app, `/projects/${project.id}/runs/${runId}`)).json());
    expect(run.status).toBe('failed');
    expect(run.failure?.code).toBe('interrupted');
    expect(run.stages.map((stage) => stage.status)).toEqual(['completed', 'completed', 'failed', 'skipped', 'skipped']);

    const sources = app.db.prepare('SELECT id, mode, publication_permission FROM sources ORDER BY id').all();
    expect(sources).toEqual([
      { id: 'demo-a', mode: 'DEMO_DATA', publication_permission: 'not_applicable' },
      { id: 'demo-b', mode: 'DEMO_DATA', publication_permission: 'not_applicable' },
      { id: 'stub-a', mode: 'LIVE_DATA', publication_permission: 'unconfirmed' },
      { id: 'stub-b', mode: 'LIVE_DATA', publication_permission: 'unconfirmed' },
    ]);
  });
});
