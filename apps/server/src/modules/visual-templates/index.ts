/**
 * Visual templates module (PD-ARCH-01G-C): structured, versioned templates made from approved design proposals, with
 * layers over the proposal's background, brand assets of Mi marca, sports-data bindings of a closed catalogue,
 * validation, publication and previews with local sports data drawn by the slide engine.
 *
 * - Routes: `routes.ts`. Persistence: `repository.ts` (migration 0029). Catalogue and local data: `catalog.ts`.
 *   Checks: `validation.ts` and `contrast.ts`. Rendering: the rendering module's `buildStructuredModel` and
 *   `renderSlide`, the same engine as the slides.
 * - It reads design proposals and brand assets through their services and never changes them; it calls no AI
 *   provider. The built-in templates of the rendering module are unchanged and coexist with these.
 */
import type { AppContainer } from '../../container.js';
import { createBrandAssetService } from '../brand/index.js';
import { teamBadgeServiceOf } from '../competitions/badges/index.js';
import { designServiceOf } from '../design/index.js';
import type { ServerModule } from '../module-kit.js';
import { type FontSet, fontSetFor, loadBundledFaces } from '../rendering/index.js';

import { VisualTemplateRepository } from './repository.js';
import { registerVisualTemplateRoutes } from './routes.js';
import { VisualTemplateService } from './service.js';

export { BINDING_ELEMENT, STRESS_VALUES, bindingAllowed, readSelection, resolveBinding } from './catalog.js';
export { PREVIEW_CACHE_ENTRIES, VisualTemplateService } from './service.js';
export { issueOf } from './issues.js';
export { validateVersion } from './validation.js';

export interface VisualTemplateModuleOptions {
  /** ID generator; default `crypto.randomUUID`. */
  readonly newId?: () => string;
  /** Fonts; default the bundled faces of the configured brand roles. */
  readonly fonts?: (container: AppContainer) => FontSet;
}

const services = new WeakMap<AppContainer, VisualTemplateService>();

/** The visual template service of a container (one per container, so its caches are shared). */
export function visualTemplateServiceOf(
  container: AppContainer,
  options: VisualTemplateModuleOptions = {},
): VisualTemplateService {
  let service = services.get(container);
  if (service === undefined) {
    const fonts = options.fonts ?? ((owner: AppContainer) => fontSetFor(owner.config.brand.fonts, loadBundledFaces()));
    service = new VisualTemplateService({
      repository: new VisualTemplateRepository(container.db),
      db: container.db,
      design: designServiceOf(container),
      brandAssets: createBrandAssetService(container),
      badges: teamBadgeServiceOf(container),
      fonts: () => fonts(container),
      palette: { ...container.config.brand.palette },
      utcOffsetMinutes: container.config.display.utcOffsetMinutes,
      clock: container.clock,
      logger: container.logger,
      ...(options.newId === undefined ? {} : { newId: options.newId }),
    });
    services.set(container, service);
  }
  return service;
}

export function createVisualTemplateModule(options: VisualTemplateModuleOptions = {}): ServerModule {
  return {
    name: 'visual-templates',
    routes: async (app, container) => {
      registerVisualTemplateRoutes(app, visualTemplateServiceOf(container, options));
      await Promise.resolve();
    },
  };
}

export const serverModule: ServerModule = createVisualTemplateModule();
