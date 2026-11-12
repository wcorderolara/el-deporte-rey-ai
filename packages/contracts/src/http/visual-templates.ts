/**
 * Contract schemas of the structured visual templates (PD-ARCH-01G-C): a template made from an approved design
 * proposal, its versions, their layers over a background, the closed catalogue of sports-data bindings, the
 * validation issues and the preview with local sports data.
 *
 * - A template version is a document of independent layers; a published version is immutable and a change makes a new
 *   draft version. Nothing here calls an AI provider.
 * - Positions and sizes are fractions of the canvas (0 to 1); font sizes are pixels of the version's canvas. The
 *   stacking order is the order of the layer list, bottom first.
 * - Colours are palette roles and fonts are font roles of the renderer: no free colour, font, URL, path, HTML or
 *   expression is accepted. A binding is a name of the closed catalogue.
 */
import { z } from 'zod';

import { BrandAssetKindSchema, BrandAssetUsagePolicySchema, BrandColorRoleSchema, BrandFontRoleSchema, noteSchema } from './brand.js';
import { DesignFormatSchema } from './design.js';
import { DateTimeSchema, LabelSchema, LanguageSchema, Sha256Schema, UuidSchema, contractRegExp } from './primitives.js';

export const VisualTemplateStatusSchema = z.enum(['draft', 'published', 'archived']);

export const VisualTemplateVersionStatusSchema = z.enum(['draft', 'published']);

/**
 * The sports-data fields a layer can show (`docs/design/PD-ARCH-01G/pd-arch-01g-c-assessment.md` section 2). Values
 * come from the local Competiciones data (effective values, protected overrides included); a field without a value
 * is reported, never invented. There is no venue and no team badge (PD-03).
 */
export const VisualTemplateBindingSchema = z.enum([
  'competition.name',
  'season.label',
  'stage.name',
  'round.name',
  'match.homeTeam.name',
  'match.awayTeam.name',
  'match.kickoffDate',
  'match.kickoffTime',
  'match.status',
  'match.score',
  'match.homeScore',
  'match.awayScore',
  'round.fixtures',
]);

export type VisualTemplateBinding = z.infer<typeof VisualTemplateBindingSchema>;

/**
 * The image fields a `team_badge` layer can show (PD-ARCH-01G-D): the badge of the home or away team, resolved through
 * the team's internal identity, never its name. A team without a badge leaves the layer empty (a warning).
 */
export const VisualTemplateBadgeBindingSchema = z.enum(['match.homeTeam.badge', 'match.awayTeam.badge']);
export type VisualTemplateBadgeBinding = z.infer<typeof VisualTemplateBadgeBindingSchema>;

/**
 * What a template draws: one of the slide types of the engine's carousels (Product Owner decision 01G-D-3,
 * 2026-11-09), the same names as the engine templates. Standings are left out: no content kind generates them from the
 * local data. A design proposal's content type (`DesignContentType`) is one of these.
 */
export const VisualTemplateContentTypeSchema = z.enum([
  'cover',
  'match_result',
  'round_overview',
  'fixture',
  'match_preview',
  'closing',
]);
export type VisualTemplateContentType = z.infer<typeof VisualTemplateContentTypeSchema>;

const MATCH_TYPES: readonly VisualTemplateContentType[] = ['match_preview', 'fixture', 'match_result'];
const ALL_TYPES: readonly VisualTemplateContentType[] = VisualTemplateContentTypeSchema.options;

/**
 * The catalogue: the content types where each binding is available, and the slide text field that carries the same
 * value in a project (for PD-ARCH-01G-D; null when no slide field carries it yet).
 */
export const VISUAL_TEMPLATE_BINDINGS: Readonly<
  Record<VisualTemplateBinding, { readonly contentTypes: readonly VisualTemplateContentType[]; readonly slideField: string | null }>
> = Object.freeze({
  'competition.name': { contentTypes: ALL_TYPES, slideField: 'footer' },
  'season.label': { contentTypes: ALL_TYPES, slideField: 'footer' },
  'stage.name': { contentTypes: ALL_TYPES, slideField: null },
  'round.name': { contentTypes: ALL_TYPES, slideField: null },
  'match.homeTeam.name': { contentTypes: MATCH_TYPES, slideField: 'team_home' },
  'match.awayTeam.name': { contentTypes: MATCH_TYPES, slideField: 'team_away' },
  'match.kickoffDate': { contentTypes: MATCH_TYPES, slideField: 'kickoff' },
  'match.kickoffTime': { contentTypes: MATCH_TYPES, slideField: null },
  'match.status': { contentTypes: MATCH_TYPES, slideField: 'match_status' },
  'match.score': { contentTypes: ['match_result'], slideField: 'score' },
  'match.homeScore': { contentTypes: ['match_result'], slideField: 'score' },
  'match.awayScore': { contentTypes: ['match_result'], slideField: 'score' },
  'round.fixtures': { contentTypes: ['round_overview'], slideField: 'fixtures' },
});

/**
 * The values a template of each content type must show. A requirement is met when every binding of one of its
 * alternatives is used by a sports-data layer (the score as one value, or both team scores). A cover and a closing
 * require nothing: a variant may be only a background, a fixed text or the brand (Product Owner, 01G-D-3).
 */
export const VISUAL_TEMPLATE_REQUIRED_BINDINGS: Readonly<
  Record<VisualTemplateContentType, readonly { readonly anyOf: readonly (readonly VisualTemplateBinding[])[] }[]>
> = Object.freeze({
  match_preview: [{ anyOf: [['match.homeTeam.name']] }, { anyOf: [['match.awayTeam.name']] }],
  fixture: [{ anyOf: [['match.homeTeam.name']] }, { anyOf: [['match.awayTeam.name']] }],
  match_result: [
    { anyOf: [['match.homeTeam.name']] },
    { anyOf: [['match.awayTeam.name']] },
    { anyOf: [['match.score'], ['match.homeScore', 'match.awayScore']] },
  ],
  round_overview: [{ anyOf: [['round.fixtures']] }],
  cover: [],
  closing: [],
});

/** Canvas of each format, in pixels (width 1080, as the carousel format). */
export const VISUAL_TEMPLATE_CANVAS: Readonly<Record<z.infer<typeof DesignFormatSchema>, { width: number; height: number }>> =
  Object.freeze({
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '9:16': { width: 1080, height: 1920 },
  });

/** Most layers of a version. */
export const MAX_VISUAL_TEMPLATE_LAYERS = 40;
/** Most image and brand-asset layers of a version. */
export const MAX_VISUAL_TEMPLATE_ASSET_LAYERS = 12;
/** Longest fixed text of a text layer. */
export const MAX_VISUAL_TEMPLATE_TEXT = 500;
/** Font sizes, in pixels of the canvas. */
export const MIN_VISUAL_TEMPLATE_FONT_SIZE = 8;
export const MAX_VISUAL_TEMPLATE_FONT_SIZE = 400;
/** Most lines of a text layer. */
export const MAX_VISUAL_TEMPLATE_LINES = 12;
/**
 * The rows a match list draws on one slide (PD-ARCH-01G-E.2, decision DE-E5: six matches per 1080 x 1350 slide), as
 * the round calendar pages of a project hold.
 */
export const VISUAL_TEMPLATE_FIXTURE_LIST_ROWS = 6;

export const VisualTemplateLayerIdSchema = z.string().min(1).max(40).regex(contractRegExp('LayerId'));

const Fraction = z.number().min(0).max(1);

const LayerBaseShape = {
  id: VisualTemplateLayerIdSchema,
  name: LabelSchema,
  /** Left edge, fraction of the canvas width. */
  x: Fraction,
  /** Top edge, fraction of the canvas height. */
  y: Fraction,
  width: Fraction,
  height: Fraction,
  /** A hidden layer is kept in the document and not drawn. */
  visible: z.boolean(),
};

/**
 * The closed palette of text effects (Product Owner decision 01G-C-2): shadows, glows and outlines the slide engine
 * draws, in the palette colours and scaled with the font size. No free CSS is accepted.
 * - `soft_shadow`: a soft dark drop shadow (legibility over busy backgrounds);
 * - `strong_shadow`: a solid dark offset shadow with a dark halo (large names);
 * - `glow_gold`, `glow_purple`: a glow in the accent or primary colour;
 * - `outline_dark`: a dark outline with a soft shadow (light text over bright areas);
 * - `scoreboard_gold`: a gold outline with a drop shadow (the score).
 */
export const VisualTemplateTextEffectSchema = z.enum([
  'none',
  'soft_shadow',
  'strong_shadow',
  'glow_gold',
  'glow_purple',
  'outline_dark',
  'scoreboard_gold',
]);

/**
 * Text style: the font role (its bundled family and weight), the largest and smallest font size, the most lines, the
 * palette colour, the alignment, and what happens when the text does not fit: `shrink` tries smaller sizes down to
 * the smallest, `fixed` keeps the largest. Text is never cut: what still does not fit is reported as an overflow.
 * `effect` is one of the text effects (`none` when absent). `uppercase` draws the text in capital letters; it changes
 * only the display, never the stored value, so an official team name stays exactly as recorded (PD-29).
 */
export const VisualTemplateTextStyleSchema = z.strictObject({
  fontRole: BrandFontRoleSchema,
  maxFontSize: z.int().min(MIN_VISUAL_TEMPLATE_FONT_SIZE).max(MAX_VISUAL_TEMPLATE_FONT_SIZE),
  minFontSize: z.int().min(MIN_VISUAL_TEMPLATE_FONT_SIZE).max(MAX_VISUAL_TEMPLATE_FONT_SIZE),
  maxLines: z.int().min(1).max(MAX_VISUAL_TEMPLATE_LINES),
  colorRole: BrandColorRoleSchema,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  overflow: z.enum(['shrink', 'fixed']),
  effect: VisualTemplateTextEffectSchema.optional(),
  uppercase: z.boolean().optional(),
});

/** How an image fills its box: `contain` and `cover` keep the aspect ratio (`cover` crops), `fill` stretches. */
export const VisualTemplateImageFitSchema = z.enum(['contain', 'cover', 'fill']);

export const VisualTemplateTextLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('text'),
  /** Fixed text of the template (printable, line feeds allowed). */
  text: noteSchema(MAX_VISUAL_TEMPLATE_TEXT),
  style: VisualTemplateTextStyleSchema,
});

export const VisualTemplateSportsDataLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('sports_data'),
  /** Null only in a draft; a version is not published with an unbound layer. */
  binding: VisualTemplateBindingSchema.nullable(),
  /** A required value missing from the selected data is an error of the preview; otherwise the layer is left out. */
  required: z.boolean(),
  style: VisualTemplateTextStyleSchema,
});

/** A graphic element or background of Mi marca (never a style reference, never a URL). */
export const VisualTemplateImageLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('image'),
  assetId: UuidSchema,
  fit: VisualTemplateImageFitSchema,
});

/** The official logo or the mascot, drawn from its original file and only scaled proportionally (`contain`). */
export const VisualTemplateBrandAssetLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('brand_asset'),
  assetId: UuidSchema,
});

/** A team badge (PD-28), drawn from its original file and only scaled proportionally (`contain`). */
export const VisualTemplateTeamBadgeLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('team_badge'),
  binding: VisualTemplateBadgeBindingSchema,
});

/** A part of a match-list row: its box as fractions of the row (left, top, width, height), and whether it is drawn. */
const FixtureRowPartShape = {
  x: Fraction,
  y: Fraction,
  width: Fraction,
  height: Fraction,
  visible: z.boolean(),
};

/** A team badge of a row, drawn from its original file and only scaled proportionally (`contain`). */
export const VisualTemplateFixtureRowBadgeSchema = z.strictObject(FixtureRowPartShape);

/** A value of a row, drawn with its text style. */
export const VisualTemplateFixtureRowTextSchema = z.strictObject({
  ...FixtureRowPartShape,
  style: VisualTemplateTextStyleSchema,
});

/**
 * The parts of a match-list row (decision DE-E6): the home badge and official name, the kickoff date and time, the
 * match status (drawn only for a match that is not scheduled), and the away name and badge. The two names are always
 * drawn (PD-28 point 4: a team without a badge keeps its name).
 */
export const VisualTemplateFixtureRowSchema = z.strictObject({
  homeBadge: VisualTemplateFixtureRowBadgeSchema,
  homeName: VisualTemplateFixtureRowTextSchema,
  kickoffDate: VisualTemplateFixtureRowTextSchema,
  kickoffTime: VisualTemplateFixtureRowTextSchema,
  status: VisualTemplateFixtureRowTextSchema,
  awayName: VisualTemplateFixtureRowTextSchema,
  awayBadge: VisualTemplateFixtureRowBadgeSchema,
});

/**
 * A match list of a round calendar (PD-ARCH-01G-E.2): the operator designs one row and the slide engine repeats it for
 * every match of the slide, top to bottom, up to `VISUAL_TEMPLATE_FIXTURE_LIST_ROWS` rows. The layer box is the first
 * row; `rowGap` is the space between two rows, a fraction of the canvas height. Values come from the slide's facts
 * and badges from the project's snapshot, by each team's internal identity (never its name). It shows the
 * `round.fixtures` value, so it meets the requirement of a round calendar.
 */
export const VisualTemplateFixtureListLayerSchema = z.strictObject({
  ...LayerBaseShape,
  type: z.literal('fixture_list'),
  rowGap: Fraction,
  row: VisualTemplateFixtureRowSchema,
});

export const VisualTemplateLayerSchema = z.discriminatedUnion('type', [
  VisualTemplateTextLayerSchema,
  VisualTemplateSportsDataLayerSchema,
  VisualTemplateImageLayerSchema,
  VisualTemplateBrandAssetLayerSchema,
  VisualTemplateTeamBadgeLayerSchema,
  VisualTemplateFixtureListLayerSchema,
]);

export const VisualTemplateLayerTypeSchema = z.enum([
  'text',
  'sports_data',
  'image',
  'brand_asset',
  'team_badge',
  'fixture_list',
]);

/** The parts of a match-list row, in drawing order. */
export const VISUAL_TEMPLATE_FIXTURE_ROW_PARTS = [
  'homeBadge',
  'homeName',
  'kickoffDate',
  'kickoffTime',
  'status',
  'awayName',
  'awayBadge',
] as const;
export type VisualTemplateFixtureRowPart = (typeof VISUAL_TEMPLATE_FIXTURE_ROW_PARTS)[number];

/** Where the background comes from: the clean background of a design proposal, or a background of Mi marca. */
export const VisualTemplateBackgroundSourceSchema = z.enum(['design_proposal', 'brand_asset']);

export const VisualTemplateBackgroundInputSchema = z.strictObject({
  source: VisualTemplateBackgroundSourceSchema,
  id: UuidSchema,
});

/** The background as stored: its file is pinned by its hash and drawn over the whole canvas (`cover`). */
export const VisualTemplateBackgroundSchema = z.strictObject({
  source: VisualTemplateBackgroundSourceSchema,
  id: UuidSchema,
  label: z.string().min(1).max(120),
  sha256: Sha256Schema,
  mime: z.enum(['image/png', 'image/jpeg']),
  width: z.int().min(1).max(4096),
  height: z.int().min(1).max(4096),
});

/** A brand asset placed by a version, pinned by its hash, with the policy it had when the version was saved. */
export const VisualTemplateAssetRefSchema = z.strictObject({
  assetId: UuidSchema,
  label: LabelSchema,
  kind: BrandAssetKindSchema,
  usagePolicy: BrandAssetUsagePolicySchema,
  official: z.boolean(),
  sha256: Sha256Schema,
});

export const VisualTemplateIssueCodeSchema = z.enum([
  'OUT_OF_CANVAS',
  'TOO_SMALL',
  'FONT_SIZE_INVALID',
  'OVERLAP',
  'PROTECTED_OVERLAP',
  'BINDING_MISSING',
  'BINDING_NOT_ALLOWED',
  'REQUIRED_BINDING_MISSING',
  'ASSET_MISSING',
  'ASSET_INACTIVE',
  'ASSET_DELETED',
  'ASSET_NOT_ALLOWED',
  'TEXT_TOO_LONG',
  'TEXT_MAY_NOT_FIT',
  'LOW_CONTRAST',
  'HIDDEN_LAYER',
  'NO_LAYERS',
  'BACKGROUND_UNAVAILABLE',
  'BACKGROUND_SOURCE_DELETED',
  'BACKGROUND_ASPECT',
  'BACKGROUND_REVIEW',
  'BACKGROUND_OWN_PROMPT',
  'BACKGROUND_GENERATED_BRAND',
  'VALUE_MISSING',
  'TEXT_OVERFLOW',
]);

/** An error blocks publication; a warning is for the operator to review and decide. */
export const VisualTemplateIssueSchema = z.strictObject({
  code: VisualTemplateIssueCodeSchema,
  severity: z.enum(['error', 'warning']),
  layerId: VisualTemplateLayerIdSchema.nullable(),
  message: z.string().min(1).max(300),
});

export const VisualTemplateValidationSchema = z.strictObject({
  publishable: z.boolean(),
  issues: z.array(VisualTemplateIssueSchema).max(400),
});

export const VisualTemplateSchema = z.strictObject({
  id: UuidSchema,
  name: LabelSchema,
  description: noteSchema(500).nullable(),
  category: LabelSchema.nullable(),
  contentType: VisualTemplateContentTypeSchema,
  /** Aspect ratio of the canvas. */
  format: DesignFormatSchema,
  status: VisualTemplateStatusSchema,
  /** The approved design proposal the template was made from. */
  sourceProposalId: UuidSchema.nullable(),
  /** The latest published version, the one PD-ARCH-01G-D offers to projects. */
  publishedVersion: z
    .strictObject({ id: UuidSchema, version: z.int().min(1), publishedAt: DateTimeSchema })
    .nullable(),
  /** The draft version being edited, if any (at most one). */
  draftVersionId: UuidSchema.nullable(),
  versionCount: z.int().min(1),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  archivedAt: DateTimeSchema.nullable(),
});

export const VisualTemplateVersionSummarySchema = z.strictObject({
  id: UuidSchema,
  version: z.int().min(1),
  status: VisualTemplateVersionStatusSchema,
  layerCount: z.int().min(0),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  publishedAt: DateTimeSchema.nullable(),
});

export const VisualTemplateDetailSchema = z.strictObject({
  template: VisualTemplateSchema,
  versions: z.array(VisualTemplateVersionSummarySchema).max(1000),
});

export const VisualTemplateVersionSchema = z.strictObject({
  id: UuidSchema,
  templateId: UuidSchema,
  version: z.int().min(1),
  status: VisualTemplateVersionStatusSchema,
  /** Increases with every save of the draft; a save or a publication names the revision it starts from. */
  revision: z.int().min(1),
  canvasWidth: z.int().min(1).max(4096),
  canvasHeight: z.int().min(1).max(4096),
  background: VisualTemplateBackgroundSchema,
  layers: z.array(VisualTemplateLayerSchema).max(MAX_VISUAL_TEMPLATE_LAYERS),
  /** The bindings the layers use, once each, in layer order. */
  bindings: z.array(VisualTemplateBindingSchema).max(MAX_VISUAL_TEMPLATE_LAYERS),
  assets: z.array(VisualTemplateAssetRefSchema).max(MAX_VISUAL_TEMPLATE_ASSET_LAYERS),
  validation: VisualTemplateValidationSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  publishedAt: DateTimeSchema.nullable(),
});

/** The version a project uses (PD-ARCH-01G-D): recorded when the project is created, never the latest one later. */
export const VisualTemplateVersionRefSchema = z.strictObject({
  templateId: UuidSchema,
  versionId: UuidSchema,
  version: z.int().min(1),
});

const VisualTemplateDescriptionSchema = noteSchema(500);

/** The visual template of a project, as shown with it. */
export const VisualTemplateUsageSchema = z.strictObject({
  ...VisualTemplateVersionRefSchema.shape,
  name: LabelSchema,
  contentType: VisualTemplateContentTypeSchema,
});

export const VisualTemplateCreateSchema = z.strictObject({
  /** An approved, not deleted design proposal. */
  sourceProposalId: UuidSchema,
  name: LabelSchema,
  description: VisualTemplateDescriptionSchema.optional(),
  category: LabelSchema.optional(),
  /**
   * What the template is for; the proposal's content type when absent. The proposal is only the background, so a
   * template of another content type may use it (Product Owner decision 01G-C-1, 2026-11-06), a cover or a closing
   * included (01G-D-3). It cannot change later.
   */
  contentType: VisualTemplateContentTypeSchema.optional(),
  /**
   * The operator read the warnings about the background. Required for an own-prompt proposal, whose image may contain
   * generated text, people, logos or a generated mascot.
   */
  acknowledgeWarnings: z.boolean().optional(),
});

export const VisualTemplateUpdateSchema = z
  .strictObject({
    name: LabelSchema.optional(),
    description: VisualTemplateDescriptionSchema.nullable().optional(),
    category: LabelSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');

export const VisualTemplateVersionSaveSchema = z.strictObject({
  revision: z.int().min(1),
  background: VisualTemplateBackgroundInputSchema,
  layers: z.array(VisualTemplateLayerSchema).max(MAX_VISUAL_TEMPLATE_LAYERS),
});

export const VisualTemplateVersionCreateSchema = z.strictObject({
  /** The version the new draft starts from; the latest published version when absent. */
  fromVersionId: UuidSchema.optional(),
});

export const VisualTemplatePublishSchema = z.strictObject({ revision: z.int().min(1) });

/**
 * Local sports data for a preview: a match for match content types, a round for a round calendar; a cover or a closing
 * needs only the competition and season (the round is optional).
 */
export const VisualTemplatePreviewSelectionSchema = z.strictObject({
  competitionId: UuidSchema,
  seasonId: UuidSchema,
  roundId: UuidSchema.nullable().optional(),
  matchId: UuidSchema.nullable().optional(),
});

export const VisualTemplatePreviewRequestSchema = z.strictObject({
  selection: VisualTemplatePreviewSelectionSchema,
  /** Language of dates and status labels; Spanish when absent (PD-06). */
  language: LanguageSchema.optional(),
});

export const VisualTemplatePreviewSchema = z.strictObject({
  /** The value of each binding of the version for the selection; null when the data has none. */
  values: z
    .array(z.strictObject({ binding: VisualTemplateBindingSchema, value: z.string().max(4000).nullable() }))
    .max(MAX_VISUAL_TEMPLATE_LAYERS),
  /** The badge of each team badge binding of the version; null when the team has none. */
  badges: z
    .array(z.strictObject({ binding: VisualTemplateBadgeBindingSchema, badgeId: UuidSchema.nullable() }))
    .max(2),
  /** Issues of this rendering (missing values, overflowing text); the version's own issues are in its validation. */
  issues: z.array(VisualTemplateIssueSchema).max(400),
  /** Relative API path of the PNG rendered by the slide engine for the same selection. */
  imageUrl: z.string().max(400).regex(contractRegExp('VisualTemplateUrl')),
  width: z.int().min(1).max(4096),
  height: z.int().min(1).max(4096),
});

export const VisualTemplateListSchema = z.strictObject({ templates: z.array(VisualTemplateSchema) });

export type VisualTemplateStatus = z.infer<typeof VisualTemplateStatusSchema>;
export type VisualTemplateVersionStatus = z.infer<typeof VisualTemplateVersionStatusSchema>;
export type VisualTemplateLayerId = z.infer<typeof VisualTemplateLayerIdSchema>;
export type VisualTemplateTextEffect = z.infer<typeof VisualTemplateTextEffectSchema>;
export type VisualTemplateTextStyle = z.infer<typeof VisualTemplateTextStyleSchema>;
export type VisualTemplateImageFit = z.infer<typeof VisualTemplateImageFitSchema>;
export type VisualTemplateTextLayer = z.infer<typeof VisualTemplateTextLayerSchema>;
export type VisualTemplateSportsDataLayer = z.infer<typeof VisualTemplateSportsDataLayerSchema>;
export type VisualTemplateImageLayer = z.infer<typeof VisualTemplateImageLayerSchema>;
export type VisualTemplateBrandAssetLayer = z.infer<typeof VisualTemplateBrandAssetLayerSchema>;
export type VisualTemplateLayer = z.infer<typeof VisualTemplateLayerSchema>;
export type VisualTemplateLayerType = z.infer<typeof VisualTemplateLayerTypeSchema>;
export type VisualTemplateBackgroundSource = z.infer<typeof VisualTemplateBackgroundSourceSchema>;
export type VisualTemplateBackgroundInput = z.infer<typeof VisualTemplateBackgroundInputSchema>;
export type VisualTemplateBackground = z.infer<typeof VisualTemplateBackgroundSchema>;
export type VisualTemplateAssetRef = z.infer<typeof VisualTemplateAssetRefSchema>;
export type VisualTemplateIssueCode = z.infer<typeof VisualTemplateIssueCodeSchema>;
export type VisualTemplateIssue = z.infer<typeof VisualTemplateIssueSchema>;
export type VisualTemplateValidation = z.infer<typeof VisualTemplateValidationSchema>;
export type VisualTemplate = z.infer<typeof VisualTemplateSchema>;
export type VisualTemplateVersionSummary = z.infer<typeof VisualTemplateVersionSummarySchema>;
export type VisualTemplateDetail = z.infer<typeof VisualTemplateDetailSchema>;
export type VisualTemplateVersion = z.infer<typeof VisualTemplateVersionSchema>;
export type VisualTemplateVersionRef = z.infer<typeof VisualTemplateVersionRefSchema>;
export type VisualTemplateUsage = z.infer<typeof VisualTemplateUsageSchema>;
export type VisualTemplateTeamBadgeLayer = z.infer<typeof VisualTemplateTeamBadgeLayerSchema>;
export type VisualTemplateFixtureRowBadge = z.infer<typeof VisualTemplateFixtureRowBadgeSchema>;
export type VisualTemplateFixtureRowText = z.infer<typeof VisualTemplateFixtureRowTextSchema>;
export type VisualTemplateFixtureRow = z.infer<typeof VisualTemplateFixtureRowSchema>;
export type VisualTemplateFixtureListLayer = z.infer<typeof VisualTemplateFixtureListLayerSchema>;
export type VisualTemplateCreate = z.infer<typeof VisualTemplateCreateSchema>;
export type VisualTemplateUpdate = z.infer<typeof VisualTemplateUpdateSchema>;
export type VisualTemplateVersionSave = z.infer<typeof VisualTemplateVersionSaveSchema>;
export type VisualTemplateVersionCreate = z.infer<typeof VisualTemplateVersionCreateSchema>;
export type VisualTemplatePublish = z.infer<typeof VisualTemplatePublishSchema>;
export type VisualTemplatePreviewSelection = z.infer<typeof VisualTemplatePreviewSelectionSchema>;
export type VisualTemplatePreviewRequest = z.infer<typeof VisualTemplatePreviewRequestSchema>;
export type VisualTemplatePreview = z.infer<typeof VisualTemplatePreviewSchema>;
