/**
 * Contract schemas of the catalogue (operations listCompetitions, listSeasons, listStages): Availability,
 * ListingMeta, SourceListing, CompetitionSource, CatalogueCompetition, Catalogue, Season, SeasonList, Stage, StageList.
 */
import { z } from 'zod';

import {
  DataModeSchema,
  DateSchema,
  DateTimeSchema,
  DisplayNameSchema,
  SlugSchema,
  SourceIdSchema,
  StageNameSchema,
  uniquePrimitives,
} from './primitives.js';

/** Reasons why a source does not offer a competition, season or stage (R-286). */
export const AvailabilityReasonSchema = z.enum([
  'subscription_restricted',
  'not_found',
  'access_refused',
  'not_provided',
  'source_unavailable',
  'rate_limited',
]);

/** Whether a source offers a competition, season or stage, and why not (R-075, R-286). */
export const AvailabilitySchema = z.strictObject({
  available: z.boolean(),
  reason: AvailabilityReasonSchema.nullable(),
});

/** Provenance of a catalogue listing (R-141, R-291). */
export const ListingMetaSchema = z.strictObject({
  retrievedAt: DateTimeSchema.nullable(),
  fromCache: z.boolean(),
  /** True when a cached listing past its validity is shown because the request budget is exhausted. */
  stale: z.boolean(),
  retryAfterSeconds: z.int().min(0).nullable(),
});

export const SourceListingSchema = z.strictObject({
  sourceId: SourceIdSchema,
  sourceName: z.string().max(80),
  mode: DataModeSchema,
  availability: AvailabilitySchema,
  listing: ListingMetaSchema,
});

export const CompetitionSourceSchema = z.strictObject({
  sourceId: SourceIdSchema,
  sourceName: z.string().max(80),
  mode: DataModeSchema,
  /** True for enabled primary-role sources the operator can choose (R-431). */
  selectable: z.boolean(),
  availability: AvailabilitySchema,
});

export const CatalogueCompetitionSchema = z.strictObject({
  id: SlugSchema,
  name: DisplayNameSchema,
  areaName: DisplayNameSchema.nullable(),
  /** Marked by configuration as an initial reference scenario; listed first; no other effect. */
  reference: z.boolean(),
  sources: z.array(CompetitionSourceSchema).min(1),
});

export const CatalogueSchema = z.strictObject({
  competitions: z.array(CatalogueCompetitionSchema).max(1000),
  sources: z.array(SourceListingSchema),
});

export const SeasonSchema = z.strictObject({
  id: SlugSchema,
  label: DisplayNameSchema,
  current: z.boolean(),
  startDate: DateSchema.nullable(),
  endDate: DateSchema.nullable(),
});

export const SeasonListSchema = z.strictObject({
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  availability: AvailabilitySchema,
  listing: ListingMetaSchema,
  seasons: z.array(SeasonSchema).max(200),
});

export const StandingsExpectationSchema = z.enum(['expected', 'not_expected', 'unknown']);

/** A stage of a season by the source's name; matchdays lists its numbered rounds (R-074, R-283). */
export const StageSchema = z.strictObject({
  id: SlugSchema,
  name: StageNameSchema,
  order: z.int().min(1),
  standings: StandingsExpectationSchema,
  selectableAsWhole: z.boolean(),
  matchdays: uniquePrimitives(z.array(z.int().min(1).max(999)).max(99)),
  availability: AvailabilitySchema,
});

export const StageListSchema = z.strictObject({
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  seasonId: SlugSchema,
  availability: AvailabilitySchema,
  listing: ListingMetaSchema,
  stages: z.array(StageSchema).max(64),
});

export type AvailabilityReason = z.infer<typeof AvailabilityReasonSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type ListingMeta = z.infer<typeof ListingMetaSchema>;
export type SourceListing = z.infer<typeof SourceListingSchema>;
export type CompetitionSource = z.infer<typeof CompetitionSourceSchema>;
export type CatalogueCompetition = z.infer<typeof CatalogueCompetitionSchema>;
export type Catalogue = z.infer<typeof CatalogueSchema>;
export type Season = z.infer<typeof SeasonSchema>;
export type SeasonList = z.infer<typeof SeasonListSchema>;
export type StandingsExpectation = z.infer<typeof StandingsExpectationSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type StageList = z.infer<typeof StageListSchema>;
