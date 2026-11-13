/**
 * Responsive layout, reflow and keyboard checks (`@a11y`, UI-06.2; WCAG 2.2 1.4.4, 1.4.10, 1.4.12, 1.4.13, 2.1.1,
 * 2.1.2, 2.4.3, 2.4.7, 2.3.3 as an objective). Every priority screen is opened at 1440 x 900, 1280 x 720, 1024 x 768,
 * 768 x 1024 and 390 x 844, plus 640 x 360 (1280 x 720 at a 200 % zoom) and 320 x 256 (1280 x 1024 at 400 %, the
 * reflow width): the page never scrolls sideways, nothing runs past the bottom of the application frame, and the
 * screen's main control stays available. A panel inside the page may scroll on its own.
 *
 * Specific checks: R-03 (the review preview at 1280 x 720 stays in its column, keeps its proportions and stays the
 * widest column), R-02 (the view tooltips stay inside the window on hover and keyboard focus, and Escape hides them),
 * dialogs (focus inside, Tab kept in, Escape closes and the focus returns), tabs with the arrow keys, the review menu,
 * a visible focus indicator along the tab order, text spacing and reduced motion.
 *
 * Data: synthetic local competition data created through the API and the interface, with the stub writers; the
 * template editor reads a synthetic template served to the browser only (e2e/support/template-fixtures.ts), because a
 * real one needs the paid image provider. Full-page screenshots go to .cache/e2e/evidence/UI-06.2/ (git-ignored).
 */
import type { Locator, Page } from '@playwright/test';

import {
  approveEditorialDeliverable,
  approveReadySlidesInBulk,
  approveSlide,
  chooseSportsContext,
  downloadCarousel,
  generateContent,
  generateEditorialCopy,
  giveFinalApproval,
  openContentReview,
  openEditorialMode,
} from '../support/app.js';
import { evidencePath } from '../support/evidence.js';
import { measureLayout } from '../support/layout.js';
import { seedLocalCompetition, type LocalCompetition } from '../support/local-data.js';
import { solidPng } from '../support/png.js';
import { serveSyntheticTemplate, TEMPLATE_ID } from '../support/template-fixtures.js';
import { expect, guardRequests, test } from '../support/test.js';

interface Size {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

const DESKTOP: Size = { name: '1440x900', width: 1440, height: 900 };
const LAPTOP: Size = { name: '1280x720', width: 1280, height: 720 };
const MOBILE: Size = { name: '390x844', width: 390, height: 844 };

/** The five widths of UI-06.2 with representative heights. */
const WIDTHS: readonly Size[] = [
  DESKTOP,
  LAPTOP,
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  MOBILE,
];

/** 1280 x 720 at a 200 % zoom, and the reflow width (1280 x 1024 at 400 %, WCAG 1.4.10). */
const ZOOMS: readonly Size[] = [
  { name: 'zoom200-640x360', width: 640, height: 360 },
  { name: 'reflow-320x256', width: 320, height: 256 },
];

const SIZES = [...WIDTHS, ...ZOOMS];

/** The studio canvas (`--color-surface-canvas`). */
const STUDIO_CANVAS = 'rgb(13, 11, 22)';

interface Prepared {
  competition: LocalCompetition;
  batch: string;
  /** A project with approved slides and copy, a final approval and an export. */
  exported: string;
  /** A project still to review. */
  pending: string;
  facts: string;
  exportDetail: string;
  trace: string;
}

let prepared: Prepared | null = null;

function data(): Prepared {
  if (prepared === null) throw new Error('the responsive data was not prepared');
  return prepared;
}

/** One screen: how to open it (from the previous screen when `path` is null) and its main control. */
interface Screen {
  readonly name: string;
  readonly path: string | null;
  readonly open?: (page: Page) => Promise<void>;
  readonly main: (page: Page) => Locator;
}

/** Waits until the screen has loaded: no loading message, finished transitions and loaded images. */
async function settle(page: Page): Promise<void> {
  await expect(page.getByText(/^(Cargando|Calculando|Comprobando|Dibujando)/)).toHaveCount(0);
  await expect(page.getByRole('main')).toBeVisible();
  await page.evaluate(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    );
    // Lazy images below the fold never load until scrolled to; the others get a bounded wait.
    const images = [...document.images].filter((image) => !image.complete && image.loading !== 'lazy');
    await Promise.race([
      Promise.allSettled(images.map((image) => image.decode())),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  });
}

/**
 * Opens every screen at every size: no sideways scroll of the page, nothing past the frame, the main control
 * available; a full-page screenshot of each.
 */
async function checkScreens(page: Page, screens: readonly Screen[], sizes: readonly Size[] = SIZES): Promise<void> {
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const screen of screens) {
      await test.step(`${screen.name} at ${size.name}`, async () => {
        if (screen.path !== null) await page.goto(screen.path);
        if (screen.open !== undefined) await screen.open(page);
        await settle(page);
        await expect(screen.main(page).first(), `${screen.name}: main control`).toBeVisible();
        const layout = await measureLayout(page);
        expect(layout.horizontalOverflow, `${screen.name} at ${size.name}: sideways scroll`).toBe(0);
        expect(layout.offenders, `${screen.name} at ${size.name}: past the window edge`).toEqual([]);
        expect(layout.belowFrame, `${screen.name} at ${size.name}: past the application frame`).toEqual([]);
        await page.screenshot({ path: evidencePath(`UI-06.2/${size.name}`, `${screen.name}.png`), fullPage: true });
      });
    }
  }
}

/** The box of `locator` (it must be rendered). */
async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const value = await locator.boundingBox();
  if (value === null) throw new Error('the element is not rendered');
  return value;
}

/** The element with the focus: its accessible description for the report, and whether it shows a focus indicator. */
async function focusState(page: Page): Promise<{ name: string; indicator: boolean; visible: boolean }> {
  return page.evaluate(async () => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return { name: 'body', indicator: true, visible: true };
    }
    // The focus colours are read once their transitions have finished.
    await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
    const ring = style.boxShadow !== 'none';
    // The menu options and the navigation entries mark the focus with a gold edge instead of the ring.
    const edge = parseFloat(style.borderLeftWidth) >= 2 && style.borderLeftColor !== 'rgba(0, 0, 0, 0)';
    const rect = element.getBoundingClientRect();
    const name =
      element.getAttribute('aria-label') ??
      (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50) ??
      element.tagName;
    return {
      name: `${element.tagName.toLowerCase()} «${name}»`,
      indicator: outline || ring || edge,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden',
    };
  });
}

test.describe('Responsive layout and keyboard @a11y', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const baseURL = process.env['E2E_BASE_URL'];
    if (baseURL === undefined || baseURL === '') throw new Error('E2E_BASE_URL is not set');
    const context = await browser.newContext({ baseURL, locale: 'es-GT', timezoneId: 'America/Guatemala' });
    const blocked = await guardRequests(context, new URL(baseURL).origin);
    const page = await context.newPage();
    try {
      const competition = await seedLocalCompetition(page.request, baseURL, {
        name: 'Liga Sintética Responsive',
        badges: true,
      });
      const [exported] = await generateContent(page, competition, competition.played);
      if (exported === undefined) throw new Error('no project was generated');
      const batch = new URL(page.url()).pathname;
      await page.goto(`/projects/${exported}`);
      await page.getByText('Más opciones del proyecto', { exact: true }).click();
      const facts = await page
        .getByRole('link', { name: /^Datos y verificación \(ejecución 1\)$/ })
        .getAttribute('href');
      await openContentReview(page, exported);
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
      const [pending] = await generateContent(page, competition, competition.played);
      if (pending === undefined) throw new Error('no second project was generated');
      // A synthetic brand resource, so that the Mi marca library shows its table and cards views (once: the data
      // is prepared again on the same server after a failure).
      await page.goto('/brand/resources');
      await expect(page.getByRole('heading', { level: 1, name: 'Recursos' })).toBeVisible();
      await expect(page.getByText(/^Cargando/)).toHaveCount(0);
      if ((await page.getByText('Mascota sintética de prueba').count()) === 0) {
        await page.getByRole('button', { name: 'Subir recurso' }).first().click();
        const upload = page.getByRole('dialog', { name: 'Subir un recurso de marca' });
        await upload.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Mascota' });
        await upload.locator('input[type="file"]').setInputFiles({
          name: 'mascota-sintetica.png',
          mimeType: 'image/png',
          buffer: solidPng(48, 48, [0x1f, 0x4e, 0x8c]),
        });
        await upload.getByRole('textbox', { name: 'Nombre' }).fill('Mascota sintética de prueba');
        await upload.getByRole('button', { name: 'Guardar recurso' }).click();
        await expect(upload).toBeHidden();
      }
      prepared = {
        competition,
        batch,
        exported: `/projects/${exported}`,
        pending: `/projects/${pending}`,
        facts: facts ?? '',
        exportDetail,
        trace: `${exportDetail}/slides/2/trace`,
      };
      expect(blocked, 'requests to an origin other than the application under test').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('Inicio, Mis proyectos, a project, every step of Crear contenido and the generation result', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const { competition, exported, batch } = data();
    const next = (page: Page) => page.getByRole('button', { name: 'Continuar' });
    await checkScreens(page, [
      { name: 'inicio', path: '/', main: (page) => page.getByRole('table', { name: 'Proyectos e historial' }) },
      {
        name: 'proyectos',
        path: '/projects',
        main: (page) => page.getByRole('table', { name: 'Proyectos e historial' }),
      },
      {
        name: 'proyecto',
        path: exported,
        main: (page) =>
          page.getByRole('region', { name: 'Contenido generado' }).getByRole('button', { name: 'Descargar carrusel' }),
      },
      {
        name: 'crear-1-competicion',
        path: '/projects/generate',
        main: (page) => page.getByRole('combobox', { name: 'Competición' }),
      },
      {
        name: 'crear-1-jornada',
        path: null,
        open: (page) => chooseSportsContext(page, competition, competition.upcoming),
        main: next,
      },
      {
        name: 'crear-2-tipo',
        path: null,
        open: async (page) => {
          await next(page).click();
          await expect(page.getByRole('region', { name: '2. Tipo de contenido' })).toBeVisible();
          await page.getByRole('checkbox', { name: /^Resultados de jornada / }).uncheck();
          await page.getByRole('checkbox', { name: /^Calendario de jornada / }).check();
        },
        main: next,
      },
      {
        name: 'crear-3-partidos',
        path: null,
        open: async (page) => {
          await next(page).click();
          await page.getByRole('button', { name: 'Seleccionar compatibles' }).click();
        },
        main: next,
      },
      {
        name: 'crear-4-plantilla',
        path: null,
        open: async (page) => {
          await next(page).click();
          await expect(page.getByRole('region', { name: '4. Plantilla' })).toBeVisible();
        },
        main: next,
      },
      {
        name: 'crear-5-revision',
        path: null,
        open: async (page) => {
          await next(page).click();
          await expect(page.getByRole('region', { name: 'Piezas' })).toBeVisible();
        },
        main: (page) => page.getByRole('button', { name: /^Confirmar y generar \d+ piezas?$/ }),
      },
      { name: 'resultado-generacion', path: batch, main: (page) => page.getByRole('link', { name: 'Abrir proyecto' }) },
    ]);
  });

  test('content review in both modes, before and after the final approval', async ({ page }) => {
    test.setTimeout(600_000);
    const { pending, exported } = data();
    await checkScreens(page, [
      {
        name: 'revision-diseno',
        path: `${pending}/review`,
        main: (page) => page.getByRole('button', { name: 'Aprobar diapositiva' }),
      },
      {
        name: 'revision-copy',
        path: null,
        open: async (page) => {
          await openEditorialMode(page);
        },
        main: (page) => page.getByRole('button', { name: 'Generar copy editorial' }),
      },
      {
        name: 'revision-aprobada',
        path: `${exported}/review`,
        main: (page) =>
          page.getByRole('region', { name: 'Aprobación final' }).getByRole('button', { name: 'Descargar carrusel' }),
      },
      {
        name: 'revision-aprobada-copy',
        path: null,
        open: async (page) => {
          await openEditorialMode(page);
        },
        main: (page) => page.getByRole('tablist', { name: 'Entregables del copy editorial' }),
      },
    ]);
  });

  test('R-03: at 1280 x 720 the review preview stays in its column, keeps its proportions and stays the protagonist', async ({
    page,
  }) => {
    const { pending } = data();
    for (const size of [DESKTOP, LAPTOP]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`${pending}/review`);
      await settle(page);
      const preview = page.getByRole('region', { name: 'Vista previa: Diapositiva 1: Portada' });
      const panel = page.getByRole('tabpanel', { name: /^Diseño visual/ });
      const inspector = page.getByRole('region', { name: 'Estado y acciones: Diapositiva 1: Portada' });
      const rail = page.getByRole('navigation', { name: 'Diapositivas del carrusel' });
      const caption = preview.getByText(/^1080 × 1350 px · Versión 1$/);
      const image = preview.getByRole('img', { name: /^Imagen de Diapositiva 1: Portada/ });
      await expect(caption).toBeVisible();
      const previewBox = await box(preview);
      const panelBox = await box(panel);
      const inspectorBox = await box(inspector);
      const railBox = await box(rail);
      const captionBox = await box(caption);
      const imageBox = await box(image);
      // In its column: the preview, its image and its caption end inside the workspace, which ends inside the frame.
      expect(previewBox.y + previewBox.height, size.name).toBeLessThanOrEqual(panelBox.y + panelBox.height + 0.5);
      expect(captionBox.y + captionBox.height, size.name).toBeLessThanOrEqual(previewBox.y + previewBox.height);
      expect(imageBox.y + imageBox.height, size.name).toBeLessThanOrEqual(captionBox.y);
      const layout = await measureLayout(page);
      expect(layout.belowFrame, size.name).toEqual([]);
      expect(layout.horizontalOverflow, size.name).toBe(0);
      // Its proportions: the image is fitted whole (object-fit: contain) and the slide is 4:5.
      expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('contain');
      expect(
        await image.evaluate((element: HTMLImageElement) => element.naturalWidth / element.naturalHeight),
      ).toBeCloseTo(0.8, 2);
      // The protagonist: the widest column, with a usable height.
      expect(previewBox.width, size.name).toBeGreaterThan(inspectorBox.width);
      expect(previewBox.width, size.name).toBeGreaterThan(railBox.width);
      expect(imageBox.height, size.name).toBeGreaterThanOrEqual(320);
      // The surface under the caption is the studio's, never the white of the document.
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(STUDIO_CANVAS);
      await page.screenshot({ path: evidencePath('UI-06.2/R-03', `revision-${size.name}.png`) });
    }
  });

  test('Exportaciones, an export, the trace of an exported slide and Datos y verificación', async ({ page }) => {
    test.setTimeout(600_000);
    const { exportDetail, trace, facts } = data();
    await checkScreens(page, [
      {
        name: 'exportaciones',
        path: '/exports',
        main: (page) => page.getByRole('list', { name: 'Historial de exportaciones' }),
      },
      {
        name: 'exportacion',
        path: exportDetail,
        main: (page) => page.getByRole('heading', { level: 1, name: 'Carrusel exportado' }),
      },
      {
        name: 'trazabilidad',
        path: trace,
        main: (page) => page.getByRole('region', { name: 'Datos de la diapositiva' }),
      },
      {
        name: 'datos-y-verificacion',
        path: facts,
        main: (page) => page.getByRole('heading', { level: 1, name: 'Datos y verificación' }),
      },
    ]);
  });

  test('Competiciones: list, competition, teams, season, participants, calendar and round with its matches', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const { competition } = data();
    const competitionPath = `/competitions/${competition.competitionId}`;
    const season = `${competitionPath}/seasons/${competition.seasonId}`;
    await checkScreens(page, [
      {
        name: 'competiciones',
        path: '/competitions',
        main: (page) => page.getByRole('button', { name: 'Crear competición' }),
      },
      {
        name: 'competicion',
        path: competitionPath,
        main: (page) => page.getByRole('button', { name: 'Crear temporada' }),
      },
      {
        name: 'equipos',
        path: `${competitionPath}/teams`,
        main: (page) => page.getByRole('button', { name: /^Editar equipo: / }),
      },
      { name: 'temporada', path: season, main: (page) => page.getByRole('heading', { level: 1 }) },
      {
        name: 'participantes',
        path: `${season}/participants`,
        main: (page) => page.getByRole('heading', { level: 1 }),
      },
      { name: 'calendario', path: `${season}/calendar`, main: (page) => page.getByRole('heading', { level: 1 }) },
      {
        name: 'jornada-partidos',
        path: `${season}/calendar/rounds/${competition.played.id}`,
        main: (page) => page.getByRole('button', { name: 'Agregar partido' }),
      },
    ]);
  });

  test('Datos, Mi marca, Plantillas, the template editor and the not-found page', async ({ page }) => {
    test.setTimeout(600_000);
    await serveSyntheticTemplate(page);
    await checkScreens(page, [
      { name: 'datos', path: '/imports', main: (page) => page.getByRole('form', { name: 'Importar un archivo' }) },
      {
        name: 'mi-marca-recursos',
        path: '/brand/resources',
        main: (page) => page.getByRole('button', { name: 'Subir recurso' }),
      },
      { name: 'mi-marca-identidad', path: '/brand/identity', main: (page) => page.getByRole('heading', { level: 1 }) },
      { name: 'plantillas-crear', path: '/templates/create', main: (page) => page.getByRole('heading', { level: 1 }) },
      {
        name: 'plantillas-motor',
        path: '/templates/engine',
        main: (page) => page.getByRole('heading', { level: 1, name: 'Plantillas del motor' }),
      },
      {
        name: 'editor-de-plantillas',
        path: `/templates/visual/${TEMPLATE_ID}`,
        main: (page) => page.getByRole('group', { name: 'Lienzo de la plantilla' }),
      },
      {
        name: 'editor-capas-y-propiedades',
        path: null,
        open: async (page) => {
          // The layers and properties panels open, with a layer selected.
          const expand = page.getByRole('button', { name: /^Mostrar (las )?capas/ });
          if ((await expand.count()) > 0) await expand.click();
          await page
            .getByRole('list', { name: 'Capas' })
            .getByRole('button', { name: /Equipo local/ })
            .first()
            .click();
        },
        main: (page) => page.getByRole('heading', { level: 2, name: 'Propiedades' }),
      },
      {
        name: 'editor-vista-previa',
        path: null,
        open: async (page) => {
          await page.getByRole('tab', { name: 'Vista previa' }).click();
        },
        main: (page) => page.getByRole('tabpanel', { name: 'Vista previa' }),
      },
      {
        name: 'no-encontrada',
        path: '/no-existe',
        main: (page) => page.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
      },
    ]);
  });

  test('R-02: the view tooltips stay inside the window on hover and keyboard focus, and Escape hides them', async ({
    page,
  }) => {
    test.setTimeout(480_000);
    const { competition } = data();
    const pages = [
      '/',
      '/projects',
      '/competitions',
      `/competitions/${competition.competitionId}/teams`,
      '/brand/resources',
    ];
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const path of pages) {
        await page.goto(path);
        await settle(page);
        const group = page.getByRole('group', { name: 'Formato de visualización' }).first();
        await group.scrollIntoViewIfNeeded();
        for (const name of ['Vista de tabla', 'Vista de tarjetas']) {
          const control = group.getByRole('button', { name });
          const tooltip = page.getByRole('tooltip', { name });
          for (const show of ['focus', 'hover'] as const) {
            if (show === 'focus') {
              await control.focus();
            } else {
              await page.mouse.move(0, 0);
              await control.hover();
            }
            await expect(tooltip, `${path} ${name} ${show} at ${size.name}`).toBeVisible();
            const tip = await box(tooltip);
            const width = await page.evaluate(() => document.documentElement.clientWidth);
            expect(tip.x, `${path} ${name} ${show} at ${size.name}`).toBeGreaterThanOrEqual(0);
            expect(tip.x + tip.width, `${path} ${name} ${show} at ${size.name}`).toBeLessThanOrEqual(width);
            expect((await measureLayout(page)).horizontalOverflow, `${path} ${name} ${show} at ${size.name}`).toBe(0);
            if (show === 'focus') {
              await page.keyboard.press('Escape');
              await expect(tooltip).toBeHidden();
              await expect(control).toBeFocused();
              await control.blur();
            } else {
              await page.mouse.move(0, 0);
              await expect(tooltip).toBeHidden();
            }
          }
        }
        if (size.name === '768x1024' && path === '/') {
          await group.getByRole('button', { name: 'Vista de tarjetas' }).focus();
          await page.screenshot({ path: evidencePath('UI-06.2/R-02', 'inicio-768-tooltip.png') });
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('dialogs keep the focus inside, close with Escape and give the focus back, at 1280 and 390 px', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const { competition, pending } = data();
    const dialogs: { name: string; path: string; open: (page: Page) => Locator; dialog: string }[] = [
      {
        name: 'subir-recurso',
        path: '/brand/resources',
        open: (page) => page.getByRole('button', { name: 'Subir recurso' }).first(),
        dialog: 'Subir un recurso de marca',
      },
      {
        name: 'editar-equipo',
        path: `/competitions/${competition.competitionId}/teams`,
        open: (page) => page.getByRole('button', { name: /^Editar equipo: / }).first(),
        dialog: 'Editar equipo',
      },
      {
        name: 'aprobacion-masiva',
        path: `${pending}/review`,
        open: (page) => page.getByRole('button', { name: /^Aprobar todas \(\d+\)$/ }),
        dialog: 'Confirmar aprobación de diapositivas',
      },
    ];
    for (const size of [LAPTOP, MOBILE]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const entry of dialogs) {
        await page.goto(entry.path);
        await settle(page);
        const trigger = entry.open(page);
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: entry.dialog });
        await expect(dialog, `${entry.name} at ${size.name}`).toBeVisible();
        // The focus is inside, and Tab and Shift+Tab never leave the dialog.
        await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
          await page.keyboard.press(key);
          expect(
            await dialog.evaluate((element) => element.contains(document.activeElement)),
            `${entry.name} ${key}`,
          ).toBe(true);
          const focus = await focusState(page);
          expect(focus.indicator, `${entry.name} at ${size.name}: ${focus.name}`).toBe(true);
        }
        // It fits the window and the page does not scroll sideways.
        const dialogBox = await box(dialog);
        expect(dialogBox.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(size.width);
        expect((await measureLayout(page)).horizontalOverflow).toBe(0);
        await page.screenshot({ path: evidencePath(`UI-06.2/dialogos`, `${entry.name}-${size.name}.png`) });
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger, `${entry.name} at ${size.name}: focus back on its control`).toBeFocused();
      }
    }
  });

  test('tabs move with the arrow keys, the review menu closes with Escape, and the focus is always visible', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const { exported } = data();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${exported}/review`);
    await settle(page);
    // Review modes (WAI-ARIA tabs): the arrows move and select, the panel follows.
    const modes = page.getByRole('tablist', { name: 'Modo de revisión' });
    const design = modes.getByRole('tab', { name: /^Diseño visual/ });
    const copy = modes.getByRole('tab', { name: /^Copy editorial/ });
    await design.focus();
    await page.keyboard.press('ArrowRight');
    await expect(copy).toBeFocused();
    await expect(copy).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Copy editorial' })).toBeVisible();
    // The deliverables of the copy, the same way.
    const deliverables = page.getByRole('tablist', { name: 'Entregables del copy editorial' });
    const first = deliverables.getByRole('tab').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(deliverables.getByRole('tab').nth(1)).toBeFocused();
    await expect(deliverables.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(first).toBeFocused();
    await copy.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(design).toHaveAttribute('aria-selected', 'true');
    // The review menu: Enter opens it on its first action, Escape closes it and returns the focus.
    const menuButton = page
      .getByRole('region', { name: 'Aprobación final' })
      .getByRole('button', { name: 'Más opciones' });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Más opciones' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    expect((await focusState(page)).indicator).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    // Along the tab order of the review, the creation and Mi marca, every control shows its focus and is visible.
    for (const path of [`${exported}/review`, '/projects/generate', '/brand/resources', '/competitions']) {
      for (const size of [LAPTOP, MOBILE]) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(path);
        await settle(page);
        await page.locator('body').focus();
        const order: string[] = [];
        for (let index = 0; index < 40; index += 1) {
          await page.keyboard.press('Tab');
          const focus = await focusState(page);
          order.push(focus.name);
          expect(focus.visible, `${path} at ${size.name}, stop ${String(index + 1)}: ${focus.name}`).toBe(true);
          expect(focus.indicator, `${path} at ${size.name}, stop ${String(index + 1)}: ${focus.name}`).toBe(true);
        }
        // The first stop is the skip link, then the shell, then the page.
        expect(order[0], path).toContain('Saltar al contenido');
      }
    }
  });

  test('text spacing (WCAG 1.4.12) and reduced motion keep the screens usable', async ({ page }) => {
    test.setTimeout(240_000);
    const { pending, exportDetail } = data();
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const path of [
      '/',
      `${pending}/review`,
      exportDetail,
      '/competitions',
      '/brand/resources',
      '/projects/generate',
    ]) {
      await page.goto(path);
      await settle(page);
      // The WCAG 1.4.12 values, as a constructed style sheet: the CSP refuses inline styles, not the CSSOM.
      await page.evaluate(() => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } ' +
            'p { margin-bottom: 2em !important; }',
        );
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      });
      const layout = await measureLayout(page);
      expect(layout.horizontalOverflow, `${path}: text spacing`).toBe(0);
      expect(layout.offenders, `${path}: text spacing`).toEqual([]);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${pending}/review`);
    await settle(page);
    const moving = await page.evaluate(
      () =>
        [...document.querySelectorAll('body *')]
          .map((element) => getComputedStyle(element))
          .filter(
            (style) =>
              style.animationName !== 'none' ||
              style.transitionDuration.split(',').some((duration) => parseFloat(duration) > 0),
          ).length,
    );
    expect(moving, 'animated or transitioning elements with reduced motion').toBe(0);
  });
});
