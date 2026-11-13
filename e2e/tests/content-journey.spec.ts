/**
 * Main creator journey (UI-06.1), on the suite server with the stub AI writers (no provider, no cost):
 *
 * 1. Crear contenido from a local competition: competition, season and round, then content type, matches, templates
 *    and the proposed plan; nothing is generated before the confirmation (PD-ARCH-01E, PD-ARCH-01F).
 * 2. The generated project opens with its slides; the review workspace shows its progress.
 * 3. Slides are approved one by one (confirming each visual QA warning first, OD-09) and in bulk (UI-04B).
 * 4. The editorial copy is generated and one deliverable is approved; the carousel's final approval is given on its
 *    own, with the dialog counting the copy ready for export (REVIEW-APPROVAL-01, PD-33 Option A).
 * 5. The downloaded ZIP holds the slides in order at 1080 x 1350, `copy-editorial.txt` with only the approved text,
 *    and a manifest whose hashes match the files.
 * 6. Approving another deliverable after the final approval keeps the final approval valid.
 * 7. The export is listed in Exportaciones and opens with its slides.
 * 8. Regression of E2E-F01 (WI-2 UI-06.1, PD-33 Option A): every download carries exactly the editorial copy approved
 *    and exportable when it is written, never the copy of an earlier export. A text approved after an export goes
 *    into the next ZIP; an edited text (a new, unapproved version) and a withdrawn one leave it; a repeated download
 *    without changes carries the same files; the final approval is never repeated; every earlier export stays in the
 *    history and downloads byte for byte as it was written.
 */
import { createHash } from 'node:crypto';

import { writeFileSync } from 'node:fs';

import {
  EDITORIAL_TABS,
  apiGet,
  approveEditorialDeliverable,
  approveReadySlidesInBulk,
  approveSlide,
  downloadCarousel,
  editEditorialField,
  finalApprovalRegion,
  generateContent,
  generateEditorialCopy,
  giveFinalApproval,
  openContentReview,
  reviewProgress,
  openDisclosure,
  slideButton,
  slideNames,
  withdrawEditorialApproval,
} from '../support/app.js';
import { evidencePath } from '../support/evidence.js';
import { seedLocalCompetition } from '../support/local-data.js';
import { pngSize } from '../support/png.js';
import { expect, test } from '../support/test.js';
import { readZip, type ZipFile } from '../support/zip.js';

interface Manifest {
  readonly exportId: string;
  readonly finalApproval: { readonly id: string };
  readonly files: readonly { fileName: string; kind: string; sha256: string; width?: number; height?: number }[];
  readonly editorial?: {
    readonly fileName: string;
    readonly sha256: string;
    readonly deliverables: readonly {
      deliverable: string;
      editorialVersionId: string;
      versionNumber: number;
      textSha256: string;
      factIds: readonly string[];
    }[];
  };
}

interface ExportList {
  readonly exports: readonly { id: string; finalApprovalId: string; files: readonly { fileName: string }[] }[];
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function entry(files: readonly ZipFile[], name: string): Buffer {
  const file = files.find((candidate) => candidate.name === name);
  if (file === undefined) throw new Error(`the ZIP has no ${name}`);
  return file.bytes;
}

function manifestOf(files: readonly ZipFile[]): Manifest {
  return JSON.parse(entry(files, 'manifest.json').toString('utf8')) as Manifest;
}

/** The titles of the sections of `copy-editorial.txt`, in order (each title stands between two rules of 40 `=`). */
function copySections(files: readonly ZipFile[]): string[] {
  const file = files.find((candidate) => candidate.name === 'copy-editorial.txt');
  if (file === undefined) return [];
  const rule = '='.repeat(40);
  return [...file.bytes.toString('utf8').matchAll(new RegExp(`${rule}\\n(.+)\\n${rule}`, 'g'))].map(
    (match) => match[1] ?? '',
  );
}

/** The section text of `title` in `copy-editorial.txt` (up to the next rule or the end). */
function copySection(files: readonly ZipFile[], title: string): string {
  const text = entry(files, 'copy-editorial.txt').toString('utf8');
  const rule = '='.repeat(40);
  const start = text.indexOf(`${rule}\n${title}\n${rule}\n\n`);
  if (start < 0) throw new Error(`copy-editorial.txt has no section ${title}`);
  const body = text.slice(start + rule.length * 2 + title.length + 4);
  const next = body.indexOf(`\n\n${rule}\n`);
  return next < 0 ? body.replace(/\n$/, '') : body.slice(0, next);
}

/** Every file of `actual` equals the file of the same name in `expected`, byte for byte, in the same order. */
function expectSameFiles(actual: readonly ZipFile[], expected: readonly ZipFile[]): void {
  expect(actual.map((file) => file.name)).toEqual(expected.map((file) => file.name));
  for (const file of expected) expect(sha256(entry(actual, file.name))).toBe(sha256(file.bytes));
}

/** The project and first download of the journey, for the dependent check below (serial mode). */
let journey: { projectId: string; title: string; firstZip: readonly ZipFile[] } | null = null;

test.describe.serial('Creator journey: local competition to downloaded carousel with approved copy', () => {
  test('create, review, approve slides and copy independently, download and verify the export', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Recorrido' });

    // 1-3. Crear contenido: the plan is computed from the local data and generated only on confirmation.
    const [projectId] = await generateContent(page, competition, competition.played);
    if (projectId === undefined) throw new Error('no project was generated');
    await page.getByRole('region', { name: 'Piezas' }).getByRole('link', { name: 'Abrir proyecto' }).click();
    const title = `${competition.name} ${competition.seasonLabel} · ${competition.played.name}`;
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Contexto deportivo' })).toContainText(competition.name);
    await page.getByRole('link', { name: 'Revisar contenido' }).click();

    // 4. Review: cover, one result slide per finished match, closing slide.
    await openContentReview(page, projectId);
    const slides = await slideNames(page);
    expect(slides).toEqual([
      'Diapositiva 1: Portada',
      'Diapositiva 2: Resultado',
      'Diapositiva 3: Resultado',
      'Diapositiva 4: Cierre',
    ]);
    await expect(reviewProgress(page, 'Diapositivas')).toContainText(/Diapositivas:\s*0\/4 aprobadas/);
    const final = finalApprovalRegion(page);
    await expect(final.getByRole('button', { name: 'Aprobar carrusel completo' })).toBeDisabled();

    // 5. Slides: the result slides carry a visual QA warning (no team badge) that is confirmed before approval;
    //    the rest are approved in bulk.
    await approveSlide(page, 'Diapositiva 2: Resultado');
    await approveSlide(page, 'Diapositiva 3: Resultado');
    expect(await approveReadySlidesInBulk(page)).toBe(2);
    for (const slide of slides) await expect(slideButton(page, slide)).toHaveAccessibleName(`${slide}, Aprobada`);
    await expect(reviewProgress(page, 'Diapositivas')).toContainText(/Diapositivas:\s*4\/4 aprobadas/);

    // 6. Editorial copy (stub writer): generated, then one deliverable approved.
    await generateEditorialCopy(page);
    await approveEditorialDeliverable(page, 'Facebook / Instagram');

    // 7. Final approval of the graphic carousel, independent of the copy: the dialog counts what will be exported.
    await page
      .getByRole('tablist', { name: 'Modo de revisión' })
      .getByRole('tab', { name: /^Diseño visual/ })
      .click();
    await expect(final.getByText('Todas las diapositivas están aprobadas y ninguna está bloqueada.')).toBeVisible();
    await giveFinalApproval(page, async (dialog) => {
      await expect(dialog.getByRole('definition').filter({ hasText: /^\d+ de \d+$/ })).toHaveText('4 de 4');
      await expect(dialog).toContainText('1 de 5 textos listos para exportar.');
      await expect(dialog).toContainText('copy-editorial.txt');
    });

    // 8-9. Download and verify the ZIP: slides in order, the approved copy only, a manifest matching the files.
    const first = readZip(await downloadCarousel(page));
    expect(first.map((file) => file.name)).toEqual([
      '01.png',
      '02.png',
      '03.png',
      '04.png',
      'copy-editorial.txt',
      'manifest.json',
    ]);
    for (const name of ['01.png', '02.png', '03.png', '04.png']) {
      expect(pngSize(entry(first, name))).toEqual({ width: 1080, height: 1350 });
    }
    const copy = entry(first, 'copy-editorial.txt').toString('utf8');
    expect(
      copy.startsWith(
        `COPY EDITORIAL APROBADO\n${competition.name} · ${competition.played.name} · ${competition.seasonLabel}\n`,
      ),
    ).toBe(true);
    expect(copy).toContain('\nFacebook / Instagram\n');
    for (const other of ['TikTok / Reels', 'YouTube', 'Titulares virales', 'Pregunta para generar debate']) {
      expect(copy).not.toContain(`\n${other}\n`);
    }
    expect(copy).not.toMatch(/https?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}-/);
    const manifest = JSON.parse(entry(first, 'manifest.json').toString('utf8')) as Manifest;
    for (const file of manifest.files) expect(sha256(entry(first, file.fileName))).toBe(file.sha256);
    expect(manifest.editorial?.fileName).toBe('copy-editorial.txt');
    expect(manifest.editorial?.sha256).toBe(sha256(entry(first, 'copy-editorial.txt')));
    expect(manifest.editorial?.deliverables.map((item) => item.deliverable)).toEqual(['facebook_instagram']);
    expect(manifest.editorial?.deliverables[0]?.factIds.length).toBeGreaterThan(0);

    // Independent approvals: a second deliverable approved after the final approval keeps it valid.
    await approveEditorialDeliverable(page, EDITORIAL_TABS[1]);
    await page
      .getByRole('tablist', { name: 'Modo de revisión' })
      .getByRole('tab', { name: /^Diseño visual/ })
      .click();
    await expect(final.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
    journey = { projectId, title, firstZip: first };

    // The export is listed in Exportaciones and opens with its slides.
    await page.goto('/exports');
    const library = page.getByRole('list', { name: 'Historial de exportaciones' });
    const cards = library.getByRole('article', { name: title, exact: true });
    await expect(cards).toHaveCount(1);
    await cards.first().getByRole('link', { name: 'Ver contenido' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Carrusel exportado' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Diapositivas del carrusel' }).getByRole('button')).toHaveCount(
      4,
    );
  });

  test('every download carries the copy approved now, without a new final approval or touching earlier ZIPs (E2E-F01)', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    if (journey === null) throw new Error('the journey did not run');
    const { projectId, title, firstZip } = journey;
    const slidesOf = (files: readonly ZipFile[]) => files.filter((file) => file.name.endsWith('.png'));
    const final = finalApprovalRegion(page);
    const designMode = async () => {
      await page
        .getByRole('tablist', { name: 'Modo de revisión' })
        .getByRole('tab', { name: /^Diseño visual/ })
        .click();
      // An editorial change never asks for the final approval again (PD-33 Option A).
      await expect(final.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
    };
    const finalApprovalId = manifestOf(firstZip).finalApproval.id;
    await openContentReview(page, projectId);

    // A. TikTok / Reels was approved after the first download: the next ZIP carries both approved texts, in the
    //    contract's order, with the same slides and the same final approval.
    await designMode();
    const approvedLater = readZip(await downloadCarousel(page));
    expect(copySections(approvedLater)).toEqual(['Facebook / Instagram', 'TikTok / Reels']);
    expectSameFiles(slidesOf(approvedLater), slidesOf(firstZip));
    const laterManifest = manifestOf(approvedLater);
    expect(laterManifest.exportId).not.toBe(manifestOf(firstZip).exportId);
    expect(laterManifest.finalApproval.id).toBe(finalApprovalId);
    expect(laterManifest.editorial?.deliverables.map((item) => item.deliverable)).toEqual([
      'facebook_instagram',
      'tiktok_reels',
    ]);
    expect(laterManifest.editorial?.sha256).toBe(sha256(entry(approvedLater, 'copy-editorial.txt')));
    for (const file of laterManifest.files) expect(sha256(entry(approvedLater, file.fileName))).toBe(file.sha256);
    // The Facebook / Instagram text is the same version as in the first ZIP.
    expect(laterManifest.editorial?.deliverables[0]).toEqual(manifestOf(firstZip).editorial?.deliverables[0]);
    expect(copySection(approvedLater, 'Facebook / Instagram')).toBe(copySection(firstZip, 'Facebook / Instagram'));

    // D. A repeated download without changes: the server writes it from the same state, so every file but the
    //    manifest (its own export ID and time) is the same, with the same editorial versions.
    const repeated = readZip(await downloadCarousel(page));
    expectSameFiles(
      repeated.filter((file) => file.name !== 'manifest.json'),
      approvedLater.filter((file) => file.name !== 'manifest.json'),
    );
    expect(manifestOf(repeated).editorial?.deliverables).toEqual(laterManifest.editorial?.deliverables);
    expect(manifestOf(repeated).finalApproval.id).toBe(finalApprovalId);

    // C. Editing the approved TikTok / Reels text saves a new version that is not approved: the next ZIP carries only
    //    Facebook / Instagram, neither the earlier approved TikTok text nor the edited one.
    const approvedTikTok = copySection(approvedLater, 'TikTok / Reels');
    const editMark = 'Texto editado sin aprobar (prueba E2E-F01).';
    await editEditorialField(page, 'TikTok / Reels', 'Texto', (text) => `${text} ${editMark}`);
    await designMode();
    const edited = readZip(await downloadCarousel(page));
    expect(copySections(edited)).toEqual(['Facebook / Instagram']);
    const editedCopy = entry(edited, 'copy-editorial.txt').toString('utf8');
    expect(editedCopy).not.toContain(approvedTikTok);
    expect(editedCopy).not.toContain(editMark);
    expect(manifestOf(edited).editorial?.deliverables.map((item) => item.deliverable)).toEqual(['facebook_instagram']);
    expectSameFiles(slidesOf(edited), slidesOf(firstZip));

    // B. Withdrawing the Facebook / Instagram approval: the next ZIP has no editorial copy at all, and its manifest
    //    no editorial section; the graphic carousel is the same.
    await withdrawEditorialApproval(page, 'Facebook / Instagram');
    await designMode();
    const withdrawn = readZip(await downloadCarousel(page));
    expect(withdrawn.map((file) => file.name)).toEqual(['01.png', '02.png', '03.png', '04.png', 'manifest.json']);
    expect(manifestOf(withdrawn).editorial).toBeUndefined();
    expect(manifestOf(withdrawn).finalApproval.id).toBe(finalApprovalId);
    expectSameFiles(slidesOf(withdrawn), slidesOf(firstZip));

    // History: one export per download, newest first, all of the same final approval; each earlier export still
    // downloads exactly the files it was written with.
    const downloads = [firstZip, approvedLater, repeated, edited, withdrawn];
    const listed = (await apiGet(page, `/api/v1/projects/${projectId}/exports`)) as ExportList;
    expect(listed.exports.map((item) => item.id)).toEqual(downloads.map((zip) => manifestOf(zip).exportId).reverse());
    expect(new Set(listed.exports.map((item) => item.finalApprovalId))).toEqual(new Set([finalApprovalId]));
    for (const zip of downloads) {
      const again = await page.request.get(`/api/v1/exports/${manifestOf(zip).exportId}/download`);
      expect(again.status()).toBe(200);
      expectSameFiles(readZip(await again.body()), zip);
    }

    // The project history marks the newest export of the valid final approval as current and keeps the others.
    await page.goto(`/projects/${projectId}`);
    const history = await openDisclosure(page, 'Historial de exportaciones');
    const items = history.getByRole('list', { name: 'Historial de exportaciones del proyecto' }).getByRole('listitem');
    await expect(items).toHaveCount(downloads.length);
    await expect(items.first()).toContainText('Vigente');
    for (const item of (await items.all()).slice(1)) await expect(item).toContainText('Sustituida');
    // Exportaciones lists every export of the project.
    await page.goto('/exports');
    await expect(
      page.getByRole('list', { name: 'Historial de exportaciones' }).getByRole('article', { name: title, exact: true }),
    ).toHaveCount(downloads.length);

    // Evidence (git-ignored; copied deliberately into docs/design/WI-2/evidence/UI-06/): the files of each ZIP.
    const summary = downloads.map((zip, index) => ({
      download: ['A0 primera descarga', 'A nueva aprobación', 'D repetida', 'C copy editado', 'B aprobación retirada'][
        index
      ],
      finalApprovalSameAsFirst: manifestOf(zip).finalApproval.id === finalApprovalId,
      editorialSections: copySections(zip),
      editorialVersions: (manifestOf(zip).editorial?.deliverables ?? []).map(
        (item) => `${item.deliverable} v${String(item.versionNumber)}`,
      ),
      files: zip.map((file) => `${file.name} ${sha256(file.bytes).slice(0, 16)}`),
      downloadsAgainUnchanged: true,
    }));
    writeFileSync(evidencePath('UI-06.1', 'e2e-f01-zips.json'), `${JSON.stringify(summary, null, 2)}\n`);
  });
});
