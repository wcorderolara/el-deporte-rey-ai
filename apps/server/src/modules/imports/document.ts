/**
 * The one import document (`ManualImportDocument`, format `edr-manual-import/1`; contracts/provider-ports.md section
 * 1.6; R-060, R-319): strict schema validation of the JSON-file and form channels, with every schema issue turned into
 * an import error, and the canonical serialization of form documents (T11H-F10).
 *
 * - The schema is the contract's strict schema: unknown members are errors, never stripped; a person-like member name
 *   is `person_field` and any other unknown member `column_unknown`, naming the member (R-119, R-280).
 * - Missing or empty competition, season and stage metadata is `metadata_missing` (R-064, R-276).
 * - Records are JSON pointers of schema member names and indexes; fields are member names; messages are fixed text.
 *   No member value is ever repeated (T11H-F12).
 */
import { type ManualImportDocument, ManualImportDocumentSchema, type ManualSelection } from '@edr/contracts';
import type { z } from 'zod';

import { type ImportErrorList, type ImportProblem, fieldName } from './errors.js';
import { isPersonField } from './person.js';

/** Every member name of the document schema; JSON pointers show any other name as `*`. */
export const DOCUMENT_MEMBER_NAMES: ReadonlySet<string> = new Set([
  'format',
  'competition',
  'id',
  'name',
  'areaName',
  'season',
  'label',
  'selections',
  'stage',
  'order',
  'matchday',
  'teams',
  'key',
  'matches',
  'home',
  'away',
  'kickoff',
  'status',
  'score',
  'standings',
  'asOf',
  'rows',
  'position',
  'team',
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'goalDifference',
  'points',
]);

/** A JSON pointer from a validation path: schema member names and indexes only, any other name as `*`. */
export function pointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return '/';
  }
  return path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `/${String(segment)}`;
      }
      return typeof segment === 'string' && DOCUMENT_MEMBER_NAMES.has(segment) ? `/${segment}` : '/*';
    })
    .join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the member named by `path` is absent from its parent object in the raw value. */
function isAbsent(raw: unknown, path: readonly PropertyKey[]): boolean {
  let current: unknown = raw;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (Array.isArray(current) && typeof segment === 'number') {
      current = segment < current.length ? (current[segment] as unknown) : undefined;
    } else if (isRecord(current) && typeof segment === 'string' && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return false;
    }
  }
  const last = path[path.length - 1];
  return isRecord(current) && typeof last === 'string' && !Object.hasOwn(current, last);
}

/** True for a competition, season or stage metadata path (R-064). */
function isMetadataPath(path: readonly PropertyKey[]): boolean {
  const [first, second, third, fourth] = path;
  if (first === 'competition' || first === 'season') {
    if (path.length === 1) {
      return true;
    }
    return path.length === 2 && (second === 'id' || second === 'name' || second === 'label');
  }
  if (first === 'selections' && typeof second === 'number' && third === 'stage') {
    return path.length === 3 || (path.length === 4 && (fourth === 'id' || fourth === 'name' || fourth === 'order'));
  }
  return false;
}

/** Splits a path into the record (pointer of the containing object or element) and the field (last member name). */
function recordAndField(path: readonly PropertyKey[]): { record: string; field: string | null } {
  const last = path[path.length - 1];
  if (typeof last === 'string') {
    return { record: pointer(path.slice(0, -1)), field: DOCUMENT_MEMBER_NAMES.has(last) ? last : '*' };
  }
  return { record: pointer(path), field: null };
}

const MESSAGES: Readonly<Record<ImportProblem, string>> = {
  parse_error: 'The content cannot be parsed',
  encoding_invalid: 'The content encoding is invalid',
  too_large: 'The content is too large',
  too_many_rows: 'The content has too many rows',
  header_invalid: 'The header is invalid',
  column_unknown: 'The member is not part of the import format',
  person_field: 'Person-level data is not accepted (team and competition data only)',
  required_missing: 'A required value is missing',
  type_invalid: 'The value has the wrong type or format',
  value_out_of_range: 'The value is outside the allowed range or values',
  value_inconsistent: 'The value is inconsistent',
  duplicate_match: 'The match appears twice',
  unknown_team: 'The team is not declared in the selection',
  metadata_missing: 'Competition, season or stage metadata is missing',
  metadata_conflict: 'The metadata conflicts with an earlier import',
  finished_without_score: 'A finished match needs a score',
  score_not_allowed: 'Only a finished match has a score',
};

/** Fixed message of a problem. */
export function messageOf(problem: ImportProblem): string {
  return MESSAGES[problem];
}

function problemOf(issue: z.core.$ZodIssue, raw: unknown): ImportProblem {
  const metadata = isMetadataPath(issue.path);
  switch (issue.code) {
    case 'invalid_type':
      if (isAbsent(raw, issue.path)) {
        return metadata ? 'metadata_missing' : 'required_missing';
      }
      return 'type_invalid';
    case 'too_small':
      if (issue.origin === 'array') {
        return 'required_missing';
      }
      if (issue.origin === 'string') {
        return metadata ? 'metadata_missing' : 'required_missing';
      }
      return 'value_out_of_range';
    case 'too_big':
      return 'value_out_of_range';
    case 'invalid_value':
      return issue.path.length === 1 && issue.path[0] === 'format' ? 'type_invalid' : 'value_out_of_range';
    default:
      return 'type_invalid';
  }
}

/**
 * Validates a raw document with the strict schema. Every issue becomes an import error; returns the parsed document,
 * or null when any issue was found.
 */
export function validateDocument(raw: unknown, errors: ImportErrorList): ManualImportDocument | null {
  const result = ManualImportDocumentSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  // One error per value: a value failing several checks (an empty name fails the length and the pattern) is reported
  // once, with its first issue. The key is built from schema names and indexes only.
  const reported = new Set<string>();
  for (const issue of result.error.issues) {
    if (issue.code !== 'unrecognized_keys') {
      const key = pointer(issue.path);
      if (reported.has(key)) {
        continue;
      }
      reported.add(key);
    }
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        const person = isPersonField(key);
        const problem: ImportProblem = person ? 'person_field' : 'column_unknown';
        errors.add(pointer(issue.path), fieldName(key), problem, messageOf(problem));
      }
      continue;
    }
    const problem = problemOf(issue, raw);
    const { record, field } = recordAndField(issue.path);
    errors.add(record, field, problem, messageOf(problem));
  }
  return null;
}

/** A selection rebuilt member by member in schema order. */
export function canonicalSelection(selection: ManualSelection): ManualSelection {
  return {
    stage: { id: selection.stage.id, name: selection.stage.name, order: selection.stage.order },
    matchday: selection.matchday,
    teams: selection.teams.map((team) => ({ key: team.key, name: team.name })),
    matches: selection.matches.map((match) => ({
      home: match.home,
      away: match.away,
      kickoff: match.kickoff,
      status: match.status,
      score: match.score === null ? null : { home: match.score.home, away: match.score.away },
    })),
    standings:
      selection.standings === null
        ? null
        : {
            asOf: selection.standings.asOf,
            rows: selection.standings.rows.map((row) => ({
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
          },
  };
}

/** The document rebuilt member by member in schema order. */
export function canonicalDocument(document: ManualImportDocument): ManualImportDocument {
  return {
    format: document.format,
    competition: {
      id: document.competition.id,
      name: document.competition.name,
      areaName: document.competition.areaName,
    },
    season: { id: document.season.id, label: document.season.label },
    selections: document.selections.map(canonicalSelection),
  };
}

/** Canonical UTF-8 JSON of a validated document: keys in schema order, no insignificant whitespace (T11H-F10). */
export function serializeCanonical(document: ManualImportDocument): Buffer {
  return Buffer.from(JSON.stringify(canonicalDocument(document)), 'utf8');
}
