/**
 * Sports-data ingestion entry point (contracts/provider-ports.md section 1).
 *
 * Stub created by T15. T21 replaces it with `createSportsSources(config, deps, testSeam?)`, the ingestion port, the
 * source registry and the catalogue service. Downstream code depends only on this entry point, never on an adapter.
 */

/** Registry of the enabled sports-data sources (stub shape; T21 defines the full interface). */
export interface SourceRegistry {
  readonly sourceIds: readonly string[];
}

export function createSportsSources(): SourceRegistry {
  throw new Error('sports-data sources are not available yet');
}
