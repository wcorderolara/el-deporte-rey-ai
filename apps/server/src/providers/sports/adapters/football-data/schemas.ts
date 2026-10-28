/**
 * Allow-list schemas of the football-data v4 resources (contracts/provider-ports.md section 1.4; R-119, R-128, R-247,
 * R-280; PD-15 option A: in-process parsing within the reviewed caps, deadline and schemas).
 *
 * Objects strip every key they do not name: person fields (`referees`, `coach`, squads and any other), `crest`,
 * `emblem`, `flag`, `form`, `odds`, `winner` and every other unmapped field are dropped here, before mapping, and only
 * their number is logged (never their names or values). Field names and types marked UNVERIFIED in section 1.4 are
 * accepted defensively (an ID may be an integer or a key string) and confirmed by the capability probe (T53).
 */
import { z } from 'zod';

import { COMPETITION_CODE_PATTERN } from './options.js';

/** Provider match statuses (verified enum, `architecture-delta.md` section 11.10). */
export const PROVIDER_MATCH_STATUSES = [
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
  'FINISHED',
  'POSTPONED',
  'SUSPENDED',
  'CANCELLED',
  'AWARDED',
] as const;

export type ProviderMatchStatus = (typeof PROVIDER_MATCH_STATUSES)[number];

/** Array caps of the provider resources (bounds for in-process parsing, PD-15). */
export const RESPONSE_LIMITS = { competitions: 1000, seasons: 200, matches: 3000, tables: 64, rows: 512 } as const;

/** A provider ID: a safe non-negative integer or a key string (type UNVERIFIED). */
const providerId = z.union([
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
]);
const text = z.string().max(200);
const count = z.number().int().min(0).max(100_000);
const signed = z.number().int().min(-100_000).max(100_000);
const dateText = z.string().max(40);

const area = z.object({ name: text.nullable().optional() }).nullable().optional();

export const CompetitionsResponseSchema = z.object({
  competitions: z
    .array(
      z.object({
        id: providerId,
        code: z.string().regex(COMPETITION_CODE_PATTERN).nullable().optional(),
        name: text,
        area,
      }),
    )
    .max(RESPONSE_LIMITS.competitions),
});

const season = z.object({
  id: providerId.nullable().optional(),
  startDate: dateText.nullable().optional(),
  endDate: dateText.nullable().optional(),
  currentMatchday: z.number().int().min(0).max(999).nullable().optional(),
});

export const CompetitionDetailSchema = z.object({
  id: providerId,
  code: z.string().regex(COMPETITION_CODE_PATTERN).nullable().optional(),
  name: text,
  currentSeason: season.nullable().optional(),
  seasons: z.array(season).max(RESPONSE_LIMITS.seasons),
});

const team = z.object({
  id: providerId.nullable().optional(),
  name: text.nullable().optional(),
  shortName: text.nullable().optional(),
  tla: z.string().max(16).nullable().optional(),
});

const goals = z.number().int().min(0).max(999).nullable().optional();

export const MatchesResponseSchema = z.object({
  competition: z.object({ name: text.nullable().optional() }).nullable().optional(),
  matches: z
    .array(
      z.object({
        id: providerId,
        utcDate: dateText,
        status: z.enum(PROVIDER_MATCH_STATUSES),
        matchday: z.number().int().min(0).max(999).nullable().optional(),
        stage: z.string().max(80).nullable().optional(),
        homeTeam: team,
        awayTeam: team,
        score: z
          .object({ fullTime: z.object({ home: goals, away: goals }).nullable().optional() })
          .nullable()
          .optional(),
      }),
    )
    .max(RESPONSE_LIMITS.matches),
});

const rowTeam = z.object({
  id: providerId,
  name: text,
  shortName: text.nullable().optional(),
  tla: z.string().max(16).nullable().optional(),
});

export const StandingsResponseSchema = z.object({
  competition: z.object({ name: text.nullable().optional() }).nullable().optional(),
  standings: z
    .array(
      z.object({
        stage: z.string().max(80).nullable().optional(),
        type: z.string().max(20).nullable().optional(),
        group: z.string().max(80).nullable().optional(),
        table: z
          .array(
            z.object({
              position: z.number().int().min(1).max(1000),
              team: rowTeam,
              playedGames: count,
              won: count,
              draw: count,
              lost: count,
              points: signed,
              goalsFor: count,
              goalsAgainst: count,
              goalDifference: signed,
            }),
          )
          .max(RESPONSE_LIMITS.rows),
      }),
    )
    .max(RESPONSE_LIMITS.tables),
});

export type CompetitionsResponse = z.output<typeof CompetitionsResponseSchema>;
export type CompetitionDetail = z.output<typeof CompetitionDetailSchema>;
export type ProviderSeason = z.output<typeof season>;
export type MatchesResponse = z.output<typeof MatchesResponseSchema>;
export type ProviderMatch = MatchesResponse['matches'][number];
export type ProviderTeam = z.output<typeof team>;
export type StandingsResponse = z.output<typeof StandingsResponseSchema>;
export type ProviderTable = StandingsResponse['standings'][number];
