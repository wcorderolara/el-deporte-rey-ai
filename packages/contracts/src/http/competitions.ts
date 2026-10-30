/** Locally managed competition foundation, separate from provider catalogue identifiers and manual import records. */
import { z } from 'zod';

import { DateTimeSchema, DisplayNameSchema, TeamNameSchema, UuidSchema } from './primitives.js';

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

/** Locally managed season; the label preserves operator formatting (for example `2026/27` or `2027`). */
export const ManagedSeasonCreateSchema = z.strictObject({ label: DisplayNameSchema });
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
export const ManagedTeamSchema = z.strictObject({
  id: UuidSchema,
  name: TeamNameSchema,
  region: DisplayNameSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export const ManagedTeamListResponseSchema = z.strictObject({ teams: z.array(ManagedTeamSchema) });

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
export type ManagedSeason = z.infer<typeof ManagedSeasonSchema>;
export type ManagedTeamCreate = z.infer<typeof ManagedTeamCreateSchema>;
export type ManagedTeam = z.infer<typeof ManagedTeamSchema>;
export type SeasonParticipant = z.infer<typeof SeasonParticipantSchema>;
export type SeasonParticipantCreate = z.infer<typeof SeasonParticipantCreateSchema>;
