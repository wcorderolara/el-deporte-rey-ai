/**
 * The render model (architecture.md section 9; data-model.md `element_versions.render_model`): one closed JSON
 * document per slide version. It is the only input of the PNG renderer and the input of visual QA (T35): template ID
 * and version, canvas size, the palette roles and their colours, the fonts, the demonstration label, and the elements
 * with their boxes, explicit lines, colours, fact IDs and image hashes.
 *
 * - Text elements carry the source text, the lines measured by `layoutText`, the font size and an `overflow` flag;
 *   `factIds` are the fact segments the text was built from, `semantic` says what the text shows (a team name, a
 *   score, a standings cell...), so that QA can compare each element with the facts.
 * - Image elements carry the asset ID and SHA-256 only; the bytes are embedded as a `data:` URI at render time. A
 *   structured visual template (PD-ARCH-01G-C) also draws its `background` and its image `layer`s, with a `fit`
 *   (`contain` when absent, as before), and its text may carry an effect and be shown in capital letters.
 * - Badge slots are reserved boxes of the engine match templates. Until PD-ARCH-01G-E.1 they were always empty
 *   (PD-03, R-050, R-231), and stored models of that time have only `empty: true`. From version 1.1.0 of the match
 *   templates, in a project whose badge snapshot covers the engine templates (PD-28, decision DE-E3), a slot also
 *   records its `team`: the team's local ID (null when the slide's team could not be identified) and the badge drawn
 *   from the snapshot, or null when the team has no badge. The renderer draws the badge from its stored file, scaled
 *   to fit the slot without distortion; an empty slot draws nothing, and visual QA warns about it (`team_badges`).
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

/** What an image element draws: an image slot of a template, or the background or an image layer of a visual template. */
export const ImageElementSlotSchema = z.enum([...ImageSlotSchema.options, 'background', 'layer']);
export type ImageElementSlot = z.infer<typeof ImageElementSlotSchema>;

/** How an image fills its box (`contain` and `cover` keep the aspect ratio, `fill` stretches). */
export const ImageFitSchema = z.enum(['contain', 'cover', 'fill']);
export type ImageFit = z.infer<typeof ImageFitSchema>;

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
  /** One team's goals or the kickoff time, drawn on their own by a visual template (PD-ARCH-01G-D). */
  'score_home',
  'score_away',
  'kickoff_time',
  'kickoff',
  /** The status label of a match not played yet (PD-ARCH-01E-B). */
  'match_status',
  /** One line of a round overview: two team names and a kickoff (PD-ARCH-01E-B). */
  'fixture_line',
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

/**
 * Text effects of structured visual templates (PD-ARCH-01G-C, decision 01G-C-2): shadows, glows and outlines in the
 * palette colours, drawn by the renderer from this closed list. Absent in the models of the built-in templates.
 */
export const TextEffectSchema = z.enum([
  'none',
  'soft_shadow',
  'strong_shadow',
  'glow_gold',
  'glow_purple',
  'outline_dark',
  'scoreboard_gold',
]);
export type TextEffect = z.infer<typeof TextEffectSchema>;

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
  effect: TextEffectSchema.optional(),
  /**
   * True when the lines are drawn in capital letters (PD-29): `text` keeps the stored value (an official name stays as
   * recorded) and `lines` are the measured, uppercased lines.
   */
  uppercase: z.boolean().optional(),
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
  slot: ImageElementSlotSchema,
  box: BoxSchema,
  assetId: UuidSchema,
  sha256: Sha256Schema,
  mime: z.enum(['image/png', 'image/jpeg']),
  /** Absent in the models of the built-in templates: `contain`. */
  fit: ImageFitSchema.optional(),
});
export type ImageElement = z.infer<typeof ImageElementSchema>;

/** A team badge drawn in a badge slot: a manually uploaded PNG or JPEG of the project's snapshot (PD-28). */
export const SlotBadgeSchema = z.strictObject({
  /** The badge ID (`team_badges.id`). */
  assetId: UuidSchema,
  sha256: Sha256Schema,
  mime: z.enum(['image/png', 'image/jpeg']),
});
export type SlotBadge = z.infer<typeof SlotBadgeSchema>;

export const BadgeSlotElementSchema = z
  .strictObject({
    kind: z.literal('badge_slot'),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    slot: BadgeSlotSchema,
    box: BoxSchema,
    /** True when nothing is drawn in the slot (always, before PD-ARCH-01G-E.1). */
    empty: z.boolean(),
    /**
     * PD-ARCH-01G-E.1: the slot's team and its badge (see the module notes). Absent when the project's badges do not
     * cover the engine templates, and in every model stored before.
     */
    team: z
      .strictObject({
        teamId: z.string().min(1).max(64).nullable(),
        badge: SlotBadgeSchema.nullable(),
      })
      .optional(),
  })
  // A slot is empty exactly when it has no badge, and a badge always belongs to an identified team.
  .refine((element) => element.empty === (element.team?.badge === undefined || element.team.badge === null), {
    message: 'a badge slot is empty exactly when it has no badge',
  })
  .refine(
    (element) => element.team?.badge === undefined || element.team.badge === null || element.team.teamId !== null,
    {
      message: 'a badge belongs to an identified team',
    },
  );
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
