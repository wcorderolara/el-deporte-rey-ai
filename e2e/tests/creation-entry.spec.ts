/**
 * Content creation entry (PD-ARCH-01E, PD-ARCH-01F; replaces the catalogue journeys of R-200, R-236, R-243, R-283,
 * R-284, whose creation form PD-ARCH-01F retired):
 *
 * - The retired catalogue address opens Crear contenido, which offers only the locally managed competitions: the
 *   DEMO_DATA catalogue competitions are not offered for new content.
 * - Nothing can be generated until competition, season and round are chosen; the plan names every skipped piece and
 *   its reason, and a plan without pieces cannot be confirmed.
 * - A calendar of an upcoming round is generated from the matches not played yet, never presented as played, and the
 *   project is listed in Mis proyectos with its sports context.
 */
import { generateContent, openContentReview, slideNames } from '../support/app.js';
import { seedLocalCompetition } from '../support/local-data.js';
import { expect, test } from '../support/test.js';

test.describe('Content creation entry (PD-ARCH-01F)', () => {
  test('the retired catalogue address opens Crear contenido with the local competitions only', async ({
    page,
    baseURL,
  }) => {
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Entrada' });
    await page.goto('/projects/new');
    await expect(page).toHaveURL(/\/projects\/generate$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Crear contenido' })).toBeVisible();
    const options = page.getByRole('combobox', { name: 'Competición' }).getByRole('option');
    await expect(options.filter({ hasText: competition.name })).toHaveCount(1);
    for (const catalogue of ['Liga Demo', 'Copa Demo', 'Liga Manual Sintética']) {
      await expect(options.filter({ hasText: new RegExp(`^${catalogue}$`) })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('a plan without compatible matches names each skipped piece and cannot be confirmed', async ({
    page,
    baseURL,
  }) => {
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Omitidas' });
    await page.goto('/projects/generate');
    const next = page.getByRole('button', { name: 'Continuar' });
    await page.getByRole('combobox', { name: 'Competición' }).selectOption({ label: competition.name });
    await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ label: competition.seasonLabel });
    await page.getByRole('combobox', { name: 'Jornada' }).selectOption({ label: competition.played.option });
    await next.click();
    await page.getByRole('checkbox', { name: /^Resultados de jornada / }).uncheck();
    await page.getByRole('checkbox', { name: /^Previa individual / }).check();
    await next.click();
    const matches = page.getByRole('region', { name: `3. Partidos de ${competition.played.name}` });
    await expect(matches.getByRole('checkbox')).toHaveCount(2);
    for (const match of await matches.getByRole('checkbox').all()) {
      await expect(match).toHaveAccessibleName(/Finalizado · \d+ - \d+ No está por jugar$/);
    }
    await matches.getByRole('button', { name: 'Seleccionar todos' }).click();
    await next.click();
    await next.click();
    const pieces = page.getByRole('region', { name: 'Piezas' });
    await expect(pieces).toContainText('Se prepararán 0 de 2 piezas solicitadas · 2 omitidas.');
    await expect(pieces.getByRole('listitem')).toHaveCount(2);
    for (const piece of await pieces.getByRole('listitem').all()) {
      await expect(piece).toContainText('El partido ya finalizó; no es un partido por jugar.');
      await expect(piece).toContainText('Omitida');
    }
    await expect(page.getByRole('button', { name: 'Confirmar y generar 0 piezas' })).toBeDisabled();
  });

  test('a calendar of an upcoming round uses the unplayed matches and is listed with its sports context', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    const competition = await seedLocalCompetition(page.request, baseURL, { name: 'Liga Sintética Calendario' });
    const [projectId] = await generateContent(page, competition, competition.upcoming, ['Calendario de jornada']);
    if (projectId === undefined) throw new Error('no project was generated');
    await openContentReview(page, projectId);
    const slides = await slideNames(page);
    expect(slides[0]).toBe('Diapositiva 1: Portada');
    expect(slides).toContain('Diapositiva 2: Resumen de jornada');
    expect(slides.at(-1)).toMatch(/: Cierre$/);
    // Matches not played yet are never presented as results.
    expect(slides.some((slide) => slide.endsWith(': Resultado'))).toBe(false);

    await page.goto('/projects');
    const row = page
      .getByRole('table', { name: 'Proyectos e historial' })
      .getByRole('row')
      .filter({ has: page.locator(`a[href="/projects/${projectId}"]`) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(competition.name);
    await expect(row).toContainText(competition.upcoming.name);
  });
});
