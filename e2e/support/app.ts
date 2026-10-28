/**
 * Operator actions of the journeys, performed only through the user interface (Spanish copy, R-416) except where a
 * function says otherwise. Every action waits for the outcome the interface announces, never for a fixed time.
 *
 * Approval follows the review rules (T37): every stored Visual QA warning (including `capitalized_tokens`) is
 * acknowledged through its button before an element is approved; nothing assumes a check passed.
 */
import type { APIResponse, Locator, Page } from '@playwright/test';

import { expect } from './test.js';

/** Time allowed for a whole run (research to Visual QA) of the fixture and stub providers. */
export const RUN_TIMEOUT_MS = 60_000;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

export interface ProjectSelection {
  /** Accessible name (or a pattern of it) of the competition radio. */
  readonly competition: RegExp;
  /** Visible label of the season option; the first offered season when omitted. */
  readonly season?: string;
  /** Name of the stage radio, as the source names it. */
  readonly stage: string;
  /** Visible label of the matchday option; omitted for a whole stage. */
  readonly matchday?: string;
  /** Content language option; the default (Español) when omitted. */
  readonly language?: 'Español' | 'Inglés';
}

/** The project ID of the current project address. */
export function projectIdOf(page: Page): string {
  const match = new RegExp(`/projects/(${UUID.source})`).exec(page.url());
  if (match?.[1] === undefined) {
    throw new Error(`not a project address: ${page.url()}`);
  }
  return match[1];
}

/** Fills the creation form, checking that "Crear proyecto" stays disabled until the selection is complete. */
export async function fillProjectForm(page: Page, selection: ProjectSelection): Promise<void> {
  await page.goto('/projects/new');
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo proyecto' })).toBeVisible();
  const create = page.getByRole('button', { name: 'Crear proyecto' });
  await expect(create).toBeDisabled();
  await page.getByRole('radio', { name: selection.competition }).check();
  await expect(create).toBeDisabled();
  const season = page.getByRole('combobox', { name: 'Temporada' });
  await expect(season.locator('option')).not.toHaveCount(1);
  if (selection.season === undefined) {
    await season.selectOption({ index: 1 });
  } else {
    await season.selectOption({ label: selection.season });
  }
  await expect(create).toBeDisabled();
  await page.getByRole('radio', { name: selection.stage, exact: true }).check();
  if (selection.matchday !== undefined) {
    await expect(create).toBeDisabled();
    await page.getByRole('combobox', { name: 'Jornada' }).selectOption({ label: selection.matchday });
  }
  if (selection.language !== undefined) {
    await page.getByRole('combobox', { name: 'Idioma del contenido' }).selectOption({ label: selection.language });
  }
  await expect(page.getByText('La selección está completa.')).toBeVisible();
  await expect(create).toBeEnabled();
}

/** Creates a project through the form and returns its ID (the browser is on the project page). */
export async function createProject(page: Page, selection: ProjectSelection): Promise<string> {
  await fillProjectForm(page, selection);
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await page.waitForURL(new RegExp(`/projects/${UUID.source}$`));
  await expect(page.getByRole('region', { name: 'Selección' })).toBeVisible();
  return projectIdOf(page);
}

/** The run region of the project page. */
export function runRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Ejecución' });
}

/** The stage table of the shown run. */
export function stageTable(page: Page): Locator {
  return runRegion(page).getByRole('table', { name: 'Estado de cada etapa' });
}

/** Stage names in workflow order. */
export const STAGES = [
  'Obtención de datos',
  'Verificación',
  'Redacción del contenido',
  'Generación de imágenes',
  'Control visual',
] as const;

/**
 * Starts a full run from the project page (the start or the restart button) and waits until the interface reports
 * `outcome` for run `runNumber`.
 */
export async function runToEnd(
  page: Page,
  runNumber: number,
  outcome: 'completada' | 'fallida' = 'completada',
): Promise<void> {
  const region = runRegion(page);
  await region.getByRole('button', { name: /^(Iniciar|Reiniciar) ejecución completa$/ }).click();
  await expect(
    region.getByRole('heading', { level: 3, name: `Ejecución ${String(runNumber)} (completa)` }),
  ).toBeVisible();
  await expect(region.getByRole('status').first()).toHaveText(`Ejecución ${String(runNumber)}: ${outcome}.`, {
    timeout: RUN_TIMEOUT_MS,
  });
}

/** The status cell of a stage row of the shown run. */
export function stageStatus(page: Page, stage: (typeof STAGES)[number]): Locator {
  return stageTable(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: stage, exact: true }) });
}

/** Opens the review page of a project and waits for the carousel preview. */
export async function openReview(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/review`);
  await expect(page.getByRole('heading', { level: 1, name: 'Revisión y aprobación' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Vista previa en orden de publicación' })).toBeVisible();
}

/** Names of the elements of the carousel preview, in the order shown (from their labelled action groups). */
export async function elementNames(page: Page): Promise<string[]> {
  const labels = await page
    .getByRole('group', { name: /^Acciones: / })
    .evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.slice('Acciones: '.length));
}

/** The article of one element of the preview (slide or caption) by its accessible name. */
export function elementArticle(page: Page, name: string): Locator {
  return page.getByRole('article', { name, exact: true });
}

/**
 * Approves one element: acknowledges each Visual QA warning that offers a confirmation button, then approves the
 * shown version and waits for the announcement.
 */
export async function approveElement(page: Page, name: string): Promise<void> {
  const article = elementArticle(page, name);
  const acknowledge = article.getByRole('button', { name: /^Confirmar la advertencia: / });
  while ((await acknowledge.count()) > 0) {
    await acknowledge.first().click();
    await expect(article.getByText('Advertencia confirmada.')).toBeVisible();
  }
  const actions = page.getByRole('group', { name: `Acciones: ${name}`, exact: true });
  await actions.getByRole('button', { name: 'Aprobar esta versión' }).click();
  await expect(actions.getByRole('button', { name: 'Retirar la aprobación' })).toBeVisible();
  await expect(article.getByText(/^Versión \d+ aprobada\.$/)).toBeVisible();
}

/** Approves every element of the preview and gives the final approval. */
export async function approveAll(page: Page): Promise<void> {
  for (const name of await elementNames(page)) {
    await approveElement(page, name);
  }
  const final = page.getByRole('region', { name: 'Aprobación final del carrusel' });
  await expect(final.getByText('Todos los elementos están aprobados y ninguno está bloqueado.')).toBeVisible();
  await final.getByRole('button', { name: 'Dar la aprobación final' }).click();
  await expect(final.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
}

/** Opens the exports page of a project. */
export async function openExports(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/exports`);
  await expect(page.getByRole('heading', { level: 1, name: 'Exportaciones e historial' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Historial de exportaciones' })).toBeVisible();
}

/** Exports carousel 1 from the exports page and waits for the result; returns the export directory. */
export async function exportFirstCarousel(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Exportar el carrusel 1' }).click();
  const exportRegion = page.getByRole('region', { name: 'Exportar un carrusel aprobado' });
  const status = exportRegion.getByRole('status').filter({ hasText: 'Carrusel exportado en la carpeta' });
  await expect(status).toBeVisible({ timeout: RUN_TIMEOUT_MS });
  const text = (await status.textContent()) ?? '';
  const match = /carpeta (exports\/\S+?)\.?$/.exec(text.trim());
  if (match?.[1] === undefined) {
    throw new Error(`unexpected export announcement: ${text}`);
  }
  return match[1];
}

/** Approves (manually) every eligible fact shown on a MANUAL_DATA facts page; returns how many were approved. */
export async function manuallyApproveAll(page: Page): Promise<number> {
  const triggers = page.getByRole('button', { name: /^Aprobar manualmente: / });
  await expect(triggers.first()).toBeVisible();
  let approved = 0;
  while ((await triggers.count()) > 0) {
    const label = await triggers.first().getAttribute('aria-label');
    if (label === null) {
      throw new Error('manual approval button without a label');
    }
    await triggers.first().click();
    const confirmation = page.getByRole('group', { name: 'Confirmar la aprobación manual' });
    await expect(confirmation).toContainText('no es una verificación');
    await confirmation.getByRole('button', { name: 'Confirmar' }).click();
    const fact = label.slice('Aprobar manualmente: '.length);
    await expect(
      page.getByRole('button', { name: `Revocar la aprobación manual: ${fact}`, exact: true }),
    ).toBeVisible();
    approved += 1;
  }
  return approved;
}

/**
 * Sends a state-changing API request the way the web client does (same origin, `X-EDR-Client: web`), for a refusal
 * the interface does not offer to attempt (for example an export without a final approval).
 */
export async function clientPost(page: Page, path: string, baseURL: string): Promise<APIResponse> {
  return page.request.post(path, { headers: { 'X-EDR-Client': 'web', Origin: new URL(baseURL).origin }, data: {} });
}

/** Reads a JSON document of the API (GET, same origin). */
export async function apiGet(page: Page, path: string): Promise<unknown> {
  const response = await page.request.get(path);
  expect(response.status(), `GET ${path}`).toBe(200);
  return response.json();
}
