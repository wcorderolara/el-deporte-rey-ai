/**
 * Deterministic carousel structure (architecture.md section 8.1; OD-03, OD-05; R-209, R-254, R-255, R-285).
 *
 * - Included matches: `match_status` is `finished`, and `match_teams`, `match_score` and both team names have a
 *   value: the verified value, or the candidate value of an unverified or manually approved fact (single accepted
 *   source, or MANUAL_DATA). Matches with any other status (scheduled, in play, postponed, suspended, cancelled,
 *   abandoned, awarded), disputed facts or no value are left out and listed with their status; operator exclusions
 *   are left out as `excluded_by_operator`. Content that uses a candidate value is drafted like any other and is
 *   blocked for approval by the publishability overlay (R-271, R-272).
 * - Slide order: cover; one match-result slide per included match in kickoff order (ties by home team name, then by
 *   match key; names compared by code point, no locale); standings slides only when the run's standings are
 *   available and every row has a value and a team name (`standingsRowsPerSlide` rows each, every row the source
 *   gives, no fixed table size); closing slide. Without standings no standings slide exists, nothing is derived from
 *   the match results, and the draft records `standingsIncluded: false` (R-069, R-254, R-285).
 * - More slides than `maxSlidesPerCarousel`: numbered carousels, each with its own cover and closing slide; match
 *   slides are distributed in order; standings slides go to the last carousel (into further carousels only when
 *   they alone exceed one carousel). One slide per match (OD-03).
 *
 * Matches not played yet (PD-ARCH-01E-B), by the project's content kind:
 * - `calendar`: cover; round overview pages listing the fixtures (`OVERVIEW_ROWS_PER_SLIDE` each); one fixture slide
 *   per match that is not finished; closing. Finished matches are left out as `already_finished`.
 * - `upcoming`: cover; one fixture slide per `scheduled` or `postponed` match; closing. Any other status is left out
 *   as `not_upcoming` (a past kickoff never makes a match played).
 * - `preview`: cover; one match preview slide of the first upcoming match; closing.
 * A fixture needs its status, teams, both team names and a kickoff; it never shows a score. Fixtures are ordered like
 * results and split over numbered carousels the same way.
 *
 * Nothing here depends on a data mode, a provider or a competition.
 */
import type { LeftOutMatch, MatchStatus, StandingRowValue, StandingsAvailability } from '@edr/contracts';

import type { ContentFact } from './schemas.js';

type FactOf<K extends ContentFact['kind']> = Extract<ContentFact, { kind: K }>;
type ValueOf<K extends ContentFact['kind']> = NonNullable<FactOf<K>['value']>;

/** The verified value of a fact, else its candidate value, else null. */
export function usableValue<K extends ContentFact['kind']>(fact: FactOf<K> | undefined): ValueOf<K> | null {
  if (fact === undefined) {
    return null;
  }
  return (fact.value ?? fact.candidateValue ?? null) as ValueOf<K> | null;
}

/** Code-point comparison (no `Intl`, no host locale). */
function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** A team name with the fact it comes from. */
export interface TeamNameView {
  readonly teamId: string;
  readonly factId: string;
  readonly name: string;
}

/** Read access to the facts of one run, keyed by subject. */
export class FactIndex {
  readonly facts: readonly ContentFact[];
  readonly #byMatch = new Map<string, Map<ContentFact['kind'], ContentFact>>();
  readonly #teamNames = new Map<string, FactOf<'team_official_name'>>();
  readonly #standingRows: FactOf<'standing_row'>[] = [];
  readonly #byId = new Map<string, ContentFact>();

  constructor(facts: readonly ContentFact[]) {
    this.facts = facts;
    for (const fact of facts) {
      this.#byId.set(fact.id, fact);
      const matchKey = fact.subject.matchKey;
      if (matchKey !== undefined && fact.kind.startsWith('match_')) {
        const kinds = this.#byMatch.get(matchKey) ?? new Map<ContentFact['kind'], ContentFact>();
        kinds.set(fact.kind, fact);
        this.#byMatch.set(matchKey, kinds);
      } else if (fact.kind === 'team_official_name' && fact.subject.teamId !== undefined) {
        this.#teamNames.set(fact.subject.teamId, fact);
      } else if (fact.kind === 'standing_row') {
        this.#standingRows.push(fact);
      }
    }
  }

  byId(factId: string): ContentFact | undefined {
    return this.#byId.get(factId);
  }

  matchKeys(): string[] {
    return [...this.#byMatch.keys()];
  }

  matchFact<K extends 'match_teams' | 'match_kickoff' | 'match_status' | 'match_score'>(
    matchKey: string,
    kind: K,
  ): FactOf<K> | undefined {
    return this.#byMatch.get(matchKey)?.get(kind) as FactOf<K> | undefined;
  }

  /** The official name of a team (verified value or candidate value), with its fact; null when it has none. */
  teamName(teamId: string): TeamNameView | null {
    const fact = this.#teamNames.get(teamId);
    const value = usableValue<'team_official_name'>(fact);
    if (fact === undefined || value === null) {
      return null;
    }
    return { teamId, factId: fact.id, name: value.officialName };
  }

  /** Every team with a usable official name, ordered by team ID. */
  teamNames(): TeamNameView[] {
    return [...this.#teamNames.keys()]
      .sort(compareText)
      .map((teamId) => this.teamName(teamId))
      .filter((view): view is TeamNameView => view !== null);
  }

  standingRows(): readonly FactOf<'standing_row'>[] {
    return this.#standingRows;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------------------------

/** An included match with every fact its slide shows. */
export interface MatchPlan {
  /** 1-based position in the draft's match order; the placeholder prefix `m<index>`. */
  readonly index: number;
  readonly matchKey: string;
  readonly teamsFactId: string;
  readonly statusFactId: string;
  readonly scoreFactId: string;
  readonly kickoffFactId: string | null;
  readonly home: TeamNameView;
  readonly away: TeamNameView;
  readonly score: { readonly home: number; readonly away: number };
  readonly kickoff: string | null;
}

/** The content kind of a project: the results carousel, or one of the kinds of matches not played yet. */
export type ContentKind = 'results' | 'calendar' | 'upcoming' | 'preview';

/** A match not played yet with every fact its slides show (no score). */
export interface FixturePlan {
  /** 1-based position in the draft's fixture order; the placeholder prefix `m<index>`. */
  readonly index: number;
  readonly matchKey: string;
  readonly teamsFactId: string;
  readonly statusFactId: string;
  readonly kickoffFactId: string;
  readonly home: TeamNameView;
  readonly away: TeamNameView;
  readonly kickoff: string;
  readonly status: MatchStatus;
}

/** Fixtures listed per round overview slide. */
export const OVERVIEW_ROWS_PER_SLIDE = 8;

export interface StandingsRowPlan {
  readonly factId: string;
  readonly value: StandingRowValue;
  readonly team: TeamNameView;
}

export type SlidePlan =
  | { readonly type: 'cover'; readonly key: 'cover' }
  | { readonly type: 'match_result'; readonly key: string; readonly match: MatchPlan }
  | {
      readonly type: 'standings';
      readonly key: string;
      readonly page: number;
      readonly rows: readonly StandingsRowPlan[];
    }
  | { readonly type: 'closing'; readonly key: 'closing' }
  | {
      readonly type: 'round_overview';
      readonly key: string;
      readonly page: number;
      readonly fixtures: readonly FixturePlan[];
    }
  | { readonly type: 'fixture'; readonly key: string; readonly fixture: FixturePlan }
  | { readonly type: 'match_preview'; readonly key: string; readonly fixture: FixturePlan };

export interface CarouselPlan {
  readonly sequence: number;
  readonly total: number;
  /** Cover first, closing last. */
  readonly slides: readonly SlidePlan[];
}

export interface DraftPlan {
  readonly carousels: readonly CarouselPlan[];
  readonly leftOutMatches: readonly LeftOutMatch[];
  readonly standingsIncluded: boolean;
  readonly excludedMatchKeys: readonly string[];
}

export interface PlanOptions {
  /** Default `results` (every project created before PD-ARCH-01E-B). */
  readonly contentKind?: ContentKind;
  readonly standings: StandingsAvailability | null;
  readonly excludedMatchKeys: readonly string[];
  readonly maxSlidesPerCarousel: number;
  readonly standingsRowsPerSlide: number;
}

/** Slide key of a match slide (positional, so that no source key reaches the AI request). */
export function matchSlideKey(index: number): string {
  return `match-${String(index)}`;
}

/** Slide key of a standings slide. */
export function standingsSlideKey(page: number): string {
  return `standings-${String(page)}`;
}

/** Slide key of a fixture slide. */
export function fixtureSlideKey(index: number): string {
  return `fixture-${String(index)}`;
}

/** Slide key of a round overview slide. */
export function overviewSlideKey(page: number): string {
  return `overview-${String(page)}`;
}

/** Slide key of the match preview slide. */
export const PREVIEW_SLIDE_KEY = 'preview-1';

/** Slide key of the caption element. */
export const CAPTION_KEY = 'caption';

/** The included-match view of one match, or the reason it is left out. */
type MatchCandidate =
  | { readonly included: true; readonly plan: Omit<MatchPlan, 'index'> }
  | { readonly included: false; readonly leftOut: LeftOutMatch };

function matchLabel(index: FactIndex, matchKey: string): string {
  const teams = usableValue<'match_teams'>(index.matchFact(matchKey, 'match_teams'));
  if (teams === null) {
    return matchKey;
  }
  const home = index.teamName(teams.homeTeamId)?.name ?? teams.homeTeamId;
  const away = index.teamName(teams.awayTeamId)?.name ?? teams.awayTeamId;
  return `${home} - ${away}`;
}

function examineMatch(index: FactIndex, matchKey: string, excluded: ReadonlySet<string>): MatchCandidate {
  const statusFact = index.matchFact(matchKey, 'match_status');
  const status: MatchStatus | null = usableValue<'match_status'>(statusFact)?.matchStatus ?? null;
  const leftOut = (reason: LeftOutMatch['reason']): MatchCandidate => ({
    included: false,
    leftOut: { matchKey, label: matchLabel(index, matchKey), status, reason },
  });
  if (status !== 'finished' || statusFact === undefined) {
    return status === null ? leftOut('not_verified') : leftOut('not_finished');
  }
  const teamsFact = index.matchFact(matchKey, 'match_teams');
  const scoreFact = index.matchFact(matchKey, 'match_score');
  const teams = usableValue<'match_teams'>(teamsFact);
  const score = usableValue<'match_score'>(scoreFact);
  const home = teams === null ? null : index.teamName(teams.homeTeamId);
  const away = teams === null ? null : index.teamName(teams.awayTeamId);
  if (teamsFact === undefined || scoreFact === undefined || score === null || home === null || away === null) {
    return leftOut('not_verified');
  }
  if (excluded.has(matchKey)) {
    return leftOut('excluded_by_operator');
  }
  const kickoffFact = index.matchFact(matchKey, 'match_kickoff');
  const kickoff = usableValue<'match_kickoff'>(kickoffFact)?.kickoff ?? null;
  return {
    included: true,
    plan: {
      matchKey,
      teamsFactId: teamsFact.id,
      statusFactId: statusFact.id,
      scoreFactId: scoreFact.id,
      kickoffFactId: kickoff === null || kickoffFact === undefined ? null : kickoffFact.id,
      home,
      away,
      score: { home: score.home, away: score.away },
      kickoff,
    },
  };
}

function kickoffInstant(kickoff: string | null): number {
  if (kickoff === null) {
    return Number.POSITIVE_INFINITY;
  }
  const instant = Date.parse(kickoff);
  return Number.isNaN(instant) ? Number.POSITIVE_INFINITY : instant;
}

/** Orders matches by kickoff, then home team name, then match key. */
function compareMatches(
  a: { readonly kickoff: string | null; readonly homeName: string; readonly matchKey: string },
  b: { readonly kickoff: string | null; readonly homeName: string; readonly matchKey: string },
): number {
  const byKickoff = kickoffInstant(a.kickoff) - kickoffInstant(b.kickoff);
  if (byKickoff !== 0 && !Number.isNaN(byKickoff)) {
    return byKickoff < 0 ? -1 : 1;
  }
  return compareText(a.homeName, b.homeName) || compareText(a.matchKey, b.matchKey);
}

/** The included matches in slide order (with their indexes) and the left-out matches in the same order. */
export function selectMatches(
  index: FactIndex,
  excludedMatchKeys: readonly string[],
): { readonly included: MatchPlan[]; readonly leftOut: LeftOutMatch[] } {
  const excluded = new Set(excludedMatchKeys);
  const examined = index.matchKeys().map((matchKey) => {
    const candidate = examineMatch(index, matchKey, excluded);
    const kickoff = usableValue<'match_kickoff'>(index.matchFact(matchKey, 'match_kickoff'))?.kickoff ?? null;
    const homeName = candidate.included ? candidate.plan.home.name : candidate.leftOut.label;
    return { candidate, kickoff, homeName, matchKey };
  });
  examined.sort(compareMatches);
  const included: MatchPlan[] = [];
  const leftOut: LeftOutMatch[] = [];
  for (const { candidate } of examined) {
    if (candidate.included) {
      included.push({ ...candidate.plan, index: included.length + 1 });
    } else {
      leftOut.push(candidate.leftOut);
    }
  }
  return { included, leftOut };
}

/** Statuses of a match that is still to be played (`upcoming` and `preview`). */
const UPCOMING_STATUSES: ReadonlySet<MatchStatus> = new Set(['scheduled', 'postponed']);

type FixtureCandidate =
  | { readonly included: true; readonly plan: Omit<FixturePlan, 'index'> }
  | { readonly included: false; readonly leftOut: LeftOutMatch };

function examineFixture(
  index: FactIndex,
  matchKey: string,
  excluded: ReadonlySet<string>,
  kind: Exclude<ContentKind, 'results'>,
): FixtureCandidate {
  const statusFact = index.matchFact(matchKey, 'match_status');
  const status: MatchStatus | null = usableValue<'match_status'>(statusFact)?.matchStatus ?? null;
  const leftOut = (reason: LeftOutMatch['reason']): FixtureCandidate => ({
    included: false,
    leftOut: { matchKey, label: matchLabel(index, matchKey), status, reason },
  });
  if (status === null || statusFact === undefined) {
    return leftOut('not_verified');
  }
  if (status === 'finished') {
    return leftOut('already_finished');
  }
  if (kind !== 'calendar' && !UPCOMING_STATUSES.has(status)) {
    return leftOut('not_upcoming');
  }
  const teamsFact = index.matchFact(matchKey, 'match_teams');
  const kickoffFact = index.matchFact(matchKey, 'match_kickoff');
  const teams = usableValue<'match_teams'>(teamsFact);
  const kickoff = usableValue<'match_kickoff'>(kickoffFact)?.kickoff ?? null;
  const home = teams === null ? null : index.teamName(teams.homeTeamId);
  const away = teams === null ? null : index.teamName(teams.awayTeamId);
  if (teamsFact === undefined || kickoffFact === undefined || kickoff === null || home === null || away === null) {
    return leftOut('not_verified');
  }
  if (excluded.has(matchKey)) {
    return leftOut('excluded_by_operator');
  }
  return {
    included: true,
    plan: {
      matchKey,
      teamsFactId: teamsFact.id,
      statusFactId: statusFact.id,
      kickoffFactId: kickoffFact.id,
      home,
      away,
      kickoff,
      status,
    },
  };
}

/** The fixtures of a content kind of matches not played yet, in slide order, and the left-out matches. */
export function selectFixtures(
  index: FactIndex,
  excludedMatchKeys: readonly string[],
  kind: Exclude<ContentKind, 'results'>,
): { readonly included: FixturePlan[]; readonly leftOut: LeftOutMatch[] } {
  const excluded = new Set(excludedMatchKeys);
  const examined = index.matchKeys().map((matchKey) => {
    const candidate = examineFixture(index, matchKey, excluded, kind);
    const kickoff = usableValue<'match_kickoff'>(index.matchFact(matchKey, 'match_kickoff'))?.kickoff ?? null;
    const homeName = candidate.included ? candidate.plan.home.name : candidate.leftOut.label;
    return { candidate, kickoff, homeName, matchKey };
  });
  examined.sort(compareMatches);
  const included: FixturePlan[] = [];
  const leftOut: LeftOutMatch[] = [];
  for (const { candidate } of examined) {
    if (candidate.included) {
      included.push({ ...candidate.plan, index: included.length + 1 });
    } else {
      leftOut.push(candidate.leftOut);
    }
  }
  return { included, leftOut };
}

/** The round overview pages of a calendar. */
export function overviewSlides(fixtures: readonly FixturePlan[]): SlidePlan[] {
  return chunks(fixtures, OVERVIEW_ROWS_PER_SLIDE).map((page, position) => ({
    type: 'round_overview',
    key: overviewSlideKey(position + 1),
    page: position + 1,
    fixtures: page,
  }));
}

/**
 * The standings rows in position order, or null when the run's standings are not available or a row lacks a value
 * or a team name (nothing is invented or derived, R-069, R-254).
 */
export function selectStandingsRows(
  index: FactIndex,
  standings: StandingsAvailability | null,
): StandingsRowPlan[] | null {
  if (standings === null || !standings.available || index.standingRows().length === 0) {
    return null;
  }
  const rows: StandingsRowPlan[] = [];
  for (const fact of index.standingRows()) {
    const value = usableValue<'standing_row'>(fact);
    const team = value === null ? null : index.teamName(value.teamId);
    if (value === null || team === null) {
      return null;
    }
    rows.push({ factId: fact.id, value, team });
  }
  rows.sort((a, b) => a.value.position - b.value.position || compareText(a.team.name, b.team.name));
  return rows;
}

/** Splits items into consecutive chunks of at most `size`. */
function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** Cover and closing around every group of content slides (at least one carousel). */
function carouselsOf(groups: SlidePlan[][]): CarouselPlan[] {
  if (groups.length === 0) {
    groups.push([]);
  }
  const total = groups.length;
  return groups.map((content, position) => ({
    sequence: position + 1,
    total,
    slides: [{ type: 'cover', key: 'cover' }, ...content, { type: 'closing', key: 'closing' }],
  }));
}

/** The draft plan of a content kind of matches not played yet (PD-ARCH-01E-B). */
function planFixtures(index: FactIndex, options: PlanOptions, kind: Exclude<ContentKind, 'results'>): DraftPlan {
  const { included, leftOut } = selectFixtures(index, options.excludedMatchKeys, kind);
  let content: SlidePlan[];
  if (kind === 'preview') {
    const [first] = included;
    content = first === undefined ? [] : [{ type: 'match_preview', key: PREVIEW_SLIDE_KEY, fixture: first }];
  } else {
    const fixtures: SlidePlan[] = included.map((fixture) => ({
      type: 'fixture',
      key: fixtureSlideKey(fixture.index),
      fixture,
    }));
    content = kind === 'calendar' ? [...overviewSlides(included), ...fixtures] : fixtures;
  }
  const capacity = Math.max(1, options.maxSlidesPerCarousel - 2);
  return {
    carousels: carouselsOf(chunks(content, capacity)),
    leftOutMatches: leftOut,
    standingsIncluded: false,
    excludedMatchKeys: [...options.excludedMatchKeys],
  };
}

/** Builds the draft plan from the facts of a run, by the project's content kind. */
export function planDraft(index: FactIndex, options: PlanOptions): DraftPlan {
  const kind = options.contentKind ?? 'results';
  if (kind !== 'results') {
    return planFixtures(index, options, kind);
  }
  const { included, leftOut } = selectMatches(index, options.excludedMatchKeys);
  const rows = selectStandingsRows(index, options.standings);
  const matchSlides: SlidePlan[] = included.map((match) => ({
    type: 'match_result',
    key: matchSlideKey(match.index),
    match,
  }));
  const standingsSlides: SlidePlan[] =
    rows === null
      ? []
      : chunks(rows, options.standingsRowsPerSlide).map((pageRows, page) => ({
          type: 'standings',
          key: standingsSlideKey(page + 1),
          page: page + 1,
          rows: pageRows,
        }));

  // Content slides per carousel: everything except its own cover and closing slide.
  const capacity = Math.max(1, options.maxSlidesPerCarousel - 2);
  const groups: SlidePlan[][] = chunks(matchSlides, capacity);
  if (standingsSlides.length > 0) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.length + standingsSlides.length <= capacity) {
      last.push(...standingsSlides);
    } else {
      groups.push(...chunks(standingsSlides, capacity));
    }
  }
  if (groups.length === 0) {
    groups.push([]);
  }
  const total = groups.length;
  const carousels: CarouselPlan[] = groups.map((content, position) => ({
    sequence: position + 1,
    total,
    slides: [{ type: 'cover', key: 'cover' }, ...content, { type: 'closing', key: 'closing' }],
  }));
  return {
    carousels,
    leftOutMatches: leftOut,
    standingsIncluded: standingsSlides.length > 0,
    excludedMatchKeys: [...options.excludedMatchKeys],
  };
}

/** Rebuilds the fixture plan of a stored fixture or preview slide from the facts (regeneration). */
export function fixturePlanFor(
  index: FactIndex,
  matchKey: string,
  matchIndex: number,
  kind: Exclude<ContentKind, 'results'>,
): FixturePlan | null {
  const candidate = examineFixture(index, matchKey, new Set(), kind);
  return candidate.included ? { ...candidate.plan, index: matchIndex } : null;
}

/** Rebuilds the match plan of a stored match slide from the facts (regeneration). */
export function matchPlanFor(index: FactIndex, matchKey: string, matchIndex: number): MatchPlan | null {
  const candidate = examineMatch(index, matchKey, new Set());
  return candidate.included ? { ...candidate.plan, index: matchIndex } : null;
}

/** Rebuilds the rows of a stored standings slide from the facts (regeneration). */
export function standingsRowsFor(index: FactIndex, teamIds: readonly string[]): StandingsRowPlan[] | null {
  const byTeam = new Map<string, StandingsRowPlan>();
  for (const fact of index.standingRows()) {
    const value = usableValue<'standing_row'>(fact);
    const team = value === null ? null : index.teamName(value.teamId);
    if (value !== null && team !== null) {
      byTeam.set(value.teamId, { factId: fact.id, value, team });
    }
  }
  const rows: StandingsRowPlan[] = [];
  for (const teamId of teamIds) {
    const row = byTeam.get(teamId);
    if (row === undefined) {
      return null;
    }
    rows.push(row);
  }
  return rows;
}
