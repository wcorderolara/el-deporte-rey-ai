/**
 * Brand module (architecture.md section 4 `modules/brand`; data-model.md `brand_assets`, `brand_identity`; R-033,
 * R-034, R-228, R-231; PD-ARCH-01G-A): the brand library and identity, their routes, the lookup the renderer uses and
 * the brand context prepared for later AI design work.
 *
 * - Routes: listBrandAssets, registerBrandAsset, getBrandAsset, updateBrandAsset, deleteBrandAsset,
 *   getBrandAssetFile, getBrandIdentity, updateBrandIdentity (`routes.ts`).
 * - Renderer lookup (`brandAssetLookup`): the drawable assets of a slot with the one to draw last (the primary, or
 *   the most recently registered active one), and the verified bytes of an asset, to be embedded as a `data:` URI
 *   with the asset's MIME type (T10-F09). Templates draw an image slot only when such an asset exists (R-034); style
 *   references and `reference_only` assets are never drawn; there is no badge or competition-mark kind (PD-03).
 * - Startup: measures the file size of assets registered before PD-ARCH-01G-A.
 * - Brand context (`brandContextOf`): internal only, never served and never sent to a provider in 01G-A.
 */
import type { BrandAssetKind } from '@edr/contracts';

import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';

import { type BrandContext, buildBrandContext } from './context.js';
import { type ImageDecodeCheck, resvgDecodeCheck } from './decode.js';
import { BrandIdentityService } from './identity.js';
import { BrandAssetRepository } from './repository.js';
import { registerBrandRoutes } from './routes.js';
import { type BrandAssetFile, BrandAssetService, type DrawableBrandAsset } from './service.js';
import { BrandFileStore } from './storage.js';

export {
  type AssetPermissions,
  type BrandContext,
  type BrandContextAsset,
  BRAND_CONTEXT_FORMAT,
  BrandContextSchema,
  permissionsOf,
} from './context.js';
export { type ImageDecodeCheck, resvgDecodeCheck } from './decode.js';
export { BrandIdentityService } from './identity.js';
export { MAX_IMAGE_DIMENSION, type ImageHeader, detectImageType, readImageHeader } from './image.js';
export { type BrandAssetFile, BrandAssetService, BrandFileIntegrityError, type DrawableBrandAsset } from './service.js';
export { BRAND_ASSET_DIRECTORY, BrandFileError, BrandFileStore, type FileStoreLayout } from './storage.js';

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

/** The identity service of a container. */
export function createBrandIdentityService(container: AppContainer): BrandIdentityService {
  return new BrandIdentityService({
    repository: new BrandAssetRepository(container.db),
    brand: container.config.brand,
    clock: container.clock,
  });
}

/** The brand context of a container (internal; PD-ARCH-01G-B will consume it). */
export function brandContextOf(container: AppContainer): BrandContext {
  return buildBrandContext(createBrandIdentityService(container), createBrandAssetService(container));
}

/** What the renderer needs from the brand registry. */
export interface BrandAssetLookup {
  /**
   * The drawable assets of a slot, the one to draw last: active PNG or JPEG assets that are not `reference_only`,
   * with the primary moved to the end (empty when none exists).
   */
  activeAssets(kind: BrandAssetKind): readonly DrawableBrandAsset[];
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
    activeAssets: (kind) => service.drawableByKind(kind),
    readFile: (assetId) => service.readFile(assetId),
  };
}

/** The brand module; tests pass their own decode check or ID generator. */
export function createBrandModule(options: BrandModuleOptions = {}): ServerModule {
  return {
    name: 'brand',
    onStartup: async (container) => {
      const { measured, failed } = await createBrandAssetService(container, options).measureLegacyFiles();
      if (measured > 0 || failed > 0) {
        container.logger.info({ measured, failed }, 'brand asset file sizes measured');
      }
    },
    routes: async (app, container) => {
      registerBrandRoutes(app, createBrandAssetService(container, options), createBrandIdentityService(container));
      await Promise.resolve();
    },
  };
}

/** The brand module of the static registry. */
export const serverModule: ServerModule = createBrandModule();
