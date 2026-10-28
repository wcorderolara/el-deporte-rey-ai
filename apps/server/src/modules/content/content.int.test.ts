/**
 * Content stage through the workflow runner (architecture.md section 6; AD-10; OD-43): a full run whose verification
 * stage stores synthetic facts drafts the content; a redraft started with excluded matches reuses those facts and
 * supersedes the draft; an AI failure fails the stage with its closed code and stores no draft. Research,
 * verification, rendering and visual QA are test doubles; the AI provider is the stub. Synthetic data only.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { type AnyStage, WorkflowRunner } from '../../workflow/index.js';
import { type StageCall, fakeStage } from '../../workflow/test/support.js';
import type { StageContext } from '../module-kit.js';

import { serverModule } from './index.js';
import { type DbFixture, PROJECT_ID, aiProvider, dbFixture, leagueFacts, nextId } from './test/support.js';

let fixture: DbFixture | null = null;

afterEach(() => {
  fixture?.close();
  fixture = null;
});

/** A verification double that stores the synthetic facts of the run. */
function verificationDouble(db: DbFixture, calls: StageCall[]): AnyStage {
  const base = fakeStage('verification', calls);
  return {
    ...base,
    async persist(output: unknown, ctx: StageContext) {
      await base.persist(output, ctx);
      db.insertFacts(ctx.runId, leagueFacts());
      db.setStandings(ctx.runId, { available: false, reason: 'not_provided_for_stage' });
    },
  };
}

function runner(db: DbFixture, scenario: string): { runner: WorkflowRunner; calls: StageCall[] } {
  const calls: StageCall[] = [];
  const content = serverModule.stages?.[0];
  if (content === undefined) {
    throw new Error('the content module registers no stage');
  }
  const stages: AnyStage[] = [
    fakeStage('research', calls),
    verificationDouble(db, calls),
    content,
    fakeStage('rendering', calls),
    fakeStage('visual_qa', calls),
  ];
  return {
    runner: new WorkflowRunner({
      container: db.container(aiProvider(scenario)),
      stages: () => stages,
      newId: nextId,
    }),
    calls,
  };
}

function drafts(
  db: DbFixture,
): { id: string; run_id: string; excluded_match_keys: string; superseded_at: string | null }[] {
  return db.db
    .prepare<{ id: string; run_id: string; excluded_match_keys: string; superseded_at: string | null }>(
      'SELECT id, run_id, excluded_match_keys, superseded_at FROM content_drafts ORDER BY created_at, rowid',
    )
    .all();
}

describe('content stage in the workflow', () => {
  it('drafts in a full run and redrafts with the operator exclusions', async () => {
    fixture = dbFixture();
    const { runner: workflow } = runner(fixture, 'built-in');

    const full = workflow.start(PROJECT_ID, 'full');
    await workflow.settled(full.id);
    expect(workflow.runs.view(full.id)?.status).toBe('completed');
    expect(drafts(fixture)).toHaveLength(1);

    const redraft = workflow.start(PROJECT_ID, 'redraft', { parameters: { excludedMatchKeys: ['liga-demo-1-b'] } });
    await workflow.settled(redraft.id);
    expect(workflow.runs.view(redraft.id)?.status).toBe('completed');
    const [first, second] = drafts(fixture);
    expect(first?.superseded_at).not.toBeNull();
    expect(second).toMatchObject({ run_id: redraft.id, excluded_match_keys: '["liga-demo-1-b"]', superseded_at: null });
    const slides = fixture.db
      .prepare<{ n: number }>(
        "SELECT COUNT(*) AS n FROM elements e JOIN carousels c ON c.id = e.carousel_id WHERE c.draft_id = ? AND e.slide_type = 'match_result'",
      )
      .get([second?.id ?? '']);
    expect(slides?.n).toBe(1);
    await workflow.shutdown();
  });

  it('fails the stage with the AI failure code and stores no draft', async () => {
    fixture = dbFixture();
    const { runner: workflow, calls } = runner(fixture, 'unavailable');
    const run = workflow.start(PROJECT_ID, 'full');
    await workflow.settled(run.id);
    const view = workflow.runs.view(run.id);
    expect(view?.status).toBe('failed');
    expect(view?.stages.find((stage) => stage.stage === 'content')?.failure?.code).toBe('unavailable');
    expect(view?.stages.find((stage) => stage.stage === 'rendering')?.status).toBe('skipped');
    expect(calls.some((call) => call.stage === 'rendering')).toBe(false);
    expect(drafts(fixture)).toHaveLength(0);
    await workflow.shutdown();
  });
});
