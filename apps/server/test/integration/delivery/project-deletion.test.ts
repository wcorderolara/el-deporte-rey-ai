/**
 * PD-ARCH-01F: logical deletion of projects in every state, through the real server and stages. A deleted project is
 * excluded from every read and write path (project, runs, draft, review, facts, images, exports, downloads), its
 * active run is cancelled and confirmed before the tombstone, repeating the deletion is harmless, and its own rows and
 * files stay preserved (OD-08) while shared resources and other projects are untouched. All data is synthetic.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ProjectListResponseSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { researchStage } from '../../../src/modules/research/index.js';
import type { AnyStage } from '../../../src/workflow/index.js';
import type { TestApp, TestAppOptions } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  WORKFLOW_TEST_TIMEOUT,
  allElements,
  approveDraft,
  createProject,
  draftOf,
  expectProblem,
  exported,
  ligaDemo,
  projectWithDraft,
  waitForRun,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

function demoApp(options: Partial<TestAppOptions> = {}): Promise<TestApp> {
  return start(cleanup, { base: 'demo-only', scenario: 'default', ...options });
}

async function listedIds(t: TestApp): Promise<string[]> {
  return ProjectListResponseSchema.parse((await t.get('/projects')).json()).projects.map((project) => project.id);
}

async function remove(t: TestApp, projectId: string): Promise<number> {
  return (await t.send('DELETE', `/projects/${projectId}`)).statusCode;
}

const COUNT = {
  drafts: 'SELECT COUNT(*) AS n FROM content_drafts WHERE project_id = ?',
  runs: 'SELECT COUNT(*) AS n FROM workflow_runs WHERE project_id = ?',
  exports:
    'SELECT COUNT(*) AS n FROM exports x JOIN carousels c ON c.id = x.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE d.project_id = ?',
  tombstone: 'SELECT COUNT(*) AS n FROM projects WHERE id = ? AND deleted_at IS NOT NULL',
} as const;

function count(t: TestApp, query: keyof typeof COUNT, projectId: string): number {
  return t.container.db.prepare<{ n: number }>(COUNT[query]).get([projectId])?.n ?? 0;
}

describe('project deletion (PD-ARCH-01F)', () => {
  it('deletes a project that never ran, idempotently, and answers 404 for an unknown project', async () => {
    const t = await demoApp();
    const project = await createProject(t, ligaDemo(1));
    const other = await createProject(t, ligaDemo(2));

    expect(await remove(t, project.id)).toBe(204);
    expect(await remove(t, project.id)).toBe(204);
    expectProblem(await t.get(`/projects/${project.id}`), 404, 'NOT_FOUND');
    expect(await listedIds(t)).toEqual([other.id]);
    expect(count(t, 'tombstone', project.id)).toBe(1);
    expectProblem(await t.send('DELETE', '/projects/00000000-0000-4000-8000-00000000dead'), 404, 'NOT_FOUND');
    // No run can start on a deleted project.
    expectProblem(await t.send('POST', `/projects/${project.id}/runs`, { kind: 'full' }), 404, 'NOT_FOUND');
  });

  it(
    'deletes an approved and exported project, closes every path to it and preserves its history and files',
    async () => {
      const t = await demoApp();
      const { project, run } = await projectWithDraft(t, ligaDemo(1));
      const kept = await createProject(t, ligaDemo(2));
      const draft = await approveDraft(t, project.id);
      const carousel = draft.carousels[0];
      if (carousel === undefined) throw new Error('the draft has no carousel');
      const written = await exported(t, carousel.id);
      const element = allElements(draft)[0];
      if (element === undefined) throw new Error('the draft has no element');
      const before = { drafts: count(t, 'drafts', project.id), exports: count(t, 'exports', project.id) };

      expect(await remove(t, project.id)).toBe(204);

      expectProblem(await t.get(`/projects/${project.id}`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/projects/${project.id}/draft`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/projects/${project.id}/runs`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/projects/${project.id}/runs/${run.id}/facts`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/projects/${project.id}/exports`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/exports/${written.id}`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/exports/${written.id}/download`), 404, 'NOT_FOUND');
      expectProblem(await t.get(`/element-versions/${element.currentVersion.id}/image`), 404, 'NOT_FOUND');
      expectProblem(await t.send('PUT', `/carousels/${carousel.id}/final-approval`), 404, 'NOT_FOUND');
      expectProblem(await t.send('POST', `/carousels/${carousel.id}/exports`), 404, 'NOT_FOUND');
      expect(await listedIds(t)).toEqual([kept.id]);

      // OD-08: nothing is removed; only the tombstone hides the project.
      expect(count(t, 'drafts', project.id)).toBe(before.drafts);
      expect(count(t, 'exports', project.id)).toBe(before.exports);
      expect(existsSync(join(t.config.dataDir, written.directory))).toBe(true);
      // The other project is unaffected.
      expect((await t.get(`/projects/${kept.id}`)).statusCode).toBe(200);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it('deletes a project whose run failed', async () => {
    const failing: AnyStage = {
      ...(researchStage as AnyStage),
      run: () => Promise.reject(new Error('synthetic research failure')),
    };
    const t = await demoApp({ stageOverrides: { research: failing } });
    const project = await createProject(t, ligaDemo(1));
    const started = await t.send('POST', `/projects/${project.id}/runs`, { kind: 'full' });
    const run = await waitForRun(t, project.id, (started.json() as { id: string }).id);
    expect(run.status).toBe('failed');

    expect(await remove(t, project.id)).toBe(204);
    expectProblem(await t.get(`/projects/${project.id}`), 404, 'NOT_FOUND');
  });

  it(
    'cancels an active run, waits for its stop and lets it write nothing on the deleted project',
    async () => {
      let entered: () => void = () => undefined;
      const inResearch = new Promise<void>((resolve) => {
        entered = resolve;
      });
      // Research that only ends when its run is cancelled.
      const blocking: AnyStage = {
        ...(researchStage as AnyStage),
        run: (_input, ctx) =>
          new Promise((_resolve, reject) => {
            entered();
            ctx.signal.addEventListener('abort', () => reject(ctx.signal.reason ?? new Error('aborted')));
          }),
      };
      const t = await demoApp({ stageOverrides: { research: blocking } });
      const project = await createProject(t, ligaDemo(1));
      const started = await t.send('POST', `/projects/${project.id}/runs`, { kind: 'full' });
      expect(started.statusCode).toBe(202);
      await inResearch;

      expect(await remove(t, project.id)).toBe(204);

      const status = t.container.db
        .prepare<{ status: string; failure: string | null }>(
          'SELECT status, failure FROM workflow_runs WHERE project_id = ?',
        )
        .get([project.id]);
      expect(status?.status).toBe('failed');
      expect(status?.failure).toContain('interrupted');
      expect(count(t, 'drafts', project.id)).toBe(0);
      expectProblem(await t.get(`/projects/${project.id}`), 404, 'NOT_FOUND');
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'keeps local sports data and the content batch when one of its projects is deleted',
    async () => {
      const t = await demoApp();
      // A finished run of another project of the same competition stays readable.
      const { project: sibling } = await projectWithDraft(t, ligaDemo(1));
      const { project } = await projectWithDraft(t, ligaDemo(2));
      const siblingDraft = await draftOf(t, sibling.id);

      expect(await remove(t, project.id)).toBe(204);

      expect((await draftOf(t, sibling.id)).id).toBe(siblingDraft.id);
      expect(count(t, 'runs', sibling.id)).toBe(1);
      expect((await t.get('/catalog/competitions')).statusCode).toBe(200);
      expect((await t.get('/templates')).statusCode).toBe(200);
      expect((await t.get('/brand/assets')).statusCode).toBe(200);
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});
