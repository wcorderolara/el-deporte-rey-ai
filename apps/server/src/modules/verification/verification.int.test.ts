/**
 * Integration tests of the verification stage and the facts routes through the HTTP API, with the real research
 * stage, DEMO_DATA fixtures, the test-only LIVE_DATA kind `test-live` and a MANUAL_DATA stub kind registered through
 * the `createSportsSources` test seam (AD-37, OD-24): R-205, R-227, R-229, R-230, R-256, R-270, R-271, R-272, R-278,
 * OD-40, AD-38, T10-F15. Synthetic data only; no non-loopback connection.
 */
import { FactListResponseSchema, FactSchema, ProblemSchema, RunSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { SOURCE_ERROR_CODES, SourceError } from '../../providers/sports/index.js';
import { type Json, fixtureDocument, league } from '../../providers/sports/test/synthetic.js';

import {
  READ_HEADERS,
  type SourceOptions,
  type VerificationTestApp,
  WRITE_HEADERS,
  matchday1,
  verificationTestApp,
  writeIdentityMap,
} from './test/app.js';

const apps: VerificationTestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

async function start(options: SourceOptions = {}): Promise<VerificationTestApp> {
  const app = await verificationTestApp(options);
  apps.push(app);
  return app;
}

async function createProject(app: VerificationTestApp, competitionId: string, sourceId: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { ...WRITE_HEADERS, 'content-type': 'application/json' },
    payload: JSON.stringify({ competitionId, sourceId, seasonId: '2026', stageId: 'regular', matchday: 1 }),
  });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json() as { id: string }).id;
}

async function run(app: VerificationTestApp, projectId: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/runs`,
    headers: { ...WRITE_HEADERS, 'content-type': 'application/json' },
    payload: JSON.stringify({ kind: 'full' }),
  });
  expect(response.statusCode, response.body).toBe(202);
  const runId = RunSchema.parse(response.json()).id;
  await app.projects.runnerFor(app.container).settled(runId);
  const final = await app.inject({
    method: 'GET',
    url: `/api/v1/projects/${projectId}/runs/${runId}`,
    headers: READ_HEADERS,
  });
  expect(RunSchema.parse(final.json()).status, final.body).toBe('completed');
  return runId;
}

async function facts(app: VerificationTestApp, projectId: string, runId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/projects/${projectId}/runs/${runId}/facts`,
    headers: READ_HEADERS,
  });
  expect(response.statusCode, response.body).toBe(200);
  return FactListResponseSchema.parse(response.json());
}

function manualApproval(
  app: VerificationTestApp,
  method: 'PUT' | 'DELETE',
  projectId: string,
  runId: string,
  factId: string,
) {
  return app.inject({
    method,
    url: `/api/v1/projects/${projectId}/runs/${runId}/facts/${factId}/manual-approval`,
    headers: WRITE_HEADERS,
  });
}

function refusal(response: { statusCode: number; json(): unknown }): string | null | undefined {
  expect(response.statusCode).toBe(409);
  const problem = ProblemSchema.parse(response.json());
  expect(problem.code).toBe('MANUAL_APPROVAL_REFUSED');
  return problem.refusalReason;
}

function setScore(payload: Json, index: number, score: { home: number; away: number }): void {
  ((payload['matches'] as Json[])[index] as Json)['score'] = score;
}

const PINNED_MAP = {
  competitionId: 'liga-local',
  seasonId: '2026',
  teams: ['alfa', 'beta', 'gamma', 'delta'].map((key) => ({
    teamId: `club-${key}`,
    officialName: `Club ${key.charAt(0).toUpperCase()}${key.slice(1)}`,
    sourceKeys: [{ sourceId: 'manual-a', teamKey: key }],
  })),
};

describe('DEMO_DATA: two agreeing accepted fixture sources (R-229, R-270)', () => {
  it('verifies every fact citing both sources, with mode, and reports standings availability', async () => {
    const app = await start();
    const projectId = await createProject(app, 'liga-demo', 'demo-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.dataMode).toBe('DEMO_DATA');
    expect(list.standings).toEqual({ available: true, reason: null });
    expect(list.facts.length).toBeGreaterThan(10);
    for (const fact of list.facts) {
      expect(fact.status, fact.factKey).toBe('verified');
      expect(fact.blockReason).toBeUndefined();
      expect(fact.unverifiedReason).toBeNull();
      const supporting = fact.evidence.filter((evidence) => evidence.relation === 'supports');
      expect(supporting.map((evidence) => evidence.sourceId).sort()).toEqual(['demo-a', 'demo-b']);
      expect(
        supporting.every((evidence) => evidence.dataMode === 'DEMO_DATA' && evidence.importVersionId === null),
      ).toBe(true);
      expect(fact.display).not.toBeNull();
    }
    expect(list.leftOutMatches).toEqual([]);
    const names = list.facts.filter((fact) => fact.kind === 'team_official_name');
    expect(names.map((fact) => fact.display).sort()).toEqual(['Club Alfa', 'Club Beta', 'Club Delta', 'Club Gamma']);
    const aliases = app.db.prepare('SELECT COUNT(*) AS n FROM team_aliases').get() as { n: number };
    expect(aliases.n).toBeGreaterThanOrEqual(4);
  });

  it('a seeded disagreement the official publication does not settle is disputed, consulted and recorded (R-205, R-230)', async () => {
    const app = await start();
    const document = fixtureDocument([league('liga-demo', 'Liga Demo')]);
    setScore(matchday1(document, 'liga-demo'), 0, { home: 5, away: 0 });
    app.fixtures.write('default', 'demo-b', document);
    const projectId = await createProject(app, 'liga-demo', 'demo-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const disputed = list.facts.filter((fact) => fact.unverifiedReason === 'disputed');
    expect(disputed).toHaveLength(1);
    const [fact] = disputed as [(typeof disputed)[number]];
    expect(fact).toMatchObject({ kind: 'match_score', status: 'unverified', candidateValue: null, value: null });
    expect(fact.blockReason).toBe('not_verified');
    expect(fact.reason).toContain('demo-a, demo-b');
    expect(fact.dispute).toMatchObject({ consultedSourceId: 'demo-b', outcome: 'same_source', resolvedValue: null });
    expect(fact.dispute?.sourceValues.map((entry) => entry.sourceId).sort()).toEqual(['demo-a', 'demo-b']);
    expect(list.leftOutMatches).toEqual([
      expect.objectContaining({ reason: 'not_verified', status: 'finished', label: 'Club Alfa - Club Beta' }),
    ]);
    // No user action marks it verified (R-230, R-412): manual approval is refused for a DEMO_DATA project.
    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, fact.factId))).toBe('not_manual_data');
  });
});

describe('LIVE_DATA (R-055, R-256, R-271)', () => {
  it('a LIVE_DATA source alone gives awaiting independent verification, blocked as not verified', async () => {
    const app = await start();
    const projectId = await createProject(app, 'live-a-liga-solo', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.dataMode).toBe('LIVE_DATA');
    for (const fact of list.facts) {
      expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'awaiting_independent_verification' });
      expect(fact.blockReason).toBe('not_verified');
      expect(fact.reason).toContain('single source: live-a');
      expect(fact.candidateValue).not.toBeNull();
    }
    const [first] = list.facts as [(typeof list.facts)[number]];
    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, first.factId))).toBe('not_manual_data');
  });

  it('an agreeing LIVE_DATA verification source verifies citing both; unconfirmed permission blocks (OD-40)', async () => {
    const app = await start();
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    for (const fact of list.facts) {
      expect(fact.status, fact.factKey).toBe('verified');
      expect(fact.blockReason).toBe('publication_permission_unconfirmed');
      expect(
        fact.evidence
          .filter((evidence) => evidence.relation === 'supports')
          .map((evidence) => evidence.sourceId)
          .sort(),
      ).toEqual(['live-a', 'live-b']);
      expect(fact.evidence.every((evidence) => evidence.dataMode === 'LIVE_DATA')).toBe(true);
      expect(JSON.stringify(fact.evidence)).not.toContain('://');
    }
    const retrievals = app.db.prepare('SELECT source_id, stage, outcome FROM retrievals ORDER BY rowid').all() as {
      source_id: string;
      stage: string;
      outcome: string;
    }[];
    expect(retrievals).toEqual([
      { source_id: 'live-a', stage: 'research', outcome: 'ok' },
      { source_id: 'live-b', stage: 'verification', outcome: 'ok' },
    ]);
  });

  it('with the permission confirmed by a recorded decision, verified LIVE_DATA facts are not blocked (R-271)', async () => {
    const app = await start({ liveBPermission: 'confirmed' });
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.facts.every((fact) => fact.status === 'verified' && fact.blockReason === undefined)).toBe(true);
  });

  it('a disagreeing LIVE_DATA verification source gives disputed (R-256)', async () => {
    const app = await start();
    const document = app.live.documents.get('live-b') as Json;
    setScore(matchday1(document, 'liga-live'), 1, { home: 1, away: 0 });
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const disputed = list.facts.filter((fact) => fact.unverifiedReason === 'disputed');
    expect(disputed.map((fact) => fact.kind)).toEqual(['match_score']);
    expect(disputed[0]?.dispute?.outcome).toBe('unavailable');
  });

  it('a verification source that fails contributes no observation and is recorded as a failed retrieval', async () => {
    const app = await start();
    app.live.overrides.set('live-b/fetchSelection', new Error('synthetic failure'));
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.facts.every((fact) => fact.unverifiedReason === 'awaiting_independent_verification')).toBe(true);
    const failed = app.db.prepare("SELECT outcome, failure FROM retrievals WHERE stage = 'verification'").get() as {
      outcome: string;
      failure: string;
    };
    expect(failed.outcome).toBe('failed');
    expect(JSON.parse(failed.failure)).toMatchObject({ code: 'unavailable', sourceId: 'live-b' });
  });
});

describe('MANUAL_DATA of a competition without an accepted public source (R-270, R-272, R-278, AD-38)', () => {
  it('facts are unverified until manually approved, then MANUALLY_APPROVED and publishable; revocable; audited', async () => {
    const app = await start();
    writeIdentityMap(app.fixtures, 'liga-local-2026.json', PINNED_MAP);
    const projectId = await createProject(app, 'liga-local', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.dataMode).toBe('MANUAL_DATA');
    for (const fact of list.facts) {
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        manualApproval: null,
      });
      expect(fact.blockReason).toBe('not_verified');
      expect(fact.evidence.every((evidence) => evidence.relation === 'consulted')).toBe(true);
      expect(fact.evidence[0]?.importVersionId).not.toBeNull();
    }
    const score = list.facts.find((fact) => fact.kind === 'match_score') as (typeof list.facts)[number];

    const approved = await manualApproval(app, 'PUT', projectId, runId, score.factId);
    expect(approved.statusCode, approved.body).toBe(200);
    const fact = FactSchema.parse(approved.json());
    expect(fact).toMatchObject({ status: 'manually_approved', unverifiedReason: null, value: null });
    expect(fact.candidateValue).toEqual(score.candidateValue);
    expect(fact.manualApproval).toMatchObject({ carriedOverFromFactId: null });
    expect(fact.blockReason).toBeUndefined();
    expect(fact.reason).toContain('operator-attested');

    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, score.factId))).toBe('already_approved');

    const revoked = await manualApproval(app, 'DELETE', projectId, runId, score.factId);
    expect(revoked.statusCode, revoked.body).toBe(200);
    expect(FactSchema.parse(revoked.json())).toMatchObject({ status: 'unverified', manualApproval: null });
    expect(refusal(await manualApproval(app, 'DELETE', projectId, runId, score.factId))).toBe('not_approved');

    const audit = app.db.prepare('SELECT action FROM manual_approvals ORDER BY rowid').all() as { action: string }[];
    expect(audit.map((row) => row.action)).toEqual(['approved', 'revoked']);
    const stored = app.db.prepare('SELECT DISTINCT status FROM facts').all() as { status: string }[];
    expect(stored).toEqual([{ status: 'unverified' }]);
  });

  it('carries a manual approval over to an unchanged fact only, and refuses approvals on an earlier run', async () => {
    const app = await start();
    writeIdentityMap(app.fixtures, 'liga-local-2026.json', PINNED_MAP);
    const projectId = await createProject(app, 'liga-local', 'manual-a');
    const firstRun = await run(app, projectId);
    const first = await facts(app, projectId, firstRun);
    const scores = first.facts.filter((fact) => fact.kind === 'match_score');
    for (const fact of scores) {
      expect((await manualApproval(app, 'PUT', projectId, firstRun, fact.factId)).statusCode).toBe(200);
    }
    // A corrected reimport changes the second match's score.
    setScore(matchday1(app.manual.documents.get('manual-a') as Json, 'liga-local'), 1, { home: 3, away: 3 });
    const secondRun = await run(app, projectId);
    const second = await facts(app, projectId, secondRun);
    const [unchanged, changed] = second.facts
      .filter((fact) => fact.kind === 'match_score')
      .sort((a, b) => (a.factKey === scores[0]?.factKey ? -1 : b.factKey === scores[0]?.factKey ? 1 : 0)) as [
      (typeof second.facts)[number],
      (typeof second.facts)[number],
    ];
    expect(unchanged).toMatchObject({ status: 'manually_approved' });
    expect(unchanged.manualApproval?.carriedOverFromFactId).toBe(scores[0]?.factId);
    expect(changed).toMatchObject({ status: 'unverified', manualApproval: null });
    expect(refusal(await manualApproval(app, 'PUT', projectId, firstRun, scores[1]?.factId ?? ''))).toBe(
      'not_latest_run',
    );
  });

  it('an unpinned team name is team_identity_unmatched and its manual approval refused', async () => {
    const app = await start();
    writeIdentityMap(app.fixtures, 'liga-local-2026.json', PINNED_MAP);
    const payload = matchday1(app.manual.documents.get('manual-a') as Json, 'liga-local');
    ((payload['teams'] as Json[])[0] as Json)['name'] = 'Club Alfa Renombrado';
    const projectId = await createProject(app, 'liga-local', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const unmatched = list.facts.filter((fact) => fact.unverifiedReason === 'team_identity_unmatched');
    expect(unmatched.length).toBeGreaterThan(0);
    for (const fact of unmatched) {
      expect(fact.subject.teamId === undefined || /^[a-z0-9][a-z0-9-]{0,63}$/.test(fact.subject.teamId)).toBe(true);
    }
    expect(
      refusal(await manualApproval(app, 'PUT', projectId, runId, (unmatched[0] as { factId: string }).factId)),
    ).toBe('team_identity_unmatched');
  });

  it('without an identity map every team fact of a marked competition is unmatched', async () => {
    const app = await start();
    const projectId = await createProject(app, 'liga-local', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const teamFacts = list.facts.filter((fact) => fact.kind !== 'matchday_info' && fact.kind !== 'context_item');
    expect(teamFacts.every((fact) => fact.unverifiedReason === 'team_identity_unmatched')).toBe(true);
  });

  it('a manually approved fact of an unlinked manual competition stays blocked (PD-17)', async () => {
    const app = await start();
    const projectId = await createProject(app, 'manual-a-copa-manual', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const score = list.facts.find((fact) => fact.kind === 'match_score') as (typeof list.facts)[number];
    const approved = FactSchema.parse((await manualApproval(app, 'PUT', projectId, runId, score.factId)).json());
    expect(approved).toMatchObject({ status: 'manually_approved', blockReason: 'manually_approved_not_publishable' });
  });

  it('refuses facts contradicted by an accepted source and disputed facts (R-272)', async () => {
    const app = await start({ liveCEnabled: true });
    setScore(matchday1(app.live.documents.get('live-b') as Json, 'liga-mixta'), 0, { home: 4, away: 4 });
    setScore(matchday1(app.live.documents.get('live-c') as Json, 'liga-mixta'), 1, { home: 9, away: 9 });
    const projectId = await createProject(app, 'liga-mixta', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const scores = list.facts.filter((fact) => fact.kind === 'match_score');
    const disputed = scores.find((fact) => fact.unverifiedReason === 'disputed');
    expect(disputed).toBeDefined();
    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, disputed?.factId ?? ''))).toBe('disputed');
    // Both verification sources agree with each other and with the import on the kickoff: verified, refused.
    const verified = list.facts.find((fact) => fact.kind === 'match_kickoff' && fact.status === 'verified');
    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, verified?.factId ?? ''))).toBe('verified');
  });

  it('refuses a fact whose only accepted source disagrees with the import (accepted_source_disagrees)', async () => {
    const app = await start();
    setScore(matchday1(app.live.documents.get('live-b') as Json, 'liga-mixta'), 0, { home: 4, away: 4 });
    const projectId = await createProject(app, 'liga-mixta', 'manual-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const contradicted = list.facts.find(
      (fact) =>
        fact.kind === 'match_score' &&
        fact.evidence.some((evidence) => evidence.accepted && evidence.relation === 'disagrees') &&
        JSON.stringify(fact.candidateValue) === JSON.stringify({ home: 4, away: 4 }),
    );
    expect(contradicted?.unverifiedReason).toBe('awaiting_independent_verification');
    expect(refusal(await manualApproval(app, 'PUT', projectId, runId, contradicted?.factId ?? ''))).toBe(
      'accepted_source_disagrees',
    );
  });

  it('revoking invalidates the final approvals of carousels that use the fact', async () => {
    const app = await start();
    const projectId = await createProject(app, 'manual-a-copa-manual', 'manual-a');
    const runId = await run(app, projectId);
    const score = (await facts(app, projectId, runId)).facts.find((fact) => fact.kind === 'match_score') as {
      factId: string;
    };
    expect((await manualApproval(app, 'PUT', projectId, runId, score.factId)).statusCode).toBe(200);
    const ids = {
      draft: '10000000-0000-4000-8000-000000000001',
      carousel: '10000000-0000-4000-8000-000000000002',
      element: '10000000-0000-4000-8000-000000000003',
      version: '10000000-0000-4000-8000-000000000004',
      final: '10000000-0000-4000-8000-000000000005',
    };
    const at = '2026-10-27T13:00:00.000Z';
    app.db
      .prepare(
        'INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, ' +
          "excluded_match_keys, left_out_matches, created_at, superseded_at) VALUES (?, ?, ?, ?, 'es', 0, '[]', '[]', ?, NULL)",
      )
      .run([ids.draft, projectId, runId, runId, at]);
    app.db
      .prepare('INSERT INTO carousels (id, draft_id, sequence, total) VALUES (?, ?, 1, 1)')
      .run([ids.carousel, ids.draft]);
    app.db
      .prepare(
        "INSERT INTO elements (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id) VALUES (?, ?, 'slide', 1, 'match_result', 'm', '{}', NULL)",
      )
      .run([ids.element, ids.carousel]);
    app.db
      .prepare(
        'INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, ' +
          "qa_status, created_at) VALUES (?, ?, 1, 'generated', '[]', '[]', 'stub', 'passed', ?)",
      )
      .run([ids.version, ids.element, at]);
    app.db
      .prepare("INSERT INTO element_fact_refs (element_version_id, fact_id, usage) VALUES (?, ?, 'placeholder')")
      .run([ids.version, score.factId]);
    app.db
      .prepare(
        "INSERT INTO final_approvals (id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at) VALUES (?, ?, '[]', ?, ?, NULL)",
      )
      .run([ids.final, ids.carousel, 'b'.repeat(64), at]);
    expect((await manualApproval(app, 'DELETE', projectId, runId, score.factId)).statusCode).toBe(200);
    const final = app.db.prepare('SELECT invalidated_at FROM final_approvals WHERE id = ?').get([ids.final]) as {
      invalidated_at: string | null;
    };
    expect(final.invalidated_at).not.toBeNull();
  });
});

describe('facts routes: validation and not found', () => {
  it('answers 400 for malformed IDs and 404 for unknown project, run or fact', async () => {
    const app = await start();
    const projectId = await createProject(app, 'liga-demo', 'demo-a');
    const runId = await run(app, projectId);
    const unknown = '99999999-9999-4999-8999-999999999999';
    const get = (url: string) => app.inject({ method: 'GET', url, headers: READ_HEADERS });
    expect((await get(`/api/v1/projects/not-a-uuid/runs/${runId}/facts`)).statusCode).toBe(400);
    expect((await get(`/api/v1/projects/${unknown}/runs/${runId}/facts`)).statusCode).toBe(404);
    expect((await get(`/api/v1/projects/${projectId}/runs/${unknown}/facts`)).statusCode).toBe(404);
    expect((await manualApproval(app, 'PUT', projectId, runId, unknown)).statusCode).toBe(404);
    const other = await createProject(app, 'liga-demo', 'demo-a');
    expect((await get(`/api/v1/projects/${other}/runs/${runId}/facts`)).statusCode).toBe(404);
    const noClient = await app.inject({
      method: 'PUT',
      url: `/api/v1/projects/${projectId}/runs/${runId}/facts/${unknown}/manual-approval`,
      headers: READ_HEADERS,
    });
    expect(noClient.statusCode).toBe(403);
  });
});

describe('official consultation failures keep the source failure code (architecture.md 7.3, OD-56)', () => {
  /** Synthetic secret-looking text of an adapter failure: never stored (T10-F10). */
  const LEAK = 'Bearer synthetic-token https://live-o.example.test/v1/competitions?key=abc provider body';

  interface RetrievalRow {
    readonly source_id: string;
    readonly stage: string;
    readonly outcome: string;
    readonly retrieved_at: string;
    readonly failure: string | null;
  }

  /** A score dispute between live-a and live-b with live-o, the official publication, failing as `prepare` sets. */
  async function disputedWithOfficial(prepare: (app: VerificationTestApp) => void) {
    const app = await start({ liveOfficial: true });
    setScore(matchday1(app.live.documents.get('live-b') as Json, 'liga-live'), 1, { home: 1, away: 0 });
    prepare(app);
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    const disputed = list.facts.filter((fact) => fact.unverifiedReason === 'disputed');
    expect(disputed.map((fact) => fact.kind)).toEqual(['match_score']);
    const official = app.db
      .prepare(
        "SELECT source_id, stage, outcome, retrieved_at, failure FROM retrievals WHERE source_id = 'live-o' ORDER BY rowid",
      )
      .all() as unknown as RetrievalRow[];
    expect(official).toHaveLength(1);
    const stored = JSON.stringify([
      app.db.prepare('SELECT * FROM retrievals').all(),
      app.db.prepare('SELECT * FROM facts').all(),
      app.db.prepare('SELECT * FROM disputes').all(),
    ]);
    for (const fragment of ['Bearer', 'synthetic-token', 'example.test', 'key=abc', 'provider body']) {
      expect(stored).not.toContain(fragment);
    }
    return { fact: disputed[0] as (typeof disputed)[number], retrieval: official[0] as RetrievalRow };
  }

  /** The dispute names the failed consultation (source, attempt time) and the fact stays disputed and blocked. */
  function expectDisputedConsultation(
    fact: Awaited<ReturnType<typeof disputedWithOfficial>>['fact'],
    retrieval: RetrievalRow,
    code: string,
  ): void {
    expect(fact).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'disputed',
      value: null,
      candidateValue: null,
      blockReason: 'not_verified',
    });
    expect(fact.dispute).toMatchObject({ outcome: 'unavailable', consultedSourceId: 'live-o', resolvedValue: null });
    expect(Date.parse(fact.dispute?.consultedAt ?? '')).toBe(Date.parse(retrieval.retrieved_at));
    expect(fact.reason).toContain(`official publication (live-o) unavailable (code ${code})`);
    expect(fact.evidence.some((evidence) => evidence.sourceId === 'live-o')).toBe(false);
  }

  for (const method of ['listCompetitions', 'listSeasons', 'listStages'] as const) {
    it.each(SOURCE_ERROR_CODES)(`a ${method} SourceError %s reaches the retrieval and the dispute`, async (code) => {
      const { fact, retrieval } = await disputedWithOfficial((app) => {
        app.live.overrides.set(`live-o/${method}`, new SourceError(code, LEAK, 'live-o', null, 503, 30));
      });
      expect(retrieval.stage).toBe('verification');
      expect(retrieval.outcome).toBe(code === 'not_available' ? 'not_available' : 'failed');
      expect(JSON.parse(retrieval.failure ?? 'null')).toEqual({
        code,
        sourceId: 'live-o',
        path: null,
        httpStatus: 503,
      });
      expectDisputedConsultation(fact, retrieval, code);
    });
  }

  it.each([
    ['subscription_restricted', 'not_available', 'not_available'],
    ['not_found', 'not_available', 'not_available'],
    ['access_refused', 'access_refused', 'failed'],
    ['rate_limited', 'rate_limited', 'failed'],
    ['not_provided', 'no_data', 'failed'],
    ['source_unavailable', 'unavailable', 'failed'],
  ] as const)('a listing that answered unavailable (%s) is recorded with code %s', async (reason, code, outcome) => {
    const { fact, retrieval } = await disputedWithOfficial((app) => {
      app.live.overrides.set('live-o/listSeasons', {
        items: [],
        availability: { available: false, reason },
        retrievedAt: null,
        fromCache: false,
        stale: false,
        retryAfterSeconds: 60,
      });
    });
    expect(retrieval.outcome).toBe(outcome);
    expect(JSON.parse(retrieval.failure ?? 'null')).toEqual({ code, sourceId: 'live-o', path: null, httpStatus: null });
    expectDisputedConsultation(fact, retrieval, code);
  });

  it('anything else an adapter throws is unavailable, with none of its text', async () => {
    const { fact, retrieval } = await disputedWithOfficial((app) => {
      app.live.overrides.set('live-o/listCompetitions', new Error(LEAK));
    });
    expect(retrieval.outcome).toBe('failed');
    expect(JSON.parse(retrieval.failure ?? 'null')).toEqual({
      code: 'unavailable',
      sourceId: 'live-o',
      path: null,
      httpStatus: null,
    });
    expectDisputedConsultation(fact, retrieval, 'unavailable');
  });

  it('a counterpart the official source does not list stays not_available', async () => {
    const { fact, retrieval } = await disputedWithOfficial((app) => {
      app.live.documents.set('live-o', fixtureDocument([league('otra-liga', 'Otra Liga')]));
    });
    expect(retrieval.outcome).toBe('not_available');
    expect(JSON.parse(retrieval.failure ?? 'null')).toEqual({
      code: 'not_available',
      sourceId: 'live-o',
      path: null,
      httpStatus: null,
    });
    expectDisputedConsultation(fact, retrieval, 'not_available');
  });

  it('an official source that answers resolves the dispute with its value and records no failure', async () => {
    const app = await start({ liveOfficial: true });
    setScore(matchday1(app.live.documents.get('live-b') as Json, 'liga-live'), 1, { home: 1, away: 0 });
    const projectId = await createProject(app, 'liga-live', 'live-a');
    const runId = await run(app, projectId);
    const list = await facts(app, projectId, runId);
    expect(list.facts.filter((fact) => fact.unverifiedReason === 'disputed')).toEqual([]);
    const official = app.db
      .prepare("SELECT outcome, failure FROM retrievals WHERE source_id = 'live-o'")
      .all() as unknown as { outcome: string; failure: string | null }[];
    expect(official).toEqual([{ outcome: 'ok', failure: null }]);
  });
});
