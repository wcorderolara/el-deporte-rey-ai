/**
 * Inicio (UI-02, as changed by UI-05B and PD-ARCH-01F): the populated, empty, loading and failed states of the project
 * library at 1440, 768 and 390 px, from synthetic list responses, with axe and reflow checks. The library opens as a
 * table with the same accessible actions as the cards view. Screenshots go to `.cache/e2e/evidence/UI-02/`
 * (e2e/support/evidence.ts), never over the accepted evidence under `docs/`.
 */
import { dashboardProjects } from '../support/dashboard-fixtures.js';
import { evidencePath } from '../support/evidence.js';
import { axeScan, expect, test } from '../support/test.js';

for (const width of [1440, 768, 390]) {
  for (const state of ['projects', 'empty', 'loading', 'error'] as const) {
    test(`creator dashboard ${state} ${width}px @a11y`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      let release: () => void = () => {};
      const pending = new Promise<void>((done) => {
        release = done;
      });
      await page.route('**/api/v1/projects', async (route) => {
        if (state === 'loading') await pending;
        if (state === 'error') await route.fulfill({ status: 502, body: 'Bad Gateway' });
        else await route.fulfill({ json: { projects: state === 'projects' ? dashboardProjects : [] } });
      });
      try {
        await page.goto('/');
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Tu próximo contenido empieza aquí');
        if (state === 'projects') {
          const table = main.getByRole('table', { name: 'Proyectos e historial' });
          await expect(table.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(4);
          for (const project of dashboardProjects) {
            await expect(table.getByRole('link', { name: `Ver contenido: ${project.title}` })).toBeVisible();
            await expect(table.getByRole('button', { name: `Eliminar: ${project.title}` })).toBeVisible();
          }
          await page.evaluate(() => document.fonts.ready);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect(await axeScan(page)).toEqual([]);
          // The cards view: one article per project, with the same accessible actions.
          await main.getByRole('button', { name: 'Vista de tarjetas' }).click();
          await expect(main.getByRole('article')).toHaveCount(4);
          // The toggle keeps the focus and the pointer, so its tooltip is shown: it stays inside the window
          // (R-02, corrected in UI-06.2) and the page does not scroll sideways with it.
          await expect(page.getByRole('tooltip', { name: 'Vista de tarjetas' })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          for (const project of dashboardProjects) {
            await expect(main.getByRole('link', { name: `Ver contenido: ${project.title}` })).toBeVisible();
          }
        } else if (state === 'empty')
          await expect(main.getByRole('heading', { name: 'Todavía no has creado contenido' })).toBeVisible();
        else if (state === 'error') {
          await expect(main.getByRole('alert')).toContainText('código 502');
          await expect(main.getByRole('button', { name: 'Reintentar' })).toBeVisible();
        } else await expect(main.getByText('Cargando proyectos…')).toBeVisible();
        if (state !== 'projects') await expect(main.getByRole('article')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await axeScan(page)).toEqual([]);
        await page.screenshot({
          path: evidencePath('UI-02', `dashboard-${state}-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      } finally {
        release();
      }
    });
  }
}

test('dashboard primary creation action opens Crear contenido (PD-ARCH-01F)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Crear contenido', exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects\/generate$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Crear contenido' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Competición' })).toBeVisible();
});
