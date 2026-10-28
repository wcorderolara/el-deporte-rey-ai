/**
 * Source registry (contracts/provider-ports.md section 1.2; AD-22, OD-20, R-118, R-268): builds one validated
 * ingestion source per enabled configured source from the adapter registrations, applies the registry's startup
 * rules (known adapter kind; adapter mode equals source mode; catalogue link names are display names) and runs every
 * enabled adapter's `validateStartup`. It is the only object the catalogue service and the stages use; downstream
 * code never imports an adapter.
 *
 * Every adapter output passes the shared domain schemas (`validation.ts`) before it is returned, and every adapter
 * failure reaches core code as a sanitized `SourceError` (T10-F10). Lookups keyed by configured values use `Map`
 * (T11H-F07).
 */
import { DomainDisplayNameSchema, type SelectionSnapshot } from '@edr/contracts';

import { ConfigError, type ConfigIssue, type SourceConfig } from '../../../platform/config/index.js';
import { EgressError } from '../../../platform/net/index.js';

import { SourceError, sourceErrorFromEgress, toSourceError } from './errors.js';
import type {
  AdapterRegistration,
  IngestionContext,
  IngestionSource,
  Listing,
  SourceCompetition,
  SourceDescriptor,
  SourceRef,
  SourceSeason,
  SourceStage,
  SportsConfig,
  SportsDeps,
  SportsLogger,
} from './types.js';
import {
  validateCompetitionListing,
  validateSeasonListing,
  validateSelectionSnapshot,
  validateStageListing,
} from './validation.js';

const SOURCES = 'providers.sports.sources';
const ADAPTER_KIND = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Registry of the enabled sports-data sources. */
export interface SourceRegistry {
  /** Descriptors of the enabled sources, in configuration order. */
  readonly descriptors: readonly SourceDescriptor[];
  /** IDs of the enabled sources, in configuration order. */
  readonly sourceIds: readonly string[];
  /** The validated ingestion source of an enabled source. */
  get(sourceId: string): IngestionSource | undefined;
  /** The validated ingestion sources of every enabled source, in configuration order. */
  list(): readonly IngestionSource[];
  /** Runs every enabled adapter's startup validation; throws one `ConfigError` naming every problem (OD-20). */
  validateStartup(): void;
}

/** The descriptor exposed for a configured source (options and decision references are not part of it). */
export function toDescriptor(source: SourceConfig): SourceDescriptor {
  return Object.freeze({
    id: source.id,
    name: source.name,
    mode: source.mode,
    adapter: source.adapter,
    role: source.role,
    officialPublication: source.officialPublication,
    accepted: source.accepted,
    independenceGroup: source.independenceGroup,
    publicationPermission: source.publicationPermission,
    enabled: source.enabled,
  });
}

/** Builds the kind -> registration map; a kind registered twice is a programming error. */
export function registrationMap(
  registrations: readonly AdapterRegistration[],
): ReadonlyMap<string, AdapterRegistration> {
  const byKind = new Map<string, AdapterRegistration>();
  for (const registration of registrations) {
    if (!ADAPTER_KIND.test(registration.kind)) {
      throw new Error('adapter registration has an invalid kind');
    }
    if (byKind.has(registration.kind)) {
      throw new Error('adapter kind registered twice');
    }
    byKind.set(registration.kind, registration);
  }
  return byKind;
}

/**
 * Validating wrapper around an adapter: checks cancellation, normalizes every failure to a `SourceError` of this
 * source, and validates every output with the shared domain schemas before returning it.
 */
class ValidatedSource implements IngestionSource {
  readonly descriptor: SourceDescriptor;
  readonly #inner: IngestionSource;
  readonly #logger: SportsLogger;

  constructor(inner: IngestionSource, descriptor: SourceDescriptor, logger: SportsLogger) {
    this.#inner = inner;
    this.descriptor = descriptor;
    this.#logger = logger;
  }

  async #call<T>(ctx: IngestionContext, action: () => Promise<T>): Promise<T> {
    const sourceId = this.descriptor.id;
    if (ctx.signal.aborted) {
      throw new SourceError('unavailable', 'source request was cancelled', sourceId);
    }
    try {
      return await action();
    } catch (error) {
      const failure =
        error instanceof EgressError ? sourceErrorFromEgress(error, sourceId) : toSourceError(error, sourceId);
      this.#logger.debug(
        { sourceId, code: failure.code, httpStatus: failure.httpStatus, path: failure.path },
        'source request failed',
      );
      throw failure;
    }
  }

  async listCompetitions(ctx: IngestionContext): Promise<Listing<SourceCompetition>> {
    const raw: unknown = await this.#call(ctx, () => this.#inner.listCompetitions(ctx));
    return validateCompetitionListing(raw, this.descriptor.id, this.#logger);
  }

  async listSeasons(competition: SourceRef, ctx: IngestionContext): Promise<Listing<SourceSeason>> {
    const raw: unknown = await this.#call(ctx, () => this.#inner.listSeasons(competition, ctx));
    return validateSeasonListing(raw, this.descriptor.id, this.#logger);
  }

  async listStages(competition: SourceRef, season: SourceRef, ctx: IngestionContext): Promise<Listing<SourceStage>> {
    const raw: unknown = await this.#call(ctx, () => this.#inner.listStages(competition, season, ctx));
    return validateStageListing(raw, this.descriptor.id, this.#logger);
  }

  async fetchSelection(selection: SourceRef, ctx: IngestionContext): Promise<SelectionSnapshot> {
    const raw: unknown = await this.#call(ctx, () => this.#inner.fetchSelection(selection, ctx));
    return validateSelectionSnapshot(raw, this.descriptor, this.#logger);
  }

  validateStartup(): void {
    this.#inner.validateStartup?.();
  }
}

/** Converts anything a factory or `validateStartup` threw into configuration issues with fixed text. */
function issuesOf(error: unknown, setting: string): readonly ConfigIssue[] {
  if (error instanceof ConfigError) {
    return error.issues;
  }
  return [{ setting: `${setting}.options`, problem: 'could not be validated by the adapter' }];
}

/**
 * Builds the registry. Throws a `ConfigError` for an unknown adapter kind, a source mode that differs from its
 * adapter's declared mode, a catalogue link name that is not a display name, or an adapter factory that refuses its
 * source. It does not run `validateStartup`; `createSportsSources` does.
 */
export function createSourceRegistry(
  config: SportsConfig,
  deps: SportsDeps,
  registrations: readonly AdapterRegistration[],
): SourceRegistry {
  const byKind = registrationMap(registrations);
  const issues: ConfigIssue[] = [];
  const configured = config.providers.sports.sources;

  configured.forEach((source, index) => {
    const at = `${SOURCES}[${String(index)}]`;
    const registration = byKind.get(source.adapter);
    if (registration === undefined) {
      issues.push({
        setting: `${at}.adapter`,
        problem: `of the source '${source.id}' names an adapter kind that is not registered`,
      });
    } else if (registration.mode !== source.mode) {
      issues.push({
        setting: `${at}.mode`,
        problem: `of the source '${source.id}' must equal the declared mode of its adapter (${registration.mode})`,
      });
    }
  });

  config.catalogue.links.forEach((link, index) => {
    if (!DomainDisplayNameSchema.safeParse(link.name).success) {
      issues.push({
        setting: `catalogue.links[${String(index)}].name`,
        problem: `of the link '${link.id}' must be 1 to 80 letters, marks, digits, spaces or .'&()/- (T10-F06)`,
      });
    }
  });

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  const sources = new Map<string, ValidatedSource>();
  configured.forEach((source, index) => {
    const registration = byKind.get(source.adapter);
    if (!source.enabled || registration === undefined) {
      return;
    }
    const setting = `${SOURCES}[${String(index)}]`;
    const descriptor = toDescriptor(source);
    try {
      const adapter = registration.create({ source, descriptor, setting, options: source.options, deps });
      sources.set(source.id, new ValidatedSource(adapter, descriptor, deps.logger));
    } catch (error) {
      issues.push(...issuesOf(error, setting));
    }
  });

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  const settingById = new Map<string, string>(
    configured.map((source, index) => [source.id, `${SOURCES}[${String(index)}]`]),
  );
  const ordered = Object.freeze([...sources.values()]);
  const descriptors = Object.freeze(ordered.map((source) => source.descriptor));
  const sourceIds = Object.freeze(descriptors.map((descriptor) => descriptor.id));

  return Object.freeze({
    descriptors,
    sourceIds,
    get: (sourceId: string): IngestionSource | undefined => sources.get(sourceId),
    list: (): readonly IngestionSource[] => ordered,
    validateStartup(): void {
      const startupIssues: ConfigIssue[] = [];
      for (const source of ordered) {
        try {
          source.validateStartup();
        } catch (error) {
          startupIssues.push(...issuesOf(error, settingById.get(source.descriptor.id) ?? SOURCES));
        }
      }
      if (startupIssues.length > 0) {
        throw new ConfigError(startupIssues);
      }
    },
  });
}
