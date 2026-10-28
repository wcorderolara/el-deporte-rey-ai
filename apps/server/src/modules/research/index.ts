/**
 * Research module (architecture.md sections 4, 6 and 15; contracts/provider-ports.md section 3): the research stage
 * of the workflow. It retrieves the project's selection from its chosen source through the ingestion port only,
 * records the retrieval and the attributed observations, and records the standings availability on the run
 * (R-022, R-024, R-202, R-204, R-254, R-268, R-287). It has no routes.
 *
 * The verification stage reads the research results with `ResearchRepository` (`observations`, `retrievals`,
 * `standingsAvailability`) and `ResearchObservationValueSchema`.
 */
import type { ServerModule } from '../module-kit.js';

import { researchStage } from './stage.js';

export {
  ContextItemContentSchema,
  MAX_FACT_KEY_LENGTH,
  MAX_OBSERVATIONS,
  RETRIEVAL_OUTCOMES,
  type RefusedResearch,
  type RefusedRetrieval,
  type ResearchInput,
  ResearchInputSchema,
  type ResearchObservation,
  type ResearchObservationKind,
  ResearchObservationSchema,
  type ResearchObservationValue,
  ResearchObservationValueSchema,
  type ResearchOutput,
  ResearchOutputSchema,
  type ResearchRetrieval,
  ResearchRetrievalSchema,
  type RetrievedResearch,
  type StandingsAvailability,
  refusedResearch,
  researchFactKey,
  researchSnapshot,
  retrievalOutcomeOf,
  utcTime,
} from './core.js';
export { ResearchRepository, type StoredObservation, type StoredRetrieval } from './repository.js';
export { type ResearchStageOptions, createResearchStage, researchStage } from './stage.js';

/** The research module of the static registry: the research stage, no routes. */
export const serverModule: ServerModule = { name: 'research', stages: [researchStage] };
