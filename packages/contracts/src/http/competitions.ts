/** Locally managed competition foundation, separate from provider catalogue identifiers and manual import records. */
import { z } from 'zod';

import { ContractPatterns, DateTimeSchema, DisplayNameSchema, TeamNameSchema, UuidSchema, SourceIdSchema } from './primitives.js';

export const ManagedCompetitionCreateSchema = z.strictObject({ name: DisplayNameSchema });
export const ManagedCompetitionSchema = z.strictObject({
  id: UuidSchema,
  name: DisplayNameSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export const ManagedCompetitionListResponseSchema = z.strictObject({ competitions: z.array(ManagedCompetitionSchema) });
export const ManagedCompetitionParamsSchema = z.strictObject({ competitionId: UuidSchema });

export type ManagedCompetitionCreate = z.infer<typeof ManagedCompetitionCreateSchema>;
export type ManagedCompetition = z.infer<typeof ManagedCompetitionSchema>;

/** Stable adapter identity; configured credentials and source instance details remain server-only. */
export const SportsProviderSchema = z.strictObject({
  key: SourceIdSchema,
  name: DisplayNameSchema,
  capabilities: z.strictObject({ competitionCatalogue: z.boolean(), seasons: z.boolean(), stages: z.boolean() }),
  availability: z.enum(['available', 'not_configured', 'disabled', 'ambiguous']),
  availabilityMessage: DisplayNameSchema.nullable(),
});
export const SportsProviderListResponseSchema = z.strictObject({ providers: z.array(SportsProviderSchema) });
export const SportsProviderParamsSchema = z.strictObject({ providerKey: SourceIdSchema });
export const ExternalCompetitionSchema = z.strictObject({
  externalCompetitionId: z.string().min(1).max(120),
  name: DisplayNameSchema,
  areaName: DisplayNameSchema.nullable(),
});
export const ExternalCompetitionListResponseSchema = z.strictObject({ competitions: z.array(ExternalCompetitionSchema) });
export const CompetitionProviderBindingParamsSchema = ManagedCompetitionParamsSchema;
export const CompetitionProviderBindingCreateSchema = z.strictObject({
  providerKey: SourceIdSchema,
  externalCompetitionId: z.string().min(1).max(120),
  mode: z.enum(['provider', 'hybrid']),
  replaceExisting: z.boolean().optional(),
});
export const CompetitionProviderBindingSchema = z.strictObject({
  id: UuidSchema,
  competitionId: UuidSchema,
  providerKey: SourceIdSchema,
  providerName: DisplayNameSchema,
  externalCompetitionId: z.string().min(1).max(120),
  externalCompetitionName: DisplayNameSchema,
  mode: z.enum(['provider', 'hybrid']),
  status: z.enum(['active', 'replaced', 'unlinked']),
  linkedAt: DateTimeSchema,
  unlinkedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export const CompetitionProviderBindingResponseSchema = z.strictObject({ binding: CompetitionProviderBindingSchema.nullable() });
export type SportsProvider = z.infer<typeof SportsProviderSchema>;
export type ExternalCompetition = z.infer<typeof ExternalCompetitionSchema>;
export type CompetitionProviderBinding = z.infer<typeof CompetitionProviderBindingSchema>;
export type CompetitionProviderBindingCreate = z.infer<typeof CompetitionProviderBindingCreateSchema>;

export const ExternalSeasonIdSchema = z.string().min(1).max(120).regex(new RegExp(ContractPatterns.ExternalSeasonId, 'u'));
export const ImportResourceSchema = z.enum([
  'season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results',
]);
export const ExternalSeasonOptionSchema = z.strictObject({
  externalSeasonId: z.string().min(1).max(120),
  label: DisplayNameSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  current: z.boolean(),
  localCandidates: z.array(z.strictObject({ id: UuidSchema, label: DisplayNameSchema })).max(20),
});
export const ExternalSeasonListResponseSchema = z.strictObject({ seasons: z.array(ExternalSeasonOptionSchema) });
export const ImportResourceCapabilitySchema = z.strictObject({
  resource: ImportResourceSchema,
  available: z.boolean(),
  reason: z.string().max(240).nullable(),
});
export const ImportCapabilitiesResponseSchema = z.strictObject({ capabilities: z.array(ImportResourceCapabilitySchema) });
export const ImportPreviewCreateSchema = z.strictObject({
  externalSeasonId: z.string().min(1).max(120),
  destinationSeasonId: UuidSchema.nullable().optional(),
  resources: z.array(ImportResourceSchema).min(1).max(7).refine((items) => new Set(items).size === items.length),
});
const ImportValueSchema = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
export const ImportExternalReferenceSchema = z.strictObject({
  role: z.enum(['season', 'team', 'home_team', 'away_team', 'stage', 'round', 'match']),
  externalId: z.string().min(1).max(200),
  externalScope: z.string().max(200).nullable(),
});
export const ImportPreviewWarningSchema = z.strictObject({
  code: z.string().min(1).max(80),
  severity: z.enum(['info', 'warning', 'error', 'conflict']),
  message: z.string().min(1).max(240),
  occurrenceCount: z.number().int().positive(),
  affectedExternalIds: z.array(z.string().min(1).max(200)).max(500),
});
export const ImportPreviewItemSchema = z.strictObject({
  resource: ImportResourceSchema,
  externalId: z.string().min(1).max(200),
  externalScope: z.string().max(200).nullable(),
  title: DisplayNameSchema,
  operation: z.enum(['new', 'changed', 'unchanged', 'conflict', 'invalid', 'skipped']),
  localCandidate: z.strictObject({ id: UuidSchema, label: DisplayNameSchema }).nullable(),
  relationships: z.array(ImportExternalReferenceSchema).max(10),
  fields: z.array(z.strictObject({
    name: z.string().min(1).max(80),
    localValue: ImportValueSchema,
    incomingValue: ImportValueSchema,
    baselineValue: ImportValueSchema,
    protected: z.boolean(),
  })).max(40),
  warnings: z.array(z.string().min(1).max(240)).max(20),
});
export const ImportPreviewSummarySchema = z.strictObject({
  new: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export const ImportPreviewSchema = z.strictObject({
  previewId: UuidSchema,
  competitionId: UuidSchema,
  providerKey: SourceIdSchema,
  providerName: DisplayNameSchema,
  externalCompetitionName: DisplayNameSchema,
  externalSeasonId: z.string().min(1).max(120),
  externalSeasonLabel: DisplayNameSchema,
  destinationSeasonId: UuidSchema.nullable(),
  retrievedAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  localFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  stale: z.boolean(),
  resources: z.array(ImportResourceSchema),
  summary: ImportPreviewSummarySchema,
  capabilities: z.array(ImportResourceCapabilitySchema),
  warnings: z.array(ImportPreviewWarningSchema).max(100),
  items: z.array(ImportPreviewItemSchema).max(10000),
});
export const ImportExternalSeasonsParamsSchema = ManagedCompetitionParamsSchema;
export const ImportSeasonCapabilitiesParamsSchema = z.strictObject({ competitionId: UuidSchema, externalSeasonId: ExternalSeasonIdSchema });
export const ImportPreviewParamsSchema = z.strictObject({ competitionId: UuidSchema, previewId: UuidSchema });
export const ImportPreviewResponseSchema = z.strictObject({ preview: ImportPreviewSchema });
export type ImportResource = z.infer<typeof ImportResourceSchema>;
export type ImportPreviewCreate = z.infer<typeof ImportPreviewCreateSchema>;
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;
export type ImportPreviewItem = z.infer<typeof ImportPreviewItemSchema>;
export type ExternalSeasonOption = z.infer<typeof ExternalSeasonOptionSchema>;
export type ImportResourceCapability = z.infer<typeof ImportResourceCapabilitySchema>;

/** Locally managed season; the label preserves operator formatting (for example `2026/27` or `2027`). */
export const ManagedSeasonCreateSchema = z.strictObject({ label: DisplayNameSchema });
export const ManagedSeasonUpdateSchema = z.strictObject({ label: DisplayNameSchema });
export const ManagedSeasonSchema = z.strictObject({
  id: UuidSchema,
  competitionId: UuidSchema,
  label: DisplayNameSchema,
  createdAt: DateTimeSchema,
});
export const ManagedSeasonListResponseSchema = z.strictObject({ seasons: z.array(ManagedSeasonSchema) });

/** A global local team identity; provider-specific IDs are intentionally absent. */
export const ManagedTeamCreateSchema = z.strictObject({
  name: TeamNameSchema,
  region: DisplayNameSchema.nullable().optional(),
});
export const ManagedTeamUpdateSchema = z.strictObject({
  name: TeamNameSchema,
  region: DisplayNameSchema.nullable(),
});
export const ManagedTeamSchema = z.strictObject({
  id: UuidSchema,
  name: TeamNameSchema,
  region: DisplayNameSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export const ManagedTeamListResponseSchema = z.strictObject({ teams: z.array(ManagedTeamSchema) });

/** Links one reusable global Team identity to a competition. */
export const CompetitionTeamSchema = z.strictObject({ team: ManagedTeamSchema, associatedAt: DateTimeSchema });
export const CompetitionTeamListResponseSchema = z.strictObject({ teams: z.array(CompetitionTeamSchema) });
export const CompetitionTeamAddSchema = z.union([
  z.strictObject({ teamId: UuidSchema }),
  ManagedTeamCreateSchema,
]);
export const CompetitionTeamsParamsSchema = z.strictObject({ competitionId: UuidSchema });
export const CompetitionTeamParamsSchema = z.strictObject({ competitionId: UuidSchema, teamId: UuidSchema });
export const SeasonParticipantBatchCreateSchema = z.strictObject({
  teamIds: z.array(UuidSchema).min(1).max(100).refine(ids => new Set(ids).size === ids.length, 'Team ids must be unique.'),
});

/** Season membership is identified by the unique season/team pair, not by an extra artificial entity ID. */
export const SeasonParticipantSchema = z.strictObject({
  team: ManagedTeamSchema,
  joinedAt: DateTimeSchema,
});
export const SeasonParticipantListResponseSchema = z.strictObject({
  participants: z.array(SeasonParticipantSchema),
});
export const SeasonParticipantCreateSchema = z.strictObject({ teamId: UuidSchema });

export const ManagedSeasonParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema });
export const ManagedTeamParamsSchema = z.strictObject({ teamId: UuidSchema });
export const SeasonParticipantsParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema });
export const SeasonParticipantParamsSchema = z.strictObject({
  competitionId: UuidSchema,
  seasonId: UuidSchema,
  teamId: UuidSchema,
});

export type ManagedSeasonCreate = z.infer<typeof ManagedSeasonCreateSchema>;
export type ManagedSeasonUpdate = z.infer<typeof ManagedSeasonUpdateSchema>;
export type ManagedSeason = z.infer<typeof ManagedSeasonSchema>;
export type ManagedTeamCreate = z.infer<typeof ManagedTeamCreateSchema>;
export type ManagedTeamUpdate = z.infer<typeof ManagedTeamUpdateSchema>;
export type ManagedTeam = z.infer<typeof ManagedTeamSchema>;
export type CompetitionTeam = z.infer<typeof CompetitionTeamSchema>;
export type CompetitionTeamAdd = z.infer<typeof CompetitionTeamAddSchema>;
export type SeasonParticipant = z.infer<typeof SeasonParticipantSchema>;
export type SeasonParticipantCreate = z.infer<typeof SeasonParticipantCreateSchema>;
export type SeasonParticipantBatchCreate = z.infer<typeof SeasonParticipantBatchCreateSchema>;

/** Optional phase and round hierarchy for flexible seasonal calendars. */
export const CompetitionStageCreateSchema = z.strictObject({
  name: DisplayNameSchema,
  displayOrder: z.int().min(0).optional(),
});
export const CompetitionCalendarNameUpdateSchema = z.strictObject({ name: DisplayNameSchema });
export const CompetitionRoundUpdateSchema = z.strictObject({
  name: DisplayNameSchema.optional(),
  stageId: UuidSchema.nullable().optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide a round name or phase.');
export const CompetitionStageSchema = z.strictObject({
  id: UuidSchema,
  seasonId: UuidSchema,
  name: DisplayNameSchema,
  displayOrder: z.int().min(0),
  createdAt: DateTimeSchema,
});
export const CompetitionStageListResponseSchema = z.strictObject({ stages: z.array(CompetitionStageSchema) });
export const CompetitionRoundCreateSchema = z.strictObject({
  name: DisplayNameSchema,
  displayOrder: z.int().min(0).optional(),
});
export const CompetitionRoundSchema = z.strictObject({
  id: UuidSchema,
  seasonId: UuidSchema,
  stageId: UuidSchema.nullable(),
  name: DisplayNameSchema,
  displayOrder: z.int().min(0),
  createdAt: DateTimeSchema,
});
export const CompetitionRoundListResponseSchema = z.strictObject({ rounds: z.array(CompetitionRoundSchema) });

export const CompetitionMatchStatusSchema = z.enum(['scheduled', 'in_progress', 'finished', 'postponed', 'cancelled']);
export const CompetitionMatchCreateSchema = z.strictObject({
  homeTeamId: UuidSchema,
  awayTeamId: UuidSchema,
  kickoffAt: DateTimeSchema.nullable().optional(),
  stageId: UuidSchema.nullable().optional(),
  roundId: UuidSchema.nullable().optional(),
});
export const CompetitionMatchScheduleUpdateSchema = z
  .strictObject({
    kickoffAt: DateTimeSchema.nullable().optional(),
    stageId: UuidSchema.nullable().optional(),
    roundId: UuidSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one schedule field.');
export const CompetitionMatchResultUpdateSchema = z.strictObject({
  status: CompetitionMatchStatusSchema,
  homeScore: z.int().min(0).nullable().optional(),
  awayScore: z.int().min(0).nullable().optional(),
});
export const CompetitionMatchSchema = z.strictObject({
  id: UuidSchema,
  seasonId: UuidSchema,
  stage: z.strictObject({ id: UuidSchema, name: DisplayNameSchema }).nullable(),
  round: z.strictObject({ id: UuidSchema, name: DisplayNameSchema }).nullable(),
  homeTeam: ManagedTeamSchema,
  awayTeam: ManagedTeamSchema,
  kickoffAt: DateTimeSchema.nullable(),
  status: CompetitionMatchStatusSchema,
  homeScore: z.int().min(0).nullable(),
  awayScore: z.int().min(0).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export const CompetitionMatchListResponseSchema = z.strictObject({ matches: z.array(CompetitionMatchSchema) });
export const MatchResultHistorySchema = z.strictObject({
  id: UuidSchema,
  matchId: UuidSchema,
  changeType: z.enum(['created', 'schedule_updated', 'status_updated', 'result_recorded', 'result_corrected']),
  stageId: UuidSchema.nullable(),
  roundId: UuidSchema.nullable(),
  status: CompetitionMatchStatusSchema,
  homeScore: z.int().min(0).nullable(),
  awayScore: z.int().min(0).nullable(),
  kickoffAt: DateTimeSchema.nullable(),
  recordedAt: DateTimeSchema,
});
export const MatchResultHistoryListResponseSchema = z.strictObject({ history: z.array(MatchResultHistorySchema) });

export const CompetitionStageParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema, stageId: UuidSchema });
export const CompetitionRoundsParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema });
export const CompetitionRoundParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema, roundId: UuidSchema });
export const CompetitionStageRoundsParamsSchema = CompetitionStageParamsSchema;
export const CompetitionMatchParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema, matchId: UuidSchema });
export const CompetitionMatchesParamsSchema = z.strictObject({ competitionId: UuidSchema, seasonId: UuidSchema });

export type CompetitionStage = z.infer<typeof CompetitionStageSchema>;
export type CompetitionStageCreate = z.infer<typeof CompetitionStageCreateSchema>;
export type CompetitionCalendarNameUpdate = z.infer<typeof CompetitionCalendarNameUpdateSchema>;
export type CompetitionRoundUpdate = z.infer<typeof CompetitionRoundUpdateSchema>;
export type CompetitionRound = z.infer<typeof CompetitionRoundSchema>;
export type CompetitionRoundCreate = z.infer<typeof CompetitionRoundCreateSchema>;
export type CompetitionMatch = z.infer<typeof CompetitionMatchSchema>;
export type CompetitionMatchCreate = z.infer<typeof CompetitionMatchCreateSchema>;
export type CompetitionMatchScheduleUpdate = z.infer<typeof CompetitionMatchScheduleUpdateSchema>;
export type CompetitionMatchResultUpdate = z.infer<typeof CompetitionMatchResultUpdateSchema>;
export type MatchResultHistory = z.infer<typeof MatchResultHistorySchema>;

export const ImportOperationStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export const ImportOperationStageSchema = z.enum(['fetching', 'normalizing', 'comparing', 'preparing_preview']);
export const ImportOperationSchema = z.strictObject({
  operationId: UuidSchema,
  competitionId: UuidSchema,
  providerKey: z.string().min(1).max(40),
  externalSeasonId: z.string().min(1).max(120),
  destinationSeasonId: UuidSchema.nullable(),
  resources: z.array(ImportResourceSchema).min(1).max(7),
  status: ImportOperationStatusSchema,
  currentStage: ImportOperationStageSchema.nullable(),
  completedStages: z.array(ImportOperationStageSchema).max(4),
  cancellationRequested: z.boolean(),
  previewId: UuidSchema.nullable(),
  errorCode: z.string().max(80).nullable(),
  errorMessage: z.string().max(240).nullable(),
  createdAt: z.iso.datetime(), startedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(), completedAt: z.iso.datetime().nullable(),
});
export const ImportOperationResponseSchema = z.strictObject({ operation: ImportOperationSchema });
export const ImportOperationStartResponseSchema = z.strictObject({
  operation: ImportOperationSchema,
  statusUrl: z.string().startsWith('/api/v1/competitions/'),
  eventsUrl: z.string().startsWith('/api/v1/competitions/'),
});
export const ImportOperationParamsSchema = z.strictObject({ competitionId: UuidSchema, operationId: UuidSchema });
export const ImportOperationEventSchema = z.strictObject({
  id: z.number().int().positive(), type: z.enum(['operation.queued','operation.started','stage.started','stage.completed','operation.completed','operation.failed','operation.cancelled']),
  operationId: UuidSchema, status: ImportOperationStatusSchema, stage: ImportOperationStageSchema.nullable(),
  previewId: UuidSchema.nullable(), timestamp: z.iso.datetime(),
});
export type ImportOperation = z.infer<typeof ImportOperationSchema>;
export type ImportOperationEvent = z.infer<typeof ImportOperationEventSchema>;

/** PD-ARCH-01D-D field provenance. Effective values stay in the sports entity contracts. */
export const SportsEntityTypeSchema = z.enum(['season', 'team', 'stage', 'round', 'match', 'result']);
export const SportsFieldProvenanceParamsSchema = z.strictObject({
  competitionId: UuidSchema,
  entityType: SportsEntityTypeSchema,
  entityId: UuidSchema,
});
export const SportsFieldProvenanceSchema = z.strictObject({
  field: z.string().min(1).max(80),
  origin: z.enum(['manual', 'provider', 'manual_override']),
  providerKey: z.string().min(1).max(64).nullable(),
  externalReference: z.string().min(1).max(200).nullable(),
  providerValue: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional(),
  protected: z.boolean(),
  lastApplicationId: UuidSchema.nullable(),
  updatedAt: DateTimeSchema,
});
export const SportsFieldProvenanceResponseSchema = z.strictObject({
  fields: z.array(SportsFieldProvenanceSchema).max(50),
});
export type SportsFieldProvenance = z.infer<typeof SportsFieldProvenanceSchema>;

/**
 * PD-ARCH-01D-C confirmed application. The plan is derived only from the stored preview snapshot plus current local
 * data and mappings; it never contacts the provider. Identities are never inferred from names: a possible duplicate
 * needs an explicit `link` (to a listed candidate) or `skip` decision.
 */
export const ImportApplyActionSchema = z.enum(['link', 'skip', 'accept_incoming']);
export const ImportApplyDecisionSchema = z.strictObject({
  resource: ImportResourceSchema,
  externalId: z.string().min(1).max(200),
  externalScope: z.string().max(200).nullable(),
  action: ImportApplyActionSchema,
  localId: UuidSchema.nullable(),
});
const ImportApplyDecisionListSchema = z.array(ImportApplyDecisionSchema).max(2000);
export const ImportApplyPlanRequestSchema = z.strictObject({ decisions: ImportApplyDecisionListSchema });
export const ImportApplyStartSchema = z.strictObject({
  decisions: ImportApplyDecisionListSchema,
  planHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export const ImportApplyCountsSchema = z.strictObject({
  seasonsCreated: z.number().int().nonnegative(),
  teamsCreated: z.number().int().nonnegative(),
  teamsReused: z.number().int().nonnegative(),
  associationsCreated: z.number().int().nonnegative(),
  participantsCreated: z.number().int().nonnegative(),
  stagesCreated: z.number().int().nonnegative(),
  roundsCreated: z.number().int().nonnegative(),
  matchesCreated: z.number().int().nonnegative(),
  matchesUpdated: z.number().int().nonnegative(),
  resultsApplied: z.number().int().nonnegative(),
  mappingsCreated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  conflictsNotApplied: z.number().int().nonnegative(),
});
export const ImportApplyPlanActionSchema = z.enum([
  'create', 'link', 'reuse', 'update', 'unchanged', 'keep_local', 'skip', 'blocked',
]);
const ImportApplyValueSchema = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
export const ImportApplyPlanItemSchema = z.strictObject({
  resource: ImportResourceSchema,
  externalId: z.string().min(1).max(200),
  externalScope: z.string().max(200).nullable(),
  title: DisplayNameSchema,
  action: ImportApplyPlanActionSchema,
  reason: z.string().max(240).nullable(),
  localId: UuidSchema.nullable(),
  localLabel: z.string().max(160).nullable(),
  candidates: z.array(z.strictObject({ id: UuidSchema, label: z.string().min(1).max(160) })).max(20),
  options: z.array(ImportApplyActionSchema).max(3),
  decision: ImportApplyActionSchema.nullable(),
  changes: z.array(z.strictObject({
    field: z.string().min(1).max(80),
    localValue: ImportApplyValueSchema,
    incomingValue: ImportApplyValueSchema,
    applied: z.boolean(),
  })).max(10),
});
export const ImportApplyBlockerSchema = z.strictObject({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(240),
  count: z.number().int().positive(),
});
export const ImportApplyPlanSchema = z.strictObject({
  previewId: UuidSchema,
  competitionId: UuidSchema,
  providerName: DisplayNameSchema,
  externalCompetitionName: DisplayNameSchema,
  externalSeasonLabel: DisplayNameSchema,
  destinationSeasonId: UuidSchema.nullable(),
  destinationLabel: z.string().min(1).max(160),
  destinationIsNew: z.boolean(),
  expiresAt: DateTimeSchema,
  planHash: z.string().regex(/^[0-9a-f]{64}$/),
  ready: z.boolean(),
  totals: z.strictObject({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    keepLocal: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
  counts: ImportApplyCountsSchema,
  blockers: z.array(ImportApplyBlockerSchema).max(50),
  warnings: z.array(z.string().min(1).max(240)).max(50),
  reviewItems: z.array(ImportApplyPlanItemSchema).max(2000),
  reviewItemsTruncated: z.boolean(),
});
export const ImportApplyPlanResponseSchema = z.strictObject({ plan: ImportApplyPlanSchema });
export const ImportApplicationSchema = z.strictObject({
  applicationId: UuidSchema,
  operationId: UuidSchema,
  previewId: UuidSchema,
  competitionId: UuidSchema,
  providerName: DisplayNameSchema,
  externalSeasonLabel: DisplayNameSchema,
  destinationSeasonId: UuidSchema,
  destinationSeasonLabel: DisplayNameSchema,
  appliedAt: DateTimeSchema,
  counts: ImportApplyCountsSchema,
  notApplied: z.array(z.strictObject({
    resource: ImportResourceSchema,
    externalId: z.string().min(1).max(200),
    title: DisplayNameSchema,
    action: z.enum(['keep_local', 'skip']),
    reason: z.string().max(240).nullable(),
  })).max(500),
});
export const ImportApplicationHistoryResponseSchema = z.strictObject({
  applications: z.array(ImportApplicationSchema).max(100),
});
export const ImportApplyStageSchema = z.enum(['validating', 'resolving_identities', 'transforming', 'persisting']);
export const ImportApplyOperationSchema = z.strictObject({
  operationId: UuidSchema,
  competitionId: UuidSchema,
  previewId: UuidSchema,
  status: ImportOperationStatusSchema,
  currentStage: ImportApplyStageSchema.nullable(),
  completedStages: z.array(ImportApplyStageSchema).max(4),
  cancellationRequested: z.boolean(),
  cancellable: z.boolean(),
  application: ImportApplicationSchema.nullable(),
  errorCode: z.string().max(80).nullable(),
  errorMessage: z.string().max(240).nullable(),
  createdAt: z.iso.datetime(), startedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(), completedAt: z.iso.datetime().nullable(),
});
export const ImportApplyOperationResponseSchema = z.strictObject({ operation: ImportApplyOperationSchema });
export const ImportApplyOperationStartResponseSchema = z.strictObject({
  operation: ImportApplyOperationSchema,
  statusUrl: z.string().startsWith('/api/v1/competitions/'),
  eventsUrl: z.string().startsWith('/api/v1/competitions/'),
});
export const ImportApplyOperationParamsSchema = z.strictObject({ competitionId: UuidSchema, operationId: UuidSchema });
export const ImportApplyEventSchema = z.strictObject({
  id: z.number().int().positive(),
  type: z.enum(['operation.queued', 'operation.started', 'stage.started', 'stage.completed', 'operation.completed', 'operation.failed', 'operation.cancelled']),
  operationId: UuidSchema, status: ImportOperationStatusSchema, stage: ImportApplyStageSchema.nullable(),
  applicationId: UuidSchema.nullable(), timestamp: z.iso.datetime(),
});
export type ImportApplyAction = z.infer<typeof ImportApplyActionSchema>;
export type ImportApplyDecision = z.infer<typeof ImportApplyDecisionSchema>;
export type ImportApplyStart = z.infer<typeof ImportApplyStartSchema>;
export type ImportApplyCounts = z.infer<typeof ImportApplyCountsSchema>;
export type ImportApplyPlanItem = z.infer<typeof ImportApplyPlanItemSchema>;
export type ImportApplyPlan = z.infer<typeof ImportApplyPlanSchema>;
export type ImportApplication = z.infer<typeof ImportApplicationSchema>;
export type ImportApplyStage = z.infer<typeof ImportApplyStageSchema>;
export type ImportApplyOperation = z.infer<typeof ImportApplyOperationSchema>;
export type ImportApplyEvent = z.infer<typeof ImportApplyEventSchema>;
