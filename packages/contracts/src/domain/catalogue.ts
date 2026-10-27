/**
 * Provider-neutral domain schemas of sources and the catalogue (`contracts/provider-ports.md` sections 1.2 and 1.3,
 * `data-model.md` section 0): Source (descriptor), availability, listings and their items (competitions, seasons,
 * stages with matchdays), the merged catalogue competition and a selection.
 *
 * Objects are allow-lists: unknown keys are stripped (count them with `parseDomain`).
 */
import { z } from 'zod';

import { DataModeSchema, SlugSchema, SourceIdSchema } from '../http/primitives.js';
import { DomainDisplayNameSchema, DomainStageNameSchema, OffsetDateTimeSchema, OpaqueSourceRefSchema } from './rules.js';

/** Configured descriptor of a source (the Source concept). */
export const SourceDescriptorSchema = z
  .object({
    id: SourceIdSchema,
    name: z.string().min(1).max(80),
    mode: DataModeSchema,
    /** Adapter kind, resolved only by the adapter registry. */
    adapter: SlugSchema,
    role: z.enum(['primary', 'verification']),
    /** The competition organiser's publication (R-311). */
    officialPublication: z.boolean(),
    /** Only accepted sources count (R-046, R-227); never true for MANUAL_DATA (R-071). */
    accepted: z.boolean(),
    /** Sources sharing upstream data count once. */
    independenceGroup: z.string().min(1).max(64),
    publicationPermission: z.enum(['confirmed', 'unconfirmed', 'not_applicable']),
    enabled: z.boolean(),
  })
  .refine((source) => !(source.mode === 'MANUAL_DATA' && source.accepted), {
    message: 'A MANUAL_DATA source is never accepted',
    path: ['accepted'],
  });

export const SOURCE_UNAVAILABLE_REASONS = [
  'subscription_restricted',
  'not_found',
  'access_refused',
  'not_provided',
  'source_unavailable',
  'rate_limited',
] as const;

/** Whether a source offers a competition, season or stage, and why not (R-075, R-286). */
export const SourceAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true) }),
  z.object({ available: z.literal(false), reason: z.enum(SOURCE_UNAVAILABLE_REASONS) }),
]);

/** A competition as one source lists it. */
export const SourceCompetitionSchema = z.object({
  ref: OpaqueSourceRefSchema,
  /** Adapter-supplied key; the catalogue ID is `<sourceId>-<localKey>`. */
  localKey: SlugSchema,
  name: DomainDisplayNameSchema,
  areaName: DomainDisplayNameSchema.nullable(),
});

/** A season as one source lists it (the Season concept). */
export const SourceSeasonSchema = z.object({
  ref: OpaqueSourceRefSchema,
  id: SlugSchema,
  label: DomainDisplayNameSchema,
  current: z.boolean(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  /** Used for counterpart resolution between sources. */
  startYear: z.int().min(1).max(9999).nullable(),
});

/** A matchday: a number inside a stage (the Matchday concept). */
export const MatchdayNumberSchema = z.int().min(1).max(999);

/** A stage as one source lists it, by the source's name (the Stage concept). */
export const SourceStageSchema = z.object({
  id: SlugSchema,
  name: DomainStageNameSchema,
  order: z.int().min(1),
  standings: z.enum(['expected', 'not_expected', 'unknown']),
  /** Set when the stage is selectable as a whole. */
  wholeStageRef: OpaqueSourceRefSchema.nullable(),
  /** Empty when the source does not number rounds. */
  matchdays: z
    .array(z.object({ number: MatchdayNumberSchema, ref: OpaqueSourceRefSchema }))
    .max(99)
    .refine((matchdays) => new Set(matchdays.map((matchday) => matchday.number)).size === matchdays.length, {
      message: 'Matchday numbers must be unique',
    }),
});

/** Listing of one source with its provenance (R-141, R-291). */
export function listingSchema<T extends z.ZodType>(item: T, maxItems: number) {
  return z.object({
    items: z.array(item).max(maxItems),
    availability: SourceAvailabilitySchema,
    /** Time of the provider retrieval the items come from (the cache keeps it). */
    retrievedAt: OffsetDateTimeSchema.nullable(),
    fromCache: z.boolean(),
    /** Expired cache entry served because the budget is exhausted (discovery only). */
    stale: z.boolean(),
    retryAfterSeconds: z.int().min(0).nullable(),
  });
}

/** Item caps of the listings, equal to the contract's caps on the catalogue responses. */
export const LISTING_MAX_ITEMS = { competitions: 1000, seasons: 200, stages: 64 } as const;

export const CompetitionListingSchema = listingSchema(SourceCompetitionSchema, LISTING_MAX_ITEMS.competitions);
export const SeasonListingSchema = listingSchema(SourceSeasonSchema, LISTING_MAX_ITEMS.seasons);
export const StageListingSchema = listingSchema(SourceStageSchema, LISTING_MAX_ITEMS.stages);

/** A merged catalogue competition with its source bindings (the Competition concept). */
export const CatalogueEntrySchema = z.object({
  id: SlugSchema,
  name: DomainDisplayNameSchema,
  areaName: DomainDisplayNameSchema.nullable(),
  /** Marked by configuration as an initial reference scenario. */
  reference: z.boolean(),
  bindings: z
    .array(z.object({ sourceId: SourceIdSchema, competitionRef: OpaqueSourceRefSchema }))
    .min(1)
    .refine((bindings) => new Set(bindings.map((binding) => binding.sourceId)).size === bindings.length, {
      message: 'A source is bound at most once',
    }),
});

/** A selection: a stage plus a matchday number, or the whole stage (matchday null; AD-24). */
export const SelectionSchema = z.object({
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  seasonId: SlugSchema,
  stageId: SlugSchema,
  matchday: MatchdayNumberSchema.nullable(),
});

export type SourceDescriptor = z.infer<typeof SourceDescriptorSchema>;
export type SourceUnavailableReason = (typeof SOURCE_UNAVAILABLE_REASONS)[number];
export type SourceAvailability = z.infer<typeof SourceAvailabilitySchema>;
export type SourceCompetition = z.infer<typeof SourceCompetitionSchema>;
export type SourceSeason = z.infer<typeof SourceSeasonSchema>;
export type SourceStage = z.infer<typeof SourceStageSchema>;
export type CompetitionListing = z.infer<typeof CompetitionListingSchema>;
export type SeasonListing = z.infer<typeof SeasonListingSchema>;
export type StageListing = z.infer<typeof StageListingSchema>;
export type CatalogueEntry = z.infer<typeof CatalogueEntrySchema>;
export type Selection = z.infer<typeof SelectionSchema>;
