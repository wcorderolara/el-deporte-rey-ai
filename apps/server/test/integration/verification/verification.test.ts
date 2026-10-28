/**
 * Verification through the HTTP API on the T23 DEMO_DATA scenarios and configurations: acceptance and agreement
 * rules (R-227, R-229), disputes, the official publication consultation and their outcomes (R-205, R-230), with the
 * expectations of `fixtures/sports/_manifest.json`.
 */
import type { Fact, FactListResponse } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { ResearchRepository } from '../../../src/modules/research/index.js';
import {
  LIGA_DEMO_MD1,
  type TestApp,
  type TestAppOptions,
  expectNoNetworkViolations,
  startTestApp,
} from '../../support/index.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

interface Verified {
  readonly t: TestApp;
  readonly projectId: string;
  readonly runId: string;
  readonly facts: FactListResponse;
}

/** Runs the full workflow on matchday 1 of liga-demo with a T23 configuration and scenario. */
async function verify(options: TestAppOptions): Promise<Verified> {
  const t = await startTestApp(options);
  apps.push(t);
  const project = await t.createProject(LIGA_DEMO_MD1);
  const run = await t.runWorkflow(project.id);
  expect(run.status, JSON.stringify(run.failure)).toBe('completed');
  return { t, projectId: project.id, runId: run.id, facts: await t.listFacts(project.id, run.id) };
}

/** The facts whose evidence from `sourceId` has a reference ending with `suffix` (for example `/match/01`). */
function factsOfRef(facts: readonly Fact[], sourceId: string, suffix: string): Fact[] {
  return facts.filter((fact) =>
    fact.evidence.some((evidence) => evidence.sourceId === sourceId && evidence.sourceRef.endsWith(suffix)),
  );
}

function supporters(fact: Fact): string[] {
  return fact.evidence
    .filter((evidence) => evidence.relation === 'supports')
    .map((evidence) => evidence.sourceId)
    .sort();
}

/** Every fact names its source(s); a verified fact has two supporting accepted sources of distinct groups (R-227). */
function expectAttributedAndAcceptedOnly(facts: readonly Fact[]): void {
  for (const fact of facts) {
    expect(fact.evidence.length, fact.factKey).toBeGreaterThan(0);
    for (const evidence of fact.evidence) {
      expect(evidence.sourceId.length).toBeGreaterThan(0);
      expect(evidence.sourceName.length).toBeGreaterThan(0);
    }
    if (fact.status === 'verified') {
      const supporting = fact.evidence.filter((evidence) => evidence.relation === 'supports');
      expect(
        supporting.every((evidence) => evidence.accepted),
        fact.factKey,
      ).toBe(true);
      expect(new Set(supporting.map((evidence) => evidence.sourceId)).size, fact.factKey).toBeGreaterThanOrEqual(2);
      expect(fact.blockReason, fact.factKey).toBeUndefined();
    }
  }
}

describe('agreement and acceptance (R-229, R-227)', () => {
  it('default: two agreeing accepted sources verify every value citing both', async () => {
    const { t, facts } = await verify({ base: 'demo-only', scenario: 'default' });
    expect(facts.facts).toHaveLength(68);
    expect(facts.facts.every((fact) => fact.status === 'verified')).toBe(true);
    for (const fact of facts.facts) {
      expect(supporters(fact), fact.factKey).toEqual(['demo-a', 'demo-b']);
      expect(fact.reason).toContain('demo-a');
      expect(fact.reason).toContain('demo-b');
    }
    expectAttributedAndAcceptedOnly(facts.facts);
    expect(t.egress.requests).toEqual([]);
  });

  it('single-source: values only in the primary source are not verified (awaiting independent verification)', async () => {
    const { facts } = await verify({ base: 'demo-only', scenario: 'single-source' });
    const missing = factsOfRef(facts.facts, 'demo-a', '/match/01');
    expect(missing.map((fact) => fact.kind).sort()).toEqual([
      'match_kickoff',
      'match_score',
      'match_status',
      'match_teams',
    ]);
    for (const fact of missing) {
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        value: null,
        blockReason: 'not_verified',
      });
      expect(fact.candidateValue).not.toBeNull();
      expect(fact.evidence.map((evidence) => evidence.sourceId)).toEqual(['demo-a']);
      expect(fact.reason).toContain('demo-a');
    }
    const otherMatchFacts = facts.facts.filter((fact) => fact.kind.startsWith('match_') && !missing.includes(fact));
    expect(otherMatchFacts.length).toBe(28);
    expect(otherMatchFacts.every((fact) => fact.status === 'verified')).toBe(true);
    expectAttributedAndAcceptedOnly(facts.facts);
  });

  it('unaccepted-source: an agreeing source configured accepted: false does not count; nothing is verified', async () => {
    const { t, facts } = await verify({ base: 'demo-unaccepted', scenario: 'unaccepted-source' });
    const demoB = t.container.sources.descriptors.find((source) => source.id === 'demo-b');
    expect(demoB?.accepted).toBe(false);
    expect(facts.facts.length).toBeGreaterThan(0);
    for (const fact of facts.facts) {
      expect(fact.status, fact.factKey).toBe('unverified');
      expect(fact.unverifiedReason).toBe('awaiting_independent_verification');
      expect(fact.blockReason).toBe('not_verified');
      const fromB = fact.evidence.filter((evidence) => evidence.sourceId === 'demo-b');
      expect(fromB.every((evidence) => !evidence.accepted && evidence.relation !== 'supports')).toBe(true);
      expect(supporters(fact)).toEqual(['demo-a']);
    }
  });

  it('unmatched-team: facts involving a team not identified in every source are not verified', async () => {
    const { facts } = await verify({ base: 'demo-only', scenario: 'unmatched-team' });
    const unmatched = facts.facts.filter((fact) => fact.unverifiedReason === 'team_identity_unmatched');
    expect(unmatched.map((fact) => fact.kind).sort()).toEqual([
      'match_kickoff',
      'match_score',
      'match_status',
      'match_teams',
      'standing_row',
      'team_official_name',
    ]);
    for (const fact of unmatched) {
      expect(fact.status).toBe('unverified');
      expect(fact.blockReason).toBe('not_verified');
      expect(JSON.stringify([fact.subject, fact.candidateValue]), fact.factKey).toContain('real-brisamar');
    }
    expect(factsOfRef(unmatched, 'demo-a', '/match/06')).toHaveLength(4);
    expect(facts.facts.filter((fact) => fact.status === 'verified')).toHaveLength(facts.facts.length - 6);
  });
});

describe('disputes and the official publication (R-205, R-230)', () => {
  /** The score fact of match 01, which every disputed scenario seeds with a disagreement. */
  function disputedScore(facts: FactListResponse): Fact {
    const [score] = factsOfRef(facts.facts, 'demo-a', '/match/01').filter((fact) => fact.kind === 'match_score');
    expect(score).toBeDefined();
    return score as Fact;
  }

  /** "No user action marks it verified": the manual approval is refused and the fact is unchanged. */
  async function expectNoManualVerification(v: Verified, fact: Fact): Promise<void> {
    const response = await v.t.send(
      'PUT',
      `/projects/${v.projectId}/runs/${v.runId}/facts/${fact.factId}/manual-approval`,
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'MANUAL_APPROVAL_REFUSED' });
    const again = disputedScore(await v.t.listFacts(v.projectId, v.runId));
    expect(again).toEqual(fact);
  }

  it('disputed-resolved: the official publication agrees with one source; verified 2-1 with the dispute kept', async () => {
    const v = await verify({ base: 'demo-official', scenario: 'disputed-resolved' });
    const fact = disputedScore(v.facts);
    expect(fact).toMatchObject({ status: 'verified', unverifiedReason: null, value: { home: 2, away: 1 } });
    expect(fact.blockReason).toBeUndefined();
    expect(fact.dispute).toMatchObject({
      outcome: 'resolved',
      consultedSourceId: 'demo-official',
      resolvedValue: { home: 2, away: 1 },
    });
    expect(fact.dispute?.consultedAt).not.toBeNull();
    expect(fact.dispute?.sourceValues.map((entry) => [entry.sourceId, entry.value])).toEqual([
      ['demo-a', { home: 2, away: 1 }],
      ['demo-b', { home: 1, away: 1 }],
      ['demo-official', { home: 2, away: 1 }],
    ]);
    expect(fact.evidence.find((evidence) => evidence.sourceId === 'demo-b')?.relation).toBe('disagrees');
    expect(fact.reason).toContain('demo-official');
  });

  it('disputed-unavailable: the official publication cannot be consulted; disputed, recorded, blocked', async () => {
    const v = await verify({ base: 'demo-official', scenario: 'disputed-unavailable' });
    const fact = disputedScore(v.facts);
    expect(fact).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'disputed',
      value: null,
      candidateValue: null,
      blockReason: 'not_verified',
    });
    // The dispute record stores the consultation: the source, the attempt time and the unavailability (7.3).
    expect(fact.dispute).toMatchObject({
      outcome: 'unavailable',
      consultedSourceId: 'demo-official',
      resolvedValue: null,
    });
    expect(fact.reason).toMatch(/demo-a.*demo-b/);
    expect(fact.reason).toContain('unavailable');
    expect(fact.reason).toContain('demo-official');
    expect(fact.evidence.some((evidence) => evidence.sourceId === 'demo-official')).toBe(false);
    // The consultation attempt is also a failed retrieval of the official publication with the source failure code
    // of the simulated outage (`unavailable`), at the same time as the dispute's consultation (AD-34).
    const retrievals = v.t.container.db
      .prepare<{ source_id: string; stage: string; outcome: string; retrieved_at: string; failure: string | null }>(
        'SELECT source_id, stage, outcome, retrieved_at, failure FROM retrievals WHERE run_id = ? ORDER BY rowid',
      )
      .all([v.runId]);
    const official = retrievals.filter((row) => row.source_id === 'demo-official');
    expect(official).toHaveLength(1);
    expect(official[0]?.outcome).toBe('failed');
    expect(JSON.parse(official[0]?.failure ?? 'null')).toMatchObject({
      code: 'unavailable',
      sourceId: 'demo-official',
    });
    expect(fact.dispute?.consultedAt).not.toBeNull();
    expect(Date.parse(fact.dispute?.consultedAt ?? '')).toBe(Date.parse(official[0]?.retrieved_at ?? ''));
    await expectNoManualVerification(v, fact);
  });

  it('disputed-no-match: the official publication gives a third value; the fact stays disputed and blocked', async () => {
    const v = await verify({ base: 'demo-official', scenario: 'disputed-no-match' });
    const fact = disputedScore(v.facts);
    expect(fact).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'disputed',
      value: null,
      blockReason: 'not_verified',
    });
    expect(fact.dispute?.consultedSourceId).toBe('demo-official');
    expect(fact.dispute?.resolvedValue).toBeNull();
    // Continued dispute (R-423): the official publication is an independent group (demo-official) and gives a third
    // value matching neither disagreeing source, so the outcome is no_match (architecture.md 7.3; T23 manifest).
    expect(fact.dispute?.outcome).toBe('no_match');
    expect(fact.dispute?.consultedAt).not.toBeNull();
    expect(fact.dispute?.sourceValues.find((entry) => entry.sourceId === 'demo-official')?.value).toEqual({
      home: 2,
      away: 2,
    });
    expect(fact.reason).toContain('demo-official');
    await expectNoManualVerification(v, fact);
  });

  it('disputed-same-source: the official publication is one of the disagreeing sources; stays disputed', async () => {
    const v = await verify({ base: 'demo-only', scenario: 'disputed-same-source' });
    const fact = disputedScore(v.facts);
    expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', blockReason: 'not_verified' });
    expect(fact.dispute).toMatchObject({ outcome: 'same_source', consultedSourceId: 'demo-b', resolvedValue: null });
    expect(fact.reason).toMatch(/demo-a.*demo-b/);
    await expectNoManualVerification(v, fact);
  });

  it('every other fact of the disputed scenarios is verified, and nothing reached a provider', async () => {
    const v = await verify({ base: 'demo-official', scenario: 'disputed-resolved' });
    expect(v.facts.facts.filter((fact) => fact.status !== 'verified')).toEqual([]);
    expect(v.facts.standings).toEqual({ available: false, reason: 'not_provided_by_source' });
    const observations = new ResearchRepository(v.t.container.db).observations(v.runId);
    expect(observations.every((observation) => observation.sourceId === 'demo-a')).toBe(true);
    expect(v.t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });
});
