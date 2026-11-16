/**
 * Accessibility checks (`@a11y`, UI-06.1): axe reports no serious or critical violation (WCAG 2.0, 2.1 and 2.2, A and
 * AA) on the screens of the current product, each checked once its data has loaded, in the states an operator meets:
 * Inicio and Mis proyectos; every step of Crear contenido and the generation result; the project page with its run
 * details and its data and verification page; the review workspace in both modes, with a visual QA warning, the bulk
 * approval confirmation, the editorial copy and the final approval dialog; Exportaciones, an export and the trace of
 * an exported slide; Competiciones with a competition, its teams (with the badge upload form open), a season and a
 * round; Datos (file and form modes, a rejected and an applied import, an import and a selection version); Mi marca
 * (resources with the upload dialog, visual identity); Plantillas (create, engine templates); the not-found page; and
 * the project page of a run that failed. A positive control proves that the scan reports a seeded serious violation.
 *
 * A violation that is already known and assigned to a later increment can be declared per check (`expectAccessible`'s
 * `known` rules, with its finding ID): the check then expects exactly that rule, so it fails on any new violation and
 * also once the known one is fixed. UI-06.2 fixed the two that UI-06.1 declared (A11Y-01, the trace page in the dark
 * studio colours, and R-03, the review preview at 1280 x 720): none is declared now. The trace is scanned in its
 * states: operator-attested facts (local data), verified facts with the demonstration notice (a DEMO_DATA export),
 * and an invalid address.
 *
 * The data is prepared once through the interface (beforeAll) on the suite server, on synthetic local data created
 * through the API; the failed-run page uses a journey-owned server (e2e/support/scenario-server.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';

import {
  approveEditorialDeliverable,
  approveReadySlidesInBulk,
  approveSlide,
  chooseSportsContext,
  createCatalogueProject,
  downloadCarousel,
  factsLink,
  generateContent,
  generateEditorialCopy,
  giveFinalApproval,
  openContentReview,
  openEditorialMode,
  runToEnd,
  slideInspector,
} from '../support/app.js';
import { seedLocalCompetition, type LocalCompetition } from '../support/local-data.js';
import { solidPng } from '../support/png.js';
import { test as scenarioTest } from '../support/scenario-server.js';
import { axeScan, expect, guardRequests, test } from '../support/test.js';
import { readZip } from '../support/zip.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const VALID_MATCHES_CSV = readFileSync(resolve(PROJECT_ROOT, 'fixtures/manual/valid/liga-manual-matches.csv'), 'utf8');

/** Addresses of the pages prepared by beforeAll. */
interface Prepared {
  competition: LocalCompetition;
  batch: string;
  project: string;
  facts: string;
  review: string;
  exportDetail: string;
  trace: string;
  /** The trace of an exported slide of a DEMO_DATA catalogue project (verified facts, demonstration notice). */
  demoTrace: string;
  /** The data and verification page of that DEMO_DATA run. */
  demoFacts: string;
  importDetail: string;
  version: string;
}

let prepared: Prepared | null = null;

function pages(): Prepared {
  if (prepared === null) throw new Error('the accessibility data was not prepared');
  return prepared;
}

/**
 * Waits until no loading message is shown, then expects no serious or critical axe violation other than the `known`
 * rules, which must all still be reported.
 */
async function expectAccessible(page: Page, known: readonly string[] = []): Promise<void> {
  await expect(page.getByText(/^(Cargando|Calculando|Comprobando|Dibujando)/)).toHaveCount(0);
  await expect(page.getByRole('main')).toBeVisible();
  // Colour transitions (for example a button that has just been enabled) are measured once they have finished;
  // endless animations (a spinner) and cancelled ones are not waited for.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  const findings = await axeScan(page);
  expect(
    findings.filter((finding) => !known.includes(finding.id)),
    'serious or critical axe violations',
  ).toEqual([]);
  for (const id of known) {
    expect(
      findings.map((finding) => finding.id),
      `known violation ${id} is no longer reported: remove its declaration`,
    ).toContain(id);
  }
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
    if (baseURL === undefined || baseURL === '') throw new Error('E2E_BASE_URL is not set');
    const context = await browser.newContext({ baseURL, locale: 'es-GT', timezoneId: 'America/Guatemala' });
    const blocked = await guardRequests(context, new URL(baseURL).origin);
    const page = await context.newPage();
    try {
      // Local content: generated, approved, final approval, downloaded (which records the export).
      const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Accesible' });
      const [project] = await generateContent(page, competition, competition.played);
      if (project === undefined) throw new Error('no project was generated');
      const batch = new URL(page.url()).pathname;
      await page.goto(`/projects/${project}`);
      await page.getByText('Más opciones del proyecto', { exact: true }).click();
      const facts = await page
        .getByRole('link', { name: /^Datos y verificación \(ejecución 1\)$/ })
        .getAttribute('href');
      await openContentReview(page, project);
      await approveSlide(page, 'Diapositiva 2: Resultado');
      await approveSlide(page, 'Diapositiva 3: Resultado');
      await approveReadySlidesInBulk(page);
      await generateEditorialCopy(page);
      await approveEditorialDeliverable(page, 'Facebook / Instagram');
      await page.getByRole('tab', { name: /^Diseño visual/ }).click();
      await giveFinalApproval(page);
      await downloadCarousel(page);
      await page.goto('/exports');
      await page.getByRole('link', { name: 'Ver contenido' }).first().click();
      await expect(page.getByRole('heading', { level: 1, name: 'Carrusel exportado' })).toBeVisible();
      const exportDetail = new URL(page.url()).pathname;

      // A DEMO_DATA catalogue export: its trace shows verified facts and the demonstration notice.
      const demo = await createCatalogueProject(page, baseURL, {
        competitionId: 'liga-demo',
        sourceId: 'demo-a',
        seasonId: '2026',
        stageId: 'temporada-regular',
        matchday: 2,
      });
      await page.goto(`/projects/${demo}`);
      await runToEnd(page, 1);
      const demoFacts = await (await factsLink(page, 1)).getAttribute('href');
      await openContentReview(page, demo);
      await approveReadySlidesInBulk(page);
      await giveFinalApproval(page);
      const manifest = readZip(await downloadCarousel(page)).find((file) => file.name === 'manifest.json');
      const { exportId } = JSON.parse(manifest?.bytes.toString('utf8') ?? '{}') as { exportId?: string };

      // Datos: an applied import with its selection versions.
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

      prepared = {
        competition,
        batch,
        project: `/projects/${project}`,
        facts: facts ?? '',
        review: `/projects/${project}/review`,
        exportDetail,
        trace: `${exportDetail}/slides/2/trace`,
        demoTrace: `/projects/${demo}/exports/${exportId ?? ''}/slides/2/trace`,
        demoFacts: demoFacts ?? '',
        importDetail: importDetail ?? '',
        version: version ?? '',
      };
      expect(blocked, 'requests to an origin other than the application under test').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('Inicio and Mis proyectos', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Proyectos e historial' })).toBeVisible();
    await expectAccessible(page);
    await page.goto('/projects');
    await expect(page.getByRole('table', { name: 'Proyectos e historial' })).toBeVisible();
    await expectAccessible(page);
  });

  test('every step of Crear contenido and the generation result', async ({ page }) => {
    const { competition } = pages();
    await page.goto('/projects/generate');
    await expect(page.getByRole('combobox', { name: 'Competición' })).toBeVisible();
    await expectAccessible(page);
    await chooseSportsContext(page, competition, competition.upcoming);
    await expectAccessible(page);
    const next = page.getByRole('button', { name: 'Continuar' });
    await next.click();
    await expect(page.getByRole('region', { name: '2. Tipo de contenido' })).toBeVisible();
    await page.getByRole('checkbox', { name: /^Resultados de jornada / }).uncheck();
    await page.getByRole('checkbox', { name: /^Calendario de jornada / }).check();
    await expectAccessible(page);
    await next.click();
    await expect(page.getByRole('region', { name: `3. Partidos de ${competition.upcoming.name}` })).toBeVisible();
    await page.getByRole('button', { name: 'Seleccionar compatibles' }).click();
    await expectAccessible(page);
    await next.click();
    await expect(page.getByRole('region', { name: '4. Plantilla' })).toBeVisible();
    await expectAccessible(page);
    await next.click();
    await expect(page.getByRole('region', { name: 'Piezas' })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().batch);
    await expect(page.getByRole('heading', { level: 1, name: 'Resultado de la generación' })).toBeVisible();
    await expectAccessible(page);
  });

  test('project page with its run details, and its data and verification page', async ({ page }) => {
    await page.goto(pages().project);
    await expect(page.getByRole('region', { name: 'Contenido generado' })).toBeVisible();
    await expectAccessible(page);
    await page.getByText('Generación y progreso', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Ejecución' })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().facts);
    await expect(page.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeVisible();
    await expectAccessible(page);
  });

  test('review workspace: warning, bulk approval, editorial copy and final approval dialog', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const { competition } = pages();
    const [project] = await generateContent(page, competition, competition.played);
    await openContentReview(page, project ?? '');
    await expectAccessible(page);
    // A slide with a visual QA warning to confirm.
    await page
      .getByRole('navigation', { name: 'Diapositivas del carrusel' })
      .getByRole('button', { name: /^Diapositiva 2: / })
      .click();
    await expect(
      slideInspector(page, 'Diapositiva 2: Resultado').getByRole('button', { name: /^Confirmar la advertencia/ }),
    ).toBeVisible();
    await expectAccessible(page);
    // The bulk approval confirmation.
    await page.getByRole('button', { name: /^Aprobar todas \(\d+\)$/ }).click();
    const bulk = page.getByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
    await expect(bulk).toBeVisible();
    await expectAccessible(page);
    await bulk.getByRole('button', { name: 'Cancelar' }).click();
    // Editorial copy, before and after generation.
    await openEditorialMode(page);
    await expect(page.getByRole('button', { name: 'Generar copy editorial' })).toBeVisible();
    await expectAccessible(page);
    await generateEditorialCopy(page);
    await expectAccessible(page);
    // The final approval dialog.
    await page.getByRole('tab', { name: /^Diseño visual/ }).click();
    await approveSlide(page, 'Diapositiva 2: Resultado');
    await approveSlide(page, 'Diapositiva 3: Resultado');
    await approveReadySlidesInBulk(page);
    await page.getByRole('button', { name: 'Aprobar carrusel completo' }).click();
    await expect(page.getByRole('dialog', { name: 'Aprobar carrusel completo' })).toBeVisible();
    await expectAccessible(page);
  });

  test('review workspace with a valid final approval', async ({ page }) => {
    await page.goto(pages().review);
    await expect(page.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
    await expectAccessible(page);
  });

  test('Exportaciones, an export, the trace of an exported slide in its states and a demo run', async ({ page }) => {
    await page.goto('/exports');
    await expect(page.getByRole('list', { name: 'Historial de exportaciones' })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().exportDetail);
    await expect(page.getByRole('heading', { level: 1, name: 'Carrusel exportado' })).toBeVisible();
    await expectAccessible(page);
    // The trace in its states (A11Y-01): operator-attested local facts, verified DEMO_DATA facts with the
    // demonstration notice, and an address that names no export.
    await page.goto(pages().trace);
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad de la diapositiva 2' })).toBeVisible();
    await expect(page.getByText(/aprobados manualmente/).first()).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().demoTrace);
    await expect(page.getByRole('heading', { level: 1, name: 'Trazabilidad de la diapositiva 2' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Datos de la diapositiva' }).getByText(/^\d+ datos: \d+ verificados/),
    ).toBeVisible();
    await expectAccessible(page);
    await page.goto(`${pages().exportDetail}/slides/no-es-una-posicion/trace`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().demoFacts);
    await expect(page.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeVisible();
    await expectAccessible(page);
  });

  test('Competiciones: list, competition, teams with the badge form, season and round', async ({ page }) => {
    const { competition } = pages();
    await page.goto('/competitions');
    await expect(page.getByRole('heading', { level: 1, name: 'Competiciones' })).toBeVisible();
    await expectAccessible(page);
    await page.goto(`/competitions/${competition.competitionId}`);
    await expect(page.getByRole('heading', { level: 1, name: competition.name })).toBeVisible();
    await expectAccessible(page);
    await page.goto(`/competitions/${competition.competitionId}/teams`);
    await expect(page.getByRole('heading', { level: 2, name: /^Equipos asociados/ })).toBeVisible();
    await expectAccessible(page);
    await page
      .getByRole('row', { name: /^Club Alfa / })
      .getByRole('button', { name: /^Editar equipo: Club Alfa / })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Editar equipo' });
    await dialog.getByRole('button', { name: 'Subir escudo' }).click();
    await expect(
      dialog.getByRole('checkbox', { name: 'Confirmo que tengo autorización para usar este escudo.' }),
    ).toBeVisible();
    await expectAccessible(page);
    const season = `/competitions/${competition.competitionId}/seasons/${competition.seasonId}`;
    await page.goto(season);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.goto(`${season}/calendar/rounds/${competition.played.id}`);
    await expect(page.getByText(competition.played.name).first()).toBeVisible();
    await expectAccessible(page);
  });

  test('Datos: file mode with a rejected import, applied import, form mode, import and version', async ({ page }) => {
    await page.goto('/imports');
    await expect(page.getByRole('form', { name: 'Importar un archivo' })).toBeVisible();
    await expectAccessible(page);
    await uploadCsv(page, 'liga-manual-errores.csv', csvWithErrors());
    await expect(page.getByRole('table', { name: '2 errores en la importación' })).toBeVisible();
    await expectAccessible(page);
    await uploadCsv(page, 'liga-manual-a11y-2.csv', VALID_MATCHES_CSV);
    await expect(page.getByRole('region', { name: 'Importación aplicada' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('radio', { name: 'Formulario' }).check();
    const form = page.getByRole('form', { name: 'Introducir datos con el formulario' });
    await expect(form).toBeVisible();
    await expectAccessible(page);
    await form.getByRole('button', { name: 'Importar datos del formulario' }).click();
    await expect(page.getByText(/^Hay \d+ errores? en el formulario$/)).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().importDetail);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.goto(pages().version);
    await expect(page.getByRole('table', { name: 'Partidos' })).toBeVisible();
    await expectAccessible(page);
  });

  test('Mi marca: resources with the upload dialog and a registered asset, and the visual identity', async ({
    page,
  }) => {
    await page.goto('/brand/resources');
    await expect(page.getByRole('heading', { level: 1, name: 'Recursos' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Subir recurso' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Subir un recurso de marca' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await dialog.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Mascota' });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'mascota-sintetica.png',
      mimeType: 'image/png',
      buffer: solidPng(48, 48, [0x1f, 0x4e, 0x8c]),
    });
    await dialog.getByRole('textbox', { name: 'Nombre' }).fill('Mascota sintética de prueba');
    await dialog.getByRole('button', { name: 'Guardar recurso' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('main')).toContainText('Mascota sintética de prueba');
    await expectAccessible(page);
    await page.goto('/brand/identity');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  });

  test('Plantillas: create a template and the engine templates', async ({ page }) => {
    await page.goto('/templates/create');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await page.goto('/templates/engine');
    await expect(page.getByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeVisible();
    await expectAccessible(page);
  });

  test('not-found page', async ({ page }) => {
    await page.goto('/no-existe');
    await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeVisible();
    await expectAccessible(page);
  });

  test('section error page inside a studio route: readable link, visible focus and the way back (UI-06.3)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();
    // The code of the next section fails to load, so the router shows the section error page inside the shell, on
    // the studio surface of /exports.
    const failing = /\/assets\/.*\.js$/;
    await page.route(failing, (route) => route.abort('failed'));
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Exportaciones', exact: true })
      .click();
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'No se pudo mostrar esta sección' })).toBeVisible();
    await expect(main.getByRole('alert')).toBeVisible();
    await expectAccessible(page);
    // The link back: studio link colour and studio focus ring on the dark surface, reached with the keyboard.
    const back = main.getByRole('link', { name: 'Volver a la lista de proyectos' });
    await page.keyboard.press('Tab');
    for (let stop = 0; stop < 10 && !(await back.evaluate((link) => link === document.activeElement)); stop += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(back).toBeFocused();
    const style = await back.evaluate((link) => {
      const computed = getComputedStyle(link);
      return { color: computed.color, outlineColor: computed.outlineColor, outlineStyle: computed.outlineStyle };
    });
    expect(style).toEqual({
      color: 'rgb(176, 198, 255)',
      outlineColor: 'rgb(176, 198, 255)',
      outlineStyle: 'solid',
    });
    await page.unroute(failing);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();
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
  scenarioTest('project page after a failed run', async ({ page, scenarioServer, baseURL }) => {
    scenarioTest.setTimeout(120_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    // The project is created while its source is available; the source then fails for the run.
    await scenarioServer.restart({});
    const project = await createCatalogueProject(page, baseURL, {
      competitionId: 'liga-demo',
      sourceId: 'demo-a',
      seasonId: '2026',
      stageId: 'temporada-regular',
      matchday: 1,
    });
    await scenarioServer.restart({ 'demo-a': 'provider-unavailable' });
    await page.goto(`/projects/${project}`);
    await runToEnd(page, 1, 'fallida');
    await expectAccessible(page);
  });
});
