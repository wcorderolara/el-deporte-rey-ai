/**
 * Every operation of `contracts/http-api.openapi.yaml` exercised on the running server (T43; AD-04; R-219, R-224,
 * R-288; T10-F17; T11H-F01, F06, F11, F14; V-49). Three temporary apps of the T41 test support, `inject` only:
 * - DEMO_DATA and MANUAL_DATA (`demo-manual`, committed fixtures, stub AI): catalogue, projects, runs, facts, the
 *   review cycle, final approval, export, history and trace, imports with their originals and versions, manual
 *   approval and revocation, brand assets and templates, with the problem answers of each step (404, 409 with
 *   `items`, `facts` and `refusalReason`, 400 IMPORT_REJECTED with `importErrors`);
 * - LIVE_DATA over the replay transport of the recorded provider responses (no network): catalogue, a full run, facts
 *   and draft, so that provider-shaped data reaches every response kind;
 * - LIVE_DATA with an exhausted request budget: 503 PROVIDER_RATE_LIMITED with `retryAfterSeconds`.
 *
 * Every answer is checked against the contract (declared status, media type, JSON Schema of the status, problem
 * shape) by the contract client. The scenario steps run in order and share state, like an operator session; the
 * per-operation tests at the end require every operation to have been answered with its success status and every
 * answer to conform. All data is synthetic.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Draft,
  Element,
  Export,
  ExportDetail,
  Fact,
  FactListResponse,
  ImportSummary,
  Project,
  Run,
  Template,
} from '@edr/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../vitest.setup.js';
import {
  FIXTURES_DIR,
  type Json,
  LIGA_DEMO_MD1,
  type ProjectSelection,
  TOKEN_VARIABLE,
  type TestApp,
  expectNoNetworkViolations,
  fixtureConfigDocument,
  providerResponsesDirectory,
  readJson,
  replayTransport,
  sourcesOf,
  startTestApp,
  testLiveAdapter,
} from '../support/index.js';

import type { JsonValue } from './support/contract-document.js';
import { providerValues, responseFindings, type ProviderValues } from './support/neutrality.js';
import { OPERATION_IDS, syntheticPng } from './support/requests.js';
import {
  ContractClient,
  ContractSpec,
  describeExchange,
  type CallOptions,
  type Exchange,
  type ProblemBody,
} from './support/served.js';

let spec: ContractSpec;
let demo: TestApp;
let live: TestApp;
let limited: TestApp;
let warned: TestApp;
let d: ContractClient;
let l: ContractClient;
let r: ContractClient;
let w: ContractClient;
let provider: ProviderValues;

const MANUAL_DIR = join(FIXTURES_DIR, 'manual');
/** Steps that run the workflow or start apps get a margin over the default timeouts on a loaded host. */
const RUN_TIMEOUT = 30_000;

/** The configured provider-backed LIVE_DATA source of the live fixture configuration. */
function liveSourceOf(document: Json): Json {
  const source = sourcesOf(document).find(
    (entry) => entry['mode'] === 'LIVE_DATA' && entry['adapter'] !== testLiveAdapter.kind,
  );
  if (source === undefined) {
    throw new Error('no LIVE_DATA source');
  }
  return source;
}

const LIVE_SOURCE_ID = String(liveSourceOf(fixtureConfigDocument('live'))['id']);
/** The reference-shaped competition of the live catalogue links (fixtures/config/live.catalogue.json). */
const LIVE_SELECTION: ProjectSelection = {
  competitionId: 'copa-continental',
  sourceId: LIVE_SOURCE_ID,
  seasonId: '2026',
  stageId: 'league-stage',
  matchday: 1,
};
/** The second recorded competition, listed by discovery as `<sourceId>-<localKey>` (not linked). */
const LIVE_SECOND_ID = `${LIVE_SOURCE_ID}-${
  (readJson<Json>(join(providerResponsesDirectory(), '_manifest.json'))['secondCompetition'] as { localKey: string })
    .localKey
}`;
const MANUAL_SELECTION: ProjectSelection = {
  competitionId: 'manual-liga-manual',
  sourceId: 'manual',
  seasonId: '2026',
  stageId: 'torneo-apertura',
  matchday: 1,
};

beforeAll(async () => {
  spec = await ContractSpec.load();
  provider = providerValues();
  demo = await startTestApp({ base: 'demo-manual', scenario: 'default' });
  live = await startTestApp({
    base: 'live',
    egress: replayTransport(),
    env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
  });
  limited = await startTestApp({
    base: 'live',
    egress: replayTransport(),
    env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
    mutate: (document) => {
      const source = liveSourceOf(document);
      source['options'] = { ...(source['options'] as Json), requestsPerMinute: 2, researchReservedSlots: 1 };
    },
  });
  // The translated team name of this AI fixture is a run of capitalized tokens: a capitalized_tokens warning (OD-26).
  warned = await startTestApp({
    base: 'demo-only',
    scenario: 'accented-names',
    mutate: (document) => {
      const ai = (document['providers'] as Json)['ai'] as Json;
      ai['options'] = { ...(ai['options'] as Json), scenario: 'translated-team-name' };
    },
  });
  d = new ContractClient(demo, spec);
  l = new ContractClient(live, spec);
  r = new ContractClient(limited, spec);
  w = new ContractClient(warned, spec);
  await d.call('listManagedCompetitions');
  const createdCompetition = await d.call('createCompetition', { json: { name: 'Competición de prueba' } });
  const managedCompetitionId = String((createdCompetition.body as { id: string }).id);
  const providersResponse = await l.call('listSportsProviders');
  const providerEntry = (providersResponse.body as { providers: { key: string }[] }).providers[0];
  if (!providerEntry) throw new Error('The test live adapter must be listed.');
  const externalList = await l.call('listExternalCompetitions', { params: { providerKey: providerEntry.key } });
  if (externalList.status !== 200)
    throw new Error(`External provider fixture failed (${externalList.status}): ${externalList.text}`);
  const firstExternal = (externalList.body as { competitions: { externalCompetitionId: string }[] }).competitions[0];
  const bindingCompetition = await l.call('createCompetition', { json: { name: 'Competición vinculada' } });
  const bindingCompetitionId = String((bindingCompetition.body as { id: string }).id);
  await l.call('getCompetitionProviderBinding', { params: { competitionId: bindingCompetitionId } });
  if (!firstExternal) throw new Error('The live fixture must provide one external competition.');
  await l.call('setCompetitionProviderBinding', {
    params: { competitionId: bindingCompetitionId },
    json: {
      providerKey: providerEntry.key,
      externalCompetitionId: firstExternal.externalCompetitionId,
      mode: 'provider',
    },
  });
  await l.call('getCompetitionProviderBinding', { params: { competitionId: bindingCompetitionId } });
  const externalSeasons = await l.call('listCompetitionExternalSeasons', {
    params: { competitionId: bindingCompetitionId },
  });
  const externalSeasonId = (externalSeasons.body as { seasons: { externalSeasonId: string }[] }).seasons[0]
    ?.externalSeasonId;
  if (!externalSeasonId) throw new Error('The live fixture must provide one external season.');
  await l.call('getCompetitionImportCapabilities', {
    params: { competitionId: bindingCompetitionId, externalSeasonId },
  });
  const importPreview = await l.call('createCompetitionImportPreview', {
    params: { competitionId: bindingCompetitionId },
    json: { externalSeasonId, resources: ['season'] },
  });
  const previewId = String((importPreview.body as { preview: { previewId: string } }).preview.previewId);
  await l.call('getCompetitionImportPreview', {
    params: { competitionId: bindingCompetitionId, previewId },
  });
  const startedOperation = await l.call('startCompetitionImportOperation', {
    params: { competitionId: bindingCompetitionId },
    json: { externalSeasonId, resources: ['season'] },
  });
  const operationId = String((startedOperation.body as { operation: { operationId: string } }).operation.operationId);
  await l.call('getCompetitionImportOperation', { params: { competitionId: bindingCompetitionId, operationId } });
  await l.call('streamCompetitionImportOperation', { params: { competitionId: bindingCompetitionId, operationId } });
  await l.call('cancelCompetitionImportOperation', { params: { competitionId: bindingCompetitionId, operationId } });
  const applicationPlan = await l.call('planCompetitionImportApplication', {
    params: { competitionId: bindingCompetitionId, previewId },
    json: { decisions: [] },
  });
  const planHash = String((applicationPlan.body as { plan: { planHash: string } }).plan.planHash);
  const startedApplication = await l.call('startCompetitionImportApplication', {
    params: { competitionId: bindingCompetitionId, previewId },
    json: { decisions: [], planHash },
  });
  const applicationOperationId = String(
    (startedApplication.body as { operation: { operationId: string } }).operation.operationId,
  );
  await l.call('streamCompetitionImportApplication', {
    params: { competitionId: bindingCompetitionId, operationId: applicationOperationId },
  });
  await l.call('getCompetitionImportApplication', {
    params: { competitionId: bindingCompetitionId, operationId: applicationOperationId },
  });
  await l.call('cancelCompetitionImportApplication', {
    params: { competitionId: bindingCompetitionId, operationId: applicationOperationId },
  });
  await l.call('removeCompetitionProviderBinding', { params: { competitionId: bindingCompetitionId } });
  await d.call('getCompetition', { params: { competitionId: managedCompetitionId } });
  await d.call('listManagedSeasons', { params: { competitionId: managedCompetitionId } });
  const createdSeason = await d.call('createManagedSeason', {
    params: { competitionId: managedCompetitionId },
    json: { label: 'Temporada contractual' },
  });
  const managedSeasonId = String((createdSeason.body as { id: string }).id);
  await d.call('getManagedSeason', {
    params: { competitionId: managedCompetitionId, seasonId: managedSeasonId },
  });
  await d.call('updateManagedSeason', {
    params: { competitionId: managedCompetitionId, seasonId: managedSeasonId },
    json: { label: 'Temporada contractual actualizada' },
  });
  const createdTeam = await d.call('createManagedTeam', {
    json: { name: 'Equipo contractual', region: 'Región de prueba' },
  });
  const managedTeamId = String((createdTeam.body as { id: string }).id);
  await d.call('updateManagedTeam', {
    params: { teamId: managedTeamId },
    json: { name: 'Equipo contractual actualizado', region: 'Región de prueba' },
  });
  await d.call('listManagedTeams');
  await d.call('getManagedTeam', { params: { teamId: managedTeamId } });
  const participantParams = { competitionId: managedCompetitionId, seasonId: managedSeasonId };
  await d.call('listCompetitionTeams', { params: { competitionId: managedCompetitionId } });
  await d.call('addCompetitionTeam', {
    params: { competitionId: managedCompetitionId },
    json: { teamId: managedTeamId },
  });
  await d.call('listSeasonParticipants', { params: participantParams });
  await d.call('addSeasonParticipant', { params: participantParams, json: { teamId: managedTeamId } });
  await d.call('listSeasonParticipants', { params: participantParams });
  const awayTeam = await d.call('createManagedTeam', { json: { name: 'Otro equipo contractual' } });
  const awayTeamId = String((awayTeam.body as { id: string }).id);
  await d.call('addCompetitionTeam', {
    params: { competitionId: managedCompetitionId },
    json: { teamId: awayTeamId },
  });
  await d.call('addSeasonParticipant', { params: participantParams, json: { teamId: awayTeamId } });
  const phase = await d.call('createCompetitionStage', {
    params: participantParams,
    json: { name: 'Fase contractual' },
  });
  const stageId = String((phase.body as { id: string }).id);
  await d.call('listCompetitionStages', { params: participantParams });
  await d.call('getCompetitionStage', { params: { ...participantParams, stageId } });
  await d.call('updateCompetitionStage', {
    params: { ...participantParams, stageId },
    json: { name: 'Fase contractual editada' },
  });
  const directRound = await d.call('createSeasonRound', {
    params: participantParams,
    json: { name: 'Jornada contractual' },
  });
  const directRoundId = String((directRound.body as { id: string }).id);
  await d.call('listSeasonRounds', { params: participantParams });
  await d.call('getSeasonRound', { params: { ...participantParams, roundId: directRoundId } });
  await d.call('updateCompetitionRound', {
    params: { ...participantParams, roundId: directRoundId },
    json: { name: 'Jornada contractual editada' },
  });
  await d.call('deleteCompetitionRound', {
    params: { ...participantParams, roundId: directRoundId },
  });
  const stageRound = await d.call('createStageRound', {
    params: { ...participantParams, stageId },
    json: { name: 'Ronda contractual' },
  });
  const stageRoundId = String((stageRound.body as { id: string }).id);
  await d.call('listStageRounds', { params: { ...participantParams, stageId } });
  const fixture = await d.call('createCompetitionMatch', {
    params: participantParams,
    json: { homeTeamId: managedTeamId, awayTeamId, stageId, roundId: stageRoundId },
  });
  const matchId = String((fixture.body as { id: string }).id);
  await d.call('listCompetitionMatches', { params: participantParams });
  await d.call('getCompetitionMatch', { params: { ...participantParams, matchId } });
  await d.call('updateCompetitionMatchSchedule', {
    params: { ...participantParams, matchId },
    json: { kickoffAt: '2027-05-10T18:00:00Z' },
  });
  await d.call('updateCompetitionMatchResult', {
    params: { ...participantParams, matchId },
    json: { status: 'finished', homeScore: 2, awayScore: 1 },
  });
  await d.call('listCompetitionMatchResultHistory', { params: { ...participantParams, matchId } });
  const unusedTeam = await d.call('createManagedTeam', { json: { name: 'Equipo sin partidos' } });
  const unusedTeamId = String((unusedTeam.body as { id: string }).id);
  await d.call('addSeasonParticipant', { params: participantParams, json: { teamId: unusedTeamId } });
  await d.call('removeSeasonParticipant', {
    params: { ...participantParams, teamId: unusedTeamId },
  });
  await d.call('removeCompetitionTeam', {
    params: { competitionId: managedCompetitionId, teamId: unusedTeamId },
  });
  const batchTeams = await Promise.all([
    d.call('createManagedTeam', { json: { name: 'Equipo lote uno' } }),
    d.call('createManagedTeam', { json: { name: 'Equipo lote dos' } }),
  ]);
  const batchTeamIds = batchTeams.map((entry) => String((entry.body as { id: string }).id));
  for (const teamId of batchTeamIds) {
    await d.call('addCompetitionTeam', { params: { competitionId: managedCompetitionId }, json: { teamId } });
  }
  await d.call('addSeasonParticipantsBatch', { params: participantParams, json: { teamIds: batchTeamIds } });
  for (const teamId of batchTeamIds) {
    await d.call('removeSeasonParticipant', { params: { ...participantParams, teamId } });
  }
}, RUN_TIMEOUT);

afterAll(async () => {
  await Promise.all([demo?.close(), live?.close(), limited?.close(), warned?.close()]);
});

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

/** Calls an operation that must succeed; returns its body. */
async function ok<T>(client: ContractClient, operationId: string, options: CallOptions = {}): Promise<T> {
  const exchange = await client.call(operationId, options);
  expect(exchange.status, describeExchange(exchange)).toBe(spec.successStatus(operationId));
  expect(exchange.violations, describeExchange(exchange)).toEqual([]);
  return exchange.body as T;
}

/** Calls an operation that must answer a conforming problem with the given status and code. */
async function problem(
  client: ContractClient,
  operationId: string,
  options: CallOptions,
  status: number,
  code: string,
): Promise<ProblemBody> {
  const exchange = await client.call(operationId, options);
  expect(exchange.status, describeExchange(exchange)).toBe(status);
  expect(exchange.violations, describeExchange(exchange)).toEqual([]);
  const body = exchange.body as ProblemBody;
  expect(body.code, describeExchange(exchange)).toBe(code);
  return body;
}

async function settle(t: TestApp, runId: string): Promise<void> {
  await t.projects.runnerFor(t.container).settled(runId);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Headers of a served operator file (T10-F12, T11H-F11, V-49). */
function expectSandboxedFile(exchange: Exchange): void {
  expect(exchange.headers['x-content-type-options']).toBe('nosniff');
  expect(exchange.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
  expect(exchange.headers['cross-origin-resource-policy']).toBe('same-origin');
}

function draftElements(draft: Draft): Element[] {
  return draft.carousels.flatMap((carousel) => carousel.elements);
}

/** Acknowledges every failed, unacknowledged warning of an element's current version, one check per request. */
async function acknowledge(client: ContractClient, element: Element): Promise<number> {
  let count = 0;
  for (const result of element.currentVersion.qa) {
    if (result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null) {
      await ok(client, 'acknowledgeQaWarnings', {
        params: { carouselId: element.carouselId, elementId: element.id },
        json: { versionId: element.currentVersion.id, checks: [result.check] },
      });
      count += 1;
    }
  }
  return count;
}

const state: {
  project?: Project;
  run?: Run;
  facts?: FactListResponse;
  draft?: Draft;
  exported?: Export;
  csvImport?: ImportSummary;
  csvBytes?: Buffer;
  jsonImport?: ImportSummary;
  formImport?: ImportSummary;
  manualProject?: Project;
  manualRun?: Run;
} = {};

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`an earlier step did not produce ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// DEMO_DATA and MANUAL_DATA scenario
// ---------------------------------------------------------------------------------------------------------------

describe('DEMO_DATA and MANUAL_DATA operations on the running app', { timeout: RUN_TIMEOUT }, () => {
  it('serves health, settings and the catalogue, with 404 for unknown catalogue IDs (T11H-F06)', async () => {
    expect(await ok(d, 'getHealth')).toEqual({ status: 'ok' });
    await ok(d, 'getSettings');
    const catalogue = await ok<{ competitions: { id: string; sources: { sourceId: string }[] }[] }>(
      d,
      'listCompetitions',
    );
    const liga = catalogue.competitions.find((entry) => entry.id === LIGA_DEMO_MD1.competitionId);
    expect(liga?.sources.map((source) => source.sourceId)).toContain(LIGA_DEMO_MD1.sourceId);
    const ids = { competitionId: LIGA_DEMO_MD1.competitionId, sourceId: LIGA_DEMO_MD1.sourceId };
    const seasons = await ok<{ seasons: { id: string }[] }>(d, 'listSeasons', { params: ids });
    expect(seasons.seasons.map((season) => season.id)).toContain(LIGA_DEMO_MD1.seasonId);
    const stages = await ok<{ stages: { id: string }[] }>(d, 'listStages', {
      params: { ...ids, seasonId: LIGA_DEMO_MD1.seasonId },
    });
    expect(stages.stages.map((stage) => stage.id)).toContain(LIGA_DEMO_MD1.stageId);

    await problem(d, 'listSeasons', { params: { ...ids, competitionId: 'liga-sin-registro' } }, 404, 'NOT_FOUND');
    await problem(d, 'listSeasons', { params: { ...ids, sourceId: 'fuente-sin-registro' } }, 404, 'NOT_FOUND');
    await problem(d, 'listStages', { params: { ...ids, seasonId: '1999' } }, 404, 'NOT_FOUND');
    await problem(
      d,
      'listStages',
      { params: { ...ids, competitionId: 'liga-sin-registro', seasonId: LIGA_DEMO_MD1.seasonId } },
      404,
      'NOT_FOUND',
    );
  });

  it('creates, lists, reads and updates a project; refuses an unavailable selection with refusalReason', async () => {
    const created = await ok<Project>(d, 'createProject', { json: LIGA_DEMO_MD1 });
    state.project = created;
    expect(created).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true, latestRun: null });
    const refused = await problem(
      d,
      'createProject',
      { json: { ...LIGA_DEMO_MD1, seasonId: '1999' } },
      409,
      'SELECTION_UNAVAILABLE',
    );
    expect(refused.refusalReason).not.toBeNull();
    const list = await ok<{ projects: { id: string }[] }>(d, 'listProjects');
    expect(list.projects.map((entry) => entry.id)).toContain(created.id);
    await ok(d, 'getProject', { params: { projectId: created.id } });
    expect(
      await ok<Project>(d, 'updateProject', { params: { projectId: created.id }, json: { language: 'en' } }),
    ).toMatchObject({ language: 'en' });
    await ok(d, 'updateProject', { params: { projectId: created.id }, json: { language: 'es' } });
    expect(await ok<{ runs: unknown[] }>(d, 'listRuns', { params: { projectId: created.id } })).toEqual({ runs: [] });
    const noDraft = await d.call('getActiveDraft', { params: { projectId: created.id } });
    expect(noDraft.violations, describeExchange(noDraft)).toEqual([]);
    expect(noDraft.status).toBe(404);
  });

  it('runs the workflow and serves the run, the runs and the facts', async () => {
    const project = required(state.project, 'project');
    const started = await ok<Run>(d, 'startRun', { params: { projectId: project.id }, json: { kind: 'full' } });
    await settle(demo, started.id);
    const run = await ok<Run>(d, 'getRun', { params: { projectId: project.id, runId: started.id } });
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    state.run = run;
    const runs = await ok<{ runs: Run[] }>(d, 'listRuns', { params: { projectId: project.id } });
    expect(runs.runs.map((entry) => entry.id)).toEqual([run.id]);
    const facts = await ok<FactListResponse>(d, 'listFacts', { params: { projectId: project.id, runId: run.id } });
    expect(facts.dataMode).toBe('DEMO_DATA');
    expect(facts.facts.length).toBeGreaterThan(0);
    state.facts = facts;
    await problem(
      d,
      'getRun',
      { params: { projectId: project.id, runId: '00000000-0000-4000-8000-0000000000ff' } },
      404,
      'NOT_FOUND',
    );
  });

  it('serves the draft and slide images; refuses final approval and export before approvals', async () => {
    const project = required(state.project, 'project');
    const draft = await ok<Draft>(d, 'getActiveDraft', { params: { projectId: project.id } });
    state.draft = draft;
    const carousel = draft.carousels[0];
    expect(carousel).toBeDefined();
    const slides = draftElements(draft).filter((element) => element.kind === 'slide');
    expect(slides.length).toBeGreaterThan(0);
    for (const slide of slides) {
      const image = await d.call('getSlideImage', { params: { versionId: slide.currentVersion.id } });
      expect(image.status, describeExchange(image)).toBe(200);
      expect(image.mediaType).toBe('image/png');
      expect(image.violations).toEqual([]);
    }
    const carouselId = required(carousel, 'carousel').id;
    const refused = await problem(d, 'approveCarousel', { params: { carouselId } }, 409, 'FINAL_APPROVAL_REFUSED');
    expect(refused.items?.length ?? 0).toBeGreaterThan(0);
    await problem(d, 'exportCarousel', { params: { carouselId } }, 409, 'FINAL_APPROVAL_REQUIRED');
  });

  it('regenerates one element, refuses a stale version, acknowledges warnings and approves every element', async () => {
    const draft = required(state.draft, 'draft');
    const target = draftElements(draft).find((element) => element.kind === 'caption') ?? draftElements(draft)[0];
    const element = required(target, 'element');
    const regenerated = await ok<Element>(d, 'regenerateElement', {
      params: { carouselId: element.carouselId, elementId: element.id },
    });
    expect(regenerated.currentVersion.id).not.toBe(element.currentVersion.id);
    await problem(
      d,
      'approveElement',
      {
        params: { carouselId: element.carouselId, elementId: element.id },
        json: { versionId: element.currentVersion.id },
      },
      409,
      'VERSION_CONFLICT',
    );

    const project = required(state.project, 'project');
    const current = await ok<Draft>(d, 'getActiveDraft', { params: { projectId: project.id } });
    for (const entry of draftElements(current)) {
      await acknowledge(d, entry);
      await ok(d, 'approveElement', {
        params: { carouselId: entry.carouselId, elementId: entry.id },
        json: { versionId: entry.currentVersion.id },
      });
    }
    const first = required(draftElements(current)[0], 'first element');
    const withdrawn = await ok<Element>(d, 'withdrawElementApproval', {
      params: { carouselId: first.carouselId, elementId: first.id },
    });
    expect(withdrawn.currentVersion.state).not.toBe('approved');
    await ok(d, 'approveElement', {
      params: { carouselId: first.carouselId, elementId: first.id },
      json: { versionId: first.currentVersion.id },
    });
    state.draft = await ok<Draft>(d, 'getActiveDraft', { params: { projectId: project.id } });
  });

  it('final-approves and exports without any outbound request (R-219), then serves history and traces', async () => {
    const draft = required(state.draft, 'draft');
    const carousel = required(draft.carousels[0], 'carousel');
    await ok(d, 'approveCarousel', { params: { carouselId: carousel.id } });
    const egress = demo.egress.requests.length;
    const ai = demo.aiRequests.length;
    const exported = await ok<Export>(d, 'exportCarousel', { params: { carouselId: carousel.id } });
    expect(demo.egress.requests.length).toBe(egress);
    expect(demo.aiRequests.length).toBe(ai);
    expectNoNetworkViolations();
    state.exported = exported;
    await ok<undefined>(d, 'downloadExport', { params: { exportId: exported.id } });

    const project = required(state.project, 'project');
    const history = await ok<{ exports: Export[] }>(d, 'listProjectExports', { params: { projectId: project.id } });
    expect(history.exports.map((entry) => entry.id)).toEqual([exported.id]);
    const detail = await ok<ExportDetail>(d, 'getExport', { params: { exportId: exported.id } });
    expect(detail.id).toBe(exported.id);
    const positions = exported.files.filter((file) => file.kind === 'slide_image').map((file) => file.position);
    expect(positions.length).toBeGreaterThan(0);
    for (const position of positions) {
      await ok(d, 'traceExportedSlide', { params: { exportId: exported.id, position } });
    }
    await problem(
      d,
      'traceExportedSlide',
      { params: { exportId: exported.id, position: Math.max(...positions) + 1 } },
      404,
      'NOT_FOUND',
    );
  });

  it('sets excluded matches, which starts a redraft run (202)', async () => {
    const project = required(state.project, 'project');
    const facts = required(state.facts, 'facts');
    const matchKey = facts.facts.find((fact) => fact.subject.matchKey !== undefined)?.subject.matchKey;
    const run = await ok<Run>(d, 'setExcludedMatches', {
      params: { projectId: project.id },
      json: { excludedMatchKeys: [required(matchKey, 'match key')] },
    });
    expect(run.kind).toBe('redraft');
    await settle(demo, run.id);
  });

  it('applies JSON, CSV (BOM and CRLF, NFD file name) and form imports and serves them (T11H-F01, F11, V-49)', async () => {
    const json = readFileSync(join(MANUAL_DIR, 'valid', 'liga-manual.json'));
    state.jsonImport = await ok<ImportSummary>(d, 'createImport', {
      json: {
        channel: 'json_file',
        fileName: 'liga-manual.json',
        declaredSource: 'Acta sintética',
        contentBase64: json.toString('base64'),
      },
    });

    // A CSV file as a spreadsheet saves it: a UTF-8 byte-order mark and CRLF line ends, and a decomposed file name.
    const csvText = readFileSync(join(MANUAL_DIR, 'valid', 'liga-manual-matches.csv'), 'utf8').replace(
      /\r?\n/g,
      '\r\n',
    );
    const csvBytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csvText, 'utf8')]);
    const nfdName = 'Jornada Ñandú.csv'.normalize('NFD');
    expect(nfdName).not.toBe(nfdName.normalize('NFC'));
    const csv = await ok<ImportSummary>(d, 'createImport', {
      json: {
        channel: 'csv_file',
        fileName: nfdName,
        declaredSource: null,
        contentBase64: csvBytes.toString('base64'),
      },
    });
    state.csvImport = csv;
    state.csvBytes = csvBytes;
    expect(csv.originalSha256).toBe(sha256(csvBytes));

    const form = JSON.parse(readFileSync(join(MANUAL_DIR, 'valid', 'liga-manual.form.json'), 'utf8')) as Json;
    state.formImport = await ok<ImportSummary>(d, 'createImport', { json: form });

    const rejected = await problem(
      d,
      'createImport',
      {
        json: {
          channel: 'json_file',
          fileName: 'duplicada.json',
          declaredSource: null,
          contentBase64: readFileSync(join(MANUAL_DIR, 'invalid', 'duplicate-match.json')).toString('base64'),
        },
      },
      400,
      'IMPORT_REJECTED',
    );
    expect(rejected.importErrors?.map((error) => error.problem)).toContain('duplicate_match');

    const imports = await ok<{ imports: ImportSummary[] }>(d, 'listImports');
    expect(imports.imports).toHaveLength(3);
    const read = await ok<ImportSummary>(d, 'getImport', { params: { importId: csv.id } });
    expect(read.originalSha256).toBe(sha256(csvBytes));
    expect(read.channel).toBe('csv_file');
  });

  it('serves each original unchanged as an attachment with a server-generated ASCII file name (T11H-F11, V-49)', async () => {
    const csv = required(state.csvImport, 'csv import');
    const cases: [ImportSummary, string][] = [
      [csv, `original-${csv.id}.csv`],
      [required(state.jsonImport, 'json import'), `original-${required(state.jsonImport, 'json import').id}.json`],
      [required(state.formImport, 'form import'), `original-${required(state.formImport, 'form import').id}.form.json`],
    ];
    for (const [summary, fileName] of cases) {
      const exchange = await d.call('getImportOriginal', { params: { importId: summary.id } });
      expect(exchange.status, describeExchange(exchange)).toBe(200);
      expect(exchange.violations).toEqual([]);
      expect(exchange.mediaType).toBe('application/octet-stream');
      expect(sha256(exchange.raw)).toBe(summary.originalSha256);
      const disposition = String(exchange.headers['content-disposition']);
      expect(disposition).toBe(`attachment; filename="${fileName}"`);
      expect(/^[\x20-\x7e]+$/.test(disposition)).toBe(true);
      expectSandboxedFile(exchange);
    }
    const original = await d.call('getImportOriginal', { params: { importId: csv.id } });
    expect(original.raw.equals(required(state.csvBytes, 'csv bytes'))).toBe(true);
  });

  it('serves the manual selection history and its versions', async () => {
    const csv = required(state.csvImport, 'csv import');
    const history = await ok<{ selections: { versions: { versionId: string; current: boolean }[] }[] }>(
      d,
      'listManualSelections',
      { query: { competitionId: csv.competitionId, seasonId: csv.seasonId } },
    );
    expect(history.selections.length).toBeGreaterThan(0);
    for (const selection of csv.selections) {
      await ok(d, 'getManualVersion', { params: { versionId: selection.versionId } });
    }
    const json = required(state.jsonImport, 'json import');
    const superseded = await ok<{ supersededAt: string | null }>(d, 'getManualVersion', {
      params: { versionId: required(json.selections[0], 'selection').versionId },
    });
    expect(superseded.supersededAt).not.toBeNull();
    await problem(
      d,
      'listManualSelections',
      { query: { competitionId: 'liga-sin-registro', seasonId: '2026' } },
      404,
      'NOT_FOUND',
    );
  });

  it('approves and revokes a MANUAL_DATA fact manually, with refusalReason on refusals (PD-13, R-071)', async () => {
    const created = await ok<Project>(d, 'createProject', { json: MANUAL_SELECTION });
    expect(created.dataMode).toBe('MANUAL_DATA');
    state.manualProject = created;
    const started = await ok<Run>(d, 'startRun', { params: { projectId: created.id }, json: { kind: 'full' } });
    await settle(demo, started.id);
    const run = await ok<Run>(d, 'getRun', { params: { projectId: created.id, runId: started.id } });
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await ok<FactListResponse>(d, 'listFacts', { params: { projectId: created.id, runId: run.id } });
    expect(facts.dataMode).toBe('MANUAL_DATA');
    const score = facts.facts.find((fact) => fact.kind === 'match_score' && fact.status === 'unverified');
    const params = { projectId: created.id, runId: run.id, factId: required(score, 'unverified score').factId };

    const approved = await ok<Fact>(d, 'approveFactManually', { params });
    expect(approved.status).toBe('manually_approved');
    const again = await problem(d, 'approveFactManually', { params }, 409, 'MANUAL_APPROVAL_REFUSED');
    expect(again.refusalReason).toBe('already_approved');
    const revoked = await ok<Fact>(d, 'revokeManualFactApproval', { params });
    expect(revoked.status).toBe('unverified');
    const revokedAgain = await problem(d, 'revokeManualFactApproval', { params }, 409, 'MANUAL_APPROVAL_REFUSED');
    expect(revokedAgain.refusalReason).toBe('not_approved');

    // A DEMO_DATA fact is never eligible.
    const demoProject = required(state.project, 'project');
    const demoRun = required(state.run, 'run');
    const demoFact = required(required(state.facts, 'facts').facts[0], 'demo fact');
    const refused = await problem(
      d,
      'approveFactManually',
      { params: { projectId: demoProject.id, runId: demoRun.id, factId: demoFact.factId } },
      409,
      'MANUAL_APPROVAL_REFUSED',
    );
    expect(['not_manual_data', 'verified', 'not_latest_run']).toContain(refused.refusalReason);
  });

  it('registers, lists, updates and serves a brand asset; refuses a duplicate', async () => {
    const image = syntheticPng(16, 8, 'served-operations');
    const asset = await ok<{ id: string; sha256: string; active: boolean }>(d, 'registerBrandAsset', {
      query: { kind: 'brand_logo', label: 'Logotipo sintético' },
      payload: image,
      contentType: 'image/png',
    });
    expect(asset.sha256).toBe(sha256(image));
    await problem(
      d,
      'registerBrandAsset',
      { query: { kind: 'brand_logo', label: 'Otra etiqueta' }, payload: image, contentType: 'image/png' },
      409,
      'DUPLICATE_ASSET',
    );
    const list = await ok<{ assets: { id: string }[] }>(d, 'listBrandAssets');
    expect(list.assets.map((entry) => entry.id)).toContain(asset.id);
    const file = await d.call('getBrandAssetFile', { params: { assetId: asset.id } });
    expect(file.status, describeExchange(file)).toBe(200);
    expect(file.violations).toEqual([]);
    expect(file.mediaType).toBe('image/png');
    expect(file.raw.equals(image)).toBe(true);
    expectSandboxedFile(file);
    expect(
      await ok<{ active: boolean }>(d, 'updateBrandAsset', { params: { assetId: asset.id }, json: { active: false } }),
    ).toMatchObject({ active: false });
  });

  it('lists templates and renders previews in both languages; 404 for an unknown template', async () => {
    const templates = await ok<{ templates: Template[] }>(d, 'listTemplates');
    expect(templates.templates.length).toBeGreaterThan(0);
    const template = required(templates.templates[0], 'template');
    for (const language of ['es', 'en']) {
      const preview = await d.call('previewTemplate', { params: { templateId: template.id }, query: { language } });
      expect(preview.status, describeExchange(preview)).toBe(200);
      expect(preview.mediaType).toBe('image/png');
      expect(preview.violations).toEqual([]);
    }
    await problem(d, 'previewTemplate', { params: { templateId: 'plantilla-sin-registro' } }, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Visual QA warnings (OD-09, OD-26)
// ---------------------------------------------------------------------------------------------------------------

describe('visual QA warning acknowledgement on the running app (OD-09, OD-26)', { timeout: RUN_TIMEOUT }, () => {
  it('acknowledges a failed capitalized_tokens warning; refuses a check without a failed warning and approval of a failed version', async () => {
    const project = await ok<Project>(w, 'createProject', { json: LIGA_DEMO_MD1 });
    const started = await ok<Run>(w, 'startRun', { params: { projectId: project.id }, json: { kind: 'full' } });
    await settle(warned, started.id);
    const run = await ok<Run>(w, 'getRun', { params: { projectId: project.id, runId: started.id } });
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const draft = await ok<Draft>(w, 'getActiveDraft', { params: { projectId: project.id } });
    const warnedElement = draftElements(draft).find((element) =>
      element.currentVersion.qa.some((result) => result.check === 'capitalized_tokens' && result.outcome === 'fail'),
    );
    const element = required(warnedElement, 'element with a capitalized_tokens warning');
    const params = { carouselId: element.carouselId, elementId: element.id };
    const versionId = element.currentVersion.id;
    const acknowledged = await ok<Element>(w, 'acknowledgeQaWarnings', {
      params,
      json: { versionId, checks: ['capitalized_tokens'] },
    });
    const result = acknowledged.currentVersion.qa.find((entry) => entry.check === 'capitalized_tokens');
    expect(result?.acknowledgedAt).not.toBeNull();
    // Acknowledging again keeps the first acknowledgement.
    const again = await ok<Element>(w, 'acknowledgeQaWarnings', {
      params,
      json: { versionId, checks: ['capitalized_tokens'] },
    });
    expect(again.currentVersion.qa.find((entry) => entry.check === 'capitalized_tokens')?.acknowledgedAt).toBe(
      result?.acknowledgedAt,
    );
    if (!element.currentVersion.qa.some((entry) => entry.check === 'style_consistency' && entry.outcome === 'fail')) {
      await problem(
        w,
        'acknowledgeQaWarnings',
        { params, json: { versionId, checks: ['style_consistency'] } },
        400,
        'VALIDATION_FAILED',
      );
    }
    // The translated name is also a content flag (NON_OFFICIAL_TEAM_NAME), so approval is refused.
    const code = element.currentVersion.contentFlags.length > 0 ? 'CONTENT_FLAGGED' : 'QA_FAILED';
    if (element.currentVersion.contentFlags.length > 0 || element.currentVersion.state === 'qa_failed') {
      await problem(w, 'approveElement', { params, json: { versionId } }, 409, code);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// LIVE_DATA over the replay transport
// ---------------------------------------------------------------------------------------------------------------

describe('LIVE_DATA operations over recorded provider responses (no network)', { timeout: RUN_TIMEOUT }, () => {
  it('serves the catalogue, and 404 for unknown IDs without a provider request for them (T11H-F06)', async () => {
    await ok(l, 'getSettings');
    const catalogue = await ok<{ competitions: { id: string }[] }>(l, 'listCompetitions');
    expect(catalogue.competitions.map((entry) => entry.id)).toContain(LIVE_SELECTION.competitionId);
    const ids = { competitionId: LIVE_SELECTION.competitionId, sourceId: LIVE_SOURCE_ID };
    await ok(l, 'listSeasons', { params: ids });
    await ok(l, 'listStages', { params: { ...ids, seasonId: LIVE_SELECTION.seasonId } });
    const before = live.egress.requests.length;
    await problem(l, 'listSeasons', { params: { ...ids, competitionId: 'liga-sin-registro' } }, 404, 'NOT_FOUND');
    await problem(l, 'listSeasons', { params: { ...ids, sourceId: 'fuente-sin-registro' } }, 404, 'NOT_FOUND');
    await problem(l, 'listStages', { params: { ...ids, seasonId: '1999' } }, 404, 'NOT_FOUND');
    expect(live.egress.requests.length).toBe(before);
  });

  it('runs a LIVE_DATA project and serves its run, facts and draft', async () => {
    const project = await ok<Project>(l, 'createProject', { json: LIVE_SELECTION });
    expect(project.dataMode).toBe('LIVE_DATA');
    const started = await ok<Run>(l, 'startRun', { params: { projectId: project.id }, json: { kind: 'full' } });
    await settle(live, started.id);
    const run = await ok<Run>(l, 'getRun', { params: { projectId: project.id, runId: started.id } });
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await ok<FactListResponse>(l, 'listFacts', { params: { projectId: project.id, runId: run.id } });
    expect(facts.dataMode).toBe('LIVE_DATA');
    expect(facts.facts.flatMap((fact) => fact.evidence).length).toBeGreaterThan(0);
    const draft = await ok<Draft>(l, 'getActiveDraft', { params: { projectId: project.id } });
    // Approval of LIVE content: approved, or refused with the blocking facts (unconfirmed permission, R-430).
    const element = required(draftElements(draft)[0], 'live element');
    await acknowledge(l, element);
    const approval = await l.call('approveElement', {
      params: { carouselId: element.carouselId, elementId: element.id },
      json: { versionId: element.currentVersion.id },
    });
    expect(approval.violations, describeExchange(approval)).toEqual([]);
    expect([200, 409]).toContain(approval.status);
    if (approval.status === 409) {
      const body = approval.body as ProblemBody;
      expect(['APPROVAL_BLOCKED', 'CONTENT_FLAGGED', 'QA_FAILED', 'QA_ACK_REQUIRED']).toContain(body.code);
      if (body.code === 'APPROVAL_BLOCKED') {
        expect(body.facts?.length ?? 0).toBeGreaterThan(0);
      }
    }
    expectNoNetworkViolations();
  });

  it('answers 503 PROVIDER_RATE_LIMITED with retryAfterSeconds when the discovery budget is used up (R-291)', async () => {
    await ok(r, 'listCompetitions');
    const before = limited.egress.requests.length;
    const refused = await problem(
      r,
      'listSeasons',
      { params: { competitionId: LIVE_SECOND_ID, sourceId: LIVE_SOURCE_ID } },
      503,
      'PROVIDER_RATE_LIMITED',
    );
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(limited.egress.requests.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Coverage and conformance of every operation
// ---------------------------------------------------------------------------------------------------------------

function allExchanges(): Exchange[] {
  return [...d.exchanges, ...l.exchanges, ...r.exchanges, ...w.exchanges];
}

describe.each(OPERATION_IDS)('operation %s on the running app', (operationId) => {
  it('was answered with its success status, and every answer conforms to the contract', () => {
    const exchanges = allExchanges().filter((exchange) => exchange.operationId === operationId);
    expect(exchanges.map((exchange) => exchange.status)).toContain(spec.successStatus(operationId));
    const violations = exchanges
      .filter((exchange) => exchange.violations.length > 0)
      .map((exchange) => `${describeExchange(exchange)}: ${exchange.violations.join('; ')}`);
    expect(violations).toEqual([]);
  });
});

describe('problem codes and fields exercised (T10-F17)', () => {
  it('covers importErrors, retryAfterSeconds, refusalReason, items and the 404 and 409 codes', () => {
    const problems = allExchanges()
      .filter((exchange) => exchange.mediaType === 'application/problem+json')
      .map((exchange) => exchange.body as ProblemBody);
    const codes = new Set(problems.map((entry) => entry.code));
    for (const code of [
      'NOT_FOUND',
      'SELECTION_UNAVAILABLE',
      'FINAL_APPROVAL_REFUSED',
      'FINAL_APPROVAL_REQUIRED',
      'VERSION_CONFLICT',
      'IMPORT_REJECTED',
      'MANUAL_APPROVAL_REFUSED',
      'DUPLICATE_ASSET',
      'PROVIDER_RATE_LIMITED',
    ]) {
      expect(codes, code).toContain(code);
    }
    expect(problems.some((entry) => (entry.importErrors?.length ?? 0) > 0)).toBe(true);
    expect(problems.some((entry) => typeof entry.retryAfterSeconds === 'number')).toBe(true);
    expect(problems.some((entry) => typeof entry.refusalReason === 'string')).toBe(true);
    expect(problems.some((entry) => (entry.items?.length ?? 0) > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Closed per-kind fact values and per-check QA details (T10-F17)
// ---------------------------------------------------------------------------------------------------------------

describe('response conformance relies on closed per-kind values and per-check details (T10-F17)', () => {
  function validator(operationId: string) {
    const status = spec.successStatus(operationId);
    return (body: unknown) => spec.check(operationId, status, 'application/json', Buffer.from(JSON.stringify(body)));
  }

  function served<T>(operationId: string): T {
    const exchange = allExchanges().find(
      (entry) => entry.operationId === operationId && entry.status === spec.successStatus(operationId),
    );
    return required(exchange, operationId).body as T;
  }

  it('refuses a fact value with an extra key, the value of another kind and an extra evidence key', () => {
    const check = validator('listFacts');
    const facts = served<FactListResponse>('listFacts');
    expect(check(facts).violations).toEqual([]);
    const index = facts.facts.findIndex((fact) => fact.kind === 'match_score' && fact.value !== null);
    expect(index).toBeGreaterThanOrEqual(0);
    const mutate = (change: (fact: Record<string, unknown>) => void): FactListResponse => {
      const copy = structuredClone(facts);
      change(copy.facts[index] as unknown as Record<string, unknown>);
      return copy;
    };
    const cases = [
      mutate((fact) => ((fact['value'] as Record<string, unknown>)['penalties'] = 1)),
      mutate((fact) => (fact['value'] = { homeTeamId: 'local', awayTeamId: 'visita' })),
      mutate((fact) => (fact['candidateValue'] = { kickoff: '2026-08-01T17:45:00Z' })),
      mutate((fact) => ((fact['evidence'] as Record<string, unknown>[])[0]!['url'] = 'x')),
      mutate((fact) => (fact['providerFields'] = {})),
    ];
    for (const body of cases) {
      expect(check(body).violations.length, JSON.stringify(body.facts[index])).toBeGreaterThan(0);
    }
  });

  it('refuses QA details with an extra key or the details of another check', () => {
    const check = validator('getActiveDraft');
    const draft = served<Draft>('getActiveDraft');
    expect(check(draft).violations).toEqual([]);
    const elements = draftElements(draft);
    const element = elements.findIndex((entry) => entry.currentVersion.qa.length > 1);
    expect(element).toBeGreaterThanOrEqual(0);
    const qaOf = (body: Draft) =>
      draftElements(body)[element]!.currentVersion.qa as unknown as Record<string, unknown>[];
    for (const [index, result] of qaOf(draft).entries()) {
      const extra = structuredClone(draft);
      (qaOf(extra)[index]!['details'] as Record<string, unknown>)['unexpectedKey'] = 1;
      expect(check(extra).violations.length, String(result['check'])).toBeGreaterThan(0);
      const other = qaOf(draft).find((entry) => entry['check'] !== result['check']);
      const swapped = structuredClone(draft);
      qaOf(swapped)[index]!['details'] = structuredClone(required(other, 'other check')['details']);
      const swappedViolations = check(swapped).violations;
      if (
        JSON.stringify(Object.keys(other?.['details'] ?? {})) !== JSON.stringify(Object.keys(result['details'] ?? {}))
      ) {
        expect(swappedViolations.length, `${String(result['check'])} with other details`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Provider neutrality of every response (R-288, T11H-F14)
// ---------------------------------------------------------------------------------------------------------------

describe('provider neutrality of the served responses (R-288, T11H-F14)', () => {
  it('finds no provider identifier, field name or host, and no URL-like sourceRef or ref, in any response', () => {
    const findings: string[] = [];
    let references = 0;
    for (const exchange of allExchanges()) {
      if (exchange.body === undefined) {
        continue;
      }
      for (const finding of responseFindings(exchange.body as JsonValue, provider)) {
        findings.push(`${exchange.operationId} ${exchange.url}: ${finding}`);
      }
      references += (exchange.text.match(/"(sourceRef|ref)":/g) ?? []).length;
    }
    expect(findings).toEqual([]);
    // The LIVE run produced attribution references, so the reference check had input.
    expect(references).toBeGreaterThan(0);
    const liveFacts = l.exchanges.find((exchange) => exchange.operationId === 'listFacts' && exchange.status === 200);
    const refs = ((liveFacts?.body as FactListResponse | undefined)?.facts ?? []).flatMap((fact) =>
      fact.evidence.map((evidence) => evidence.sourceRef),
    );
    expect(refs.length).toBeGreaterThan(0);
  });

  it('detects provider values, the host and URL-like references (the check is effective)', () => {
    const seeded = {
      facts: [{ evidence: [{ sourceRef: `https://${provider.host}/v4/matches`, crest: 'x' }] }],
      ref: '//cdn.example/x',
      note: `see ${provider.host}`,
      tla: 'ABC',
    };
    const findings = responseFindings(seeded as unknown as JsonValue, provider);
    expect(findings.some((finding) => finding.startsWith('provider host'))).toBe(true);
    expect(findings.filter((finding) => finding.endsWith('URL-like reference'))).toHaveLength(2);
    expect(findings.some((finding) => finding.includes('crest'))).toBe(true);
    expect(findings.some((finding) => finding.includes('tla'))).toBe(true);
    // Configuration data of the LIVE source is masked, provider codes of the recorded responses are not.
    const configured = { sourceId: provider.configuredSource[0], sourceName: provider.configuredSource[1] };
    expect(responseFindings(configured as unknown as JsonValue, provider)).toEqual([]);
  });
});
