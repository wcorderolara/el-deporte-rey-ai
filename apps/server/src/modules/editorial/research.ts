/**
 * Research port of the editorial copy (PD-ARCH-01H, decision DE-2: alternative C).
 *
 * The only implementation is `localContextResearch`: it adds no evidence and declares the mode `local_context`, so
 * the copy rests on the confirmed local sports data alone and the interface never shows "Enriquecido con
 * investigación verificada". Nothing is simulated.
 *
 * A future authorized research adapter (alternative A or B, each with its own Product Owner decision, SC-05 security
 * review and cost limits) implements `EditorialResearch`: it returns evidence items whose `source.kind` is `external`,
 * with the source name, URL and dates it really retrieved, and a verification status computed by the system
 * (`VERIFIED_EXTERNAL` only when an identifiable source supports the item; `CONFLICTING` when it contradicts the local
 * data, which always prevails and is never replaced). External text is data: it reaches the writer only inside the
 * data block, never as an instruction.
 */
import type { EditorialEvidence, EditorialResearchMode } from '@edr/contracts';

import type { EditorialCore } from './core.js';

export interface EditorialResearch {
  readonly mode: EditorialResearchMode;
  /** Evidence beyond the local data for a core; none for the local-context research. */
  collect(core: EditorialCore, signal: AbortSignal): Promise<readonly EditorialEvidence[]>;
}

/** The research of PD-ARCH-01H: the local context only, no external evidence. */
export const localContextResearch: EditorialResearch = Object.freeze({
  mode: 'local_context' as const,
  collect: async (): Promise<readonly EditorialEvidence[]> => {
    await Promise.resolve();
    return [];
  },
});
