/**
 * Content generation batches over locally managed sports data (PD-ARCH-01E-A; operations previewContentBatch,
 * createContentBatch, getContentBatch): the explicit selection model, the read-only plan the operator confirms and the
 * persisted batch with the real state of every piece. Each generated piece is one project of the existing workflow;
 * no provider structure appears here.
 */
import { z } from 'zod';

import { TemplateSchema } from './brand.js';
import { CompetitionMatchStatusSchema } from './competitions.js';
import {
  DateTimeSchema,
  DisplayNameSchema,
  LanguageSchema,
  StageNameSchema,
  TeamNameSchema,
  UuidSchema,
  uniquePrimitives,
} from './primitives.js';
import { FailureSchema } from './system.js';

/** Most matches one batch can select: a round of 32 matches has at most 64 teams, the bound of one frozen selection. */
export const CONTENT_BATCH_MAX_MATCHES = 32;

/**
 * Piece kinds. Results (01E-A): `round_results` is one carousel with every selected finished match of the round;
 * `match_result` is one piece per selected finished match. Matches not played yet (01E-B): `round_calendar` is one
 * calendar carousel of the round; `upcoming_matches` is one carousel of the selected pending matches;
 * `match_preview` is one preview piece per selected pending match.
 */
export const ContentPieceKindSchema = z.enum([
  'round_results',
  'match_result',
  'round_calendar',
  'upcoming_matches',
  'match_preview',
]);

/** Why a selected match cannot be shown as a result (`null/null` is unknown, never 0-0). */
export const ContentMatchIneligibilitySchema = z.enum([
  'not_finished',
  'score_missing',
  'kickoff_missing',
  'team_name_not_supported',
]);

/** Why a selected match cannot be part of a piece about matches not played yet (PD-ARCH-01E-B). */
export const ContentFixtureIneligibilitySchema = z.enum([
  'already_finished',
  'not_upcoming',
  'kickoff_missing',
  'team_name_not_supported',
]);

/** Why a planned piece is not generated. */
export const ContentPieceSkipReasonSchema = z.enum([
  'not_finished',
  'score_missing',
  'kickoff_missing',
  'team_name_not_supported',
  'no_eligible_matches',
  'context_not_supported',
  'not_upcoming',
  'already_finished',
]);

/** The explicit sports selection of a batch; the stage, when given, must be the round's stage. */
export const ContentBatchSelectionSchema = z.strictObject({
  competitionId: UuidSchema,
  seasonId: UuidSchema,
  stageId: UuidSchema.nullable(),
  roundId: UuidSchema,
  matchIds: uniquePrimitives(z.array(UuidSchema).min(1).max(CONTENT_BATCH_MAX_MATCHES)),
  kinds: uniquePrimitives(z.array(ContentPieceKindSchema).min(1).max(5)),
  language: LanguageSchema.optional(),
});

/** A confirmed selection; `requestKey` makes a retried confirmation return the same batch. */
export const ContentBatchCreateSchema = z.strictObject({
  requestKey: UuidSchema,
  selection: ContentBatchSelectionSchema,
});

export const ContentBatchContextSchema = z.strictObject({
  competitionId: UuidSchema,
  competitionName: DisplayNameSchema,
  seasonId: UuidSchema,
  seasonLabel: DisplayNameSchema,
  stageId: UuidSchema.nullable(),
  stageName: DisplayNameSchema.nullable(),
  roundId: UuidSchema,
  roundName: DisplayNameSchema,
});

/** A selected match with its current effective local values and eligibility. */
export const ContentBatchMatchSchema = z.strictObject({
  matchId: UuidSchema,
  homeTeamName: TeamNameSchema,
  awayTeamName: TeamNameSchema,
  kickoffAt: DateTimeSchema.nullable(),
  status: CompetitionMatchStatusSchema,
  homeScore: z.int().min(0).nullable(),
  awayScore: z.int().min(0).nullable(),
  /** Eligibility for results pieces (round results, individual result). */
  ineligibility: ContentMatchIneligibilitySchema.nullable(),
  /** Eligibility for the round calendar (PD-ARCH-01E-B). */
  calendarIneligibility: ContentFixtureIneligibilitySchema.nullable(),
  /** Eligibility for upcoming matches and match previews (PD-ARCH-01E-B). */
  upcomingIneligibility: ContentFixtureIneligibilitySchema.nullable(),
});

export const ContentPiecePlanSchema = z.strictObject({
  position: z.int().min(1),
  kind: ContentPieceKindSchema,
  title: z.string().min(1).max(200),
  /** The matches the piece shows (ready) or would have shown (skipped). */
  matchIds: z.array(UuidSchema).max(CONTENT_BATCH_MAX_MATCHES),
  status: z.enum(['ready', 'skipped']),
  skipReason: ContentPieceSkipReasonSchema.nullable(),
});

export const ContentBatchPreviewSchema = z.strictObject({
  context: ContentBatchContextSchema,
  /** The stage label every generated project and its slides show. */
  selectionLabel: StageNameSchema.nullable(),
  language: LanguageSchema,
  matches: z.array(ContentBatchMatchSchema).max(CONTENT_BATCH_MAX_MATCHES),
  /** Current templates of the results carousel every piece is rendered with. */
  templates: z.array(TemplateSchema),
  pieces: z.array(ContentPiecePlanSchema),
  totals: z.strictObject({ requested: z.int().min(0), ready: z.int().min(0), skipped: z.int().min(0) }),
});

/** `deleted`: the piece's project was deleted afterwards (PD-ARCH-01F); its identifiers stay for traceability. */
export const ContentBatchItemStatusSchema = z.enum(['skipped', 'pending', 'running', 'completed', 'failed', 'deleted']);

export const ContentBatchItemSchema = z.strictObject({
  id: UuidSchema,
  position: z.int().min(1),
  kind: ContentPieceKindSchema,
  title: z.string().min(1).max(200),
  matchIds: z.array(UuidSchema).max(CONTENT_BATCH_MAX_MATCHES),
  /** Derived from the latest run of the piece's project; `skipped` pieces have no project. */
  status: ContentBatchItemStatusSchema,
  skipReason: ContentPieceSkipReasonSchema.nullable(),
  failure: FailureSchema.nullable(),
  projectId: UuidSchema.nullable(),
  runId: UuidSchema.nullable(),
});

export const ContentBatchStateSchema = z.enum(['in_progress', 'completed', 'partial', 'failed']);

export const ContentBatchSchema = z.strictObject({
  id: UuidSchema,
  requestKey: UuidSchema,
  createdAt: DateTimeSchema,
  context: ContentBatchContextSchema,
  language: LanguageSchema,
  /** `in_progress` while any piece is pending or running; never reported complete before every run stopped. */
  state: ContentBatchStateSchema,
  totals: z.strictObject({
    requested: z.int().min(0),
    generated: z.int().min(0),
    failed: z.int().min(0),
    skipped: z.int().min(0),
    pending: z.int().min(0),
    deleted: z.int().min(0),
  }),
  items: z.array(ContentBatchItemSchema),
});

export const ContentBatchParamsSchema = z.strictObject({ batchId: UuidSchema });

/** The local sports context a project was generated from (null for projects created from the catalogue). */
export const ProjectSportsContextSchema = z.strictObject({
  batchId: UuidSchema,
  itemId: UuidSchema,
  kind: ContentPieceKindSchema,
  competitionId: UuidSchema,
  competitionName: DisplayNameSchema,
  seasonId: UuidSchema,
  seasonLabel: DisplayNameSchema,
  stageId: UuidSchema.nullable(),
  stageName: DisplayNameSchema.nullable(),
  roundId: UuidSchema,
  roundName: DisplayNameSchema,
  matchIds: z.array(UuidSchema).max(CONTENT_BATCH_MAX_MATCHES),
});

export type ContentPieceKind = z.infer<typeof ContentPieceKindSchema>;
export type ContentMatchIneligibility = z.infer<typeof ContentMatchIneligibilitySchema>;
export type ContentPieceSkipReason = z.infer<typeof ContentPieceSkipReasonSchema>;
export type ContentBatchSelection = z.infer<typeof ContentBatchSelectionSchema>;
export type ContentBatchCreate = z.infer<typeof ContentBatchCreateSchema>;
export type ContentBatchContext = z.infer<typeof ContentBatchContextSchema>;
export type ContentBatchMatch = z.infer<typeof ContentBatchMatchSchema>;
export type ContentPiecePlan = z.infer<typeof ContentPiecePlanSchema>;
export type ContentBatchPreview = z.infer<typeof ContentBatchPreviewSchema>;
export type ContentBatchItemStatus = z.infer<typeof ContentBatchItemStatusSchema>;
export type ContentBatchItem = z.infer<typeof ContentBatchItemSchema>;
export type ContentBatchState = z.infer<typeof ContentBatchStateSchema>;
export type ContentBatch = z.infer<typeof ContentBatchSchema>;
export type ProjectSportsContext = z.infer<typeof ProjectSportsContextSchema>;
