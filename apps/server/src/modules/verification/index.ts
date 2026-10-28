/**
 * Verification module (architecture.md sections 4, 6 and 7; contracts/provider-ports.md section 3): the
 * verification stage (two-source rule, disputes and official-publication consultation, team identity and official
 * names, manual eligibility and carry-over), the facts routes (listFacts, approveFactManually,
 * revokeManualFactApproval) and the publishability function used by content and review (section 7.4, AD-38).
 */
import type { ServerModule } from '../module-kit.js';

import { registerFactRoutes } from './routes.js';
import { VerificationService } from './service.js';
import { verificationStage } from './stage.js';

export { canonicalMatchKey, kickoffMinute, verifyRun, type VerifyInput, type VerifyResult } from './core.js';
export { canonicalJson, counts, decideFact, decideTeamName, type Decision, type SourceInfo } from './decision.js';
export {
  derivedTeamId,
  IdentityMapSchema,
  loadIdentityMap,
  normalizeTeamName,
  placeholderTeamId,
  TEAM_IDENTITIES_DIRECTORY,
} from './identity.js';
export {
  isOperatorAttestedCompetition,
  type Publishability,
  publishability,
  type PublishabilityFact,
  type PublishabilitySettings,
  publishabilitySettings,
} from './publishability.js';
export { isManuallyApproved, VerificationService, type VerificationServiceOptions } from './service.js';
export {
  createVerificationStage,
  type VerificationInput,
  type VerificationOutput,
  verificationStage,
} from './stage.js';

/** The verification module of the static registry: the verification stage and the facts routes. */
export const serverModule: ServerModule = {
  name: 'verification',
  stages: [verificationStage],
  routes: async (app, container) => {
    registerFactRoutes(app, new VerificationService({ container }));
    await Promise.resolve();
  },
};
