/**
 * Contract schemas of brand assets and templates (operations listBrandAssets, registerBrandAsset, updateBrandAsset,
 * getBrandAssetFile, listTemplates, previewTemplate): BrandAssetKind, BrandAsset, Template.
 */
import { z } from 'zod';

import { DateTimeSchema, LabelSchema, Sha256Schema, SlugSchema, UuidSchema } from './primitives.js';
import { SlideTypeSchema } from './review.js';

export const BrandAssetKindSchema = z.enum(['brand_logo', 'mascot', 'decoration']);

/** Image media types accepted for brand assets. */
export const BRAND_ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg'] as const;

export const BrandAssetMimeSchema = z.enum(BRAND_ASSET_MEDIA_TYPES);

export const BrandAssetSchema = z.strictObject({
  id: UuidSchema,
  kind: BrandAssetKindSchema,
  label: LabelSchema,
  mime: BrandAssetMimeSchema,
  width: z.int(),
  height: z.int(),
  sha256: Sha256Schema,
  active: z.boolean(),
  registeredAt: DateTimeSchema,
});

export const TemplateSchema = z.strictObject({
  id: SlugSchema,
  version: z.string().max(32),
  slideType: SlideTypeSchema,
  label: z.string(),
  /** Reserved badge slots; empty while no authorized badge exists (R-050). */
  badgeSlots: z.int(),
  imageSlots: z.array(BrandAssetKindSchema),
});

export type BrandAssetKind = z.infer<typeof BrandAssetKindSchema>;
export type BrandAssetMime = z.infer<typeof BrandAssetMimeSchema>;
export type BrandAsset = z.infer<typeof BrandAssetSchema>;
export type Template = z.infer<typeof TemplateSchema>;
