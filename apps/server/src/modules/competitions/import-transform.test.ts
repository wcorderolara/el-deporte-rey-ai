import type { ImportApplyDecision, ImportPreview, ImportPreviewItem } from '@edr/contracts';
import { describe, expect, it } from 'vitest';
import {
  mappingScope,
  normalizeKickoff,
  parseScore,
  transformSnapshot,
  type ImportLocalState,
  type LocalLabel,
  type LocalMatch,
  type LocalRound,
  type MappedResource,
  type Mapping,
} from './import-transform.js';

const COMPETITION = '00000000-0000-4000-8000-000000000001';
const SEASON_SCOPE = 'ext-comp:2026';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** In-memory local state; every collection starts empty. */
class FakeState implements ImportLocalState {
  mappings = new Map<string, Mapping>();
  seasons: LocalLabel[] = [];
  teams: (LocalLabel & { key: string })[] = [];
  competitionTeams = new Set<string>();
  participants = new Set<string>();
  stages: (LocalLabel & { seasonId: string })[] = [];
  rounds: (LocalRound & { seasonId: string })[] = [];
  matches: (LocalMatch & { seasonId: string })[] = [];
  map(
    resource: MappedResource,
    externalScope: string | null,
    externalId: string,
    localId: string,
    baseline: Mapping['baseline'] = null,
  ) {
    this.mappings.set(`${resource}|${mappingScope(COMPETITION, resource, externalScope)}|${externalId}`, {
      localId,
      baseline,
    });
  }
  mapping(resource: MappedResource, scopeKey: string, externalId: string) {
    return this.mappings.get(`${resource}|${scopeKey}|${externalId}`);
  }
  isMapped(resource: MappedResource, localId: string) {
    return [...this.mappings.entries()].some(
      ([key, value]) => key.startsWith(`${resource}|`) && value.localId === localId,
    );
  }
  elsewhere = new Map<string, LocalLabel[]>();
  teamsByIdentity(externalId: string) {
    return this.elsewhere.get(externalId) ?? [];
  }
  season(seasonId: string) {
    return this.seasons.find((season) => season.id === seasonId);
  }
  seasonsByLabel(label: string) {
    return this.seasons.filter((season) => season.label.toLowerCase() === label);
  }
  team(teamId: string) {
    return this.teams.find((team) => team.id === teamId);
  }
  teamsByName(name: string) {
    return this.teams.filter((team) => team.key === name);
  }
  isCompetitionTeam(teamId: string) {
    return this.competitionTeams.has(teamId);
  }
  isParticipant(seasonId: string, teamId: string) {
    return this.participants.has(`${seasonId}:${teamId}`);
  }
  stage(seasonId: string, stageId: string) {
    return this.stages.find((stage) => stage.id === stageId && stage.seasonId === seasonId);
  }
  stagesByName(seasonId: string, name: string) {
    return this.stages.filter((stage) => stage.seasonId === seasonId && stage.label.toLowerCase() === name);
  }
  round(seasonId: string, roundId: string) {
    return this.rounds.find((round) => round.id === roundId && round.seasonId === seasonId);
  }
  roundsByName(seasonId: string, stageId: string | null, name: string) {
    return this.rounds.filter(
      (round) => round.seasonId === seasonId && round.stageId === stageId && round.label.toLowerCase() === name,
    );
  }
  match(seasonId: string, matchId: string) {
    return this.matches.find((match) => match.id === matchId && match.seasonId === seasonId);
  }
  matchesBetween(seasonId: string, home: string, away: string) {
    return this.matches.filter(
      (match) => match.seasonId === seasonId && match.homeTeamId === home && match.awayTeamId === away,
    );
  }
}

function item(
  resource: ImportPreviewItem['resource'],
  externalId: string,
  title: string,
  extra: Partial<ImportPreviewItem> = {},
): ImportPreviewItem {
  return {
    resource,
    externalId,
    externalScope: resource === 'teams' ? null : SEASON_SCOPE,
    title,
    operation: 'new',
    localCandidate: null,
    relationships: [],
    fields: [],
    warnings: [],
    ...extra,
  };
}
const field = (name: string, incomingValue: string | null) => ({
  name,
  localValue: null,
  incomingValue,
  baselineValue: null,
  protected: false,
});
const ref = (
  role: ImportPreviewItem['relationships'][number]['role'],
  externalId: string,
  externalScope: string | null = SEASON_SCOPE,
) => ({
  role,
  externalId,
  externalScope,
});
const seasonItem = item('season', '2026', '2026/27', {
  externalScope: 'ext-comp',
  fields: [field('label', '2026/27')],
});
const team = (key: string, name: string) => item('teams', key, name, { fields: [field('name', name)] });
const stageItem = item('stages', 'regular', 'REGULAR SEASON', {
  fields: [field('name', 'REGULAR_SEASON')],
  relationships: [ref('season', '2026', 'ext-comp')],
});
const roundItem = (number: number) =>
  item('rounds', `regular:${number}`, `Jornada ${number}`, {
    relationships: [ref('season', '2026', 'ext-comp'), ref('stage', 'regular')],
  });
const matchItem = (
  key: string,
  home: string,
  away: string,
  status = 'scheduled',
  kickoff: string | null = '2026-10-20T18:00:00Z',
  round = 1,
) =>
  item('matches', key, `${home} vs ${away}`, {
    fields: [field('fecha', kickoff), field('estado', status)],
    relationships: [
      ref('home_team', home, 'ext-comp'),
      ref('away_team', away, 'ext-comp'),
      ref('stage', 'regular'),
      ref('round', `regular:${round}`),
    ],
  });
const resultItem = (key: string, score: string) =>
  item('results', `${key}:result`, `Resultado ${key}`, {
    fields: [field('score', score)],
    relationships: [ref('match', key)],
  });

function snapshot(items: ImportPreviewItem[], extra: Partial<ImportPreview> = {}): ImportPreview {
  return {
    previewId: id(90),
    competitionId: COMPETITION,
    providerKey: 'test-live',
    providerName: 'Proveedor',
    externalCompetitionName: 'Liga externa',
    externalSeasonId: '2026',
    externalSeasonLabel: '2026/27',
    destinationSeasonId: null,
    retrievedAt: '2026-10-27T12:00:00.000Z',
    expiresAt: '2026-10-27T12:30:00.000Z',
    snapshotHash: 'a'.repeat(64),
    localFingerprint: 'b'.repeat(64),
    stale: false,
    resources: ['season', 'teams', 'stages', 'rounds', 'matches', 'results'],
    summary: { new: items.length, changed: 0, unchanged: 0, conflicts: 0, invalid: 0, skipped: 0 },
    capabilities: [],
    warnings: [],
    items,
    ...extra,
  };
}
const fullSeason = () => [
  seasonItem,
  team('alfa', 'Club Alfa'),
  team('beta', 'Club Beta'),
  stageItem,
  roundItem(2),
  roundItem(1),
  matchItem('m1', 'alfa', 'beta', 'finished'),
  resultItem('m1', '0-0'),
  matchItem('m2', 'beta', 'alfa', 'scheduled', '2026-10-27T18:00:00Z', 2),
];
const run = (
  state: FakeState,
  items: ImportPreviewItem[],
  decisions: ImportApplyDecision[] = [],
  extra: Partial<ImportPreview> = {},
) => transformSnapshot({ competitionId: COMPETITION, snapshot: snapshot(items, extra), decisions, state });

/** A local season already imported once: its mappings and local rows exist. */
function importedState() {
  const state = new FakeState();
  state.seasons.push({ id: id(1), label: '2026/27' });
  state.map('season', 'ext-comp', '2026', id(1));
  for (const [n, key, name] of [
    [2, 'alfa', 'Club Alfa'],
    [3, 'beta', 'Club Beta'],
  ] as const) {
    state.teams.push({ id: id(n), label: name, key: name.toLowerCase() });
    state.competitionTeams.add(id(n));
    state.participants.add(`${id(1)}:${id(n)}`);
    state.map('teams', null, key, id(n));
  }
  state.stages.push({ id: id(4), label: 'REGULAR SEASON', seasonId: id(1) });
  state.map('stages', SEASON_SCOPE, 'regular', id(4));
  for (const n of [1, 2]) {
    state.rounds.push({ id: id(4 + n), label: `Jornada ${n}`, stageId: id(4), seasonId: id(1) });
    state.map('rounds', SEASON_SCOPE, `regular:${n}`, id(4 + n));
  }
  return state;
}
function localMatch(overrides: Partial<LocalMatch> = {}): LocalMatch & { seasonId: string } {
  return {
    id: id(8),
    seasonId: id(1),
    homeTeamId: id(2),
    awayTeamId: id(3),
    stageId: id(4),
    roundId: id(5),
    kickoffAt: '2026-10-20T18:00:00.000Z',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    label: 'Club Alfa vs Club Beta',
    ...overrides,
  };
}

describe('provider-neutral import transformation', () => {
  it('creates new identities in dependency order and preserves the provider numbering', () => {
    const plan = run(new FakeState(), fullSeason());
    expect(plan.ready).toBe(true);
    expect(plan.destinationIsNew).toBe(true);
    const kinds = plan.steps.filter((step) => step.kind !== 'mapping.put').map((step) => step.kind);
    expect(kinds).toEqual([
      'season.create',
      'team.create',
      'competitionTeam.add',
      'team.create',
      'competitionTeam.add',
      'stage.create',
      'round.create',
      'round.create',
      'participant.add',
      'participant.add',
      'match.create',
      'match.create',
    ]);
    const rounds = plan.steps.filter((step) => step.kind === 'round.create').map((step) => step.name);
    expect(rounds).toEqual(['Jornada 1', 'Jornada 2']);
    expect(plan.counts).toMatchObject({
      seasonsCreated: 1,
      teamsCreated: 2,
      stagesCreated: 1,
      roundsCreated: 2,
      matchesCreated: 2,
      resultsApplied: 1,
    });
    // The opaque provider stage label is preserved in its mapping.
    expect(plan.steps.find((step) => step.kind === 'mapping.put' && step.resource === 'stages')).toMatchObject({
      externalLabel: 'REGULAR_SEASON',
    });
  });

  it('keeps an explicit 0-0 distinct from an unknown score', () => {
    const plan = run(new FakeState(), fullSeason());
    const creates = plan.steps.filter((step) => step.kind === 'match.create');
    expect(creates.map((step) => step.score)).toEqual([{ home: 0, away: 0 }, null]);
    expect(parseScore('0-0')).toEqual({ home: 0, away: 0 });
    expect(parseScore(null)).toBeUndefined();
    expect(parseScore('2:1')).toBeUndefined();
    expect(normalizeKickoff('2026-10-20T18:00:00Z')).toBe('2026-10-20T18:00:00.000Z');
    expect(normalizeKickoff(null)).toBeNull();
    expect(normalizeKickoff('mañana')).toBeUndefined();
  });

  it('reuses persisted mappings instead of creating duplicates and resolves references outside the snapshot', () => {
    const state = importedState();
    const plan = run(state, [seasonItem, stageItem, roundItem(1), matchItem('m1', 'alfa', 'beta')]);
    expect(plan.ready).toBe(true);
    expect(plan.season).toEqual({ id: id(1) });
    expect(plan.steps.map((step) => step.kind)).not.toContain('team.create');
    expect(plan.steps.map((step) => step.kind)).not.toContain('participant.add');
    expect(plan.steps.find((step) => step.kind === 'match.create')).toMatchObject({
      home: { id: id(2) },
      away: { id: id(3) },
      stage: { id: id(4) },
      round: { id: id(5) },
    });
  });

  it('turns a name match into candidates that need an explicit decision', () => {
    const state = new FakeState();
    state.teams.push({ id: id(20), label: 'Club Alfa', key: 'club alfa' });
    const blocked = run(state, fullSeason());
    expect(blocked.ready).toBe(false);
    expect(blocked.items.find((entry) => entry.externalId === 'alfa')).toMatchObject({
      action: 'blocked',
      options: ['link', 'skip'],
      candidates: [{ id: id(20), label: 'Club Alfa' }],
    });
    expect(blocked.items.find((entry) => entry.externalId === 'm1')).toMatchObject({
      action: 'blocked',
      options: ['skip'],
    });
    const link = {
      resource: 'teams',
      externalId: 'alfa',
      externalScope: null,
      action: 'link',
      localId: id(20),
    } as const;
    const linked = run(state, fullSeason(), [link]);
    expect(linked.ready).toBe(true);
    expect(
      linked.steps.find(
        (step) => step.kind === 'mapping.put' && step.resource === 'teams' && step.externalId === 'alfa',
      ),
    ).toMatchObject({
      local: { id: id(20) },
      origin: 'linked',
    });
    // Only an offered candidate can be linked.
    const wrong = run(state, fullSeason(), [{ ...link, localId: id(99) }]);
    expect(wrong.ready).toBe(false);
    expect(wrong.blockers.map((blocker) => blocker.code)).toContain('DECISION_NOT_APPLICABLE');
    expect(wrong.planHash).not.toBe(linked.planHash);
  });

  it('never links a local team that already carries another identity of the provider', () => {
    const state = new FakeState();
    state.teams.push({ id: id(20), label: 'Club Alfa', key: 'club alfa' });
    state.map('teams', null, 'other-alfa', id(20));
    const plan = run(state, [seasonItem, team('alfa', 'Club Alfa')]);
    expect(plan.items.find((entry) => entry.externalId === 'alfa')).toMatchObject({
      action: 'blocked',
      candidates: [],
      options: ['skip'],
    });
  });

  it('offers a team mapped in another competition as evidence, never as an automatic link', () => {
    const state = new FakeState();
    state.teams.push({ id: id(21), label: 'Arsenal FC', key: 'arsenal fc' });
    state.elsewhere.set('alfa', [{ id: id(21), label: 'Arsenal FC' }]);
    const plan = run(state, [seasonItem, team('alfa', 'Arsenal')]);
    expect(plan.items.find((entry) => entry.externalId === 'alfa')).toMatchObject({
      action: 'blocked',
      options: ['link', 'skip'],
      candidates: [{ id: id(21), label: 'Arsenal FC' }],
    });
    expect(plan.steps.some((step) => step.kind === 'team.create')).toBe(false);
  });

  it('updates values equal to the imported baseline and keeps manual values unless accepted', () => {
    const state = importedState();
    state.matches.push(localMatch({ status: 'postponed', homeScore: 1, awayScore: 0 }));
    state.map('matches', SEASON_SCOPE, 'm1', id(8), {
      kickoffAt: '2026-10-20T18:00:00.000Z',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    });
    const items = [
      seasonItem,
      matchItem('m1', 'alfa', 'beta', 'finished', '2026-10-21T18:00:00Z'),
      resultItem('m1', '2-1'),
    ];
    const kept = run(state, items);
    expect(kept.ready).toBe(true);
    const match = kept.items.find((entry) => entry.resource === 'matches')!;
    // The kickoff still equals its baseline (safe); the status was edited locally (protected).
    expect(match.changes).toEqual([
      {
        field: 'kickoffAt',
        localValue: '2026-10-20T18:00:00.000Z',
        incomingValue: '2026-10-21T18:00:00.000Z',
        applied: true,
      },
      { field: 'status', localValue: 'postponed', incomingValue: 'finished', applied: false },
    ]);
    expect(kept.items.find((entry) => entry.resource === 'results')).toMatchObject({
      action: 'keep_local',
      options: ['accept_incoming'],
    });
    expect(kept.steps.find((step) => step.kind === 'match.update')).toEqual({
      kind: 'match.update',
      matchId: id(8),
      change: { kickoffAt: '2026-10-21T18:00:00.000Z' },
    });
    expect(kept.counts.conflictsNotApplied).toBe(2);
    const accept = (resource: 'matches' | 'results', externalId: string): ImportApplyDecision => ({
      resource,
      externalId,
      externalScope: SEASON_SCOPE,
      action: 'accept_incoming',
      localId: null,
    });
    const accepted = run(state, items, [accept('matches', 'm1'), accept('results', 'm1:result')]);
    expect(accepted.steps.find((step) => step.kind === 'match.update')).toEqual({
      kind: 'match.update',
      matchId: id(8),
      change: { kickoffAt: '2026-10-21T18:00:00.000Z', status: 'finished', score: { home: 2, away: 1 } },
    });
    expect(accepted.decisions).toHaveLength(2);
  });

  it('fills an unknown local score but never overwrites a recorded one without a baseline', () => {
    const state = importedState();
    state.matches.push(localMatch({ status: 'finished' }));
    state.map('matches', SEASON_SCOPE, 'm1', id(8), { status: 'finished', homeScore: null, awayScore: null });
    const filled = run(state, [seasonItem, resultItem('m1', '0-0')]);
    expect(filled.steps.find((step) => step.kind === 'match.update')).toMatchObject({
      change: { score: { home: 0, away: 0 } },
    });

    const linked = importedState();
    linked.mappings.delete(`matches|${mappingScope(COMPETITION, 'matches', SEASON_SCOPE)}|m1`);
    linked.matches.push(localMatch({ status: 'finished', homeScore: 3, awayScore: 3 }));
    const items = [seasonItem, matchItem('m1', 'alfa', 'beta', 'finished'), resultItem('m1', '2-1')];
    const blocked = run(linked, items);
    expect(blocked.items.find((entry) => entry.externalId === 'm1')).toMatchObject({
      action: 'blocked',
      options: ['link', 'accept_incoming', 'skip'],
      candidates: [{ id: id(8) }],
    });
    const link: ImportApplyDecision = {
      resource: 'matches',
      externalId: 'm1',
      externalScope: SEASON_SCOPE,
      action: 'link',
      localId: id(8),
    };
    const plan = run(linked, items, [link]);
    expect(plan.ready).toBe(true);
    expect(plan.items.find((entry) => entry.resource === 'results')).toMatchObject({ action: 'keep_local' });
    expect(plan.steps.some((step) => step.kind === 'match.update')).toBe(false);
  });

  it('skips invalid records, blocks incomplete sources and refuses stale snapshots', () => {
    const invalid = run(new FakeState(), [
      seasonItem,
      team('alfa', 'Club Alfa'),
      team('beta', 'Club Beta'),
      matchItem('m9', 'alfa', 'beta', 'suspended'),
    ]);
    expect(invalid.ready).toBe(true);
    expect(invalid.items.find((entry) => entry.externalId === 'm9')?.action).toBe('skip');
    expect(invalid.counts.skipped).toBe(1);
    const partial = run(new FakeState(), fullSeason(), [], {
      summary: { new: 1, changed: 0, unchanged: 0, conflicts: 0, invalid: 0, skipped: 1 },
    });
    expect(partial.blockers.map((blocker) => blocker.code)).toContain('SOURCE_INCOMPLETE');
    const stale = transformSnapshot({
      competitionId: COMPETITION,
      snapshot: snapshot(fullSeason()),
      decisions: [],
      state: new FakeState(),
      blockers: [{ code: 'PREVIEW_STALE', message: 'Obsoleta' }],
    });
    expect(stale.ready).toBe(false);
  });

  it('produces a deterministic plan hash for the same state and decisions', () => {
    expect(run(new FakeState(), fullSeason()).planHash).toBe(run(new FakeState(), fullSeason()).planHash);
    const state = new FakeState();
    state.seasons.push({ id: id(30), label: '2026/27' });
    expect(run(state, fullSeason()).planHash).not.toBe(run(new FakeState(), fullSeason()).planHash);
  });
});
