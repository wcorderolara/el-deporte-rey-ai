/**
 * Pure core of the research stage in isolation with inline synthetic fixture inputs (R-225): every match, team,
 * standings row and context item becomes an attributed observation equal to the fixture value (R-202, R-024, R-204,
 * R-287); missing standings are recorded with their reason and nothing is derived (R-254); a MANUAL_DATA selection
 * keeps its import version; stripped fields are never stored (R-232); invalid outputs are refused (R-224); source
 * failures keep their closed code (T10-F10). All teams and competitions are invented.
 */
import { type SelectionSnapshot, SelectionSnapshotSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import {
  MAX_FACT_KEY_LENGTH,
  type ResearchObservation,
  ResearchOutputSchema,
  type RetrievedResearch,
  refusedResearch,
  researchFactKey,
  researchSnapshot,
  retrievalOutcomeOf,
} from './core.js';

const IMPORT_VERSION_ID = '0a0a0a0a-0000-4000-8000-00000000000a';

/** A known matchday: three matches (two finished, one postponed), four teams, full standings and two context items. */
const MATCHDAY = {
  sourceId: 'demo-a',
  mode: 'DEMO_DATA',
  retrievedAt: '2026-10-21T10:15:00.000Z',
  fromCache: false,
  sourceRef: 'fixture:inline/demo-a.json',
  importVersionId: null,
  competition: { name: 'Liga Inventada' },
  season: { label: '2026/27' },
  stage: { name: 'Fase Regular', matchday: 3, totalMatchdays: 10 },
  teams: [
    { teamKey: 'norte', name: 'Club Norte', aliases: ['Norte'], ref: 'fixture:inline/demo-a.json#team-norte' },
    { teamKey: 'sur', name: 'Atletico Sur', aliases: [], ref: 'fixture:inline/demo-a.json#team-sur' },
    { teamKey: 'este', name: 'Deportivo Este', aliases: [], ref: 'fixture:inline/demo-a.json#team-este' },
    { teamKey: 'oeste', name: 'Union Oeste', aliases: ['U. Oeste'], ref: 'fixture:inline/demo-a.json#team-oeste' },
  ],
  matches: [
    {
      matchKey: 'p1',
      homeTeamKey: 'norte',
      awayTeamKey: 'sur',
      kickoff: '2026-10-20T19:00:00-06:00',
      status: 'finished',
      score: { home: 3, away: 1 },
      ref: 'fixture:inline/demo-a.json#p1',
    },
    {
      matchKey: 'p2',
      homeTeamKey: 'este',
      awayTeamKey: 'oeste',
      kickoff: '2026-10-20T21:00:00Z',
      status: 'finished',
      score: { home: 0, away: 0 },
      ref: 'fixture:inline/demo-a.json#p2',
    },
    {
      matchKey: 'p3',
      homeTeamKey: 'sur',
      awayTeamKey: 'este',
      kickoff: '2026-10-21T18:00:00Z',
      status: 'postponed',
      score: null,
      ref: 'fixture:inline/demo-a.json#p3',
    },
  ],
  standings: {
    available: true,
    asOf: '2026-10-21T00:00:00Z',
    ref: 'fixture:inline/demo-a.json#table',
    rows: [
      {
        position: 1,
        teamKey: 'norte',
        played: 3,
        won: 3,
        drawn: 0,
        lost: 0,
        goalsFor: 8,
        goalsAgainst: 2,
        goalDifference: 6,
        points: 9,
        ref: 'fixture:inline/demo-a.json#row-1',
      },
      {
        position: 2,
        teamKey: 'este',
        played: 3,
        won: 1,
        drawn: 1,
        lost: 1,
        goalsFor: 3,
        goalsAgainst: 3,
        goalDifference: 0,
        points: 4,
        ref: 'fixture:inline/demo-a.json#row-2',
      },
      {
        position: 3,
        teamKey: 'oeste',
        played: 3,
        won: 0,
        drawn: 2,
        lost: 1,
        goalsFor: 2,
        goalsAgainst: 4,
        goalDifference: -2,
        points: 2,
        ref: 'fixture:inline/demo-a.json#row-3',
      },
      {
        position: 4,
        teamKey: 'sur',
        played: 3,
        won: 0,
        drawn: 1,
        lost: 2,
        goalsFor: 1,
        goalsAgainst: 5,
        goalDifference: -4,
        points: 1,
        ref: 'fixture:inline/demo-a.json#row-4',
      },
    ],
  },
  context: [
    { type: 'matchday_of_total', matchday: 3, totalMatchdays: 10, ref: 'fixture:inline/demo-a.json#context-1' },
    { type: 'teams_in_table', count: 4, ref: 'fixture:inline/demo-a.json#context-2' },
  ],
} as const;

/** A knockout round selected as a whole: no matchday, no standings. */
const KNOCKOUT_ROUND = {
  sourceId: 'live-a',
  mode: 'LIVE_DATA',
  retrievedAt: '2026-10-22T08:00:00+02:00',
  fromCache: true,
  sourceRef: 'source:live-a/matches@2026-10-22T06:00:00.000Z',
  importVersionId: null,
  competition: { name: 'Copa Inventada' },
  season: { label: '2026/27' },
  stage: { name: 'Cuartos de Final', matchday: null, totalMatchdays: null },
  teams: [
    { teamKey: 't1', name: 'Club Uno', aliases: [], ref: 'source:live-a/matches@2026-10-22T06:00:00.000Z' },
    { teamKey: 't2', name: 'Club Dos', aliases: [], ref: 'source:live-a/matches@2026-10-22T06:00:00.000Z' },
  ],
  matches: [
    {
      matchKey: 'k1',
      homeTeamKey: 't1',
      awayTeamKey: 't2',
      kickoff: '2026-10-21T20:00:00Z',
      status: 'finished',
      score: { home: 1, away: 2 },
      ref: 'source:live-a/matches@2026-10-22T06:00:00.000Z',
    },
  ],
  standings: { available: false, reason: 'not_provided_for_stage' },
  context: [{ type: 'matches_in_selection', count: 1, ref: 'source:live-a/matches@2026-10-22T06:00:00.000Z' }],
} as const;

/** A MANUAL_DATA selection: one imported match and the import version it comes from. */
const MANUAL_SELECTION = {
  sourceId: 'manual-a',
  mode: 'MANUAL_DATA',
  retrievedAt: '2026-10-23T09:30:00.000Z',
  fromCache: false,
  sourceRef: `import:${IMPORT_VERSION_ID}/v2`,
  importVersionId: IMPORT_VERSION_ID,
  competition: { name: 'Liga Manual Inventada' },
  season: { label: '2026' },
  stage: { name: 'Apertura', matchday: 5, totalMatchdays: null },
  teams: [
    { teamKey: 'club-a', name: 'Club A', aliases: [], ref: `import:${IMPORT_VERSION_ID}/v2` },
    { teamKey: 'club-b', name: 'Club B', aliases: [], ref: `import:${IMPORT_VERSION_ID}/v2` },
  ],
  matches: [
    {
      matchKey: 'club-a-club-b',
      homeTeamKey: 'club-a',
      awayTeamKey: 'club-b',
      kickoff: '2026-10-19T17:00:00Z',
      status: 'finished',
      score: { home: 2, away: 2 },
      ref: `import:${IMPORT_VERSION_ID}/v2`,
    },
  ],
  standings: {
    available: true,
    asOf: '2026-10-20T00:00:00Z',
    ref: `import:${IMPORT_VERSION_ID}/v2`,
    rows: [
      {
        position: 1,
        teamKey: 'club-a',
        played: 1,
        won: 0,
        drawn: 1,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 2,
        goalDifference: 0,
        points: 1,
        ref: `import:${IMPORT_VERSION_ID}/v2`,
      },
      {
        position: 2,
        teamKey: 'club-b',
        played: 1,
        won: 0,
        drawn: 1,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 2,
        goalDifference: 0,
        points: 1,
        ref: `import:${IMPORT_VERSION_ID}/v2`,
      },
    ],
  },
  context: [],
} as const;

function snapshot(value: unknown): SelectionSnapshot {
  return SelectionSnapshotSchema.parse(value);
}

function byKey(output: RetrievedResearch): Map<string, ResearchObservation> {
  return new Map(output.observations.map((observation) => [observation.factKey, observation]));
}

function valueOf(output: RetrievedResearch, factKey: string): unknown {
  return byKey(output).get(factKey)?.value;
}

describe('researchSnapshot: a known matchday (R-202)', () => {
  const output = researchSnapshot(snapshot(MATCHDAY));

  it('passes its own output schema', () => {
    expect(ResearchOutputSchema.parse(output)).toEqual(output);
  });

  it('records every match with both teams, its kickoff as given and its status', () => {
    for (const match of MATCHDAY.matches) {
      expect(valueOf(output, `match:${match.matchKey}:teams`)).toEqual({
        kind: 'match_teams',
        matchKey: match.matchKey,
        homeTeamKey: match.homeTeamKey,
        awayTeamKey: match.awayTeamKey,
      });
      expect(valueOf(output, `match:${match.matchKey}:kickoff`)).toEqual({
        kind: 'match_kickoff',
        matchKey: match.matchKey,
        kickoff: match.kickoff,
      });
      expect(valueOf(output, `match:${match.matchKey}:status`)).toEqual({
        kind: 'match_status',
        matchKey: match.matchKey,
        matchStatus: match.status,
      });
    }
  });

  it('records the score of each finished match and none for an unfinished one (OD-05, R-069)', () => {
    expect(valueOf(output, 'match:p1:score')).toEqual({ kind: 'match_score', matchKey: 'p1', home: 3, away: 1 });
    expect(valueOf(output, 'match:p2:score')).toEqual({ kind: 'match_score', matchKey: 'p2', home: 0, away: 0 });
    expect(byKey(output).has('match:p3:score')).toBe(false);
  });

  it('records the full standings, row by row, with the fixture values', () => {
    const rows = output.observations.filter((observation) => observation.value.kind === 'standing_row');
    expect(rows.map((row) => row.value)).toEqual(
      MATCHDAY.standings.rows.map(({ ref: _ref, ...row }) => ({ kind: 'standing_row', ...row })),
    );
    expect(rows.map((row) => row.sourceRef)).toEqual(MATCHDAY.standings.rows.map((row) => row.ref));
    expect(output.standings).toEqual({ available: true, reason: null });
  });

  it('records every competition-context item and the matchday information', () => {
    expect(valueOf(output, 'context:matchday_of_total:0')).toEqual({
      kind: 'context_item',
      index: 0,
      item: { type: 'matchday_of_total', matchday: 3, totalMatchdays: 10 },
    });
    expect(valueOf(output, 'context:teams_in_table:1')).toEqual({
      kind: 'context_item',
      index: 1,
      item: { type: 'teams_in_table', count: 4 },
    });
    expect(valueOf(output, 'matchday:info')).toEqual({
      kind: 'matchday_info',
      stageLabel: 'Fase Regular',
      matchdayNumber: 3,
      totalMatchdays: 10,
    });
  });

  it('records every team with the name and aliases the source gives', () => {
    for (const team of MATCHDAY.teams) {
      expect(valueOf(output, `team:${team.teamKey}:name`)).toEqual({
        kind: 'team',
        teamKey: team.teamKey,
        name: team.name,
        aliases: [...team.aliases],
      });
      expect(byKey(output).get(`team:${team.teamKey}:name`)?.sourceRef).toBe(team.ref);
    }
  });

  it('counts one observation per team, match fact, standings row and context item, plus the matchday', () => {
    // 1 matchday + 4 teams + 3 matches x 3 + 2 scores + 4 rows + 2 context items.
    expect(output.observations).toHaveLength(1 + 4 + 9 + 2 + 4 + 2);
  });

  it('attributes every observation to the source, mode, reference and retrieval time (R-024, R-204, R-287)', () => {
    for (const observation of output.observations) {
      expect(observation).toMatchObject({
        sourceId: 'demo-a',
        dataMode: 'DEMO_DATA',
        importVersionId: null,
        retrievedAt: '2026-10-21T10:15:00.000Z',
      });
      expect(observation.sourceRef.length).toBeGreaterThan(0);
    }
    expect(byKey(output).get('match:p1:teams')?.sourceRef).toBe('fixture:inline/demo-a.json#p1');
    expect(byKey(output).get('matchday:info')?.sourceRef).toBe('fixture:inline/demo-a.json');
  });

  it('records one successful selection retrieval with its source, mode, time and cache use (AD-34)', () => {
    expect(output.retrieval).toEqual({
      sourceId: 'demo-a',
      dataMode: 'DEMO_DATA',
      resource: 'selection',
      retrievedAt: '2026-10-21T10:15:00.000Z',
      fromCache: false,
      outcome: 'ok',
      failure: null,
      importVersionId: null,
    });
  });

  it('is deterministic', () => {
    expect(researchSnapshot(snapshot(MATCHDAY))).toEqual(output);
  });
});

describe('researchSnapshot: a selection without standings (R-254)', () => {
  const output = researchSnapshot(snapshot(KNOCKOUT_ROUND));

  it('records the unavailability with the source reason and invents no standings row', () => {
    expect(output.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(output.observations.some((observation) => observation.value.kind === 'standing_row')).toBe(false);
    expect(output.observations.some((observation) => observation.factKey.startsWith('standings:'))).toBe(false);
  });

  it('still records the matches, teams and context, and a null matchday for a whole stage', () => {
    expect(valueOf(output, 'match:k1:score')).toEqual({ kind: 'match_score', matchKey: 'k1', home: 1, away: 2 });
    expect(valueOf(output, 'matchday:info')).toEqual({
      kind: 'matchday_info',
      stageLabel: 'Cuartos de Final',
      matchdayNumber: null,
      totalMatchdays: null,
    });
    expect(valueOf(output, 'context:matches_in_selection:0')).toEqual({
      kind: 'context_item',
      index: 0,
      item: { type: 'matches_in_selection', count: 1 },
    });
    expect(output.observations).toHaveLength(1 + 2 + 4 + 1);
  });

  it('stores the retrieval time in UTC (the same instant) and the cache use', () => {
    expect(output.retrieval.retrievedAt).toBe('2026-10-22T06:00:00.000Z');
    expect(output.retrieval.fromCache).toBe(true);
    expect(output.observations.every((observation) => observation.retrievedAt === '2026-10-22T06:00:00.000Z')).toBe(
      true,
    );
  });

  it('records each standings unavailability reason as the source gives it', () => {
    for (const reason of ['not_provided_by_source', 'not_available_with_subscription'] as const) {
      const result = researchSnapshot(snapshot({ ...KNOCKOUT_ROUND, standings: { available: false, reason } }));
      expect(result.standings).toEqual({ available: false, reason });
    }
  });
});

describe('researchSnapshot: a MANUAL_DATA selection with an import version (R-067, R-287)', () => {
  const output = researchSnapshot(snapshot(MANUAL_SELECTION));

  it('carries the import version on the retrieval and on every observation', () => {
    expect(output.retrieval).toMatchObject({
      sourceId: 'manual-a',
      dataMode: 'MANUAL_DATA',
      importVersionId: IMPORT_VERSION_ID,
      outcome: 'ok',
    });
    expect(output.observations.length).toBeGreaterThan(0);
    for (const observation of output.observations) {
      expect(observation).toMatchObject({
        sourceId: 'manual-a',
        dataMode: 'MANUAL_DATA',
        importVersionId: IMPORT_VERSION_ID,
        sourceRef: `import:${IMPORT_VERSION_ID}/v2`,
      });
    }
    expect(ResearchOutputSchema.parse(output)).toEqual(output);
  });

  it('keeps the imported values unchanged', () => {
    expect(valueOf(output, 'match:club-a-club-b:score')).toEqual({
      kind: 'match_score',
      matchKey: 'club-a-club-b',
      home: 2,
      away: 2,
    });
    expect(valueOf(output, 'matchday:info')).toEqual({
      kind: 'matchday_info',
      stageLabel: 'Apertura',
      matchdayNumber: 5,
      totalMatchdays: null,
    });
    expect(output.standings).toEqual({ available: true, reason: null });
  });
});

describe('researchSnapshot: stripped and untrusted input (R-232, T11H-F07)', () => {
  it('never stores a field outside the observation schemas, even when the snapshot object carries one', () => {
    // Simulates fields that escaped stripping: the core copies named fields only.
    const tainted = snapshot(MATCHDAY) as unknown as Record<string, unknown>;
    const withExtras = {
      ...tainted,
      referee: 'Person Marker',
      teams: (tainted['teams'] as Record<string, unknown>[]).map((team) => ({ ...team, coach: 'Person Marker' })),
      matches: (tainted['matches'] as Record<string, unknown>[]).map((match) => ({
        ...match,
        scorers: ['Person Marker'],
      })),
    } as unknown as SelectionSnapshot;
    const output = researchSnapshot(withExtras);
    const text = JSON.stringify(output);
    expect(text).not.toContain('Person Marker');
    expect(text).not.toMatch(/referee|coach|scorers/);
    expect(ResearchOutputSchema.parse(output)).toEqual(output);
  });

  it('keeps hostile-looking source keys as plain values and keys', () => {
    const keys = ['__proto__', 'constructor', 'prototype', 'toString'] as const;
    const value = snapshot({
      ...KNOCKOUT_ROUND,
      teams: keys.map((teamKey) => ({ teamKey, name: 'Club Raro', aliases: [], ref: 'source:live-a/teams@x' })),
      matches: [
        { ...KNOCKOUT_ROUND.matches[0], matchKey: '__proto__', homeTeamKey: keys[0], awayTeamKey: keys[1] },
        { ...KNOCKOUT_ROUND.matches[0], matchKey: 'toString', homeTeamKey: keys[2], awayTeamKey: keys[3] },
      ],
    });
    const output = researchSnapshot(value);
    expect(valueOf(output, 'match:__proto__:teams')).toEqual({
      kind: 'match_teams',
      matchKey: '__proto__',
      homeTeamKey: '__proto__',
      awayTeamKey: 'constructor',
    });
    expect(valueOf(output, 'team:constructor:name')).toMatchObject({ teamKey: 'constructor' });
    expect(ResearchOutputSchema.parse(output)).toEqual(output);
  });

  it('builds distinct keys for source keys that contain the separator', () => {
    expect(researchFactKey.matchTeams('a:teams')).not.toBe(researchFactKey.matchTeams('a'));
    const longest = researchFactKey.matchKickoff('k'.repeat(128));
    expect(longest.length).toBeLessThanOrEqual(MAX_FACT_KEY_LENGTH);
  });
});

describe('ResearchOutputSchema: attribution and structure (R-204, R-224)', () => {
  const output = researchSnapshot(snapshot(MATCHDAY));
  const first = output.observations[0] as ResearchObservation;

  function withObservation(observation: unknown): unknown {
    return { ...output, observations: [observation, ...output.observations.slice(1)] };
  }

  it('refuses an observation without a source reference, source or retrieval time', () => {
    const { sourceRef: _ref, ...noRef } = first;
    const { sourceId: _source, ...noSource } = first;
    const { retrievedAt: _time, ...noTime } = first;
    for (const observation of [noRef, noSource, noTime, { ...first, sourceRef: '' }]) {
      expect(ResearchOutputSchema.safeParse(withObservation(observation)).success).toBe(false);
    }
  });

  it('refuses a URL as an attribution reference (T11H-F14)', () => {
    const observation = { ...first, sourceRef: 'source:https://provider.example.test/matches' };
    expect(ResearchOutputSchema.safeParse(withObservation(observation)).success).toBe(false);
  });

  it('refuses an observation attributed to another source, mode, import version or time than its retrieval', () => {
    for (const change of [
      { sourceId: 'demo-b' },
      { dataMode: 'LIVE_DATA' },
      { importVersionId: IMPORT_VERSION_ID },
      { retrievedAt: '2026-10-21T10:16:00.000Z' },
    ]) {
      expect(ResearchOutputSchema.safeParse(withObservation({ ...first, ...change })).success).toBe(false);
    }
  });

  it('refuses an unknown field in an observation value, a person field included', () => {
    const observation = { ...first, value: { ...first.value, scorer: 'Person Marker' } };
    expect(ResearchOutputSchema.safeParse(withObservation(observation)).success).toBe(false);
    expect(ResearchOutputSchema.safeParse({ ...output, extra: 1 }).success).toBe(false);
  });

  it('refuses duplicate observation keys and a successful output with a failed retrieval', () => {
    expect(ResearchOutputSchema.safeParse({ ...output, observations: [first, first] }).success).toBe(false);
    const failed = {
      ...output,
      retrieval: {
        ...output.retrieval,
        outcome: 'failed',
        failure: { code: 'unavailable', sourceId: 'demo-a', path: null, httpStatus: null },
      },
    };
    expect(ResearchOutputSchema.safeParse(failed).success).toBe(false);
  });

  it('refuses a value that violates its schema (negative goals, unknown status, empty team name)', () => {
    const score = output.observations.find((observation) => observation.value.kind === 'match_score');
    const status = output.observations.find((observation) => observation.value.kind === 'match_status');
    const team = output.observations.find((observation) => observation.value.kind === 'team');
    for (const bad of [
      { ...score, value: { ...score?.value, home: -1 } },
      { ...status, value: { ...status?.value, matchStatus: 'abandonado' } },
      { ...team, value: { ...team?.value, name: '' } },
    ]) {
      expect(ResearchOutputSchema.safeParse(withObservation(bad)).success).toBe(false);
    }
  });
});

describe('refusedResearch: provider failures keep their closed code (T10-F10)', () => {
  const codes = [
    'access_refused',
    'not_available',
    'rate_limited',
    'unavailable',
    'timeout',
    'invalid',
    'no_data',
    'bad_request',
  ] as const;

  it.each(codes)('maps %s to a failed retrieval and a stage failure with the same code', (code) => {
    const failure = { code, sourceId: 'live-a', path: code === 'invalid' ? '/matches/0/score' : null, httpStatus: 403 };
    const output = refusedResearch({
      sourceId: 'live-a',
      dataMode: 'LIVE_DATA',
      attemptedAt: '2026-10-22T06:00:00.000Z',
      failure,
    });
    expect(output).toEqual({
      status: 'refused',
      retrieval: {
        sourceId: 'live-a',
        dataMode: 'LIVE_DATA',
        resource: 'selection',
        retrievedAt: '2026-10-22T06:00:00.000Z',
        fromCache: false,
        outcome: code === 'not_available' ? 'not_available' : 'failed',
        failure,
        importVersionId: null,
      },
      failure,
    });
    expect(retrievalOutcomeOf(code)).toBe(output.retrieval.outcome);
    expect(ResearchOutputSchema.parse(output)).toEqual(output);
  });

  it('refuses a refused output whose stage failure differs from the retrieval failure', () => {
    const output = refusedResearch({
      sourceId: 'live-a',
      dataMode: 'LIVE_DATA',
      attemptedAt: '2026-10-22T06:00:00.000Z',
      failure: { code: 'timeout', sourceId: 'live-a', path: null, httpStatus: null },
    });
    const mismatch = { ...output, failure: { ...output.failure, code: 'unavailable' } };
    expect(ResearchOutputSchema.safeParse(mismatch).success).toBe(false);
    const ok = { ...output, retrieval: { ...output.retrieval, outcome: 'ok' } };
    expect(ResearchOutputSchema.safeParse(ok).success).toBe(false);
  });
});
