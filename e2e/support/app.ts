/**
 * Operator actions of the journeys, performed through the user interface (Spanish copy, R-416) except where a function
 * says otherwise. Every action waits for the outcome the interface announces, never for a fixed time.
 *
 * Since PD-ARCH-01F content is created only from locally managed competitions (Crear contenido, `/projects/generate`);
 * the catalogue creation form is retired, while the catalogue projects already created keep opening, running,
 * reviewing and exporting. A journey that needs such a project creates it through the API operation the studio keeps
 * (`createCatalogueProject`). Approval follows the review rules (T37, OD-09): every visual QA warning is confirmed
 * through its button before a slide is approved; nothing assumes a check passed.
 */
import { readFile } from 'node:fs/promises';

import type { APIResponse, Locator, Page } from '@playwright/test';

import type { LocalCompetition, LocalRound } from './local-data.js';
import { expect } from './test.js';

/** Time allowed for a whole run (research to Visual QA) of the fixture and stub providers. */
export const RUN_TIMEOUT_MS = 60_000;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** `text` as a literal inside a regular expression. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A catalogue selection (contract `ProjectCreate`) of a DEMO_DATA or MANUAL_DATA catalogue source. */
export interface CatalogueSelection {
  readonly competitionId: string;
  readonly sourceId: string;
  readonly seasonId: string;
  readonly stageId: string;
  readonly matchday: number | null;
  readonly language?: 'es' | 'en';
}

/** The project ID of the current project address. */
export function projectIdOf(page: Page): string {
  const match = new RegExp(`/projects/(${UUID.source})`).exec(page.url());
  if (match?.[1] === undefined) {
    throw new Error(`not a project address: ${page.url()}`);
  }
  return match[1];
}

/**
 * Creates a catalogue project through the API operation the studio keeps for existing catalogue projects
 * (`createProject`, PD-ARCH-01F), the way the web client sends it. Returns the project ID; no run is started.
 */
export async function createCatalogueProject(
  page: Page,
  baseURL: string,
  selection: CatalogueSelection,
): Promise<string> {
  const response = await page.request.post('/api/v1/projects', {
    headers: { 'X-EDR-Client': 'web', Origin: new URL(baseURL).origin },
    data: selection,
  });
  expect(response.status(), `createProject: ${await response.text()}`).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/**
 * Opens the disclosure (`details`) of `scope` whose summary is `summary`, unless it is already open. The state is read
 * from the element, never guessed from what is visible, because the project page opens some disclosures itself (for
 * example the run details after a failed run).
 */
export async function openDisclosure(scope: Page | Locator, summary: string): Promise<Locator> {
  // A `has` filter is resolved inside each candidate, so it is built from the page, not from `scope`.
  const page = 'page' in scope ? scope.page() : scope;
  const disclosure = scope
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: new RegExp(`^\\s*${literal(summary)}\\s*$`) }) })
    .first();
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute('open')) === null) {
    await disclosure.locator('summary').first().click();
  }
  await expect(disclosure).toHaveAttribute('open', '');
  return disclosure;
}

/** Opens the run details of the project page (the «Generación y progreso» disclosure). */
export async function openRunDetails(page: Page): Promise<Locator> {
  await openDisclosure(page, 'Generación y progreso');
  const region = runRegion(page);
  await expect(region).toBeVisible();
  return region;
}

/** Opens the secondary sections of the project page and returns the link to the facts of run `runNumber`. */
export async function factsLink(page: Page, runNumber: number): Promise<Locator> {
  await openDisclosure(page, 'Más opciones del proyecto');
  const link = page.getByRole('link', { name: `Datos y verificación (ejecución ${String(runNumber)})`, exact: true });
  await expect(link).toBeVisible();
  return link;
}

/** The run region of the project page. */
export function runRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Ejecución' });
}

/** The stage table of the shown run, inside the run's progress details (opened when closed). */
export async function stageTable(page: Page): Promise<Locator> {
  const region = await openRunDetails(page);
  await openDisclosure(region, 'Detalles del progreso de generación');
  const table = region.getByRole('table', { name: 'Estado de cada etapa' });
  await expect(table).toBeVisible();
  return table;
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
 * Starts a full run from the project page (the start button, unless run `runNumber` is already shown) and waits until
 * the interface reports `outcome` for it. The run details are reopened whenever the page redraws them closed (the
 * project page collapses them once the draft is shown).
 */
export async function runToEnd(
  page: Page,
  runNumber: number,
  outcome: 'completada' | 'fallida' = 'completada',
): Promise<void> {
  const region = await openRunDetails(page);
  const status = region.getByRole('status').first();
  await expect(status).not.toBeEmpty();
  if (!((await status.textContent()) ?? '').startsWith(`Ejecución ${String(runNumber)}:`)) {
    await region.getByRole('button', { name: /^(Iniciar|Reiniciar) ejecución completa$/ }).click();
  }
  const expected = `Ejecución ${String(runNumber)}: ${outcome}.`;
  await expect(async () => {
    const shown = await openRunDetails(page);
    await expect(shown.getByRole('status').first()).toHaveText(expected, { timeout: 1_000 });
  }).toPass({ timeout: RUN_TIMEOUT_MS });
}

/** The row of a stage of the shown run (call `stageTable` first so that the table is shown). */
export function stageRow(page: Page, stage: (typeof STAGES)[number]): Locator {
  return runRegion(page)
    .getByRole('table', { name: 'Estado de cada etapa' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: stage, exact: true }) });
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

// ---------------------------------------------------------------------------------------------------------------
// Content creation from local competitions (PD-ARCH-01E, PD-ARCH-01F) and the review workspace (UX-REVIEW-01,
// REVIEW-APPROVAL-01). These are the current creator journeys; the helpers above serve the catalogue projects that
// the studio keeps opening, reviewing and exporting (PD-ARCH-01F).
// ---------------------------------------------------------------------------------------------------------------

/** Labels of the content types of Crear contenido, in the order shown. */
export const CONTENT_KINDS = [
  'Resultados de jornada',
  'Resultado individual',
  'Calendario de jornada',
  'Próximos partidos',
  'Previa individual',
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

/** Opens Crear contenido and selects competition, season and round; Continuar is enabled only at the end. */
export async function chooseSportsContext(page: Page, competition: LocalCompetition, round: LocalRound): Promise<void> {
  await page.goto('/projects/generate');
  await expect(page.getByRole('heading', { level: 1, name: 'Crear contenido' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Continuar' });
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: 'Competición' }).selectOption({ label: competition.name });
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ label: competition.seasonLabel });
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: 'Jornada' }).selectOption({ label: round.option });
  await expect(next).toBeEnabled();
}

/**
 * Generates content from a round through the five steps of Crear contenido (the compatible matches, the engine
 * templates) and waits for the batch to complete. Returns the generated projects' IDs, in the order listed.
 */
export async function generateContent(
  page: Page,
  competition: LocalCompetition,
  round: LocalRound,
  kinds: readonly ContentKind[] = ['Resultados de jornada'],
): Promise<string[]> {
  await chooseSportsContext(page, competition, round);
  const next = page.getByRole('button', { name: 'Continuar' });
  await next.click();
  const kindStep = page.getByRole('region', { name: '2. Tipo de contenido' });
  await expect(kindStep).toBeVisible();
  for (const kind of CONTENT_KINDS) {
    await kindStep.getByRole('checkbox', { name: new RegExp(`^${literal(kind)} `) }).setChecked(kinds.includes(kind));
  }
  await next.click();
  const matchStep = page.getByRole('region', { name: `3. Partidos de ${round.name}` });
  await expect(matchStep).toBeVisible();
  await matchStep.getByRole('button', { name: 'Seleccionar compatibles' }).click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByRole('region', { name: '4. Plantilla' })).toBeVisible();
  await next.click();
  const reviewStep = page.getByRole('region', { name: '5. Revisión de la generación propuesta' });
  await expect(reviewStep.getByRole('region', { name: 'Piezas' })).toBeVisible();
  await page.getByRole('button', { name: /^Confirmar y generar \d+ piezas?$/ }).click();
  await page.waitForURL(new RegExp(`/projects/batches/${UUID.source}$`));
  const batch = page.getByRole('region', { name: `${competition.name} · ${competition.seasonLabel} · ${round.name}` });
  await expect(batch.getByRole('status').first()).toHaveText('Completada', { timeout: RUN_TIMEOUT_MS });
  const links = page.getByRole('region', { name: 'Piezas' }).getByRole('link', { name: 'Abrir proyecto' });
  const hrefs = await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  return hrefs.map((href) => {
    const match = new RegExp(`^/projects/(${UUID.source})$`).exec(href);
    if (match?.[1] === undefined) throw new Error(`not a project link: ${href}`);
    return match[1];
  });
}

/** Opens the review workspace of a project (UX-REVIEW-01). */
export async function openContentReview(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/review`);
  await expect(page.getByRole('heading', { level: 1, name: 'Revisión del contenido' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Estado de la revisión' })).toBeVisible();
}

/** The slide rail of the review workspace. */
export function slideRail(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Diapositivas del carrusel' });
}

/** Names of the slides in the rail (`Diapositiva n: Tipo`), in carousel order. */
export async function slideNames(page: Page): Promise<string[]> {
  const labels = await slideRail(page)
    .getByRole('listitem')
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent ?? ''));
  return labels.map((label) => label.replace(/, [^,]+$/, ''));
}

/** The rail button of a slide (its name carries the slide's state after a comma). */
export function slideButton(page: Page, slide: string): Locator {
  return slideRail(page).getByRole('button', { name: new RegExp(`^${literal(slide)}, `) });
}

/** The inspector of the selected slide. */
export function slideInspector(page: Page, slide: string): Locator {
  return page.getByRole('region', { name: `Estado y acciones: ${slide}`, exact: true });
}

/**
 * Approves one slide from its inspector: selects it, confirms each visual QA warning it offers (approval needs every
 * warning confirmed, OD-09), approves it and waits until the rail reports it approved.
 */
export async function approveSlide(page: Page, slide: string): Promise<void> {
  await slideButton(page, slide).click();
  const inspector = slideInspector(page, slide);
  await expect(inspector).toBeVisible();
  const acknowledge = inspector.getByRole('button', { name: /^Confirmar la advertencia: / });
  while ((await acknowledge.count()) > 0) {
    await acknowledge.first().click();
    await expect(inspector.getByRole('status').filter({ hasText: 'Advertencia confirmada.' })).toBeVisible();
  }
  await inspector.getByRole('button', { name: 'Aprobar diapositiva' }).click();
  await expect(slideButton(page, slide)).toHaveAccessibleName(`${slide}, Aprobada`);
}

/** Approves every slide that is ready through the bulk approval and its confirmation (UI-04B). */
export async function approveReadySlidesInBulk(page: Page): Promise<number> {
  await slideRail(page)
    .getByRole('button', { name: /^Aprobar todas \(\d+\)$/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: /^Aprobar \d+ diapositivas?$/ });
  const count = Number(/(\d+)/.exec((await confirm.textContent()) ?? '')?.[1] ?? '0');
  await confirm.click();
  // The dialog reports the outcome (partial failures included, UI-04B) and closes with «Listo».
  await expect(dialog.getByRole('heading', { name: `${String(count)} diapositivas aprobadas.` })).toBeVisible({
    timeout: RUN_TIMEOUT_MS,
  });
  await dialog.getByRole('button', { name: 'Listo' }).click();
  await expect(dialog).toBeHidden();
  return count;
}

/**
 * The review progress item of `label` (`Diapositivas`, `Copy`, `Bloqueos`, `Advertencias`); its text starts with a
 * decorative symbol, so assert it with `toContainText`.
 */
export function reviewProgress(page: Page, label: string): Locator {
  return page
    .getByRole('list', { name: 'Estado de la revisión' })
    .getByRole('listitem')
    .filter({
      hasText: new RegExp(`${literal(label)}:`),
    });
}

/** Opens the Copy editorial mode of the review workspace. */
export async function openEditorialMode(page: Page): Promise<Locator> {
  await page
    .getByRole('tablist', { name: 'Modo de revisión' })
    .getByRole('tab', { name: /^Copy editorial/ })
    .click();
  const region = page.getByRole('region', { name: 'Copy editorial' });
  await expect(region).toBeVisible();
  return region;
}

/** Labels of the editorial deliverables' tabs (REVIEW-APPROVAL-01, PD-33). */
export const EDITORIAL_TABS = [
  'Facebook / Instagram',
  'TikTok / Reels',
  'YouTube',
  'Titulares virales',
  'Pregunta de debate',
] as const;

/** Generates the editorial copy with the configured writer (the free `stub` in every suite run, PD-30). */
export async function generateEditorialCopy(page: Page): Promise<void> {
  const region = await openEditorialMode(page);
  await region.getByRole('button', { name: 'Generar copy editorial' }).click();
  const tabs = region.getByRole('tablist', { name: 'Entregables del copy editorial' });
  await expect(tabs.getByRole('tab', { name: EDITORIAL_TABS[0] })).toBeVisible({ timeout: RUN_TIMEOUT_MS });
}

/** Approves the current version of one editorial deliverable. */
export async function approveEditorialDeliverable(page: Page, tab: (typeof EDITORIAL_TABS)[number]): Promise<void> {
  const region = await openEditorialMode(page);
  await region.getByRole('tablist', { name: 'Entregables del copy editorial' }).getByRole('tab', { name: tab }).click();
  const actions = region.getByRole('complementary', { name: /^Acciones del copy: / });
  await actions.getByRole('button', { name: 'Aprobar copy' }).click();
  await expect(actions.getByRole('button', { name: 'Retirar aprobación' })).toBeVisible();
}

/** Withdraws the approval of one editorial deliverable (its version stays, no longer approved). */
export async function withdrawEditorialApproval(page: Page, tab: (typeof EDITORIAL_TABS)[number]): Promise<void> {
  const region = await openEditorialMode(page);
  await region.getByRole('tablist', { name: 'Entregables del copy editorial' }).getByRole('tab', { name: tab }).click();
  const actions = region.getByRole('complementary', { name: /^Acciones del copy: / });
  await actions.getByRole('button', { name: 'Retirar aprobación' }).click();
  await expect(actions.getByRole('button', { name: 'Aprobar copy' })).toBeVisible();
}

/**
 * Edits one field of an editorial deliverable and saves it: the server keeps the edit as a new version that is not
 * approved (PD-ARCH-01H), so an approval of the earlier version no longer covers the current text.
 */
export async function editEditorialField(
  page: Page,
  tab: (typeof EDITORIAL_TABS)[number],
  field: string,
  edit: (text: string) => string,
): Promise<void> {
  const region = await openEditorialMode(page);
  await region.getByRole('tablist', { name: 'Entregables del copy editorial' }).getByRole('tab', { name: tab }).click();
  const actions = region.getByRole('complementary', { name: /^Acciones del copy: / });
  await actions.getByRole('button', { name: 'Editar texto' }).click();
  const textbox = region.getByRole('textbox', { name: field, exact: true });
  await textbox.fill(edit(await textbox.inputValue()));
  await actions.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(actions.getByRole('button', { name: 'Editar texto' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Retirar aprobación' })).toHaveCount(0);
}

/** The final approval region of the review workspace. */
export function finalApprovalRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Aprobación final' });
}

/**
 * Gives the final approval of the graphic carousel through its confirmation dialog. `inspect` receives the dialog
 * before the confirmation (for the summary it shows).
 */
export async function giveFinalApproval(page: Page, inspect?: (dialog: Locator) => Promise<void>): Promise<void> {
  const region = finalApprovalRegion(page);
  await region.getByRole('button', { name: 'Aprobar carrusel completo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Aprobar carrusel completo' });
  await expect(dialog).toBeVisible();
  if (inspect !== undefined) await inspect(dialog);
  await dialog.getByRole('button', { name: 'Confirmar aprobación final' }).click();
  await expect(dialog).toBeHidden();
  await expect(region.getByText('La aprobación final es válida. El carrusel se puede exportar.')).toBeVisible();
}

/** Downloads the carousel ZIP from the review workspace and returns its bytes. */
export async function downloadCarousel(page: Page): Promise<Buffer> {
  const region = finalApprovalRegion(page);
  const download = page.waitForEvent('download', { timeout: RUN_TIMEOUT_MS });
  await region.getByRole('button', { name: 'Descargar carrusel' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^carrusel-[0-9a-f]{8}\.zip$/);
  const path = await file.path();
  await expect(region.getByRole('status').filter({ hasText: 'La descarga está lista.' })).toBeVisible();
  return readFile(path);
}
