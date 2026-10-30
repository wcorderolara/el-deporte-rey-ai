/**
 * Accessibility checks (`@a11y`): axe reports no serious or critical violation on any page of the application, each
 * checked once its data has loaded, in the states an operator meets: empty and populated project list, creation
 * form with a complete selection, project page after a completed and after a failed run, facts (DEMO_DATA and
 * MANUAL_DATA with the manual-approval confirmation open), review (approved with final approval, and blocked), exports
 * and history, one export, the trace of an exported slide, the import page (file and form modes, a rejected import
 * with its error table, an applied import), an import, a selection version, the brand page with a registered asset,
 * and the not-found page. A positive control proves that the scan reports a seeded serious violation.
 *
 * The data is prepared once through the interface (beforeAll) on the suite server; the failed-run page uses a
 * journey-owned server (e2e/support/scenario-server.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { approveAll, createProject, exportFirstCarousel, openExports, openReview, runToEnd } from '../support/app.js';
import { solidPng } from '../support/png.js';
import { test as scenarioTest } from '../support/scenario-server.js';
import { axeScan, expect, guardRequests, test } from '../support/test.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const VALID_MATCHES_CSV = readFileSync(resolve(PROJECT_ROOT, 'fixtures/manual/valid/liga-manual-matches.csv'), 'utf8');

/** Addresses of the pages prepared by beforeAll. */
interface Prepared {
  demoProject: string;
  demoFacts: string;
  demoReview: string;
  demoExports: string;
  exportDetail: string;
  trace: string;
  importDetail: string;
  version: string;
  manualProject: string;
  manualFacts: string;
  manualReview: string;
}

let prepared: Prepared | null = null;

function pages(): Prepared {
  if (prepared === null) {
    throw new Error('the accessibility data was not prepared');
  }
  return prepared;
}

/** Waits until no loading message is shown, then expects no serious or critical axe violation. */
async function expectAccessible(page: Page): Promise<void> {
  await expect(page.getByText(/^Cargando/)).toHaveCount(0);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await axeScan(page)).toEqual([]);
}

async function uploadCsv(page: Page, name: string, content: string): Promise<void> {
  const form = page.getByRole('form', { name: 'Importar un archivo' });
  await form.locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content) });
  await form.getByRole('button', { name: 'Importar archivo' }).click();
}

function csvWithErrors(): string {
  const lines = VALID_MATCHES_CSV.split('\n');
  lines[2] = (lines[2] ?? '').replace(/,3,3$/, ',tres,3');
  lines[5] = (lines[5] ?? '').replace(/,1,4$/, ',1,-1');
  return lines.join('\n');
}

test.describe('Accessibility @a11y', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const baseURL = process.env['E2E_BASE_URL'];
    if (baseURL === undefined || baseURL === '') {
      throw new Error('E2E_BASE_URL is not set');
    }
    const context = await browser.newContext({ baseURL, locale: 'es-GT', timezoneId: 'America/Guatemala' });
    const blocked = await guardRequests(context, new URL(baseURL).origin);
    const page = await context.newPage();
    try {
      // DEMO_DATA project: run, approve, final approval, export.
      const demo = await createProject(page, {
        competition: /^Liga Demo/,
        season: '2026/27 (actual)',
        stage: 'Temporada Regular',
        matchday: 'Jornada 3',
      });
      await runToEnd(page, 1);
      const factsHref = await page
        .getByRole('link', { name: 'Datos y verificación (ejecución 1)' })
        .getAttribute('href');
      await openReview(page, demo);
      await approveAll(page);
      await openExports(page, demo);
      await exportFirstCarousel(page);
      await page.getByRole('link', { name: 'Abrir esta exportación' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Exportación' })).toBeVisible();
      const exportDetail = new URL(page.url()).pathname;

      // MANUAL_DATA: an applied import and a project run on it.
      await page.goto('/imports');
      await uploadCsv(page, 'liga-manual-a11y.csv', VALID_MATCHES_CSV);
      const applied = page.getByRole('region', { name: 'Importación aplicada' });
      await expect(applied).toBeVisible();
      const version = await applied.getByRole('link', { name: 'Torneo Apertura, jornada 1' }).getAttribute('href');
      await page.goto('/imports');
      const importDetail = await page
        .getByRole('region', { name: 'Historial de importaciones' })
        .getByRole('link', { name: /^Importación del / })
        .first()
        .getAttribute('href');
      const manual = await createProject(page, {
        competition: /^Liga Manual Sintética/,
        stage: 'Torneo Apertura',
        matchday: 'Jornada 1',
        mode: 'manual',
      });
      await runToEnd(page, 1);
      const manualFactsHref = await page
        .getByRole('link', { name: 'Datos y verificación (ejecución 1)' })
        .getAttribute('href');

      prepared = {
        demoProject: `/projects/${demo}`,
        demoFacts: factsHref ?? '',
        demoReview: `/projects/${demo}/review`,
        demoExports: `/projects/${demo}/exports`,
        exportDetail,
        trace: `${exportDetail}/slides/2/trace`,
        importDetail: importDetail ?? '',
        version: version ?? '',
        manualProject: `/projects/${manual}`,
        manualFacts: manualFactsHref ?? '',
        manualReview: `/projects/${manual}/review`,
      };
      expect(blocked, 'requests to an origin other than the application under test').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('project list page has no serious or critical axe violation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Proyectos e historial' })).toBeVisible();
    await expectAccessible(page);
  });

  test('project creation page with a complete selection', async ({ page }) => {
    await page.goto('/projects/new');
    await page.getByRole('radio', { name: /^Copa Demo/ }).check();
    await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ index: 1 });
    await page.getByRole('radio', { name: 'Octavos de Final', exact: true }).check();
    await page.getByRole('combobox', { name: 'Jornada' }).selectOption({ label: 'Jornada 1' });
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await expectAccessible(page);
  });

  test('project page after a completed run', async ({ page }) => {
    await page.goto(pages().demoProject);
    await expect(page.getByRole('table', { name: 'Estado de cada etapa' })).toBeVisible();
    await expectAccessible(page);
  });

  test('facts page of a DEMO_DATA run', async ({ page }) => {
    await page.goto(pages().demoFacts);
    await expect(page.getByRole('heading', { level: 2, name: 'Partidos', exact: true })).toBeVisible();
    await expectAccessible(page);
  });

  test('review page with every element approved and the final approval', async ({ page }) => {
    await page.goto(pages().demoReview);
    await expect(page.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
    await expectAccessible(page);
  });

  test('exports and history page', async ({ page }) => {
    await page.goto(pages().demoExports);
    await expect(page.getByRole('table', { name: /^Exportaciones del proyecto/ })).toBeVisible();
    await expectAccessible(page);
  });

  test('export page', async ({ page }) => {
    await page.goto(pages().exportDetail);
    await expect(page.getByRole('table', { name: 'Archivos escritos' })).toBeVisible();
    await expectAccessible(page);
  });

  test('trace page of an exported slide', async ({ page }) => {
    await page.goto(pages().trace);
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad de la diapositiva 2' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Datos de la diapositiva' })).toBeVisible();
    await expectAccessible(page);
  });

  test('import page in file mode, with a rejected import and its errors', async ({ page }) => {
    await page.goto('/imports');
    await expect(page.getByRole('form', { name: 'Importar un archivo' })).toBeVisible();
    await expectAccessible(page);
    await uploadCsv(page, 'liga-manual-errores.csv', csvWithErrors());
    await expect(page.getByRole('table', { name: '2 errores en la importación' })).toBeVisible();
    await expectAccessible(page);
  });

  test('import page with an applied import', async ({ page }) => {
    await page.goto('/imports');
    await uploadCsv(page, 'liga-manual-a11y-2.csv', VALID_MATCHES_CSV);
    await expect(page.getByRole('region', { name: 'Importación aplicada' })).toBeVisible();
    await expectAccessible(page);
  });

  test('import page in form mode', async ({ page }) => {
    await page.goto('/imports');
    await page.getByRole('radio', { name: 'Formulario' }).check();
    const form = page.getByRole('form', { name: 'Introducir datos con el formulario' });
    await expect(form).toBeVisible();
    await expectAccessible(page);
    // Client-side error summary of an empty submission.
    await form.getByRole('button', { name: 'Importar datos del formulario' }).click();
    await expect(page.getByText(/^Hay \d+ errores? en el formulario$/)).toBeVisible();
    await expectAccessible(page);
  });

  test('import page and selection version page', async ({ page }) => {
    await page.goto(pages().importDetail);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().version);
    await expect(page.getByRole('table', { name: 'Partidos' })).toBeVisible();
    await expectAccessible(page);
  });

  test('facts page of a MANUAL_DATA run with the manual-approval confirmation open', async ({ page }) => {
    await page.goto(pages().manualFacts);
    const trigger = page.getByRole('button', { name: /^Aprobar manualmente: / }).first();
    await expect(trigger).toBeVisible();
    await expectAccessible(page);
    await trigger.click();
    await expect(page.getByRole('group', { name: 'Confirmar la aprobación manual' })).toBeVisible();
    await expectAccessible(page);
  });

  test('project and review pages of a MANUAL_DATA project with blocked elements', async ({ page }) => {
    await page.goto(pages().manualProject);
    await expect(page.getByRole('table', { name: 'Estado de cada etapa' })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().manualReview);
    await expect(page.getByRole('region', { name: /^Datos que bloquean la aprobación: / }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test('brand page with a registered asset', async ({ page }) => {
    await page.goto('/brand');
    const form = page.getByRole('form', { name: 'Registrar un recurso de marca' });
    await form.getByRole('radio', { name: /^Mascota / }).check();
    await form.getByRole('textbox', { name: 'Etiqueta' }).fill('Mascota sintética de prueba');
    await form.locator('input[type="file"]').setInputFiles({
      name: 'mascota-sintetica.png',
      mimeType: 'image/png',
      buffer: solidPng(48, 48, [0x1f, 0x4e, 0x8c]),
    });
    await form.getByRole('button', { name: 'Registrar recurso' }).click();
    await expect(page.getByRole('region', { name: 'Recursos registrados' })).toContainText(
      'Mascota sintética de prueba',
    );
    await expectAccessible(page);
  });

  test('not-found page', async ({ page }) => {
    await page.goto('/no-existe');
    await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeVisible();
    await expectAccessible(page);
  });

  test('positive control: the scan reports a seeded low-contrast text', async ({ page }) => {
    await page.setContent(
      '<!doctype html><html lang="es"><head><title>Control</title></head><body><main><h1>Control</h1>' +
        '<p style="color:#bbbbbb;background:#ffffff">Texto de contraste insuficiente</p></main></body></html>',
    );

    const findings = await axeScan(page);
    expect(findings.map((finding) => finding.id)).toContain('color-contrast');
  });
});

scenarioTest.describe('Accessibility of a failed run @a11y', () => {
  scenarioTest('project page after a failed run', async ({ page, scenarioServer }) => {
    scenarioTest.setTimeout(120_000);
    await scenarioServer.restart({});
    await createProject(page, {
      competition: /^Liga Demo/,
      season: '2026/27 (actual)',
      stage: 'Temporada Regular',
      matchday: 'Jornada 1',
    });
    const project = new URL(page.url()).pathname;
    await page.goto('about:blank');
    await scenarioServer.restart({ 'demo-a': 'provider-unavailable' });
    await page.goto(project);
    await runToEnd(page, 1, 'fallida');
    await expectAccessible(page);
  });
});
