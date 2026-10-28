/**
 * Test-only helpers of the fixture validation test (T23): a small reader for the manual CSV layouts and JSON import
 * documents that classifies each sample by the import error classes of `contracts/provider-ports.md` section 1.6,
 * a reader of the football-data-shaped responses, and a provider-neutral comparison form of one selection used for
 * the equivalence set (R-267). These helpers check the fixtures themselves; they are not the import pipeline (T50) or
 * the football-data adapter (T49), which have their own tests on these files.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ImportProblem,
  type ManualImportDocument,
  ManualImportDocumentSchema,
  type SelectionSnapshot,
} from '@edr/contracts';

export const FIXTURES_DIR = fileURLToPath(new URL('./', import.meta.url));
export const PROJECT_ROOT = join(FIXTURES_DIR, '..');

export type Json = Record<string, unknown>;

export function readFixtureText(relativePath: string): string {
  return readFileSync(join(FIXTURES_DIR, relativePath), 'utf8');
}

export function readFixtureJson<T = unknown>(relativePath: string): T {
  return JSON.parse(readFixtureText(relativePath)) as T;
}

export function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------------------------------------------
// Team keys and name normalization
// ---------------------------------------------------------------------------------------------------------------

/** Team-key rule of the manual import (provider-ports section 1.6, T11H-F09). */
export function teamKeyOf(name: string): string {
  return name
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Name normalization of team identity matching (architecture.md section 7.2): no case, diacritics or punctuation. */
export function normalizedName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------------------------
// Provider-neutral comparison form of one selection (R-267: equal apart from mode, source metadata and timestamps)
// ---------------------------------------------------------------------------------------------------------------

export interface ComparableSelection {
  competition: string;
  season: string;
  stage: string;
  matchday: number | null;
  teams: string[];
  matches: string[];
  standings: string[] | null;
}

interface RawMatch {
  home: string;
  away: string;
  kickoff: string;
  status: string;
  score: { home: number; away: number } | null;
}

interface RawRow {
  position: number;
  team: string;
  values: number[];
}

function comparable(
  head: Omit<ComparableSelection, 'teams' | 'matches' | 'standings'>,
  teams: string[],
  matches: RawMatch[],
  rows: RawRow[] | null,
): ComparableSelection {
  return {
    ...head,
    teams: [...teams].sort(),
    matches: matches
      .map(
        (m) =>
          `${m.home} | ${m.away} | ${new Date(m.kickoff).toISOString()} | ${m.status} | ` +
          (m.score === null ? '-' : `${String(m.score.home)}-${String(m.score.away)}`),
      )
      .sort(),
    standings:
      rows === null
        ? null
        : [...rows]
            .sort((a, b) => a.position - b.position)
            .map((row) => `${String(row.position)} | ${row.team} | ${row.values.join(' ')}`),
  };
}

function rowValues(row: {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}): number[] {
  return [row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points];
}

export function comparableFromSnapshot(snapshot: SelectionSnapshot): ComparableSelection {
  const names = new Map(snapshot.teams.map((team) => [team.teamKey, team.name]));
  const name = (key: string): string => names.get(key) ?? `?${key}`;
  return comparable(
    {
      competition: snapshot.competition.name,
      season: snapshot.season.label,
      stage: snapshot.stage.name,
      matchday: snapshot.stage.matchday,
    },
    snapshot.teams.map((team) => team.name),
    snapshot.matches.map((m) => ({
      home: name(m.homeTeamKey),
      away: name(m.awayTeamKey),
      kickoff: m.kickoff,
      status: m.status,
      score: m.score,
    })),
    snapshot.standings.available
      ? snapshot.standings.rows.map((row) => ({
          position: row.position,
          team: name(row.teamKey),
          values: rowValues(row),
        }))
      : null,
  );
}

export function comparableFromManual(document: ManualImportDocument, index = 0): ComparableSelection {
  const selection = document.selections[index];
  if (selection === undefined) {
    throw new Error('selection missing');
  }
  const names = new Map(selection.teams.map((team) => [team.key, team.name]));
  const name = (key: string): string => names.get(key) ?? `?${key}`;
  return comparable(
    {
      competition: document.competition.name,
      season: document.season.label,
      stage: selection.stage.name,
      matchday: selection.matchday,
    },
    selection.teams.map((team) => team.name),
    selection.matches.map((m) => ({
      home: name(m.home),
      away: name(m.away),
      kickoff: m.kickoff,
      status: m.status,
      score: m.score,
    })),
    selection.standings === null
      ? null
      : selection.standings.rows.map((row) => ({
          position: row.position,
          team: name(row.team),
          values: rowValues(row),
        })),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// football-data-shaped responses (contracts/provider-ports.md section 1.4)
// ---------------------------------------------------------------------------------------------------------------

export const FOOTBALL_DATA_HEADERS = [
  'X-API-Version',
  'X-Authenticated-Client',
  'X-RequestCounter-Reset',
  'X-RequestsAvailable',
] as const;

export const FOOTBALL_DATA_STATUS: ReadonlyMap<string, string> = new Map([
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

export interface FootballDataResponse {
  request: { method: string; path: string; query: Record<string, string> };
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  bodyText?: string;
}

/** Problems of one football-data match object against the mapped fields (fixed texts with JSON pointers). */
export function footballDataMatchProblems(match: unknown, at: string): string[] {
  if (!isRecord(match)) {
    return [`${at} is not an object`];
  }
  const problems: string[] = [];
  const integer = (value: unknown): boolean => Number.isSafeInteger(value);
  const team = (key: string): void => {
    const value = match[key];
    if (!isRecord(value) || !integer(value['id']) || typeof value['name'] !== 'string') {
      problems.push(`${at}/${key} is not a team`);
    }
  };
  if (!integer(match['id'])) problems.push(`${at}/id is not an integer`);
  if (typeof match['utcDate'] !== 'string' || Number.isNaN(Date.parse(match['utcDate']))) {
    problems.push(`${at}/utcDate is not a date`);
  }
  if (typeof match['status'] !== 'string' || !FOOTBALL_DATA_STATUS.has(match['status'])) {
    problems.push(`${at}/status is not a known status`);
  }
  if (match['matchday'] !== null && !integer(match['matchday'])) problems.push(`${at}/matchday is not an integer`);
  if (typeof match['stage'] !== 'string') problems.push(`${at}/stage is not a string`);
  team('homeTeam');
  team('awayTeam');
  const score = match['score'];
  const fullTime = isRecord(score) ? score['fullTime'] : undefined;
  if (!isRecord(fullTime)) {
    problems.push(`${at}/score/fullTime is missing`);
  } else {
    for (const side of ['home', 'away']) {
      if (fullTime[side] !== null && !integer(fullTime[side]))
        problems.push(`${at}/score/fullTime/${side} is not an integer`);
    }
  }
  return problems;
}

/** The comparison form of a football-data matchday (matches list plus the TOTAL table), mapped as section 1.4. */
export function comparableFromFootballData(matchesBody: Json, standingsBody: Json): ComparableSelection {
  const matches = matchesBody['matches'] as Json[];
  const first = matches[0] as Json;
  const season = first['season'] as { startDate: string; endDate: string };
  const startYear = season.startDate.slice(0, 4);
  const endYear = season.endDate.slice(0, 4);
  const label = startYear === endYear ? startYear : `${startYear}/${endYear.slice(2)}`;
  const teamNames = new Set<string>();
  const mapped: RawMatch[] = matches.map((match) => {
    const home = (match['homeTeam'] as Json)['name'] as string;
    const away = (match['awayTeam'] as Json)['name'] as string;
    teamNames.add(home);
    teamNames.add(away);
    const status = FOOTBALL_DATA_STATUS.get(match['status'] as string) ?? 'unknown';
    const fullTime = (match['score'] as Json)['fullTime'] as { home: number; away: number };
    return {
      home,
      away,
      kickoff: match['utcDate'] as string,
      status,
      score: status === 'finished' ? { home: fullTime.home, away: fullTime.away } : null,
    };
  });
  const tables = standingsBody['standings'] as Json[];
  const total = tables.find((t) => t['type'] === 'TOTAL');
  const rows: RawRow[] | null =
    total === undefined
      ? null
      : (total['table'] as Json[]).map((row) => ({
          position: row['position'] as number,
          team: (row['team'] as Json)['name'] as string,
          values: [
            row['playedGames'] as number,
            row['won'] as number,
            row['draw'] as number,
            row['lost'] as number,
            row['goalsFor'] as number,
            row['goalsAgainst'] as number,
            row['goalDifference'] as number,
            row['points'] as number,
          ],
        }));
  const filters = matchesBody['filters'] as Record<string, string>;
  return comparable(
    {
      competition: (matchesBody['competition'] as Json)['name'] as string,
      season: label,
      stage: first['stage'] as string,
      matchday: filters['matchday'] === undefined ? null : Number(filters['matchday']),
    },
    [...teamNames],
    mapped,
    rows,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Manual samples: CSV layouts, JSON pre-scan and the import error classes
// ---------------------------------------------------------------------------------------------------------------

export const MATCHES_LAYOUT = [
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

export const STANDINGS_LAYOUT = [
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

export const MAX_IMPORT_BYTES = 524288;
export const MAX_CSV_ROWS = 5000;
const PERSON_WORDS = [
  'player',
  'scorer',
  'goalscorer',
  'referee',
  'coach',
  'manager',
  'squad',
  'lineup',
  'assist',
  'card',
  'person',
];
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

export class SampleProblem extends Error {
  constructor(readonly problem: ImportProblem) {
    super(problem);
  }
}

/** RFC 4180 subset of section 1.6: comma separator, CRLF or LF, quoted fields with `""`, no line break in a field. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  let atFieldStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else if (c === '\n' || c === '\r') {
        throw new SampleProblem('parse_error');
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (c === ',') {
      record.push(field);
      field = '';
      atFieldStart = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      atFieldStart = true;
    } else {
      field += c;
      atFieldStart = false;
    }
  }
  if (quoted) {
    throw new SampleProblem('parse_error');
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

/** Linear pre-scan of JSON text: nesting deeper than 16 or a duplicate member name in one object (T11H-F08). */
export function jsonPrescanProblem(text: string): ImportProblem | null {
  const stack: (Set<string> | null)[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') {
          value += text.slice(j, j + 2);
          j += 2;
        } else {
          value += text[j];
          j += 1;
        }
      }
      let k = j + 1;
      while (k < text.length && /\s/.test(text[k] as string)) k += 1;
      const top = stack[stack.length - 1];
      if (text[k] === ':' && top instanceof Set) {
        if (top.has(value)) return 'parse_error';
        top.add(value);
      }
      i = j + 1;
      continue;
    }
    if (c === '{' || c === '[') {
      stack.push(c === '{' ? new Set<string>() : null);
      if (stack.length > 16) return 'parse_error';
    } else if (c === '}' || c === ']') {
      stack.pop();
    }
    i += 1;
  }
  return null;
}

/** Semantic checks of section 1.6 after the schema; the first problem found, or null. */
export function semanticProblem(
  document: ManualImportDocument,
  earlier: readonly ManualImportDocument[] = [],
): ImportProblem | null {
  for (const previous of earlier) {
    if (
      previous.competition.id === document.competition.id &&
      (previous.competition.name !== document.competition.name ||
        (previous.season.id === document.season.id && previous.season.label !== document.season.label))
    ) {
      return 'metadata_conflict';
    }
  }
  for (const selection of document.selections) {
    const keys = new Map<string, string>();
    for (const team of selection.teams) {
      if (keys.has(team.key)) return 'value_inconsistent';
      keys.set(team.key, team.name);
    }
    const identities = new Set<string>();
    for (const match of selection.matches) {
      if (!keys.has(match.home) || !keys.has(match.away)) return 'unknown_team';
      if (match.home === match.away) return 'value_inconsistent';
      const identity = `${match.home}\u0000${match.away}`;
      if (identities.has(identity)) return 'duplicate_match';
      identities.add(identity);
      if (match.status === 'finished' && match.score === null) return 'finished_without_score';
      if (match.status !== 'finished' && match.score !== null) return 'score_not_allowed';
    }
    if (selection.standings !== null) {
      const rows = selection.standings.rows;
      const positions = new Set(rows.map((row) => row.position));
      if (positions.size !== rows.length || rows.some((row) => row.position > rows.length)) return 'value_inconsistent';
      for (const row of rows) {
        if (!keys.has(row.team)) return 'unknown_team';
        if (row.won + row.drawn + row.lost !== row.played) return 'value_inconsistent';
        if (row.goalsFor - row.goalsAgainst !== row.goalDifference) return 'value_inconsistent';
      }
    }
  }
  return null;
}

function schemaProblem(raw: unknown): ImportProblem | null {
  const result = ManualImportDocumentSchema.safeParse(raw, { reportInput: true });
  if (result.success) {
    return null;
  }
  const issue = result.error.issues[0];
  if (issue === undefined) {
    return 'type_invalid';
  }
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.some((key) => PERSON_WORDS.some((word) => key.toLowerCase().includes(word)))
      ? 'person_field'
      : 'column_unknown';
  }
  if (issue.code === 'invalid_type') {
    return issue.input === undefined ? 'required_missing' : 'type_invalid';
  }
  if (issue.code === 'too_small' || issue.code === 'too_big') {
    return 'value_out_of_range';
  }
  return 'type_invalid';
}

/** Builds the import document of CSV files (one layout per file), with the deterministic team keys. */
export function documentFromCsv(files: readonly string[]): ManualImportDocument {
  type Selection = ManualImportDocument['selections'][number];
  let competition: ManualImportDocument['competition'] | null = null;
  let season: ManualImportDocument['season'] | null = null;
  const selections = new Map<string, Selection>();
  const teamsOf = new Map<string, Map<string, string>>();
  const int = (value: string): number => {
    if (!/^-?[0-9]{1,4}$/.test(value)) throw new SampleProblem('type_invalid');
    return Number(value);
  };
  for (const text of files) {
    const [header, ...rows] = parseCsv(text);
    const layout = header?.join(',') === MATCHES_LAYOUT.join(',') ? 'matches' : 'standings';
    for (const row of rows) {
      const get = (column: string): string => {
        const columns: readonly string[] = layout === 'matches' ? MATCHES_LAYOUT : STANDINGS_LAYOUT;
        return row[columns.indexOf(column)] ?? '';
      };
      if (get('competition_name') === '' || get('season_label') === '' || get('stage_name') === '') {
        throw new SampleProblem('metadata_missing');
      }
      competition ??= { id: get('competition_id'), name: get('competition_name'), areaName: null };
      season ??= { id: get('season_id'), label: get('season_label') };
      const matchday = get('matchday') === '' ? null : int(get('matchday'));
      const selectionId = `${get('stage_id')}/${String(matchday)}`;
      let selection = selections.get(selectionId);
      if (selection === undefined) {
        selection = {
          stage: { id: get('stage_id'), name: get('stage_name'), order: int(get('stage_order')) },
          matchday,
          teams: [],
          matches: [],
          standings: null,
        };
        selections.set(selectionId, selection);
        teamsOf.set(selectionId, new Map());
      }
      const teams = teamsOf.get(selectionId) as Map<string, string>;
      const key = (name: string): string => {
        const derived = teamKeyOf(name);
        const known = teams.get(derived);
        if (derived === '' || (known !== undefined && known !== name)) throw new SampleProblem('value_inconsistent');
        if (known === undefined) {
          teams.set(derived, name);
          selection.teams.push({ key: derived, name });
        }
        return derived;
      };
      if (layout === 'matches') {
        const hasScore = get('home_score') !== '' || get('away_score') !== '';
        selection.matches.push({
          home: key(get('home_team')),
          away: key(get('away_team')),
          kickoff: get('kickoff'),
          status: get('status') as Selection['matches'][number]['status'],
          score: hasScore ? { home: int(get('home_score')), away: int(get('away_score')) } : null,
        });
      } else {
        selection.standings ??= { asOf: get('as_of'), rows: [] };
        selection.standings.rows.push({
          position: int(get('position')),
          team: key(get('team')),
          played: int(get('played')),
          won: int(get('won')),
          drawn: int(get('drawn')),
          lost: int(get('lost')),
          goalsFor: int(get('goals_for')),
          goalsAgainst: int(get('goals_against')),
          goalDifference: int(get('goal_difference')),
          points: int(get('points')),
        });
      }
    }
  }
  if (competition === null || season === null) {
    throw new SampleProblem('metadata_missing');
  }
  return { format: 'edr-manual-import/1', competition, season, selections: [...selections.values()] };
}

/**
 * Classifies a manual sample: the first import error class it shows, in the order of section 1.6 (size, encoding,
 * parsing, header, row count, field rules, schema, semantic checks), or null when the sample is valid.
 */
export function manualSampleProblem(
  bytes: Uint8Array,
  channel: 'json_file' | 'csv_file' | 'form',
  earlier: readonly ManualImportDocument[] = [],
): ImportProblem | null {
  if (bytes.length > MAX_IMPORT_BYTES) return 'too_large';
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'encoding_invalid';
  }
  try {
    if (channel !== 'csv_file') {
      const prescan = jsonPrescanProblem(text);
      if (prescan !== null) return prescan;
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        return 'parse_error';
      }
      const document = channel === 'form' && isRecord(raw) ? raw['document'] : raw;
      return schemaProblem(document) ?? semanticProblem(document as ManualImportDocument, earlier);
    }
    const records = parseCsv(text);
    const header = records[0] ?? [];
    if (header.some((column) => PERSON_WORDS.some((word) => column.toLowerCase().includes(word))))
      return 'person_field';
    if (header.join(',') !== MATCHES_LAYOUT.join(',') && header.join(',') !== STANDINGS_LAYOUT.join(',')) {
      return 'header_invalid';
    }
    if (records.length - 1 > MAX_CSV_ROWS) return 'too_many_rows';
    if (records.some((record) => record.length !== header.length)) return 'header_invalid';
    if (records.some((record) => record.some((field) => CONTROL_OR_FORMAT.test(field) || field.length > 200))) {
      return 'type_invalid';
    }
    const document = documentFromCsv([text]);
    // A standings-only file carries no matches; the schema applies to the document once matches are present.
    const standingsOnly = header.join(',') === STANDINGS_LAYOUT.join(',');
    return (standingsOnly ? null : schemaProblem(document)) ?? semanticProblem(document, earlier);
  } catch (error) {
    if (error instanceof SampleProblem) return error.problem;
    throw error;
  }
}
