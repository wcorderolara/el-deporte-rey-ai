/**
 * Contract schemas of the brand library and templates (operations listBrandAssets, registerBrandAsset,
 * getBrandAsset, updateBrandAsset, deleteBrandAsset, getBrandAssetFile, getBrandIdentity, updateBrandIdentity,
 * listTemplates, previewTemplate): BrandAssetKind, BrandAssetUsagePolicy, BrandAsset, BrandAssetDetail,
 * BrandIdentity, Template.
 *
 * PD-ARCH-01G-A: the brand library extends the brand assets with categories for style references and backgrounds,
 * an explicit AI usage policy per asset, the official and primary marks, mascot variants and descriptive metadata.
 * The palette and fonts of the identity are the renderer's (read only); only their descriptive notes are edited.
 */
import { z } from 'zod';

import {
  DateTimeSchema,
  LabelSchema,
  Sha256Schema,
  SlugSchema,
  UuidSchema,
  contractRegExp,
} from './primitives.js';
import { SlideTypeSchema } from './review.js';

/**
 * Asset categories: logos, the mascot, graphic elements (`decoration`), backgrounds and style references. No badge or
 * competition-mark category exists (PD-03, R-231).
 */
export const BrandAssetKindSchema = z.enum(['brand_logo', 'mascot', 'decoration', 'background', 'style_reference']);

/** Image media types accepted for brand assets; WebP only for style references (never drawn by the renderer). */
export const BRAND_ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const BrandAssetMimeSchema = z.enum(BRAND_ASSET_MEDIA_TYPES);

/**
 * How a later AI generation may use an asset (PD-ARCH-01G-A). `protected`: used as is, only scaled and positioned;
 * `reference_only`: style reference, never placed in content; `reusable`: may be placed directly in compositions;
 * `transformable`: may also be the base of AI variants (explicit authorization, never a default).
 */
export const BrandAssetUsagePolicySchema = z.enum(['protected', 'reference_only', 'reusable', 'transformable']);

/** Printable multi-line text (line feeds allowed). */
export function noteSchema(max: number) {
  return z.string().min(1).max(max).regex(contractRegExp('Note'));
}

export const BrandAssetDescriptionSchema = noteSchema(500);

export const BrandAssetSchema = z.strictObject({
  id: UuidSchema,
  kind: BrandAssetKindSchema,
  label: LabelSchema,
  description: BrandAssetDescriptionSchema.nullable(),
  mime: BrandAssetMimeSchema,
  width: z.int(),
  height: z.int(),
  /** Size of the stored file in bytes; null only while a file registered before 01G-A has not been measured. */
  byteSize: z.int().nullable(),
  sha256: Sha256Schema,
  usagePolicy: BrandAssetUsagePolicySchema,
  /** An official resource of the brand, marked by the operator. */
  official: z.boolean(),
  /** The logo or mascot the renderer draws (at most one per kind; always active). */
  primary: z.boolean(),
  variant: LabelSchema.nullable(),
  /** Mascot only. */
  pose: LabelSchema.nullable(),
  /** Mascot only. */
  expression: LabelSchema.nullable(),
  active: z.boolean(),
  registeredAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

/** Where an asset has been used: rendered slide versions, their projects and the exports that hold them. */
export const BrandAssetUsageSchema = z.strictObject({
  renderedVersions: z.int().min(0),
  projects: z.int().min(0),
  exports: z.int().min(0),
});

/** Response of getBrandAsset: the asset and its usage (the dependencies checked before a deletion). */
export const BrandAssetDetailSchema = z.strictObject({
  asset: BrandAssetSchema,
  usage: BrandAssetUsageSchema,
});

/** Colour roles of the renderer palette (config/brand.json; read only). */
export const BrandColorRoleSchema = z.enum(['primary', 'primaryDark', 'accent', 'secondary', 'light']);

/** Font roles of the renderer (config/brand.json, bundled fonts; read only). */
export const BrandFontRoleSchema = z.enum(['heading', 'body', 'numeric']);

export const BrandUsageNoteSchema = noteSchema(300);

export const BrandIdentitySchema = z.strictObject({
  /** Identity key; one identity (`primary`) in this release, ready for more. */
  id: z.literal('primary'),
  name: z.string().min(1).max(80),
  handle: z.string().min(1).max(80),
  mascotName: z.string().min(1).max(80).nullable(),
  /** The configured values are provisional (OD-07). */
  provisional: z.boolean(),
  description: noteSchema(1000).nullable(),
  graphicPreferences: noteSchema(2000).nullable(),
  palette: z.array(
    z.strictObject({
      role: BrandColorRoleSchema,
      value: z.string().regex(contractRegExp('ColorHex')),
      usage: BrandUsageNoteSchema.nullable(),
    }),
  ),
  typography: z.array(
    z.strictObject({
      role: BrandFontRoleSchema,
      family: z.string().min(1).max(80),
      weight: z.int().min(100).max(900),
      usage: BrandUsageNoteSchema.nullable(),
    }),
  ),
  updatedAt: DateTimeSchema.nullable(),
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
export type BrandAssetUsagePolicy = z.infer<typeof BrandAssetUsagePolicySchema>;
export type BrandAsset = z.infer<typeof BrandAssetSchema>;
export type BrandAssetUsage = z.infer<typeof BrandAssetUsageSchema>;
export type BrandAssetDetail = z.infer<typeof BrandAssetDetailSchema>;
export type BrandColorRole = z.infer<typeof BrandColorRoleSchema>;
export type BrandFontRole = z.infer<typeof BrandFontRoleSchema>;
export type BrandIdentity = z.infer<typeof BrandIdentitySchema>;
export type Template = z.infer<typeof TemplateSchema>;
