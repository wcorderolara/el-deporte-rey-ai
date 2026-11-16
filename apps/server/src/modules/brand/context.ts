/**
 * Brand context (PD-ARCH-01G-A): the internal description of the brand that a later AI design proposal (PD-ARCH-01G-B)
 * receives. It is built from the identity and the active library assets only; it is not served by any route and
 * nothing here calls a provider.
 *
 * - Each asset carries its usage policy and the permissions derived from it, so a consumer never has to interpret the
 *   policy itself: `protected` assets are placed unchanged (scale and position only), `reference_only` assets only
 *   inform the style, `reusable` assets may be placed directly and only `transformable` assets may seed AI variants.
 * - The context holds no file bytes, no file path and no URL: a consumer that needs an image asks the brand module
 *   for the hash-checked bytes of an asset ID it was given here, and must refuse to send one whose permissions do
 *   not allow the intended use.
 * - Deactivated and deleted assets are left out; the primary logo and mascot are marked.
 */
import {
  BrandAssetKindSchema,
  BrandAssetUsagePolicySchema,
  BrandIdentitySchema,
  LabelSchema,
  Sha256Schema,
  UuidSchema,
  type BrandAssetUsagePolicy,
} from '@edr/contracts';
import { z } from 'zod';

import type { BrandIdentityService } from './identity.js';
import type { BrandAssetService } from './service.js';

/** Identifier of the brand context format. */
export const BRAND_CONTEXT_FORMAT = 'edr-brand-context/1';

/** What an asset may be used for, derived from its usage policy. */
export const AssetPermissionsSchema = z.strictObject({
  /** Placed in content (composed into a slide). */
  placeInContent: z.boolean(),
  /** Its pixels may be changed by generation (beyond scale and position). */
  alterPixels: z.boolean(),
  /** May seed AI-generated variants. */
  generateVariants: z.boolean(),
  /** May inform the visual style of a proposal. */
  styleReference: z.boolean(),
});

export const BrandContextAssetSchema = z.strictObject({
  id: UuidSchema,
  kind: BrandAssetKindSchema,
  label: LabelSchema,
  description: z.string().nullable(),
  variant: z.string().nullable(),
  pose: z.string().nullable(),
  expression: z.string().nullable(),
  official: z.boolean(),
  primary: z.boolean(),
  usagePolicy: BrandAssetUsagePolicySchema,
  permissions: AssetPermissionsSchema,
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z.int().min(1),
  height: z.int().min(1),
  sha256: Sha256Schema,
});

export const BrandContextSchema = z.strictObject({
  format: z.literal(BRAND_CONTEXT_FORMAT),
  identity: BrandIdentitySchema.omit({ id: true, updatedAt: true }),
  assets: z.array(BrandContextAssetSchema),
});

export type AssetPermissions = z.infer<typeof AssetPermissionsSchema>;
export type BrandContextAsset = z.infer<typeof BrandContextAssetSchema>;
export type BrandContext = z.infer<typeof BrandContextSchema>;

/** The permissions of a usage policy (PD-ARCH-01G-A section 7). */
export function permissionsOf(policy: BrandAssetUsagePolicy): AssetPermissions {
  switch (policy) {
    case 'protected':
      return { placeInContent: true, alterPixels: false, generateVariants: false, styleReference: true };
    case 'reference_only':
      return { placeInContent: false, alterPixels: false, generateVariants: false, styleReference: true };
    case 'reusable':
      return { placeInContent: true, alterPixels: false, generateVariants: false, styleReference: true };
    case 'transformable':
      return { placeInContent: true, alterPixels: true, generateVariants: true, styleReference: true };
  }
}

/** The brand context of the current identity and active library (validated before it is returned). */
export function buildBrandContext(identity: BrandIdentityService, assets: BrandAssetService): BrandContext {
  const { id: _id, updatedAt: _updatedAt, ...view } = identity.get();
  return BrandContextSchema.parse({
    format: BRAND_CONTEXT_FORMAT,
    identity: view,
    assets: assets
      .list()
      .filter((asset) => asset.active)
      .map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        label: asset.label,
        description: asset.description,
        variant: asset.variant,
        pose: asset.pose,
        expression: asset.expression,
        official: asset.official,
        primary: asset.primary,
        usagePolicy: asset.usagePolicy,
        permissions: permissionsOf(asset.usagePolicy),
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        sha256: asset.sha256,
      })),
  });
}
