/**
 * The dynamic catalogue through the HTTP API with the real FootballDataProvider over replayed responses, the
 * ManualDataProvider and the DEMO_DATA fixture adapter (R-243, R-244, R-253, R-282, R-283, R-284, R-286, R-287,
 * R-291; T11H-F06):
 * - one catalogue of LIVE_DATA, MANUAL_DATA and DEMO_DATA competitions with their sources; a competition added to or
 *   removed from the replayed response appears or disappears without a code change or a restart;
 * - seasons and stages exactly as the source reports them (league matchdays, named stages, stages after the league
 *   phase, stages without standings), and a project only for a complete, offered selection;
 * - restricted competitions and seasons marked not available while the others stay usable;
 * - a linked competition with two sources where the operator chooses one, recorded on the project, the retrievals and
 *   the facts;
 * - the request budget: never more than 10 requests in any 60-second window, no per-competition request for the
 *   catalogue, no request for a repeat view, stale listings with their retrieval time or the wait, reserved slots for
 *   research, and 404 without any provider request for unknown or unlisted IDs.
 *
 * The provider is only ever reached through the scripted replay transport; the token is the synthetic marker.
 */
import { join } from 'node:path';

import { CatalogueSchema, type Catalogue, ProblemSchema, SeasonListSchema, StageListSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type Json,
  type ProjectSelection,
  REPO_ROOT,
  type TestApp,
  expectNoNetworkViolations,
  readJson,
  sourcesOf,
} from '../../support/index.js';

import {
  LIVE_SOURCE_ID,
  REFERENCE,
  SECOND,
  SECOND_ID,
  type ScriptedCall,
  type ScriptedReplay,
  answerWithBody,
  cleanups,
  committedLiveDocument,
  importApplied,
  on,
  recorded,
  recordedBody,
  sampleRequest,
  scriptedReplay,
  setLiveOptions,
  startLive,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const REFERENCE_ID = 'copa-continental';
const reference = (season: string, stageId: string, matchday: number | null): ProjectSelection => ({
  competitionId: REFERENCE_ID,
  sourceId: LIVE_SOURCE_ID,
  seasonId: season,
  stageId,
  matchday,
});

async function catalogue(t: TestApp): Promise<Catalogue> {
  const response = await t.get('/catalog/competitions');
  expect(response.statusCode, response.body).toBe(200);
  return CatalogueSchema.parse(response.json());
}

const seasonsPath = (competitionId: string, sourceId = LIVE_SOURCE_ID): string =>
  `/catalog/competitions/${competitionId}/sources/${sourceId}/seasons`;
const stagesPath = (competitionId: string, season: string, sourceId = LIVE_SOURCE_ID): string =>
  `${seasonsPath(competitionId, sourceId)}/${season}/stages`;

/** A copy of the second recorded competition under another ID, code and name (a stub-listed competition). */
function syntheticCompetition(index: number): Json {
  const body = recordedBody('competitions.json');
  const template = (body['competitions'] as Json[]).find((entry) => entry['code'] === SECOND.code) as Json;
  return {
    ...structuredClone(template),
    id: 7000 + index,
    code: `ZS${String(index)}`,
    name: `Torneo Sintético ${String(index)}`,
  };
}

function competitionsBody(competitions: readonly Json[]): Json {
  return { count: competitions.length, filters: {}, competitions };
}

const recordedCompetitions = (): Json[] => recordedBody('competitions.json')['competitions'] as Json[];

/** The largest number of calls in any 60-second window. */
function maxPerWindow(calls: readonly ScriptedCall[]): number {
  let max = 0;
  for (const call of calls) {
    max = Math.max(max, calls.filter((other) => other.at >= call.at && other.at < call.at + 60_000).length);
  }
  return max;
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------------------------
// R-243, R-282
// ---------------------------------------------------------------------------------------------------------------

describe('one catalogue of every mode with its sources (R-243, R-282)', () => {
  it('lists LIVE_DATA, MANUAL_DATA and DEMO_DATA competitions together, each with its sources', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress, { base: committedLiveDocument() });
    await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));

    const body = await catalogue(t);
    const modesOf = (id: string): string[][] =>
      (body.competitions.find((entry) => entry.id === id)?.sources ?? []).map((source) => [
        source.sourceId,
        source.mode,
      ]);
    expect(modesOf('copa-demo')).toEqual([
      ['demo-a', 'DEMO_DATA'],
      ['demo-b', 'DEMO_DATA'],
    ]);
    expect(modesOf('liga-demo')).toEqual([
      ['demo-a', 'DEMO_DATA'],
      ['demo-b', 'DEMO_DATA'],
    ]);
    expect(modesOf('manual-liga-manual')).toEqual([['manual', 'MANUAL_DATA']]);
    expect(modesOf(SECOND_ID)).toEqual([[LIVE_SOURCE_ID, 'LIVE_DATA']]);
    // The reference-shaped competition appears under its catalogue link (configuration, not code).
    const link = (readJson<Json>(join(REPO_ROOT, 'config', 'live.catalogue.json'))['links'] as Json[]).find((entry) =>
      (entry['bindings'] as Json[]).some((binding) => binding['sourceId'] === LIVE_SOURCE_ID),
    ) as Json;
    const live = body.competitions.filter((entry) => entry.sources.some((source) => source.mode === 'LIVE_DATA'));
    expect(live.map((entry) => [entry.id, entry.name, entry.reference])).toEqual([
      [link['id'], link['name'], true],
      [SECOND_ID, SECOND.name, false],
    ]);
    expect(body.sources.map((source) => [source.sourceId, source.mode, source.availability.available])).toEqual([
      ['demo-a', 'DEMO_DATA', true],
      ['demo-b', 'DEMO_DATA', true],
      ['manual', 'MANUAL_DATA', true],
      // The local competitions source (PD-ARCH-01E-A) is listed with no competition of its own.
      ['local', 'MANUAL_DATA', true],
      [LIVE_SOURCE_ID, 'LIVE_DATA', true],
    ]);
    // Showing the catalogue makes one listing request to the provider, never a per-competition request (R-291).
    expect(egress.calls.map((call) => call.pathname)).toEqual([`${egress.calls[0]?.pathname}`]);
    expect(egress.calls[0]?.pathname.endsWith('/competitions')).toBe(true);
  });

  it('offers only the seasons and stages the chosen source has, and needs every selection field', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress, { base: committedLiveDocument() });
    await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));
    await catalogue(t);

    const seasons = SeasonListSchema.parse((await t.get(seasonsPath(SECOND_ID))).json());
    expect(seasons.seasons.map((season) => season.id)).toEqual(['2026']);
    const manualSeasons = SeasonListSchema.parse((await t.get(seasonsPath('manual-liga-manual', 'manual'))).json());
    expect(manualSeasons.seasons.map((season) => season.id)).toEqual(['2026']);
    const stages = StageListSchema.parse((await t.get(stagesPath(SECOND_ID, '2026'))).json());
    expect(stages.stages.map((stage) => [stage.name, stage.matchdays])).toEqual([['REGULAR_SEASON', [1, 2]]]);

    const complete: ProjectSelection = {
      competitionId: SECOND_ID,
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: stages.stages[0]?.id ?? '',
      matchday: 1,
    };
    for (const field of ['competitionId', 'sourceId', 'seasonId', 'stageId', 'matchday'] as const) {
      const { [field]: _left, ...partial } = complete;
      const response = await t.send('POST', '/projects', partial);
      expect(response.statusCode, field).toBe(400);
      expect(ProblemSchema.parse(response.json()).code).toBe('VALIDATION_FAILED');
    }
    for (const [change, refusal] of [
      [{ seasonId: '2025' }, 'season_unavailable'],
      [{ matchday: 3 }, 'stage_unavailable'],
      [{ stageId: 'league-stage' }, 'stage_unavailable'],
    ] as const) {
      const response = await t.send('POST', '/projects', { ...complete, ...change });
      expect(response.statusCode, JSON.stringify(change)).toBe(409);
      expect(response.json()).toMatchObject({ code: 'SELECTION_UNAVAILABLE', refusalReason: refusal });
    }
    // A source that does not offer the competition cannot be chosen for it.
    const wrongSource = await t.send('POST', '/projects', { ...complete, sourceId: 'demo-a' });
    expect(wrongSource.statusCode).toBeGreaterThanOrEqual(400);
    expect((await t.get('/projects')).json()).toEqual({ projects: [] });

    const project = await t.createProject(complete);
    expect(project).toMatchObject({ dataMode: 'LIVE_DATA', sourceId: LIVE_SOURCE_ID, seasonId: '2026', matchday: 1 });
    expect(egress.unmatched).toEqual([]);
  });

  it('shows a competition added to the replayed response and drops one it removes, without code change or restart', async () => {
    let listed: Json[] = [...recordedCompetitions(), syntheticCompetition(1)];
    const egress = scriptedReplay([
      on('/competitions', {}, () => answerWithBody('competitions.json', competitionsBody(listed))),
    ]);
    const t = await startLive(cleanup, egress, {
      mutate: (document) => setLiveOptions(document, { cacheTtlSeconds: { competitions: 1 } }),
    });
    const names = async (): Promise<string[]> => (await catalogue(t)).competitions.map((entry) => entry.name).sort();
    expect(await names()).toEqual([REFERENCE.name, SECOND.name, 'Torneo Sintético 1'].sort());

    listed = recordedCompetitions().filter((entry) => entry['code'] !== SECOND.code);
    await pause(1100);
    expect(await names()).toEqual([REFERENCE.name]);
    // The removed competition is no longer offered: its seasons answer 404 without a request for it.
    const before = egress.calls.length;
    expect((await t.get(seasonsPath(SECOND_ID))).statusCode).toBe(404);
    expect(egress.calls.slice(before).filter((call) => call.pathname.includes(`/${SECOND.code}`))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-244, R-283, R-284
// ---------------------------------------------------------------------------------------------------------------

describe('seasons, matchdays and named stages as the source reports them (R-244, R-283, R-284)', () => {
  it('shows the reference-shaped competition with only the reported seasons, and every stage of a season', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    const entry = (await catalogue(t)).competitions.find((competition) => competition.id === REFERENCE_ID);
    expect(entry).toMatchObject({ name: REFERENCE.name, areaName: REFERENCE.area, reference: true });

    const seasons = SeasonListSchema.parse((await t.get(seasonsPath(REFERENCE_ID))).json());
    expect(seasons.seasons.map((season) => [season.id, season.label, season.current])).toEqual([
      ['2026', '2026/27', true],
      ['2025', '2025/26', false],
    ]);
    const unreported = await t.send('POST', '/projects', reference('2024', 'league-stage', 1));
    expect(unreported.statusCode).toBe(409);
    expect(unreported.json()).toMatchObject({ refusalReason: 'season_unavailable' });
    expect((await t.get(stagesPath(REFERENCE_ID, '2024'))).statusCode).toBe(404);
    expect(egress.calls.filter((call) => call.query['season'] === '2024')).toEqual([]);

    const current = StageListSchema.parse((await t.get(stagesPath(REFERENCE_ID, '2026'))).json());
    expect(current.stages.map((stage) => [stage.name, stage.matchdays])).toEqual([
      ['LEAGUE_STAGE', [1, 2, 3, 4, 5, 6, 7, 8]],
    ]);
    const past = StageListSchema.parse((await t.get(stagesPath(REFERENCE_ID, '2025'))).json());
    expect(past.stages.map((stage) => [stage.name, stage.order, stage.selectableAsWhole, stage.standings])).toEqual([
      ['LEAGUE_STAGE', 1, false, 'expected'],
      ['PLAYOFFS', 2, true, 'unknown'],
      ['LAST_16', 3, true, 'unknown'],
      ['QUARTER_FINALS', 4, true, 'unknown'],
      ['SEMI_FINALS', 5, true, 'unknown'],
      ['FINAL', 6, true, 'unknown'],
    ]);
    // Every stage the source reports is selectable, including the stages after the league phase.
    for (const stage of past.stages) {
      for (const matchday of stage.selectableAsWhole ? [null] : stage.matchdays) {
        const response = await t.send('POST', '/projects', reference('2025', stage.id, matchday));
        expect(response.statusCode, `${stage.id} ${String(matchday)} ${response.body}`).toBe(201);
      }
    }
    expect(egress.unmatched).toEqual([]);
  });

  it('a league matchday gives its matches, results and standings; a later stage gives matches without standings', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    await catalogue(t);
    const stages = StageListSchema.parse((await t.get(stagesPath(SECOND_ID, '2026'))).json());
    const league = await t.createProject({
      competitionId: SECOND_ID,
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: stages.stages[0]?.id ?? '',
      matchday: 1,
    });
    const leagueRun = await t.runWorkflow(league.id);
    expect(leagueRun.status, JSON.stringify(leagueRun.failure)).toBe('completed');
    const leagueFacts = await t.listFacts(league.id, leagueRun.id);
    const recordedMatches = (recordedBody('tl1-matches-2026-md1.json')['matches'] as Json[]).length;
    expect(leagueFacts.facts.filter((fact) => fact.kind === 'match_teams')).toHaveLength(recordedMatches);
    expect(leagueFacts.standings).toEqual({ available: true, reason: null });
    expect(leagueFacts.facts.filter((fact) => fact.kind === 'standing_row').length).toBeGreaterThan(0);

    await t.get(stagesPath(REFERENCE_ID, '2025'));
    for (const [stageId, file] of [
      ['last-16', 'cl-matches-2025-stage-last-16.json'],
      ['final', 'cl-matches-2025-stage-final.json'],
    ] as const) {
      const project = await t.createProject(reference('2025', stageId, null));
      const run = await t.runWorkflow(project.id);
      expect(run.status, `${stageId} ${JSON.stringify(run.failure)}`).toBe('completed');
      const facts = await t.listFacts(project.id, run.id);
      const matches = recordedBody(file)['matches'] as Json[];
      expect(
        facts.facts.filter((fact) => fact.kind === 'match_teams'),
        stageId,
      ).toHaveLength(matches.length);
      expect(
        facts.facts.filter((fact) => fact.kind === 'match_score'),
        stageId,
      ).toHaveLength(matches.length);
      // No standings for the stage: stated, never derived or shown as an empty table (R-254, R-284).
      expect(facts.standings, stageId).toEqual({ available: false, reason: 'not_provided_for_stage' });
      expect(
        facts.facts.filter((fact) => fact.kind === 'standing_row'),
        stageId,
      ).toEqual([]);
      const draft = t.container.db
        .prepare<{ standings_included: number }>('SELECT standings_included FROM content_drafts WHERE run_id = ?')
        .get([run.id]) as { standings_included: number };
      expect(draft.standings_included, stageId).toBe(0);
      const calls = egress.calls.filter((call) => call.query['stage'] !== undefined && call.query['season'] === '2025');
      expect(calls.length).toBeGreaterThan(0);
    }
    // No standings request is made for a stage that has none.
    expect(
      egress.calls.filter((call) => call.pathname.endsWith('/standings') && call.query['season'] === '2025'),
    ).toEqual([]);
    expect(egress.unmatched).toEqual([]);
  });

  it('a standings response without a total table states that standings are not available and derives nothing', async () => {
    const egress = scriptedReplay([
      on(
        `/competitions/${REFERENCE.code}/standings`,
        { season: '2026', matchday: '1' },
        'cl-standings-2026-no-total.json',
      ),
    ]);
    const t = await startLive(cleanup, egress);
    const project = await t.createProject(reference('2026', 'league-stage', 1));
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.standings.available).toBe(false);
    expect(facts.standings.reason).not.toBeNull();
    expect(facts.facts.filter((fact) => fact.kind === 'standing_row')).toEqual([]);
    expect(facts.facts.filter((fact) => fact.kind === 'match_score')).toHaveLength(18);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-253, R-286
// ---------------------------------------------------------------------------------------------------------------

const restricted = (): { status: number; headers: Readonly<Record<string, string>>; text: string } => ({
  status: 403,
  headers: recorded('error-403-authenticated.json').headers,
  text: recorded('error-403-authenticated.json').text,
});

describe('unavailable competitions and seasons (R-253, R-286)', () => {
  it('marks a competition the provider restricts (403) as not available, with no retry; the others stay usable', async () => {
    const egress = scriptedReplay([on(`/competitions/${SECOND.code}`, {}, restricted)]);
    const t = await startLive(cleanup, egress);
    await catalogue(t);
    const seasons = SeasonListSchema.parse((await t.get(seasonsPath(SECOND_ID))).json());
    expect(seasons.availability).toEqual({ available: false, reason: 'subscription_restricted' });
    expect(seasons.seasons).toEqual([]);
    expect(
      egress.calls.filter((call) => call.pathname.endsWith(`/${SECOND.code}`)),
      JSON.stringify(egress.calls.map((call) => [call.pathname, call.status])),
    ).toHaveLength(1);
    const refused = await t.send('POST', '/projects', {
      competitionId: SECOND_ID,
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: 'regular-season',
      matchday: 1,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'SELECTION_UNAVAILABLE' });
    // The response wording offers no purchase or upgrade path (SC-03).
    expect(refused.body).not.toMatch(/upgrade|purchase|buy|plan/i);

    // The refused project creation is a new operator action: it asks once more (an error is never cached), without
    // a retry.
    const restrictedCalls = egress.calls.filter((call) => call.pathname.endsWith(`/${SECOND.code}`));
    expect(restrictedCalls).toHaveLength(2);
    expect(restrictedCalls.every((call) => call.status === 403)).toBe(true);

    // The reference competition is unaffected.
    const project = await t.createProject(reference('2026', 'league-stage', 1));
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    expect(egress.calls.filter((call) => call.pathname.endsWith(`/${SECOND.code}`))).toHaveLength(2);
  });

  it('a season absent from the season list, or restricted (403), is not available and produces no data', async () => {
    const egress = scriptedReplay([on(`/competitions/${SECOND.code}/matches`, { season: '2026' }, restricted)]);
    const t = await startLive(cleanup, egress);
    await catalogue(t);
    await t.get(seasonsPath(SECOND_ID));
    expect((await t.get(stagesPath(SECOND_ID, '2019'))).statusCode).toBe(404);
    expect(egress.calls.filter((call) => call.query['season'] === '2019')).toEqual([]);

    const stages = StageListSchema.parse((await t.get(stagesPath(SECOND_ID, '2026'))).json());
    expect(stages.availability).toEqual({ available: false, reason: 'subscription_restricted' });
    expect(stages.stages).toEqual([]);
    expect(
      egress.calls.filter((call) => call.pathname.endsWith('/matches') && call.query['season'] === '2026'),
    ).toHaveLength(1);
    const refused = await t.send('POST', '/projects', {
      competitionId: SECOND_ID,
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: 'regular-season',
      matchday: 1,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'SELECTION_UNAVAILABLE', refusalReason: 'stage_unavailable' });
  });

  it.each([
    ['not found (404)', 'error-404.json'],
    ['restricted (403 with a client)', 'error-403-authenticated.json'],
  ])(
    'research of a selection the provider answers %s reports it not available, without retry or data',
    async (_name, file) => {
      const response = recorded(file);
      const egress = scriptedReplay();
      const t = await startLive(cleanup, egress);
      const project = await t.createProject(reference('2026', 'league-stage', 1));
      egress.use(
        on(
          `/competitions/${REFERENCE.code}/matches`,
          { season: '2026', matchday: '1' },
          {
            status: response.status,
            headers: response.headers,
            text: response.text,
          },
        ),
      );
      const run = await t.runWorkflow(project.id);
      expect(run.status).toBe('failed');
      expect(run.failure).toMatchObject({ code: 'not_available', sourceId: LIVE_SOURCE_ID });
      expect(run.stages[0]).toMatchObject({ stage: 'research', status: 'failed' });
      expect(run.stages.slice(1).every((stage) => stage.status === 'skipped')).toBe(true);
      const research = egress.calls.filter((call) => call.query['matchday'] === '1');
      expect(research).toHaveLength(1);
      const count = (sql: string): number =>
        (t.container.db.prepare<{ n: number }>(sql).get([run.id]) as { n: number }).n;
      expect(count('SELECT count(*) AS n FROM observations WHERE run_id = ?')).toBe(0);
      expect(count('SELECT count(*) AS n FROM facts WHERE run_id = ?')).toBe(0);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-287
// ---------------------------------------------------------------------------------------------------------------

describe('a competition with two sources: the operator chooses one, and it is recorded (R-287)', () => {
  it('either source can be chosen; the project, every research retrieval and every fact record it', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress, {
      base: 'live-secondary',
      scenario: 'live-secondary-agree',
      mutate: (document) => {
        for (const source of sourcesOf(document)) {
          source['role'] = 'primary';
        }
      },
    });
    const entry = (await catalogue(t)).competitions.find((competition) => competition.id === REFERENCE_ID);
    const sourceIds = (entry?.sources ?? []).filter((source) => source.selectable).map((source) => source.sourceId);
    expect(sourceIds).toHaveLength(2);
    expect(sourceIds).toContain(LIVE_SOURCE_ID);

    for (const sourceId of sourceIds) {
      const project = await t.createProject({ ...reference('2026', 'league-stage', 1), sourceId });
      expect(project.sourceId).toBe(sourceId);
      const stored = (await t.get(`/projects/${project.id}`)).json() as { sourceId: string; sourceName: string };
      expect(stored.sourceId).toBe(sourceId);
      const run = await t.runWorkflow(project.id);
      expect(run.status, JSON.stringify(run.failure)).toBe('completed');
      const retrievals = t.container.db
        .prepare<{ source_id: string; stage: string }>('SELECT source_id, stage FROM retrievals WHERE run_id = ?')
        .all([run.id]) as { source_id: string; stage: string }[];
      const researchRows = retrievals.filter((row) => row.stage === 'research');
      expect(researchRows.length).toBeGreaterThan(0);
      expect(researchRows.every((row) => row.source_id === sourceId)).toBe(true);
      const observations = t.container.db
        .prepare<{ source_id: string }>(
          "SELECT DISTINCT source_id FROM observations WHERE run_id = ? AND stage = 'research'",
        )
        .all([run.id]) as { source_id: string }[];
      expect(observations.map((row) => row.source_id)).toEqual([sourceId]);
      const facts = await t.listFacts(project.id, run.id);
      expect(facts.facts.length).toBeGreaterThan(0);
      for (const fact of facts.facts) {
        expect(
          fact.evidence.some((evidence) => evidence.sourceId === sourceId),
          `${fact.factKey} ${JSON.stringify(fact.evidence.map((evidence) => evidence.sourceId))}`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-291, T11H-F06
// ---------------------------------------------------------------------------------------------------------------

describe('discovery within the request budget (R-291, T11H-F06)', () => {
  const MANY = Array.from({ length: 30 }, (_, index) => syntheticCompetition(index + 1));

  function manyCompetitions(): ScriptedReplay {
    return scriptedReplay([
      on('/competitions', {}, () =>
        answerWithBody('competitions.json', competitionsBody([...recordedCompetitions(), ...MANY])),
      ),
    ]);
  }

  it('never exceeds 10 requests per minute; a repeat view makes no request; research keeps its reserved slots', async () => {
    const egress = manyCompetitions();
    const t = await startLive(cleanup, egress);
    const first = await catalogue(t);
    expect(first.competitions).toHaveLength(32);
    expect(egress.calls).toHaveLength(1);
    const again = await catalogue(t);
    expect(again.competitions).toHaveLength(32);
    expect(again.sources[0]?.listing).toMatchObject({ fromCache: true, stale: false });
    expect(egress.calls).toHaveLength(1);

    // Seasons and stages of the reference competition: two more discovery requests, then cached.
    expect((await t.get(seasonsPath(REFERENCE_ID))).statusCode).toBe(200);
    expect((await t.get(stagesPath(REFERENCE_ID, '2026'))).statusCode).toBe(200);
    expect((await t.get(stagesPath(REFERENCE_ID, '2026'))).statusCode).toBe(200);
    expect(egress.calls).toHaveLength(3);

    // A discovery flood: one request per competition until the discovery share (10 - 2 reserved) is used up.
    const statuses: number[] = [];
    const ids = first.competitions
      .filter((entry) => entry.name.startsWith('Torneo Sintético'))
      .map((entry) => entry.id);
    expect(ids).toHaveLength(30);
    for (const id of ids) {
      const response = await t.get(seasonsPath(id));
      statuses.push(response.statusCode);
      if (response.statusCode === 503) {
        const problem = ProblemSchema.parse(response.json());
        expect(problem.code).toBe('PROVIDER_RATE_LIMITED');
        expect(problem.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        expect(problem.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
    }
    expect(statuses.filter((status) => status === 200)).toHaveLength(5);
    expect(statuses.filter((status) => status === 503)).toHaveLength(25);
    expect(egress.calls).toHaveLength(8);
    // Concurrent waiters are bounded too: a burst is refused at once, without a request.
    const burst = await Promise.all(ids.slice(10).map((id) => t.get(seasonsPath(id))));
    expect(burst.every((response) => response.statusCode === 503)).toBe(true);
    expect(egress.calls).toHaveLength(8);

    // Research still runs within the reserved slots (matches and standings), never failing rate_limited.
    const project = await t.createProject(reference('2026', 'league-stage', 1));
    expect(egress.calls).toHaveLength(8);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    expect(egress.calls).toHaveLength(10);
    expect(maxPerWindow(egress.calls)).toBeLessThanOrEqual(10);
    expectNoNetworkViolations();
  });

  it('serves the expired listing as stale with its retrieval time and the wait when the budget is exhausted', async () => {
    const egress = manyCompetitions();
    const t = await startLive(cleanup, egress, {
      mutate: (document) =>
        setLiveOptions(document, {
          requestsPerMinute: 2,
          researchReservedSlots: 1,
          cacheTtlSeconds: { competitions: 1 },
        }),
    });
    const fresh = await catalogue(t);
    const retrievedAt = fresh.sources[0]?.listing.retrievedAt;
    expect(fresh.sources[0]?.listing).toMatchObject({ fromCache: false, stale: false });
    await pause(1100);
    const stale = await catalogue(t);
    expect(stale.competitions).toHaveLength(32);
    expect(stale.sources[0]?.listing).toMatchObject({ fromCache: true, stale: true, retrievedAt });
    expect(stale.sources[0]?.listing.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(egress.calls).toHaveLength(1);
    // Nothing cached and no budget: the wait until the reset is reported at once.
    const waiting = await t.get(seasonsPath(SECOND_ID));
    expect(waiting.statusCode).toBe(503);
    expect(ProblemSchema.parse(waiting.json())).toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect(ProblemSchema.parse(waiting.json()).retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(egress.calls).toHaveLength(1);
  });

  it('answers 404 for an unknown or unlisted competition, source or season with no provider request for it', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    await catalogue(t);
    await t.get(seasonsPath(REFERENCE_ID));
    const before = egress.calls.length;
    for (const path of [
      seasonsPath(`${LIVE_SOURCE_ID}-zz9`),
      seasonsPath('copa-inexistente'),
      seasonsPath(REFERENCE_ID, 'fuente-inexistente'),
      seasonsPath(REFERENCE_ID, 'demo-a'),
      stagesPath(REFERENCE_ID, '1999'),
      stagesPath(`${LIVE_SOURCE_ID}-zz9`, '2026'),
    ]) {
      const response = await t.get(path);
      expect(response.statusCode, path).toBe(404);
      expect(ProblemSchema.parse(response.json()).code).toBe('NOT_FOUND');
    }
    expect(egress.calls.slice(before)).toEqual([]);
  });
});
