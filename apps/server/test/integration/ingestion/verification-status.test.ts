/**
 * Fact statuses, source independence and publication eligibility through the HTTP API (R-256, R-270, R-271, R-272;
 * OD-24, OD-27, OD-29, AD-37, AD-38, PD-17, PD-18; T11H-F13):
 * - two agreeing accepted sources verify; the LIVE-shaped source alone awaits independent verification; MANUAL_DATA is
 *   unverified until the operator approves it; every fact has exactly one status;
 * - the LIVE-shaped primary against the `test-live` secondary (own independence group): verified citing both when
 *   they agree, disputed when they disagree; DEMO_DATA sources never confirm LIVE_DATA facts, and startup refuses a
 *   shared upstream in two groups and a link mixing DEMO_DATA with LIVE_DATA;
 * - LIVE_DATA facts are not publishable while the publication permission is unconfirmed (both states);
 * - manual approval shown, stored and traced as MANUALLY_APPROVED, never as verified, and refused for LIVE_DATA,
 *   disputed and identity-unmatched facts; publishable only for a competition linked with `noAcceptedPublicSource`
 *   and pinned team names, configured by the test in a temporary project root; startup refuses the policies and links
 *   that PD-17 and PD-18 exclude.
 *
 * Content approval and export (T37, T38) are not implemented at this base: the approval refusal and the exported
 * `operatorAttested` flag are checked at the level the API offers, the facts' `blockReason` from the single
 * publishability function (OD-40); the remaining parts are reported BLOCKED.
 */
import { join } from 'node:path';

import { type Fact, FactSchema, ProblemSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FIXTURE_CONFIG_DIR,
  type Json,
  LIGA_DEMO_MD1,
  type ProjectSelection,
  SPORTS_FIXTURES_DIR,
  TOKEN_VARIABLE,
  type TestApp,
  fixtureConfigDocument,
  readJson,
  sourcesOf,
  temporaryDirectory,
  writeCatalogue,
} from '../../support/index.js';
import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import {
  LIVE_SOURCE_ID,
  REFERENCE,
  type RootedApp,
  cleanups,
  committedLiveDocument,
  errorText,
  importApplied,
  jsonImport,
  liveSource,
  manualBytes,
  manualSourceEntry,
  recordedBody,
  scriptedReplay,
  start,
  startLive,
  startRootedApp,
  startupError,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const REFERENCE_MD1: ProjectSelection = {
  competitionId: 'copa-continental',
  sourceId: LIVE_SOURCE_ID,
  seasonId: '2026',
  stageId: 'league-stage',
  matchday: 1,
};

/** Asserts the one-status rule of BR-12 on every fact (R-270). */
function expectOneStatusEach(facts: readonly Fact[]): void {
  const keys = new Set<string>();
  for (const fact of facts) {
    FactSchema.parse(fact);
    expect(keys.has(fact.factKey), fact.factKey).toBe(false);
    keys.add(fact.factKey);
    switch (fact.status) {
      case 'verified':
        expect(fact.unverifiedReason, fact.factKey).toBeNull();
        expect(fact.value, fact.factKey).not.toBeNull();
        expect(fact.manualApproval, fact.factKey).toBeNull();
        break;
      case 'unverified':
        expect(fact.unverifiedReason, fact.factKey).not.toBeNull();
        expect(fact.value, fact.factKey).toBeNull();
        expect(fact.manualApproval, fact.factKey).toBeNull();
        break;
      case 'manually_approved':
        expect(fact.unverifiedReason, fact.factKey).toBeNull();
        expect(fact.value, fact.factKey).toBeNull();
        expect(fact.manualApproval, fact.factKey).not.toBeNull();
        break;
    }
  }
}

async function run(t: TestApp, selection: ProjectSelection) {
  const project = await t.createProject(selection);
  const result = await t.runWorkflow(project.id);
  expect(result.status, JSON.stringify(result.failure)).toBe('completed');
  return { project, run: result, facts: (await t.listFacts(project.id, result.id)).facts };
}

async function approve(
  t: Pick<TestApp, 'send'>,
  projectId: string,
  runId: string,
  factId: string,
): Promise<{ statusCode: number; body: Json }> {
  const response = await t.send('PUT', `/projects/${projectId}/runs/${runId}/facts/${factId}/manual-approval`);
  return { statusCode: response.statusCode, body: response.json() };
}

/** The stored (not effective) status of a fact row. */
function storedStatus(t: Pick<TestApp, 'container'>, factId: string): string {
  return (
    t.container.db.prepare<{ status: string }>('SELECT status FROM facts WHERE id = ?').get([factId]) as {
      status: string;
    }
  ).status;
}

/** The match-score fact of the recorded match `id` of the equivalence matchday, found by its home team's name. */
function scoreOfRecordedMatch(facts: readonly Fact[], id: number): Fact | undefined {
  const matches = recordedBody('cl-matches-2026-md1.json')['matches'] as Json[];
  const match = matches.find((entry) => entry['id'] === id) as Json;
  const home = String((match['homeTeam'] as Json)['name']);
  const teams = facts.find((fact) => fact.kind === 'match_teams' && fact.display?.startsWith(`${home} - `) === true);
  return facts.find((fact) => fact.kind === 'match_score' && fact.subject.matchKey === teams?.subject.matchKey);
}

const disagreement = (): { footballDataMatchId: number } =>
  readJson<{ scenarios: { id: string; disagreement?: { footballDataMatchId: number } }[] }>(
    join(SPORTS_FIXTURES_DIR, '_manifest.json'),
  ).scenarios.find((scenario) => scenario.id === 'live-secondary-disagree')?.disagreement ?? {
    footballDataMatchId: -1,
  };

// ---------------------------------------------------------------------------------------------------------------
// R-270
// ---------------------------------------------------------------------------------------------------------------

describe('one status per fact by data mode (R-270)', () => {
  it('two independent accepted sources that agree verify the fact', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { facts } = await run(t, LIGA_DEMO_MD1);
    expectOneStatusEach(facts);
    expect(new Set(facts.map((fact) => fact.status))).toEqual(new Set(['verified']));
    const score = facts.find((fact) => fact.kind === 'match_score');
    expect(
      score?.evidence
        .filter((evidence) => evidence.relation === 'supports')
        .map((e) => e.sourceId)
        .sort(),
    ).toEqual(['demo-a', 'demo-b']);
  });

  it('a value from the LIVE-shaped source alone is unverified, awaiting independent verification', async () => {
    const t = await startLive(cleanup, scriptedReplay());
    const { facts } = await run(t, REFERENCE_MD1);
    expectOneStatusEach(facts);
    expect(facts.length).toBeGreaterThan(100);
    for (const fact of facts) {
      expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'awaiting_independent_verification' });
    }
  });

  it('a MANUAL_DATA value is unverified until the operator approves it, and MANUALLY_APPROVED afterwards', async () => {
    const t = await start(cleanup, { base: 'demo-manual', scenario: 'default' });
    await importApplied(t, jsonImport(JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8'))));
    const {
      project,
      run: done,
      facts,
    } = await run(t, {
      competitionId: 'manual-liga-manual',
      sourceId: 'manual',
      seasonId: '2026',
      stageId: 'torneo-apertura',
      matchday: 1,
    });
    expectOneStatusEach(facts);
    expect(new Set(facts.map((fact) => `${fact.status}/${String(fact.unverifiedReason)}`))).toEqual(
      new Set(['unverified/no_accepted_source']),
    );
    const score = facts.find((fact) => fact.kind === 'match_score') as Fact;
    const approved = await approve(t, project.id, done.id, score.factId);
    expect(approved.statusCode).toBe(200);
    const after = (await t.listFacts(project.id, done.id)).facts;
    expectOneStatusEach(after);
    expect(after.filter((fact) => fact.status === 'manually_approved').map((fact) => fact.factId)).toEqual([
      score.factId,
    ]);
    expect(after.filter((fact) => fact.status === 'unverified')).toHaveLength(facts.length - 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-256, OD-24
// ---------------------------------------------------------------------------------------------------------------

describe('LIVE-shaped primary against the independent test-live secondary (R-256, OD-24)', () => {
  it('verifies every fact citing both sources when they agree', async () => {
    const t = await startLive(cleanup, scriptedReplay(), { base: 'live-secondary', scenario: 'live-secondary-agree' });
    const groups = t.container.sources.descriptors.map((source) => [source.id, source.mode, source.independenceGroup]);
    expect(new Set(groups.map((entry) => entry[2])).size).toBe(2);
    const { facts } = await run(t, REFERENCE_MD1);
    expectOneStatusEach(facts);
    expect(new Set(facts.map((fact) => fact.status))).toEqual(new Set(['verified']));
    for (const fact of facts.filter((entry) => entry.kind === 'match_score')) {
      const supporting = fact.evidence.filter((evidence) => evidence.relation === 'supports');
      expect(supporting.map((evidence) => [evidence.sourceId, evidence.dataMode]).sort()).toEqual(
        [
          [LIVE_SOURCE_ID, 'LIVE_DATA'],
          ['live-secondary', 'LIVE_DATA'],
        ].sort(),
      );
      expect(fact.reason).toContain(LIVE_SOURCE_ID);
      expect(fact.reason).toContain('live-secondary');
    }
  });

  it('disputes the score on which they disagree and verifies the others; the dispute procedure applies', async () => {
    const t = await startLive(cleanup, scriptedReplay(), {
      base: 'live-secondary',
      scenario: 'live-secondary-disagree',
    });
    const { facts } = await run(t, REFERENCE_MD1);
    expectOneStatusEach(facts);
    const disputed = scoreOfRecordedMatch(facts, disagreement().footballDataMatchId);
    expect(disputed).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', value: null });
    expect(disputed?.dispute?.sourceValues.map((entry) => entry.sourceId).sort()).toEqual(
      [LIVE_SOURCE_ID, 'live-secondary'].sort(),
    );
    const [first, second] = disputed?.dispute?.sourceValues ?? [];
    expect(first?.value).not.toEqual(second?.value);
    // No official publication is configured for the competition: the dispute stays open (BR-02).
    expect(disputed?.dispute).toMatchObject({ outcome: 'unavailable', consultedSourceId: null, resolvedValue: null });
    expect(facts.filter((fact) => fact.status !== 'verified').map((fact) => fact.factId)).toEqual([disputed?.factId]);
  });

  it('DEMO_DATA sources never confirm LIVE_DATA facts (OD-24)', async () => {
    const t = await startLive(cleanup, scriptedReplay(), { base: committedLiveDocument() });
    const modes = new Set(t.container.sources.descriptors.map((source) => source.mode));
    expect(modes).toEqual(new Set(['DEMO_DATA', 'MANUAL_DATA', 'LIVE_DATA']));
    const link = t.container.config.catalogue.links.find((entry) =>
      entry.bindings.some((binding) => binding.sourceId === LIVE_SOURCE_ID),
    );
    const { facts } = await run(t, { ...REFERENCE_MD1, competitionId: String(link?.id) });
    expect(facts.every((fact) => fact.unverifiedReason === 'awaiting_independent_verification')).toBe(true);
    expect(facts.every((fact) => fact.evidence.every((evidence) => evidence.dataMode === 'LIVE_DATA'))).toBe(true);
  });

  it.each(['invalid-shared-upstream', 'invalid-demo-live-link'])(
    'refuses %s at startup, naming the sources or the link',
    async (name) => {
      const entry = readJson<{ configs: { file: string; expectProblem?: string }[] }>(
        join(FIXTURE_CONFIG_DIR, '_manifest.json'),
      ).configs.find((config) => config.file === `${name}.config.json`);
      expect(entry?.expectProblem).toBeDefined();
      const environments: Readonly<Record<string, string>>[] = [{}, { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN }];
      for (const env of environments) {
        const error = await startupError({ base: name, env, egress: scriptedReplay() });
        const text = errorText(error);
        expect(text).toContain(String(entry?.expectProblem));
        for (const source of sourcesOf(fixtureConfigDocument(name))) {
          if (name === 'invalid-shared-upstream' || source['mode'] === 'DEMO_DATA') {
            expect(text).toContain(`'${String(source['id'])}'`);
          }
        }
        expect(text).not.toContain(TEST_MARKER_TOKEN);
      }
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-271, OD-29, PD-18
// ---------------------------------------------------------------------------------------------------------------

describe('LIVE_DATA publishability (R-271, OD-29, PD-18)', () => {
  it('without a secondary source research completes and every fact is blocked, naming the single source', async () => {
    const t = await startLive(cleanup, scriptedReplay());
    const { run: done, facts } = await run(t, REFERENCE_MD1);
    expect(done.stages.every((stage) => stage.status === 'completed')).toBe(true);
    for (const fact of facts) {
      expect(fact.status).not.toBe('verified');
      expect(fact.blockReason, fact.factKey).toBe('not_verified');
      expect(fact.reason).toContain(`single source: ${LIVE_SOURCE_ID}`);
    }
  });

  it('verified by two LIVE sources: blocked while the permission is unconfirmed, publishable once confirmed by a decision', async () => {
    const unconfirmed = await startLive(cleanup, scriptedReplay(), {
      base: 'live-secondary',
      scenario: 'live-secondary-agree',
    });
    const before = await run(unconfirmed, REFERENCE_MD1);
    expect(before.facts.every((fact) => fact.status === 'verified')).toBe(true);
    expect(new Set(before.facts.map((fact) => fact.blockReason))).toEqual(
      new Set(['publication_permission_unconfirmed']),
    );

    const confirmed = await startLive(cleanup, scriptedReplay(), {
      base: 'live-secondary',
      scenario: 'live-secondary-agree',
      mutate: (document) => {
        for (const source of sourcesOf(document)) {
          source['publicationPermission'] = 'confirmed';
          source['publicationPermissionDecision'] = 'PD-99';
        }
      },
    });
    const after = await run(confirmed, REFERENCE_MD1);
    expect(after.facts.every((fact) => fact.status === 'verified')).toBe(true);
    expect(after.facts.filter((fact) => fact.blockReason !== undefined)).toEqual([]);
    // Settings show the permission state of each LIVE_DATA source.
    const settings = (await confirmed.get('/settings')).json() as {
      providers: { sources: { id: string; publicationPermission: string }[] };
    };
    expect(settings.providers.sources.map((source) => source.publicationPermission)).toEqual([
      'confirmed',
      'confirmed',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-272: manual approval
// ---------------------------------------------------------------------------------------------------------------

const LIGA_MANUAL_MD1 = {
  competitionId: 'manual-liga-manual',
  sourceId: 'manual',
  seasonId: '2026',
  stageId: 'torneo-apertura',
  matchday: 1,
} as const;

describe('manual approval (R-272)', () => {
  it('is shown, stored and traced as MANUALLY_APPROVED, never as verified, with its time, import and declared source', async () => {
    const t = await start(cleanup, { base: 'demo-manual', scenario: 'default' });
    const summary = await importApplied(
      t,
      jsonImport(
        JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8')),
        'boletin.json',
        'Boletín sintético',
      ),
    );
    const { project, run: done, facts } = await run(t, LIGA_MANUAL_MD1);
    const score = facts.find((fact) => fact.kind === 'match_score') as Fact;
    const approved = await approve(t, project.id, done.id, score.factId);
    expect(approved.statusCode).toBe(200);
    const fact = FactSchema.parse(approved.body);
    expect(fact).toMatchObject({ status: 'manually_approved', unverifiedReason: null, value: null });
    expect(fact.reason).toMatch(/operator-attested/);
    expect(fact.reason).toMatch(/not verified/i);
    expect(Date.parse(String(fact.manualApproval?.approvedAt))).not.toBeNaN();
    // Stored as an append-only audit row; the stored fact status stays unverified (never verification).
    expect(storedStatus(t, score.factId)).toBe('unverified');
    const rows = t.container.db
      .prepare<{ action: string; at: string }>('SELECT action, at FROM manual_approvals WHERE fact_id = ?')
      .all([score.factId]) as { action: string; at: string }[];
    expect(rows).toEqual([{ action: 'approved', at: fact.manualApproval?.approvedAt }]);
    // Traced to the import version and record, which shows the declared source.
    const evidence = fact.evidence[0];
    expect(evidence).toMatchObject({
      sourceId: 'manual',
      dataMode: 'MANUAL_DATA',
      accepted: false,
      relation: 'consulted',
    });
    expect(evidence?.importVersionId).toBe(summary.selections.find((selection) => selection.matchday === 1)?.versionId);
    expect(evidence?.sourceRef.startsWith(`import:${summary.id}/`)).toBe(true);
    expect((await t.get(`/imports/${summary.id}`)).json()).toMatchObject({ declaredSource: 'Boletín sintético' });
    // Not publishable for an unmarked competition (PD-17): the reason names the manual approval.
    expect(fact.blockReason).toBe('manually_approved_not_publishable');
    // A second approval is refused; revoking restores unverified with another audit row.
    expect((await approve(t, project.id, done.id, score.factId)).body).toMatchObject({
      refusalReason: 'already_approved',
    });
    const revoked = await t.send(
      'DELETE',
      `/projects/${project.id}/runs/${done.id}/facts/${score.factId}/manual-approval`,
    );
    expect(revoked.statusCode).toBe(200);
    expect(FactSchema.parse(revoked.json())).toMatchObject({ status: 'unverified', manualApproval: null });
  });

  it('refuses manual approval of a LIVE_DATA fact', async () => {
    const t = await startLive(cleanup, scriptedReplay());
    const { project, run: done, facts } = await run(t, REFERENCE_MD1);
    const response = await approve(t, project.id, done.id, (facts[0] as Fact).factId);
    expect(response.statusCode).toBe(409);
    expect(ProblemSchema.parse(response.body)).toMatchObject({
      code: 'MANUAL_APPROVAL_REFUSED',
      refusalReason: 'not_manual_data',
    });
  });

  it('refuses manual approval of a disputed fact of a MANUAL_DATA project', async () => {
    // The manual competition is linked with two independent accepted LIVE_DATA verification sources that disagree on
    // one score (no DEMO_DATA in the link, OD-24).
    const dir = temporaryDirectory('t52-links');
    cleanup.add(() => dir.remove());
    const linksFile = writeCatalogue(dir.path, {
      links: [
        {
          id: 'copa-continental',
          name: 'Copa Continental Sintética',
          reference: true,
          bindings: [
            { sourceId: 'manual', competitionRef: 'copa-continental' },
            { sourceId: LIVE_SOURCE_ID, competitionRef: REFERENCE.localKey },
            { sourceId: 'live-secondary', competitionRef: 'copa-continental' },
          ],
        },
      ],
      restrictToLinks: false,
    });
    const t = await startLive(cleanup, scriptedReplay(), {
      base: 'live-secondary',
      scenario: 'live-secondary-disagree',
      mutate: (document) => {
        liveSource(document)['role'] = 'verification';
        sourcesOf(document).push(manualSourceEntry());
        document['catalogue'] = { linksFile };
      },
    });
    await importApplied(t, jsonImport(JSON.parse(manualBytes('equivalence/equivalence.json').toString('utf8'))));
    const { project, run: done, facts } = await run(t, { ...REFERENCE_MD1, sourceId: 'manual' });
    expectOneStatusEach(facts);
    const disputed = scoreOfRecordedMatch(facts, disagreement().footballDataMatchId) as Fact;
    expect(disputed).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed' });
    const response = await approve(t, project.id, done.id, disputed.factId);
    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({ code: 'MANUAL_APPROVAL_REFUSED', refusalReason: 'disputed' });
    // Agreement of the two accepted LIVE_DATA sources verifies the other facts; the manual value never counts.
    const verified = facts.filter((fact) => fact.status === 'verified');
    expect(verified.length).toBeGreaterThan(0);
    for (const fact of verified) {
      const supporting = fact.evidence.filter((evidence) => evidence.relation === 'supports');
      expect(supporting.every((evidence) => evidence.dataMode === 'LIVE_DATA')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-272, PD-17, AD-38: publication eligibility of operator-attested facts
// ---------------------------------------------------------------------------------------------------------------

describe('operator-attested publication under PD-17 and AD-38 (R-272)', () => {
  const MARKED_ID = 'liga-atestada';

  function ligaManualDocument(): Json {
    return JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8')) as Json;
  }

  function baseDocument(): Json {
    const document = fixtureConfigDocument('demo-only');
    sourcesOf(document).push(manualSourceEntry());
    return document;
  }

  /** Identity map of the marked competition: the pinned names of every team except `leaveOut`. */
  function identityMap(leaveOut: number | null): Json {
    const teams = ((ligaManualDocument()['selections'] as Json[])[0] as Json)['teams'] as {
      key: string;
      name: string;
    }[];
    return {
      competitionId: MARKED_ID,
      seasonId: '2026',
      teams: teams
        .filter((_team, index) => index !== leaveOut)
        .map((team) => ({
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

  async function rooted(options: Parameters<typeof startRootedApp>[0]): Promise<RootedApp> {
    const app = await startRootedApp(options);
    cleanup.add(() => app.close());
    return app;
  }

  async function runRooted(a: RootedApp, competitionId: string) {
    const created = await a.send('POST', '/projects', { ...LIGA_MANUAL_MD1, competitionId });
    expect(created.statusCode, created.body).toBe(201);
    const project = created.json() as { id: string };
    const started = await a.send('POST', `/projects/${project.id}/runs`, { kind: 'full' });
    expect(started.statusCode).toBe(202);
    const runId = (started.json() as { id: string }).id;
    let status = 'running';
    for (let attempt = 0; attempt < 400 && (status === 'running' || status === 'queued'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      status = ((await a.get(`/projects/${project.id}/runs/${runId}`)).json() as { status: string }).status;
    }
    expect(status).toBe('completed');
    const facts = ((await a.get(`/projects/${project.id}/runs/${runId}/facts`)).json() as { facts: Fact[] }).facts;
    return { projectId: project.id, runId, facts };
  }

  it('a marked competition with pinned names: manually approved facts become publishable, labelled operator-attested', async () => {
    const a = await rooted({ document: baseDocument(), catalogue: markedCatalogue, identityMaps: [identityMap(null)] });
    await importApplied(a, jsonImport(ligaManualDocument()));
    const { projectId, runId, facts } = await runRooted(a, MARKED_ID);
    expect(facts.every((fact) => fact.unverifiedReason === 'no_accepted_source')).toBe(true);
    for (const fact of facts.filter((entry) => entry.kind === 'match_score')) {
      const approved = await approve(a, projectId, runId, fact.factId);
      expect(approved.statusCode).toBe(200);
      const body = FactSchema.parse(approved.body);
      expect(body.status).toBe('manually_approved');
      expect(body.blockReason).toBeUndefined();
      expect(body.reason).toMatch(/operator-attested/);
      expect(storedStatus(a, fact.factId)).toBe('unverified');
    }
    const after = ((await a.get(`/projects/${projectId}/runs/${runId}/facts`)).json() as { facts: Fact[] }).facts;
    expect(after.some((fact) => fact.status === 'verified')).toBe(false);
    expect(
      after.filter((fact) => fact.status === 'manually_approved').every((fact) => fact.blockReason === undefined),
    ).toBe(true);
    // Facts not approved stay blocked.
    expect(
      after.filter((fact) => fact.status === 'unverified').every((fact) => fact.blockReason === 'not_verified'),
    ).toBe(true);
  });

  it('the same import as an unlinked manual competition stays blocked (manually_approved_not_publishable)', async () => {
    const a = await rooted({ document: baseDocument() });
    await importApplied(a, jsonImport(ligaManualDocument()));
    const { projectId, runId, facts } = await runRooted(a, 'manual-liga-manual');
    const score = facts.find((fact) => fact.kind === 'match_score') as Fact;
    const approved = await approve(a, projectId, runId, score.factId);
    expect(approved.statusCode).toBe(200);
    expect(FactSchema.parse(approved.body)).toMatchObject({
      status: 'manually_approved',
      blockReason: 'manually_approved_not_publishable',
    });
  });

  it('a team name outside the pinned set leaves its facts unmatched and refuses their manual approval', async () => {
    const a = await rooted({ document: baseDocument(), catalogue: markedCatalogue, identityMaps: [identityMap(0)] });
    await importApplied(a, jsonImport(ligaManualDocument()));
    const { projectId, runId, facts } = await runRooted(a, MARKED_ID);
    const unmatched = facts.filter((fact) => fact.unverifiedReason === 'team_identity_unmatched');
    expect(unmatched.length).toBeGreaterThan(0);
    expect(unmatched.map((fact) => fact.kind)).toEqual(expect.arrayContaining(['match_score', 'team_official_name']));
    for (const fact of unmatched) {
      const response = await approve(a, projectId, runId, fact.factId);
      expect(response.statusCode, fact.factKey).toBe(409);
      expect(response.body).toMatchObject({ refusalReason: 'team_identity_unmatched' });
    }
    const matched = facts.find((fact) => fact.kind === 'match_score' && fact.unverifiedReason === 'no_accepted_source');
    expect((await approve(a, projectId, runId, String(matched?.factId))).statusCode).toBe(200);
  });

  it.each([
    [
      'manuallyApprovedPublication allowed_labelled',
      (document: Json): void => {
        document['verificationPolicy'] = { manuallyApprovedPublication: 'allowed_labelled' };
      },
      'verificationPolicy.manuallyApprovedPublication',
    ],
    [
      'livePublicationPermissionRule any_supporting_source',
      (document: Json): void => {
        document['verificationPolicy'] = { livePublicationPermissionRule: 'any_supporting_source' };
      },
      'verificationPolicy.livePublicationPermissionRule',
    ],
    [
      'a confirmed LIVE_DATA source without a decision ID',
      (document: Json): void => {
        liveSource(document)['publicationPermission'] = 'confirmed';
      },
      'publicationPermissionDecision',
    ],
  ])('startup refuses %s, naming the setting', async (_name, mutate, setting) => {
    const error = await startupError({
      base: 'live',
      env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
      egress: scriptedReplay(),
      mutate,
    });
    expect(errorText(error)).toContain(setting);
  });

  it('startup refuses a marked link that binds a LIVE_DATA source, naming the link and the source', async () => {
    const dir = temporaryDirectory('t52-marked');
    cleanup.add(() => dir.remove());
    const linksFile = writeCatalogue(dir.path, {
      links: [
        {
          id: 'liga-mixta',
          name: 'Liga Mixta',
          noAcceptedPublicSource: true,
          bindings: [
            { sourceId: 'manual', competitionRef: 'liga-manual' },
            { sourceId: LIVE_SOURCE_ID, competitionRef: REFERENCE.localKey },
          ],
        },
      ],
    });
    const error = await startupError({
      base: 'live',
      env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
      egress: scriptedReplay(),
      mutate: (document) => {
        sourcesOf(document).push(manualSourceEntry());
        document['catalogue'] = { linksFile };
      },
    });
    const text = errorText(error);
    expect(text).toContain("'liga-mixta'");
    expect(text).toContain(`'${LIVE_SOURCE_ID}'`);
    expect(text).toContain('noAcceptedPublicSource');
  });
});
