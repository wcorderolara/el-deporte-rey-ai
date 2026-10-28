/**
 * Web-form channel of createImport (`ImportFormCreate`, R-057, R-319): the draft held by the form and the pure
 * function that turns it into a `ManualImportDocument` of one selection (a stage as a whole or one matchday), or
 * into the list of hints that keep it from being sent.
 *
 * - The hints mirror the contract shapes (`@edr/contracts` schemas) and the semantic rules of
 *   `contracts/provider-ports.md` section 1.6 (home differs from away, no duplicate match, a finished match needs a
 *   score and no other status carries one, standings positions contiguous, W + D + L = P, GF - GA = GD). They only
 *   spare a round trip; the server validates everything again and its errors are shown as given.
 * - Team keys are derived from the team names by the CSV rule of T11H-F09, so a form import and a CSV import of the
 *   same competition give the same keys. Nothing is derived for scores or standings (BR-14).
 * - There is no person-level field (R-119, PD-04).
 * - The document is built in schema key order, so its `JSON.stringify` form is the canonical serialization whose
 *   UTF-8 size is checked against 512 KiB before sending (T11H-F10).
 */
import {
  DisplayNameSchema,
  ImportFormCreateSchema,
  MANUAL_IMPORT_FORMAT,
  SlugSchema,
  StageNameSchema,
  TeamNameSchema,
  type ImportFormCreate,
  type ManualImportDocument,
  type ManualSelection,
  type MatchStatus,
} from '@edr/contracts';

import { formCopy, hintCopy } from './copy';
import { utf8ByteLength } from './encoding';
import { checkDeclaredSource, MAX_IMPORT_BYTES } from './fileImport';

export interface TeamDraft {
  uid: string;
  name: string;
}

export interface MatchDraft {
  uid: string;
  /** `uid` of the home team, or '' when none is chosen. */
  home: string;
  away: string;
  /** Value of a `datetime-local` input (local time of the browser). */
  kickoff: string;
  status: MatchStatus | '';
  homeScore: string;
  awayScore: string;
}

export const STANDING_NUMBER_FIELDS = [
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'goalDifference',
  'points',
] as const;

export type StandingNumberField = (typeof STANDING_NUMBER_FIELDS)[number];

export interface StandingDraft extends Record<StandingNumberField, string> {
  uid: string;
  position: string;
  /** `uid` of the team, or ''. */
  team: string;
}

export type SelectionScope = 'matchday' | 'stage';

export interface FormDraft {
  competitionId: string;
  competitionName: string;
  areaName: string;
  seasonId: string;
  seasonLabel: string;
  stageId: string;
  stageName: string;
  stageOrder: string;
  scope: SelectionScope;
  matchday: string;
  teams: TeamDraft[];
  matches: MatchDraft[];
  includeStandings: boolean;
  asOf: string;
  standings: StandingDraft[];
  declaredSource: string;
}

/** One hint: the field it belongs to (the suffix of the field's element ID), its label and the problem. */
export interface FormIssue {
  field: string;
  label: string;
  message: string;
}

export type FormCheck = { ok: true; body: ImportFormCreate } | { ok: false; issues: FormIssue[] };

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 64;
export const MIN_MATCHES = 1;
export const MAX_MATCHES = 64;
export const MAX_ROWS = 64;

// ---------------------------------------------------------------------------------------------------------------
// Field identifiers
// ---------------------------------------------------------------------------------------------------------------

/** Field identifiers of the rows; they use the row `uid`, so that they stay stable when a row is removed. */
export const fieldIds = {
  teamName: (uid: string): string => `team-${uid}-name`,
  match: (uid: string, field: 'home' | 'away' | 'kickoff' | 'status' | 'homeScore' | 'awayScore'): string =>
    `match-${uid}-${field}`,
  row: (uid: string, field: 'position' | 'team' | StandingNumberField): string => `row-${uid}-${field}`,
  addTeam: 'teams-add',
  addMatch: 'matches-add',
  addRow: 'rows-add',
  submit: 'submit',
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------------------------------------------

/**
 * Team key of a team name (T11H-F09, the exact CSV rule): NFC; NFD and removal of every combining mark;
 * `toLowerCase()`; each run of characters outside `[a-z0-9]` replaced by one `-`; leading and trailing `-` removed.
 * The result is a key only when it matches the contract `Slug` (checked by the caller).
 */
export function deriveTeamKey(name: string): string {
  return name
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True when the derived key is a contract `Slug`. */
export function isValidTeamKey(key: string): boolean {
  return SlugSchema.safeParse(key).success;
}

/** Integer within bounds from the text of a number input, or null. */
export function parseInteger(text: string, min: number, max: number): number | null {
  const trimmed = text.trim();
  if (!/^-?[0-9]{1,4}$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return value >= min && value <= max ? value : null;
}

const LOCAL_DATE_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$/;

/** ISO-8601 UTC time (`...Z`, without milliseconds) of a `datetime-local` value in the browser's time zone. */
export function localDateTimeToUtc(value: string): string | null {
  if (!LOCAL_DATE_TIME.test(value)) {
    return null;
  }
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return new Date(time).toISOString().replace(/\.[0-9]{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------------------------------------------

let uidCounter = 0;

/** A new row identifier, unique within the page. */
export function newUid(): string {
  uidCounter += 1;
  return `r${uidCounter}`;
}

export function emptyTeam(): TeamDraft {
  return { uid: newUid(), name: '' };
}

export function emptyMatch(): MatchDraft {
  return { uid: newUid(), home: '', away: '', kickoff: '', status: '', homeScore: '', awayScore: '' };
}

export function emptyStanding(): StandingDraft {
  return {
    uid: newUid(),
    position: '',
    team: '',
    played: '',
    won: '',
    drawn: '',
    lost: '',
    goalsFor: '',
    goalsAgainst: '',
    goalDifference: '',
    points: '',
  };
}

export function emptyDraft(): FormDraft {
  return {
    competitionId: '',
    competitionName: '',
    areaName: '',
    seasonId: '',
    seasonLabel: '',
    stageId: '',
    stageName: '',
    stageOrder: '1',
    scope: 'matchday',
    matchday: '',
    teams: [emptyTeam(), emptyTeam()],
    matches: [emptyMatch()],
    includeStandings: false,
    asOf: '',
    standings: [emptyStanding()],
    declaredSource: '',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------------------------

interface SchemaLike {
  safeParse(value: unknown): { success: boolean };
}

const standingNumberBounds: Record<StandingNumberField, [number, number]> = {
  played: [0, 999],
  won: [0, 999],
  drawn: [0, 999],
  lost: [0, 999],
  goalsFor: [0, 999],
  goalsAgainst: [0, 999],
  goalDifference: [-999, 999],
  points: [-999, 999],
};

const standingFieldLabel: Record<StandingNumberField, string> = {
  played: formCopy.played,
  won: formCopy.won,
  drawn: formCopy.drawn,
  lost: formCopy.lost,
  goalsFor: formCopy.goalsFor,
  goalsAgainst: formCopy.goalsAgainst,
  goalDifference: formCopy.goalDifference,
  points: formCopy.points,
};

/** Team keys by row `uid` (only valid, unique keys). Shared with the form, which shows each derived key. */
export function teamKeys(teams: readonly TeamDraft[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const team of teams) {
    const key = deriveTeamKey(team.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = new Map<string, string>();
  for (const team of teams) {
    const key = deriveTeamKey(team.name);
    if (isValidTeamKey(key) && counts.get(key) === 1 && TeamNameSchema.safeParse(team.name.trim()).success) {
      keys.set(team.uid, key);
    }
  }
  return keys;
}

/** Checks the draft and builds the createImport body of the form channel. */
export function buildFormImport(draft: FormDraft): FormCheck {
  const issues: FormIssue[] = [];
  const issue = (field: string, label: string, message: string) => issues.push({ field, label, message });

  function text(field: keyof FormDraft & string, label: string, schema: SchemaLike, message: string): string {
    const value = String(draft[field]).trim();
    if (value === '') {
      issue(field, label, hintCopy.required);
    } else if (!schema.safeParse(value).success) {
      issue(field, label, message);
    }
    return value;
  }

  // Competition, season, stage and scope.
  const competitionId = text('competitionId', formCopy.competitionId, SlugSchema, hintCopy.slug);
  const competitionName = text('competitionName', formCopy.competitionName, DisplayNameSchema, hintCopy.displayName);
  const areaNameText = draft.areaName.trim();
  if (areaNameText !== '' && !DisplayNameSchema.safeParse(areaNameText).success) {
    issue('areaName', formCopy.areaName, hintCopy.displayName);
  }
  const seasonId = text('seasonId', formCopy.seasonId, SlugSchema, hintCopy.slug);
  const seasonLabel = text('seasonLabel', formCopy.seasonLabel, DisplayNameSchema, hintCopy.displayName);
  const stageId = text('stageId', formCopy.stageId, SlugSchema, hintCopy.slug);
  const stageName = text('stageName', formCopy.stageName, StageNameSchema, hintCopy.stageName);
  const stageOrder = parseInteger(draft.stageOrder, 1, 99);
  if (stageOrder === null) {
    issue(
      'stageOrder',
      formCopy.stageOrder,
      draft.stageOrder.trim() === '' ? hintCopy.required : hintCopy.integer(1, 99),
    );
  }
  let matchday: number | null = null;
  if (draft.scope === 'matchday') {
    matchday = parseInteger(draft.matchday, 1, 999);
    if (matchday === null) {
      issue('matchday', formCopy.matchday, draft.matchday.trim() === '' ? hintCopy.required : hintCopy.integer(1, 999));
    }
  }

  // Teams and their derived keys.
  if (draft.teams.length < MIN_TEAMS || draft.teams.length > MAX_TEAMS) {
    issue(fieldIds.addTeam, formCopy.teamsLegend, hintCopy.teamsCount);
  }
  const derived = draft.teams.map((team) => deriveTeamKey(team.name));
  const keyCounts = new Map<string, number>();
  for (const key of derived) {
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  draft.teams.forEach((team, index) => {
    const label = formCopy.teamName(index + 1);
    const field = fieldIds.teamName(team.uid);
    const name = team.name.trim();
    const key = derived[index] ?? '';
    if (name === '') {
      issue(field, label, hintCopy.required);
    } else if (!TeamNameSchema.safeParse(name).success) {
      issue(field, label, hintCopy.teamName);
    } else if (!isValidTeamKey(key)) {
      issue(field, label, hintCopy.teamKeyInvalid);
    } else if ((keyCounts.get(key) ?? 0) > 1) {
      issue(field, label, hintCopy.teamKeyDuplicate(key));
    }
  });
  const keys = teamKeys(draft.teams);

  // Matches.
  if (draft.matches.length < MIN_MATCHES || draft.matches.length > MAX_MATCHES) {
    issue(fieldIds.addMatch, formCopy.matchesLegend, hintCopy.matchesCount);
  }
  const seenPairs = new Set<string>();
  const matches: ManualSelection['matches'] = [];
  draft.matches.forEach((match, index) => {
    const prefix = formCopy.matchLegend(index + 1);
    const home = keys.get(match.home);
    const away = keys.get(match.away);
    if (home === undefined) {
      issue(fieldIds.match(match.uid, 'home'), `${prefix}: ${formCopy.home}`, hintCopy.chooseTeam);
    }
    if (away === undefined) {
      issue(fieldIds.match(match.uid, 'away'), `${prefix}: ${formCopy.away}`, hintCopy.chooseTeam);
    }
    if (home !== undefined && away !== undefined) {
      if (home === away) {
        issue(fieldIds.match(match.uid, 'away'), `${prefix}: ${formCopy.away}`, hintCopy.sameTeams);
      } else if (seenPairs.has(`${home}\u0000${away}`)) {
        issue(fieldIds.match(match.uid, 'home'), `${prefix}: ${formCopy.home}`, hintCopy.duplicateMatch);
      }
      seenPairs.add(`${home}\u0000${away}`);
    }
    const kickoff = localDateTimeToUtc(match.kickoff);
    if (kickoff === null) {
      issue(
        fieldIds.match(match.uid, 'kickoff'),
        `${prefix}: ${formCopy.kickoff}`,
        match.kickoff === '' ? hintCopy.required : hintCopy.dateTime,
      );
    }
    if (match.status === '') {
      issue(fieldIds.match(match.uid, 'status'), `${prefix}: ${formCopy.status}`, hintCopy.statusRequired);
    }
    let score: { home: number; away: number } | null = null;
    if (match.status === 'finished') {
      const homeScore = parseInteger(match.homeScore, 0, 99);
      const awayScore = parseInteger(match.awayScore, 0, 99);
      if (homeScore === null) {
        issue(
          fieldIds.match(match.uid, 'homeScore'),
          `${prefix}: ${formCopy.homeScore}`,
          match.homeScore.trim() === '' ? hintCopy.scoreRequired : hintCopy.integer(0, 99),
        );
      }
      if (awayScore === null) {
        issue(
          fieldIds.match(match.uid, 'awayScore'),
          `${prefix}: ${formCopy.awayScore}`,
          match.awayScore.trim() === '' ? hintCopy.scoreRequired : hintCopy.integer(0, 99),
        );
      }
      if (homeScore !== null && awayScore !== null) {
        score = { home: homeScore, away: awayScore };
      }
    }
    if (home !== undefined && away !== undefined && kickoff !== null && match.status !== '') {
      matches.push({ home, away, kickoff, status: match.status, score });
    }
  });

  // Standings (optional, OD-18).
  let standings: ManualSelection['standings'] = null;
  if (draft.includeStandings) {
    const asOf = localDateTimeToUtc(draft.asOf);
    if (asOf === null) {
      issue('asOf', formCopy.asOf, draft.asOf === '' ? hintCopy.required : hintCopy.dateTime);
    }
    if (draft.standings.length < 1 || draft.standings.length > MAX_ROWS) {
      issue(fieldIds.addRow, formCopy.standingsLegend, hintCopy.rowsCount);
    }
    const rowCount = draft.standings.length;
    const positions = draft.standings.map((row) => parseInteger(row.position, 1, MAX_ROWS));
    const positionCounts = new Map<number, number>();
    for (const position of positions) {
      if (position !== null) {
        positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1);
      }
    }
    const rows: NonNullable<ManualSelection['standings']>['rows'] = [];
    draft.standings.forEach((row, index) => {
      const prefix = formCopy.rowLegend(index + 1);
      const position = positions[index] ?? null;
      if (position === null) {
        issue(
          fieldIds.row(row.uid, 'position'),
          `${prefix}: ${formCopy.position}`,
          row.position.trim() === '' ? hintCopy.required : hintCopy.integer(1, MAX_ROWS),
        );
      } else if ((positionCounts.get(position) ?? 0) > 1 || position > rowCount) {
        issue(fieldIds.row(row.uid, 'position'), `${prefix}: ${formCopy.position}`, hintCopy.positions);
      }
      const team = keys.get(row.team);
      if (team === undefined) {
        issue(fieldIds.row(row.uid, 'team'), `${prefix}: ${formCopy.team}`, hintCopy.chooseTeam);
      }
      const numbers: Partial<Record<StandingNumberField, number>> = {};
      for (const field of STANDING_NUMBER_FIELDS) {
        const [min, max] = standingNumberBounds[field];
        const value = parseInteger(row[field], min, max);
        if (value === null) {
          issue(
            fieldIds.row(row.uid, field),
            `${prefix}: ${standingFieldLabel[field]}`,
            row[field].trim() === '' ? hintCopy.required : hintCopy.integer(min, max),
          );
        } else {
          numbers[field] = value;
        }
      }
      const { played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points } = numbers;
      if (played !== undefined && won !== undefined && drawn !== undefined && lost !== undefined) {
        if (won + drawn + lost !== played) {
          issue(fieldIds.row(row.uid, 'played'), `${prefix}: ${formCopy.played}`, hintCopy.results);
        }
      }
      if (goalsFor !== undefined && goalsAgainst !== undefined && goalDifference !== undefined) {
        if (goalsFor - goalsAgainst !== goalDifference) {
          issue(
            fieldIds.row(row.uid, 'goalDifference'),
            `${prefix}: ${formCopy.goalDifference}`,
            hintCopy.goalDifference,
          );
        }
      }
      if (
        position !== null &&
        team !== undefined &&
        played !== undefined &&
        won !== undefined &&
        drawn !== undefined &&
        lost !== undefined &&
        goalsFor !== undefined &&
        goalsAgainst !== undefined &&
        goalDifference !== undefined &&
        points !== undefined
      ) {
        rows.push({ position, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points });
      }
    });
    if (asOf !== null) {
      standings = { asOf, rows };
    }
  }

  const source = checkDeclaredSource(draft.declaredSource);
  if (!source.ok) {
    issue('declaredSource', formCopy.sourceField, source.error);
  }

  if (issues.length > 0 || stageOrder === null || !source.ok) {
    return { ok: false, issues };
  }

  const teams: ManualSelection['teams'] = draft.teams.map((team) => ({
    key: keys.get(team.uid) ?? '',
    name: team.name.trim(),
  }));
  const document: ManualImportDocument = {
    format: MANUAL_IMPORT_FORMAT,
    competition: { id: competitionId, name: competitionName, areaName: areaNameText === '' ? null : areaNameText },
    season: { id: seasonId, label: seasonLabel },
    selections: [
      {
        stage: { id: stageId, name: stageName, order: stageOrder },
        matchday,
        teams,
        matches,
        standings,
      },
    ],
  };
  const body: ImportFormCreate = { channel: 'form', declaredSource: source.value, document };
  if (!ImportFormCreateSchema.safeParse(body).success) {
    return { ok: false, issues: [{ field: fieldIds.submit, label: formCopy.submit, message: hintCopy.format }] };
  }
  // T11H-F10: the canonical serialization of the document must fit in 512 KiB.
  if (utf8ByteLength(JSON.stringify(document)) > MAX_IMPORT_BYTES) {
    return { ok: false, issues: [{ field: fieldIds.submit, label: formCopy.submit, message: hintCopy.tooLarge }] };
  }
  return { ok: true, body };
}
