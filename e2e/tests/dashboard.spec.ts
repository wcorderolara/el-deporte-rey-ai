import { resolve } from 'node:path';
import { dashboardProjects } from '../support/dashboard-fixtures.js';
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
          await expect(main.getByRole('article')).toHaveCount(4);
          for (const name of ['Continuar', 'Revisar contenido', 'Descargar contenido', 'Ver contenido']) {
            await expect(main.getByRole('link', { name: new RegExp(`^${name}:`) })).toBeVisible();
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
          path: resolve('docs/design/WI-2/evidence/UI-02', `dashboard-${state}-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      } finally {
        release();
      }
    });
  }
}

test('dashboard primary creation action opens the existing form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Crear contenido', exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await expect(page.getByRole('heading', { name: 'Crear contenido' })).toBeVisible();
});
