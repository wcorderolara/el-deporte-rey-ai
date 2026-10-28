/**
 * Export, history and traceability end to end on the real server (configuration loading, migrations, the static
 * module registry, every registered workflow stage), with the T41 test support, generated configurations in temporary
 * directories and `inject` only (architecture.md sections 11.2 and 14; R-216, R-218 to R-221, R-240, R-269, R-272,
 * R-287; AD-38; PD-17):
 * - a DEMO_DATA project of the committed fixtures (`fixtures/sports`, stub AI over `fixtures/ai`): exported with the
 *   demonstration flag, no egress request, no AI request and no blocked connection during the export, listed in the
 *   history with its export time, and every exported slide traced to its facts, statuses and evidence with source,
 *   mode and retrieval time;
 * - a MANUAL_DATA competition marked `noAcceptedPublicSource` with pinned team names (the T52 setup, written by the
 *   test into a temporary project root): content using MANUALLY_APPROVED facts is exported with
 *   `operatorAttested: true`, every used fact listed as `manually_approved`, never as verified, and traced to the
 *   import version.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Draft,
  DraftSchema,
  type Export,
  ExportSchema,
  type Fact,
  ProjectListResponseSchema,
  type SlideTrace,
  SlideTraceSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type Json,
  LIGA_DEMO_MD1,
  expectNoNetworkViolations,
  fixtureConfigDocument,
  sourcesOf,
} from '../../../test/support/index.js';
import {
  type Cleanup,
  type RootedApp,
  cleanups,
  importApplied,
  jsonImport,
  manualBytes,
  manualSourceEntry,
  start,
  startRootedApp,
} from '../../../test/integration/ingestion/support.js';

import { ManifestSchema, type Manifest } from './manifest.js';
import { acknowledgeWarnings, elementPath } from './test/support.js';

const cleanup: Cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

type Client = Pick<RootedApp, 'get' | 'send' | 'container'>;

async function draftOf(t: Client, projectId: string): Promise<Draft> {
  const response = await t.get(`/projects/${projectId}/draft`);
  expect(response.statusCode, response.body).toBe(200);
  return DraftSchema.parse(response.json());
}

/** Approves every element of every carousel, final-approves each carousel; returns the draft. */
async function approveEverything(t: Client, projectId: string): Promise<Draft> {
  const send = (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => t.send(method, path, body);
  for (const carousel of (await draftOf(t, projectId)).carousels) {
    for (const element of carousel.elements) {
      await acknowledgeWarnings(send, element);
      const approved = await t.send('PUT', `${elementPath(element)}/approval`, {
        versionId: element.currentVersion.id,
      });
      expect(approved.statusCode, approved.body).toBe(200);
    }
    const final = await t.send('PUT', `/carousels/${carousel.id}/final-approval`);
    expect(final.statusCode, final.body).toBe(200);
  }
  return draftOf(t, projectId);
}

async function exportOf(t: Client, carouselId: string): Promise<Export> {
  const response = await t.send('POST', `/carousels/${carouselId}/exports`);
  expect(response.statusCode, response.body).toBe(201);
  return ExportSchema.parse(response.json());
}

function manifestOf(t: Client, written: Export): Manifest {
  const text = readFileSync(join(t.container.paths.dataDir, written.directory, 'manifest.json'), 'utf8');
  return ManifestSchema.parse(JSON.parse(text));
}

async function traceOf(t: Client, exportId: string, position: number): Promise<SlideTrace> {
  const response = await t.get(`/exports/${exportId}/slides/${String(position)}/trace`);
  expect(response.statusCode, response.body).toBe(200);
  return SlideTraceSchema.parse(response.json());
}

function referencedFacts(t: Client, versionId: string): string[] {
  return t.container.db
    .prepare<{ fact_id: string }>('SELECT fact_id FROM element_fact_refs WHERE element_version_id = ? ORDER BY fact_id')
    .all([versionId])
    .map((row) => row.fact_id);
}

// ---------------------------------------------------------------------------------------------------------------
// DEMO_DATA
// ---------------------------------------------------------------------------------------------------------------

describe('DEMO_DATA export, history and trace (R-218 to R-221, R-269, R-287)', () => {
  it('exports with the demonstration flag and no network call, lists it, and traces every slide to its sources', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const draft = await approveEverything(t, project.id);
    const carousel = draft.carousels[0];
    if (carousel === undefined) {
      throw new Error('no carousel');
    }

    // R-219: the export opens no connection, makes no egress request and no AI request.
    const egressBefore = t.egress.requests.length;
    const aiBefore = t.aiRequests.length;
    const written = await exportOf(t, carousel.id);
    expect(t.egress.requests.length).toBe(egressBefore);
    expect(t.aiRequests.length).toBe(aiBefore);
    expectNoNetworkViolations();

    expect(written).toMatchObject({ projectId: project.id, dataMode: 'DEMO_DATA', demonstration: true });
    const manifest = manifestOf(t, written);
    expect(manifest).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true, source: { id: 'demo-a' } });
    expect(manifest).not.toHaveProperty('operatorAttested');
    const names = new Map(
      sourcesOf(fixtureConfigDocument('demo-only')).map((source) => [String(source['id']), String(source['name'])]),
    );
    expect(manifest.sources.map((source) => source.id)).toEqual(['demo-a', 'demo-b']);
    for (const source of manifest.sources) {
      expect(source).toEqual({ id: source.id, name: names.get(source.id), dataMode: 'DEMO_DATA' });
    }
    expect(manifest.facts.length).toBeGreaterThan(0);
    expect(new Set(manifest.facts.map((fact) => fact.status))).toEqual(new Set(['verified']));

    // R-220: the project list shows the export time and the exported state.
    const projects = ProjectListResponseSchema.parse((await t.get('/projects')).json());
    expect(projects.projects.find((entry) => entry.id === project.id)).toMatchObject({
      approvalState: 'exported',
      lastExportAt: written.exportedAt,
      demonstration: true,
    });

    // R-221, R-287: every exported slide traces to its facts with status, evidence source, mode and retrieval.
    const slides = written.files.filter((file) => file.kind === 'slide_image');
    for (const file of slides) {
      const trace = await traceOf(t, written.id, file.position);
      expect(trace).toMatchObject({
        exportId: written.id,
        position: file.position,
        elementVersionId: file.elementVersionId,
        dataMode: 'DEMO_DATA',
      });
      expect(trace.facts.map((fact) => fact.factId).sort()).toEqual(referencedFacts(t, file.elementVersionId ?? ''));
    }
    const matchSlide = carousel.elements.find((element) => element.slideType === 'match_result');
    const matchFile = slides.find((file) => file.elementVersionId === matchSlide?.currentVersion.id);
    const trace = await traceOf(t, written.id, matchFile?.position ?? 0);
    const score = trace.facts.find((fact) => fact.kind === 'match_score') as Fact;
    expect(score).toMatchObject({ status: 'verified', unverifiedReason: null, dispute: null, manualApproval: null });
    const supporting = score.evidence.filter((evidence) => evidence.relation === 'supports');
    expect(supporting.map((evidence) => evidence.sourceId).sort()).toEqual(['demo-a', 'demo-b']);
    for (const evidence of supporting) {
      expect(evidence).toMatchObject({
        dataMode: 'DEMO_DATA',
        importVersionId: null,
        sourceName: names.get(evidence.sourceId),
      });
      expect(evidence.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(evidence.sourceRef.length).toBeGreaterThan(0);
    }

    // Positions outside the export: 404 for a missing slide, 400 for an invalid position.
    expect((await t.get(`/exports/${written.id}/slides/${String(slides.length + 1)}/trace`)).statusCode).toBe(404);
    expect((await t.get(`/exports/${written.id}/slides/0/trace`)).statusCode).toBe(400);
    expect((await t.get(`/exports/${written.id}/slides/100/trace`)).statusCode).toBe(400);
    expectNoNetworkViolations();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// MANUAL_DATA of a marked competition (PD-17, AD-38)
// ---------------------------------------------------------------------------------------------------------------

describe('operator-attested export of a marked manual competition (R-272, AD-38 item 5)', () => {
  const MARKED_ID = 'liga-atestada';

  function ligaManualDocument(): Json {
    return JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8')) as Json;
  }

  function baseDocument(): Json {
    const document = fixtureConfigDocument('demo-only');
    sourcesOf(document).push(manualSourceEntry());
    return document;
  }

  /** Identity map of the marked competition: the pinned names of every team of the import. */
  function identityMap(): Json {
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

  const markedCatalogue = {
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
  };

  async function runMarked(a: RootedApp): Promise<{ projectId: string; runId: string; facts: Fact[] }> {
    const created = await a.send('POST', '/projects', {
      competitionId: MARKED_ID,
      sourceId: 'manual',
      seasonId: '2026',
      stageId: 'torneo-apertura',
      matchday: 1,
    });
    expect(created.statusCode, created.body).toBe(201);
    const projectId = (created.json() as { id: string }).id;
    const started = await a.send('POST', `/projects/${projectId}/runs`, { kind: 'full' });
    expect(started.statusCode).toBe(202);
    const runId = (started.json() as { id: string }).id;
    let status = 'running';
    for (let attempt = 0; attempt < 800 && (status === 'running' || status === 'pending'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      status = ((await a.get(`/projects/${projectId}/runs/${runId}`)).json() as { status: string }).status;
    }
    expect(status).toBe('completed');
    const facts = ((await a.get(`/projects/${projectId}/runs/${runId}/facts`)).json() as { facts: Fact[] }).facts;
    return { projectId, runId, facts };
  }

  it('exports content of MANUALLY_APPROVED facts with operatorAttested and per-fact statuses, never verified', async () => {
    const a = await startRootedApp({
      document: baseDocument(),
      catalogue: markedCatalogue,
      identityMaps: [identityMap()],
    });
    cleanup.add(() => a.close());
    await importApplied(a, jsonImport(ligaManualDocument()));
    const { projectId, runId, facts } = await runMarked(a);
    for (const fact of facts) {
      const response = await a.send('PUT', `/projects/${projectId}/runs/${runId}/facts/${fact.factId}/manual-approval`);
      expect([200, 409]).toContain(response.statusCode);
    }

    const draft = await approveEverything(a, projectId);
    const carousel = draft.carousels[0];
    if (carousel === undefined) {
      throw new Error('no carousel');
    }
    const written = await exportOf(a, carousel.id);
    expect(written).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
    expectNoNetworkViolations();

    const manifest = manifestOf(a, written);
    expect(manifest.operatorAttested).toBe(true);
    expect(manifest).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false, source: { id: 'manual' } });
    expect(manifest.sources.map((source) => source.id)).toEqual(['manual']);
    expect(manifest.facts.length).toBeGreaterThan(0);
    expect(manifest.facts.some((fact) => fact.status === 'manually_approved')).toBe(true);
    expect(manifest.facts.some((fact) => fact.status === 'verified')).toBe(false);
    for (const fact of manifest.facts) {
      expect(fact.evidence.every((entry) => entry.dataMode === 'MANUAL_DATA' && entry.importVersionId !== null)).toBe(
        true,
      );
    }
    // The stored status stays unverified: manual approval is never written as verification (R-071).
    const stored = a.container.db
      .prepare<{ status: string }>('SELECT DISTINCT status FROM facts WHERE id IN (SELECT value FROM json_each(?))')
      .all([JSON.stringify(manifest.facts.map((fact) => fact.factId))]);
    expect(stored.map((row) => row.status)).toEqual(['unverified']);
    const manifestText = readFileSync(join(a.container.paths.dataDir, written.directory, 'manifest.json'), 'utf8');
    expect(manifestText).not.toMatch(/"verified"/);

    // The trace shows MANUALLY_APPROVED facts with their manual approval and the import version they come from.
    const matchSlide = carousel.elements.find((element) => element.slideType === 'match_result');
    const file = written.files.find((entry) => entry.elementVersionId === matchSlide?.currentVersion.id);
    const trace = await traceOf(a, written.id, file?.position ?? 0);
    expect(trace.dataMode).toBe('MANUAL_DATA');
    const score = trace.facts.find((fact) => fact.kind === 'match_score') as Fact;
    expect(score).toMatchObject({ status: 'manually_approved', unverifiedReason: null, value: null });
    expect(score.manualApproval?.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(score.evidence.length).toBeGreaterThan(0);
    for (const evidence of score.evidence) {
      expect(evidence).toMatchObject({ sourceId: 'manual', dataMode: 'MANUAL_DATA', accepted: false });
      expect(evidence.importVersionId).not.toBeNull();
    }
    expect(trace.facts.some((fact) => fact.status === 'verified')).toBe(false);
  });
});
