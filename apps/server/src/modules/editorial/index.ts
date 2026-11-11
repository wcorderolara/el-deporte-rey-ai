/**
 * Editorial module (PD-ARCH-01H): the editorial copy of a project (Facebook/Instagram, TikTok/Reels, three viral
 * headlines, YouTube and a debate question), written by the editorial writer from the confirmed sports context of the
 * project's draft, with its deterministic key events, evidence, checks, versions and approvals. It reads the content
 * module's facts and plan and never changes drafts, carousels, approvals of slides or exports.
 *
 * `onStartup` marks the generations a restart interrupted as failed (`interrupted`).
 */
import type { ServerModule } from '../module-kit.js';

import { registerEditorialRoutes } from './routes.js';
import { EditorialService } from './service.js';

export { type ComposedVersion, composeDeliverable, countWords, rawOfEdit, retokenize } from './compose.js';
export {
  EDITORIAL_LIMITS,
  EDITORIAL_NUMBER_WORD_EXEMPTIONS,
  type EditorialCore,
  type EditorialInput,
  type EditorialMatchEntry,
  MAX_MATCH_EVENTS,
  buildEditorialCore,
  buildEditorialRequest,
  roundStateOf,
} from './core.js';
export { computedCost, estimateCost, utcDayStart, utcMonthStart } from './cost.js';
export { EditorialRepository } from './repository.js';
export { type EditorialResearch, localContextResearch } from './research.js';
export { EditorialResponseError, registerEditorialRoutes } from './routes.js';
export { EditorialService, type EditorialServiceOptions } from './service.js';

export const serverModule: ServerModule = {
  name: 'editorial',
  routes: async (app, container) => {
    await Promise.resolve();
    registerEditorialRoutes(app, new EditorialService(container));
  },
  onStartup: async (container) => {
    await Promise.resolve();
    const interrupted = new EditorialService(container).interruptRunning();
    if (interrupted > 0) {
      container.logger.warn({ interrupted }, 'editorial generations interrupted by a restart');
    }
  },
};
