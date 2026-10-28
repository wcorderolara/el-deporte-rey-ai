/**
 * Schemas of the visual QA stage (architecture.md sections 6 and 10; data-model.md `qa_results`, `element_versions`;
 * contracts/provider-ports.md section 3).
 *
 * Every object is closed. The input carries the stored text and render model of each element version to check, the
 * PNG size read from the file header, the template versions of every rendered slide of the same carousels, the facts
 * of the draft's facts run re-read from the database (with their verified and candidate values), the known name forms
 * of their teams, the selection labels, the configured format, palette, font roles and brand terms, and the checks the
 * database accepts. The output is one closed contract `QaResult` per element version and check, with the version's
 * `qa_status`.
 */
import {
  DisplayNameSchema,
  LanguageSchema,
  QaCheckSchema,
  QaResultSchema,
  SlideTypeSchema,
  StageNameSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import { ContentInputSchema, ElementTextSchema } from '../content/index.js';
import { RenderModelSchema } from '../rendering/index.js';

const HexColourSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const FontRoleConfigSchema = z.strictObject({
  family: z.string().min(1).max(64),
  weight: z.int().min(100).max(900),
});

/** Most element versions one stage run checks (bounded like the rendering stage). */
export const MAX_VERSIONS = 2000;

/** The configuration a check needs (format OD-04, palette and fonts OD-07, display offset, brand terms). */
export const QaSettingsSchema = z.strictObject({
  width: z.int().min(1),
  height: z.int().min(1),
  utcOffsetMinutes: z.int(),
  palette: z.strictObject({
    primary: HexColourSchema,
    primaryDark: HexColourSchema,
    accent: HexColourSchema,
    secondary: HexColourSchema,
    light: HexColourSchema,
  }),
  fonts: z.strictObject({ heading: FontRoleConfigSchema, body: FontRoleConfigSchema, numeric: FontRoleConfigSchema }),
  brand: z.strictObject({
    name: z.string().min(1).max(80),
    handle: z.string().min(1).max(40),
    mascotName: z.string().min(1).max(80).nullable(),
  }),
});
export type QaSettings = z.infer<typeof QaSettingsSchema>;

/** The selection labels of the project (snapshots taken at creation; AD-21). */
export const QaLabelsSchema = z.strictObject({
  competitionName: DisplayNameSchema,
  seasonLabel: DisplayNameSchema,
  stageLabel: StageNameSchema,
});
export type QaLabels = z.infer<typeof QaLabelsSchema>;

/** PNG width and height read from the file header; null when the file is missing, unreadable or not a PNG. */
export const ImageSizeSchema = z.strictObject({ width: z.int().min(0), height: z.int().min(0) }).nullable();

/** One element version to check. */
export const VersionToCheckSchema = z
  .strictObject({
    versionId: UuidSchema,
    elementId: UuidSchema,
    carouselId: UuidSchema,
    kind: z.enum(['slide', 'caption']),
    slideType: SlideTypeSchema.nullable(),
    text: ElementTextSchema,
    /** The stored render model of a slide; null for the caption, which has no image. */
    renderModel: RenderModelSchema.nullable(),
    image: ImageSizeSchema,
  })
  .refine((version) => (version.kind === 'slide') === (version.slideType !== null && version.renderModel !== null), {
    message: 'a slide has a slide type and a render model, the caption has neither',
  });
export type VersionToCheck = z.infer<typeof VersionToCheckSchema>;

/** The template of one rendered slide of a carousel (for the template-version part of `style_consistency`). */
export const CarouselTemplateSchema = z.strictObject({
  carouselId: UuidSchema,
  versionId: UuidSchema,
  templateId: z.string().min(1).max(64),
  templateVersion: z.string().min(1).max(32),
});
export type CarouselTemplate = z.infer<typeof CarouselTemplateSchema>;

export const VisualQaInputSchema = z.strictObject({
  projectId: UuidSchema,
  language: LanguageSchema,
  settings: QaSettingsSchema,
  labels: QaLabelsSchema,
  facts: ContentInputSchema.shape.facts,
  teamAliases: ContentInputSchema.shape.teamAliases,
  /** The checks whose results the database accepts (`qa_results.check_name`). */
  checks: z.array(QaCheckSchema).max(6),
  carouselTemplates: z.array(CarouselTemplateSchema).max(MAX_VERSIONS),
  versions: z.array(VersionToCheckSchema).max(MAX_VERSIONS),
});
export type VisualQaInput = z.infer<typeof VisualQaInputSchema>;

/** `element_versions.qa_status` after QA (data-model.md). */
export const QaStatusSchema = z.enum(['passed', 'failed', 'warnings']);
export type QaStatus = z.infer<typeof QaStatusSchema>;

export const VersionResultSchema = z.strictObject({
  versionId: UuidSchema,
  qaStatus: QaStatusSchema,
  results: z.array(QaResultSchema).max(6),
});
export type VersionResult = z.infer<typeof VersionResultSchema>;

export const VisualQaOutputSchema = z.strictObject({
  projectId: UuidSchema,
  versions: z.array(VersionResultSchema).max(MAX_VERSIONS),
});
export type VisualQaOutput = z.infer<typeof VisualQaOutputSchema>;
