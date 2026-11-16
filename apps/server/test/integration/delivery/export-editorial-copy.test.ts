/**
 * REVIEW-APPROVAL-01 (amendment of PD-33, option b): the approved editorial copy of a draft goes into the export of its
 * carousels, through the real server, workflow, review and export of a temporary app, with the stub editorial writer
 * (no AI, no cost). Synthetic DEMO_DATA only.
 *
 * Covered: the copy is never required (the final approval and the export without any approved copy are as before);
 * approving deliverables later only needs a new export, never a new final approval; `copy-editorial.txt` holds exactly
 * the approved current deliverables, with the same text as the review's download, and the manifest lists each version;
 * an edited or withdrawn deliverable is no longer exported; the ZIP download and the export history carry the file; no
 * network request.
 */
import {
  type Draft,
  type EditorialDeliverable,
  type EditorialGenerationResult,
  type EditorialPackage,
  type EditorialVersion,
  editorialDeliverableText,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { cleanups, start } from '../ingestion/support.js';

import {
  type Client,
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  draftOf,
  exportDetail,
  exportFile,
  exportFileNames,
  exported,
  ligaDemo,
  manifestOf,
  projectWithDraft,
  sha256,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

function firstCarousel(draft: Draft): Draft['carousels'][number] {
  const carousel = draft.carousels[0];
  if (carousel === undefined) {
    throw new Error('the draft has no carousel');
  }
  return carousel;
}

async function editorialOf(c: Client, projectId: string): Promise<EditorialPackage> {
  const response = await c.get(`/projects/${projectId}/editorial`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as EditorialPackage;
}

function current(pkg: EditorialPackage, deliverable: EditorialDeliverable): EditorialVersion {
  const version = pkg.deliverables.find((entry) => entry.deliverable === deliverable)?.current;
  if (version === null || version === undefined) {
    throw new Error(`no current version of ${deliverable}`);
  }
  return version;
}

async function approveCopy(c: Client, projectId: string, version: EditorialVersion): Promise<void> {
  const response = await c.send(
    'PUT',
    `/projects/${projectId}/editorial/deliverables/${version.deliverable}/approval`,
    { versionId: version.id },
  );
  expect(response.statusCode, response.body).toBe(200);
}

describe('approved editorial copy in the export (REVIEW-APPROVAL-01)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('is never required, and the approved deliverables go into the same export and ZIP when they exist', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(2));

    // Without any copy: the carousel is approved and exported exactly as before.
    const approved = await approveDraft(t, project.id);
    const carousel = firstCarousel(approved);
    const finalApprovalId = carousel.finalApproval?.id;
    const plain = await exported(t, carousel.id);
    expect(plain.files.map((file) => file.kind)).not.toContain('editorial_text');
    expect(exportFileNames(t, plain)).not.toContain('copy-editorial.txt');
    expect(manifestOf(t, plain)).not.toHaveProperty('editorial');

    // The copy is written by the stub writer (free, no AI) and two deliverables are approved.
    const generated = await t.send('POST', `/projects/${project.id}/editorial/generations`, {
      requestKey: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
    });
    expect(generated.statusCode, generated.body).toBe(201);
    const pkg = (generated.json() as EditorialGenerationResult).package;
    expect(pkg.writer).toMatchObject({ kind: 'test', requiresCostConfirmation: false });
    const main = current(pkg, 'facebook_instagram');
    const youtube = current(pkg, 'youtube');
    await approveCopy(t, project.id, main);
    await approveCopy(t, project.id, youtube);

    // The editorial package says what the export would carry: the two approved texts, with publishable data.
    const approvedPkg = await editorialOf(t, project.id);
    expect(approvedPkg.deliverables.map((entry) => [entry.deliverable, entry.exportable])).toEqual([
      ['facebook_instagram', true],
      ['tiktok_reels', false],
      ['viral_headlines', false],
      ['youtube', true],
      ['debate_question', false],
    ]);

    // Approving the copy does not touch the final approval: a new export is enough.
    const afterCopy = firstCarousel(await draftOf(t, project.id));
    expect(afterCopy.finalApproval).toMatchObject({ id: finalApprovalId, valid: true });
    const withCopy = await exported(t, carousel.id);
    expect(withCopy.finalApprovalId).toBe(finalApprovalId);
    const kinds = withCopy.files.map((file) => file.kind);
    expect(kinds.slice(-2)).toEqual(['editorial_text', 'manifest']);
    const copyFile = withCopy.files.find((file) => file.kind === 'editorial_text');
    expect(copyFile).toMatchObject({ fileName: 'copy-editorial.txt', elementVersionId: null });
    expect(withCopy.files.at(-1)?.position).toBe((copyFile?.position ?? 0) + 1);

    // The file holds exactly the approved deliverables, with the text of the review's download.
    const text = exportFile(t, withCopy, 'copy-editorial.txt').toString('utf8');
    expect(sha256(Buffer.from(text, 'utf8'))).toBe(copyFile?.sha256);
    const rule = '='.repeat(40);
    expect(text).toBe(
      `COPY EDITORIAL APROBADO\n${manifestOf(t, withCopy).project.competitionName} · ` +
        `${manifestOf(t, withCopy).project.stageLabel} · Jornada ${String(manifestOf(t, withCopy).project.matchday)} · ` +
        `${manifestOf(t, withCopy).project.seasonLabel}\n\n` +
        `${rule}\nFacebook / Instagram\n${rule}\n\n${editorialDeliverableText('facebook_instagram', main.fields)}\n\n` +
        `${rule}\nYouTube\n${rule}\n\n${editorialDeliverableText('youtube', youtube.fields)}\n`,
    );
    expect(text).not.toMatch(/TikTok|Titulares|Pregunta para|https?:|[0-9a-f]{8}-[0-9a-f]{4}-/u);
    const manifest = manifestOf(t, withCopy);
    expect(manifest.editorial).toMatchObject({
      position: copyFile?.position,
      fileName: 'copy-editorial.txt',
      sha256: copyFile?.sha256,
      deliverables: [
        { deliverable: 'facebook_instagram', editorialVersionId: main.id, versionNumber: 1 },
        { deliverable: 'youtube', editorialVersionId: youtube.id, versionNumber: 1 },
      ],
    });
    // The element files of the manifest are the carousel's, as before.
    expect(manifest.files.map((file) => file.fileName)).toEqual(manifestOf(t, plain).files.map((f) => f.fileName));

    // The ZIP download and the export history carry the file.
    const zip = await t.get(`/exports/${withCopy.id}/download`);
    expect(zip.statusCode, zip.body).toBe(200);
    expect(zip.rawPayload.toString('latin1')).toContain('copy-editorial.txt');
    const detail = await exportDetail(t, withCopy.id);
    expect(detail.files.map((file) => file.fileName)).toContain('copy-editorial.txt');
    expect(detail.elements.length).toBe(manifest.files.length);

    // An edited deliverable is a new version that is not approved: it is no longer exported.
    const edited = await t.send('POST', `/projects/${project.id}/editorial/deliverables/youtube/edits`, {
      baseVersionId: youtube.id,
      fields: youtube.fields.map((field) => ({ name: field.name, text: field.text })),
    });
    expect(edited.statusCode, edited.body).toBe(201);
    const afterEdit = await exported(t, carousel.id);
    const afterEditText = exportFile(t, afterEdit, 'copy-editorial.txt').toString('utf8');
    expect(afterEditText).toContain('Facebook / Instagram');
    expect(afterEditText).not.toContain('YouTube');
    expect(manifestOf(t, afterEdit).editorial?.deliverables.map((entry) => entry.deliverable)).toEqual([
      'facebook_instagram',
    ]);

    // Withdrawing the last approval after exporting: the earlier exports keep their files and the graphic approval
    // stays valid; the next export is without copy, as at the start.
    const withdrawn = await t.send(
      'DELETE',
      `/projects/${project.id}/editorial/deliverables/facebook_instagram/approval`,
    );
    expect(withdrawn.statusCode, withdrawn.body).toBe(200);
    expect(firstCarousel(await draftOf(t, project.id)).finalApproval).toMatchObject({
      id: finalApprovalId,
      valid: true,
    });
    expect((await exportDetail(t, withCopy.id)).files).toEqual(withCopy.files);
    const last = await exported(t, carousel.id);
    expect(last.files.map((file) => file.kind)).toEqual(plain.files.map((file) => file.kind));
    expect(exportFileNames(t, last)).not.toContain('copy-editorial.txt');

    // Every earlier export keeps its files and stays downloadable.
    for (const earlier of [plain, withCopy, afterEdit]) {
      expect((await t.get(`/exports/${earlier.id}/download`)).statusCode).toBe(200);
    }
    expect(t.egress.requests).toHaveLength(0);
  });

  it('marks an approved text whose sports data changed as approved but not exportable (scenario C, package)', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(2));
    const generated = await t.send('POST', `/projects/${project.id}/editorial/generations`, {
      requestKey: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
    });
    expect(generated.statusCode, generated.body).toBe(201);
    const pkg = (generated.json() as EditorialGenerationResult).package;
    for (const deliverable of ['facebook_instagram', 'tiktok_reels', 'debate_question'] as const) {
      await approveCopy(t, project.id, current(pkg, deliverable));
    }
    // A fact of the TikTok text becomes disputed after its approval.
    const row = t.container.db
      .prepare<{ fact_ids: string }>('SELECT fact_ids FROM editorial_versions WHERE id = ?')
      .get([current(pkg, 'tiktok_reels').id]);
    const [factId] = JSON.parse(row?.fact_ids ?? '[]') as string[];
    expect(factId).toBeDefined();
    t.container.db
      .prepare(
        "UPDATE facts SET status = 'unverified', unverified_reason = 'disputed', value = NULL, candidate_value = NULL " +
          'WHERE id = ?',
      )
      .run([factId ?? '']);
    const after = await editorialOf(t, project.id);
    const tiktok = after.deliverables.find((entry) => entry.deliverable === 'tiktok_reels');
    // Still approved, but not exportable: the dialog counts it apart, as needing review.
    expect(tiktok?.current?.state).toBe('approved');
    expect(tiktok?.exportable).toBe(false);
    expect(after.deliverables.filter((entry) => entry.exportable).map((entry) => entry.deliverable)).not.toContain(
      'tiktok_reels',
    );
  });
});
