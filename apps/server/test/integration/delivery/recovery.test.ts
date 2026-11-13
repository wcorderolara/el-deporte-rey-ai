/**
 * UI-06.3 errors and recovery that no earlier suite exercised end to end:
 * - export file I/O failures (a write that fails half way, an export directory that cannot be created, a stored slide
 *   render missing on disk): 500 with fixed text, no export recorded, the final approval kept, and a retry that
 *   exports into a fresh folder (T10-F15 covers only the commit-time refusals in `export.int.test.ts`);
 * - a brand asset whose file is missing from disk when a redraft renders: the run fails at rendering with `internal`,
 *   the valid final approval and its export survive, and a redraft completes once the file is back;
 * - a later research run that fails leaves the facts and the rendered versions of the earlier run unchanged.
 *
 * Synthetic data only (DEMO_DATA fixtures, synthetic facts, the stub AI); nothing reaches a provider.
 */
import { existsSync, mkdirSync, chmodSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Export, ExportSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { ExportFileError, ExportFileStore, type ExportFolder } from '../../../src/modules/export/files.js';
import {
  type ExportHarness,
  PROJECT_ID,
  exportHarness,
  problem,
  rowCount,
} from '../../../src/modules/export/test/support.js';
import { png } from '../../../src/modules/brand/test/images.js';
import { type TestApp, expectNoNetworkViolations, startTestApp, temporaryDirectory } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  expectProblem,
  exportCarousel,
  exportDetail,
  exportFile,
  exported,
  factsOf,
  ligaDemo,
  projectExports,
  projectWithDraft,
  renderModelOf,
  runWorkflow,
  sha256,
  versionsOfRun,
} from './support.js';

const cleanup = cleanups();
let harness: ExportHarness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
  await cleanup.run();
});

async function finalApprovedHarness(files?: (dataDir: string) => ExportFileStore): Promise<ExportHarness> {
  harness = await exportHarness(files === undefined ? {} : { files });
  await harness.approveAll();
  await harness.finalApprove();
  return harness;
}

function validFinalApprovals(h: ExportHarness): number {
  return (
    h.container.db
      .prepare<{ n: number }>('SELECT COUNT(*) AS n FROM final_approvals WHERE invalidated_at IS NULL')
      .get()?.n ?? -1
  );
}

/** A refused export: 500 with the fixed internal text, no path or file name, nothing recorded. */
function expectInternalWithoutRecord(h: ExportHarness, response: Awaited<ReturnType<ExportHarness['exportCarousel']>>) {
  expect(response.statusCode, response.body).toBe(500);
  const body = problem(response);
  expect(body).toMatchObject({ code: 'INTERNAL', detail: 'An internal error occurred.' });
  expect(response.body).not.toMatch(/exports|\.png|manifest|caption\.txt|\/tmp|edr-/);
  expect(rowCount(h.container, 'exports')).toBe(0);
  expect(rowCount(h.container, 'export_files')).toBe(0);
  // The operator's final approval is not lost: the same carousel can be exported again.
  expect(validFinalApprovals(h)).toBe(1);
}

async function exportedNow(h: ExportHarness): Promise<Export> {
  const response = await h.exportCarousel();
  expect(response.statusCode, response.body).toBe(201);
  return ExportSchema.parse(response.json());
}

describe('export file failures (UI-06.3)', () => {
  it('a write that fails half way records nothing, keeps the final approval, and a retry exports into a fresh folder', async () => {
    let failOn: string | null = '02.png';
    class FailingStore extends ExportFileStore {
      override async createFolder(projectId: string, exportId: string): Promise<ExportFolder> {
        const folder = await super.createFolder(projectId, exportId);
        return {
          relativeDirectory: folder.relativeDirectory,
          writeFile: async (name, bytes) => {
            if (name === failOn) {
              failOn = null;
              throw new ExportFileError('an export file cannot be written');
            }
            await folder.writeFile(name, bytes);
          },
        };
      }
    }
    const h = await finalApprovedHarness((dataDir) => new FailingStore(dataDir));
    expectInternalWithoutRecord(h, await h.exportCarousel());
    // The partial folder stays unreferenced: only the files written before the failure, no manifest.
    const orphans = readdirSync(join(h.env.dataDir, 'exports', PROJECT_ID));
    expect(orphans).toHaveLength(1);
    expect(readdirSync(join(h.env.dataDir, 'exports', PROJECT_ID, orphans[0] as string))).toEqual(['01.png']);
    const history = await h.get(`/projects/${PROJECT_ID}/exports`);
    expect(history.statusCode, history.body).toBe(200);
    expect((history.json() as { exports: unknown[] }).exports).toEqual([]);

    const written = await exportedNow(h);
    expect(written.directory).not.toContain(orphans[0] as string);
    expect(written.files.map((file) => file.fileName)).toContain('manifest.json');
    expect(rowCount(h.container, 'exports')).toBe(1);
    expect(
      h.container.db
        .prepare<{ directory: string }>('SELECT directory FROM exports')
        .all()
        .map((row) => row.directory),
    ).toEqual([written.directory]);
  });

  // File modes do not stop the superuser; the case is only meaningful for the operator's own account.
  it.skipIf(process.getuid?.() === 0)(
    'an export directory that cannot be created records nothing; once writable again the export succeeds',
    async () => {
      const h = await finalApprovedHarness();
      const projectDirectory = join(h.env.dataDir, 'exports', PROJECT_ID);
      mkdirSync(projectDirectory, { recursive: true, mode: 0o700 });
      chmodSync(projectDirectory, 0o500);
      try {
        expectInternalWithoutRecord(h, await h.exportCarousel());
        expect(readdirSync(projectDirectory)).toEqual([]);
      } finally {
        chmodSync(projectDirectory, 0o700);
      }
      const written = await exportedNow(h);
      expect(readdirSync(projectDirectory)).toHaveLength(1);
      expect(existsSync(join(h.env.dataDir, written.directory, 'manifest.json'))).toBe(true);
    },
  );

  it('a slide render missing on disk is refused before any file is written; restored, the export succeeds', async () => {
    const h = await finalApprovedHarness();
    const carousel = await h.carousel();
    const slide = carousel.elements.find((element) => element.kind === 'slide');
    const stored = h.container.db
      .prepare<{ image_path: string }>('SELECT image_path FROM element_versions WHERE id = ?')
      .get([slide?.currentVersion.id ?? '']);
    expect(stored?.image_path).toBeTruthy();
    const imageFile = join(h.env.dataDir, stored!.image_path);
    const bytes = readFileSync(imageFile);
    rmSync(imageFile);

    expectInternalWithoutRecord(h, await h.exportCarousel());
    // Nothing was written: the render is checked before the export folder is created.
    expect(existsSync(join(h.env.dataDir, 'exports'))).toBe(false);

    writeFileSync(imageFile, bytes);
    const written = await exportedNow(h);
    expect(written.files.filter((file) => file.kind === 'slide_image').length).toBeGreaterThan(0);
  });
});

/** Registers a synthetic brand logo; returns its ID and its file under the data directory. */
async function registeredLogo(t: TestApp): Promise<{ id: string; file: string; bytes: Buffer }> {
  const bytes = png({ width: 120, height: 50, rgba: [200, 30, 30, 255] });
  const response = await t.inject({
    method: 'POST',
    url: `/api/v1/brand/assets?kind=brand_logo&label=${encodeURIComponent('Logo sintético')}`,
    headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: bytes,
  });
  expect(response.statusCode, response.body).toBe(201);
  const id = (response.json() as { id: string }).id;
  const row = t.container.db
    .prepare<{ file_path: string }>('SELECT file_path FROM brand_assets WHERE id = ?')
    .get([id]);
  expect(row?.file_path).toBeTruthy();
  return { id, file: join(t.config.dataDir, row!.file_path), bytes };
}

describe('a missing brand asset file during rendering (UI-06.3)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('fails the redraft at rendering with internal, keeps the earlier export intact, and recovers once the file is back', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const approved = await approveDraft(t, project.id);
    const carousel = approved.carousels[0]!;
    const earlier = await exported(t, carousel.id);
    const earlierDetail = await exportDetail(t, earlier.id);

    const logo = await registeredLogo(t);
    rmSync(logo.file);
    const failed = await runWorkflow(t, project.id, 'redraft');
    expect(failed.status).toBe('failed');
    expect(failed.failure).toMatchObject({ code: 'internal', sourceId: null, path: null, httpStatus: null });
    expect(failed.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['content', 'completed'],
      ['rendering', 'failed'],
      ['visual_qa', 'skipped'],
    ]);
    // The failure is a closed code: no file, path or asset ID.
    expect(JSON.stringify(failed)).not.toMatch(new RegExp(`${logo.id}|brand|\\.png`));

    // The export made before the failure stays in the history and reopens unchanged, with its files intact.
    expect((await projectExports(t, project.id)).map((entry) => entry.id)).toEqual([earlier.id]);
    // The exported content (versions, texts and images) is unchanged; only the versions' current state moves on.
    const content = (detail: typeof earlierDetail) =>
      detail.elements.map((entry) => [
        entry.position,
        entry.kind,
        entry.version.id,
        entry.version.fields,
        entry.version.imageUrl,
      ]);
    expect(content(await exportDetail(t, earlier.id))).toEqual(content(earlierDetail));
    for (const file of earlier.files) {
      expect(sha256(exportFile(t, earlier, file.fileName))).toBe(file.sha256);
    }
    // The redraft superseded the approved draft (by design); exporting it again is refused with a closed code and
    // records nothing, rather than failing on the missing file.
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    expect(await projectExports(t, project.id)).toHaveLength(1);

    // Once the file is back, the same redraft completes and draws the asset.
    writeFileSync(logo.file, logo.bytes);
    const recovered = await runWorkflow(t, project.id, 'redraft');
    expect(recovered.status, JSON.stringify(recovered.failure)).toBe('completed');
    const drawn = versionsOfRun(t, recovered.id)
      .filter((row) => row.kind === 'slide')
      .flatMap((row) => renderModelOf(row).elements)
      .filter((element) => element.kind === 'image');
    expect(drawn.some((element) => element.assetId === logo.id)).toBe(true);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });
});

describe('a later research run that fails (UI-06.3)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('leaves the facts and rendered versions of the earlier completed run unchanged', async () => {
    const data = temporaryDirectory('ui063-failed-run');
    cleanup.add(() => data.remove());
    const dataDir = join(data.path, 'data');
    const first = await startTestApp({ base: 'demo-only', scenario: 'default', dataDir });
    let open = true;
    cleanup.add(async () => {
      if (open) await first.close();
    });
    const { project, run } = await projectWithDraft(first, ligaDemo(1));
    const facts = await factsOf(first, project.id, run.id);
    const versions = versionsOfRun(first, run.id);
    open = false;
    await first.close();

    const unavailable = await start(cleanup, { base: 'demo-only', scenario: 'provider-unavailable', dataDir });
    const failed = await runWorkflow(unavailable, project.id);
    expect(failed.status).toBe('failed');
    expect(failed.failure).toMatchObject({ code: 'unavailable', sourceId: 'demo-a' });
    expect(await factsOf(unavailable, project.id, run.id)).toEqual(facts);
    expect(versionsOfRun(unavailable, run.id)).toEqual(versions);
    expect(versionsOfRun(unavailable, failed.id)).toEqual([]);
  });
});
