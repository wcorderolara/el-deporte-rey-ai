/** Locally managed competition foundation, separate from provider catalogue identifiers and manual import records. */
import { z } from 'zod';

import { DateTimeSchema, DisplayNameSchema, UuidSchema } from './primitives.js';

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
