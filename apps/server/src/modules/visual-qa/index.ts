/**
 * Visual QA module (architecture.md sections 4, 6 and 10; AD-12; OD-09, OD-26, OD-38): deterministic checks on the
 * stored render model, the stored text and the PNG header of every slide version (`data_match`, `team_names`,
 * `text_fit`, `style_consistency`, `dimensions`) and on the AI-written text of every element version
 * (`capitalized_tokens`), recorded per version and check in `qa_results` with the version's `qa_status`. It has no
 * routes: the QA acknowledgement and the approval guards belong to the review module (T37).
 *
 * Integration points:
 * - review (T37): `qaElementVersion` (QA of a regenerated element version after `renderElementVersion`),
 *   `QaVersionRefused`, `CHECK_SEVERITY` and `qaStatusOf`.
 */
import type { ServerModule } from '../module-kit.js';

import { type VisualQaOptions, createVisualQaStage } from './stage.js';

export {
  CHECK_SEVERITY,
  DETAIL_LIMITS,
  type QaContext,
  allowedTokensOf,
  capitalizedTokens,
  capitalizedTokensOf,
  checkVersion,
  dataMatch,
  dimensions,
  fitsBox,
  qaContext,
  qaStatusOf,
  runVisualQa,
  styleConsistency,
  teamNames,
  textFit,
} from './core.js';
export { VisualQaRepository } from './repository.js';
export {
  type QaStatus,
  QaStatusSchema,
  type VersionResult,
  type VersionToCheck,
  type VisualQaInput,
  VisualQaInputSchema,
  type VisualQaOutput,
  VisualQaOutputSchema,
} from './schemas.js';
export {
  type QaVersionRefusal,
  QaVersionRefused,
  type VisualQaOptions,
  createVisualQaStage,
  qaElementVersion,
  visualQaStage,
} from './stage.js';
export { LANGUAGE_WORDS, isListedWord } from './words.js';

/** The visual QA module with the given options (tests pass their own fonts or ID generator). */
export function createVisualQaModule(options: VisualQaOptions = {}): ServerModule {
  return { name: 'visual-qa', stages: [createVisualQaStage(options) as never] };
}

/** The visual QA module of the static registry. */
export const serverModule: ServerModule = createVisualQaModule();
