/**
 * Brand and template operations of the HTTP contract (`contracts/http-api.openapi.yaml` 1.0.0): listBrandAssets,
 * registerBrandAsset, updateBrandAsset, getBrandAssetFile, listTemplates and previewTemplate.
 *
 * - JSON operations go through the shared API client (client header on mutating requests, problem+json parsing,
 *   response validation with the `@edr/contracts` schemas).
 * - registerBrandAsset sends the raw image (`image/png` or `image/jpeg`), which the shared client does not support
 *   (it sends JSON bodies only). The upload therefore uses the same fetch, headers and error model here: same origin,
 *   `X-EDR-Client: web`, no redirects, no cache, problem+json parsed with the shared `parseProblem` into an `ApiError`.
 * - Images (asset files and template previews) are shown only through API URLs built from contract-validated IDs.
 */
import {
  BRAND_ASSET_MEDIA_TYPES,
  BrandAssetDetailSchema,
  BrandAssetListResponseSchema,
  BrandAssetSchema,
  BrandIdentitySchema,
  TemplateListResponseSchema,
  type BrandAsset,
  type BrandAssetDetail,
  type BrandAssetKind,
  type BrandAssetMime,
  type BrandAssetUsagePolicy,
  type BrandIdentity,
  type Language,
  type Template,
} from '@edr/contracts';
import type { BrandAssetUpdate, BrandIdentityUpdate } from '@edr/contracts';

import {
  API_BASE_PATH,
  ApiError,
  CLIENT_HEADER,
  CLIENT_HEADER_VALUE,
  createApiClient,
  parseProblem,
  type FetchFunction,
} from '../../api/client';

/** Maximum size of a brand asset upload (contract registerBrandAsset: at most 5 MiB). */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

/** File picker filter: PNG and JPEG only (T10-F12). */
/** PNG and JPEG for every category; WebP for style references only (PD-ARCH-01G-A). */
export const ASSET_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg';
export const REFERENCE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

export function isAssetMime(value: string): value is BrandAssetMime {
  return (BRAND_ASSET_MEDIA_TYPES as readonly string[]).includes(value);
}

export interface RegisterAssetInput {
  kind: BrandAssetKind;
  label: string;
  /** The image; its `type` must be `image/png`, `image/jpeg` or (style references) `image/webp`. */
  file: Blob;
  description?: string;
  usagePolicy?: BrandAssetUsagePolicy;
  official?: boolean;
  variant?: string;
  pose?: string;
  expression?: string;
}

export type UpdateAssetInput = BrandAssetUpdate;
export type UpdateIdentityInput = BrandIdentityUpdate;

export interface BrandApi {
  listAssets(signal?: AbortSignal): Promise<BrandAsset[]>;
  registerAsset(input: RegisterAssetInput, signal?: AbortSignal): Promise<BrandAsset>;
  setAssetActive(assetId: string, active: boolean, signal?: AbortSignal): Promise<BrandAsset>;
  getAsset(assetId: string, signal?: AbortSignal): Promise<BrandAssetDetail>;
  updateAsset(assetId: string, input: UpdateAssetInput, signal?: AbortSignal): Promise<BrandAsset>;
  /** Logical deletion; refused with ASSET_IN_USE while rendered content uses the asset. */
  deleteAsset(assetId: string, signal?: AbortSignal): Promise<void>;
  getIdentity(signal?: AbortSignal): Promise<BrandIdentity>;
  updateIdentity(input: UpdateIdentityInput, signal?: AbortSignal): Promise<BrandIdentity>;
  listTemplates(signal?: AbortSignal): Promise<Template[]>;
  /** URL of getBrandAssetFile. */
  assetFileUrl(assetId: string): string;
  /** URL of previewTemplate in the given language. */
  templatePreviewUrl(templateId: string, language: Language): string;
}

export interface BrandApiOptions {
  /** Base path of the API; same origin. Defaults to `/api/v1`. */
  basePath?: string;
  /** Injected for tests; defaults to the platform `fetch`. */
  fetch?: FetchFunction;
}

const JSON_TYPE = 'application/json';
const PROBLEM_TYPE = 'application/problem+json';

function mediaType(response: Response): string {
  return (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: (await response.json()) as unknown };
  } catch {
    return { ok: false };
  }
}

async function errorOf(response: Response): Promise<ApiError> {
  const type = mediaType(response);
  if (type === PROBLEM_TYPE || type === JSON_TYPE) {
    const body = await readJson(response);
    const problem = body.ok ? parseProblem(body.value, response.status) : null;
    if (problem !== null) {
      return new ApiError('problem', { status: response.status, problem });
    }
  }
  return new ApiError('http', { status: response.status });
}

export function createBrandApi(options: BrandApiOptions = {}): BrandApi {
  const basePath = options.basePath ?? API_BASE_PATH;
  const fetchFunction: FetchFunction = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const client = createApiClient({ basePath, fetch: fetchFunction });

  async function registerAsset(input: RegisterAssetInput, signal?: AbortSignal): Promise<BrandAsset> {
    if (!isAssetMime(input.file.type) || (input.file.type === 'image/webp' && input.kind !== 'style_reference')) {
      throw new TypeError('Brand assets must be PNG or JPEG images (WebP for style references only)');
    }
    const query = new URLSearchParams({ kind: input.kind, label: input.label });
    for (const key of ['description', 'usagePolicy', 'variant', 'pose', 'expression'] as const) {
      const value = input[key];
      if (value !== undefined && value !== '') {
        query.set(key, value);
      }
    }
    if (input.official !== undefined) {
      query.set('official', String(input.official));
    }
    const init: RequestInit = {
      method: 'POST',
      headers: {
        Accept: `${JSON_TYPE}, ${PROBLEM_TYPE}`,
        [CLIENT_HEADER]: CLIENT_HEADER_VALUE,
        'Content-Type': input.file.type,
      },
      body: input.file,
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
    };
    if (signal !== undefined) {
      init.signal = signal;
    }

    let response: Response;
    try {
      response = await fetchFunction(`${basePath}/brand/assets?${query.toString()}`, init);
    } catch (cause) {
      throw new ApiError(isAbortError(cause) || signal?.aborted === true ? 'aborted' : 'network', { cause });
    }
    if (!response.ok) {
      throw await errorOf(response);
    }
    if (mediaType(response) !== JSON_TYPE) {
      throw new ApiError('invalid_response', { status: response.status });
    }
    const body = await readJson(response);
    const parsed = body.ok ? BrandAssetSchema.safeParse(body.value) : null;
    if (parsed === null || !parsed.success) {
      throw new ApiError('invalid_response', { status: response.status });
    }
    return parsed.data;
  }

  return {
    async listAssets(signal) {
      const body = await client.get('/brand/assets', {
        schema: BrandAssetListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return body.assets;
    },
    registerAsset,
    setAssetActive(assetId, active, signal) {
      return client.patch(
        `/brand/assets/${encodeURIComponent(assetId)}`,
        { active },
        { schema: BrandAssetSchema, ...(signal === undefined ? {} : { signal }) },
      );
    },
    getAsset(assetId, signal) {
      return client.get(`/brand/assets/${encodeURIComponent(assetId)}`, {
        schema: BrandAssetDetailSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    updateAsset(assetId, input, signal) {
      return client.patch(`/brand/assets/${encodeURIComponent(assetId)}`, input, {
        schema: BrandAssetSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async deleteAsset(assetId, signal) {
      await client.delete(`/brand/assets/${encodeURIComponent(assetId)}`, {
        ...(signal === undefined ? {} : { signal }),
      });
    },
    getIdentity(signal) {
      return client.get('/brand/identity', {
        schema: BrandIdentitySchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    updateIdentity(input, signal) {
      return client.patch('/brand/identity', input, {
        schema: BrandIdentitySchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    async listTemplates(signal) {
      const body = await client.get('/templates', {
        schema: TemplateListResponseSchema,
        ...(signal === undefined ? {} : { signal }),
      });
      return body.templates;
    },
    assetFileUrl(assetId) {
      return `${basePath}/brand/assets/${encodeURIComponent(assetId)}/file`;
    },
    templatePreviewUrl(templateId, language) {
      return `${basePath}/templates/${encodeURIComponent(templateId)}/preview?${new URLSearchParams({ language }).toString()}`;
    },
  };
}

/** API used by the brand feature in the application. */
export const brandApi: BrandApi = createBrandApi();
