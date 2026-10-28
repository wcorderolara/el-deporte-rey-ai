/**
 * Conversion of a parsed CSV file into an import candidate (contracts/provider-ports.md section 1.6; R-060 to R-069,
 * R-119, R-273 to R-280; T11H-F07, F09, F12).
 *
 * Field rules, checked before conversion: no `\p{Cc}` or `\p{Cf}` character; at most 200 characters; integers
 * `^-?[0-9]{1,4}$` for `goal_difference` and `points` and `^[0-9]{1,4}$` otherwise, then the contract ranges; names
 * by the name rules of section 1.3; times with an explicit offset; the closed status list. Empty metadata cells are
 * `metadata_missing`.
 *
 * Checks while converting, all errors collected: one competition and one season per file; one name and order per
 * stage; team keys derived by the exact rule (`team-key.ts`), an empty or invalid key or two different names giving
 * one key rejected naming every row involved (`value_inconsistent`); match identity (stage, matchday, home, away)
 * unique naming both rows; home differs from away; a finished match needs both scores and other statuses forbid
 * them; standings with one `as_of` per selection, each team once, unique positions contiguous from 1,
 * `won + drawn + lost = played` and `goals_for - goals_against = goal_difference`; the contract's array limits.
 *
 * Every lookup keyed by imported values uses `Map` or `Set` (T11H-F07). Errors name the row (line) and the column,
 * never a cell value (T11H-F12).
 */
import { type ManualSelection, DateTimeSchema, MatchStatusSchema, contractRegExp } from '@edr/contracts';

import type { CandidateSelection, ImportCandidate } from '../candidate.js';
import { type ImportErrorList, type ImportProblem, WHOLE_FILE } from '../errors.js';
import { deriveTeamKey } from '../team-key.js';

import { type CsvColumn, type CsvLayout, columnsOf } from './layouts.js';
import type { CsvParseResult, CsvRow } from './parser.js';

type MatchStatus = ManualSelection['matches'][number]['status'];
type StandingRow = NonNullable<ManualSelection['standings']>['rows'][number];

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;
const UNSIGNED = /^[0-9]{1,4}$/;
const SIGNED = /^-?[0-9]{1,4}$/;
const SLUG = contractRegExp('Slug');
const DISPLAY_NAME = contractRegExp('DisplayName');
const STAGE_NAME = contractRegExp('StageName');
const TEAM_NAME = contractRegExp('TeamName');
const DATE_TIME = DateTimeSchema.max(40);
const STATUSES: ReadonlySet<string> = new Set(MatchStatusSchema.options);

/** Contract array limits of one import document. */
export const DOCUMENT_LIMITS = Object.freeze({ selections: 100, teams: 64, matches: 64, standingRows: 64 });

/** Error reporter bound to one row. */
class RowErrors {
  constructor(
    private readonly errors: ImportErrorList,
    readonly line: number,
  ) {}

  invalid = false;

  add(field: CsvColumn | null, problem: ImportProblem, message: string): void {
    this.invalid = true;
    this.errors.add(String(this.line), field, problem, message);
  }
}

/** Reads the cells of one row by column name. */
class Cells {
  readonly #byColumn = new Map<CsvColumn, number>();

  constructor(
    private readonly row: CsvRow,
    columns: readonly CsvColumn[],
    private readonly report: RowErrors,
  ) {
    columns.forEach((column, index) => this.#byColumn.set(column, index));
  }

  /** The raw cell after the length and character checks; null (reported) when it fails them. */
  raw(column: CsvColumn): string | null {
    const index = this.#byColumn.get(column) ?? -1;
    if (this.row.longFields.has(index)) {
      this.report.add(column, 'value_out_of_range', 'The field is longer than 200 characters');
      return null;
    }
    const value = this.row.fields[index] ?? '';
    if (CONTROL_OR_FORMAT.test(value)) {
      this.report.add(column, 'type_invalid', 'The field contains a control or format character');
      return null;
    }
    return value;
  }

  slug(column: CsvColumn, metadata: boolean): string | null {
    const value = this.raw(column);
    if (value === null) {
      return null;
    }
    if (value === '') {
      this.report.add(column, metadata ? 'metadata_missing' : 'required_missing', 'The field is empty');
      return null;
    }
    if (value.length > 64 || !SLUG.test(value)) {
      this.report.add(column, 'type_invalid', 'The field must be 1 to 64 characters of a-z, 0-9 and -');
      return null;
    }
    return value;
  }

  name(column: CsvColumn, rule: RegExp, maxLength: number, metadata: boolean): string | null {
    const value = this.raw(column);
    if (value === null) {
      return null;
    }
    if (value === '') {
      this.report.add(column, metadata ? 'metadata_missing' : 'required_missing', 'The field is empty');
      return null;
    }
    if ([...value].length > maxLength) {
      this.report.add(column, 'value_out_of_range', `The name is longer than ${String(maxLength)} characters`);
      return null;
    }
    if (!rule.test(value)) {
      this.report.add(column, 'type_invalid', 'The name contains a character that is not allowed');
      return null;
    }
    return value;
  }

  /** An integer cell; `null` when empty and `optional`, `undefined` (reported) when invalid. */
  integer(
    column: CsvColumn,
    range: { min: number; max: number; signed?: boolean; optional?: boolean; metadata?: boolean },
  ): number | null | undefined {
    const value = this.raw(column);
    if (value === null) {
      return undefined;
    }
    if (value === '') {
      if (range.optional === true) {
        return null;
      }
      this.report.add(column, range.metadata === true ? 'metadata_missing' : 'required_missing', 'The field is empty');
      return undefined;
    }
    if (!(range.signed === true ? SIGNED : UNSIGNED).test(value)) {
      this.report.add(column, 'type_invalid', 'The field must be a whole number of at most 4 digits');
      return undefined;
    }
    const number = Number(value);
    if (number < range.min || number > range.max) {
      this.report.add(
        column,
        'value_out_of_range',
        `The number must be from ${String(range.min)} to ${String(range.max)}`,
      );
      return undefined;
    }
    return number;
  }

  dateTime(column: CsvColumn): string | null {
    const value = this.raw(column);
    if (value === null) {
      return null;
    }
    if (value === '') {
      this.report.add(column, 'required_missing', 'The field is empty');
      return null;
    }
    if (!DATE_TIME.safeParse(value).success) {
      this.report.add(column, 'type_invalid', 'The field must be an ISO-8601 date-time with an offset');
      return null;
    }
    return value;
  }

  status(column: CsvColumn): MatchStatus | null {
    const value = this.raw(column);
    if (value === null) {
      return null;
    }
    if (value === '') {
      this.report.add(column, 'required_missing', 'The field is empty');
      return null;
    }
    if (!STATUSES.has(value)) {
      this.report.add(column, 'value_out_of_range', 'The status is not one of the allowed statuses');
      return null;
    }
    return value as MatchStatus;
  }
}

interface CommonCells {
  readonly competitionId: string;
  readonly competitionName: string;
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly stageId: string;
  readonly stageName: string;
  readonly stageOrder: number;
  readonly matchday: number | null;
}

function readCommon(cells: Cells): CommonCells | null {
  const competitionId = cells.slug('competition_id', true);
  const competitionName = cells.name('competition_name', DISPLAY_NAME, 80, true);
  const seasonId = cells.slug('season_id', true);
  const seasonLabel = cells.name('season_label', DISPLAY_NAME, 80, true);
  const stageId = cells.slug('stage_id', true);
  const stageName = cells.name('stage_name', STAGE_NAME, 80, true);
  const stageOrder = cells.integer('stage_order', { min: 1, max: 99, metadata: true });
  const matchday = cells.integer('matchday', { min: 1, max: 999, optional: true });
  if (
    competitionId === null ||
    competitionName === null ||
    seasonId === null ||
    seasonLabel === null ||
    stageId === null ||
    stageName === null ||
    stageOrder === undefined ||
    stageOrder === null ||
    matchday === undefined
  ) {
    return null;
  }
  return { competitionId, competitionName, seasonId, seasonLabel, stageId, stageName, stageOrder, matchday };
}

/** One team-name occurrence (row and column) for the key-collision report. */
interface Occurrence {
  readonly line: number;
  readonly column: CsvColumn;
}

/** Selection under construction. */
interface SelectionDraft {
  readonly stageId: string;
  readonly matchday: number | null;
  readonly line: number;
  readonly teams: Map<string, string>;
  readonly matches: ManualSelection['matches'];
  readonly standingRows: Array<StandingRow & { readonly line: number }>;
  asOf: string | null;
  asOfLine: number;
  readonly standingTeams: Set<string>;
  readonly positions: Set<number>;
}

/** Converts a parsed CSV file of a detected layout into a candidate; null when any error was found. */
export function convertCsv(parsed: CsvParseResult, layout: CsvLayout, errors: ImportErrorList): ImportCandidate | null {
  const columns = columnsOf(layout);
  const dataRows = parsed.rows.slice(1);
  if (dataRows.length === 0 && parsed.brokenLines.size === 0) {
    errors.add(WHOLE_FILE, null, 'required_missing', 'The file has no data rows');
    return null;
  }

  let metadata: (CommonCells & { line: number }) | null = null;
  const stages = new Map<string, { name: string; order: number; line: number }>();
  const selections = new Map<string, SelectionDraft>();
  const identities = new Map<string, number>();
  const keyOfName = new Map<string, string | null>();
  const namesOfKey = new Map<string, Map<string, Occurrence[]>>();
  const unkeyed: Occurrence[] = [];

  const teamKey = (name: string, line: number, column: CsvColumn): string | null => {
    let key = keyOfName.get(name);
    if (key === undefined) {
      key = deriveTeamKey(name);
      keyOfName.set(name, key);
    }
    if (key === null) {
      unkeyed.push({ line, column });
      return null;
    }
    let names = namesOfKey.get(key);
    if (names === undefined) {
      names = new Map();
      namesOfKey.set(key, names);
    }
    const occurrences = names.get(name);
    if (occurrences === undefined) {
      names.set(name, [{ line, column }]);
    } else {
      occurrences.push({ line, column });
    }
    return key;
  };

  for (const row of dataRows) {
    if (errors.full) {
      break;
    }
    const report = new RowErrors(errors, row.line);
    if (row.fieldCount !== columns.length) {
      report.add(
        null,
        'parse_error',
        `The row has ${String(row.fieldCount)} fields; the layout has ${String(columns.length)}`,
      );
      continue;
    }
    const cells = new Cells(row, columns, report);
    const common = readCommon(cells);

    if (layout === 'matches') {
      const homeName = cells.name('home_team', TEAM_NAME, 64, false);
      const awayName = cells.name('away_team', TEAM_NAME, 64, false);
      const kickoff = cells.dateTime('kickoff');
      const status = cells.status('status');
      const homeScore = cells.integer('home_score', { min: 0, max: 99, optional: true });
      const awayScore = cells.integer('away_score', { min: 0, max: 99, optional: true });
      const home = homeName === null ? null : teamKey(homeName, row.line, 'home_team');
      const away = awayName === null ? null : teamKey(awayName, row.line, 'away_team');
      if (status !== null && homeScore !== undefined && awayScore !== undefined) {
        if (status === 'finished') {
          if (homeScore === null && awayScore === null) {
            report.add('home_score', 'finished_without_score', 'A finished match needs a score');
          } else if (homeScore === null) {
            report.add('home_score', 'required_missing', 'A finished match needs both scores');
          } else if (awayScore === null) {
            report.add('away_score', 'required_missing', 'A finished match needs both scores');
          }
        } else {
          if (homeScore !== null) {
            report.add('home_score', 'score_not_allowed', 'Only a finished match has a score');
          }
          if (awayScore !== null) {
            report.add('away_score', 'score_not_allowed', 'Only a finished match has a score');
          }
        }
      }
      if (home !== null && away !== null && home === away) {
        report.add('away_team', 'value_inconsistent', 'The home and away teams are the same team');
      }
      if (report.invalid || common === null || homeName === null || awayName === null) {
        continue;
      }
      if (home === null || away === null || kickoff === null || status === null) {
        continue;
      }
      if (homeScore === undefined || awayScore === undefined) {
        continue;
      }
      metadata = checkMetadata(metadata, common, row.line, report);
      const draft = selectionOf(selections, stages, common, row.line, report, errors);
      if (draft === null) {
        continue;
      }
      const identity = `${common.stageId}\u0000${String(common.matchday ?? 0)}\u0000${home}\u0000${away}`;
      const first = identities.get(identity);
      if (first !== undefined) {
        report.add(null, 'duplicate_match', `The match duplicates the match in row ${String(first)}`);
        continue;
      }
      identities.set(identity, row.line);
      if (!draft.teams.has(home)) {
        draft.teams.set(home, homeName);
      }
      if (!draft.teams.has(away)) {
        draft.teams.set(away, awayName);
      }
      if (draft.matches.length >= DOCUMENT_LIMITS.matches) {
        report.add(null, 'value_out_of_range', 'A selection has more than 64 matches');
        continue;
      }
      if (draft.teams.size > DOCUMENT_LIMITS.teams) {
        report.add('home_team', 'value_out_of_range', 'A selection has more than 64 teams');
        continue;
      }
      draft.matches.push({
        home,
        away,
        kickoff,
        status,
        score: homeScore === null || awayScore === null ? null : { home: homeScore, away: awayScore },
      });
      continue;
    }

    // Standings layout.
    const asOf = cells.dateTime('as_of');
    const position = cells.integer('position', { min: 1, max: 64 });
    const teamName = cells.name('team', TEAM_NAME, 64, false);
    const played = cells.integer('played', { min: 0, max: 999 });
    const won = cells.integer('won', { min: 0, max: 999 });
    const drawn = cells.integer('drawn', { min: 0, max: 999 });
    const lost = cells.integer('lost', { min: 0, max: 999 });
    const goalsFor = cells.integer('goals_for', { min: 0, max: 999 });
    const goalsAgainst = cells.integer('goals_against', { min: 0, max: 999 });
    const goalDifference = cells.integer('goal_difference', { min: -999, max: 999, signed: true });
    const points = cells.integer('points', { min: -999, max: 999, signed: true });
    const team = teamName === null ? null : teamKey(teamName, row.line, 'team');
    const numbers = [position, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points];
    const complete = numbers.every((value) => typeof value === 'number');
    const [rowPosition = 0, p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0, gd = 0, pts = 0] = complete
      ? (numbers as number[])
      : [];
    if (complete) {
      if (w + d + l !== p) {
        report.add('played', 'value_inconsistent', 'won + drawn + lost must equal played');
      }
      if (gf - ga !== gd) {
        report.add('goal_difference', 'value_inconsistent', 'goals_for - goals_against must equal goal_difference');
      }
    }
    if (report.invalid || common === null || asOf === null || teamName === null || team === null || !complete) {
      continue;
    }
    metadata = checkMetadata(metadata, common, row.line, report);
    const draft = selectionOf(selections, stages, common, row.line, report, errors);
    if (draft === null) {
      continue;
    }
    if (draft.asOf === null) {
      draft.asOf = asOf;
      draft.asOfLine = row.line;
    } else if (draft.asOf !== asOf) {
      report.add(
        'as_of',
        'value_inconsistent',
        `The as_of differs from row ${String(draft.asOfLine)} of the selection`,
      );
    }
    if (draft.standingTeams.has(team)) {
      report.add('team', 'value_inconsistent', 'The team appears twice in the standings of the selection');
    }
    draft.standingTeams.add(team);
    if (draft.positions.has(rowPosition)) {
      report.add('position', 'value_inconsistent', 'The position appears twice in the standings of the selection');
    }
    draft.positions.add(rowPosition);
    if (!draft.teams.has(team)) {
      draft.teams.set(team, teamName);
    }
    if (draft.standingRows.length >= DOCUMENT_LIMITS.standingRows) {
      report.add(null, 'value_out_of_range', 'A selection has more than 64 standings rows');
      continue;
    }
    draft.standingRows.push({
      line: row.line,
      position: rowPosition,
      team,
      played: p,
      won: w,
      drawn: d,
      lost: l,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDifference: gd,
      points: pts,
    });
  }

  reportTeamKeyProblems(namesOfKey, unkeyed, errors);

  for (const draft of selections.values()) {
    const count = draft.standingRows.length;
    for (const row of draft.standingRows) {
      if (row.position > count) {
        errors.add(String(row.line), 'position', 'value_inconsistent', 'Standings positions must be contiguous from 1');
      }
    }
  }

  const meta = metadata;
  if (!errors.empty || meta === null) {
    if (errors.empty) {
      errors.add(WHOLE_FILE, null, 'required_missing', 'The file has no valid data rows');
    }
    return null;
  }

  const at = (field: CsvColumn) => ({ record: String(meta.line), field });
  return {
    competition: { id: meta.competitionId, name: meta.competitionName, areaName: null },
    season: { id: meta.seasonId, label: meta.seasonLabel },
    selections: [...selections.values()].map((draft): CandidateSelection => toCandidate(draft, layout, stages)),
    competitionIdAt: at('competition_id'),
    competitionNameAt: at('competition_name'),
    seasonIdAt: at('season_id'),
    seasonLabelAt: at('season_label'),
  };
}

/** Keeps the first row's competition and season, and reports any row that differs from it. */
function checkMetadata(
  metadata: (CommonCells & { line: number }) | null,
  common: CommonCells,
  line: number,
  report: RowErrors,
): CommonCells & { line: number } {
  if (metadata === null) {
    return { ...common, line };
  }
  const differs = `differs from row ${String(metadata.line)}; one import holds one competition and one season`;
  if (common.competitionId !== metadata.competitionId) {
    report.add('competition_id', 'value_inconsistent', `The competition_id ${differs}`);
  }
  if (common.competitionName !== metadata.competitionName) {
    report.add('competition_name', 'value_inconsistent', `The competition_name ${differs}`);
  }
  if (common.seasonId !== metadata.seasonId) {
    report.add('season_id', 'value_inconsistent', `The season_id ${differs}`);
  }
  if (common.seasonLabel !== metadata.seasonLabel) {
    report.add('season_label', 'value_inconsistent', `The season_label ${differs}`);
  }
  return metadata;
}

/** The selection draft of the row's stage and matchday, checking the stage's name and order; null when over limit. */
function selectionOf(
  selections: Map<string, SelectionDraft>,
  stages: Map<string, { name: string; order: number; line: number }>,
  common: CommonCells,
  line: number,
  report: RowErrors,
  errors: ImportErrorList,
): SelectionDraft | null {
  const stage = stages.get(common.stageId);
  if (stage === undefined) {
    stages.set(common.stageId, { name: common.stageName, order: common.stageOrder, line });
  } else {
    if (stage.name !== common.stageName) {
      report.add(
        'stage_name',
        'value_inconsistent',
        `The stage_name differs from row ${String(stage.line)} for the stage`,
      );
    }
    if (stage.order !== common.stageOrder) {
      report.add(
        'stage_order',
        'value_inconsistent',
        `The stage_order differs from row ${String(stage.line)} for the stage`,
      );
    }
  }
  const key = `${common.stageId}\u0000${String(common.matchday ?? 0)}`;
  let draft = selections.get(key);
  if (draft === undefined) {
    if (selections.size >= DOCUMENT_LIMITS.selections) {
      errors.add(String(line), 'matchday', 'value_out_of_range', 'The file has more than 100 selections');
      return null;
    }
    draft = {
      stageId: common.stageId,
      matchday: common.matchday,
      line,
      teams: new Map(),
      matches: [],
      standingRows: [],
      asOf: null,
      asOfLine: 0,
      standingTeams: new Set(),
      positions: new Set(),
    };
    selections.set(key, draft);
  }
  return draft;
}

/** Reports team names without a valid key, and keys derived from two different names, naming every row involved. */
function reportTeamKeyProblems(
  namesOfKey: ReadonlyMap<string, ReadonlyMap<string, readonly Occurrence[]>>,
  unkeyed: readonly Occurrence[],
  errors: ImportErrorList,
): void {
  for (const occurrence of unkeyed) {
    errors.add(
      String(occurrence.line),
      occurrence.column,
      'value_inconsistent',
      'The team name gives no valid team key (it needs letters a-z or digits after normalization)',
    );
  }
  for (const names of namesOfKey.values()) {
    if (names.size < 2) {
      continue;
    }
    const firstLines = [...names.values()].map((occurrences) => occurrences[0]?.line ?? 0);
    let nameIndex = 0;
    for (const occurrences of names.values()) {
      const other = firstLines[nameIndex === 0 ? 1 : 0] ?? 0;
      for (const occurrence of occurrences) {
        errors.add(
          String(occurrence.line),
          occurrence.column,
          'value_inconsistent',
          `A different team name in row ${String(other)} gives the same team key`,
        );
      }
      nameIndex += 1;
    }
  }
}

function toCandidate(
  draft: SelectionDraft,
  layout: CsvLayout,
  stages: ReadonlyMap<string, { name: string; order: number; line: number }>,
): CandidateSelection {
  const stage = stages.get(draft.stageId) ?? { name: '', order: 0, line: draft.line };
  const record = String(draft.line);
  const standings =
    layout === 'standings' && draft.asOf !== null
      ? {
          asOf: draft.asOf,
          rows: [...draft.standingRows]
            .sort((a, b) => a.position - b.position)
            .map((row) => ({
              position: row.position,
              team: row.team,
              played: row.played,
              won: row.won,
              drawn: row.drawn,
              lost: row.lost,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              goalDifference: row.goalDifference,
              points: row.points,
            })),
        }
      : null;
  return {
    selection: {
      stage: { id: draft.stageId, name: stage.name, order: stage.order },
      matchday: draft.matchday,
      teams: [...draft.teams].map(([key, name]) => ({ key, name })),
      matches: [...draft.matches],
      standings,
    },
    standingsOnly: layout === 'standings',
    stageAt: { record, field: 'stage_id' },
    matchdayAt: { record, field: 'matchday' },
    matchesAt: { record, field: null },
    teamsAt: { record, field: layout === 'standings' ? 'team' : 'home_team' },
  };
}
