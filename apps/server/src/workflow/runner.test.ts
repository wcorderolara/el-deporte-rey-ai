/**
 * Unit tests of the workflow runner with fake stages (architecture.md section 6; AD-10; R-203, R-225; T10-F10,
 * T10-F15): stage order per run kind, input and output validation, stage failure with the closed failure and
 * skipping, retry by a new run, one active run per project, redraft base run, missing stage, cancellation and
 * interrupted runs at startup. Synthetic data and an in-memory database only.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { AiProviderError } from '../providers/ai/index.js';
import { SourceError } from '../providers/sports/index.js';

import { StageFailure } from './failure.js';
import { type AnyStage, RunStartRefused, WorkflowRunner, failInterruptedRuns } from './runner.js';
import {
  PROJECT_ID,
  type StageCall,
  type WorkflowFixture,
  deferred,
  fakeStage,
  workflowFixture,
} from './test/support.js';

const SECRET_TEXT = 'edr-test-marker-token-0000 at /Users/operator/secret/path provider body <html>';

let fixture: WorkflowFixture;
const runners: WorkflowRunner[] = [];

afterEach(async () => {
  for (const runner of runners.splice(0)) {
    await runner.shutdown();
  }
  fixture.close();
});

function setup(stages: readonly AnyStage[]): WorkflowRunner {
  fixture = workflowFixture();
  let next = 0;
  const runner = new WorkflowRunner({
    container: fixture.container,
    stages: () => stages,
    newId: () => {
      next += 1;
      return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
    },
  });
  runners.push(runner);
  return runner;
}

function allStages(calls: StageCall[], overrides: Partial<Record<AnyStage['name'], AnyStage>> = {}): AnyStage[] {
  return (['research', 'verification', 'content', 'rendering', 'visual_qa'] as const).map(
    (name) => overrides[name] ?? fakeStage(name, calls),
  );
}

function rawRunRow(runId: string): Record<string, unknown> {
  return fixture.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get([runId]) as Record<string, unknown>;
}

function allStoredText(): string {
  const runs = fixture.db.prepare('SELECT * FROM workflow_runs').all();
  const stages = fixture.db.prepare('SELECT * FROM stage_runs').all();
  return JSON.stringify([runs, stages]);
}

describe('full run', () => {
  it('creates a pending run with pending stages, then runs every stage in order to completion', async () => {
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls));

    const created = runner.start(PROJECT_ID, 'full');
    expect(created).toMatchObject({ projectId: PROJECT_ID, runNumber: 1, kind: 'full', status: 'pending' });
    expect(created.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'pending'],
      ['verification', 'pending'],
      ['content', 'pending'],
      ['rendering', 'pending'],
      ['visual_qa', 'pending'],
    ]);

    await runner.settled(created.id);
    const run = runner.runs.view(created.id);
    expect(run?.status).toBe('completed');
    expect(run?.failure).toBeNull();
    expect(run?.startedAt).not.toBeNull();
    expect(run?.finishedAt).not.toBeNull();
    expect(run?.stages.every((stage) => stage.status === 'completed' && stage.failure === null)).toBe(true);
    expect(calls.map((call) => `${call.stage}:${call.step}`)).toEqual(
      ['research', 'verification', 'content', 'rendering', 'visual_qa'].flatMap((stage) => [
        `${stage}:load`,
        `${stage}:run`,
        `${stage}:persist`,
      ]),
    );
    expect(calls.every((call) => call.runKind === 'full')).toBe(true);
    expect(runner.activeCount).toBe(0);
  });
});

describe('stage failure (R-203, T10-F10)', () => {
  it('fails the stage with the closed failure, skips later stages and fails the run', async () => {
    const calls: StageCall[] = [];
    const research = fakeStage('research', calls, {
      fail: () => new SourceError('unavailable', SECRET_TEXT, 'demo-a', '/matches/0', 503),
    });
    const runner = setup(allStages(calls, { research }));

    const created = runner.start(PROJECT_ID, 'full');
    await runner.settled(created.id);
    const run = runner.runs.view(created.id);

    const expected = { code: 'unavailable', sourceId: 'demo-a', path: '/matches/0', httpStatus: 503 };
    expect(run?.status).toBe('failed');
    expect(run?.failure).toEqual(expected);
    expect(run?.stages.map((stage) => stage.status)).toEqual(['failed', 'skipped', 'skipped', 'skipped', 'skipped']);
    expect(run?.stages[0]?.failure).toEqual(expected);
    expect(calls.some((call) => call.stage !== 'research')).toBe(false);
    expect(calls.some((call) => call.step === 'persist')).toBe(false);
    expect(allStoredText()).not.toContain('marker-token');
    expect(allStoredText()).not.toContain('/Users/');
  });

  it('can be started again by a new run, which completes (R-203)', async () => {
    const calls: StageCall[] = [];
    let attempts = 0;
    const base = fakeStage('research', calls);
    const research: AnyStage = {
      ...base,
      run: async (input, ctx) => {
        attempts += 1;
        if (attempts === 1) {
          throw new SourceError('timeout', 'deadline', 'demo-a');
        }
        return base.run(input, ctx);
      },
    };
    const runner = setup(allStages(calls, { research }));

    const first = runner.start(PROJECT_ID, 'full');
    await runner.settled(first.id);
    expect(runner.runs.view(first.id)?.status).toBe('failed');
    expect(runner.runs.view(first.id)?.failure?.code).toBe('timeout');

    const second = runner.start(PROJECT_ID, 'full');
    expect(second.runNumber).toBe(2);
    await runner.settled(second.id);
    expect(runner.runs.view(second.id)?.status).toBe('completed');
    expect(runner.runs.listViews(PROJECT_ID).map((run) => [run.runNumber, run.status])).toEqual([
      [2, 'completed'],
      [1, 'failed'],
    ]);
  });

  it.each([
    [
      'a stage failure',
      () => new StageFailure('no_data', { sourceId: 'demo-a' }),
      { code: 'no_data', sourceId: 'demo-a', path: null, httpStatus: null },
    ],
    [
      'an AI provider failure',
      () => new AiProviderError('ai_response_invalid', { httpStatus: 200, path: 'slides[0].headline' }),
      { code: 'ai_response_invalid', sourceId: null, path: 'slides[0].headline', httpStatus: 200 },
    ],
    [
      'an unexpected error',
      () => new Error(SECRET_TEXT),
      { code: 'internal', sourceId: null, path: null, httpStatus: null },
    ],
    ['a thrown string', () => SECRET_TEXT, { code: 'internal', sourceId: null, path: null, httpStatus: null }],
  ])('stores only the closed failure of %s', async (_label, fail, expected) => {
    const calls: StageCall[] = [];
    const content = fakeStage('content', calls, { fail });
    const runner = setup(allStages(calls, { content }));
    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    const view = runner.runs.view(run.id);
    expect(view?.failure).toEqual(expected);
    expect(view?.stages.map((stage) => stage.status)).toEqual([
      'completed',
      'completed',
      'failed',
      'skipped',
      'skipped',
    ]);
    expect(allStoredText()).not.toContain('marker-token');
    expect(allStoredText()).not.toContain('<html>');
  });

  it('fails a stage whose output does not match its schema with invalid and a field pointer', async () => {
    const calls: StageCall[] = [];
    const verification = fakeStage('verification', calls, { output: { stage: 'verification', value: 'x' } });
    const runner = setup(allStages(calls, { verification }));
    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    expect(runner.runs.view(run.id)?.failure).toEqual({
      code: 'invalid',
      sourceId: null,
      path: '/value',
      httpStatus: null,
    });
    expect(calls.some((call) => call.stage === 'verification' && call.step === 'persist')).toBe(false);
  });

  it('fails the run with stage_not_available when a stage is not registered', async () => {
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls).filter((stage) => stage.name !== 'rendering'));
    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    const view = runner.runs.view(run.id);
    expect(view?.failure).toEqual({ code: 'stage_not_available', sourceId: null, path: null, httpStatus: null });
    expect(view?.stages.map((stage) => stage.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'failed',
      'skipped',
    ]);
  });

  it('writes a failure no longer than the column limit', async () => {
    const calls: StageCall[] = [];
    const long = `/${'a'.repeat(60)}`.repeat(10);
    const research = fakeStage('research', calls, {
      fail: () => new StageFailure('invalid', { path: long, sourceId: 'demo-a', httpStatus: 422 }),
    });
    const runner = setup(allStages(calls, { research }));
    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    const stored = rawRunRow(run.id)['failure'] as string;
    expect(stored.length).toBeLessThanOrEqual(600);
    expect(runner.runs.view(run.id)?.failure?.path?.length).toBe(200);
  });
});

describe('one active run per project (AD-10, T10-F15)', () => {
  it('refuses a second start while a run is active, and accepts one after it finished', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    const research = fakeStage('research', calls, { gate: gate.promise });
    const runner = setup(allStages(calls, { research }));

    const first = runner.start(PROJECT_ID, 'full');
    expect(() => runner.start(PROJECT_ID, 'full')).toThrow(RunStartRefused);
    try {
      runner.start(PROJECT_ID, 'redraft');
    } catch (error) {
      expect((error as RunStartRefused).reason).toBe('run_in_progress');
    }
    expect(runner.runs.listViews(PROJECT_ID)).toHaveLength(1);

    gate.resolve();
    await runner.settled(first.id);
    expect(runner.start(PROJECT_ID, 'full').runNumber).toBe(2);
    await runner.idle();
  });

  it('runs the before hook first and rolls back everything when a hook throws', () => {
    const runner = setup(allStages([]));
    expect(() =>
      runner.start(PROJECT_ID, 'full', {
        afterGuards: () => {
          throw new Error('refused by the caller');
        },
      }),
    ).toThrow('refused by the caller');
    expect(runner.runs.listViews(PROJECT_ID)).toHaveLength(0);
  });
});

describe('redraft runs', () => {
  it('is refused without a completed verification', () => {
    const runner = setup(allStages([]));
    expect(() => runner.start(PROJECT_ID, 'redraft')).toThrow(
      expect.objectContaining({ reason: 'no_verified_run' }) as Error,
    );
  });

  it('reuses the latest completed verification and runs content, rendering and visual QA only', async () => {
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls));
    const full = runner.start(PROJECT_ID, 'full');
    await runner.settled(full.id);
    calls.length = 0;

    const redraft = runner.start(PROJECT_ID, 'redraft', { parameters: { excludedMatchKeys: ['m-1'] } });
    expect(redraft.stages.map((stage) => stage.stage)).toEqual(['content', 'rendering', 'visual_qa']);
    await runner.settled(redraft.id);
    expect(runner.runs.view(redraft.id)?.status).toBe('completed');
    expect(rawRunRow(redraft.id)['base_run_id']).toBe(full.id);
    expect(runner.runs.parameters(redraft.id)).toEqual({ excludedMatchKeys: ['m-1'] });
    expect(runner.runs.parameters(full.id)).toEqual({ excludedMatchKeys: null });
    expect(calls.map((call) => call.stage)).not.toContain('research');
    expect(calls.every((call) => call.runKind === 'redraft')).toBe(true);
  });
});

describe('interrupted runs', () => {
  it('fails runs left pending or running at startup with interrupted', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    const verification = fakeStage('verification', calls, { gate: gate.promise });
    const runner = setup(allStages(calls, { verification }));
    const run = runner.start(PROJECT_ID, 'full');
    // Let research complete and verification start.
    while (!calls.some((call) => call.stage === 'verification' && call.step === 'run')) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // A restarted process sees the run still running.
    expect(failInterruptedRuns(fixture.container)).toBe(1);
    const view = runner.runs.view(run.id);
    const interrupted = { code: 'interrupted', sourceId: null, path: null, httpStatus: null };
    expect(view?.status).toBe('failed');
    expect(view?.failure).toEqual(interrupted);
    expect(view?.stages.map((stage) => stage.status)).toEqual(['completed', 'failed', 'skipped', 'skipped', 'skipped']);
    expect(view?.stages[1]?.failure).toEqual(interrupted);
    expect(failInterruptedRuns(fixture.container)).toBe(0);

    gate.resolve();
    await runner.settled(run.id);
    // The late stage completion does not revive the failed run.
    expect(runner.runs.view(run.id)?.status).toBe('failed');
  });

  it('cancels active runs on shutdown and fails them with interrupted', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    const research = fakeStage('research', calls, { gate: gate.promise });
    const runner = setup(allStages(calls, { research }));
    const run = runner.start(PROJECT_ID, 'full');
    await new Promise((resolve) => setImmediate(resolve));

    const stopped = runner.shutdown();
    gate.resolve();
    await stopped;
    expect(runner.runs.view(run.id)?.failure?.code).toBe('interrupted');
    expect(runner.runs.view(run.id)?.stages.map((stage) => stage.status)).toEqual([
      'failed',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(() => runner.start(PROJECT_ID, 'full')).toThrow('shut down');
  });
});

describe('cancellation of a project run (PD-ARCH-01F)', () => {
  it('confirms at once when the project has no run executing', async () => {
    const runner = setup(allStages([]));
    expect(await runner.cancelProject(PROJECT_ID)).toBe(true);
  });

  it('cancels a run that stops when aborted and confirms it once stopped', async () => {
    const gate = deferred();
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls, { research: fakeStage('research', calls, { gate: gate.promise }) }));
    const run = runner.start(PROJECT_ID, 'full');
    const cancelled = runner.cancelProject(PROJECT_ID, 1000);
    gate.resolve();
    expect(await cancelled).toBe(true);
    expect(runner.runs.view(run.id)?.status).toBe('failed');
    expect(runner.runs.view(run.id)?.failure?.code).toBe('interrupted');
  });

  it('does not confirm a run that has not stopped within the time limit', async () => {
    const gate = deferred();
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls, { research: fakeStage('research', calls, { gate: gate.promise }) }));
    runner.start(PROJECT_ID, 'full');
    // Wait until the stage is inside its run, which ignores the cancellation until the gate opens.
    while (!calls.some((call) => call.stage === 'research' && call.step === 'run')) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    expect(await runner.cancelProject(PROJECT_ID, 20)).toBe(false);
    gate.resolve();
    await runner.idle();
  });
});
