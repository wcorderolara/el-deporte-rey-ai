import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

import { expect, test } from '../support/test.js';

const evidence = join(process.cwd(), 'docs/design/WI-2/evidence/UI-03');

async function chooseDemoScope(page: Page) {
  await page.goto('/projects/new');
  await expect(page.getByRole('group', { name: 'Competición' })).toBeVisible();
  await page.getByRole('radio', { name: /^Copa Demo/ }).check();
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ index: 1 });
  await page.getByRole('radio', { name: 'Octavos de Final', exact: true }).check();
  await page.getByRole('combobox', { name: 'Jornada' }).selectOption({ label: 'Jornada 1' });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: '¿Cómo quieres preparar los datos?' })).toBeVisible();
}

test('UI-03 guided creation visual evidence', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/new');
  await expect(page.getByRole('group', { name: 'Competición' })).toBeVisible();
  await page.screenshot({ path: join(evidence, 'step-1-desktop.png'), fullPage: true });

  await chooseDemoScope(page);
  await page.screenshot({ path: join(evidence, 'step-2-desktop.png'), fullPage: true });
  await expect(page.getByRole('link', { name: 'Abrir importaciones manuales' })).toBeVisible();
  await page.screenshot({ path: join(evidence, 'manual-data-entry-path.png'), fullPage: true });

  await page.setViewportSize({ width: 768, height: 1000 });
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 390, height: 1400 });
  await page.screenshot({ path: join(evidence, 'step-2-mobile.png') });
  await page.getByRole('button', { name: 'Volver a definir' }).click();
  await page.screenshot({ path: join(evidence, 'step-1-mobile.png') });
});

test('UI-03 automatic data availability, empty catalogue, and catalogue error evidence', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.route('**/api/v1/catalog/competitions', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      competitions: { name: string; sources: { mode: string; selectable: boolean }[] }[];
      sources: { mode: string }[];
    };
    const firstCompetition = body.competitions.find((candidate) => candidate.name === 'Copa Demo');
    const firstSource = firstCompetition?.sources.find((candidate) => candidate.selectable);
    if (firstSource) firstSource.mode = 'LIVE_DATA';
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await chooseDemoScope(page);
  await expect(page.getByRole('radio', { name: /Obtener resultados automáticamente/ })).toBeVisible();
  await page.screenshot({ path: join(evidence, 'automatic-data-available.png'), fullPage: true });
  await page.unrouteAll();

  await page.route('**/api/v1/catalog/competitions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ competitions: [], sources: [] }),
    }),
  );
  await page.goto('/projects/new');
  await expect(page.getByText('Ninguna fuente configurada ofrece competiciones en este momento.')).toBeVisible();
  await page.screenshot({ path: join(evidence, 'empty-catalogue.png'), fullPage: true });
  await page.unrouteAll();

  await page.route('**/api/v1/catalog/competitions', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'No disponible', status: 503, code: 'INTERNAL_ERROR' }),
    }),
  );
  await page.goto('/projects/new');
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo de competiciones');
  await page.screenshot({ path: join(evidence, 'catalogue-api-error.png'), fullPage: true });
});
