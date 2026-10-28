/**
 * Sports-data ingestion entry point (contracts/provider-ports.md section 1; AD-21 to AD-23, AD-37).
 *
 * `createSportsSources(config, deps, testSeam?)` builds the source registry from the adapter registry and the
 * configuration, runs the startup validation (adapter kinds and modes, link names, every enabled adapter's
 * `validateStartup`; OD-20) and attaches the catalogue service. Downstream code depends only on this entry point and
 * the provider-neutral ingestion layer, never on an adapter (R-118, R-268).
 *
 * `testSeam.extraAdapters` registers test-only adapter kinds (for example `test-live`, declared mode LIVE_DATA; OD-24,
 * AD-37). Only the test support app factory passes it; `container.ts` never does, and no committed configuration
 * names a test-only kind.
 */
import { ADAPTER_REGISTRATIONS } from './adapters/index.js';
import {
  type AdapterRegistration,
  type CatalogueService,
  type SourceRegistry as IngestionRegistry,
  type SportsConfig,
  type SportsDeps,
  createCatalogueService,
  createSourceRegistry,
} from './ingestion/index.js';

export * from './ingestion/index.js';

/** The source registry with its catalogue service. */
export interface SourceRegistry extends IngestionRegistry {
  readonly catalogue: CatalogueService;
}

/** Test-only registrations; never passed by the composition root. */
export interface SportsTestSeam {
  readonly extraAdapters?: readonly AdapterRegistration[];
}

/** The adapter kinds of the production adapter registry. */
export const ADAPTER_KINDS: readonly string[] = Object.freeze(ADAPTER_REGISTRATIONS.map((entry) => entry.kind));

/**
 * Builds and validates the sports-data sources. Throws a `ConfigError` naming every startup problem; never a value.
 * A test-only kind that repeats a registered kind is refused.
 */
export function createSportsSources(config: SportsConfig, deps: SportsDeps, testSeam?: SportsTestSeam): SourceRegistry {
  const registrations = [...ADAPTER_REGISTRATIONS, ...(testSeam?.extraAdapters ?? [])];
  const registry = createSourceRegistry(config, deps, registrations);
  registry.validateStartup();
  return Object.freeze({
    descriptors: registry.descriptors,
    sourceIds: registry.sourceIds,
    get: registry.get,
    list: registry.list,
    validateStartup: registry.validateStartup,
    catalogue: createCatalogueService(registry, config.catalogue),
  });
}
