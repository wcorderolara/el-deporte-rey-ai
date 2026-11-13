/**
 * Manual import journey (R-206, R-243, R-269, R-272, R-276, R-290) on the suite server, whose configuration marks no
 * catalogue link with `noAcceptedPublicSource` (PD-17):
 *
 * - a CSV with errors in three rows is rejected whole, with every error named by row and field; nothing is stored;
 * - the corrected file (the committed synthetic sample) is applied and its selections get versions;
 * - a selection entered through the form becomes a new version of that selection; the versions are listed;
 * - a catalogue project for the imported competition (created through the API operation the studio keeps for
 *   catalogue projects, PD-ARCH-01F, which retired the catalogue creation form) runs on the current version; its facts
 *   are UNVERIFIED and block approval;
 * - after manual approval of every eligible fact, the facts are shown as manually approved (operator-attested), never
 *   as verified, and the content stays blocked with the reason "manual approval not publishable" (R-272).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import {
  createCatalogueProject,
  factsLink,
  finalApprovalRegion,
  manuallyApproveAll,
  openContentReview,
  runToEnd,
  slideButton,
  slideInspector,
  slideNames,
} from '../support/app.js';
import { expect, test } from '../support/test.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const VALID_MATCHES_CSV = readFileSync(resolve(PROJECT_ROOT, 'fixtures/manual/valid/liga-manual-matches.csv'), 'utf8');

/** The committed sample with three rows broken: a non-numeric score (row 3), no kickoff (row 4), a negative score (row 6). */
function csvWithErrors(): string {
  const lines = VALID_MATCHES_CSV.split('\n');
  const replace = (index: number, from: RegExp | string, to: string) => {
    const line = lines[index];
    if (line === undefined || !(typeof from === 'string' ? line.includes(from) : from.test(line))) {
      throw new Error(`sample line ${String(index + 1)} has changed`);
    }
    lines[index] = line.replace(from, to);
  };
  replace(2, /,3,3$/, ',tres,3');
  replace(3, '2026-08-02T17:45:00Z', '');
  replace(5, /,1,4$/, ',1,-1');
  return lines.join('\n');
}

async function importFile(page: Page, name: string, content: string, declaredSource: string): Promise<void> {
  const form = page.getByRole('form', { name: 'Importar un archivo' });
  await form.locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content) });
  await form.getByRole('textbox', { name: 'Fuente declarada (opcional)' }).fill(declaredSource);
  await form.getByRole('button', { name: 'Importar archivo' }).click();
}

/** Version number announced for a selection in the applied-import result. */
async function announcedVersion(result: Locator, selection: string): Promise<number> {
  const item = result.getByRole('listitem').filter({ has: result.page().getByRole('link', { name: selection }) });
  const text = (await item.textContent()) ?? '';
  const match = /versión (\d+)/.exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`no version announced for ${selection}: ${text}`);
  }
  return Number(match[1]);
}

test.describe('Manual import journey (MANUAL_DATA)', () => {
  test('import with errors, corrected file, form entry, versions, project, manual approval still blocked', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    await page.goto('/imports');
    await expect(page.getByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeVisible();
    const notices = page.getByRole('status', { name: 'Avisos de la página de importaciones' });
    const history = page.getByRole('region', { name: 'Historial de importaciones' });
    await expect(history.getByRole('heading', { level: 2 })).toBeVisible();
    // Count once the history has loaded (its table, or its empty message): other journeys on the suite server leave
    // applied imports and confirmed local selections in it.
    await expect(
      history
        .getByRole('table', { name: 'Importaciones aplicadas, de la más reciente a la más antigua' })
        .or(history.getByText('Todavía no hay importaciones aplicadas.', { exact: false })),
    ).toBeVisible();
    const appliedBefore = await history.getByRole('rowheader').count();

    // A CSV with errors: rejected whole, every error by row and field (R-273, R-274 shown in the interface).
    await importFile(page, 'liga-manual-errores.csv', csvWithErrors(), 'Boletín sintético de la liga');
    await expect(notices).toHaveText('Importación rechazada; no se guardó ningún dato.');
    const rejected = page.getByRole('region', { name: 'Importación rechazada' });
    await expect(rejected).toContainText('El archivo «liga-manual-errores.csv» fue rechazado completo');
    const errors = rejected.getByRole('table', { name: '3 errores en la importación' });
    const errorRows = errors.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    await expect(errorRows).toHaveCount(3);
    // Records by kind (CSV row) and details from the closed problem code in Spanish (OD-63, R-416).
    const expectedErrors: [string, string, string, string][] = [
      [
        '3',
        'home_score',
        'Tipo de valor no válido',
        'El valor de «home_score» no tiene el tipo o el formato esperado.',
      ],
      ['4', 'kickoff', 'Falta un valor obligatorio', 'Falta el valor obligatorio de «kickoff».'],
      [
        '6',
        'away_score',
        'Tipo de valor no válido',
        'El valor de «away_score» no tiene el tipo o el formato esperado.',
      ],
    ];
    for (const [index, [row, field, problem, detail]] of expectedErrors.entries()) {
      const cells = errorRows.nth(index).getByRole('cell');
      await expect(cells.nth(0)).toHaveText(new RegExp(`^Fila\\s+${row}$`));
      await expect(cells.nth(1)).toHaveText(field);
      await expect(cells.nth(2)).toHaveText(problem);
      await expect(cells.nth(3)).toHaveText(detail);
    }
    // Nothing from the rejected import is stored.
    await expect(history.getByRole('rowheader')).toHaveCount(appliedBefore);

    // The corrected file is applied; its selections get versions (R-276).
    await importFile(page, 'liga-manual-corregido.csv', VALID_MATCHES_CSV, 'Boletín sintético de la liga');
    await expect(notices).toHaveText('Importación aplicada: «Liga Manual Sintética», temporada «2026/27».');
    const applied = page.getByRole('region', { name: 'Importación aplicada' });
    await expect(applied).toContainText('liga-manual-corregido.csv');
    await expect(applied).toContainText('quedan sin verificar hasta que el operador los apruebe manualmente');
    await expect(applied.getByRole('link', { name: /^(Torneo Apertura|Cuartos de Final), / })).toHaveText([
      'Torneo Apertura, jornada 1',
      'Torneo Apertura, jornada 2',
      'Cuartos de Final, fase completa',
    ]);
    const fileVersion = await announcedVersion(applied, 'Torneo Apertura, jornada 1');

    // A selection entered through the form: a new version of Torneo Apertura matchday 1.
    await page.getByRole('radio', { name: 'Formulario' }).check();
    const form = page.getByRole('form', { name: 'Introducir datos con el formulario' });
    await form.getByRole('textbox', { name: 'Identificador de la competición' }).fill('liga-manual');
    await form.getByRole('textbox', { name: 'Nombre de la competición' }).fill('Liga Manual Sintética');
    await form.getByRole('textbox', { name: 'Identificador de la temporada' }).fill('2026');
    await form.getByRole('textbox', { name: 'Nombre de la temporada' }).fill('2026/27');
    await form.getByRole('textbox', { name: 'Identificador de la fase' }).fill('torneo-apertura');
    await form.getByRole('textbox', { name: 'Nombre de la fase' }).fill('Torneo Apertura');
    await form.getByRole('spinbutton', { name: 'Número de jornada' }).fill('1');
    const teams = ['Club Maizal', 'Estrella Trigal', 'Juventud Arrozal', 'Atlético Cafetal'];
    await form.getByRole('button', { name: 'Añadir equipo' }).click();
    await form.getByRole('button', { name: 'Añadir equipo' }).click();
    for (const [index, team] of teams.entries()) {
      await form.getByRole('textbox', { name: `Nombre del equipo ${String(index + 1)}` }).fill(team);
    }
    await form.getByRole('button', { name: 'Añadir partido' }).click();
    const matches: [string, string, string, string, string][] = [
      ['Club Maizal', 'Estrella Trigal', '2026-08-01T11:45', '0', '4'],
      ['Juventud Arrozal', 'Atlético Cafetal', '2026-08-01T14:00', '3', '3'],
    ];
    for (const [index, [home, away, kickoff, homeScore, awayScore]] of matches.entries()) {
      const match = form.getByRole('group', { name: `Partido ${String(index + 1)}` });
      await match.getByRole('combobox', { name: 'Equipo local' }).selectOption({ label: home });
      await match.getByRole('combobox', { name: 'Equipo visitante' }).selectOption({ label: away });
      await match.getByLabel('Fecha y hora de inicio').fill(kickoff);
      await match.getByRole('combobox', { name: 'Estado' }).selectOption({ label: 'Finalizado' });
      await match.getByRole('spinbutton', { name: 'Goles del local' }).fill(homeScore);
      await match.getByRole('spinbutton', { name: 'Goles del visitante' }).fill(awayScore);
    }
    await form.getByRole('textbox', { name: 'Fuente declarada (opcional)' }).fill('Acta sintética de la jornada');
    await form.getByRole('button', { name: 'Importar datos del formulario' }).click();
    await expect(notices).toHaveText('Importación aplicada: «Liga Manual Sintética», temporada «2026/27».');
    const formResult = page.getByRole('region', { name: 'Importación aplicada' });
    await expect(formResult).toContainText('Formulario');
    const formVersion = await announcedVersion(formResult, 'Torneo Apertura, jornada 1');
    expect(formVersion).toBe(fileVersion + 1);

    // The versions of the selection: the form version is current, the file version is kept (R-276).
    const versions = page
      .getByRole('region', { name: 'Versiones por selección' })
      .getByRole('table', { name: 'Versiones de Torneo Apertura, jornada 1' });
    await expect(versions.getByRole('row').nth(1)).toContainText(`Versión ${String(formVersion)}`);
    await expect(versions.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('Actual');
    await expect(versions.getByRole('row').nth(2)).toContainText(`Versión ${String(fileVersion)}`);
    await expect(versions.getByRole('row').nth(2).getByRole('cell').first()).toHaveText('Anterior');
    await versions
      .getByRole('link', { name: `Ver la versión ${String(formVersion)} de Torneo Apertura, jornada 1` })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: `Versión ${String(formVersion)}: Torneo Apertura, jornada 1` }),
    ).toBeVisible();
    await expect(page.getByText('Versión actual: la usa la investigación de los proyectos nuevos.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Partidos' }).getByRole('row')).toHaveCount(1 + matches.length);

    // A catalogue project for the imported competition, on the MANUAL_DATA source (R-243, R-276).
    const projectId = await createCatalogueProject(page, baseURL, {
      competitionId: 'manual-liga-manual',
      sourceId: 'manual',
      seasonId: '2026',
      stageId: 'torneo-apertura',
      matchday: 1,
    });
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText('Datos sintéticos · no verificados ni publicables.')).toHaveCount(0);
    await runToEnd(page, 1);

    // Facts: UNVERIFIED, from the import (mode, source and import version named).
    await (await factsLink(page, 1)).click();
    await expect(page.getByText('Modo de datos: Datos manuales')).toBeVisible();
    const summary = page.getByText(/^\d+ datos: 0 verificados, \d+ sin verificar, 0 aprobados manualmente/);
    await expect(summary).toBeVisible();
    const [, total, unverified] =
      /^(\d+) datos: 0 verificados, (\d+) sin verificar/.exec((await summary.textContent()) ?? '') ?? [];
    expect(Number(total)).toBeGreaterThan(0);
    expect(unverified).toBe(total);
    const firstEvidence = page.getByRole('table', { name: 'Evidencia por fuente' }).first();
    await expect(firstEvidence.getByRole('rowheader')).toHaveText(['Operator import (manual)']);
    await expect(firstEvidence).toContainText('Datos manuales');
    await expect(page.getByText('Verificado', { exact: true })).toHaveCount(0);

    // Before manual approval: approval of content using the facts is refused, naming them (R-206).
    await openContentReview(page, projectId);
    const resultSlide = (await slideNames(page)).find((name) => name.endsWith(': Resultado')) ?? '';
    await slideButton(page, resultSlide).click();
    const inspector = slideInspector(page, resultSlide);
    const panel = inspector.getByRole('region', {
      name: `Datos que bloquean la aprobación: ${resultSlide}`,
      exact: true,
    });
    await expect(panel.getByRole('listitem').filter({ hasText: /^Marcador: \d+-\d+/ })).toHaveCount(1);
    await expect(panel.getByRole('listitem').first()).toContainText('Motivo del bloqueo: Dato sin verificar');
    await expect(inspector.getByRole('button', { name: 'Aprobar diapositiva' })).toBeDisabled();

    // Manual approval of every eligible fact (operator-attested, never verified).
    await page.goto(`/projects/${projectId}`);
    await (await factsLink(page, 1)).click();
    await expect(
      page.getByText('Los datos manuales elegibles pueden aprobarse manualmente.', { exact: false }),
    ).toBeVisible();
    const approved = await manuallyApproveAll(page);
    expect(approved).toBeGreaterThan(0);
    await expect(
      page.getByText(
        new RegExp(`^${total} datos: 0 verificados, \\d+ sin verificar, ${String(approved)} aprobados manualmente`),
      ),
    ).toBeVisible();
    await expect(page.getByText('Verificado', { exact: true })).toHaveCount(0);

    // The content stays blocked: manual approval not publishable, because no link is configured as having no
    // accepted public source (PD-17, R-272).
    await openContentReview(page, projectId);
    await slideButton(page, resultSlide).click();
    const attested = slideInspector(page, resultSlide).getByRole('region', {
      name: `Datos que bloquean la aprobación: ${resultSlide}`,
      exact: true,
    });
    const blocking = attested.getByRole('list', { name: 'Datos que bloquean la aprobación' }).getByRole('listitem');
    expect(await blocking.count()).toBeGreaterThan(0);
    for (const fact of await blocking.all()) {
      await expect(fact).toContainText('Aprobado manualmente');
      await expect(fact).toContainText('Aprobación manual no publicable');
      await expect(fact).not.toContainText('Verificado');
    }
    await expect(blocking.filter({ hasText: /^Marcador: \d+-\d+/ })).toHaveCount(1);
    await expect(slideInspector(page, resultSlide).getByRole('button', { name: 'Aprobar diapositiva' })).toBeDisabled();
    await expect(finalApprovalRegion(page).getByRole('button', { name: 'Aprobar carrusel completo' })).toBeDisabled();

    // Mis proyectos lists the project with its sports context, without the demonstration notice (R-269).
    await page.goto('/projects');
    const row = page
      .getByRole('table', { name: 'Proyectos e historial' })
      .getByRole('row')
      .filter({ has: page.locator(`a[href="/projects/${projectId}"]`) });
    await expect(row).toContainText('Liga Manual Sintética · 2026/27 · Torneo Apertura · Jornada 1');
    await expect(row.getByText('Demostración', { exact: true })).toHaveCount(0);
  });
});
