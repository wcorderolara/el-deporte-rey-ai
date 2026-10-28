/**
 * Multi-competition fixture file format of FixtureDataProvider (contracts/provider-ports.md section 1.5):
 *
 * `{ "simulate": null | "unavailable" | "rate_limited" | "timeout" | "no_data" | "access_refused" | "not_available",
 *    "competitions": [ { "localKey", "name", "areaName", "seasons": [ { "id", "label", "current", "startDate",
 *    "endDate", "startYear", "stages": [ { "id", "name", "order", "standings", "wholeStage": <selection or null>,
 *    "matchdays": { "<n>": <selection> } } ] } ] } ] }`
 *
 * `<selection>` is a `SelectionSnapshot` without `sourceId`, `mode`, `retrievedAt`, `fromCache` and
 * `importVersionId`; it stays `unknown` here and is validated by the shared domain schema when it is fetched.
 * Structural values are checked loosely here (types only); patterns and bounds are applied by the domain listing
 * schemas. Every lookup keyed by file values is a `Map` (T11H-F07); the raw parsed objects are never spread.
 */
import { z } from 'zod';

export const SIMULATE_CODES = [
  'unavailable',
  'rate_limited',
  'timeout',
  'no_data',
  'access_refused',
  'not_available',
] as const;

export type SimulateCode = (typeof SIMULATE_CODES)[number];

/** Matchday keys of the `matchdays` object: `1` to `999`. */
const MATCHDAY_KEY = /^[1-9][0-9]{0,2}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `{ "<n>": <selection> }` read into a `Map` keyed by matchday number. */
const matchdaysSchema = z.unknown().transform((value, ctx): Map<number, unknown> => {
  const result = new Map<number, unknown>();
  if (!isPlainObject(value)) {
    ctx.addIssue({ code: 'custom', message: 'Matchdays must be an object keyed by matchday number' });
    return z.NEVER;
  }
  for (const key of Object.keys(value)) {
    if (!MATCHDAY_KEY.test(key)) {
      ctx.addIssue({ code: 'custom', message: 'Matchday keys must be numbers from 1 to 999' });
      return z.NEVER;
    }
    result.set(Number(key), value[key]);
  }
  return result;
});

const stageSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  standings: z.string(),
  wholeStage: z.unknown().optional(),
  matchdays: matchdaysSchema.optional(),
});

const seasonSchema = z.object({
  id: z.string(),
  label: z.string(),
  current: z.boolean(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  startYear: z.number().nullable(),
  stages: z.array(stageSchema).max(64),
});

const competitionSchema = z.object({
  localKey: z.string(),
  name: z.string(),
  areaName: z.string().nullable(),
  seasons: z.array(seasonSchema).max(200),
});

export const fixtureFileSchema = z.object({
  simulate: z.enum(SIMULATE_CODES).nullable().default(null),
  competitions: z.array(competitionSchema).max(1000),
});

export type FixtureFile = z.output<typeof fixtureFileSchema>;
export type FixtureCompetition = FixtureFile['competitions'][number];
export type FixtureSeason = FixtureCompetition['seasons'][number];
export type FixtureStage = FixtureSeason['stages'][number];

/** Adapter options: `{ scenario }` (contracts/provider-ports.md section 1.5). */
export const fixtureOptionsSchema = z.strictObject({
  scenario: z.string().regex(/^[a-z0-9-]{1,60}$/),
});

export type FixtureOptions = z.output<typeof fixtureOptionsSchema>;

/** Opaque reference built by the adapter from the file's keys: `{ c, s, st, md }` (section 1.5). */
export const fixtureRefSchema = z.strictObject({
  c: z.string().min(1).max(64),
  s: z.string().min(1).max(64).optional(),
  st: z.string().min(1).max(64).optional(),
  md: z.int().min(1).max(999).nullable().optional(),
});

export type FixtureRef = z.output<typeof fixtureRefSchema>;
