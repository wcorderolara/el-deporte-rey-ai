/**
 * ManualDataProvider (MANUAL_DATA; contracts/provider-ports.md section 1.6; AD-22, AD-29; R-057, R-064, R-065,
 * R-068, R-267, R-276, R-278).
 *
 * - Reads the import tables through the `Db` port: competitions from `manual_competitions` (of this source), seasons
 *   from `manual_seasons`, stages and matchdays from the current `manual_selection_versions`, and `fetchSelection` from
 *   the current version of the selection, so a reimport is used by later research (R-278).
 * - Snapshots carry the version's `importVersionId` and the attribution reference `import:<importId>/v<n>` (AD-36);
 *   missing standings are `available: false`, never derived (R-069, R-279); `totalMatchdays` is not known (null).
 * - No current version: `no_data`. Refs are JSON of `{ c, s, st, md }` built by this adapter from stored keys and
 *   read back only by it. Lookups keyed by stored values use `Map` (T11H-F07).
 * - It never uses the egress client or any network API (R-241); errors carry fixed text only (T10-F10).
 */
import { type SelectionSnapshot, SelectionSnapshotSchema, SlugSchema, parseDomain } from '@edr/contracts';
import { z } from 'zod';

import { ConfigError } from '../../../../platform/config/index.js';
import {
  type AdapterContext,
  type AdapterRegistration,
  type IngestionSource,
  type Listing,
  type SourceCompetition,
  type SourceRef,
  type SourceSeason,
  type SourceStage,
  SourceError,
  asSourceRef,
} from '../../ingestion/index.js';

import { type CurrentVersion, ManualStore } from './store.js';

export const MANUAL_ADAPTER_KIND = 'manual';

/** The adapter takes no options. */
const manualOptionsSchema = z.strictObject({});

const competitionRefSchema = z.strictObject({ c: SlugSchema });
const seasonRefSchema = z.strictObject({ c: SlugSchema, s: SlugSchema });
const selectionRefSchema = z.strictObject({
  c: SlugSchema,
  s: SlugSchema,
  st: SlugSchema,
  md: z.int().min(1).max(999).nullable(),
});

/** The attribution reference of a stored version (AD-36). */
export function importReference(importId: string, versionNumber: number): string {
  return `import:${importId}/v${String(versionNumber)}`;
}

/** Builds the normalized snapshot of a stored version (R-059, R-267). */
export function snapshotOfVersion(
  version: CurrentVersion,
  labels: { readonly competitionName: string; readonly seasonLabel: string },
  source: { readonly sourceId: string; readonly retrievedAt: string },
): Record<string, unknown> {
  const { selection } = version;
  const sourceRef = importReference(version.importId, version.versionNumber);
  const standings = selection.standings;
  return {
    sourceId: source.sourceId,
    mode: 'MANUAL_DATA',
    retrievedAt: source.retrievedAt,
    fromCache: false,
    sourceRef,
    importVersionId: version.versionId,
    competition: { name: labels.competitionName },
    season: { label: labels.seasonLabel },
    stage: { name: selection.stage.name, matchday: selection.matchday, totalMatchdays: null },
    teams: selection.teams.map((team) => ({
      teamKey: team.key,
      name: team.name,
      aliases: [],
      ref: `${sourceRef}#teams/${team.key}`,
    })),
    matches: selection.matches.map((match, index) => ({
      matchKey: `m${String(index + 1)}`,
      homeTeamKey: match.home,
      awayTeamKey: match.away,
      kickoff: match.kickoff,
      status: match.status,
      score: match.score === null ? null : { home: match.score.home, away: match.score.away },
      ref: `${sourceRef}#matches/${String(index + 1)}`,
    })),
    standings:
      standings === null
        ? { available: false, reason: 'not_provided_by_source' }
        : {
            available: true,
            asOf: standings.asOf,
            ref: `${sourceRef}#standings`,
            rows: standings.rows.map((row) => ({
              position: row.position,
              teamKey: row.team,
              played: row.played,
              won: row.won,
              drawn: row.drawn,
              lost: row.lost,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              goalDifference: row.goalDifference,
              points: row.points,
              ref: `${sourceRef}#standings/${String(row.position)}`,
            })),
          },
    context: [
      { type: 'matches_in_selection', count: selection.matches.length, ref: sourceRef },
      ...(standings === null ? [] : [{ type: 'teams_in_table', count: standings.rows.length, ref: sourceRef }]),
    ],
  };
}

export function createManualSource(context: AdapterContext): IngestionSource {
  const { descriptor, deps, setting } = context;
  const sourceId = descriptor.id;
  const store = new ManualStore(deps.db);

  const fail = (code: SourceError['code'], message: string, path: string | null = null): SourceError =>
    new SourceError(code, message, sourceId, path);

  function readRef<T>(schema: z.ZodType<T>, ref: SourceRef): T {
    let raw: unknown;
    try {
      raw = JSON.parse(ref) as unknown;
    } catch {
      throw fail('bad_request', 'manual reference is malformed');
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw fail('bad_request', 'manual reference is malformed');
    }
    return parsed.data;
  }

  function listing<T>(items: T[]): Listing<T> {
    return {
      items,
      availability: { available: true },
      retrievedAt: deps.clock.now().toISOString(),
      fromCache: false,
      stale: false,
      retryAfterSeconds: null,
    };
  }

  function stored<T>(action: () => T): T {
    try {
      return action();
    } catch (error) {
      throw error instanceof SourceError ? error : fail('unavailable', 'manual data cannot be read');
    }
  }

  function competitionOf(competitionId: string) {
    const competition = store.competition(sourceId, competitionId);
    if (competition === undefined) {
      throw fail('no_data', 'manual competition is not imported');
    }
    return competition;
  }

  const source: IngestionSource = {
    descriptor,

    listCompetitions(): Promise<Listing<SourceCompetition>> {
      return Promise.resolve().then(() =>
        stored(() =>
          listing(
            store.competitions(sourceId).map((competition) => ({
              ref: asSourceRef(JSON.stringify({ c: competition.competitionId })),
              localKey: competition.competitionId,
              name: competition.name,
              areaName: competition.areaName,
            })),
          ),
        ),
      );
    },

    listSeasons(competition: SourceRef): Promise<Listing<SourceSeason>> {
      return Promise.resolve().then(() =>
        stored(() => {
          const ref = readRef(competitionRefSchema, competition);
          competitionOf(ref.c);
          return listing(
            store.seasons(ref.c).map((season) => ({
              ref: asSourceRef(JSON.stringify({ c: ref.c, s: season.seasonId })),
              id: season.seasonId,
              label: season.label,
              // Nothing is derived from the label: dates, start year and "current" are not imported.
              current: false,
              startDate: null,
              endDate: null,
              startYear: null,
            })),
          );
        }),
      );
    },

    listStages(_competition: SourceRef, season: SourceRef): Promise<Listing<SourceStage>> {
      return Promise.resolve().then(() =>
        stored(() => {
          const ref = readRef(seasonRefSchema, season);
          competitionOf(ref.c);
          if (store.season(ref.c, ref.s) === undefined) {
            throw fail('no_data', 'manual season is not imported');
          }
          interface StageEntry {
            name: string;
            order: number;
            whole: boolean;
            standings: boolean;
            readonly matchdays: Set<number>;
          }
          const stages = new Map<string, StageEntry>();
          // Newest first: the first header of a stage gives its name and order.
          for (const header of store.currentHeaders(ref.c, ref.s)) {
            let entry = stages.get(header.stageId);
            if (entry === undefined) {
              entry = {
                name: header.stageName,
                order: header.stageOrder,
                whole: false,
                standings: false,
                matchdays: new Set(),
              };
              stages.set(header.stageId, entry);
            }
            if (header.matchdayKey === 0) {
              entry.whole = true;
            } else {
              entry.matchdays.add(header.matchdayKey);
            }
            entry.standings = entry.standings || header.hasStandings;
          }
          const selectionRef = (stageId: string, md: number | null): SourceRef =>
            asSourceRef(JSON.stringify({ c: ref.c, s: ref.s, st: stageId, md }));
          const items = [...stages]
            .sort(([idA, a], [idB, b]) => a.order - b.order || (idA < idB ? -1 : idA > idB ? 1 : 0))
            .map(([stageId, entry]) => ({
              id: stageId,
              name: entry.name,
              order: entry.order,
              standings: entry.standings ? ('expected' as const) : ('unknown' as const),
              wholeStageRef: entry.whole ? selectionRef(stageId, null) : null,
              matchdays: [...entry.matchdays]
                .sort((a, b) => a - b)
                .map((number) => ({ number, ref: selectionRef(stageId, number) })),
            }));
          return listing(items);
        }),
      );
    },

    fetchSelection(selection: SourceRef): Promise<SelectionSnapshot> {
      return Promise.resolve().then(() =>
        stored(() => {
          const ref = readRef(selectionRefSchema, selection);
          const competition = competitionOf(ref.c);
          const season = store.season(ref.c, ref.s);
          const version = season === undefined ? undefined : store.currentVersion(ref.c, ref.s, ref.st, ref.md ?? 0);
          if (season === undefined || version === undefined) {
            throw fail('no_data', 'manual selection has no current version');
          }
          const candidate = snapshotOfVersion(
            version,
            { competitionName: competition.name, seasonLabel: season.label },
            { sourceId, retrievedAt: deps.clock.now().toISOString() },
          );
          const result = parseDomain(SelectionSnapshotSchema, candidate);
          if (!result.success) {
            throw fail('invalid', 'source output failed domain validation', result.issues[0]?.path ?? null);
          }
          return result.data;
        }),
      );
    },

    validateStartup(): void {
      if (!manualOptionsSchema.safeParse(context.options).success) {
        throw new ConfigError(`${setting}.options`, 'must be an empty object: the manual adapter takes no options');
      }
    },
  };
  return Object.freeze(source);
}

/** Registry entry of the manual adapter (MANUAL_DATA). */
export const manualAdapter: AdapterRegistration = Object.freeze({
  kind: MANUAL_ADAPTER_KIND,
  mode: 'MANUAL_DATA',
  create: createManualSource,
});
