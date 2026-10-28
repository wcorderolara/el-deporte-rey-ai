/**
 * Integration tests of the final-approval invalidation by a research run (architecture.md section 11.2; OD-57;
 * T10-F15) through the real server: a full DEMO_DATA run with the real stages, every element approved and the
 * carousels finally approved through the review routes, then a restart on the same data directory with a DEMO_DATA
 * `simulate` failure scenario (`provider-unavailable`, fixtures/sports/_manifest.json) or a verification stage that
 * fails, and a new full run started through `POST /projects/{id}/runs`. The final approvals are invalid as soon as
 * the run is created and stay invalid after it fails; the draft view, the project's approval state and the stored
 * rows follow the stored state; an already invalidated time is never changed; a redraft does not invalidate.
 * Synthetic data only; the shared setup blocks every non-loopback connection; temporary directories only.
 */
import { join } from 'node:path';

import { type Draft, DraftSchema, ProjectSchema, QA_WARNING_CHECKS, RunSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LIGA_DEMO_MD1,
  type TemporaryDirectory,
  type TestApp,
  type TestAppOptions,
  expectNoNetworkViolations,
  startTestApp,
  temporaryDirectory,
} from '../../test/support/index.js';
import { StageFailure } from './failure.js';
import type { AnyStage } from './runner.js';

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
});

interface StoredFinalApproval {
  readonly id: string;
  readonly carousel_id: string;
  readonly approved_at: string;
  readonly invalidated_at: string | null;
}

/** A data directory that outlives one app (a restart on the same data). */
function dataDirectory(): string {
  const dir: TemporaryDirectory = temporaryDirectory('t58-data');
  cleanups.push(dir.remove);
  return join(dir.path, 'data');
}

async function start(dataDir: string, options: TestAppOptions = {}): Promise<TestApp> {
  const t = await startTestApp({ base: 'demo-only', dataDir, ...options });
  let closed = false;
  const close = async (): Promise<void> => {
    if (!closed) {
      closed = true;
      await t.close();
    }
  };
  cleanups.push(close);
  return { ...t, close };
}

async function draftOf(t: TestApp, projectId: string): Promise<Draft> {
  const response = await t.get(`/projects/${projectId}/draft`);
  expect(response.statusCode, response.body).toBe(200);
  return DraftSchema.parse(response.json());
}

async function approvalState(t: TestApp, projectId: string): Promise<string> {
  const response = await t.get(`/projects/${projectId}`);
  expect(response.statusCode, response.body).toBe(200);
  return ProjectSchema.parse(response.json()).approvalState;
}

function stored(t: TestApp): StoredFinalApproval[] {
  return t.container.db
    .prepare<StoredFinalApproval>(
      'SELECT id, carousel_id, approved_at, invalidated_at FROM final_approvals ORDER BY approved_at, rowid',
    )
    .all();
}

/** Acknowledges the warnings of, and approves, every element; then finally approves every carousel. */
async function approveEverything(t: TestApp, projectId: string): Promise<void> {
  for (const carousel of (await draftOf(t, projectId)).carousels) {
    for (const element of carousel.elements) {
      const path = `/carousels/${carousel.id}/elements/${element.id}`;
      for (const result of element.currentVersion.qa) {
        if (result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null) {
          const check = QA_WARNING_CHECKS.find((name) => name === result.check);
          const acknowledged = await t.send('POST', `${path}/qa-acknowledgements`, {
            versionId: element.currentVersion.id,
            checks: [check],
          });
          expect(acknowledged.statusCode, acknowledged.body).toBe(200);
        }
      }
      const approved = await t.send('PUT', `${path}/approval`, { versionId: element.currentVersion.id });
      expect(approved.statusCode, approved.body).toBe(200);
    }
    const final = await t.send('PUT', `/carousels/${carousel.id}/final-approval`);
    expect(final.statusCode, final.body).toBe(200);
  }
}

/** A project of matchday 1 of liga-demo with a completed full run and every carousel finally approved. */
async function finallyApproved(dataDir: string): Promise<{ projectId: string; carousels: number }> {
  const t = await start(dataDir, { scenario: 'default' });
  const project = await t.createProject(LIGA_DEMO_MD1);
  const run = await t.runWorkflow(project.id);
  expect(run.status, JSON.stringify(run)).toBe('completed');
  await approveEverything(t, project.id);
  const draft = await draftOf(t, project.id);
  expect(draft.carousels.length).toBeGreaterThan(0);
  expect(draft.carousels.every((carousel) => carousel.finalApproval?.valid === true)).toBe(true);
  expect(await approvalState(t, project.id)).toBe('final_approved');
  await t.close();
  return { projectId: project.id, carousels: draft.carousels.length };
}

/** Starts a run through the API; returns the created run and the stored final approvals right after the answer. */
async function startRun(t: TestApp, projectId: string, kind: 'full' | 'redraft') {
  const response = await t.send('POST', `/projects/${projectId}/runs`, { kind });
  expect(response.statusCode, response.body).toBe(202);
  const created = RunSchema.parse(response.json());
  const atCreation = stored(t);
  await t.projects.runnerFor(t.container).settled(created.id);
  return { created, atCreation, finished: await t.getRun(projectId, created.id) };
}

/** A verification stage that fails with a closed source failure. */
function failingVerification(): AnyStage {
  return {
    name: 'verification',
    input: { parse: (value: unknown) => value },
    output: { parse: (value: unknown) => value },
    load: async () => {
      await Promise.resolve();
      return {};
    },
    run: async () => {
      await Promise.resolve();
      throw new StageFailure('unavailable', { sourceId: 'demo-b' });
    },
    persist: async () => {
      await Promise.resolve();
    },
  } as unknown as AnyStage;
}

describe('a research run invalidates the final approvals of the project (architecture.md 11.2, OD-57)', () => {
  it('a run that fails at research (DEMO_DATA simulate: provider-unavailable) leaves no final approval valid', async () => {
    const dataDir = dataDirectory();
    const { projectId, carousels } = await finallyApproved(dataDir);

    const t = await start(dataDir, { scenario: 'provider-unavailable' });
    // The restart alone (review startup hook) keeps them valid: the invalidation below comes from the run.
    expect((await draftOf(t, projectId)).carousels.every((carousel) => carousel.finalApproval?.valid)).toBe(true);
    expect(stored(t).every((row) => row.invalidated_at === null)).toBe(true);

    const { created, atCreation, finished } = await startRun(t, projectId, 'full');
    expect(atCreation).toHaveLength(carousels);
    expect(atCreation.every((row) => row.invalidated_at !== null && row.invalidated_at > row.approved_at)).toBe(true);
    expect(finished.status).toBe('failed');
    expect(finished.failure).toMatchObject({ code: 'unavailable', sourceId: 'demo-a' });
    expect(finished.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'failed'],
      ['verification', 'skipped'],
      ['content', 'skipped'],
      ['rendering', 'skipped'],
      ['visual_qa', 'skipped'],
    ]);
    expect(created.id).toBe(finished.id);

    // Stored state, draft view and project approval state agree; the times did not move after the failure.
    expect(stored(t)).toEqual(atCreation);
    const draft = await draftOf(t, projectId);
    expect(draft.carousels.every((carousel) => carousel.finalApproval?.valid === false)).toBe(true);
    expect(await approvalState(t, projectId)).toBe('in_review');
    expect(t.log.text()).toContain('final approvals invalidated: a research run started');

    // A second failing research run does not change an already invalidated time.
    const again = await startRun(t, projectId, 'full');
    expect(again.finished.status).toBe('failed');
    expect(stored(t)).toEqual(atCreation);
    expectNoNetworkViolations();
  });

  it('a run that fails at verification leaves no final approval valid', async () => {
    const dataDir = dataDirectory();
    const { projectId, carousels } = await finallyApproved(dataDir);

    const t = await start(dataDir, {
      scenario: 'default',
      stageOverrides: { verification: failingVerification() },
    });
    const { atCreation, finished } = await startRun(t, projectId, 'full');
    expect(atCreation).toHaveLength(carousels);
    expect(atCreation.every((row) => row.invalidated_at !== null)).toBe(true);
    expect(finished.status).toBe('failed');
    expect(finished.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['research', 'completed'],
      ['verification', 'failed'],
      ['content', 'skipped'],
      ['rendering', 'skipped'],
      ['visual_qa', 'skipped'],
    ]);
    expect(stored(t)).toEqual(atCreation);
    expect((await draftOf(t, projectId)).carousels.every((carousel) => carousel.finalApproval?.valid === false)).toBe(
      true,
    );
    expect(await approvalState(t, projectId)).toBe('in_review');
    expectNoNetworkViolations();
  });

  it('a redraft (no research stage) does not invalidate when it starts', async () => {
    const dataDir = dataDirectory();
    const { projectId } = await finallyApproved(dataDir);

    const t = await start(dataDir, {
      scenario: 'default',
      stageOverrides: {
        content: {
          ...failingVerification(),
          name: 'content',
        } as AnyStage,
      },
    });
    const { atCreation, finished } = await startRun(t, projectId, 'redraft');
    expect(atCreation.every((row) => row.invalidated_at === null)).toBe(true);
    expect(finished.status).toBe('failed');
    expect(finished.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['content', 'failed'],
      ['rendering', 'skipped'],
      ['visual_qa', 'skipped'],
    ]);
    expect(stored(t).every((row) => row.invalidated_at === null)).toBe(true);
    expect(await approvalState(t, projectId)).toBe('final_approved');
    expectNoNetworkViolations();
  });
});
