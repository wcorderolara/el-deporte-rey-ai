/**
 * The two CSV layouts of MANUAL_DATA imports (contracts/provider-ports.md section 1.6). The layout is detected from
 * the exact header row. A header with a person-like column is refused as `person_field` and one with any other
 * unknown column as `column_unknown`, each naming the column (R-119, R-280); any other deviation from both layouts
 * (order, missing or repeated columns) is `header_invalid`.
 */
import { type ImportErrorList, WHOLE_FILE, fieldName } from '../errors.js';
import { isPersonField } from '../person.js';

import type { CsvParseResult } from './parser.js';

export const MATCHES_COLUMNS = [
  'competition_id',
  'competition_name',
  'season_id',
  'season_label',
  'stage_id',
  'stage_name',
  'stage_order',
  'matchday',
  'home_team',
  'away_team',
  'kickoff',
  'status',
  'home_score',
  'away_score',
] as const;

export const STANDINGS_COLUMNS = [
  'competition_id',
  'competition_name',
  'season_id',
  'season_label',
  'stage_id',
  'stage_name',
  'stage_order',
  'matchday',
  'as_of',
  'position',
  'team',
  'played',
  'won',
  'drawn',
  'lost',
  'goals_for',
  'goals_against',
  'goal_difference',
  'points',
] as const;

export type MatchesColumn = (typeof MATCHES_COLUMNS)[number];
export type StandingsColumn = (typeof STANDINGS_COLUMNS)[number];
export type CsvColumn = MatchesColumn | StandingsColumn;
export type CsvLayout = 'matches' | 'standings';

const KNOWN_COLUMNS: ReadonlySet<string> = new Set<string>([...MATCHES_COLUMNS, ...STANDINGS_COLUMNS]);

/** The columns of a layout. */
export function columnsOf(layout: CsvLayout): readonly CsvColumn[] {
  return layout === 'matches' ? MATCHES_COLUMNS : STANDINGS_COLUMNS;
}

function sameColumns(header: readonly string[], columns: readonly string[]): boolean {
  return header.length === columns.length && header.every((name, index) => name === columns[index]);
}

/**
 * Detects the layout from the header row (the first row, line 1). Returns null after adding the header errors, or
 * when the header row itself had a syntax error (already reported).
 */
export function detectLayout(parsed: CsvParseResult, errors: ImportErrorList): CsvLayout | null {
  const header = parsed.rows[0];
  if (parsed.brokenLines.has(1)) {
    return null;
  }
  if (header?.line !== 1) {
    errors.add(WHOLE_FILE, null, 'header_invalid', 'The file has no header row');
    return null;
  }
  const record = String(header.line);
  let unknown = false;
  header.fields.forEach((name, index) => {
    if (header.longFields.has(index)) {
      unknown = true;
      errors.add(record, null, 'header_invalid', 'A header name is longer than 200 characters');
      return;
    }
    if (isPersonField(name)) {
      unknown = true;
      errors.add(
        record,
        fieldName(name),
        'person_field',
        'Person-level columns are not accepted (team and competition data only)',
      );
    } else if (!KNOWN_COLUMNS.has(name)) {
      unknown = true;
      errors.add(record, fieldName(name), 'column_unknown', 'The column is not part of either import layout');
    }
  });
  if (unknown) {
    return null;
  }
  if (header.fieldCount === MATCHES_COLUMNS.length && sameColumns(header.fields, MATCHES_COLUMNS)) {
    return 'matches';
  }
  if (header.fieldCount === STANDINGS_COLUMNS.length && sameColumns(header.fields, STANDINGS_COLUMNS)) {
    return 'standings';
  }
  errors.add(record, null, 'header_invalid', 'The header row must be exactly the matches or the standings layout');
  return null;
}
