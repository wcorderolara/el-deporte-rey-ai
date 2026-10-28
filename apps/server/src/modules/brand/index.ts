/**
 * Brand module (architecture.md section 4 `modules/brand`; data-model.md `brand_assets`; R-033, R-034, R-228, R-231):
 * the brand asset registry, its routes and the lookup the renderer uses.
 *
 * - Routes: listBrandAssets, registerBrandAsset, updateBrandAsset, getBrandAssetFile (`routes.ts`).
 * - Renderer lookup (`brandAssetLookup`): the active assets of a kind in registration order, and the verified bytes
 *   of an asset, to be embedded as a `data:` URI with the asset's MIME type (T10-F09). Templates draw an image slot
 *   only when an active asset of that kind exists (R-034); there is no badge or competition-mark kind (PD-03, R-231).
 */
import type { BrandAsset, BrandAssetKind } from '@edr/contracts';

import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';

import { type ImageDecodeCheck, resvgDecodeCheck } from './decode.js';
import { BrandAssetRepository } from './repository.js';
import { registerBrandRoutes } from './routes.js';
import { type BrandAssetFile, BrandAssetService } from './service.js';
import { BrandFileStore } from './storage.js';

export { type ImageDecodeCheck, resvgDecodeCheck } from './decode.js';
export { MAX_IMAGE_DIMENSION, type ImageHeader, detectImageType, readImageHeader } from './image.js';
export { type BrandAssetFile, BrandAssetService, BrandFileIntegrityError } from './service.js';
export { BRAND_ASSET_DIRECTORY, BrandFileError } from './storage.js';

export interface BrandModuleOptions {
  /** Decode check; default resvg (`decode.ts`). */
  readonly decodeCheck?: ImageDecodeCheck;
  /** ID generator; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

/** The brand asset service of a container. */
export function createBrandAssetService(container: AppContainer, options: BrandModuleOptions = {}): BrandAssetService {
  return new BrandAssetService({
    repository: new BrandAssetRepository(container.db),
    files: new BrandFileStore(container.paths.dataDir),
    clock: container.clock,
    decodeCheck: options.decodeCheck ?? resvgDecodeCheck,
    ...(options.newId === undefined ? {} : { newId: options.newId }),
  });
}

/** What the renderer needs from the brand registry. */
export interface BrandAssetLookup {
  /** The active assets of a kind in registration order (empty when none is registered or active). */
  activeAssets(kind: BrandAssetKind): readonly BrandAsset[];
  /**
   * The bytes of a registered asset, read from its confined path and checked against the recorded SHA-256.
   * Rejects with `NOT_FOUND` for an unknown ID and with an internal error for a missing or altered file.
   */
  readFile(assetId: string): Promise<BrandAssetFile>;
}

/** The renderer's lookup over the container's database and data directory. */
export function brandAssetLookup(container: AppContainer): BrandAssetLookup {
  const service = createBrandAssetService(container);
  return {
    activeAssets: (kind) => service.activeByKind(kind),
    readFile: (assetId) => service.readFile(assetId),
  };
}

/** The brand module; tests pass their own decode check or ID generator. */
export function createBrandModule(options: BrandModuleOptions = {}): ServerModule {
  return {
    name: 'brand',
    routes: async (app, container) => {
      registerBrandRoutes(app, createBrandAssetService(container, options));
      await Promise.resolve();
    },
  };
}

/** The brand module of the static registry. */
export const serverModule: ServerModule = createBrandModule();
