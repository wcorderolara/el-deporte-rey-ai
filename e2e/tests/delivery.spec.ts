/**
 * Delivery journey of a DEMO_DATA league matchday on the suite server (R-200, R-203, R-215, R-216, R-218, R-220,
 * R-221, R-269, R-290): create, run with stage progress, review the verified facts, preview the carousel with its
 * caption and hashtags, see the export refused without a final approval, approve every element (acknowledging any
 * Visual QA warning), give the final approval after the last research run, export and see the files listed, find the
 * project in the history with its approval state and export time, reopen it with the same slides and caption, and
 * trace an exported slide to its facts, statuses and sources.
 */
import type { Page } from '@playwright/test';

import {
  STAGES,
  apiGet,
  approveAll,
  clientPost,
  createProject,
  elementNames,
  exportFirstCarousel,
  openExports,
  openReview,
  runRegion,
  stageStatus,
  stageTable,
} from '../support/app.js';
import { pngSize } from '../support/png.js';
import { expect, test } from '../support/test.js';

interface DraftShape {
  readonly carousels: readonly { readonly id: string }[];
}

/** Text and image name of each element of the preview, keyed by element name (for the reopen comparison). */
async function previewContent(page: Page): Promise<Record<string, { text: string; image: string | null }>> {
  const content: Record<string, { text: string; image: string | null }> = {};
  for (const name of await elementNames(page)) {
    const article = page.getByRole('article', { name, exact: true });
    const image = article.getByRole('img');
    content[name] = {
      text: ((await article.getByRole('region', { name: `Texto: ${name}`, exact: true }).textContent()) ?? '').trim(),
      image: (await image.count()) === 0 ? null : await image.first().getAttribute('alt'),
    };
  }
  return content;
}

test.describe('Delivery journey (DEMO_DATA league matchday)', () => {
  test('research, review, preview, approval, export, history, reopen and trace', async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    if (baseURL === undefined) {
      throw new Error('baseURL is not configured');
    }

    // Create the project and run research with stage progress (R-200, R-203).
    const projectId = await createProject(page, {
      competition: /^Liga Demo/,
      season: '2026/27 (actual)',
      stage: 'Temporada Regular',
      matchday: 'Jornada 2',
    });
    const title = 'Liga Demo 2026/27 · Temporada Regular · Jornada 2';
    const run = runRegion(page);
    await run.getByRole('button', { name: 'Iniciar ejecución completa' }).click();
    await expect(run.getByRole('heading', { level: 3, name: 'Ejecución 1 (completa)' })).toBeVisible();
    await expect(stageTable(page).getByRole('rowheader')).toHaveText([...STAGES]);
    await expect(run.getByRole('status').first()).toHaveText('Ejecución 1: completada.', { timeout: 60_000 });
    for (const stage of STAGES) {
      await expect(stageStatus(page, stage).getByRole('cell').first()).toHaveText(/Completada/);
    }

    // Facts: every fact verified by the two independent demo sources, with the source evidence (R-269).
    await page.getByRole('link', { name: 'Datos y verificación (ejecución 1)' }).click();
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
    await expect(evidence.getByRole('row').nth(1)).toContainText('Datos de demostración');

    // Export without a final approval: the interface offers no export, and the server refuses one (R-216).
    await openExports(page, projectId);
    await expect(page.getByText(/^Sin aprobación final válida: apruebe cada diapositiva/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Exportar el carrusel/ })).toHaveCount(0);
    const draft = (await apiGet(page, `/api/v1/projects/${projectId}/draft`)) as DraftShape;
    const carouselId = draft.carousels[0]?.id ?? '';
    const refused = await clientPost(page, `/api/v1/carousels/${carouselId}/exports`, baseURL);
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe('FINAL_APPROVAL_REQUIRED');
    await expect(page.getByText('Este proyecto todavía no tiene exportaciones.')).toBeVisible();

    // Preview before approval: slides in carousel order, then the caption with hashtags (R-215).
    await openReview(page, projectId);
    await expect(page.getByRole('note', { name: 'Contenido de demostración' })).toBeVisible();
    const names = await elementNames(page);
    const slides = names.filter((name) => name.startsWith('Diapositiva '));
    expect(slides.map((name) => /^Diapositiva (\d+):/.exec(name)?.[1])).toEqual(
      slides.map((_name, index) => String(index + 1)),
    );
    expect(slides[0]).toBe('Diapositiva 1: Portada');
    expect(slides.at(-1)).toMatch(/: Cierre$/);
    expect(slides.some((name) => name.endsWith(': Resultado'))).toBe(true);
    expect(slides.some((name) => name.endsWith(': Clasificación'))).toBe(true);
    expect(names.at(-1)).toBe('Texto de publicación y hashtags');
    const caption = page.getByRole('region', { name: 'Texto: Texto de publicación y hashtags', exact: true });
    await expect(caption.locator('dt', { hasText: 'Texto de publicación' })).toBeVisible();
    await expect(
      caption.locator('dt', { hasText: 'Hashtags' }).locator('xpath=following-sibling::dd[1]'),
    ).toContainText(/#\S+/);
    for (const name of slides) {
      await expect(page.getByRole('article', { name, exact: true }).getByRole('figure')).toContainText(
        '1080 × 1350 px',
      );
    }
    const finalRegion = page.getByRole('region', { name: 'Aprobación final del carrusel' });
    await expect(finalRegion.getByRole('button', { name: 'Dar la aprobación final' })).toBeDisabled();
    await expect(finalRegion).toContainText('La aprobación final no está disponible todavía:');
    const before = await previewContent(page);

    // Approve every element, then the final approval (made after the only research run, T58).
    await approveAll(page);

    // Export and see the files listed: one PNG per slide in order at 1080 x 1350, the caption file, the manifest (R-218).
    await finalRegion.getByRole('link', { name: 'Ir a exportaciones' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Exportaciones e historial' })).toBeVisible();
    const directory = await exportFirstCarousel(page);
    expect(directory).toMatch(new RegExp(`^exports/${projectId}/[0-9a-f-]{36}$`));
    const files = page.getByRole('table', { name: 'Archivos escritos' });
    const expectedFiles = [
      ...slides.map((_name, index) => `${String(index + 1).padStart(2, '0')}.png`),
      'caption.txt',
      'manifest.json',
    ];
    await expect(files.getByRole('rowheader')).toHaveText(expectedFiles);
    const imageRows = files.getByRole('row').filter({ hasText: 'Imagen de diapositiva (PNG)' });
    await expect(imageRows).toHaveCount(slides.length);
    for (let index = 0; index < slides.length; index += 1) {
      const cells = imageRows.nth(index).getByRole('cell');
      await expect(cells.nth(1)).toHaveText(String(index + 1));
      const versionId = ((await cells.nth(3).textContent()) ?? '').trim();
      const image = await page.request.get(`/api/v1/element-versions/${versionId}/image`);
      expect(image.status()).toBe(200);
      expect(pngSize(await image.body())).toEqual({ width: 1080, height: 1350 });
    }
    await expect(files.getByRole('row').filter({ hasText: 'caption.txt' })).toContainText(
      'Texto de la publicación y etiquetas (caption.txt)',
    );

    // History: the export with its time, mode, demonstration label and final approval (R-220, R-269).
    const history = page.getByRole('table', {
      name: 'Exportaciones del proyecto, de la más reciente a la más antigua',
    });
    await expect(history.getByRole('row')).toHaveCount(2);
    const exportRow = history.getByRole('row').nth(1);
    await expect(exportRow.getByRole('cell')).toHaveText([
      'Datos de demostración',
      /^\W*Demostración$/,
      'Registrada',
      `${String(expectedFiles.length)} archivos`,
      directory,
      /^Abrir/,
    ]);
    const exportedAt = ((await exportRow.getByRole('rowheader').textContent()) ?? '').trim();
    expect(exportedAt).toMatch(/\d{4}, \d{2}:\d{2}$/);

    // The project list shows the approval state and the export time; reopening shows the same content (R-220).
    await page.goto('/');
    const listRow = page
      .getByRole('list', { name: 'Proyectos e historial' })
      .getByRole('article')
      .filter({ has: page.locator(`a[href="/projects/${projectId}"]`) });
    await expect(listRow.getByText('Exportado', { exact: true }).first()).toBeVisible();
    await expect(listRow.locator('time').first()).toHaveText(exportedAt);
    await listRow.getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.getByRole('link', { name: 'Revisión y aprobación' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Vista previa en orden de publicación' })).toBeVisible();
    expect(await elementNames(page)).toEqual(names);
    expect(await previewContent(page)).toEqual(before);

    // The kept export, opened from the history, lists the exported slides and caption in order.
    await openExports(page, projectId);
    await page.getByRole('link', { name: `Abrir la exportación del ${exportedAt}` }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Exportación' })).toBeVisible();
    const exported = page.getByRole('region', { name: 'Contenido exportado' });
    await expect(exported.getByRole('heading', { level: 3, name: /^Diapositiva \d+ / })).toHaveText(
      slides.map((_name, index) => `Diapositiva ${String(index + 1)} (versión 1)`),
    );
    await expect(exported.getByRole('article', { name: 'Texto de la publicación (versión 1)' })).toContainText(/#\S+/);
    await expect(page.getByRole('note', { name: 'Contenido de demostración' })).toBeVisible();

    // Trace of an exported result slide: its facts, their verification status and their sources (R-221).
    await page.getByRole('link', { name: 'Ver la trazabilidad de la diapositiva 2' }).click();
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
