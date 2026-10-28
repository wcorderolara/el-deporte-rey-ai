/**
 * FixtureDataProvider (contracts/provider-ports.md section 1.5; DEMO_DATA; R-058, R-110, R-241).
 *
 * - Options `{ scenario }`; the file read is `fixtures/sports/<scenario>/<sourceId>.json` under the project root,
 *   resolved and checked (also through symbolic links) to stay under `fixtures/sports/`.
 * - The file is read on every call, so a competition added to or removed from it appears or disappears without a
 *   code change or restart (R-282).
 * - `simulate` makes every method throw the corresponding `SourceError`.
 * - `retrievedAt` is the injected clock's time; `sourceRef` defaults to `fixture:<scenario>/<sourceId>.json`.
 * - Refs are JSON of `{ c, s, st, md }` built from the file's keys; only this adapter reads them.
 * - It performs no network I/O: it never uses the egress client (R-241).
 * - Errors carry fixed text only: never a file path, a file value or a parser message (T10-F10).
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { type SelectionSnapshot, SelectionSnapshotSchema, formatIssuePath, parseDomain } from '@edr/contracts';

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

import {
  type FixtureCompetition,
  type FixtureFile,
  type FixtureOptions,
  type FixtureRef,
  type FixtureSeason,
  type FixtureStage,
  fixtureFileSchema,
  fixtureOptionsSchema,
  fixtureRefSchema,
} from './file-format.js';

export const FIXTURE_ADAPTER_KIND = 'fixture';
/** Directory of the fixture files, relative to the project root. */
export const FIXTURE_DIRECTORY = ['fixtures', 'sports'] as const;
/** Largest fixture file read (synthetic files are far smaller). */
export const MAX_FIXTURE_FILE_BYTES = 2 * 1024 * 1024;
/** Wait announced by a simulated rate limit. */
export const SIMULATED_RETRY_AFTER_SECONDS = 60;

interface SeasonEntry {
  readonly season: FixtureSeason;
  readonly stages: ReadonlyMap<string, FixtureStage>;
}

interface CompetitionEntry {
  readonly competition: FixtureCompetition;
  readonly seasons: ReadonlyMap<string, SeasonEntry>;
}

interface IndexedFile {
  readonly file: FixtureFile;
  readonly competitions: ReadonlyMap<string, CompetitionEntry>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An own property of a raw parsed object, or undefined (never an inherited member). */
function own(value: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export function createFixtureSource(context: AdapterContext): IngestionSource {
  const { descriptor, deps, setting } = context;
  const sourceId = descriptor.id;
  const fixturesRoot = resolve(deps.paths.rootDir, ...FIXTURE_DIRECTORY);
  const parsedOptions = fixtureOptionsSchema.safeParse(context.options);
  const options: FixtureOptions | null = parsedOptions.success ? parsedOptions.data : null;
  const filePath = options === null ? null : resolve(fixturesRoot, options.scenario, `${sourceId}.json`);

  const fail = (code: SourceError['code'], message: string, path: string | null = null): SourceError =>
    new SourceError(code, message, sourceId, path);

  /** Indexes the file in `Map`s; a repeated key rejects the file. */
  function index(file: FixtureFile): IndexedFile {
    const competitions = new Map<string, CompetitionEntry>();
    file.competitions.forEach((competition, c) => {
      const at = `/competitions/${String(c)}`;
      if (competitions.has(competition.localKey)) {
        throw fail('invalid', 'fixture file repeats a key', `${at}/localKey`);
      }
      const seasons = new Map<string, SeasonEntry>();
      competition.seasons.forEach((season, s) => {
        if (seasons.has(season.id)) {
          throw fail('invalid', 'fixture file repeats a key', `${at}/seasons/${String(s)}/id`);
        }
        const stages = new Map<string, FixtureStage>();
        season.stages.forEach((stage, st) => {
          if (stages.has(stage.id)) {
            throw fail('invalid', 'fixture file repeats a key', `${at}/seasons/${String(s)}/stages/${String(st)}/id`);
          }
          stages.set(stage.id, stage);
        });
        seasons.set(season.id, { season, stages });
      });
      competitions.set(competition.localKey, { competition, seasons });
    });
    return { file, competitions };
  }

  async function readText(): Promise<string> {
    if (filePath === null || !isInside(fixturesRoot, filePath)) {
      throw fail('unavailable', 'fixture options are invalid');
    }
    try {
      const [realRoot, realFile] = await Promise.all([realpath(fixturesRoot), realpath(filePath)]);
      if (!isInside(realRoot, realFile)) {
        throw fail('unavailable', 'fixture file is outside the fixture directory');
      }
      const stats = await stat(realFile);
      if (!stats.isFile()) {
        throw fail('unavailable', 'fixture file cannot be read');
      }
      if (stats.size > MAX_FIXTURE_FILE_BYTES) {
        throw fail('invalid', 'fixture file is too large');
      }
      return await readFile(realFile, 'utf8');
    } catch (error) {
      throw error instanceof SourceError ? error : fail('unavailable', 'fixture file cannot be read');
    }
  }

  /** Reads and indexes the file, then applies `simulate`. */
  async function load(): Promise<IndexedFile> {
    const text = await readText();
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw fail('invalid', 'fixture file is not valid JSON');
    }
    const parsed = fixtureFileSchema.safeParse(raw);
    if (!parsed.success) {
      const path = formatIssuePath(parsed.error.issues[0]?.path ?? []);
      throw fail('invalid', 'fixture file does not match the fixture format', path);
    }
    const simulate = parsed.data.simulate;
    if (simulate !== null) {
      const retryAfter = simulate === 'rate_limited' ? SIMULATED_RETRY_AFTER_SECONDS : null;
      throw new SourceError(simulate, 'simulated source failure', sourceId, null, null, retryAfter);
    }
    return index(parsed.data);
  }

  function readRef(ref: SourceRef): FixtureRef {
    let raw: unknown;
    try {
      raw = JSON.parse(ref) as unknown;
    } catch {
      throw fail('bad_request', 'fixture reference is malformed');
    }
    const parsed = fixtureRefSchema.safeParse(raw);
    if (!parsed.success) {
      throw fail('bad_request', 'fixture reference is malformed');
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

  function competitionOf(indexed: IndexedFile, ref: FixtureRef): CompetitionEntry {
    const entry = indexed.competitions.get(ref.c);
    if (entry === undefined) {
      throw fail('no_data', 'fixture competition is not in the file');
    }
    return entry;
  }

  function seasonOf(indexed: IndexedFile, ref: FixtureRef): SeasonEntry {
    const entry = ref.s === undefined ? undefined : competitionOf(indexed, ref).seasons.get(ref.s);
    if (entry === undefined) {
      throw fail('no_data', 'fixture season is not in the file');
    }
    return entry;
  }

  function stageOf(indexed: IndexedFile, ref: FixtureRef): FixtureStage {
    const stage = ref.st === undefined ? undefined : seasonOf(indexed, ref).stages.get(ref.st);
    if (stage === undefined) {
      throw fail('no_data', 'fixture stage is not in the file');
    }
    return stage;
  }

  /** Builds the snapshot candidate member by member from the raw selection (never a spread of the raw object). */
  function toSnapshotCandidate(raw: Record<string, unknown>): Record<string, unknown> {
    const sourceRef = own(raw, 'sourceRef');
    return {
      sourceId,
      mode: descriptor.mode,
      retrievedAt: deps.clock.now().toISOString(),
      fromCache: false,
      sourceRef:
        sourceRef === undefined && options !== null ? `fixture:${options.scenario}/${sourceId}.json` : sourceRef,
      importVersionId: null,
      competition: own(raw, 'competition'),
      season: own(raw, 'season'),
      stage: own(raw, 'stage'),
      teams: own(raw, 'teams'),
      matches: own(raw, 'matches'),
      standings: own(raw, 'standings'),
      context: own(raw, 'context'),
    };
  }

  const source: IngestionSource = {
    descriptor,

    async listCompetitions(): Promise<Listing<SourceCompetition>> {
      const indexed = await load();
      return listing(
        indexed.file.competitions.map((competition) => ({
          ref: asSourceRef(JSON.stringify({ c: competition.localKey })),
          localKey: competition.localKey,
          name: competition.name,
          areaName: competition.areaName,
        })),
      );
    },

    async listSeasons(competition: SourceRef): Promise<Listing<SourceSeason>> {
      const indexed = await load();
      const ref = readRef(competition);
      const entry = competitionOf(indexed, ref);
      return listing(
        entry.competition.seasons.map((season) => ({
          ref: asSourceRef(JSON.stringify({ c: ref.c, s: season.id })),
          id: season.id,
          label: season.label,
          current: season.current,
          startDate: season.startDate,
          endDate: season.endDate,
          startYear: season.startYear,
        })),
      );
    },

    async listStages(_competition: SourceRef, season: SourceRef): Promise<Listing<SourceStage>> {
      const indexed = await load();
      const ref = readRef(season);
      const entry = seasonOf(indexed, ref);
      return listing(
        entry.season.stages.map((stage) => {
          const selectionRef = (md: number | null): SourceRef =>
            asSourceRef(JSON.stringify({ c: ref.c, s: ref.s, st: stage.id, md }));
          const hasWholeStage = stage.wholeStage !== undefined && stage.wholeStage !== null;
          return {
            id: stage.id,
            name: stage.name,
            order: stage.order,
            // Checked against the closed enum by the shared listing schema.
            standings: stage.standings as SourceStage['standings'],
            wholeStageRef: hasWholeStage ? selectionRef(null) : null,
            matchdays: [...(stage.matchdays?.keys() ?? [])]
              .sort((a, b) => a - b)
              .map((number) => ({ number, ref: selectionRef(number) })),
          };
        }),
      );
    },

    async fetchSelection(selection: SourceRef): Promise<SelectionSnapshot> {
      const indexed = await load();
      const ref = readRef(selection);
      if (ref.md === undefined) {
        throw fail('bad_request', 'fixture reference is malformed');
      }
      const stage = stageOf(indexed, ref);
      const raw = ref.md === null ? stage.wholeStage : stage.matchdays?.get(ref.md);
      if (raw === undefined || raw === null) {
        throw fail('no_data', 'fixture selection is not in the file');
      }
      if (!isPlainObject(raw)) {
        throw fail('invalid', 'source output failed domain validation', '/');
      }
      const result = parseDomain(SelectionSnapshotSchema, toSnapshotCandidate(raw));
      if (!result.success) {
        throw fail('invalid', 'source output failed domain validation', result.issues[0]?.path ?? null);
      }
      if (result.strippedKeys > 0) {
        deps.logger.debug(
          { sourceId, resource: 'selection', strippedKeys: result.strippedKeys },
          'unknown keys stripped from fixture selection',
        );
      }
      return result.data;
    },

    validateStartup(): void {
      if (options === null || filePath === null || !isInside(fixturesRoot, filePath)) {
        throw new ConfigError(`${setting}.options.scenario`, 'must be 1 to 60 characters of a-z, 0-9 and -');
      }
      let present: boolean;
      try {
        const realRoot = realpathSync(fixturesRoot);
        const realFile = realpathSync(filePath);
        present = isInside(realRoot, realFile) && statSync(realFile).isFile();
      } catch {
        present = false;
      }
      if (!present) {
        throw new ConfigError(
          `${setting}.options.scenario`,
          `names a scenario without a fixture file for the source '${sourceId}'`,
        );
      }
    },
  };
  return Object.freeze(source);
}

/** Registry entry of the fixture adapter (DEMO_DATA). */
export const fixtureAdapter: AdapterRegistration = Object.freeze({
  kind: FIXTURE_ADAPTER_KIND,
  mode: 'DEMO_DATA',
  create: createFixtureSource,
});
