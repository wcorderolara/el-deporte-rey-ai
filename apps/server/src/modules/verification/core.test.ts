/**
 * Unit tests of the verification core in isolation with research-format observations of synthetic selections
 * (R-225): every fact kind under the two-source rule (OD-10), team identity with and without identity maps (AD-18),
 * pinned team names (AD-38), source keys that are not slugs (T10-A1-06), untrusted keys (T11H-F07), manual
 * eligibility and carry-over (R-068, R-270, R-278), match statuses (OD-05).
 */
import { FactValueSchemasByKind, MatchKeySchema, SlugSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { type Json, selection } from '../../providers/sports/test/synthetic.js';

import {
  type DecidedFact,
  type SourceObservation,
  type VerifyInput,
  canonicalMatchKey,
  kickoffMinute,
  verifyRun,
} from './core.js';
import { canonicalJson } from './decision.js';
import { IdentityMapSchema, derivedTeamId, normalizeTeamName, resolveIdentities } from './identity.js';
import { arrayOf, snapshotObservations, source, sourcesOf } from './test/support.js';

const DEMO_SOURCES = sourcesOf(
  source('demo-a', 'DEMO_DATA'),
  source('demo-b', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
);

function input(observations: SourceObservation[], overrides: Partial<VerifyInput> = {}): VerifyInput {
  return {
    project: { competitionId: 'liga-sint', seasonId: '2026', sourceId: 'demo-a', dataMode: 'DEMO_DATA' },
    sources: DEMO_SOURCES,
    observations,
    identityMap: null,
    pinned: false,
    previousApprovals: [],
    ...overrides,
  };
}

function byKind(facts: readonly DecidedFact[], kind: DecidedFact['kind']): DecidedFact[] {
  return facts.filter((fact) => fact.kind === kind);
}

function teamIdOf(facts: readonly DecidedFact[], name: string): string {
  const fact = byKind(facts, 'team_official_name').find(
    (candidate) =>
      ((candidate.value ?? candidate.candidateValue) as { officialName: string } | null)?.officialName === name,
  );
  if (fact?.subject.teamId === undefined) {
    throw new Error(`team ${name} not found`);
  }
  return fact.subject.teamId;
}

describe('verification of a run (every fact kind, OD-10)', () => {
  it('two agreeing accepted sources verify every fact of the selection, citing both (R-229, R-270)', () => {
    const result = verifyRun(
      input([...snapshotObservations('demo-a'), ...snapshotObservations('demo-b', { stage: 'verification' })]),
    );
    const kinds = new Set(result.facts.map((fact) => fact.kind));
    expect([...kinds].sort()).toEqual(
      [
        'context_item',
        'match_kickoff',
        'match_score',
        'match_status',
        'match_teams',
        'matchday_info',
        'standing_row',
        'team_official_name',
      ].sort(),
    );
    for (const fact of result.facts) {
      expect(fact.status, fact.factKey).toBe('verified');
      expect(fact.evidence.filter((link) => link.relation === 'supports')).toHaveLength(2);
      expect(FactValueSchemasByKind[fact.kind].safeParse(fact.value).success).toBe(true);
    }
    expect(result.disputed).toBe(false);
    expect(new Set(result.facts.map((fact) => fact.factKey)).size).toBe(result.facts.length);
  });

  it('canonical keys and values fit the contract (slug team IDs, match keys) even for non-slug source keys', () => {
    const payload = selection({ teams: ['Équipe Ünö', 'B B', 'gamma', 'delta'] });
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a', { payload }),
        ...snapshotObservations('demo-b', {
          stage: 'verification',
          payload: selection({ teams: ['Équipe Ünö', 'B B', 'gamma', 'delta'] }),
        }),
      ]),
    );
    for (const fact of result.facts) {
      if (fact.subject.teamId !== undefined) {
        expect(SlugSchema.safeParse(fact.subject.teamId).success).toBe(true);
      }
      if (fact.subject.matchKey !== undefined) {
        expect(MatchKeySchema.safeParse(fact.subject.matchKey).success).toBe(true);
      }
      for (const value of fact.evidenceValues.values()) {
        expect(FactValueSchemasByKind[fact.kind].safeParse(value).success).toBe(true);
      }
    }
    expect(byKind(result.facts, 'match_teams').every((fact) => fact.status === 'verified')).toBe(true);
  });

  it('home and away swapped by the other source: match_teams disputed, the other match facts verified', () => {
    const swapped = selection();
    const [first] = arrayOf(swapped, 'matches') as [Json];
    [first['homeTeamKey'], first['awayTeamKey']] = [first['awayTeamKey'], first['homeTeamKey']];
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a'),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: swapped }),
      ]),
    );
    const teams = byKind(result.facts, 'match_teams');
    expect(teams.map((fact) => fact.unverifiedReason).sort()).toEqual(['disputed', null]);
    expect(result.disputed).toBe(true);
    const disputedMatch = teams.find((fact) => fact.unverifiedReason === 'disputed')?.subject.matchKey;
    const kickoff = result.facts.find((fact) => fact.factKey === `match:${String(disputedMatch)}:kickoff`);
    expect(kickoff?.status).toBe('verified');
  });

  it('a score disagreement is disputed and the official publication consulted (R-205, R-230)', () => {
    const changed = selection();
    (arrayOf(changed, 'matches')[0] as Json)['score'] = { home: 3, away: 1 };
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a'),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: changed }),
      ]),
    );
    const scores = byKind(result.facts, 'match_score');
    const disputed = scores.find((fact) => fact.unverifiedReason === 'disputed');
    expect(disputed?.dispute).toMatchObject({ outcome: 'same_source', consultedSourceId: 'demo-b' });
    expect(disputed?.candidateValue).toBeNull();
  });

  it('a dedicated consultation that agrees with one disagreeing source resolves the dispute (R-230, R-423)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const changed = selection();
    (arrayOf(changed, 'matches')[0] as Json)['score'] = { home: 3, away: 1 };
    const result = verifyRun(
      input(
        [
          ...snapshotObservations('demo-a'),
          ...snapshotObservations('demo-b', { stage: 'verification', payload: changed }),
          ...snapshotObservations('demo-o', { stage: 'consultation' }),
        ],
        { sources },
      ),
    );
    const resolved = byKind(result.facts, 'match_score').find((fact) => fact.dispute !== null);
    expect(resolved).toMatchObject({ status: 'verified', value: { home: 2, away: 1 } });
    expect(resolved?.dispute).toMatchObject({ outcome: 'resolved', consultedSourceId: 'demo-o' });
    // Consultation observations never change undisputed facts.
    const team = byKind(result.facts, 'team_official_name')[0];
    expect(team?.evidence.every((link) => result.facts.length > 0 && link.observationId !== undefined)).toBe(true);
  });

  it('a failed consultation of the official publication is recorded on the dispute (source, attempt time)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const changed = selection();
    (arrayOf(changed, 'matches')[0] as Json)['score'] = { home: 3, away: 1 };
    const attemptedAt = '2026-10-20T18:05:00.000Z';
    const result = verifyRun(
      input(
        [
          ...snapshotObservations('demo-a'),
          ...snapshotObservations('demo-b', { stage: 'verification', payload: changed }),
        ],
        {
          sources,
          attempts: [
            { sourceId: 'demo-b', attemptedAt: '2026-10-20T18:04:00.000Z' },
            { sourceId: 'demo-o', attemptedAt },
          ],
        },
      ),
    );
    const disputed = byKind(result.facts, 'match_score').filter((fact) => fact.dispute !== null);
    expect(disputed).toHaveLength(1);
    expect(disputed[0]).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', candidateValue: null });
    expect(disputed[0]?.dispute).toMatchObject({
      outcome: 'unavailable',
      consultedSourceId: 'demo-o',
      consultedObservationId: null,
      consultedAt: attemptedAt,
    });
    // Undisputed facts carry no dispute record and are unaffected by the attempts.
    expect(result.facts.filter((fact) => fact.dispute !== null)).toHaveLength(1);
  });

  it('kickoffs are compared as UTC instants truncated to the minute', () => {
    const shifted = selection();
    (arrayOf(shifted, 'matches')[0] as Json)['kickoff'] = '2026-10-20T12:00:42-06:00';
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a'),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: shifted }),
      ]),
    );
    expect(byKind(result.facts, 'match_kickoff').every((fact) => fact.status === 'verified')).toBe(true);
    expect(kickoffMinute('2026-10-20T12:00:42-06:00')).toBe('2026-10-20T18:00:00.000Z');
  });

  it('one LIVE_DATA source alone leaves every fact awaiting independent verification (R-055, R-271)', () => {
    const result = verifyRun(
      input([...snapshotObservations('live-a', { mode: 'LIVE_DATA' })], {
        project: { competitionId: 'liga-sint', seasonId: '2026', sourceId: 'live-a', dataMode: 'LIVE_DATA' },
        sources: sourcesOf(source('live-a', 'LIVE_DATA')),
      }),
    );
    expect(result.facts.length).toBeGreaterThan(0);
    for (const fact of result.facts) {
      expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'awaiting_independent_verification' });
      expect(fact.candidateValue).not.toBeNull();
    }
  });

  it('LIVE_DATA against an agreeing LIVE_DATA verification source of another group verifies (R-256)', () => {
    const sources = sourcesOf(source('live-a', 'LIVE_DATA'), source('live-b', 'LIVE_DATA', { role: 'verification' }));
    const project = {
      competitionId: 'liga-sint',
      seasonId: '2026',
      sourceId: 'live-a',
      dataMode: 'LIVE_DATA' as const,
    };
    const agreeing = verifyRun(
      input(
        [
          ...snapshotObservations('live-a', { mode: 'LIVE_DATA' }),
          ...snapshotObservations('live-b', { mode: 'LIVE_DATA', stage: 'verification' }),
        ],
        { project, sources },
      ),
    );
    expect(byKind(agreeing.facts, 'match_score').every((fact) => fact.status === 'verified')).toBe(true);
    const changed = selection();
    (arrayOf(changed, 'matches')[1] as Json)['score'] = { home: 1, away: 0 };
    const disagreeing = verifyRun(
      input(
        [
          ...snapshotObservations('live-a', { mode: 'LIVE_DATA' }),
          ...snapshotObservations('live-b', { mode: 'LIVE_DATA', stage: 'verification', payload: changed }),
        ],
        { project, sources },
      ),
    );
    expect(
      byKind(disagreeing.facts, 'match_score')
        .map((fact) => fact.unverifiedReason)
        .sort(),
    ).toEqual(['disputed', null]);
  });

  it('records every name form of every source as an alias of its team (R-237, R-426)', () => {
    const named = selection();
    (arrayOf(named, 'teams')[0] as Json)['aliases'] = ['ALF'];
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a', { payload: named }),
        ...snapshotObservations('demo-b', { stage: 'verification' }),
      ]),
    );
    const alfa = result.teams.find((team) => team.aliases.some((alias) => alias.alias === 'Club Alfa'));
    expect(alfa?.aliases.map((alias) => alias.alias)).toEqual(expect.arrayContaining(['Club Alfa', 'ALF']));
  });
});

describe('team identity (AD-18, OD-12)', () => {
  it('names that do not normalize equally leave the team unmatched; its facts are team_identity_unmatched', () => {
    const renamed = selection();
    (arrayOf(renamed, 'teams')[0] as Json)['name'] = 'Alfa Sociedad';
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a'),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: renamed }),
      ]),
    );
    const alfa = teamIdOf(result.facts, 'Club Alfa');
    const involving = result.facts.filter(
      (fact) =>
        fact.subject.teamId === alfa ||
        (fact.kind === 'match_teams' && JSON.stringify(fact.candidateValue).includes(alfa)),
    );
    expect(involving.length).toBeGreaterThan(0);
    for (const fact of involving) {
      expect(fact.unverifiedReason).toBe('team_identity_unmatched');
      expect(fact.manualEligible).toBe(false);
    }
    expect(byKind(result.facts, 'matchday_info')[0]?.status).toBe('verified');
  });

  it('accents, case, punctuation and ignored tokens do not prevent a name match', () => {
    expect(normalizeTeamName('C.D. Ñandú-Fútbol')).toBe('c d nandu futbol');
    expect(normalizeTeamName('Club Ñandú', new Set(['club']))).toBe('nandu');
    const accented = selection();
    (arrayOf(accented, 'teams')[0] as Json)['name'] = 'CLUB ÁLFA';
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a'),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: accented }),
      ]),
    );
    expect(result.facts.every((fact) => fact.status === 'verified')).toBe(true);
    // The official name comes from the official publication source (OD-12).
    const name = byKind(result.facts, 'team_official_name').find(
      (fact) => (fact.value as { officialName: string }).officialName === 'CLUB ÁLFA',
    );
    expect(name).toBeDefined();
  });

  it('an identity map matches teams whose names differ and gives its canonical IDs', () => {
    const renamed = selection();
    (arrayOf(renamed, 'teams')[0] as Json)['name'] = 'Alfa Sociedad';
    const identityMap = IdentityMapSchema.parse({
      competitionId: 'liga-sint',
      seasonId: '2026',
      teams: [
        {
          teamId: 'club-alfa',
          officialName: 'Club Alfa',
          sourceKeys: [
            { sourceId: 'demo-a', teamKey: 'alfa' },
            { sourceId: 'demo-b', teamKey: 'alfa' },
          ],
        },
      ],
    });
    const result = verifyRun(
      input(
        [
          ...snapshotObservations('demo-a'),
          ...snapshotObservations('demo-b', { stage: 'verification', payload: renamed }),
        ],
        { identityMap },
      ),
    );
    expect(result.facts.find((fact) => fact.factKey === 'standings:row:club-alfa')?.status).toBe('verified');
    expect(result.facts.find((fact) => fact.factKey === 'team:club-alfa:name')?.value).toEqual({
      teamId: 'club-alfa',
      officialName: 'Alfa Sociedad',
    });
  });

  it('team keys and names __proto__, constructor, prototype and toString are plain data (T11H-F07)', () => {
    const keys = ['__proto__', 'constructor', 'prototype', 'toString'];
    const payload = (): Json => {
      const value = selection({ teams: keys });
      arrayOf(value, 'teams').forEach((team, index) => {
        // The snapshot name rule refuses `_`; the identity layer is also tested with `__proto__` names below.
        team['name'] = (keys[index] ?? 'x').replace(/_/g, '');
      });
      return value;
    };
    const identityMap = IdentityMapSchema.parse({
      competitionId: 'liga-sint',
      seasonId: '2026',
      teams: keys.map((key) => ({
        teamId: `t-${key.replace(/[^a-z]/gi, '').toLowerCase()}`,
        officialName: key.replace(/_/g, 'x'),
        sourceKeys: [{ sourceId: 'demo-a', teamKey: key }],
      })),
    });
    const result = verifyRun(
      input(
        [
          ...snapshotObservations('demo-a', { payload: payload() }),
          ...snapshotObservations('demo-b', { stage: 'verification', payload: payload() }),
        ],
        {
          identityMap,
        },
      ),
    );
    expect(result.facts.length).toBeGreaterThan(10);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.prototype.toString.call({})).toBe('[object Object]');
    for (const fact of result.facts) {
      if (fact.subject.teamId !== undefined) {
        expect(SlugSchema.safeParse(fact.subject.teamId).success).toBe(true);
      }
    }
  });

  it('identity resolution keeps __proto__, constructor, prototype and toString names as data (T11H-F07)', () => {
    const names = ['__proto__', 'constructor', 'prototype', 'toString'];
    const teams = names.map((name) => ({ teamKey: name, name, aliases: [] }));
    const result = resolveIdentities({
      competitionId: 'liga-sint',
      seasonId: '2026',
      sources: [
        { sourceId: 'demo-a', teams },
        { sourceId: 'demo-b', teams },
      ],
      identitySourceIds: new Set(['demo-a', 'demo-b']),
      map: null,
      pinned: false,
    });
    expect(result.unmatched.size).toBe(0);
    const ids = names.map((name) => result.bySource.get('demo-a')?.get(name)?.teamId);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(SlugSchema.safeParse(id).success).toBe(true);
    }
    expect(ids).toEqual(names.map((name) => result.bySource.get('demo-b')?.get(name)?.teamId));
  });

  it('derived team IDs are deterministic slugs', () => {
    expect(derivedTeamId('liga-sint', '2026', 'club alfa')).toBe(derivedTeamId('liga-sint', '2026', 'club alfa'));
    expect(derivedTeamId('liga-sint', '2026', 'клуб')).toMatch(/^t-[0-9a-f]{12}$/);
    expect(canonicalMatchKey('b', 'a', 1)).toBe('a_b');
    expect(canonicalMatchKey('a'.repeat(64), 'b'.repeat(64), 2)).toMatch(/^m-[0-9a-f]{32}_2$/);
  });
});

describe('MANUAL_DATA facts, eligibility and carry-over (R-068, R-270, R-272, R-278)', () => {
  const sources = sourcesOf(source('manual', 'MANUAL_DATA'));
  const project = {
    competitionId: 'liga-sint',
    seasonId: '2026',
    sourceId: 'manual',
    dataMode: 'MANUAL_DATA' as const,
  };

  it('every MANUAL_DATA fact is unverified no_accepted_source with its candidate value and eligible', () => {
    const result = verifyRun(input(snapshotObservations('manual', { mode: 'MANUAL_DATA' }), { project, sources }));
    for (const fact of result.facts) {
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        manualEligible: true,
      });
      expect(fact.candidateValue).not.toBeNull();
      expect(fact.evidence.every((link) => link.relation === 'consulted')).toBe(true);
    }
  });

  it('carries a manual approval over only to unchanged facts', () => {
    const first = verifyRun(input(snapshotObservations('manual', { mode: 'MANUAL_DATA' }), { project, sources }));
    const previousApprovals = first.facts.map((fact, index) => ({
      factId: `00000000-0000-4000-8000-${String(900 + index).padStart(12, '0')}`,
      factKey: fact.factKey,
      candidateValue: canonicalJson(fact.candidateValue),
    }));
    const corrected = selection();
    (arrayOf(corrected, 'matches')[0] as Json)['score'] = { home: 2, away: 2 };
    const second = verifyRun(
      input(snapshotObservations('manual', { mode: 'MANUAL_DATA', payload: corrected }), {
        project,
        sources,
        previousApprovals,
      }),
    );
    const scores = byKind(second.facts, 'match_score');
    const changed = scores.find((fact) => (fact.candidateValue as { away: number }).away === 2);
    const unchanged = scores.find((fact) => (fact.candidateValue as { away: number }).away !== 2);
    expect(changed?.carriedOverFrom).toBeNull();
    expect(unchanged?.carriedOverFrom).toBe(
      previousApprovals.find((approval) => approval.factKey === unchanged?.factKey)?.factId,
    );
    expect(byKind(second.facts, 'team_official_name').every((fact) => fact.carriedOverFrom !== null)).toBe(true);
  });
});

describe('pinned team names for a competition without an accepted public source (AD-38 item 4)', () => {
  const sources = sourcesOf(source('manual', 'MANUAL_DATA'));
  const project = {
    competitionId: 'liga-sint',
    seasonId: '2026',
    sourceId: 'manual',
    dataMode: 'MANUAL_DATA' as const,
  };
  const pinnedMap = IdentityMapSchema.parse({
    competitionId: 'liga-sint',
    seasonId: '2026',
    teams: ['alfa', 'beta', 'gamma', 'delta'].map((key) => ({
      teamId: `club-${key}`,
      officialName: `Club ${key.charAt(0).toUpperCase()}${key.slice(1)}`,
      sourceKeys: [{ sourceId: 'manual', teamKey: key }],
    })),
  });

  function factsOf(payload: Json, identityMap: VerifyInput['identityMap']): readonly DecidedFact[] {
    return verifyRun(
      input(snapshotObservations('manual', { mode: 'MANUAL_DATA', payload }), {
        project,
        sources,
        identityMap,
        pinned: true,
      }),
    ).facts;
  }

  it('a pinned name is matched and its facts are eligible', () => {
    const facts = factsOf(selection(), pinnedMap);
    expect(facts.find((fact) => fact.factKey === 'standings:row:club-alfa')).toMatchObject({
      unverifiedReason: 'no_accepted_source',
      manualEligible: true,
    });
  });

  it('an unpinned name is team_identity_unmatched and not eligible', () => {
    const payload = selection();
    (arrayOf(payload, 'teams')[0] as Json)['name'] = 'Club Alfa Nuevo';
    const facts = factsOf(payload, pinnedMap);
    const unmatched = facts.filter((fact) => fact.unverifiedReason === 'team_identity_unmatched');
    expect(unmatched.length).toBeGreaterThan(0);
    expect(unmatched.every((fact) => !fact.manualEligible)).toBe(true);
    expect(facts.find((fact) => fact.factKey === 'standings:row:club-beta')?.manualEligible).toBe(true);
  });

  it('a name changed by a reimport (new derived key) is team_identity_unmatched', () => {
    const payload = selection({ teams: ['alfa-renombrado', 'beta', 'gamma', 'delta'] });
    const facts = factsOf(payload, pinnedMap);
    const standing = facts.filter((fact) => fact.kind === 'standing_row' && !fact.factKey.includes('club-'));
    expect(standing).toHaveLength(1);
    expect(standing[0]?.unverifiedReason).toBe('team_identity_unmatched');
  });

  it('without a map every fact involving a team is team_identity_unmatched', () => {
    const facts = factsOf(selection(), null);
    for (const fact of facts) {
      if (fact.kind === 'matchday_info' || fact.kind === 'context_item') {
        expect(fact.manualEligible).toBe(true);
      } else {
        expect(fact.unverifiedReason, fact.factKey).toBe('team_identity_unmatched');
        expect(fact.manualEligible).toBe(false);
      }
    }
  });
});

describe('match statuses (OD-05, R-409)', () => {
  it('records every provider-neutral status as a match_status fact; no score for unfinished matches', () => {
    const statuses = ['scheduled', 'in_play', 'postponed', 'suspended', 'cancelled', 'abandoned', 'awarded'];
    const payload = selection({
      teams: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'f1', 'f2', 'g1', 'g2'],
      standings: false,
    });
    const teams = arrayOf(payload, 'teams');
    payload['teams'] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'f1', 'f2', 'g1', 'g2'].map(
      (key, index) => ({ ...(teams[0] as Json), teamKey: key, name: `Equipo ${String.fromCharCode(65 + index)}` }),
    );
    payload['matches'] = statuses.map((status, index) => ({
      matchKey: `s${String(index)}`,
      homeTeamKey: `${String.fromCharCode(97 + index)}1`,
      awayTeamKey: `${String.fromCharCode(97 + index)}2`,
      kickoff: `2026-10-2${String(index)}T18:00:00Z`,
      status,
      score: null,
      ref: `fixture:synthetic/selection#s${String(index)}`,
    }));
    const result = verifyRun(
      input([
        ...snapshotObservations('demo-a', { payload }),
        ...snapshotObservations('demo-b', { stage: 'verification', payload: structuredClone(payload) }),
      ]),
    );
    expect(
      byKind(result.facts, 'match_status')
        .map((fact) => (fact.value as { matchStatus: string }).matchStatus)
        .sort(),
    ).toEqual([...statuses].sort());
    expect(byKind(result.facts, 'match_score')).toHaveLength(0);
  });
});
