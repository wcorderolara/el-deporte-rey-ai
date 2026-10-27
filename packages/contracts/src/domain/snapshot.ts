/**
 * Normalized domain representation of one selection (`SelectionSnapshot`, `contracts/provider-ports.md` section 1.3;
 * R-059, R-267): the Team, Match and Standing concepts and the context items, with the structural checks of
 * section 1.3. Every adapter output passes this one schema before it is returned or cached.
 *
 * Objects are allow-lists: unknown keys are stripped (never stored, cached or forwarded); `parseDomain` counts them.
 * The schema has no field for persons (R-119). Lookups use `Set` and `Map` only, never plain objects (T11H-F07).
 */
import { z } from 'zod';

import { DataModeSchema, MatchStatusSchema, SourceIdSchema, UuidSchema } from '../http/primitives.js';
import { MatchdayNumberSchema } from './catalogue.js';
import {
  AttributionRefSchema,
  CountSchema,
  DomainDisplayNameSchema,
  DomainStageNameSchema,
  DomainTeamNameSchema,
  OffsetDateTimeSchema,
  SourceKeySchema,
} from './rules.js';

/** Array caps of a snapshot (bounds for adapter output; a whole league-style stage stays well inside them). */
export const SNAPSHOT_LIMITS = { teams: 512, aliases: 32, matches: 2000, standingRows: 512, context: 32 } as const;

/** A team as the source gives it (the Team concept). */
export const SnapshotTeamSchema = z.object({
  teamKey: SourceKeySchema,
  name: DomainTeamNameSchema,
  aliases: z.array(DomainTeamNameSchema).max(SNAPSHOT_LIMITS.aliases),
  ref: AttributionRefSchema,
});

export const ScoreSchema = z.object({ home: CountSchema, away: CountSchema });

/** A match with its provider-neutral status (the Match concept). */
export const SnapshotMatchSchema = z.object({
  matchKey: SourceKeySchema,
  homeTeamKey: SourceKeySchema,
  awayTeamKey: SourceKeySchema,
  /** ISO-8601 with an explicit offset. */
  kickoff: OffsetDateTimeSchema,
  status: MatchStatusSchema,
  /** Required when finished; null for every other status. Nothing is filled or derived (R-069, R-279). */
  score: ScoreSchema.nullable(),
  ref: AttributionRefSchema,
});

export const StandingRowSchema = z.object({
  position: z.int().min(1),
  teamKey: SourceKeySchema,
  played: CountSchema,
  won: CountSchema,
  drawn: CountSchema,
  lost: CountSchema,
  goalsFor: CountSchema,
  goalsAgainst: CountSchema,
  goalDifference: z.int(),
  points: z.int(),
  ref: AttributionRefSchema,
});

export const STANDINGS_UNAVAILABLE_REASONS = [
  'not_provided_for_stage',
  'not_provided_by_source',
  'not_available_with_subscription',
] as const;

/** Standings of the selection, or an explicit reason why they are not available (the Standing concept; R-254). */
export const SnapshotStandingsSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    asOf: OffsetDateTimeSchema,
    ref: AttributionRefSchema,
    rows: z.array(StandingRowSchema).max(SNAPSHOT_LIMITS.standingRows),
  }),
  z.object({ available: z.literal(false), reason: z.enum(STANDINGS_UNAVAILABLE_REASONS) }),
]);

export const SnapshotContextItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('matchday_of_total'),
    matchday: z.int().min(1),
    totalMatchdays: z.int().min(1),
    ref: AttributionRefSchema,
  }),
  z.object({ type: z.literal('teams_in_table'), count: CountSchema, ref: AttributionRefSchema }),
  z.object({ type: z.literal('matches_in_selection'), count: CountSchema, ref: AttributionRefSchema }),
]);

const snapshotObject = z.object({
  sourceId: SourceIdSchema,
  mode: DataModeSchema,
  retrievedAt: OffsetDateTimeSchema,
  fromCache: z.boolean(),
  /** `source:<sourceId>/<resourceKind>@<retrievedAt>`, `fixture:<scenario>/<file>` or `import:<importId>/v<n>`. */
  sourceRef: AttributionRefSchema,
  /** MANUAL_DATA only. */
  importVersionId: UuidSchema.nullable(),
  competition: z.object({ name: DomainDisplayNameSchema }),
  season: z.object({ label: DomainDisplayNameSchema }),
  stage: z.object({
    name: DomainStageNameSchema,
    matchday: MatchdayNumberSchema.nullable(),
    totalMatchdays: MatchdayNumberSchema.nullable(),
  }),
  teams: z.array(SnapshotTeamSchema).max(SNAPSHOT_LIMITS.teams),
  matches: z.array(SnapshotMatchSchema).max(SNAPSHOT_LIMITS.matches),
  standings: SnapshotStandingsSchema,
  context: z.array(SnapshotContextItemSchema).max(SNAPSHOT_LIMITS.context),
});

type SnapshotShape = z.infer<typeof snapshotObject>;

/** Structural checks of section 1.3; every message is fixed text, never an input value. */
function checkStructure(snapshot: SnapshotShape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: 'custom', path, message });
  };

  if (snapshot.mode === 'MANUAL_DATA' && snapshot.importVersionId === null) {
    issue(['importVersionId'], 'A MANUAL_DATA snapshot names its import version');
  }
  if (snapshot.mode !== 'MANUAL_DATA' && snapshot.importVersionId !== null) {
    issue(['importVersionId'], 'Only a MANUAL_DATA snapshot has an import version');
  }

  const teamKeys = new Set<string>();
  snapshot.teams.forEach((team, index) => {
    if (teamKeys.has(team.teamKey)) {
      issue(['teams', index, 'teamKey'], 'Duplicate team key');
    }
    teamKeys.add(team.teamKey);
  });

  const matchKeys = new Set<string>();
  snapshot.matches.forEach((match, index) => {
    if (matchKeys.has(match.matchKey)) {
      issue(['matches', index, 'matchKey'], 'Duplicate match key');
    }
    matchKeys.add(match.matchKey);
    if (!teamKeys.has(match.homeTeamKey)) {
      issue(['matches', index, 'homeTeamKey'], 'Unknown team key');
    }
    if (!teamKeys.has(match.awayTeamKey)) {
      issue(['matches', index, 'awayTeamKey'], 'Unknown team key');
    }
    if (match.homeTeamKey === match.awayTeamKey) {
      issue(['matches', index, 'awayTeamKey'], 'A team cannot play itself');
    }
    if (match.status === 'finished' && match.score === null) {
      issue(['matches', index, 'score'], 'A finished match requires a score');
    }
    if (match.status !== 'finished' && match.score !== null) {
      issue(['matches', index, 'score'], 'Only a finished match has a score');
    }
  });

  if (snapshot.standings.available) {
    const rows = snapshot.standings.rows;
    const rowTeams = new Set<string>();
    const positions = new Set<number>();
    rows.forEach((row, index) => {
      const path = ['standings', 'rows', index];
      if (!teamKeys.has(row.teamKey)) {
        issue([...path, 'teamKey'], 'Unknown team key');
      }
      if (rowTeams.has(row.teamKey)) {
        issue([...path, 'teamKey'], 'Duplicate team in standings');
      }
      rowTeams.add(row.teamKey);
      if (positions.has(row.position)) {
        issue([...path, 'position'], 'Duplicate position');
      }
      positions.add(row.position);
      if (row.position > rows.length) {
        issue([...path, 'position'], 'Positions must be contiguous from 1');
      }
      if (row.won + row.drawn + row.lost !== row.played) {
        issue([...path, 'played'], 'won + drawn + lost must equal played');
      }
      if (row.goalsFor - row.goalsAgainst !== row.goalDifference) {
        issue([...path, 'goalDifference'], 'goalsFor - goalsAgainst must equal goalDifference');
      }
    });
  }
}

/** The normalized selection snapshot with its structural checks. */
export const SelectionSnapshotSchema = snapshotObject.superRefine(checkStructure);

export type SnapshotTeam = z.infer<typeof SnapshotTeamSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type SnapshotMatch = z.infer<typeof SnapshotMatchSchema>;
export type StandingRow = z.infer<typeof StandingRowSchema>;
export type SnapshotStandings = z.infer<typeof SnapshotStandingsSchema>;
export type SnapshotContextItem = z.infer<typeof SnapshotContextItemSchema>;
export type SelectionSnapshot = z.infer<typeof SelectionSnapshotSchema>;
