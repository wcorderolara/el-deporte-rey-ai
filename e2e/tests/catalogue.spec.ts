/**
 * Catalogue and project creation (R-200, R-236, R-243, R-269, R-283, R-284, R-290) on the suite server (DEMO_DATA
 * fixture sources demo-a and demo-b, MANUAL_DATA source "Operator import", stub AI provider).
 *
 * - The catalogue offers both fixture competitions with their sources and lists the manual source.
 * - A league competition lists numbered matchdays; a stage-based competition lists its stages by the source's names,
 *   in the source's order, including the stages after the league phase; stages without standings say so.
 * - No project can be created until competition, source, season and stage (and matchday) are chosen.
 * - Projects appear in the list with their source, mode, demonstration label and language, and keep their own
 *   language; a knockout-stage project drafts in its language and has no standings slide.
 */
import type { Page } from '@playwright/test';

import { createProject, elementNames, fillProjectForm, openReview, runToEnd } from '../support/app.js';
import { expect, test } from '../support/test.js';

/** Row of the project list whose title links to the project. */
function projectRow(page: Page, projectId: string) {
  return page
    .getByRole('table', { name: 'Proyectos e historial' })
    .getByRole('row')
    .filter({ has: page.locator(`a[href="/projects/${projectId}"]`) });
}

test.describe('Catalogue and project creation', () => {
  test('the catalogue shows both fixture competitions, their sources and the manual source', async ({ page }) => {
    await page.goto('/projects/new');
    const sources = page.getByRole('region', { name: 'Fuentes de datos del catálogo' });
    await expect(sources.getByRole('listitem').filter({ hasText: 'Synthetic source A' })).toContainText(
      'Datos de demostración',
    );
    await expect(sources.getByRole('listitem').filter({ hasText: 'Synthetic source B' })).toContainText(
      'Datos de demostración',
    );
    await expect(sources.getByRole('listitem').filter({ hasText: 'Operator import' })).toContainText('Datos manuales');

    const competitions = page.getByRole('group', { name: 'Competición' });
    await expect(competitions.getByRole('radio', { name: /^Copa Demo \(Continente Sintético\)/ })).toBeVisible();
    await expect(competitions.getByRole('radio', { name: /^Liga Demo \(País Sintético\)/ })).toBeVisible();
    const copa = competitions.getByRole('listitem').filter({ has: page.getByRole('radio', { name: /^Copa Demo/ }) });
    await expect(copa.getByRole('listitem')).toHaveText([
      /Synthetic source A\s*Datos de demostración/,
      /Synthetic source B\s*Datos de demostración/,
    ]);
  });

  test('a league matchday project shows its selection, source, mode and demonstration label (R-200, R-243, R-269)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await fillProjectForm(page, {
      competition: /^Liga Demo/,
      season: '2026/27 (actual)',
      stage: 'Temporada Regular',
      matchday: 'Jornada 1',
    });
    // Seasons and matchdays offered are only those the source has (R-243, R-283).
    await expect(page.getByRole('combobox', { name: 'Temporada' }).locator('option')).toHaveText([
      'Elija una temporada',
      '2026/27 (actual)',
    ]);
    await expect(page.getByRole('group', { name: 'Fase' }).getByRole('radio')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: 'Jornada' }).locator('option')).toHaveText([
      'Elija una jornada',
      'Jornada 1',
      'Jornada 2',
      'Jornada 3',
    ]);
    // The default content language is Spanish (R-236).
    await expect(page.getByRole('combobox', { name: 'Idioma del contenido' }).locator('option:checked')).toHaveText(
      'Español',
    );
    const sourceGroup = page.getByRole('group', { name: 'Fuente de datos' });
    await expect(sourceGroup.getByRole('radio', { name: 'Synthetic source A Datos de demostración' })).toBeChecked();

    await page.getByRole('button', { name: 'Crear proyecto' }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    const projectId = new URL(page.url()).pathname.split('/')[2] ?? '';

    const title = 'Liga Demo 2026/27 · Temporada Regular · Jornada 1';
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('note', { name: 'Contenido de demostración' })).toContainText(
      'No son datos reales y no deben publicarse.',
    );
    const selection = page.getByRole('region', { name: 'Selección' });
    const definitions: [string, string][] = [
      ['Competición', 'Liga Demo'],
      ['Temporada', '2026/27'],
      ['Fase', 'Temporada Regular'],
      ['Jornada', 'Jornada 1'],
      ['Fuente de datos', 'Synthetic source A'],
      ['Modo de datos', 'Datos de demostración'],
    ];
    for (const [term, value] of definitions) {
      await expect(selection.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]')).toHaveText(
        value,
      );
    }

    await page.getByRole('link', { name: 'Volver a la lista de proyectos' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeVisible();
    const row = projectRow(page, projectId);
    await expect(row.getByRole('rowheader')).toHaveText(title);
    await expect(row.getByRole('cell')).toHaveText([
      /^Liga Demo\s*2026\/27$/,
      'Temporada Regular · Jornada 1',
      /Synthetic source A\s*Datos de demostración/,
      /^\W*Demostración$/,
      'Español',
      'Sin borrador',
      'Sin exportaciones',
    ]);

    // Opening the project from the list shows its competition, season and matchday (R-200).
    await row.getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Ejecución' }).getByRole('status').first()).toHaveText(
      'El proyecto todavía no tiene ejecuciones.',
    );
  });

  test('a knockout stage project: stages by the source names, standings not available, no standings slide, English drafting (R-236, R-283, R-284)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto('/projects/new');
    await page.getByRole('radio', { name: /^Copa Demo/ }).check();
    await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ label: '2025/26 (actual)' });
    const stages = page.getByRole('group', { name: 'Fase' });
    // Every stage the source reports, by its own names and in its order, including those after the league phase.
    const expectedStages = [
      'Fase de Liga',
      'Eliminatoria Previa',
      'Octavos de Final',
      'Cuartos de Final',
      'Semifinales',
      'Final',
    ];
    await expect(stages.getByRole('radio')).toHaveCount(expectedStages.length);
    for (const [index, name] of expectedStages.entries()) {
      await expect(stages.getByRole('radio').nth(index)).toHaveAccessibleName(name);
    }
    const stageItem = (name: string) =>
      stages.getByRole('listitem').filter({ has: page.getByRole('radio', { name, exact: true }) });
    await expect(stageItem('Fase de Liga')).toContainText('Con clasificación');
    for (const name of ['Eliminatoria Previa', 'Octavos de Final', 'Cuartos de Final', 'Semifinales', 'Final']) {
      await expect(stageItem(name)).toContainText(
        'Sin clasificación: la fuente no ofrece clasificación para esta fase; el contenido no incluirá diapositivas de clasificación.',
      );
    }
    await expect(stageItem('Final')).toContainText('Sin jornadas numeradas · Se puede elegir completa');

    const projectId = await createProject(page, {
      competition: /^Copa Demo/,
      season: '2025/26 (actual)',
      stage: 'Octavos de Final',
      matchday: 'Jornada 1',
      language: 'Inglés',
    });
    await expect(page.getByRole('combobox', { name: 'Idioma', exact: true }).locator('option:checked')).toHaveText(
      'Inglés',
    );
    await runToEnd(page, 1);

    // Facts: matches and results, and the statement that the stage has no standings (no table invented).
    await page.getByRole('link', { name: 'Datos y verificación (ejecución 1)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeVisible();
    await expect(page.getByText('Clasificación no disponible: Esta fase no tiene clasificación.')).toBeVisible();
    await expect(page.getByText('No hay filas de clasificación en esta ejecución.')).toBeVisible();
    await expect(page.getByRole('region', { name: /^Partido: / }).first()).toBeVisible();

    // Carousel without a standings slide, drafted in English (template text), labelled as demonstration.
    await openReview(page, projectId);
    await expect(
      page.getByText(
        'Este borrador no incluye diapositivas de clasificación porque la selección no tiene clasificación.',
        { exact: false },
      ),
    ).toBeVisible();
    const names = await elementNames(page);
    expect(names[0]).toBe('Diapositiva 1: Portada');
    expect(names.filter((name) => name.endsWith(': Clasificación'))).toEqual([]);
    expect(names.filter((name) => name.endsWith(': Resultado')).length).toBeGreaterThan(0);
    expect(names.at(-2)).toMatch(/: Cierre$/);
    expect(names.at(-1)).toBe('Texto de publicación y hashtags');
    await expect(page.getByRole('note', { name: 'Contenido de demostración' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Borrador', exact: true })).toContainText('Inglés');
    await expect(page.getByRole('region', { name: 'Texto: Diapositiva 2: Resultado' })).toContainText(/Full time/);

    // The list keeps each project's own language (R-236).
    await page.goto('/');
    const row = projectRow(page, projectId);
    await expect(row.getByRole('rowheader')).toHaveText('Copa Demo 2025/26 · Octavos de Final · Matchday 1');
    await expect(row.getByRole('cell').nth(4)).toHaveText('Inglés');
    await expect(row.getByRole('cell').nth(3)).toHaveText(/^\W*Demostración$/);
  });
});
