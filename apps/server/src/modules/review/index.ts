/**
 * Review module (architecture.md sections 4, 7.4, 11.1 and 11.2; AD-13; OD-09, OD-42, OD-49): the active draft view,
 * the slide image route, element approval and withdrawal bound to the exact version, QA acknowledgement, the
 * regeneration of one element (content, rendering and visual QA modules), and the final approval of a carousel with
 * its version set and SHA-256. Publishability comes only from the verification module's function, through the
 * content module's blocked overlay.
 *
 * `onStartup` invalidates the final approvals that no longer hold under the current configuration (a stricter
 * manual-approval policy, a competition link no longer marked, a publication permission no longer confirmed).
 *
 * Integration points: export (T38) reads `final_approvals` and may use `versionSetOf` to recompute a set's hash.
 */
import type { ServerModule } from '../module-kit.js';
import type { RenderingOptions } from '../rendering/index.js';
import type { VisualQaOptions } from '../visual-qa/index.js';

import { registerReviewRoutes } from './routes.js';
import { ReviewService } from './service.js';

export { ReviewRepository, type StoredFinalApproval, VersionSetSchema } from './repository.js';
export { ReviewResponseError, registerReviewRoutes } from './routes.js';
export { ReviewService, type ReviewServiceOptions } from './service.js';
export {
  type ApprovalRefusal,
  type ApprovalRefusalCode,
  type QaSnapshot,
  type StoredQaStatus,
  type VersionSet,
  type VersionSnapshot,
  approvalRefusal,
  finalApprovalReasons,
  hasBlockingQaFailure,
  hasUnacknowledgedWarning,
  sameVersionSet,
  versionSetOf,
  versionState,
} from './state.js';

/** Options of the review module (tests pass their own fonts, brand asset lookup or ID generator). */
export interface ReviewModuleOptions {
  readonly rendering?: RenderingOptions;
  readonly visualQa?: VisualQaOptions;
  readonly newId?: () => string;
}

/** The review module with the given options. */
export function createReviewModule(options: ReviewModuleOptions = {}): ServerModule {
  const serviceFor = (container: Parameters<NonNullable<ServerModule['onStartup']>>[0]): ReviewService =>
    new ReviewService({ container, ...options });
  return {
    name: 'review',
    onStartup: async (container) => {
      const invalidated = serviceFor(container).invalidateStaleFinalApprovals();
      if (invalidated > 0) {
        container.logger.warn(
          { finalApprovals: invalidated },
          'final approvals invalidated: they no longer hold under the current configuration',
        );
      }
      await Promise.resolve();
    },
    routes: async (app, container) => {
      registerReviewRoutes(app, serviceFor(container));
      await Promise.resolve();
    },
  };
}

/** The review module of the static registry. */
export const serverModule: ServerModule = createReviewModule();
