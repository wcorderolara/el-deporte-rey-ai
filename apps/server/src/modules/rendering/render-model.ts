/**
 * The render model (architecture.md section 9; data-model.md `element_versions.render_model`): one closed JSON
 * document per slide version. It is the only input of the PNG renderer and the input of visual QA (T35): template ID
 * and version, canvas size, the palette roles and their colours, the fonts, the demonstration label, and the elements
 * with their boxes, explicit lines, colours, fact IDs and image hashes.
 *
 * - Text elements carry the source text, the lines measured by `layoutText`, the font size and an `overflow` flag;
 *   `factIds` are the fact segments the text was built from, `semantic` says what the text shows (a team name, a
 *   score, a standings cell...), so that QA can compare each element with the facts.
 * - Image elements carry the asset ID and SHA-256 only; the bytes are embedded as a `data:` URI at render time.
 * - Badge slots are reserved boxes, always empty in the MVP (PD-03, R-050, R-231): the model has no asset field for
 *   them and the renderer draws nothing there.
 */
import { LanguageSchema, SlideTypeSchema, SlugSchema, TextFieldNameSchema, UuidSchema } from '@edr/contracts';
import { z } from 'zod';

/** Identifier of the render model format. */
export const RENDER_MODEL_SCHEMA = 'edr.render-model';
export const RENDER_MODEL_VERSION = 1;

/** Palette roles of `config/brand.json` (OD-07): the only colours a template may use. */
export const PALETTE_ROLES = ['primary', 'primaryDark', 'accent', 'secondary', 'light'] as const;
export const PaletteRoleSchema = z.enum(PALETTE_ROLES);
export type PaletteRole = z.infer<typeof PaletteRoleSchema>;

const HexColourSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const PaletteSchema = z.strictObject({
  primary: HexColourSchema,
  primaryDark: HexColourSchema,
  accent: HexColourSchema,
  secondary: HexColourSchema,
  light: HexColourSchema,
});
export type Palette = z.infer<typeof PaletteSchema>;

export const FontRoleSchema = z.enum(['heading', 'body', 'numeric']);

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const BoxSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
});
export type Box = z.infer<typeof BoxSchema>;

export const ImageSlotSchema = z.enum(['brand_logo', 'mascot']);
export type ImageSlot = z.infer<typeof ImageSlotSchema>;

export const BadgeSlotSchema = z.enum(['team-badge-home', 'team-badge-away']);
export type BadgeSlot = z.infer<typeof BadgeSlotSchema>;

/** What a text element shows; QA compares fact-bearing semantics with the facts. */
export const TextSemanticSchema = z.enum([
  'competition_name',
  'stage_display',
  'season_label',
  'carousel_number',
  'title',
  'team_name',
  'score',
  'kickoff',
  'standings_heading',
  'standings_position',
  'standings_cell',
  'as_of',
  'headline',
  'description',
  'demo_label',
]);
export type TextSemantic = z.infer<typeof TextSemanticSchema>;

export const ProvenanceSchema = z.enum(['fact', 'commentary', 'template_text', 'mixed']);

export const TextElementSchema = z.strictObject({
  kind: z.literal('text'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  field: TextFieldNameSchema,
  semantic: TextSemanticSchema,
  box: BoxSchema,
  fontRole: FontRoleSchema,
  fontFamily: z.string().min(1).max(64),
  fontWeight: z.int().min(100).max(900),
  fontSize: z.number().positive(),
  lineHeight: z.number().positive(),
  colorRole: PaletteRoleSchema,
  color: HexColourSchema,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  maxLines: z.int().min(1),
  text: z.string().max(20_000),
  lines: z.array(z.string().max(20_000)).max(400),
  overflow: z.boolean(),
  factIds: z.array(UuidSchema).max(400),
  provenance: ProvenanceSchema,
});
export type TextElement = z.infer<typeof TextElementSchema>;

export const RectElementSchema = z.strictObject({
  kind: z.literal('rect'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  box: BoxSchema,
  colorRole: PaletteRoleSchema,
  color: HexColourSchema,
  radius: z.number().min(0),
});
export type RectElement = z.infer<typeof RectElementSchema>;

export const ImageElementSchema = z.strictObject({
  kind: z.literal('image'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  slot: ImageSlotSchema,
  box: BoxSchema,
  assetId: UuidSchema,
  sha256: Sha256Schema,
  mime: z.enum(['image/png', 'image/jpeg']),
});
export type ImageElement = z.infer<typeof ImageElementSchema>;

export const BadgeSlotElementSchema = z.strictObject({
  kind: z.literal('badge_slot'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  slot: BadgeSlotSchema,
  box: BoxSchema,
  /** Always true in the MVP: no authorized badge asset exists (PD-03, R-231). */
  empty: z.literal(true),
});
export type BadgeSlotElement = z.infer<typeof BadgeSlotElementSchema>;

export const RenderElementSchema = z.discriminatedUnion('kind', [
  TextElementSchema,
  RectElementSchema,
  ImageElementSchema,
  BadgeSlotElementSchema,
]);
export type RenderElement = z.infer<typeof RenderElementSchema>;

export const RenderModelSchema = z.strictObject({
  schema: z.literal(RENDER_MODEL_SCHEMA),
  schemaVersion: z.literal(RENDER_MODEL_VERSION),
  templateId: SlugSchema,
  templateVersion: z.string().min(1).max(32),
  slideType: SlideTypeSchema,
  language: LanguageSchema,
  canvas: z.strictObject({ width: z.int().min(1), height: z.int().min(1) }),
  background: z.strictObject({ colorRole: PaletteRoleSchema, color: HexColourSchema }),
  palette: PaletteSchema,
  fonts: z
    .array(
      z.strictObject({
        role: FontRoleSchema,
        family: z.string().min(1).max(64),
        weight: z.int().min(100).max(900),
        file: z.string().min(1).max(128),
        sha256: Sha256Schema,
      }),
    )
    .length(3),
  /** The demonstration label of a DEMO_DATA slide (OD-21, AD-33); null otherwise. */
  demoLabel: z.string().min(1).max(80).nullable(),
  elements: z.array(RenderElementSchema).max(2000),
});
export type RenderModel = z.infer<typeof RenderModelSchema>;
