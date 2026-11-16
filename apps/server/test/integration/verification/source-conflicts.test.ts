/**
 * UI-06.3 traceability of conflicting sports sources. Two separate mechanisms handle a disagreement between sources;
 * this suite follows one synthetic dispute through each of them end to end:
 *
 * 1. Field provenance of a locally managed competition bound to a provider (PD-ARCH-01D-C/D): every imported field
 *    records its origin (`provider`, `manual`, `manual_override`); a manual correction of an imported value becomes a
 *    protected override; a later provider observation that contradicts it is shown as a conflict, kept local by
 *    default, never applied silently, and replaced only by an explicit, recorded `accept_incoming` decision.
 *    Complements `apps/server/src/modules/competitions/import-apply.int.test.ts` ("updates values that still match the
 *    imported baseline and protects manual edits"), where the provider repeats its first value.
 * 2. Fact verification between independent sources of a project run (R-205, R-230): a disagreement between accepted
 *    sources is a disputed fact whose dispute record keeps every observation with its source; it blocks publication,
 *    is left out of the content, and a later run never rewrites an earlier run's confirmed value or dispute record.
 *    Complements `apps/server/test/integration/verification/verification.test.ts`.
 *
 * All data is synthetic (stub adapter documents and the DEMO_DATA fixture scenarios); nothing reaches a provider.
 */
import { join } from 'node:path';

import {
  type Fact,
  type FactListResponse,
  ImportApplicationHistoryResponseSchema,
  type ImportApplyDecision,
  type ImportApplyOperation,
  ImportApplyOperationResponseSchema,
  ImportApplyOperationStartResponseSchema,
  type ImportApplyPlan,
  ImportApplyPlanResponseSchema,
  type ImportPreview,
  ImportPreviewResponseSchema,
  SportsFieldProvenanceResponseSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  READ_HEADERS,
  WRITE_HEADERS,
  type ProjectsTestApp,
  projectsTestApp,
  testSources,
} from '../../../src/modules/projects/test/support.js';
import {
  competition,
  fixtureDocument,
  season,
  selection,
  stubAdapter,
} from '../../../src/providers/sports/test/synthetic.js';
import {
  LIGA_DEMO_MD1,
  type TestApp,
  expectNoNetworkViolations,
  startTestApp,
  temporaryDirectory,
} from '../../support/index.js';
import { allElements, draftOf, WORKFLOW_TEST_TIMEOUT } from '../delivery/support.js';
import { cleanups, start } from '../ingestion/support.js';

// ---------------------------------------------------------------------------------------------------------------
// Mechanism 1: field provenance of a provider-bound competition and the protected manual override
// ---------------------------------------------------------------------------------------------------------------

interface ScoreLine {
  readonly key: string;
  readonly home: string;
  readonly away: string;
  readonly kickoff: string;
  readonly status: string;
  readonly score: { home: number; away: number } | null;
}

/** Kickoffs as the local calendar stores them (`Date#toISOString`). */
const STORED_FORM = { m1: '2026-10-20T18:00:00.000Z', m2: '2026-10-20T20:00:00.000Z' } as const;
/** The same kickoffs as a provider sends them (the football-data `utcDate` form, without milliseconds). */
const PROVIDER_FORM = { m1: '2026-10-20T18:00:00Z', m2: '2026-10-20T20:00:00Z' } as const;

/** First provider observation: m1 Club Alfa 2-1 Club Beta, m2 Club Gamma 0-0 Club Delta. */
function firstObservation(kickoffs: { readonly m1: string; readonly m2: string }): ScoreLine[] {
  return [
    { key: 'm1', home: 'alfa', away: 'beta', kickoff: kickoffs.m1, status: 'finished', score: { home: 2, away: 1 } },
    { key: 'm2', home: 'gamma', away: 'delta', kickoff: kickoffs.m2, status: 'finished', score: { home: 0, away: 0 } },
  ];
}

/** A later observation of the same provider that changes only match m1. */
function contradicting(first: readonly ScoreLine[], change: Partial<ScoreLine>): ScoreLine[] {
  return [{ ...first[0]!, ...change }, first[1]!];
}

function providerDocument(matches: readonly ScoreLine[]) {
  return fixtureDocument([
    competition('copa-stub', 'Copa Stub', [
      season('2026', [
        {
          id: 'regular',
          name: 'REGULAR_SEASON',
          order: 1,
          standings: 'expected',
          wholeStage: null,
          matchdays: {
            '1': {
              ...(selection({ stage: 'REGULAR_SEASON', matchday: 1 }) as Record<string, unknown>),
              matches: matches.map((match) => ({
                matchKey: match.key,
                homeTeamKey: match.home,
                awayTeamKey: match.away,
                kickoff: match.kickoff,
                status: match.status,
                score: match.score,
                ref: `fixture:synthetic/selection#${match.key}`,
              })),
            },
          },
        },
      ]),
    ]),
  ]);
}

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

async function boundCompetition(first: readonly ScoreLine[]): Promise<string> {
  const stub = stubAdapter('test-live', 'LIVE_DATA');
  stub.documents.set('stub-a', providerDocument(first));
  h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }), stub });
  const created = await h.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name: 'Liga en disputa' },
  });
  expect(created.statusCode, created.body).toBe(201);
  const competitionId = (created.json() as { id: string }).id;
  const bound = await h.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/provider-binding`,
    headers: WRITE_HEADERS,
    payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'hybrid' },
  });
  expect(bound.statusCode, bound.body).toBe(201);
  return competitionId;
}

async function previewOf(competitionId: string, destinationSeasonId: string | null): Promise<ImportPreview> {
  const response = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews`,
    headers: WRITE_HEADERS,
    payload: {
      externalSeasonId: '2026',
      destinationSeasonId,
      resources: ['season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results'],
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return ImportPreviewResponseSchema.parse(response.json()).preview;
}

async function planOf(
  competitionId: string,
  previewId: string,
  decisions: ImportApplyDecision[] = [],
): Promise<ImportApplyPlan> {
  const response = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews/${previewId}/application-plan`,
    headers: WRITE_HEADERS,
    payload: { decisions },
  });
  expect(response.statusCode, response.body).toBe(200);
  return ImportApplyPlanResponseSchema.parse(response.json()).plan;
}

/** Plans, confirms and waits for an application that must complete. */
async function applied(
  competitionId: string,
  previewId: string,
  decisions: ImportApplyDecision[] = [],
): Promise<ImportApplyOperation> {
  const plan = await planOf(competitionId, previewId, decisions);
  expect(plan.blockers).toEqual([]);
  const accepted = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews/${previewId}/applications`,
    headers: WRITE_HEADERS,
    payload: { decisions, planHash: plan.planHash },
  });
  expect(accepted.statusCode, accepted.body).toBe(202);
  const { operationId } = ImportApplyOperationStartResponseSchema.parse(accepted.json()).operation;
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications/${operationId}`,
      headers: READ_HEADERS,
    });
    const operation = ImportApplyOperationResponseSchema.parse(response.json()).operation;
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) {
      expect(operation.status, operation.errorMessage ?? '').toBe('completed');
      return operation;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('application did not finish');
}

async function provenanceOf(competitionId: string, entityType: 'match' | 'result', entityId: string) {
  const response = await h!.inject({
    method: 'GET',
    url: `/api/v1/competitions/${competitionId}/provenance/${entityType}/${entityId}`,
    headers: READ_HEADERS,
  });
  expect(response.statusCode, response.body).toBe(200);
  return SportsFieldProvenanceResponseSchema.parse(response.json()).fields;
}

function matchOf(home: string, away: string) {
  return h!.db
    .prepare<{ id: string; home_score: number | null; away_score: number | null; kickoff_at: string | null }>(
      'SELECT m.id, r.home_score, r.away_score, m.kickoff_at FROM competition_matches m JOIN match_results r ON r.match_id = m.id JOIN managed_teams ht ON ht.id = m.home_team_id JOIN managed_teams at ON at.id = m.away_team_id WHERE ht.name = ? AND at.name = ?',
    )
    .get([home, away]);
}

function provenanceEvents(competitionId: string, entityId: string, field: string) {
  return h!.db
    .prepare<{
      action: string;
      previous_origin: string | null;
      next_origin: string;
      provider_value_json: string | null;
    }>(
      'SELECT action, previous_origin, next_origin, provider_value_json FROM sports_field_provenance_events WHERE competition_id = ? AND entity_id = ? AND field_name = ? ORDER BY rowid',
    )
    .all([competitionId, entityId, field]);
}

function resultHistory(matchId: string) {
  return h!.db
    .prepare<{ change_type: string; home_score: number | null; away_score: number | null }>(
      'SELECT change_type, home_score, away_score FROM match_result_history WHERE match_id = ? ORDER BY rowid',
    )
    .all([matchId]);
}

function recordedDecisions() {
  return h!.db
    .prepare<{ application_id: string; action: string; external_id: string }>(
      'SELECT application_id, action, external_id FROM competition_import_decisions ORDER BY rowid',
    )
    .all();
}

/**
 * Steps 1 and 2 of the dispute: the provider's 2-1 is imported, then the operator corrects it to 3-1. Returns the
 * local match, its season and the provenance of the protected override.
 */
async function importedThenCorrected(first: readonly ScoreLine[]) {
  const competitionId = await boundCompetition(first);
  const imported = await applied(competitionId, (await previewOf(competitionId, null)).previewId);
  const seasonId = imported.application!.destinationSeasonId;
  const match = matchOf('Club Alfa', 'Club Beta')!;
  expect(match).toMatchObject({ home_score: 2, away_score: 1 });
  expect(await provenanceOf(competitionId, 'result', match.id)).toEqual([
    expect.objectContaining({
      field: 'awayScore',
      origin: 'provider',
      providerKey: 'test-live',
      externalReference: 'm1',
      providerValue: 1,
      protected: false,
      lastApplicationId: imported.application!.applicationId,
    }),
    expect.objectContaining({
      field: 'homeScore',
      origin: 'provider',
      providerKey: 'test-live',
      externalReference: 'm1',
      providerValue: 2,
      protected: false,
      lastApplicationId: imported.application!.applicationId,
    }),
  ]);
  const corrected = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/seasons/${seasonId}/matches/${match.id}/result`,
    headers: WRITE_HEADERS,
    payload: { status: 'finished', homeScore: 3, awayScore: 1 },
  });
  expect(corrected.statusCode, corrected.body).toBe(200);
  // The override is protected and still names the provider value it replaced.
  const overridden = await provenanceOf(competitionId, 'result', match.id);
  expect(overridden).toEqual([
    expect.objectContaining({ field: 'awayScore', origin: 'manual_override', protected: true, providerValue: 1 }),
    expect.objectContaining({ field: 'homeScore', origin: 'manual_override', protected: true, providerValue: 2 }),
  ]);
  expect(provenanceEvents(competitionId, match.id, 'homeScore')).toEqual([
    { action: 'provider_applied', previous_origin: null, next_origin: 'provider', provider_value_json: '2' },
    { action: 'manual_edit', previous_origin: 'provider', next_origin: 'manual_override', provider_value_json: '2' },
  ]);
  return { competitionId, seasonId, match, overridden };
}

const CONFLICTING_RESULT = {
  operation: 'conflict',
  fields: [{ name: 'score', localValue: '3-1', incomingValue: '2-2', protected: true }],
  warnings: ['El marcador local se conserva como valor predeterminado.'],
} as const;

describe('mechanism 1: provider import against a protected manual override (field provenance)', () => {
  it('traces the provider value, the manual override and a contradicting observation; only an explicit, recorded decision replaces the override', async () => {
    const first = firstObservation(STORED_FORM);
    const { competitionId, seasonId, match, overridden } = await importedThenCorrected(first);
    const historyBefore = resultHistory(match.id);

    // 3. A new provider observation contradicts both the correction and the first observation (2-2).
    h!.stub.documents.set('stub-a', providerDocument(contradicting(first, { score: { home: 2, away: 2 } })));

    // 4. The preview shows the conflict as data: both values, the protected local value and the reason.
    const preview = await previewOf(competitionId, seasonId);
    expect(preview.items.find((item) => item.resource === 'results' && item.externalId === 'm1:result')).toMatchObject({
      ...CONFLICTING_RESULT,
      localCandidate: { id: match.id, label: 'Club Alfa vs Club Beta' },
    });
    expect(preview.summary.conflicts).toBeGreaterThan(0);

    // 5. The plan keeps the local value by default and offers only an explicit acceptance; nothing is blocked.
    const plan = await planOf(competitionId, preview.previewId);
    expect(plan.ready).toBe(true);
    expect(plan.reviewItems.find((item) => item.externalId === 'm1:result')).toMatchObject({
      resource: 'results',
      action: 'keep_local',
      decision: null,
      options: ['accept_incoming'],
      reason: 'Hay un marcador local diferente; se conserva el valor local.',
      changes: [{ field: 'marcador', localValue: '3-1', incomingValue: '2-2', applied: false }],
    });
    expect(plan.totals.keepLocal).toBe(1);
    expect(plan.warnings).toContain(
      'Algunos valores locales distintos se conservarán; puedes aceptar el valor entrante por registro.',
    );

    // 6. Applying without a decision overwrites neither the value nor its protection, provenance or history.
    const kept = await applied(competitionId, preview.previewId);
    expect(kept.application!.counts).toMatchObject({ conflictsNotApplied: 1, resultsApplied: 0 });
    expect(kept.application!.notApplied).toEqual([
      {
        resource: 'results',
        externalId: 'm1:result',
        title: 'Club Alfa 2-2 Club Beta',
        action: 'keep_local',
        reason: 'Hay un marcador local diferente; se conserva el valor local.',
      },
    ]);
    expect(matchOf('Club Alfa', 'Club Beta')).toMatchObject({ home_score: 3, away_score: 1 });
    expect(resultHistory(match.id)).toEqual(historyBefore);
    expect(await provenanceOf(competitionId, 'result', match.id)).toEqual(overridden);
    expect(provenanceEvents(competitionId, match.id, 'homeScore').map((event) => event.action)).toEqual([
      'provider_applied',
      'manual_edit',
    ]);
    expect(recordedDecisions()).toEqual([]);
    // The keep-local outcome is part of the stored application and of the competition's import history.
    const history = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications`,
      headers: READ_HEADERS,
    });
    expect(history.statusCode, history.body).toBe(200);
    expect(
      ImportApplicationHistoryResponseSchema.parse(history.json()).applications.find(
        (entry) => entry.applicationId === kept.application!.applicationId,
      )?.notApplied,
    ).toEqual(kept.application!.notApplied);

    // 7. The protection outlives that application: the next snapshot still shows the conflict and keeps the value.
    const again = await previewOf(competitionId, seasonId);
    expect(again.items.find((item) => item.externalId === 'm1:result')).toMatchObject(CONFLICTING_RESULT);
    expect(
      (await planOf(competitionId, again.previewId)).reviewItems.find((item) => item.externalId === 'm1:result'),
    ).toMatchObject({ action: 'keep_local', changes: [{ applied: false }] });

    // 8. Only an explicit accept_incoming decision replaces it; the decision is recorded and audited.
    const decision: ImportApplyDecision = {
      resource: 'results',
      externalId: 'm1:result',
      externalScope: again.items.find((item) => item.externalId === 'm1:result')!.externalScope,
      action: 'accept_incoming',
      localId: null,
    };
    expect((await planOf(competitionId, again.previewId, [decision])).reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'm1:result', action: 'update', decision: 'accept_incoming' }),
      ]),
    );
    const accepted = await applied(competitionId, again.previewId, [decision]);
    expect(matchOf('Club Alfa', 'Club Beta')).toMatchObject({ home_score: 2, away_score: 2 });
    expect(await provenanceOf(competitionId, 'result', match.id)).toEqual([
      expect.objectContaining({ field: 'awayScore', origin: 'provider', protected: false, providerValue: 2 }),
      expect.objectContaining({ field: 'homeScore', origin: 'provider', protected: false, providerValue: 2 }),
    ]);
    expect(provenanceEvents(competitionId, match.id, 'homeScore').at(-1)).toEqual({
      action: 'accept_provider',
      previous_origin: 'manual_override',
      next_origin: 'provider',
      provider_value_json: '2',
    });
    expect(recordedDecisions()).toEqual([
      { application_id: accepted.application!.applicationId, action: 'accept_incoming', external_id: 'm1:result' },
    ]);
    // The earlier corrections stay in the result history; the accepted value is appended, nothing is rewritten.
    const after = resultHistory(match.id);
    expect(after.slice(0, historyBefore.length)).toEqual(historyBefore);
    expect(after.at(-1)).toMatchObject({ home_score: 2, away_score: 2 });
  });

  /** Imports the first observation, then the operator reschedules match m1 to 21 October. */
  async function importedThenRescheduled() {
    const first = firstObservation(STORED_FORM);
    const competitionId = await boundCompetition(first);
    const imported = await applied(competitionId, (await previewOf(competitionId, null)).previewId);
    const seasonId = imported.application!.destinationSeasonId;
    const match = matchOf('Club Alfa', 'Club Beta')!;
    const rescheduled = await h!.inject({
      method: 'PATCH',
      url: `/api/v1/competitions/${competitionId}/seasons/${seasonId}/matches/${match.id}/schedule`,
      headers: WRITE_HEADERS,
      payload: { kickoffAt: '2026-10-21T18:00:00.000Z' },
    });
    expect(rescheduled.statusCode, rescheduled.body).toBe(200);
    return { first, competitionId, seasonId, match };
  }

  it('keeps a manually rescheduled kickoff of an imported match against a later provider kickoff', async () => {
    const { first, competitionId, seasonId } = await importedThenRescheduled();
    // The provider moves the match to a third date.
    h!.stub.documents.set('stub-a', providerDocument(contradicting(first, { kickoff: '2026-10-22T18:00:00.000Z' })));
    const preview = await previewOf(competitionId, seasonId);
    const plan = await planOf(competitionId, preview.previewId);
    expect(plan.reviewItems.find((item) => item.resource === 'matches' && item.externalId === 'm1')).toMatchObject({
      action: 'keep_local',
      options: ['accept_incoming'],
      reason: 'El valor local difiere del último valor importado; se conserva.',
      changes: [
        {
          field: 'kickoffAt',
          localValue: '2026-10-21T18:00:00.000Z',
          incomingValue: '2026-10-22T18:00:00.000Z',
          applied: false,
        },
      ],
    });
    const kept = await applied(competitionId, preview.previewId);
    expect(kept.application!.notApplied).toEqual([
      expect.objectContaining({ resource: 'matches', externalId: 'm1', action: 'keep_local' }),
    ]);
    expect(matchOf('Club Alfa', 'Club Beta')?.kickoff_at).toBe('2026-10-21T18:00:00.000Z');
    expect(recordedDecisions()).toEqual([]);
  });

  // Product defect UI-06.3-D2 (see the suite report): `CompetitionFieldProvenanceService.recordManual` looks the
  // mapping of a `match` field up under the resource `match`, but imported matches are mapped under `matches`
  // (`field-provenance.ts`, `resourceOf`). A manual edit of an imported match's kickoff, status, stage or round is
  // therefore recorded as `manual` and unprotected, and the season page shows it as a plain manual value instead of
  // "Modificado manualmente · Protegido". (The plan still keeps the value through the imported baseline.)
  it('records a manual reschedule of an imported match as a protected manual override', async () => {
    const { competitionId, match } = await importedThenRescheduled();
    expect(
      (await provenanceOf(competitionId, 'match', match.id)).find((field) => field.field === 'kickoffAt'),
    ).toMatchObject({
      origin: 'manual_override',
      protected: true,
      providerKey: 'test-live',
      externalReference: 'm1',
      providerValue: STORED_FORM.m1,
    });
    expect(provenanceEvents(competitionId, match.id, 'kickoffAt').at(-1)).toMatchObject({
      action: 'manual_edit',
      previous_origin: 'provider',
      next_origin: 'manual_override',
    });
  });

  // Product defect UI-06.3-D1 (see the suite report): the preview pairs an incoming match with a local one by an exact
  // string comparison of the kickoff (`import-preview.ts`, `item.kickoff_at === match.kickoff`). The local calendar
  // stores `2026-10-20T18:00:00.000Z`; a provider sends `2026-10-20T18:00:00Z`. The already imported, protected match
  // is then previewed as `new` with no local value and `protected: false`, so the conflict is not presented (the plan
  // and the application still keep the local value: nothing is overwritten).
  it('presents the conflict in the preview when the provider sends its kickoff without milliseconds', async () => {
    const first = firstObservation(PROVIDER_FORM);
    const { competitionId, seasonId, match } = await importedThenCorrected(first);
    h!.stub.documents.set('stub-a', providerDocument(contradicting(first, { score: { home: 2, away: 2 } })));
    const preview = await previewOf(competitionId, seasonId);
    // The plan (mapping based) sees the protected value in both kickoff forms.
    expect(
      (await planOf(competitionId, preview.previewId)).reviewItems.find((item) => item.externalId === 'm1:result'),
    ).toMatchObject({ action: 'keep_local', changes: [{ localValue: '3-1', incomingValue: '2-2', applied: false }] });
    expect(preview.items.find((item) => item.resource === 'results' && item.externalId === 'm1:result')).toMatchObject({
      ...CONFLICTING_RESULT,
      localCandidate: { id: match.id, label: 'Club Alfa vs Club Beta' },
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Mechanism 2: fact verification between independent sources (DEMO_DATA disputed scenarios)
// ---------------------------------------------------------------------------------------------------------------

const cleanup = cleanups();
afterEach(async () => {
  await cleanup.run();
});

/** The score fact of match 01 of matchday 1, which every disputed scenario seeds with a disagreement. */
function scoreOfMatch01(listing: FactListResponse): Fact {
  const fact = listing.facts.find(
    (entry) =>
      entry.kind === 'match_score' &&
      entry.evidence.some((evidence) => evidence.sourceId === 'demo-a' && evidence.sourceRef.endsWith('/match/01')),
  );
  expect(fact).toBeDefined();
  return fact as Fact;
}

async function runOf(t: TestApp, projectId: string) {
  const run = await t.runWorkflow(projectId);
  expect(run.status, JSON.stringify(run.failure)).toBe('completed');
  return { runId: run.id, facts: await t.listFacts(projectId, run.id) };
}

describe(
  'mechanism 2: fact verification between independent sources (disputed scenarios)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it('keeps both observations with their sources, blocks publication, leaves the match out of the content and survives a restart', async () => {
      const data = temporaryDirectory('ui063-dispute');
      cleanup.add(() => data.remove());
      const dataDir = join(data.path, 'data');
      const t = await startTestApp({ base: 'demo-official', scenario: 'disputed-no-match', dataDir });
      let open = true;
      cleanup.add(async () => {
        if (open) await t.close();
      });
      const project = await t.createProject(LIGA_DEMO_MD1);
      const { runId, facts } = await runOf(t, project.id);
      const fact = scoreOfMatch01(facts);

      // Disputed: no value is shown or published, and the reason names every source of the dispute.
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'disputed',
        value: null,
        candidateValue: null,
        blockReason: 'not_verified',
      });
      expect(fact.reason).toMatch(/demo-a.*demo-b/);
      // The dispute record keeps each observation with its source and independence group, and the consultation.
      expect(fact.dispute?.sourceValues.map((entry) => [entry.sourceId, entry.value])).toEqual([
        ['demo-a', { home: 2, away: 1 }],
        ['demo-b', { home: 1, away: 1 }],
        ['demo-official', { home: 2, away: 2 }],
      ]);
      const groups = fact.dispute!.sourceValues.map((entry) => entry.independenceGroup);
      expect(groups.every((group) => group.length > 0)).toBe(true);
      expect(new Set(groups).size).toBe(3);
      expect(fact.dispute).toMatchObject({
        outcome: 'no_match',
        consultedSourceId: 'demo-official',
        resolvedValue: null,
      });
      // Both disagreeing observations stay as evidence with their reference and retrieval time.
      for (const [sourceId, value] of [
        ['demo-a', { home: 2, away: 1 }],
        ['demo-b', { home: 1, away: 1 }],
      ] as const) {
        const evidence = fact.evidence.find((entry) => entry.sourceId === sourceId);
        expect(evidence, sourceId).toMatchObject({ accepted: true, value });
        expect(evidence?.sourceName.length).toBeGreaterThan(0);
        expect(evidence?.sourceRef).toMatch(/\/match\/01$/);
        expect(Number.isNaN(Date.parse(evidence?.retrievedAt ?? ''))).toBe(false);
      }

      // The disputed match is left out of the content: listed as not verified, and no element cites any of its facts.
      const matchKey = String(fact.subject.matchKey);
      const matchFactIds = new Set(
        facts.facts.filter((entry) => entry.subject.matchKey === matchKey).map((entry) => entry.factId),
      );
      const draft = await draftOf(t, project.id);
      for (const leftOut of [facts.leftOutMatches, draft.leftOutMatches]) {
        expect(leftOut.find((entry) => entry.matchKey === matchKey)).toMatchObject({ reason: 'not_verified' });
      }
      const cited = allElements(draft).flatMap((element) =>
        element.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.factId)),
      );
      expect(cited.filter((factId) => factId !== null && matchFactIds.has(factId))).toEqual([]);

      // The record is persisted as it was produced.
      open = false;
      await t.close();
      const restarted = await start(cleanup, { base: 'demo-official', scenario: 'disputed-no-match', dataDir });
      expect(await restarted.listFacts(project.id, runId)).toEqual(facts);
      expect(restarted.egress.requests).toEqual([]);
      expectNoNetworkViolations();
    });

    it('a later run that finds the sources in dispute never rewrites the confirmed value of the earlier run', async () => {
      const data = temporaryDirectory('ui063-rerun');
      cleanup.add(() => data.remove());
      const dataDir = join(data.path, 'data');
      const agreeing = await startTestApp({ base: 'demo-official', scenario: 'default', dataDir });
      let open = true;
      cleanup.add(async () => {
        if (open) await agreeing.close();
      });
      const project = await agreeing.createProject(LIGA_DEMO_MD1);
      const confirmed = await runOf(agreeing, project.id);
      const verified = scoreOfMatch01(confirmed.facts);
      expect(verified).toMatchObject({ status: 'verified', value: { home: 1, away: 0 }, dispute: null });
      open = false;
      await agreeing.close();

      // The same project, researched again after the sources started to disagree.
      const disputed = await start(cleanup, { base: 'demo-official', scenario: 'disputed-no-match', dataDir });
      const second = await runOf(disputed, project.id);
      expect(second.runId).not.toBe(confirmed.runId);
      const fact = scoreOfMatch01(second.facts);
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'disputed',
        value: null,
        candidateValue: null,
      });
      expect(fact.dispute?.sourceValues.map((entry) => entry.sourceId)).toEqual(['demo-a', 'demo-b', 'demo-official']);
      // The earlier run, its verified value and its evidence are unchanged (a historical snapshot).
      expect(await disputed.listFacts(project.id, confirmed.runId)).toEqual(confirmed.facts);
      // No user action turns the new dispute into the earlier confirmed value.
      const approval = await disputed.send(
        'PUT',
        `/projects/${project.id}/runs/${second.runId}/facts/${fact.factId}/manual-approval`,
      );
      expect(approval.statusCode).toBe(409);
      expect(approval.json()).toMatchObject({ code: 'MANUAL_APPROVAL_REFUSED' });
      expect(scoreOfMatch01(await disputed.listFacts(project.id, second.runId))).toEqual(fact);
    });
  },
);
