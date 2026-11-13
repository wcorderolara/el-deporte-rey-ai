/**
 * Crear contenido (UI-03, replaced by the sports wizard of PD-ARCH-01E and made the only entry by PD-ARCH-01F): visual
 * evidence of its steps at 1440 px and on a 390 px phone, reflow at 768 and 390 px, and its states without local
 * competitions and with a failed competition list. Screenshots go to `.cache/e2e/evidence/UI-03/`
 * (e2e/support/evidence.ts), never over the accepted evidence under `docs/`.
 */
import type { Page } from '@playwright/test';

import { chooseSportsContext } from '../support/app.js';
import { evidencePath } from '../support/evidence.js';
import { seedLocalCompetition } from '../support/local-data.js';
import { expect, test } from '../support/test.js';

async function noHorizontalScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('Crear contenido steps: visual evidence and reflow at 1440, 768 and 390 px', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  if (baseURL === undefined) throw new Error('baseURL is not configured');
  const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Evidencia' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/generate');
  await expect(page.getByRole('combobox', { name: 'Competición' })).toBeVisible();
  await page.screenshot({ path: evidencePath('UI-03', 'step-1-desktop.png'), fullPage: true });

  await chooseSportsContext(page, competition, competition.played);
  const next = page.getByRole('button', { name: 'Continuar' });
  const steps: readonly [string, string][] = [
    ['2. Tipo de contenido', 'step-2-desktop.png'],
    [`3. Partidos de ${competition.played.name}`, 'step-3-desktop.png'],
    ['4. Plantilla', 'step-4-desktop.png'],
    ['5. Revisión de la generación propuesta', 'step-5-desktop.png'],
  ];
  for (const [region, file] of steps) {
    await next.click();
    await expect(page.getByRole('region', { name: region })).toBeVisible();
    if (region.startsWith('3.')) {
      await page.getByRole('button', { name: 'Seleccionar compatibles' }).click();
    }
    if (region.startsWith('5.')) {
      await expect(page.getByRole('region', { name: 'Piezas' })).toBeVisible();
    }
    await page.screenshot({ path: evidencePath('UI-03', file), fullPage: true });
  }

  // The plan step reflows on a tablet and a phone; going back keeps every choice.
  await page.setViewportSize({ width: 768, height: 1000 });
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalScroll(page);
  await page.screenshot({ path: evidencePath('UI-03', 'step-5-mobile.png'), fullPage: true });
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Anterior' }).click();
  }
  await expect(page.getByRole('combobox', { name: 'Jornada' })).toHaveValue(competition.played.id);
  await noHorizontalScroll(page);
  await page.screenshot({ path: evidencePath('UI-03', 'step-1-mobile.png'), fullPage: true });
});

test('Crear contenido without local competitions, and with a failed competition list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/v1/competitions', (route) => route.fulfill({ json: { competitions: [] } }));
  await page.goto('/projects/generate');
  await expect(page.getByText('No hay competiciones locales')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Competiciones', exact: true })).toHaveAttribute(
    'href',
    '/competitions',
  );
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  await page.screenshot({ path: evidencePath('UI-03', 'no-local-competitions.png'), fullPage: true });
  await page.unrouteAll();

  await page.route('**/api/v1/competitions', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'No disponible', status: 503, code: 'INTERNAL_ERROR' }),
    }),
  );
  await page.goto('/projects/generate');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  await page.screenshot({ path: evidencePath('UI-03', 'competition-list-error.png'), fullPage: true });
});
