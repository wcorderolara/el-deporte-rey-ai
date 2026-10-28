/**
 * Unit tests of the decision rule in isolation (architecture.md section 7.3), one per row, plus source independence
 * (OD-24, T11H-F13), R-055, R-205, R-227, R-229, R-230, R-256, R-270 and R-271. Synthetic values only.
 */
import { describe, expect, it } from 'vitest';

import { decideFact, decideTeamName } from './decision.js';
import { context, observation, source, sourcesOf } from './test/support.js';

const ONE = { home: 2, away: 1 };
const TWO = { home: 1, away: 1 };
const THREE = { home: 0, away: 3 };

function relations(decision: ReturnType<typeof decideFact>): string[] {
  return decision.evidence.map((link) => link.relation);
}

describe('decision rule (section 7.3)', () => {
  it('no accepted value: unverified no_accepted_source without candidate for a non-manual project (R-229)', () => {
    const sources = sourcesOf(source('live-a', 'LIVE_DATA', { accepted: false }));
    const decision = decideFact([observation('live-a', ONE, 'research')], [], context('LIVE_DATA', 'live-a', sources));
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'no_accepted_source',
      value: null,
      candidateValue: null,
      manualEligible: false,
    });
    expect(relations(decision)).toEqual(['consulted']);
  });

  it('no accepted value in a MANUAL_DATA project: the manual value is the candidate and the fact is eligible', () => {
    const sources = sourcesOf(source('manual', 'MANUAL_DATA'));
    const decision = decideFact(
      [observation('manual', ONE, 'research')],
      [],
      context('MANUAL_DATA', 'manual', sources),
    );
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'no_accepted_source',
      candidateValue: ONE,
      manualEligible: true,
    });
    expect(relations(decision)).toEqual(['consulted']);
  });

  it('one independence group: awaiting independent verification naming the single source (R-055, R-271)', () => {
    const sources = sourcesOf(source('live-a', 'LIVE_DATA'));
    const decision = decideFact([observation('live-a', ONE, 'research')], [], context('LIVE_DATA', 'live-a', sources));
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'awaiting_independent_verification',
      value: null,
      candidateValue: ONE,
      manualEligible: false,
      dispute: null,
    });
    expect(decision.reason).toContain('single source: live-a');
  });

  it('all groups agree: verified with the value, citing both sources (R-229)', () => {
    const sources = sourcesOf(source('demo-a', 'DEMO_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', ONE)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'verified', unverifiedReason: null, value: ONE, candidateValue: null });
    expect(relations(decision)).toEqual(['supports', 'supports']);
    expect(decision.reason).toContain('demo-a, demo-b');
  });

  it('a non-accepted source never counts toward agreement (R-227, R-229)', () => {
    const sources = sourcesOf(source('demo-a', 'DEMO_DATA'), source('demo-c', 'DEMO_DATA', { accepted: false }));
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-c', ONE)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.unverifiedReason).toBe('awaiting_independent_verification');
    expect(relations(decision)).toEqual(['supports', 'consulted']);
  });

  it('groups disagree without an official publication: disputed, outcome unavailable, no candidate (R-205)', () => {
    const sources = sourcesOf(source('demo-a', 'DEMO_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', candidateValue: null });
    expect(decision.dispute?.outcome).toBe('unavailable');
    expect(decision.dispute?.sourceValues.map((entry) => entry.sourceId)).toEqual(['demo-a', 'demo-b']);
    expect(decision.reason).toContain('demo-a, demo-b');
    expect(relations(decision)).toEqual(['disagrees', 'disagrees']);
  });

  it('official group is one of two disagreeing groups: its value counts once, stays disputed (same_source)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.unverifiedReason).toBe('disputed');
    expect(decision.dispute).toMatchObject({
      outcome: 'same_source',
      consultedSourceId: 'demo-b',
      resolvedValue: null,
    });
  });

  it('official group plus another independent group support one value: resolved and verified (R-230, R-423)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { officialPublication: true }),
      source('demo-c', 'DEMO_DATA'),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO), observation('demo-c', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'verified', value: TWO });
    expect(decision.dispute).toMatchObject({ outcome: 'resolved', resolvedValue: TWO, consultedSourceId: 'demo-b' });
    expect(relations(decision)).toEqual(['disagrees', 'supports', 'supports']);
  });

  it('consultation of the official publication equal to exactly one disagreeing value: resolved (R-230)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA'),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const consulted = observation('demo-o', ONE, 'consultation');
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [consulted],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'verified', value: ONE });
    expect(decision.dispute).toMatchObject({
      outcome: 'resolved',
      consultedSourceId: 'demo-o',
      consultedObservationId: consulted.observationId,
    });
    expect(decision.evidence.at(-1)).toEqual({ observationId: consulted.observationId, relation: 'supports' });
  });

  it('consultation gives a third value: stays disputed with outcome no_match, consultation recorded (R-205)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA'),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const consulted = observation('demo-o', THREE, 'consultation');
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [consulted],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', value: null });
    expect(decision.dispute).toMatchObject({ outcome: 'no_match', consultedSourceId: 'demo-o', resolvedValue: null });
    expect(decision.evidence.at(-1)?.relation).toBe('consulted');
  });

  it('a tie between two values supported by two groups each stays disputed (no_match)', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA'),
      source('demo-c', 'DEMO_DATA'),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO), observation('demo-c', TWO)],
      [observation('demo-o', ONE, 'consultation')],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.unverifiedReason).toBe('disputed');
    expect(decision.dispute?.outcome).toBe('no_match');
  });

  it('an independent official publication observed in verification gives a third value: no_match (R-230, R-423)', () => {
    // T41 F-01: the official publication is a counted source of its own independence group; the other two groups
    // disagree on their own, so it is an independent arbiter and its third value matches neither (no_match).
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
    );
    const official = observation('demo-o', THREE);
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO), official],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', candidateValue: null });
    expect(decision.dispute).toMatchObject({
      outcome: 'no_match',
      consultedSourceId: 'demo-o',
      consultedObservationId: official.observationId,
      consultedAt: official.retrievedAt,
      resolvedValue: null,
    });
    expect(decision.reason).toContain('demo-o');
    expect(relations(decision)).toEqual(['disagrees', 'disagrees', 'disagrees']);
  });

  it('an independent official publication in a tie of two groups per value: no_match', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA'),
      source('demo-c', 'DEMO_DATA'),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO), observation('demo-c', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    // Without the official value the groups already disagree; with it, ONE and TWO have two groups each.
    const withOfficial = decideFact(
      [
        observation('demo-a', ONE, 'research'),
        observation('demo-b', TWO),
        observation('demo-c', TWO),
        observation('demo-o', ONE),
      ],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.dispute?.outcome).toBe('unavailable');
    expect(withOfficial.dispute?.outcome).toBe('no_match');
  });

  it('an official publication sharing the group of a disagreeing source: same_source, also when consulted', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { independenceGroup: 'upstream' }),
      source('demo-o', 'DEMO_DATA', { independenceGroup: 'upstream', officialPublication: true }),
    );
    const observed = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO), observation('demo-o', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(observed.unverifiedReason).toBe('disputed');
    expect(observed.dispute).toMatchObject({ outcome: 'same_source', consultedSourceId: 'demo-o' });
    expect(observed.reason).toContain('independence group');

    const consulted = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [observation('demo-o', THREE, 'consultation')],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(consulted.unverifiedReason).toBe('disputed');
    expect(consulted.dispute).toMatchObject({ outcome: 'same_source', consultedSourceId: 'demo-o' });
  });

  it('an official publication alone against agreeing groups is a disagreeing party: same_source', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA'),
      source('demo-o', 'DEMO_DATA', { officialPublication: true }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', ONE), observation('demo-o', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', value: null });
    expect(decision.dispute).toMatchObject({ outcome: 'same_source', consultedSourceId: 'demo-o' });
  });

  it('a failed official consultation is recorded with its source and attempt time, outcome unavailable', () => {
    // T41 F-02 (architecture.md 7.3): the dispute record stores the consultation source and time, not only a
    // retrieval row; the fact stays disputed without a candidate value.
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
    );
    const attemptedAt = '2026-08-17T10:00:00.000Z';
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources, {
        attempts: [
          { sourceId: 'demo-b', attemptedAt: '2026-08-17T09:00:00.000Z' },
          { sourceId: 'demo-o', attemptedAt },
        ],
      }),
    );
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'disputed',
      value: null,
      candidateValue: null,
      manualEligible: false,
    });
    expect(decision.dispute).toEqual({
      sourceValues: [
        { sourceId: 'demo-a', independenceGroup: 'demo-a', value: ONE },
        { sourceId: 'demo-b', independenceGroup: 'demo-b', value: TWO },
      ],
      consultedSourceId: 'demo-o',
      consultedObservationId: null,
      consultedAt: attemptedAt,
      outcome: 'unavailable',
      resolvedValue: null,
    });
    expect(decision.reason).toContain('official publication (demo-o) unavailable');
  });

  it.each(['unavailable', 'rate_limited', 'timeout', 'access_refused', 'not_available', 'invalid'] as const)(
    'a consultation failed with %s names that closed code, never another one (OD-56)',
    (code) => {
      const sources = sourcesOf(
        source('demo-a', 'DEMO_DATA'),
        source('demo-b', 'DEMO_DATA', { role: 'verification' }),
        source('demo-o', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
      );
      const attemptedAt = '2026-08-17T10:00:00.000Z';
      const decision = decideFact(
        [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
        [],
        context('DEMO_DATA', 'demo-a', sources, {
          attempts: [
            { sourceId: 'demo-b', attemptedAt: '2026-08-17T09:00:00.000Z', failureCode: null },
            { sourceId: 'demo-o', attemptedAt, failureCode: code },
          ],
        }),
      );
      expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed', value: null });
      expect(decision.dispute).toMatchObject({ consultedSourceId: 'demo-o', consultedAt: attemptedAt });
      expect(decision.dispute?.outcome).toBe('unavailable');
      expect(decision.reason).toContain(`official publication (demo-o) unavailable (code ${code}).`);
    },
  );

  it('a consultation that answered without a value for the key names no failure code', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { role: 'verification', officialPublication: true }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources, {
        attempts: [{ sourceId: 'demo-o', attemptedAt: '2026-08-17T10:00:00.000Z', failureCode: null }],
      }),
    );
    expect(decision.dispute).toMatchObject({ outcome: 'unavailable', consultedSourceId: 'demo-o' });
    expect(decision.reason).toContain('official publication (demo-o) unavailable.');
    expect(decision.reason).not.toContain('(code ');
  });

  it('attempts of non-official or non-counted sources are not recorded as the consultation', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA'),
      source('demo-b', 'DEMO_DATA', { role: 'verification' }),
      source('demo-o', 'DEMO_DATA', { officialPublication: true, accepted: false }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources, {
        attempts: [
          { sourceId: 'demo-b', attemptedAt: '2026-08-17T09:00:00.000Z' },
          { sourceId: 'demo-o', attemptedAt: '2026-08-17T10:00:00.000Z' },
        ],
      }),
    );
    expect(decision.dispute).toMatchObject({ outcome: 'unavailable', consultedSourceId: null, consultedAt: null });
  });

  it('differing values inside one independence group make the fact disputed', () => {
    const sources = sourcesOf(
      source('demo-a', 'DEMO_DATA', { independenceGroup: 'upstream' }),
      source('demo-b', 'DEMO_DATA', { independenceGroup: 'upstream' }),
    );
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.unverifiedReason).toBe('disputed');
  });

  it('a fact involving an unmatched team is team_identity_unmatched and never eligible', () => {
    const sources = sourcesOf(source('manual', 'MANUAL_DATA'));
    const decision = decideFact(
      [observation('manual', ONE, 'research')],
      [],
      context('MANUAL_DATA', 'manual', sources, { teamUnmatched: true }),
    );
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'team_identity_unmatched',
      manualEligible: false,
    });
  });
});

describe('source independence (OD-24, T11H-F13)', () => {
  it('two sources of one independence group count once', () => {
    const sources = sourcesOf(
      source('live-a', 'LIVE_DATA', { independenceGroup: 'upstream' }),
      source('live-b', 'LIVE_DATA', { independenceGroup: 'upstream' }),
    );
    const decision = decideFact(
      [observation('live-a', ONE, 'research'), observation('live-b', ONE)],
      [],
      context('LIVE_DATA', 'live-a', sources),
    );
    expect(decision.unverifiedReason).toBe('awaiting_independent_verification');
  });

  it('an agreeing DEMO_DATA observation leaves a LIVE_DATA fact awaiting and is only consulted', () => {
    const sources = sourcesOf(source('live-a', 'LIVE_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('live-a', ONE, 'research'), observation('demo-b', ONE)],
      [],
      context('LIVE_DATA', 'live-a', sources),
    );
    expect(decision.unverifiedReason).toBe('awaiting_independent_verification');
    expect(relations(decision)).toEqual(['supports', 'consulted']);
  });

  it('a disagreeing DEMO_DATA observation does not make a LIVE_DATA fact disputed', () => {
    const sources = sourcesOf(source('live-a', 'LIVE_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('live-a', ONE, 'research'), observation('demo-b', TWO)],
      [],
      context('LIVE_DATA', 'live-a', sources),
    );
    expect(decision.unverifiedReason).toBe('awaiting_independent_verification');
    expect(decision.dispute).toBeNull();
    expect(relations(decision)).toEqual(['supports', 'consulted']);
  });

  it('a DEMO_DATA observation alone leaves a MANUAL_DATA fact with no accepted source', () => {
    const sources = sourcesOf(source('manual', 'MANUAL_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('manual', ONE, 'research'), observation('demo-b', ONE)],
      [],
      context('MANUAL_DATA', 'manual', sources),
    );
    expect(decision).toMatchObject({
      unverifiedReason: 'no_accepted_source',
      candidateValue: ONE,
      manualEligible: true,
    });
    expect(relations(decision)).toEqual(['consulted', 'consulted']);
  });

  it('DEMO_DATA observations count for DEMO_DATA projects', () => {
    const sources = sourcesOf(source('demo-a', 'DEMO_DATA'), source('demo-b', 'DEMO_DATA'));
    const decision = decideFact(
      [observation('demo-a', ONE, 'research'), observation('demo-b', ONE)],
      [],
      context('DEMO_DATA', 'demo-a', sources),
    );
    expect(decision.status).toBe('verified');
  });
});

describe('LIVE_DATA against an independent LIVE_DATA verification source (R-256)', () => {
  const sources = sourcesOf(
    source('live-a', 'LIVE_DATA'),
    source('live-b', 'LIVE_DATA', { role: 'verification', independenceGroup: 'live-b' }),
  );

  it('disagreeing gives unverified disputed', () => {
    const decision = decideFact(
      [observation('live-a', ONE, 'research'), observation('live-b', TWO)],
      [],
      context('LIVE_DATA', 'live-a', sources),
    );
    expect(decision).toMatchObject({ status: 'unverified', unverifiedReason: 'disputed' });
  });

  it('agreeing gives verified citing both sources', () => {
    const decision = decideFact(
      [observation('live-a', ONE, 'research'), observation('live-b', ONE)],
      [],
      context('LIVE_DATA', 'live-a', sources),
    );
    expect(decision).toMatchObject({ status: 'verified', value: ONE });
    expect(relations(decision)).toEqual(['supports', 'supports']);
  });
});

describe('MANUAL_DATA facts (R-270, R-272)', () => {
  it('an accepted source with a different value makes the fact not eligible and records the disagreement', () => {
    const sources = sourcesOf(source('manual', 'MANUAL_DATA'), source('live-b', 'LIVE_DATA'));
    const decision = decideFact(
      [observation('manual', ONE, 'research'), observation('live-b', TWO)],
      [],
      context('MANUAL_DATA', 'manual', sources),
    );
    expect(decision).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'awaiting_independent_verification',
      candidateValue: TWO,
      manualEligible: false,
    });
    expect(relations(decision)).toEqual(['consulted', 'disagrees']);
  });

  it('an accepted source with the same value keeps the fact awaiting and eligible', () => {
    const sources = sourcesOf(source('manual', 'MANUAL_DATA'), source('live-b', 'LIVE_DATA'));
    const decision = decideFact(
      [observation('manual', ONE, 'research'), observation('live-b', ONE)],
      [],
      context('MANUAL_DATA', 'manual', sources),
    );
    expect(decision).toMatchObject({ unverifiedReason: 'awaiting_independent_verification', manualEligible: true });
  });
});

describe('team official name (OD-12, R-426)', () => {
  const sources = sourcesOf(
    source('demo-a', 'DEMO_DATA'),
    source('demo-b', 'DEMO_DATA', { officialPublication: true }),
  );

  it('identity confirmed by two groups: verified with the official publication name; other forms consulted', () => {
    const decision = decideTeamName(
      [
        observation('demo-a', { teamId: 'club-alfa', officialName: 'C. Alfa' }, 'research'),
        observation('demo-b', { teamId: 'club-alfa', officialName: 'Club Alfa Ñandú' }),
      ],
      [],
      context('DEMO_DATA', 'demo-a', sources, { kind: 'team_official_name' }),
    );
    expect(decision).toMatchObject({
      status: 'verified',
      value: { teamId: 'club-alfa', officialName: 'Club Alfa Ñandú' },
    });
    expect(relations(decision)).toEqual(['consulted', 'supports']);
  });

  it('identity seen by one group only: awaiting with the name as candidate', () => {
    const decision = decideTeamName(
      [observation('demo-a', { teamId: 'club-alfa', officialName: 'Club Alfa' }, 'research')],
      [],
      context('DEMO_DATA', 'demo-a', sources, { kind: 'team_official_name' }),
    );
    expect(decision.unverifiedReason).toBe('awaiting_independent_verification');
  });
});
