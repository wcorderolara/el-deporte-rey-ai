/**
 * Ingestion port (contracts/provider-ports.md section 1.2; AD-21, AD-22): the provider-neutral interface that every
 * sports-data adapter implements, the listing and selection shapes it returns, and the adapter registration used by
 * the adapter registry. Provider catalogue metadata is declared by registrations; ingestion payloads and domain
 * selection stay provider-neutral and do not encode provider identifiers (R-139, R-288).
 */
import type { DataMode, SelectionSnapshot, SourceAvailability } from '@edr/contracts';

import type {
  AdapterOptions,
  CatalogueConfig,
  EnvironmentSource,
  SourceConfig,
} from '../../../platform/config/index.js';
import type { Db } from '../../../platform/db/index.js';
import type { EgressClient } from '../../../platform/net/index.js';

export type { DataMode, SelectionSnapshot };

/**
 * Opaque adapter-owned reference: a JSON string of at most 512 characters. Core code stores it and passes it back to
 * the adapter of the same source unchanged; it never parses, compares or logs its content (AD-21).
 */
export type SourceRef = string & { readonly __brand: 'SourceRef' };

/** Marks an adapter-built string as a `SourceRef`; only adapters and the validation layer call it. */
export function asSourceRef(value: string): SourceRef {
  return value as SourceRef;
}

/** Configured descriptor of a source (the Source concept), without its adapter options. */
export interface SourceDescriptor {
  /** Configured source ID, `^[a-z0-9][a-z0-9-]{1,40}$`. */
  readonly id: string;
  readonly name: string;
  readonly mode: DataMode;
  /** Adapter kind slug, resolved only by the adapter registry (`adapters/index.ts`). */
  readonly adapter: string;
  readonly role: 'primary' | 'verification';
  /** The competition organiser's publication (R-311). */
  readonly officialPublication: boolean;
  /** Only accepted sources count (R-046, R-227); never true for MANUAL_DATA (R-071). */
  readonly accepted: boolean;
  /** Sources sharing upstream data count once (OD-24). */
  readonly independenceGroup: string;
  readonly publicationPermission: 'confirmed' | 'unconfirmed' | 'not_applicable';
  readonly enabled: boolean;
}

/** Whether a source offers a competition, season or stage, and why not (R-075, R-286). */
export type Availability = SourceAvailability;

/** A listing of one source with its provenance (R-141, R-291). */
export interface Listing<T> {
  readonly items: readonly T[];
  readonly availability: Availability;
  /** Time of the provider retrieval the items come from (a cache keeps it). */
  readonly retrievedAt: string | null;
  readonly fromCache: boolean;
  /** Expired cache entry served because the budget is exhausted (discovery only). */
  readonly stale: boolean;
  readonly retryAfterSeconds: number | null;
}

export interface SourceCompetition {
  readonly ref: SourceRef;
  /** Adapter-supplied slug; the catalogue ID of an unlinked competition is `<sourceId>-<localKey>`. */
  readonly localKey: string;
  readonly name: string;
  readonly areaName: string | null;
}

export interface SourceSeason {
  readonly ref: SourceRef;
  /** Slug. */
  readonly id: string;
  readonly label: string;
  readonly current: boolean;
  readonly startDate: string | null;
  readonly endDate: string | null;
  /** Used for counterpart resolution between sources. */
  readonly startYear: number | null;
}

export interface SourceMatchday {
  readonly number: number;
  readonly ref: SourceRef;
}

export interface SourceStage {
  /** Slug. */
  readonly id: string;
  /** As the source gives it (R-077, R-283). */
  readonly name: string;
  readonly order: number;
  readonly standings: 'expected' | 'not_expected' | 'unknown';
  /** Set when the stage is selectable as a whole. */
  readonly wholeStageRef: SourceRef | null;
  /** Empty when the source does not number rounds. */
  readonly matchdays: readonly SourceMatchday[];
}

export type IngestionPurpose = 'discovery' | 'research' | 'verification' | 'consultation';

export interface IngestionContext {
  readonly signal: AbortSignal;
  readonly purpose: IngestionPurpose;
}

/** The one ingestion port implemented by every adapter (AD-22). */
export interface IngestionSource {
  readonly descriptor: SourceDescriptor;
  listCompetitions(ctx: IngestionContext): Promise<Listing<SourceCompetition>>;
  listSeasons(competition: SourceRef, ctx: IngestionContext): Promise<Listing<SourceSeason>>;
  listStages(competition: SourceRef, season: SourceRef, ctx: IngestionContext): Promise<Listing<SourceStage>>;
  fetchSelection(selection: SourceRef, ctx: IngestionContext): Promise<SelectionSnapshot>;
  /**
   * Startup validation of the adapter's options and environment (OD-20); throws a `ConfigError` naming settings or
   * variables, never their values.
   */
  validateStartup?(): void;
}

/** Clock injected into adapters (times are ISO-8601 UTC strings built from it). */
export interface Clock {
  now(): Date;
}

/**
 * Logger used by the ingestion layer and adapters. Fields are counts, IDs and closed codes only; never a payload,
 * a header value, a credential, a reference content or a file path (R-124, R-133).
 */
export interface SportsLogger {
  debug(fields: Readonly<Record<string, unknown>>, message: string): void;
  warn(fields: Readonly<Record<string, unknown>>, message: string): void;
}

/** A logger that discards everything. */
export const silentSportsLogger: SportsLogger = Object.freeze({
  debug: () => undefined,
  warn: () => undefined,
});

/** Project paths an adapter may use: the project root (fixtures) and the data directory. */
export interface SportsPaths {
  readonly rootDir: string;
  readonly dataDir: string;
}

/** Dependencies injected into `createSportsSources` and passed on to every adapter factory. */
export interface SportsDeps {
  readonly egress: EgressClient;
  /** The injected environment; adapters read only their own variables from it (AD-30). */
  readonly env: EnvironmentSource;
  readonly clock: Clock;
  readonly db: Db;
  readonly paths: SportsPaths;
  readonly logger: SportsLogger;
}

/** What an adapter factory receives for one configured source. */
export interface AdapterContext {
  /** The configured source with its opaque options (validated by the adapter itself). */
  readonly source: SourceConfig;
  /** The descriptor the adapter exposes. */
  readonly descriptor: SourceDescriptor;
  /** The setting path of the source, for example `providers.sports.sources[0]`, for `ConfigError` messages. */
  readonly setting: string;
  readonly options: AdapterOptions;
  readonly deps: SportsDeps;
}

/** One entry of the adapter registry: an adapter kind, its declared data mode and its factory (OD-20, R-118). */
export interface AdapterRegistration {
  /** Adapter kind slug referenced by `providers.sports.sources[].adapter`. */
  readonly kind: string;
  /** Declared data mode; a source whose mode differs stops startup. */
  readonly mode: DataMode;
  /** Public catalogue metadata for adapters operators can bind to competitions. */
  readonly provider?: Readonly<{
    readonly name: string;
    readonly capabilities: Readonly<{ competitionCatalogue: boolean; seasons: boolean; stages: boolean }>;
  }>;
  create(context: AdapterContext): IngestionSource;
}

/** Public provider metadata from the adapter registry; contains no configured source details. */
export interface RegisteredSportsProvider {
  readonly key: string;
  readonly name: string;
  readonly capabilities: Readonly<{ competitionCatalogue: boolean; seasons: boolean; stages: boolean }>;
}

/** The part of the application configuration that the sports-data layer reads. `AppConfig` satisfies it. */
export interface SportsConfig {
  readonly providers: Readonly<{ sports: Readonly<{ sources: readonly SourceConfig[] }> }>;
  readonly catalogue: CatalogueConfig;
}
