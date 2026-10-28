/**
 * Mapping of the allow-listed football-data resources to the provider-neutral domain (contracts/provider-ports.md
 * sections 1.3 and 1.4; R-077, R-244 to R-247, R-253 to R-255, R-280, R-286; T11H-F07, T11H-F14).
 *
 * - References (`SourceRef`) are adapter-owned JSON of at most 512 characters; only this module builds and reads them.
 * - Attribution references are `source:<sourceId>/<resourceKind>@<retrievedAt>`, never a URL (T11H-F14).
 * - Grouping and lookups keyed by provider values (stage values, team keys, competition codes) use `Map` and `Set`
 *   only, never a plain object (T11H-F07); no raw parsed object is spread or assigned.
 * - Nothing is filled or derived: a finished match keeps its full-time score only, every other status has no score,
 *   in-play scores are dropped; missing standings are reported with a reason (R-069, R-254, R-279).
 */
import { z } from 'zod';

import {
  type SelectionSnapshot,
  type SourceCompetition,
  type SourceRef,
  type SourceSeason,
  type SourceStage,
  SourceError,
  asSourceRef,
} from '../../ingestion/index.js';

import { COMPETITION_CODE_PATTERN } from './options.js';
import type {
  CompetitionDetail,
  CompetitionsResponse,
  MatchesResponse,
  ProviderMatch,
  ProviderMatchStatus,
  ProviderSeason,
  ProviderTable,
  ProviderTeam,
  StandingsResponse,
} from './schemas.js';

type MatchStatus = SelectionSnapshot['matches'][number]['status'];
type StandingsUnavailableReason = Extract<SelectionSnapshot['standings'], { available: false }>['reason'];

/** Provider status -> domain status (verified enum; section 1.4 "Status mapping"). */
export const STATUS_MAP: ReadonlyMap<ProviderMatchStatus, MatchStatus> = new Map<ProviderMatchStatus, MatchStatus>([
  ['SCHEDULED', 'scheduled'],
  ['TIMED', 'scheduled'],
  ['IN_PLAY', 'in_play'],
  ['PAUSED', 'in_play'],
  ['EXTRA_TIME', 'in_play'],
  ['PENALTY_SHOOTOUT', 'in_play'],
  ['FINISHED', 'finished'],
  ['POSTPONED', 'postponed'],
  ['SUSPENDED', 'suspended'],
  ['CANCELLED', 'cancelled'],
  ['AWARDED', 'awarded'],
]);

/** Resource kinds named in attribution references (section 1.3). */
export type AttributionKind = 'competitions' | 'seasons' | 'stages' | 'matches' | 'standings';

/** `source:<sourceId>/<resourceKind>@<retrievedAt>` (T11H-F14). */
export function attributionRef(sourceId: string, kind: AttributionKind, retrievedAt: string): string {
  return `source:${sourceId}/${kind}@${retrievedAt}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Opaque references
// ---------------------------------------------------------------------------------------------------------------

const code = z.string().regex(COMPETITION_CODE_PATTERN);
const name = z.string().min(1).max(80);
const year = z.number().int().min(1800).max(9999);

const competitionRefSchema = z.strictObject({ c: code, n: name });
const seasonRefSchema = z.strictObject({ c: code, n: name, y: year, l: name, cur: z.boolean() });
const selectionRefSchema = z.strictObject({
  c: code,
  n: name,
  y: year,
  l: name,
  cur: z.boolean(),
  st: z.string().min(1).max(80),
  md: z.number().int().min(1).max(999).nullable(),
  t: z.number().int().min(1).max(999).nullable(),
  sx: z.boolean(),
});

export type CompetitionRef = z.output<typeof competitionRefSchema>;
export type SeasonRef = z.output<typeof seasonRefSchema>;
export type SelectionRef = z.output<typeof selectionRefSchema>;

function encode(value: object): SourceRef {
  return asSourceRef(JSON.stringify(value));
}

function decode<S extends z.ZodType>(schema: S, ref: string, sourceId: string): z.output<S> {
  let raw: unknown;
  try {
    raw = typeof ref === 'string' && ref.length <= 512 ? JSON.parse(ref) : undefined;
  } catch {
    raw = undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new SourceError('invalid', 'unknown source reference', sourceId);
  }
  return result.data;
}

export const decodeCompetitionRef = (ref: string, sourceId: string): CompetitionRef =>
  decode(competitionRefSchema, ref, sourceId);
export const decodeSeasonRef = (ref: string, sourceId: string): SeasonRef => decode(seasonRefSchema, ref, sourceId);
export const decodeSelectionRef = (ref: string, sourceId: string): SelectionRef =>
  decode(selectionRefSchema, ref, sourceId);

/** The provider competition code of a competition reference (the probe records it), or null. */
export function competitionCodeOfRef(ref: string): string | null {
  const result = competitionRefSchema.safeParse(safeJson(ref));
  return result.success ? result.data.c : null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Slugs and keys
// ---------------------------------------------------------------------------------------------------------------

/** A slug (`^[a-z0-9][a-z0-9-]{0,63}$`) of a provider value, or the empty string when nothing remains. */
export function slugOf(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

/** The key of a provider ID (team or match), as a string. */
function keyOf(id: string | number): string {
  return typeof id === 'number' ? String(id) : id;
}

// ---------------------------------------------------------------------------------------------------------------
// Competitions (listCompetitions)
// ---------------------------------------------------------------------------------------------------------------

export interface MappedCompetitions {
  readonly items: SourceCompetition[];
  /** Items left out because their key repeated another or their code was unusable (counted, never logged). */
  readonly skipped: number;
}

/**
 * Each competition: ref `{c, n}` with the code (or the numeric ID when there is no code), `localKey` = slug of the
 * code or ID, name, area name. Configured reference competitions are listed first, in configured order (R-244).
 */
export function mapCompetitions(response: CompetitionsResponse, referenceRefs: readonly string[]): MappedCompetitions {
  const items: SourceCompetition[] = [];
  const keys = new Set<string>();
  const byCode = new Map<string, SourceCompetition>();
  let skipped = 0;
  for (const competition of response.competitions) {
    const providerCode = competition.code ?? keyOf(competition.id);
    const localKey = slugOf(providerCode);
    if (!COMPETITION_CODE_PATTERN.test(providerCode) || localKey === '' || keys.has(localKey)) {
      skipped += 1;
      continue;
    }
    keys.add(localKey);
    const item: SourceCompetition = {
      ref: encode({ c: providerCode, n: competition.name }),
      localKey,
      name: competition.name,
      areaName: competition.area?.name ?? null,
    };
    items.push(item);
    byCode.set(providerCode, item);
  }
  const first: SourceCompetition[] = [];
  for (const reference of referenceRefs) {
    const item = byCode.get(reference);
    if (item !== undefined && !first.includes(item)) {
      first.push(item);
    }
  }
  return { items: [...first, ...items.filter((item) => !first.includes(item))], skipped };
}

// ---------------------------------------------------------------------------------------------------------------
// Seasons (listSeasons)
// ---------------------------------------------------------------------------------------------------------------

const DATE = /^([0-9]{4})-[0-9]{2}-[0-9]{2}$/;

function yearOf(date: string | null | undefined): number | null {
  const match = typeof date === 'string' ? DATE.exec(date) : null;
  return match === null ? null : Number(match[1]);
}

function isoDate(date: string | null | undefined): string | null {
  return typeof date === 'string' && DATE.test(date) && !Number.isNaN(Date.parse(date)) ? date : null;
}

/** `YYYY/YY` from the start and end dates, `YYYY` when both fall in one year (or without an end date). */
export function seasonLabel(startYear: number, endYear: number | null): string {
  return endYear === null || endYear === startYear
    ? String(startYear)
    : `${String(startYear)}/${String(endYear % 100).padStart(2, '0')}`;
}

function isCurrent(season: ProviderSeason, current: ProviderSeason | null | undefined): boolean {
  if (current === null || current === undefined) {
    return false;
  }
  if (season.id !== null && season.id !== undefined && current.id !== null && current.id !== undefined) {
    return keyOf(season.id) === keyOf(current.id);
  }
  return isoDate(season.startDate) !== null && isoDate(season.startDate) === isoDate(current.startDate);
}

export interface MappedSeasons {
  readonly items: SourceSeason[];
  readonly skipped: number;
}

/**
 * Only the seasons the provider reports (R-244): season ID and `startYear` = the four-digit starting year; label
 * `YYYY/YY`; `current` from `currentSeason`. A season without a usable start date, or repeating a start year, is left
 * out (counted).
 */
export function mapSeasons(detail: CompetitionDetail, competition: CompetitionRef): MappedSeasons {
  const items: SourceSeason[] = [];
  const years = new Set<number>();
  let skipped = 0;
  for (const season of detail.seasons) {
    const startDate = isoDate(season.startDate);
    const startYear = yearOf(startDate);
    if (startDate === null || startYear === null || years.has(startYear)) {
      skipped += 1;
      continue;
    }
    years.add(startYear);
    const endDate = isoDate(season.endDate);
    const label = seasonLabel(startYear, yearOf(endDate));
    const current = isCurrent(season, detail.currentSeason);
    const ref: SeasonRef = { c: competition.c, n: competition.n, y: startYear, l: label, cur: current };
    items.push({ ref: encode(ref), id: String(startYear), label, current, startDate, endDate, startYear });
  }
  return { items, skipped };
}

// ---------------------------------------------------------------------------------------------------------------
// Stages (listStages: one season-wide match list)
// ---------------------------------------------------------------------------------------------------------------

interface StageGroup {
  readonly value: string;
  earliest: number;
  readonly matchdays: Set<number>;
  hasUnnumbered: boolean;
}

export interface MappedStages {
  readonly items: SourceStage[];
  /** Matches without a stage value (left out of the stage list, counted). */
  readonly skipped: number;
}

/**
 * Matches grouped (in a `Map`) by their stage value and matchday number: stage ID = slug of the value, name = the
 * value as given (R-077), order by earliest kickoff; matchdays = distinct numbers; `wholeStageRef` when the stage has
 * matches without a number; standings `expected` for the stage that contains matchday 1 of the season (the table
 * stage), `unknown` otherwise (refined by T53).
 */
export function mapStages(response: MatchesResponse, season: SeasonRef): MappedStages {
  const groups = new Map<string, StageGroup>();
  let skipped = 0;
  for (const match of response.matches) {
    const value = match.stage;
    if (typeof value !== 'string' || value.length === 0) {
      skipped += 1;
      continue;
    }
    const kickoff = Date.parse(match.utcDate);
    let group = groups.get(value);
    if (group === undefined) {
      group = { value, earliest: Number.POSITIVE_INFINITY, matchdays: new Set(), hasUnnumbered: false };
      groups.set(value, group);
    }
    if (Number.isFinite(kickoff)) {
      group.earliest = Math.min(group.earliest, kickoff);
    }
    if (typeof match.matchday === 'number' && match.matchday >= 1) {
      group.matchdays.add(match.matchday);
    } else {
      group.hasUnnumbered = true;
    }
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.earliest - b.earliest || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
  );
  const ids = new Set<string>();
  const items = ordered.map((group, index): SourceStage => {
    const order = index + 1;
    let id = slugOf(group.value);
    if (id === '') {
      id = `stage-${String(order)}`;
    }
    if (ids.has(id)) {
      id = `${id.slice(0, 56)}-${String(order)}`;
    }
    ids.add(id);
    const numbers = [...group.matchdays].sort((a, b) => a - b);
    const total = numbers.length > 0 ? (numbers[numbers.length - 1] ?? null) : null;
    const expected = group.matchdays.has(1);
    const base = { c: season.c, n: season.n, y: season.y, l: season.l, cur: season.cur, st: group.value, sx: expected };
    return {
      id,
      name: group.value,
      order,
      standings: expected ? 'expected' : 'unknown',
      wholeStageRef: group.hasUnnumbered ? encode({ ...base, md: null, t: null } satisfies SelectionRef) : null,
      matchdays: numbers.map((number) => ({
        number,
        ref: encode({ ...base, md: number, t: total } satisfies SelectionRef),
      })),
    };
  });
  return { items, skipped };
}

// ---------------------------------------------------------------------------------------------------------------
// Selection (fetchSelection: matches, then standings)
// ---------------------------------------------------------------------------------------------------------------

/** The standings part of a selection: the response, or why there is none. */
export type StandingsInput =
  | { readonly kind: 'response'; readonly response: StandingsResponse; readonly retrievedAt: string }
  | { readonly kind: 'none'; readonly reason: StandingsUnavailableReason };

export interface MappedSelection {
  /** The snapshot before the shared domain validation. */
  readonly snapshot: SelectionSnapshot;
  /** Matches of the response left out: another stage, or a team not yet known (counted). */
  readonly skippedMatches: number;
}

interface TeamEntry {
  readonly name: string;
  readonly aliases: string[];
}

function addTeam(teams: Map<string, TeamEntry>, team: ProviderTeam): string | null {
  if (team.id === null || team.id === undefined || typeof team.name !== 'string' || team.name.length === 0) {
    return null;
  }
  const key = keyOf(team.id);
  if (!teams.has(key)) {
    const aliases: string[] = [];
    for (const alias of [team.shortName, team.tla]) {
      if (typeof alias === 'string' && alias.length > 0 && alias !== team.name && !aliases.includes(alias)) {
        aliases.push(alias);
      }
    }
    teams.set(key, { name: team.name, aliases });
  }
  return key;
}

function scoreOf(match: ProviderMatch, status: MatchStatus): { home: number; away: number } | null {
  if (status !== 'finished') {
    return null;
  }
  const fullTime = match.score?.fullTime;
  const home = fullTime?.home;
  const away = fullTime?.away;
  return typeof home === 'number' && typeof away === 'number' ? { home, away } : null;
}

/**
 * Only the `TOTAL` table is used. When tables carry a stage value, only those of the selection's stage count
 * (attribution UNVERIFIED, T53). Exactly one table is used; none, or several (for example groups), give no standings.
 */
export function selectTotalTable(response: StandingsResponse, stageValue: string): ProviderTable | null {
  const totals = response.standings.filter((table) => table.type === 'TOTAL');
  const staged = totals.some((table) => typeof table.stage === 'string')
    ? totals.filter((table) => table.stage === stageValue)
    : totals;
  return staged.length === 1 ? (staged[0] ?? null) : null;
}

/** Builds the snapshot of one selection (validated afterwards with the shared domain schema). */
export function mapSelection(
  ref: SelectionRef,
  matchesResponse: MatchesResponse,
  standings: StandingsInput,
  context: { readonly sourceId: string; readonly retrievedAt: string },
): MappedSelection {
  const { sourceId, retrievedAt } = context;
  const matchesRef = attributionRef(sourceId, 'matches', retrievedAt);
  const teams = new Map<string, TeamEntry>();
  const matches: SelectionSnapshot['matches'] = [];
  let skippedMatches = 0;

  for (const match of matchesResponse.matches) {
    if (match.stage !== ref.st) {
      skippedMatches += 1;
      continue;
    }
    const home = addTeam(teams, match.homeTeam);
    const away = addTeam(teams, match.awayTeam);
    if (home === null || away === null) {
      skippedMatches += 1;
      continue;
    }
    const status = STATUS_MAP.get(match.status) ?? 'scheduled';
    matches.push({
      matchKey: keyOf(match.id),
      homeTeamKey: home,
      awayTeamKey: away,
      kickoff: match.utcDate,
      status,
      score: scoreOf(match, status),
      ref: matchesRef,
    });
  }

  let table: SelectionSnapshot['standings'];
  const context_: SelectionSnapshot['context'] = [];
  if (ref.md !== null && ref.t !== null) {
    context_.push({ type: 'matchday_of_total', matchday: ref.md, totalMatchdays: ref.t, ref: matchesRef });
  }
  if (standings.kind === 'none') {
    table = { available: false, reason: standings.reason };
  } else {
    const total = selectTotalTable(standings.response, ref.st);
    if (total === null) {
      table = { available: false, reason: 'not_provided_by_source' };
    } else {
      const standingsRef = attributionRef(sourceId, 'standings', standings.retrievedAt);
      const rows = total.table.map((row) => ({
        position: row.position,
        teamKey: addTeam(teams, row.team) ?? keyOf(row.team.id),
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        ref: standingsRef,
      }));
      table = { available: true, asOf: standings.retrievedAt, ref: standingsRef, rows };
      context_.push({ type: 'teams_in_table', count: rows.length, ref: standingsRef });
    }
  }
  context_.push({ type: 'matches_in_selection', count: matches.length, ref: matchesRef });

  const competitionName = matchesResponse.competition?.name;
  const snapshot: SelectionSnapshot = {
    sourceId,
    mode: 'LIVE_DATA',
    retrievedAt,
    fromCache: false,
    sourceRef: matchesRef,
    importVersionId: null,
    competition: { name: typeof competitionName === 'string' && competitionName.length > 0 ? competitionName : ref.n },
    season: { label: ref.l },
    stage: { name: ref.st, matchday: ref.md, totalMatchdays: ref.md === null ? null : ref.t },
    teams: [...teams].map(([teamKey, entry]) => ({
      teamKey,
      name: entry.name,
      aliases: entry.aliases,
      ref: matchesRef,
    })),
    matches,
    standings: table,
    context: context_,
  };
  return { snapshot, skippedMatches };
}
