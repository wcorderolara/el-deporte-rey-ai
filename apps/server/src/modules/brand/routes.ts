/**
 * Brand library routes (contract operations listBrandAssets, registerBrandAsset, getBrandAsset, updateBrandAsset,
 * deleteBrandAsset, getBrandAssetFile, getBrandIdentity, updateBrandIdentity; PD-ARCH-01G-A).
 *
 * - Parameters, query and JSON bodies are validated with the contract schemas (400 `VALIDATION_FAILED` with closed
 *   pointers); success bodies are checked against their contract schemas before they are sent.
 * - The upload is the only route with the binary body exception (`image/png`, `image/jpeg`, `image/webp`) and
 *   the only route with a 5 MiB body limit (T10-F12). The platform guards (Host, Sec-Fetch-Site, client header and
 *   Origin, media type) run before the body is read.
 * - Files are served after a database lookup only, with the stored MIME type, `nosniff` and CORP `same-origin`
 *   (platform headers), `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: no-store` (OD-41)
 *   and an inline disposition with a server-generated file name (T11H-F11). GET handlers only read.
 */
import {
  AssetParamsSchema,
  BRAND_ASSET_MEDIA_TYPES,
  BrandAssetDetailSchema,
  BrandAssetListResponseSchema,
  BrandAssetRegisterQuerySchema,
  BrandAssetSchema,
  BrandAssetUpdateSchema,
  BrandIdentitySchema,
  BrandIdentityUpdateSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import {
  BRAND_UPLOAD_BODY_LIMIT,
  SANDBOXED_FILE_CONTENT_SECURITY_POLICY,
  binaryBodyRoute,
  routeBodyLimit,
} from '../../platform/http/index.js';

import type { BrandIdentityService } from './identity.js';
import type { BrandAssetService } from './service.js';
import { brandFileName } from './storage.js';

/** A success body that does not match its contract schema is a server defect (500 `INTERNAL`). */
export class BrandResponseError extends Error {
  override readonly name = 'BrandResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BrandResponseError();
  }
  return parsed.data;
}

/** The media type of a Content-Type header value: lowercase, without parameters, or null. */
export function declaredMediaType(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const essence = header.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return essence === '' ? null : essence;
}

export function registerBrandRoutes(
  app: FastifyInstance,
  service: BrandAssetService,
  identity: BrandIdentityService,
): void {
  app.get('/brand/assets', async () => contractResponse(BrandAssetListResponseSchema, { assets: service.list() }));

  app.post(
    '/brand/assets',
    {
      bodyLimit: routeBodyLimit(BRAND_UPLOAD_BODY_LIMIT),
      config: binaryBodyRoute(BRAND_ASSET_MEDIA_TYPES),
    },
    async (request, reply) => {
      const query = BrandAssetRegisterQuerySchema.parse(request.query);
      const asset = await service.register({
        kind: query.kind,
        label: query.label,
        description: query.description,
        usagePolicy: query.usagePolicy,
        official: query.official,
        variant: query.variant,
        pose: query.pose,
        expression: query.expression,
        declaredMediaType: declaredMediaType(request.headers['content-type']),
        content: request.body,
      });
      return reply.code(201).send(contractResponse(BrandAssetSchema, asset));
    },
  );

  app.get('/brand/assets/:assetId', async (request) => {
    const { assetId } = AssetParamsSchema.parse(request.params);
    return contractResponse(BrandAssetDetailSchema, service.detail(assetId));
  });

  app.patch('/brand/assets/:assetId', async (request) => {
    const { assetId } = AssetParamsSchema.parse(request.params);
    const body = BrandAssetUpdateSchema.parse(request.body);
    return contractResponse(BrandAssetSchema, service.update(assetId, body));
  });

  app.delete('/brand/assets/:assetId', async (request, reply) => {
    const { assetId } = AssetParamsSchema.parse(request.params);
    service.delete(assetId);
    return reply.code(204).send();
  });

  app.get('/brand/identity', async () => contractResponse(BrandIdentitySchema, identity.get()));

  app.patch('/brand/identity', async (request) => {
    const body = BrandIdentityUpdateSchema.parse(request.body);
    return contractResponse(BrandIdentitySchema, identity.update(body));
  });

  app.get('/brand/assets/:assetId/file', async (request, reply) => {
    const { assetId } = AssetParamsSchema.parse(request.params);
    const { asset, content } = await service.readFile(assetId);
    return reply
      .header('content-type', asset.mime)
      .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
      .header('cache-control', 'no-store')
      .header('content-disposition', `inline; filename="brand-asset-${brandFileName(asset.id, asset.mime)}"`)
      .send(content);
  });
}
