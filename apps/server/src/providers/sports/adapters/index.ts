/**
 * Adapter registry (contracts/provider-ports.md section 1.2; AD-22, R-118): the only place adapter kinds are listed.
 * Each entry maps a kind to its factory and its declared data mode. Adding a provider is one adapter directory, one
 * line here and configuration. Test-only kinds (for example `test-live`) are never listed here; they are registered
 * only through the `createSportsSources` test seam.
 */
import type { AdapterRegistration } from '../ingestion/index.js';

import { fixtureAdapter } from './fixture/index.js';
import { footballDataAdapter } from './football-data/index.js';
import { manualAdapter } from './manual/index.js';

export const ADAPTER_REGISTRATIONS: readonly AdapterRegistration[] = Object.freeze([
  fixtureAdapter,
  footballDataAdapter,
  manualAdapter,
]);
