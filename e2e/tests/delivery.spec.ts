/**
 * Delivery of a catalogue project (R-200, R-203, R-215, R-216, R-218, R-220, R-221, R-269, R-290), kept by PD-ARCH-01F:
 * the catalogue creation form is retired, but the catalogue projects already created keep opening, running,
 * reviewing and exporting. The project (DEMO_DATA league matchday) is created through the API operation the studio
 * keeps; everything after that goes through the interface:
 *
 * run with stage progress; facts verified by the two independent demo sources; the export refused without a final
 * approval; the slides in carousel order; bulk approval and the final approval; the downloaded ZIP (one PNG per slide
 * at 1080 x 1350 and the manifest, no editorial copy because none was generated); the export in the project and in
 * Exportaciones; reopening the review with the same slides; and the trace of an exported slide to its facts,
 * statuses and sources.
 */
import { createHash } from 'node:crypto';

import {
  STAGES,
  approveReadySlidesInBulk,
  clientPost,
  createCatalogueProject,
  downloadCarousel,
  factsLink,
  giveFinalApproval,
  openContentReview,
  runToEnd,
  slideNames,
  stageRow,
  stageTable,
} from '../support/app.js';
import { pngSize } from '../support/png.js';
import { expect, test } from '../support/test.js';
import { readZip } from '../support/zip.js';

interface DraftShape {
  readonly carousels: readonly { readonly id: string }[];
}

interface ManifestShape {
  readonly exportId: string;
  readonly demonstration: boolean;
  readonly files: readonly { fileName: string; sha256: string }[];
  readonly editorial?: unknown;
}

test.describe('Delivery of a catalogue project (DEMO_DATA league matchday)', () => {
  test('run, verified facts, review, approval, download, history, reopen and trace', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const projectId = await createCatalogueProject(page, baseURL, {
      competitionId: 'liga-demo',
      sourceId: 'demo-a',
      seasonId: '2026',
      stageId: 'temporada-regular',
      matchday: 2,
    });
    const title = 'Liga Demo 2026/27 · Temporada Regular · Jornada 2';

    // Run with stage progress (R-200, R-203).
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Datos sintéticos · no verificados ni publicables.')).toBeVisible();
    await runToEnd(page, 1);
    const stages = await stageTable(page);
    await expect(stages.getByRole('rowheader')).toHaveText([...STAGES]);
    for (const stage of STAGES) {
      await expect(stageRow(page, stage).getByRole('cell').first()).toHaveText(/Completada/);
    }

    // Facts: every fact verified by the two independent demo sources, with the source evidence (R-269).
    await (await factsLink(page, 1)).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeVisible();
    await expect(page.getByText('Modo de datos: Datos de demostración')).toBeVisible();
    const summary = page.getByText(/^\d+ datos: \d+ verificados, 0 sin verificar, 0 aprobados manualmente/);
    await expect(summary).toBeVisible();
    const [, total, verified] = /^(\d+) datos: (\d+) verificados/.exec((await summary.textContent()) ?? '') ?? [];
    expect(Number(total)).toBeGreaterThan(0);
    expect(verified).toBe(total);
    const evidence = page.getByRole('table', { name: 'Evidencia por fuente' }).first();
    await expect(evidence.getByRole('rowheader')).toHaveText([
      'Synthetic source A (demo-a)',
      'Synthetic source B (demo-b)',
    ]);

    // Export without a final approval: the server refuses it (R-216).
    const draft = (await (await page.request.get(`/api/v1/projects/${projectId}/draft`)).json()) as DraftShape;
    const carouselId = draft.carousels[0]?.id ?? '';
    const refused = await clientPost(page, `/api/v1/carousels/${carouselId}/exports`, baseURL);
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe('FINAL_APPROVAL_REQUIRED');

    // Review: slides in carousel order (cover, results, standings, closing) (R-215); no download before approval.
    await openContentReview(page, projectId);
    const slides = await slideNames(page);
    expect(slides.map((name) => /^Diapositiva (\d+):/.exec(name)?.[1])).toEqual(
      slides.map((_name, index) => String(index + 1)),
    );
    expect(slides[0]).toBe('Diapositiva 1: Portada');
    expect(slides.at(-1)).toMatch(/: Cierre$/);
    expect(slides.some((name) => name.endsWith(': Resultado'))).toBe(true);
    expect(slides.some((name) => name.endsWith(': Clasificación'))).toBe(true);
    await expect(page.getByRole('button', { name: 'Descargar carrusel' })).toHaveCount(0);

    // Approve every slide, then the final approval.
    expect(await approveReadySlidesInBulk(page)).toBe(slides.length);
    await giveFinalApproval(page, async (dialog) => {
      await expect(dialog).toContainText(`${String(slides.length)} de ${String(slides.length)}`);
    });

    // Download: one PNG per slide in order at 1080 x 1350, then the manifest (R-218).
    const files = readZip(await downloadCarousel(page));
    const images = slides.map((_name, index) => `${String(index + 1).padStart(2, '0')}.png`);
    expect(files.map((file) => file.name)).toEqual([...images, 'manifest.json']);
    for (const file of files.filter((candidate) => candidate.name.endsWith('.png'))) {
      expect(pngSize(file.bytes)).toEqual({ width: 1080, height: 1350 });
    }
    const manifest = JSON.parse(files.at(-1)?.bytes.toString('utf8') ?? '{}') as ManifestShape;
    expect(manifest.demonstration).toBe(true);
    expect(manifest.editorial).toBeUndefined();
    for (const entry of manifest.files) {
      const bytes = files.find((file) => file.name === entry.fileName)?.bytes ?? Buffer.alloc(0);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }

    // History: the export is in the project and in Exportaciones (R-220).
    await page.goto('/exports');
    const card = page.getByRole('list', { name: 'Historial de exportaciones' }).getByRole('article', { name: title });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(`${String(slides.length)} imágenes`);
    await card.getByRole('link', { name: 'Ver contenido' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Carrusel exportado' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/exports/${manifest.exportId}$`));
    await expect(page.getByRole('navigation', { name: 'Diapositivas del carrusel' }).getByRole('button')).toHaveCount(
      slides.length,
    );

    // Reopening the review shows the same slides, still approved.
    await openContentReview(page, projectId);
    expect(await slideNames(page)).toEqual(slides);
    await expect(page.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();

    // Trace of an exported result slide: its facts, their verification status and their sources (R-221).
    await page.goto(`/projects/${projectId}/exports/${manifest.exportId}/slides/2/trace`);
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad de la diapositiva 2' })).toBeVisible();
    const traced = page.getByRole('region', { name: 'Datos de la diapositiva' });
    await expect(
      traced.getByText(/^\d+ datos: \d+ verificados, 0 sin verificar, 0 aprobados manualmente/),
    ).toBeVisible();
    const facts = traced.getByRole('article');
    expect(await facts.count()).toBeGreaterThan(0);
    for (const fact of await facts.all()) {
      await expect(fact).toContainText('Verificado');
      await expect(fact.getByRole('table', { name: 'Evidencia por fuente' }).getByRole('rowheader')).toHaveText([
        'Synthetic source A (demo-a)',
        'Synthetic source B (demo-b)',
      ]);
    }
    await expect(traced.getByRole('article', { name: /^Marcador · / })).toBeVisible();
  });
});
