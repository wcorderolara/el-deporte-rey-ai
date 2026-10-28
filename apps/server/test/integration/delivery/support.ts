/**
 * Support of the T42 delivery suites (content, rendering, visual QA, approval, export, history and traceability). It
 * builds on the T41 test support and the T52 ingestion support (both read only, reused by import) and adds:
 * - API helpers for the review and export routes of the contract (getActiveDraft, approveElement,
 *   acknowledgeQaWarnings, approveCarousel, regenerateElement, setExcludedMatches, exportCarousel, getExport,
 *   listProjectExports, traceExportedSlide) that work on the T41 test app and on the T52 rooted app alike;
 * - read-only views of the stored rows (element versions with their text and render model, final approvals);
 * - stage wrappers for the workflow test seam (`stageOverrides`): a stage that runs a seeding step before the real
 *   registered stage loads its input (used to seed visual QA defects into the stored drafts and renders), and a stage
 *   whose delegate the test can switch between runs (a template change, a failing research run);
 * - the MANUAL_DATA setups of T52: a competition marked `noAcceptedPublicSource` with pinned team names, written by
 *   the test into a temporary project root (AD-38), and the same import as an unlinked manual competition.
 *
 * Every test that reaches rendering uses the bundled font roles of `config/brand.json` (the T41 factory reads the
 * repository's configuration; the T52 rooted app copies it; OD-52, OD-54). Provider identifiers come from the fixture
 * and configuration files only (AD-31). All data is synthetic; every directory is temporary.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Carousel,
  type Draft,
  DraftSchema,
  type Element,
  ElementSchema,
  type Export,
  type ExportDetail,
  ExportDetailSchema,
  ExportSchema,
  type Fact,
  FactListResponseSchema,
  type FactListResponse,
  type FinalApproval,
  FinalApprovalSchema,
  type Problem,
  ProblemSchema,
  type Project,
  ProjectSchema,
  QA_WARNING_CHECKS,
  type Run,
  RunSchema,
  type SlideTrace,
  SlideTraceSchema,
} from '@edr/contracts';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import type { StageContext, StageName } from '../../../src/modules/module-kit.js';
import { serverModules } from '../../../src/modules/registry.js';
import { type Manifest, ManifestSchema } from '../../../src/modules/export/manifest.js';
import type { AnyStage } from '../../../src/workflow/index.js';
import { type Json, type ProjectSelection, fixtureConfigDocument, sourcesOf } from '../../support/index.js';
import {
  type Cleanup,
  type RootedApp,
  importApplied,
  jsonImport,
  manualBytes,
  manualSourceEntry,
  startRootedApp,
} from '../ingestion/support.js';

/**
 * Timeout of a delivery test: each test takes one or more projects through the whole workflow (research to visual
 * QA, rendering every slide) and through approval and export; under the parallel load of `npm run test:integration`
 * that can take longer than the default 5 seconds.
 */
export const WORKFLOW_TEST_TIMEOUT = 60_000;

// ---------------------------------------------------------------------------------------------------------------
// Selections of the DEMO_DATA fixture competitions (fixtures/sports/_manifest.json)
// ---------------------------------------------------------------------------------------------------------------

/** A matchday of the league stage of `liga-demo` (16 teams, standings). */
export function ligaDemo(matchday: number, sourceId = 'demo-a'): ProjectSelection {
  return { competitionId: 'liga-demo', sourceId, seasonId: '2026', stageId: 'temporada-regular', matchday };
}

/** Matchday 1 of the league phase of `copa-demo` (36 teams: more slides than one carousel holds). */
export const COPA_DEMO_LEAGUE_MD1: ProjectSelection = Object.freeze({
  competitionId: 'copa-demo',
  sourceId: 'demo-a',
  seasonId: '2025',
  stageId: 'fase-de-liga',
  matchday: 1,
});

/** The first leg of a knockout stage of `copa-demo` (a named stage without standings). */
export const COPA_DEMO_KNOCKOUT: ProjectSelection = Object.freeze({
  competitionId: 'copa-demo',
  sourceId: 'demo-a',
  seasonId: '2025',
  stageId: 'octavos-de-final',
  matchday: 1,
});

/** The imported manual competition `liga-manual` (fixtures/manual/valid/liga-manual.json), matchday 1. */
export const LIGA_MANUAL_MD1: ProjectSelection = Object.freeze({
  competitionId: 'manual-liga-manual',
  sourceId: 'manual',
  seasonId: '2026',
  stageId: 'torneo-apertura',
  matchday: 1,
});

// ---------------------------------------------------------------------------------------------------------------
// HTTP helpers (T41 test app and T52 rooted app)
// ---------------------------------------------------------------------------------------------------------------

/** What the helpers need from an app: the inject helpers and the container (for read-only row views). */
export type Client = Pick<RootedApp, 'get' | 'send' | 'container'>;

/** The problem body of a refused request (problem+json, contract Problem). */
export function problemOf(response: LightMyRequestResponse): Problem {
  expect(response.headers['content-type']).toContain('application/problem+json');
  return ProblemSchema.parse(response.json());
}

/** Asserts a refusal with the given status and problem code; returns the problem. */
export function expectProblem(response: LightMyRequestResponse, status: number, code: Problem['code']): Problem {
  expect(response.statusCode, response.body).toBe(status);
  const problem = problemOf(response);
  expect(problem.code, response.body).toBe(code);
  return problem;
}

export async function createProject(c: Client, selection: ProjectSelection & { language?: 'es' | 'en' }) {
  const response = await c.send('POST', '/projects', selection);
  expect(response.statusCode, response.body).toBe(201);
  return ProjectSchema.parse(response.json());
}

export async function getProject(c: Client, projectId: string): Promise<Project> {
  const response = await c.get(`/projects/${projectId}`);
  expect(response.statusCode, response.body).toBe(200);
  return ProjectSchema.parse(response.json());
}

/** Waits until a run has stopped (polling getRun); returns it as the API reports it. */
export async function waitForRun(c: Client, projectId: string, runId: string): Promise<Run> {
  for (let attempt = 0; attempt < 2400; attempt += 1) {
    const response = await c.get(`/projects/${projectId}/runs/${runId}`);
    expect(response.statusCode, response.body).toBe(200);
    const run = RunSchema.parse(response.json());
    if (run.status === 'completed' || run.status === 'failed') {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the run did not stop in time');
}

/** Starts a run through startRun and waits until it has stopped. */
export async function runWorkflow(c: Client, projectId: string, kind: 'full' | 'redraft' = 'full'): Promise<Run> {
  const response = await c.send('POST', `/projects/${projectId}/runs`, { kind });
  expect(response.statusCode, response.body).toBe(202);
  return waitForRun(c, projectId, RunSchema.parse(response.json()).id);
}

/** Starts a run that must complete; returns it. */
export async function completedRun(c: Client, projectId: string, kind: 'full' | 'redraft' = 'full'): Promise<Run> {
  const run = await runWorkflow(c, projectId, kind);
  expect(run.status, JSON.stringify(run.failure)).toBe('completed');
  return run;
}

/** Creates a project, runs the full workflow (which must complete) and returns both. */
export async function projectWithDraft(
  c: Client,
  selection: ProjectSelection & { language?: 'es' | 'en' },
): Promise<{ project: Project; run: Run }> {
  const project = await createProject(c, selection);
  return { project, run: await completedRun(c, project.id) };
}

export async function factsOf(c: Client, projectId: string, runId: string): Promise<FactListResponse> {
  const response = await c.get(`/projects/${projectId}/runs/${runId}/facts`);
  expect(response.statusCode, response.body).toBe(200);
  return FactListResponseSchema.parse(response.json());
}

export async function draftOf(c: Client, projectId: string): Promise<Draft> {
  const response = await c.get(`/projects/${projectId}/draft`);
  expect(response.statusCode, response.body).toBe(200);
  return DraftSchema.parse(response.json());
}

export function elementPath(element: Pick<Element, 'carouselId' | 'id'>): string {
  return `/carousels/${element.carouselId}/elements/${element.id}`;
}

/** The elements of every carousel of a draft, in carousel and position order. */
export function allElements(draft: Draft): Element[] {
  return draft.carousels.flatMap((carousel) => carousel.elements);
}

/** The slide elements of a carousel of the given type. */
export function slidesOfType(carousel: Carousel, slideType: Element['slideType']): Element[] {
  return carousel.elements.filter((element) => element.kind === 'slide' && element.slideType === slideType);
}

export function captionOf(carousel: Carousel): Element {
  const caption = carousel.elements.find((element) => element.kind === 'caption');
  if (caption === undefined) {
    throw new Error('the carousel has no caption');
  }
  return caption;
}

/** The text of a field of an element version (its segments joined). */
export function fieldText(element: Element, field: string): string {
  return (
    element.currentVersion.fields
      .find((entry) => entry.field === field)
      ?.segments.map((segment) => segment.text)
      .join('') ?? ''
  );
}

/** The failed QA checks of an element's current version, by name, sorted. */
export function failedChecks(element: Element): string[] {
  return element.currentVersion.qa
    .filter((result) => result.outcome === 'fail')
    .map((result) => result.check)
    .sort();
}

/** Acknowledges every failed, unacknowledged warning of the element's current version (one check per request). */
export async function acknowledgeWarnings(c: Client, element: Element): Promise<number> {
  let acknowledged = 0;
  for (const result of element.currentVersion.qa) {
    if (result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null) {
      const check = QA_WARNING_CHECKS.find((name) => name === result.check);
      const response = await c.send('POST', `${elementPath(element)}/qa-acknowledgements`, {
        versionId: element.currentVersion.id,
        checks: [check],
      });
      expect(response.statusCode, response.body).toBe(200);
      acknowledged += 1;
    }
  }
  return acknowledged;
}

/** approveElement of the element's current version (the response is returned unchecked). */
export function approve(c: Client, element: Element): Promise<LightMyRequestResponse> {
  return c.send('PUT', `${elementPath(element)}/approval`, { versionId: element.currentVersion.id });
}

/** Acknowledges the warnings of and approves an element (must succeed); returns the approved element. */
export async function approveOne(c: Client, element: Element): Promise<Element> {
  await acknowledgeWarnings(c, element);
  const response = await approve(c, element);
  expect(response.statusCode, response.body).toBe(200);
  const approved = ElementSchema.parse(response.json());
  expect(approved.currentVersion.state).toBe('approved');
  return approved;
}

/** approveCarousel (the response is returned unchecked). */
export function finalApprove(c: Client, carouselId: string): Promise<LightMyRequestResponse> {
  return c.send('PUT', `/carousels/${carouselId}/final-approval`);
}

/** Approves every element of a carousel and records its final approval (must succeed). */
export async function approveCarousel(c: Client, carousel: Carousel): Promise<FinalApproval> {
  for (const element of carousel.elements) {
    await approveOne(c, element);
  }
  const response = await finalApprove(c, carousel.id);
  expect(response.statusCode, response.body).toBe(200);
  return FinalApprovalSchema.parse(response.json());
}

/** Approves every carousel of the project's active draft; returns the draft afterwards. */
export async function approveDraft(c: Client, projectId: string): Promise<Draft> {
  for (const carousel of (await draftOf(c, projectId)).carousels) {
    await approveCarousel(c, carousel);
  }
  return draftOf(c, projectId);
}

/** exportCarousel (the response is returned unchecked). */
export function exportCarousel(c: Client, carouselId: string): Promise<LightMyRequestResponse> {
  return c.send('POST', `/carousels/${carouselId}/exports`);
}

/** exportCarousel that must succeed. */
export async function exported(c: Client, carouselId: string): Promise<Export> {
  const response = await exportCarousel(c, carouselId);
  expect(response.statusCode, response.body).toBe(201);
  return ExportSchema.parse(response.json());
}

export async function exportDetail(c: Client, exportId: string): Promise<ExportDetail> {
  const response = await c.get(`/exports/${exportId}`);
  expect(response.statusCode, response.body).toBe(200);
  return ExportDetailSchema.parse(response.json());
}

export async function projectExports(c: Client, projectId: string): Promise<Export[]> {
  const response = await c.get(`/projects/${projectId}/exports`);
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { exports: unknown[] }).exports.map((entry) => ExportSchema.parse(entry));
}

export async function traceOf(c: Client, exportId: string, position: number): Promise<SlideTrace> {
  const response = await c.get(`/exports/${exportId}/slides/${String(position)}/trace`);
  expect(response.statusCode, response.body).toBe(200);
  return SlideTraceSchema.parse(response.json());
}

/** The absolute export directory of an export. */
export function exportDirectory(c: Client, written: Pick<Export, 'directory'>): string {
  return join(c.container.paths.dataDir, written.directory);
}

/** The file names of an export directory, sorted. */
export function exportFileNames(c: Client, written: Pick<Export, 'directory'>): string[] {
  return readdirSync(exportDirectory(c, written)).sort();
}

export function exportFile(c: Client, written: Pick<Export, 'directory'>, name: string): Buffer {
  return readFileSync(join(exportDirectory(c, written), name));
}

/** The parsed `manifest.json` of an export (format `edr-export-manifest/1`). */
export function manifestOf(c: Client, written: Pick<Export, 'directory'>): Manifest {
  return ManifestSchema.parse(JSON.parse(exportFile(c, written, 'manifest.json').toString('utf8')));
}

/** setExcludedMatches; waits for the redraft run it starts and returns it. */
export async function excludeMatches(c: Client, projectId: string, matchKeys: readonly string[]): Promise<Run> {
  const response = await c.send('PUT', `/projects/${projectId}/draft/exclusions`, { excludedMatchKeys: matchKeys });
  expect(response.statusCode, response.body).toBe(202);
  return waitForRun(c, projectId, RunSchema.parse(response.json()).id);
}

// ---------------------------------------------------------------------------------------------------------------
// Files and hashes
// ---------------------------------------------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Width and height from a PNG's IHDR chunk; throws when the bytes are not a PNG. */
export function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------------------------------------------
// Stored rows (read only, except the explicit seeding helpers)
// ---------------------------------------------------------------------------------------------------------------

export interface StoredSegment {
  provenance: string;
  text: string;
  factId?: string | null;
}

export interface StoredText {
  fields: { field: string; segments: StoredSegment[] }[];
}

export interface StoredVersion {
  readonly id: string;
  readonly element_id: string;
  readonly carousel_id: string;
  readonly kind: 'slide' | 'caption';
  readonly slide_type: string | null;
  readonly position: number;
  readonly version_number: number;
  readonly text: string;
  readonly render_model: string | null;
  readonly template_id: string | null;
  readonly template_version: string | null;
  readonly image_path: string | null;
  readonly image_sha256: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly qa_status: string;
  readonly superseded_at: string | null;
}

/** Every element version of the draft a run produced, in carousel and position order. */
export function versionsOfRun(c: Pick<Client, 'container'>, runId: string): StoredVersion[] {
  return c.container.db
    .prepare<StoredVersion>(
      'SELECT v.id, v.element_id, e.carousel_id, e.kind, e.slide_type, e.position, v.version_number, v.text, ' +
        'v.render_model, v.template_id, v.template_version, v.image_path, v.image_sha256, v.width, v.height, ' +
        'v.qa_status, v.superseded_at FROM element_versions v JOIN elements e ON e.id = v.element_id ' +
        'JOIN carousels c ON c.id = e.carousel_id JOIN content_drafts d ON d.id = c.draft_id ' +
        'WHERE d.run_id = ? ORDER BY c.sequence, e.position, v.version_number',
    )
    .all([runId]) as StoredVersion[];
}

/** The stored version of an element version ID. */
export function storedVersion(c: Pick<Client, 'container'>, versionId: string): StoredVersion {
  const row = c.container.db
    .prepare<StoredVersion>(
      'SELECT v.id, v.element_id, e.carousel_id, e.kind, e.slide_type, e.position, v.version_number, v.text, ' +
        'v.render_model, v.template_id, v.template_version, v.image_path, v.image_sha256, v.width, v.height, ' +
        'v.qa_status, v.superseded_at FROM element_versions v JOIN elements e ON e.id = v.element_id WHERE v.id = ?',
    )
    .get([versionId]) as StoredVersion | undefined;
  if (row === undefined) {
    throw new Error('no such element version');
  }
  return row;
}

/** The render model of a stored version (parsed JSON). */
export function renderModelOf(version: Pick<StoredVersion, 'render_model'>): RenderModelView {
  if (version.render_model === null) {
    throw new Error('the version is not rendered');
  }
  return JSON.parse(version.render_model) as RenderModelView;
}

/** The parts of a render model the delivery tests read (the full schema is the rendering module's). */
export interface RenderModelView {
  templateId: string;
  templateVersion: string;
  slideType: string;
  language: string;
  canvas: { width: number; height: number };
  background: { colorRole: string; color: string };
  palette: Record<string, string>;
  fonts: { role: string; family: string; file: string; sha256: string }[];
  demoLabel: string | null;
  elements: RenderElementView[];
}

export interface RenderElementView {
  kind: 'text' | 'rect' | 'image' | 'badge_slot';
  id: string;
  box: { x: number; y: number; width: number; height: number };
  field?: string;
  semantic?: string;
  text?: string;
  lines?: string[];
  overflow?: boolean;
  color?: string;
  colorRole?: string;
  slot?: string;
  assetId?: string;
  empty?: boolean;
  factIds?: string[];
  provenance?: string;
}

/** The PNG of a stored version. */
export function storedPng(c: Pick<Client, 'container'>, version: Pick<StoredVersion, 'image_path'>): Buffer {
  if (version.image_path === null) {
    throw new Error('the version has no image');
  }
  return readFileSync(join(c.container.paths.dataDir, version.image_path));
}

export interface StoredFinalApproval {
  readonly id: string;
  readonly carousel_id: string;
  readonly invalidated_at: string | null;
}

export function finalApprovalRows(c: Pick<Client, 'container'>): StoredFinalApproval[] {
  return c.container.db
    .prepare<StoredFinalApproval>('SELECT id, carousel_id, invalidated_at FROM final_approvals ORDER BY approved_at')
    .all() as StoredFinalApproval[];
}

/** Rewrites the stored text of an element version (seeding before rendering). */
export function rewriteText(c: Pick<Client, 'container'>, versionId: string, change: (text: StoredText) => void): void {
  const text = JSON.parse(storedVersion(c, versionId).text) as StoredText;
  change(text);
  c.container.db.prepare('UPDATE element_versions SET text = ? WHERE id = ?').run([JSON.stringify(text), versionId]);
}

/** Rewrites the stored render model of an element version (seeding after rendering). */
export function rewriteRenderModel(
  c: Pick<Client, 'container'>,
  versionId: string,
  change: (model: RenderModelView) => void,
): void {
  const model = renderModelOf(storedVersion(c, versionId));
  change(model);
  c.container.db
    .prepare('UPDATE element_versions SET render_model = ? WHERE id = ?')
    .run([JSON.stringify(model), versionId]);
}

/** The segments of a stored field (throws when the field is missing). */
export function storedSegments(text: StoredText, field: string): StoredSegment[] {
  const found = text.fields.find((entry) => entry.field === field);
  if (found === undefined) {
    throw new Error(`no ${field} field`);
  }
  return found.segments;
}

// ---------------------------------------------------------------------------------------------------------------
// Stage wrappers for the workflow test seam
// ---------------------------------------------------------------------------------------------------------------

/** The stage the static module registry registers under `name`. */
export function registeredStage(name: StageName): AnyStage {
  for (const serverModule of serverModules) {
    const stage = serverModule.stages?.find((candidate) => candidate.name === name);
    if (stage !== undefined) {
      return stage as unknown as AnyStage;
    }
  }
  throw new Error(`no module registers the ${name} stage`);
}

/** A stage that runs `seed` and then delegates every step to `inner` (the real stage by default). */
export function seededStage(
  name: StageName,
  seed: (ctx: StageContext) => Promise<void> | void,
  inner: AnyStage = registeredStage(name),
): AnyStage {
  const stage = inner as unknown as {
    input: unknown;
    output: unknown;
    load(ctx: StageContext): Promise<unknown>;
    run(input: unknown, ctx: StageContext): Promise<unknown>;
    persist(output: unknown, ctx: StageContext): Promise<void>;
  };
  return {
    name,
    input: stage.input,
    output: stage.output,
    load: async (ctx: StageContext) => {
      await seed(ctx);
      return stage.load(ctx);
    },
    run: (input: unknown, ctx: StageContext) => stage.run(input, ctx),
    persist: (output: unknown, ctx: StageContext) => stage.persist(output, ctx),
  } as unknown as AnyStage;
}

export interface SwitchableStage {
  readonly stage: AnyStage;
  /** Replaces the delegate for the runs started afterwards. */
  use(delegate: AnyStage): void;
}

/** A stage whose delegate the test can replace between runs (each run reads the delegate at `load`). */
export function switchableStage(name: StageName, initial: AnyStage = registeredStage(name)): SwitchableStage {
  let current = initial as unknown as {
    input: { parse(value: unknown): unknown };
    output: { parse(value: unknown): unknown };
    load(ctx: StageContext): Promise<unknown>;
    run(input: unknown, ctx: StageContext): Promise<unknown>;
    persist(output: unknown, ctx: StageContext): Promise<void>;
  };
  const byRun = new Map<string, typeof current>();
  const delegateOf = (ctx: StageContext): typeof current => byRun.get(ctx.runId) ?? current;
  const stage = {
    name,
    // The runner parses with these pass-through schemas; the run's delegate parses its input once at `load` and its
    // output once at `run`, with its own schemas.
    input: { parse: (value: unknown) => value },
    output: { parse: (value: unknown) => value },
    load: async (ctx: StageContext) => {
      byRun.set(ctx.runId, current);
      const delegate = delegateOf(ctx);
      return delegate.input.parse(await delegate.load(ctx));
    },
    run: async (input: unknown, ctx: StageContext) => {
      const delegate = delegateOf(ctx);
      return delegate.output.parse(await delegate.run(input, ctx));
    },
    persist: (output: unknown, ctx: StageContext) => delegateOf(ctx).persist(output, ctx),
  };
  return {
    stage: stage as unknown as AnyStage,
    use: (delegate) => {
      current = delegate as unknown as typeof current;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// MANUAL_DATA setups (T52, AD-38): marked competition with pinned team names, and the unlinked import
// ---------------------------------------------------------------------------------------------------------------

/** ID of the catalogue link marked `noAcceptedPublicSource` written by the tests. */
export const MARKED_ID = 'liga-atestada';

/** The T23 manual import sample `liga-manual` (deep copy). */
export function ligaManualDocument(): Json {
  return JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8')) as Json;
}

/** `demo-only` with the MANUAL_DATA source of `demo-manual`. */
export function demoWithManualDocument(): Json {
  const document = fixtureConfigDocument('demo-only');
  sourcesOf(document).push(manualSourceEntry());
  return document;
}

/** Identity map of the marked competition: the pinned names of every team of the import. */
export function markedIdentityMap(): Json {
  const teams = ((ligaManualDocument()['selections'] as Json[])[0] as Json)['teams'] as {
    key: string;
    name: string;
  }[];
  return {
    competitionId: MARKED_ID,
    seasonId: '2026',
    teams: teams.map((team) => ({
      teamId: team.key,
      officialName: team.name,
      aliases: [],
      sourceKeys: [{ sourceId: 'manual', teamKey: team.key }],
    })),
  };
}

/** Catalogue with the marked link binding the manual competition `liga-manual`. */
export const MARKED_CATALOGUE: Json = Object.freeze({
  links: [
    {
      id: MARKED_ID,
      name: 'Liga Atestada',
      reference: false,
      noAcceptedPublicSource: true,
      bindings: [{ sourceId: 'manual', competitionRef: 'liga-manual' }],
    },
  ],
  restrictToLinks: false,
}) as Json;

/** The selection of matchday 1 of the marked competition. */
export const MARKED_MD1: ProjectSelection = Object.freeze({ ...LIGA_MANUAL_MD1, competitionId: MARKED_ID });

/**
 * A rooted app (T52) with the DEMO_DATA and MANUAL_DATA sources and the `liga-manual` sample imported; `marked`
 * writes the marked catalogue and the pinned identity map, otherwise the manual competition stays unlinked.
 */
export async function manualRootedApp(cleanup: Cleanup, options: { readonly marked: boolean }): Promise<RootedApp> {
  const app = await startRootedApp({
    document: demoWithManualDocument(),
    ...(options.marked ? { catalogue: MARKED_CATALOGUE, identityMaps: [markedIdentityMap()] } : {}),
  });
  cleanup.add(() => app.close());
  await importApplied(app, jsonImport(ligaManualDocument()));
  return app;
}

/** Manually approves every eligible fact of a run (refusals of ineligible facts are accepted); returns the count. */
export async function approveFactsManually(c: Client, projectId: string, runId: string, facts: readonly Fact[]) {
  let approved = 0;
  for (const fact of facts) {
    const response = await c.send('PUT', `/projects/${projectId}/runs/${runId}/facts/${fact.factId}/manual-approval`);
    expect([200, 409], response.body).toContain(response.statusCode);
    approved += response.statusCode === 200 ? 1 : 0;
  }
  return approved;
}
