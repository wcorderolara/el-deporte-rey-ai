/** Locally managed competition foundation, separate from provider catalogue identifiers and manual import records. */
import { z } from 'zod';

import { DateTimeSchema, DisplayNameSchema, TeamNameSchema, UuidSchema, SourceIdSchema } from './primitives.js';

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
