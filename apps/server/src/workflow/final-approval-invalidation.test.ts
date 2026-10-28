/**
 * Unit tests of the final-approval invalidation at the start of a research run (architecture.md section 11.2; OD-57;
 * T10-F14, T10-F15): a run whose kind includes the research stage invalidates every valid final approval of the
 * project's carousels in the transaction that creates the run, before any stage executes; an already invalidated
 * time is never changed; other projects and runs without research leave them unchanged; a refused or rolled back
 * start invalidates nothing. Fake stages, synthetic rows and an in-memory database only.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { SourceError } from '../providers/sports/index.js';

import { RunRepository } from './repository.js';
import { type AnyStage, RunStartRefused, STAGES_BY_KIND, WorkflowRunner, includesResearch } from './runner.js';
import { buildConfigSnapshot, NO_RUN_PARAMETERS } from './snapshot.js';
import {
  PROJECT_ID,
  type StageCall,
  type WorkflowFixture,
  deferred,
  fakeStage,
  workflowFixture,
} from './test/support.js';

const OTHER_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const APPROVED_AT = '2026-10-27T10:00:00.000Z';
const EARLIER_INVALIDATION = '2026-10-27T10:30:00.000Z';
const SHA = 'a'.repeat(64);

let current: WorkflowFixture | null = null;

/** The fixture of the running test (created by `setup`). */
function fixture(): WorkflowFixture {
  if (current === null) {
    throw new Error('setup() was not called');
  }
  return current;
}
const runners: WorkflowRunner[] = [];
let ids = 0;

function nextId(): string {
  ids += 1;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`;
}

afterEach(async () => {
  for (const runner of runners.splice(0)) {
    await runner.shutdown();
  }
  current?.close();
  current = null;
});

function allStages(calls: StageCall[], overrides: Partial<Record<AnyStage['name'], AnyStage>> = {}): AnyStage[] {
  return (['research', 'verification', 'content', 'rendering', 'visual_qa'] as const).map(
    (name) => overrides[name] ?? fakeStage(name, calls),
  );
}

function setup(stages: readonly AnyStage[], logged: unknown[][] = []): WorkflowRunner {
  current = workflowFixture();
  // The fixture's logger with `info` recorded (its other methods kept through the prototype).
  const logger = Object.assign(Object.create(fixture().container.logger) as object, {
    info: (...args: unknown[]) => {
      logged.push(args);
    },
  });
  const runner = new WorkflowRunner({
    container: { ...fixture().container, logger } as WorkflowFixture['container'],
    stages: () => stages,
    newId: nextId,
  });
  runners.push(runner);
  insertProject(OTHER_PROJECT_ID);
  return runner;
}

function insertProject(projectId: string): void {
  const at = '2026-10-27T11:00:00.000Z';
  fixture()
    .db.prepare(
      'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
        'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at) ' +
        "VALUES (?, 'liga-demo', 'Liga Demo', 'demo-a', 'DEMO_DATA', '2026', '2026/27', 'regular', 'Fase Regular', 1, " +
        "'{\"c\":\"liga-demo\"}', 'expected', 'es', ?, ?)",
    )
    .run([projectId, at, at]);
}

/** A completed full run of the project (stored directly; no invalidation). */
function completedRun(projectId: string): string {
  const runId = nextId();
  fixture().db.transaction(() => {
    new RunRepository(fixture().db).insertRun({
      id: runId,
      projectId,
      kind: 'full',
      baseRunId: null,
      snapshot: buildConfigSnapshot(fixture().container.config, NO_RUN_PARAMETERS),
      stages: STAGES_BY_KIND.full.map((stage) => ({ id: nextId(), stage })),
    });
    fixture().db.prepare("UPDATE workflow_runs SET status = 'completed' WHERE id = ?").run([runId]);
    fixture().db.prepare("UPDATE stage_runs SET status = 'completed' WHERE run_id = ?").run([runId]);
  });
  return runId;
}

/** A draft of the project with `carousels` carousels; returns the carousel IDs. */
function draft(projectId: string, runId: string, carousels: number, supersededAt: string | null = null): string[] {
  const draftId = nextId();
  fixture()
    .db.prepare(
      'INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, ' +
        "excluded_match_keys, left_out_matches, created_at, superseded_at) VALUES (?, ?, ?, ?, 'es', 1, '[]', '[]', ?, ?)",
    )
    .run([draftId, projectId, runId, runId, APPROVED_AT, supersededAt]);
  const result: string[] = [];
  for (let sequence = 1; sequence <= carousels; sequence += 1) {
    const carouselId = nextId();
    fixture()
      .db.prepare('INSERT INTO carousels (id, draft_id, sequence, total) VALUES (?, ?, ?, ?)')
      .run([carouselId, draftId, sequence, carousels]);
    result.push(carouselId);
  }
  return result;
}

function finalApproval(carouselId: string, invalidatedAt: string | null = null): string {
  const id = nextId();
  fixture()
    .db.prepare(
      'INSERT INTO final_approvals (id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run([id, carouselId, JSON.stringify([nextId()]), SHA, APPROVED_AT, invalidatedAt]);
  return id;
}

function invalidatedAt(finalApprovalId: string): string | null {
  const row = fixture()
    .db.prepare<{ invalidated_at: string | null }>('SELECT invalidated_at FROM final_approvals WHERE id = ?')
    .get([finalApprovalId]);
  if (row === undefined) {
    throw new Error('final approval not found');
  }
  return row.invalidated_at;
}

describe('run kinds', () => {
  it('only the full run includes the research stage', () => {
    expect(includesResearch('full')).toBe(true);
    expect(includesResearch('redraft')).toBe(false);
  });
});

describe('a research run invalidates the final approvals of the project (architecture.md 11.2, OD-57)', () => {
  it('invalidates every valid final approval of the project in the start transaction, before any stage runs', async () => {
    const calls: StageCall[] = [];
    const gate = deferred();
    const logged: unknown[][] = [];
    const runner = setup(allStages(calls, { research: fakeStage('research', calls, { gate: gate.promise }) }), logged);
    const base = completedRun(PROJECT_ID);
    const [first, second] = draft(PROJECT_ID, base, 2);
    const [superseded] = draft(PROJECT_ID, base, 1, '2026-10-27T09:00:00.000Z');
    const approvals = [finalApproval(first ?? ''), finalApproval(second ?? ''), finalApproval(superseded ?? '')];

    const run = runner.start(PROJECT_ID, 'full');

    // Synchronously after start: the run is pending, no stage has executed, every final approval is invalid.
    expect(run.status).toBe('pending');
    expect(calls).toEqual([]);
    const times = approvals.map(invalidatedAt);
    expect(times.every((time) => time !== null && time > APPROVED_AT)).toBe(true);
    expect(new Set(times).size).toBe(1);
    expect(
      fixture()
        .db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM final_approvals WHERE invalidated_at IS NULL')
        .get()?.n,
    ).toBe(0);
    expect(logged).toEqual([
      [{ runId: run.id, finalApprovals: 3 }, 'final approvals invalidated: a research run started'],
    ]);

    gate.resolve();
    await runner.settled(run.id);
    expect(runner.runs.view(run.id)?.status).toBe('completed');
    expect(approvals.map(invalidatedAt)).toEqual(times);
  });

  it('never changes an already invalidated time, and a second research run changes nothing', async () => {
    const runner = setup(allStages([]));
    const base = completedRun(PROJECT_ID);
    const [first, second] = draft(PROJECT_ID, base, 2);
    const earlier = finalApproval(first ?? '', EARLIER_INVALIDATION);
    const valid = finalApproval(second ?? '');

    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    const time = invalidatedAt(valid);
    expect(time).not.toBeNull();
    expect(invalidatedAt(earlier)).toBe(EARLIER_INVALIDATION);

    const again = runner.start(PROJECT_ID, 'full');
    await runner.settled(again.id);
    expect(invalidatedAt(valid)).toBe(time);
    expect(invalidatedAt(earlier)).toBe(EARLIER_INVALIDATION);
  });

  it('leaves the final approvals of another project unchanged', async () => {
    const runner = setup(allStages([]));
    const own = finalApproval(draft(PROJECT_ID, completedRun(PROJECT_ID), 1)[0] ?? '');
    const other = finalApproval(draft(OTHER_PROJECT_ID, completedRun(OTHER_PROJECT_ID), 1)[0] ?? '');

    const run = runner.start(PROJECT_ID, 'full');
    await runner.settled(run.id);
    expect(invalidatedAt(own)).not.toBeNull();
    expect(invalidatedAt(other)).toBeNull();
  });

  it.each(['research', 'verification'] as const)(
    'a run that then fails at %s leaves them invalid with the time of the start',
    async (failing) => {
      const calls: StageCall[] = [];
      const runner = setup(
        allStages(calls, {
          [failing]: fakeStage(failing, calls, {
            fail: () => new SourceError('unavailable', 'synthetic failure', 'demo-a', null, null, null),
          }),
        }),
      );
      const approval = finalApproval(draft(PROJECT_ID, completedRun(PROJECT_ID), 1)[0] ?? '');
      const run = runner.start(PROJECT_ID, 'full');
      const time = invalidatedAt(approval);
      expect(time).not.toBeNull();
      await runner.settled(run.id);
      const view = runner.runs.view(run.id);
      expect(view?.status).toBe('failed');
      expect(view?.failure?.code).toBe('unavailable');
      expect(view?.stages.find((stage) => stage.stage === failing)?.status).toBe('failed');
      expect(calls.some((call) => call.stage === 'content')).toBe(false);
      expect(invalidatedAt(approval)).toBe(time);
    },
  );
});

describe('runs and starts that do not invalidate', () => {
  it('a redraft (no research stage) leaves the final approvals unchanged', async () => {
    const calls: StageCall[] = [];
    const runner = setup(allStages(calls));
    const base = completedRun(PROJECT_ID);
    const approval = finalApproval(draft(PROJECT_ID, base, 1)[0] ?? '');

    const run = runner.start(PROJECT_ID, 'redraft');
    expect(invalidatedAt(approval)).toBeNull();
    await runner.settled(run.id);
    expect(runner.runs.view(run.id)?.status).toBe('completed');
    expect(invalidatedAt(approval)).toBeNull();
  });

  it('a start refused because a run is active invalidates nothing', () => {
    const gate = deferred();
    const runner = setup(allStages([], { research: fakeStage('research', [], { gate: gate.promise }) }));
    const base = completedRun(PROJECT_ID);
    const [first, second] = draft(PROJECT_ID, base, 2);
    runner.start(PROJECT_ID, 'full');
    const later = finalApproval(first ?? '');
    finalApproval(second ?? '', EARLIER_INVALIDATION);

    expect(() => runner.start(PROJECT_ID, 'full')).toThrow(RunStartRefused);
    expect(invalidatedAt(later)).toBeNull();
    gate.resolve();
  });

  it('a start that throws inside the transaction rolls the invalidation back with the run row', () => {
    const runner = setup(allStages([]));
    const approval = finalApproval(draft(PROJECT_ID, completedRun(PROJECT_ID), 1)[0] ?? '');
    const runsBefore = runner.runs.listViews(PROJECT_ID).length;

    expect(() =>
      runner.start(PROJECT_ID, 'full', {
        afterGuards: () => {
          throw new Error('synthetic guard failure');
        },
      }),
    ).toThrow('synthetic guard failure');
    expect(invalidatedAt(approval)).toBeNull();
    expect(runner.runs.listViews(PROJECT_ID)).toHaveLength(runsBefore);
  });

  it('a start whose run row cannot be written (duplicate run ID) invalidates nothing', () => {
    const runner = setup(allStages([]));
    const base = completedRun(PROJECT_ID);
    const approval = finalApproval(draft(PROJECT_ID, base, 1)[0] ?? '');
    const duplicate = new WorkflowRunner({
      container: fixture().container,
      stages: () => [],
      newId: () => base,
    });
    runners.push(duplicate);

    expect(() => duplicate.start(PROJECT_ID, 'full')).toThrow();
    expect(invalidatedAt(approval)).toBeNull();
    expect(runner.runs.activeRunId(PROJECT_ID)).toBeNull();
  });
});
