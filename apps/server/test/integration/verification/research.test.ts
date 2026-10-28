/**
 * Research through the HTTP API on the T23 DEMO_DATA scenarios (fixtures/sports, fixtures/config), league and
 * stage-based competitions: fixture values reproduced (R-202), attribution (R-204), stage status, failure and
 * restart (R-203), malformed data rejected and used in no later stage (R-224), no player-level field or value stored
 * (R-232), and each stage exercised in isolation through the stage kit (R-225).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Run } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { StageContext } from '../../../src/modules/module-kit.js';
import { ResearchRepository, researchStage } from '../../../src/modules/research/index.js';
import { verificationStage } from '../../../src/modules/verification/index.js';
import { type AnyStage, NO_RUN_PARAMETERS, RunRepository, buildConfigSnapshot } from '../../../src/workflow/index.js';
import {
  type Json,
  LIGA_DEMO_MD1,
  PERSON_MARKER_PREFIX,
  type ProjectSelection,
  SPORTS_FIXTURES_DIR,
  type TestApp,
  type TestAppOptions,
  expectNoNetworkViolations,
  readJson,
  startTestApp,
  temporaryDirectory,
} from '../../support/index.js';

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
});

async function start(options: TestAppOptions): Promise<TestApp> {
  const app = await startTestApp(options);
  cleanups.push(() => app.close());
  return app;
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture access
// ---------------------------------------------------------------------------------------------------------------

interface FixtureSelection {
  readonly teams: Json[];
  readonly matches: Json[];
  readonly standings: Json;
  readonly context: Json[];
}

/** The selection payload of a fixture file (matchday `null` = the stage as a whole). */
function fixtureSelection(scenario: string, sourceId: string, selection: ProjectSelection): FixtureSelection {
  const file = readJson<Json>(join(SPORTS_FIXTURES_DIR, scenario, `${sourceId}.json`));
  const competition = (file['competitions'] as Json[]).find((entry) => entry['localKey'] === selection.competitionId);
  const season = (competition?.['seasons'] as Json[] | undefined)?.find((entry) => entry['id'] === selection.seasonId);
  const stage = (season?.['stages'] as Json[] | undefined)?.find((entry) => entry['id'] === selection.stageId);
  const payload =
    selection.matchday === null
      ? (stage?.['wholeStage'] as Json | undefined)
      : ((stage?.['matchdays'] as Json | undefined)?.[String(selection.matchday)] as Json | undefined);
  if (payload === undefined) {
    throw new Error('selection not in the fixture file');
  }
  return {
    teams: payload['teams'] as Json[],
    matches: payload['matches'] as Json[],
    standings: payload['standings'] as Json,
    context: payload['context'] as Json[],
  };
}

function observationsOf(t: TestApp, runId: string) {
  return new ResearchRepository(t.container.db).observations(runId);
}

function retrievalsOf(t: TestApp, runId: string) {
  return new ResearchRepository(t.container.db).retrievals(runId);
}

function count(t: TestApp, sql: string, params: readonly string[]): number {
  return (t.container.db.prepare<{ n: number }>(sql).get([...params]) as { n: number }).n;
}

const STANDING_FIELDS = [
  'position',
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'goalDifference',
  'points',
] as const;

/** Asserts that the stored research observations of demo-a reproduce the fixture selection exactly. */
function expectObservationsEqualFixture(t: TestApp, run: Run, fixture: FixtureSelection): void {
  const observations = observationsOf(t, run.id).filter((observation) => observation.sourceId === 'demo-a');
  const byKey = new Map(observations.map((observation) => [observation.factKey, observation]));

  for (const match of fixture.matches) {
    const key = String(match['matchKey']);
    const teams = byKey.get(`match:${key}:teams`);
    expect(teams?.value, key).toEqual({
      kind: 'match_teams',
      matchKey: key,
      homeTeamKey: match['homeTeamKey'],
      awayTeamKey: match['awayTeamKey'],
    });
    expect(teams?.sourceRef).toBe(match['ref']);
    const kickoff = byKey.get(`match:${key}:kickoff`)?.value as { kickoff: string } | undefined;
    expect(Date.parse(kickoff?.kickoff ?? ''), key).toBe(Date.parse(String(match['kickoff'])));
    expect(byKey.get(`match:${key}:status`)?.value).toEqual({
      kind: 'match_status',
      matchKey: key,
      matchStatus: match['status'],
    });
    const score = byKey.get(`match:${key}:score`)?.value;
    if (match['status'] === 'finished') {
      expect(score, key).toEqual({ kind: 'match_score', matchKey: key, ...(match['score'] as Json) });
    }
  }
  expect(observations.filter((observation) => observation.value.kind === 'match_teams')).toHaveLength(
    fixture.matches.length,
  );

  for (const team of fixture.teams) {
    const observation =
      byKey.get(`team:${String(team['teamKey'])}:name`) ??
      observations.find((entry) => entry.value.kind === 'team' && entry.value.teamKey === team['teamKey']);
    expect(observation?.value, String(team['teamKey'])).toMatchObject({ kind: 'team', name: team['name'] });
  }

  const rows = (fixture.standings['rows'] as Json[] | undefined) ?? [];
  const standingObservations = observations.filter((observation) => observation.value.kind === 'standing_row');
  expect(standingObservations).toHaveLength(fixture.standings['available'] === true ? rows.length : 0);
  for (const row of rows) {
    const observation = standingObservations.find((entry) => entry.sourceRef === row['ref']);
    for (const field of STANDING_FIELDS) {
      expect(
        (observation?.value as Record<string, unknown> | undefined)?.[field],
        `${String(row['ref'])} ${field}`,
      ).toBe(row[field]);
    }
    expect((observation?.value as { teamKey?: unknown } | undefined)?.teamKey).toBe(row['teamKey']);
  }

  const contextObservations = observations.filter((observation) => observation.value.kind === 'context_item');
  expect(fixture.context.length).toBeGreaterThan(0);
  expect(contextObservations).toHaveLength(fixture.context.length);
  fixture.context.forEach((item, index) => {
    const observation = contextObservations.find((entry) => entry.sourceRef === item['ref']);
    const { ref: _ref, ...content } = item;
    expect(observation?.value).toEqual({ kind: 'context_item', index, item: content });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// R-202, R-204
// ---------------------------------------------------------------------------------------------------------------

describe('fixture values reproduced (R-202) with attribution (R-204)', () => {
  it('league matchday: every match, team, finished score, date, the full standings and the context equal the fixture', async () => {
    const t = await start({ base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const fixture = fixtureSelection('default', 'demo-a', LIGA_DEMO_MD1);
    expect(fixture.matches).toHaveLength(8);
    expect(fixture.standings['available']).toBe(true);
    expectObservationsEqualFixture(t, run, fixture);

    // The same values through the HTTP API: each fact's evidence from demo-a carries the fixture value and reference.
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.standings).toEqual({ available: true, reason: null });
    for (const match of fixture.matches) {
      const ofMatch = facts.facts.filter((fact) =>
        fact.evidence.some((evidence) => evidence.sourceId === 'demo-a' && evidence.sourceRef === match['ref']),
      );
      const score = ofMatch.find((fact) => fact.kind === 'match_score');
      expect(score?.value, String(match['matchKey'])).toEqual(match['score']);
      const kickoff = ofMatch.find((fact) => fact.kind === 'match_kickoff')?.value as { kickoff: string } | null;
      expect(Date.parse(kickoff?.kickoff ?? '')).toBe(Date.parse(String(match['kickoff'])));
      expect(ofMatch.find((fact) => fact.kind === 'match_status')?.value).toEqual({ matchStatus: match['status'] });
      expect(ofMatch.find((fact) => fact.kind === 'match_teams')).toBeDefined();
    }
    const officialNames = facts.facts
      .filter((fact) => fact.kind === 'team_official_name')
      .map((fact) => (fact.value as { officialName: string }).officialName)
      .sort();
    expect(officialNames).toEqual(fixture.teams.map((team) => String(team['name'])).sort());
    for (const row of fixture.standings['rows'] as Json[]) {
      const fact = facts.facts.find(
        (entry) =>
          entry.kind === 'standing_row' && entry.evidence.some((evidence) => evidence.sourceRef === row['ref']),
      );
      for (const field of STANDING_FIELDS) {
        expect((fact?.value as Record<string, unknown> | null)?.[field]).toBe(row[field]);
      }
    }
    expect(facts.facts.filter((fact) => fact.kind === 'context_item').length).toBeGreaterThanOrEqual(1);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });

  it.each([
    ['a named two-legged stage (Octavos de Final, leg 1)', { stageId: 'octavos-de-final', matchday: 1 }],
    ['a stage selected as a whole (Final)', { stageId: 'final', matchday: null }],
  ] as const)('stage-based competition, %s: matches equal the fixture, no standings derived', async (_name, part) => {
    const selection: ProjectSelection = { competitionId: 'copa-demo', sourceId: 'demo-a', seasonId: '2025', ...part };
    const t = await start({ base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(selection);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const fixture = fixtureSelection('default', 'demo-a', selection);
    expect(fixture.standings).toMatchObject({ available: false, reason: 'not_provided_for_stage' });
    expectObservationsEqualFixture(t, run, fixture);
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(facts.facts.filter((fact) => fact.kind === 'standing_row')).toEqual([]);
    expect(facts.facts.filter((fact) => fact.kind === 'match_score')).toHaveLength(fixture.matches.length);
  });

  it('every stored observation and every fact names its source, reference and retrieval time (R-204)', async () => {
    const t = await start({ base: 'demo-official', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status).toBe('completed');

    const observations = observationsOf(t, run.id);
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(observation.sourceId).toMatch(/^demo-(a|b|official)$/);
      expect(observation.sourceRef.length).toBeGreaterThan(0);
      expect(observation.sourceRef).not.toMatch(/^https?:/i);
      expect(Number.isNaN(Date.parse(observation.retrievedAt))).toBe(false);
      expect(observation.dataMode).toBe('DEMO_DATA');
    }
    expect(
      count(
        t,
        "SELECT COUNT(*) AS n FROM observations WHERE run_id = ? AND (source_id IS NULL OR source_ref IS NULL OR source_ref = '' OR retrieved_at IS NULL OR retrieved_at = '')",
        [run.id],
      ),
    ).toBe(0);

    const facts = await t.listFacts(project.id, run.id);
    for (const fact of facts.facts) {
      expect(fact.evidence.length, fact.factKey).toBeGreaterThan(0);
      for (const evidence of fact.evidence) {
        expect(evidence.sourceId.length).toBeGreaterThan(0);
        expect(evidence.sourceName.length).toBeGreaterThan(0);
        expect(evidence.sourceRef.length).toBeGreaterThan(0);
        expect(Number.isNaN(Date.parse(evidence.retrievedAt))).toBe(false);
      }
    }
  });

  it('an observation without attribution is rejected by validation and nothing of the run is stored (R-204, R-224)', async () => {
    const stripping: AnyStage = {
      ...(researchStage as unknown as AnyStage),
      run: async (input, ctx) => {
        const output = (await (researchStage as unknown as AnyStage).run(input, ctx)) as Json;
        const observations = output['observations'] as Json[];
        const [first, ...rest] = observations;
        const { sourceRef: _ref, ...unattributed } = first as Json;
        return { ...output, observations: [unattributed, ...rest] };
      },
    };
    const t = await start({ base: 'demo-only', scenario: 'default', stageOverrides: { research: stripping } });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status).toBe('failed');
    expect(run.stages[0]).toMatchObject({ stage: 'research', status: 'failed' });
    expect(run.stages[0]?.failure?.code).toBe('invalid');
    expect(run.stages.slice(1).map((stage) => stage.status)).toEqual(['skipped', 'skipped', 'skipped', 'skipped']);
    expect(count(t, 'SELECT COUNT(*) AS n FROM observations WHERE run_id = ?', [run.id])).toBe(0);
    expect(count(t, 'SELECT COUNT(*) AS n FROM facts WHERE run_id = ?', [run.id])).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-203
// ---------------------------------------------------------------------------------------------------------------

describe('stage status, failure and restart (R-203)', () => {
  it('shows each stage status while research runs', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gated: AnyStage = {
      ...(researchStage as unknown as AnyStage),
      run: async (input, ctx) => {
        await gate;
        return (researchStage as unknown as AnyStage).run(input, ctx);
      },
    };
    const t = await start({ base: 'demo-only', scenario: 'default', stageOverrides: { research: gated } });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const started = await t.send('POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(started.statusCode).toBe(202);
    const runId = (started.json() as { id: string }).id;
    let running: Run | null = null;
    for (let attempt = 0; attempt < 200 && running === null; attempt += 1) {
      const polled = await t.getRun(project.id, runId);
      if (polled.stages[0]?.status === 'running') {
        running = polled;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    expect(running?.status).toBe('running');
    expect(running?.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'running'],
      ['verification', 'pending'],
      ['content', 'pending'],
      ['rendering', 'pending'],
      ['visual_qa', 'pending'],
    ]);
    release();
    await t.projects.runnerFor(t.container).settled(runId);
    expect((await t.getRun(project.id, runId)).status).toBe('completed');
  });

  it.each([
    ['provider-unavailable', 'unavailable'],
    ['rate-limited', 'rate_limited'],
    ['access-refused', 'access_refused'],
    ['not-available', 'not_available'],
    ['timeout', 'timeout'],
    ['no-data', 'no_data'],
  ])(
    'a simulated %s failure shows research failed with its reason; after the source recovers a new run completes',
    async (scenario, code) => {
      const data = temporaryDirectory('restart');
      cleanups.push(data.remove);
      const first = await startTestApp({ base: 'demo-only', scenario: 'default', dataDir: data.path });
      const project = await first.createProject(LIGA_DEMO_MD1);
      await first.close();

      // The same data directory, with demo-a failing as the scenario simulates.
      const failing = await startTestApp({
        base: 'demo-only',
        scenarios: { 'demo-a': scenario, 'demo-b': 'default' },
        dataDir: data.path,
      });
      const failed = await failing.runWorkflow(project.id);
      expect(failed.status).toBe('failed');
      expect(failed.failure).toEqual({ code, sourceId: 'demo-a', path: null, httpStatus: null });
      expect(failed.stages.map((stage) => [stage.stage, stage.status])).toEqual([
        ['research', 'failed'],
        ['verification', 'skipped'],
        ['content', 'skipped'],
        ['rendering', 'skipped'],
        ['visual_qa', 'skipped'],
      ]);
      expect(failed.stages[0]?.failure).toEqual(failed.failure);
      const retrieval = retrievalsOf(failing, failed.id);
      expect(retrieval).toHaveLength(1);
      expect(retrieval[0]?.failure?.code).toBe(code);
      expect(count(failing, 'SELECT COUNT(*) AS n FROM observations WHERE run_id = ?', [failed.id])).toBe(0);
      await failing.close();

      // Restarted with the source available again: research is started again and completes.
      const recovered = await startTestApp({ base: 'demo-only', scenario: 'default', dataDir: data.path });
      cleanups.push(() => recovered.close());
      const retried = await recovered.runWorkflow(project.id);
      expect(retried.status, JSON.stringify(retried.failure)).toBe('completed');
      expect(retried.runNumber).toBe(failed.runNumber + 1);
      const runs = (await recovered.get(`/projects/${project.id}/runs`)).json() as { runs: Run[] };
      expect(runs.runs.map((run) => [run.runNumber, run.status])).toEqual([
        [2, 'completed'],
        [1, 'failed'],
      ]);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-224
// ---------------------------------------------------------------------------------------------------------------

describe('malformed provider data is rejected and used in no later stage (R-224)', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'malformed matchday %i of demo-a: invalid with a validation path',
    async (matchday) => {
      const t = await start({ base: 'demo-only', scenario: 'malformed' });
      const project = await t.createProject({ ...LIGA_DEMO_MD1, matchday });
      const run = await t.runWorkflow(project.id);
      expect(run.status).toBe('failed');
      expect(run.failure?.code).toBe('invalid');
      expect(run.failure?.sourceId).toBe('demo-a');
      expect(run.failure?.path).toMatch(/^\/[A-Za-z0-9/]+$/);
      expect(run.stages.map((stage) => stage.status)).toEqual(['failed', 'skipped', 'skipped', 'skipped', 'skipped']);
      expect(count(t, 'SELECT COUNT(*) AS n FROM observations WHERE run_id = ?', [run.id])).toBe(0);
      expect(count(t, 'SELECT COUNT(*) AS n FROM facts WHERE run_id = ?', [run.id])).toBe(0);
      expect(count(t, 'SELECT COUNT(*) AS n FROM content_drafts WHERE run_id = ?', [run.id])).toBe(0);
      expect(t.aiRequests).toEqual([]);
    },
  );

  it('a team name with characters the name rule rejects is refused before anything is stored', async () => {
    const t = await start({ base: 'demo-only', scenario: 'injection-rejected' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status).toBe('failed');
    expect(run.failure).toEqual({ code: 'invalid', sourceId: 'demo-a', path: '/teams/0/name', httpStatus: null });
    expect(t.databaseText()).not.toContain('Ignore previous instructions');
    expect(t.aiRequests).toEqual([]);
  });

  it('a stored observation that breaks its schema is refused by the next stage, which stores nothing', async () => {
    const t = await start({ base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const { runId, ctx } = isolatedRun(t, project.id);
    await runStage(researchStage as unknown as AnyStage, ctx);
    t.container.db
      .prepare("UPDATE observations SET value = ? WHERE run_id = ? AND fact_key LIKE 'match:%:score'")
      .run(['{"kind":"match_score","matchKey":"x","home":-1,"away":"two"}', runId]);
    await expect(runStage(verificationStage as unknown as AnyStage, ctx)).rejects.toThrow();
    expect(count(t, 'SELECT COUNT(*) AS n FROM facts WHERE run_id = ?', [runId])).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-232
// ---------------------------------------------------------------------------------------------------------------

describe('no player-level field or value in stored results or the drafting input (R-232)', () => {
  it('stores and returns no person-level key or value of the player-fields scenario', async () => {
    const raw = ['demo-a', 'demo-b']
      .map((source) => readFileSync(join(SPORTS_FIXTURES_DIR, 'player-fields', `${source}.json`), 'utf8'))
      .join('\n');
    // Positive control: the fixture really carries person-level fields and values.
    expect(raw).toContain(PERSON_MARKER_PREFIX);
    for (const key of ['"coach"', '"squad"', '"scorers"', '"lineups"', '"referee"', '"players"']) {
      expect(raw).toContain(key);
    }

    const t = await start({ base: 'demo-only', scenario: 'player-fields' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');

    const stored = t.databaseText();
    expect(stored).not.toContain(PERSON_MARKER_PREFIX);
    for (const key of ['"coach"', '"squad"', '"scorers"', '"lineups"', '"referee"', '"topScorer"', '"players"']) {
      expect(stored).not.toContain(key);
    }
    const bodies = await Promise.all(
      [
        `/projects/${project.id}`,
        `/projects/${project.id}/runs/${run.id}`,
        `/projects/${project.id}/runs/${run.id}/facts`,
      ].map(async (path) => (await t.get(path)).body),
    );
    expect(bodies.join('\n')).not.toContain(PERSON_MARKER_PREFIX);
    expect(t.log.text()).not.toContain(PERSON_MARKER_PREFIX);
    // Drafting input: every draft request handed to the AI port (none while the content stage is a placeholder).
    expect(JSON.stringify(t.aiRequests)).not.toContain(PERSON_MARKER_PREFIX);
    if (!t.placeholders.includes('content')) {
      expect(t.aiRequests.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-225
// ---------------------------------------------------------------------------------------------------------------

/** A run row with its stage rows, outside the runner, and the stage context to run stages by hand. */
function isolatedRun(t: TestApp, projectId: string): { runId: string; ctx: StageContext } {
  const runId = crypto.randomUUID();
  new RunRepository(t.container.db).insertRun({
    id: runId,
    projectId,
    kind: 'full',
    baseRunId: null,
    snapshot: buildConfigSnapshot(t.container.config, NO_RUN_PARAMETERS),
    stages: ['research', 'verification', 'content', 'rendering', 'visual_qa'].map((stage) => ({
      id: crypto.randomUUID(),
      stage: stage as 'research',
    })),
  });
  return {
    runId,
    ctx: { runId, projectId, runKind: 'full', container: t.container, signal: new AbortController().signal },
  };
}

/** The stage kit contract: load, input.parse, run, output.parse, persist (contracts/provider-ports.md section 3). */
async function runStage(stage: AnyStage, ctx: StageContext): Promise<unknown> {
  const input = stage.input.parse(await stage.load(ctx));
  const output = stage.output.parse(await stage.run(input, ctx));
  await stage.persist(output, ctx);
  return output;
}

describe('each stage in isolation through the stage kit (R-225)', () => {
  it('runs research alone, then verification alone on its stored output, on the fixtures', async () => {
    const t = await start({ base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const { runId, ctx } = isolatedRun(t, project.id);

    const research = (await runStage(researchStage as unknown as AnyStage, ctx)) as Json;
    expect((research['observations'] as unknown[]).length).toBeGreaterThan(0);
    expect(observationsOf(t, runId).length).toBe((research['observations'] as unknown[]).length);
    expect(count(t, 'SELECT COUNT(*) AS n FROM facts WHERE run_id = ?', [runId])).toBe(0);

    await runStage(verificationStage as unknown as AnyStage, ctx);
    const facts = await t.listFacts(project.id, runId);
    expect(facts.facts.length).toBeGreaterThan(0);
    expect(facts.facts.every((fact) => fact.status === 'verified')).toBe(true);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });

  it('the research stage refuses an input that breaks its schema before any provider call', async () => {
    const t = await start({ base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const { ctx } = isolatedRun(t, project.id);
    const stage = researchStage as unknown as AnyStage;
    const loaded = (await stage.load(ctx)) as Json;
    expect(() => stage.input.parse({ ...loaded, selectionRef: 42 })).toThrow();
    expect(() => stage.input.parse({ ...loaded, unexpected: true })).toThrow();
  });
});
