/**
 * Design module (PD-ARCH-01G-B): visual proposals generated with the configured image provider from the brand
 * identity and the brand library, their asynchronous generations and their human review.
 *
 * - Routes: `routes.ts` (capabilities, model access check, estimate, generation, status, events, proposals, file,
 *   decision).
 * - Startup: generations left running by a previous process are marked failed (`INTERRUPTED`).
 * - Files: `<dataDir>/design-proposals/<id>.png|jpg`, through the brand module's confined file store.
 * - Nothing here changes a template, a brand asset, a project or the slide renderer.
 */
import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';
import { BrandFileStore, brandContextOf, createBrandAssetService } from '../brand/index.js';

import { DesignRepository } from './repository.js';
import { registerDesignRoutes } from './routes.js';
import { DesignService } from './service.js';

/** Directory of the proposal files inside the data directory. */
export const DESIGN_PROPOSAL_DIRECTORY = 'design-proposals';
/** Largest proposal file read back (a 1792-pixel PNG stays well below it). */
export const MAX_PROPOSAL_FILE_BYTES = 32 * 1024 * 1024;

export { DESIGN_PROMPT_VERSION, buildDesignPrompt } from './prompt.js';
export { ROLES_BY_POLICY, allowsRole } from './policies.js';
export { type DesignTemplateSource, DesignService } from './service.js';
export type { ProposalLayer } from './repository.js';
export { proposalSize } from './sizes.js';

export interface DesignModuleOptions {
  /** ID generator; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

const services = new WeakMap<AppContainer, DesignService>();

/** The design service of a container (one per container, so runs and event listeners are shared). */
export function designServiceOf(container: AppContainer, options: DesignModuleOptions = {}): DesignService {
  let service = services.get(container);
  if (service === undefined) {
    service = new DesignService({
      repository: new DesignRepository(container.db),
      files: new BrandFileStore(container.paths.dataDir, {
        directory: DESIGN_PROPOSAL_DIRECTORY,
        maxFileBytes: MAX_PROPOSAL_FILE_BYTES,
      }),
      provider: container.imageProvider,
      brandAssets: createBrandAssetService(container),
      brandContext: () => brandContextOf(container),
      clock: container.clock,
      logger: container.logger,
      ...(options.newId === undefined ? {} : { newId: options.newId }),
    });
    services.set(container, service);
  }
  return service;
}

export function createDesignModule(options: DesignModuleOptions = {}): ServerModule {
  return {
    name: 'design',
    onStartup: async (container) => {
      const interrupted = designServiceOf(container, options).recoverInterrupted();
      if (interrupted > 0) {
        container.logger.info({ interrupted }, 'interrupted design generations marked failed');
      }
      await Promise.resolve();
    },
    routes: async (app, container) => {
      registerDesignRoutes(app, designServiceOf(container, options));
      await Promise.resolve();
    },
  };
}

export const serverModule: ServerModule = createDesignModule();
