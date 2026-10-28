/**
 * Shared domain validation of adapter output (contracts/provider-ports.md section 1.3): person fields dropped
 * (R-232, R-280), malformed data rejected with a validation error (R-224), name rules (T10-F06), untrusted keys
 * (T11H-F07), references never URLs (T11H-F14). Inline synthetic payloads only.
 */
import { describe, expect, it } from 'vitest';

import { CapturingLogger, FIXED_NOW, selection } from '../test/synthetic.js';

import { SourceError } from './errors.js';
import {
  validateCompetitionListing,
  validateSeasonListing,
  validateSelectionSnapshot,
  validateStageListing,
} from './validation.js';

type Json = Record<string, unknown>;

const DEMO = { id: 'demo-a', mode: 'DEMO_DATA' } as const;

function snapshot(payload: Json = selection()): Json {
  return {
    ...payload,
    sourceId: 'demo-a',
    mode: 'DEMO_DATA',
    retrievedAt: FIXED_NOW,
    fromCache: false,
    sourceRef: 'fixture:synthetic/demo-a.json',
    importVersionId: null,
  };
}

function rejection(action: () => unknown): SourceError {
  try {
    action();
  } catch (error) {
    if (error instanceof SourceError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a SourceError');
}

function listing(items: unknown[]): Json {
  return {
    items,
    availability: { available: true },
    retrievedAt: FIXED_NOW,
    fromCache: false,
    stale: false,
    retryAfterSeconds: null,
  };
}

describe('selection snapshot validation', () => {
  it('accepts a valid snapshot unchanged', () => {
    const logger = new CapturingLogger();
    const result = validateSelectionSnapshot(snapshot(), DEMO, logger);
    expect(result.matches).toHaveLength(2);
    expect(logger.lines).toEqual([]);
  });

  it('drops player-level and person fields and logs only their count (R-232, R-280)', () => {
    const payload = selection();
    const matches = payload['matches'] as Json[];
    const teams = payload['teams'] as Json[];
    matches[0] = {
      ...matches[0],
      scorers: [{ player: 'Jugador Sintetico Uno', minute: 12 }],
      referees: [{ name: 'Arbitro Sintetico' }],
    };
    teams[0] = { ...teams[0], coach: { name: 'Entrenador Sintetico' }, squad: [{ name: 'Jugador Sintetico Dos' }] };
    const logger = new CapturingLogger();

    const result = validateSelectionSnapshot({ ...snapshot(payload), lineups: [] }, DEMO, logger);

    const text = JSON.stringify(result);
    for (const value of ['scorers', 'referees', 'coach', 'squad', 'lineups', 'Jugador', 'Arbitro', 'Entrenador']) {
      expect(text).not.toContain(value);
    }
    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]?.fields).toEqual({ sourceId: 'demo-a', resource: 'selection', strippedKeys: 5 });
    expect(logger.text()).not.toContain('Jugador');
    expect(logger.text()).not.toContain('scorers');
  });

  it.each([
    ['a finished match without score', (p: Json) => ((p['matches'] as Json[])[0]!['score'] = null), '/matches/0/score'],
    [
      'a malformed kickoff',
      (p: Json) => ((p['matches'] as Json[])[0]!['kickoff'] = '20/10/2026'),
      '/matches/0/kickoff',
    ],
    [
      'a kickoff without offset',
      (p: Json) => ((p['matches'] as Json[])[0]!['kickoff'] = '2026-10-20T18:00:00'),
      '/matches/0/kickoff',
    ],
    [
      'an unknown team key',
      (p: Json) => ((p['matches'] as Json[])[0]!['homeTeamKey'] = 'omega'),
      '/matches/0/homeTeamKey',
    ],
    ['a missing teams list', (p: Json) => delete p['teams'], '/teams'],
    [
      'a score on a scheduled match',
      (p: Json) => ((p['matches'] as Json[])[0]!['status'] = 'scheduled'),
      '/matches/0/score',
    ],
    [
      'a duplicate standings position',
      (p: Json) => (((p['standings'] as Json)['rows'] as Json[])[1]!['position'] = 1),
      '/standings/rows/1/position',
    ],
    [
      'inconsistent standings arithmetic',
      (p: Json) => (((p['standings'] as Json)['rows'] as Json[])[0]!['played'] = 3),
      '/standings/rows/0/played',
    ],
    [
      'a negative score',
      (p: Json) => ((p['matches'] as Json[])[0]!['score'] = { home: -1, away: 0 }),
      '/matches/0/score/home',
    ],
    [
      'a fractional count',
      (p: Json) => (((p['standings'] as Json)['rows'] as Json[])[0]!['won'] = 0.5),
      '/standings/rows/0/won',
    ],
  ])('rejects %s with a validation error and its path (R-224)', (_label, mutate, path) => {
    const payload = selection();
    mutate(payload);
    const error = rejection(() => validateSelectionSnapshot(snapshot(payload), DEMO, new CapturingLogger()));
    expect(error.code).toBe('invalid');
    expect(error.sourceId).toBe('demo-a');
    expect(error.path).toBe(path);
  });

  it.each([
    ['a control character', 'Club\u0007Alfa'],
    ['a format character', 'Club\u200BAlfa'],
    ['a bidirectional override', 'Club \u202EAlfa'],
    ['markup', '<b>Club</b>'],
    ['a name over 64 characters', 'C'.repeat(65)],
  ])('rejects a team name with %s (T10-F06)', (_label, name) => {
    const payload = selection();
    (payload['teams'] as Json[])[0]!['name'] = name;
    expect(rejection(() => validateSelectionSnapshot(snapshot(payload), DEMO, new CapturingLogger())).path).toBe(
      '/teams/0/name',
    );
  });

  it('rejects stage and competition names with control or format characters (T10-F06)', () => {
    const stagePayload = selection({ stage: 'Fase\u0000Regular' });
    expect(rejection(() => validateSelectionSnapshot(snapshot(stagePayload), DEMO, new CapturingLogger())).path).toBe(
      '/stage/name',
    );
    const competitionPayload = selection({ competition: 'Liga\u2066Sintetica' });
    expect(
      rejection(() => validateSelectionSnapshot(snapshot(competitionPayload), DEMO, new CapturingLogger())).path,
    ).toBe('/competition/name');
  });

  it('rejects a reference that is a URL or lacks an attribution prefix (T11H-F14)', () => {
    const url = selection({ refPrefix: 'source:x/matches@https://host.example.test' });
    expect(rejection(() => validateSelectionSnapshot(snapshot(url), DEMO, new CapturingLogger())).code).toBe('invalid');
    expect(
      rejection(() =>
        validateSelectionSnapshot({ ...snapshot(), sourceRef: 'demo-a.json' }, DEMO, new CapturingLogger()),
      ).path,
    ).toBe('/sourceRef');
  });

  it('rejects a snapshot claiming another source or another mode', () => {
    expect(
      rejection(() => validateSelectionSnapshot({ ...snapshot(), sourceId: 'demo-b' }, DEMO, new CapturingLogger()))
        .path,
    ).toBe('/sourceId');
    expect(
      rejection(() =>
        validateSelectionSnapshot(
          { ...snapshot(), mode: 'LIVE_DATA', sourceRef: 'source:demo-a/matches@x' },
          DEMO,
          new CapturingLogger(),
        ),
      ).path,
    ).toBe('/mode');
  });

  it('treats __proto__, constructor, prototype and toString as plain team keys (T11H-F07)', () => {
    const keys = ['__proto__', 'constructor', 'prototype', 'toString'];
    const accepted = validateSelectionSnapshot(snapshot(selection({ teams: keys })), DEMO, new CapturingLogger());
    expect(accepted.teams.map((team) => team.teamKey)).toEqual(keys);

    // A match referring to an undeclared inherited member name is still an unknown team.
    const payload = selection();
    (payload['matches'] as Json[])[0]!['homeTeamKey'] = 'constructor';
    expect(rejection(() => validateSelectionSnapshot(snapshot(payload), DEMO, new CapturingLogger())).path).toBe(
      '/matches/0/homeTeamKey',
    );
  });

  it('keeps every adapter output to one schema: the same payload in three modes passes it (R-267)', () => {
    const live = validateSelectionSnapshot(
      { ...snapshot(), sourceId: 'live-a', mode: 'LIVE_DATA', sourceRef: `source:live-a/matches@${FIXED_NOW}` },
      { id: 'live-a', mode: 'LIVE_DATA' },
      new CapturingLogger(),
    );
    const manual = validateSelectionSnapshot(
      {
        ...snapshot(),
        sourceId: 'manual-a',
        mode: 'MANUAL_DATA',
        sourceRef: 'import:00000000-0000-4000-8000-000000000001/v1',
        importVersionId: '00000000-0000-4000-8000-000000000001',
      },
      { id: 'manual-a', mode: 'MANUAL_DATA' },
      new CapturingLogger(),
    );
    const demo = validateSelectionSnapshot(snapshot(), DEMO, new CapturingLogger());
    const core = (value: Json): Json => ({
      teams: value['teams'],
      matches: value['matches'],
      standings: value['standings'],
    });
    expect(core(live)).toEqual(core(demo));
    expect(core(manual)).toEqual(core(demo));
  });
});

describe('listing validation', () => {
  const competitionItem = (localKey: string): Json => ({
    ref: `{"c":"${localKey}"}`,
    localKey,
    name: 'Liga Sintetica',
    areaName: null,
  });

  it('accepts competition, season and stage listings and strips unknown keys', () => {
    const logger = new CapturingLogger();
    const result = validateCompetitionListing(listing([{ ...competitionItem('liga'), emblem: 'x' }]), 'demo-a', logger);
    expect(result.items[0]).toEqual(competitionItem('liga'));
    expect(logger.lines[0]?.fields['strippedKeys']).toBe(1);

    const seasons = validateSeasonListing(
      listing([
        { ref: '{}', id: '2026', label: '2026/27', current: true, startDate: null, endDate: null, startYear: 2026 },
      ]),
      'demo-a',
      logger,
    );
    expect(seasons.items).toHaveLength(1);
    const stages = validateStageListing(
      listing([
        {
          id: 'regular',
          name: 'Fase Regular',
          order: 1,
          standings: 'expected',
          wholeStageRef: null,
          matchdays: [{ number: 1, ref: '{}' }],
        },
      ]),
      'demo-a',
      logger,
    );
    expect(stages.items[0]?.matchdays).toHaveLength(1);
  });

  it('rejects repeated lookup keys within a listing', () => {
    expect(
      rejection(() =>
        validateCompetitionListing(
          listing([competitionItem('liga'), competitionItem('liga')]),
          'demo-a',
          new CapturingLogger(),
        ),
      ).path,
    ).toBe('/items/1/localKey');
  });

  it('rejects a __proto__ local key (not a slug) instead of using it as a lookup key (T11H-F07)', () => {
    expect(
      rejection(() =>
        validateCompetitionListing(listing([competitionItem('__proto__')]), 'demo-a', new CapturingLogger()),
      ).path,
    ).toBe('/items/0/localKey');
  });

  it('rejects an unknown standings expectation and a stage name with a format character', () => {
    const base = {
      id: 'regular',
      name: 'Fase Regular',
      order: 1,
      standings: 'expected',
      wholeStageRef: null,
      matchdays: [],
    };
    expect(
      rejection(() => validateStageListing(listing([{ ...base, standings: 'maybe' }]), 'demo-a', new CapturingLogger()))
        .path,
    ).toBe('/items/0/standings');
    expect(
      rejection(() =>
        validateStageListing(listing([{ ...base, name: 'Fase\u200DRegular' }]), 'demo-a', new CapturingLogger()),
      ).path,
    ).toBe('/items/0/name');
  });
});
