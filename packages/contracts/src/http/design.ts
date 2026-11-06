/**
 * Contract schemas of the AI design proposals (PD-ARCH-01G-B): the image provider's capabilities, the generation
 * request and its estimate, the asynchronous generation, its events, and the proposals with their review.
 *
 * A proposal is a generated bitmap for human review. It is never a template and never a brand asset: the sports data,
 * the crests, the official logo and the original mascot stay separate and are composed later by the local engine.
 * Nothing here carries a credential, a file path or a provider response.
 */
import { z } from 'zod';

import { BrandAssetKindSchema, BrandAssetUsagePolicySchema, noteSchema } from './brand.js';
import { DateSchema, DateTimeSchema, LabelSchema, UuidSchema, contractRegExp } from './primitives.js';

/** Content the proposal is designed for; the first four content families of the slide engine. */
export const DesignContentTypeSchema = z.enum(['match_preview', 'round_overview', 'fixture', 'match_result']);

/**
 * How the prompt is made:
 * - `guided`: the server's versioned prompt, a background design with empty data zones and no text or people, which a
 *   structured template can reuse;
 * - `own_prompt`: the operator's prompt as written (only the input-image numbering and the zones of original layers are
 *   added); an inspiration image that is never a template base.
 */
export const DesignModeSchema = z.enum(['guided', 'own_prompt']);

/** Aspect ratio of the proposal. */
export const DesignFormatSchema = z.enum(['1:1', '4:5', '9:16']);

/**
 * How a selected brand asset takes part in a generation:
 * - `style_reference`: its image is sent to the provider as a visual reference only;
 * - `transform_base`: its image is sent as the base of a variant (only a `transformable` asset);
 * - `reserved_placement`: its image is never sent; the design leaves a clean zone where the local engine will place
 *   the original later (logos, the mascot, any `protected` asset).
 */
export const DesignReferenceRoleSchema = z.enum(['style_reference', 'transform_base', 'reserved_placement']);

export const DesignGenerationStatusSchema = z.enum([
  'queued',
  'preparing_references',
  'sending_request',
  'generating',
  'saving',
  'completed',
  'failed',
]);

export const DesignProposalStatusSchema = z.enum(['pending_review', 'approved', 'rejected', 'changes_requested']);

export const DesignDecisionSchema = z.enum(['approved', 'rejected', 'changes_requested']);

/** Closed failure codes of a generation. */
export const DesignGenerationErrorCodeSchema = z.enum([
  'NOT_CONFIGURED',
  'API_KEY_MISSING',
  'MODEL_UNAVAILABLE',
  'ACCOUNT_NOT_AUTHORIZED',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'PROVIDER_REJECTED',
  'INVALID_REQUEST',
  'TIMEOUT',
  'RESPONSE_INVALID',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_BUSY',
  'STORAGE_FAILED',
  'REFERENCE_UNAVAILABLE',
  'INTERRUPTED',
  'INTERNAL',
]);

const ModelIdSchema = z.string().min(1).max(100).regex(contractRegExp('ImageModelId'));
const QualitySchema = z.string().min(2).max(16).regex(contractRegExp('ImageQuality'));
const ImageSizeSchema = z.string().min(5).max(9).regex(contractRegExp('ImageSize'));
const Amount = z.number().min(0).max(100_000);

/** Prices per million tokens as configured from the provider's published list, with where and when they were read. */
export const DesignPricingSchema = z.strictObject({
  currency: z.literal('USD'),
  textInputPerMillionTokens: Amount,
  imageInputPerMillionTokens: Amount,
  imageOutputPerMillionTokens: Amount,
  textOutputPerMillionTokens: Amount.nullable(),
  source: z.string().min(1).max(300),
  checkedOn: DateSchema,
});

export const DesignModelSchema = z.strictObject({
  id: ModelIdSchema,
  label: LabelSchema,
  /** Arbitrary sizes (multiples of 16); else standard sizes, adapted locally by a centred crop. */
  flexibleSizes: z.boolean(),
  qualities: z.array(QualitySchema).min(1).max(8),
  pricing: DesignPricingSchema.nullable(),
  /** True when a published per-image cost allows an estimate before generating. */
  estimable: z.boolean(),
});

/** Which roles each usage policy allows (the policy rules of PD-ARCH-01G-A section 8 as enforced by the server). */
export const DesignPolicyRolesSchema = z.strictObject({
  policy: BrandAssetUsagePolicySchema,
  roles: z.array(DesignReferenceRoleSchema).max(3),
});

export const DesignCapabilitiesSchema = z.strictObject({
  adapter: z.enum(['disabled', 'openai']),
  /** `ready` only when the provider is configured and its API key is present on the server. */
  status: z.enum(['disabled', 'missing_api_key', 'ready']),
  defaultModel: ModelIdSchema.nullable(),
  models: z.array(DesignModelSchema).max(12),
  contentTypes: z.array(DesignContentTypeSchema).max(4),
  formats: z.array(DesignFormatSchema).max(3),
  policyRoles: z.array(DesignPolicyRolesSchema).max(4),
  limits: z.strictObject({
    maxImagesPerRequest: z.int().min(1).max(8),
    maxReferences: z.int().min(0).max(8),
    maxImagesPerDay: z.int().min(1).max(500),
    imagesUsedToday: z.int().min(0),
    monthlySpendLimit: Amount.nullable(),
    /** Computed spend of the current month (UTC); null when no generation of the month could be priced. */
    spentThisMonth: Amount.nullable(),
    maxConcurrentRequests: z.int().min(1).max(4),
  }),
  promptVersion: z.string().min(1).max(64),
});

export const DesignReferenceInputSchema = z.strictObject({
  assetId: UuidSchema,
  role: DesignReferenceRoleSchema,
});

const DesignStyleSchema = noteSchema(300);
/** Longest operator instructions or own prompt. */
export const MAX_DESIGN_INSTRUCTIONS = 12000;
const DesignInstructionsSchema = noteSchema(MAX_DESIGN_INSTRUCTIONS);

/** What to generate (the body of an estimate; a generation adds the request key and the cost confirmation). */
export const DesignGenerationInputSchema = z.strictObject({
  /** `guided` when absent. `own_prompt` needs instructions (the prompt itself). */
  mode: DesignModeSchema.optional(),
  contentType: DesignContentTypeSchema,
  format: DesignFormatSchema,
  /** A configured model; the default model when absent. */
  model: ModelIdSchema.optional(),
  quality: QualitySchema,
  count: z.int().min(1).max(8),
  style: DesignStyleSchema.optional(),
  instructions: DesignInstructionsSchema.optional(),
  references: z.array(DesignReferenceInputSchema).max(8),
  /** A variant starts from this proposal: its image is the base and its instructions are kept. */
  parentProposalId: UuidSchema.optional(),
});

export const DesignGenerationCreateSchema = z.strictObject({
  ...DesignGenerationInputSchema.shape,
  /** Makes a repeated confirmation return the same generation. */
  requestKey: UuidSchema,
  /** The operator confirmed the scope and the possible cost. */
  confirmCost: z.literal(true),
});

/** A brand asset as used by a generation: its role, the policy it had and whether its image was sent. */
export const DesignReferenceSchema = z.strictObject({
  assetId: UuidSchema,
  label: LabelSchema,
  kind: BrandAssetKindSchema,
  usagePolicy: BrandAssetUsagePolicySchema,
  role: DesignReferenceRoleSchema,
  /** True when the image was sent to the provider (`style_reference`, `transform_base`). */
  sent: z.boolean(),
});

/** A cost estimate; `unavailable` when no published per-image cost exists for the model, quality and size. */
export const DesignCostEstimateSchema = z.strictObject({
  status: z.enum(['estimated', 'unavailable']),
  currency: z.literal('USD').nullable(),
  perImage: Amount.nullable(),
  total: Amount.nullable(),
  /** The estimate covers the published output cost of a standard size; input images and text add cost. */
  basis: z.enum(['published_output_cost', 'none']),
  pricingSource: z.string().min(1).max(300).nullable(),
  pricingCheckedOn: DateSchema.nullable(),
});

export const DesignEstimateSchema = z.strictObject({
  provider: z.enum(['openai']),
  mode: DesignModeSchema,
  model: ModelIdSchema,
  quality: QualitySchema,
  count: z.int().min(1).max(8),
  requestSize: ImageSizeSchema,
  outputWidth: z.int().min(1).max(4096),
  outputHeight: z.int().min(1).max(4096),
  adaptation: z.enum(['none', 'center_crop']),
  references: z.array(DesignReferenceSchema).max(9),
  /** The effective prompt that will be sent (no secret, no sports data). */
  prompt: z.string().min(1).max(32000),
  promptVersion: z.string().min(1).max(64),
  cost: DesignCostEstimateSchema,
  imagesUsedToday: z.int().min(0),
  maxImagesPerDay: z.int().min(1).max(500),
  spentThisMonth: Amount.nullable(),
  monthlySpendLimit: Amount.nullable(),
});

export const DesignGenerationSchema = z.strictObject({
  id: UuidSchema,
  mode: DesignModeSchema,
  status: DesignGenerationStatusSchema,
  contentType: DesignContentTypeSchema,
  format: DesignFormatSchema,
  model: ModelIdSchema,
  quality: QualitySchema,
  requestedCount: z.int().min(1).max(8),
  completedCount: z.int().min(0).max(8),
  /** The image being processed (1-based) while the generation runs. */
  currentIndex: z.int().min(1).max(8).nullable(),
  parentProposalId: UuidSchema.nullable(),
  proposalIds: z.array(UuidSchema).max(8),
  errorCode: DesignGenerationErrorCodeSchema.nullable(),
  errorMessage: z.string().min(1).max(300).nullable(),
  retryAfterSeconds: z.int().min(0).nullable(),
  /** Computed from the reported usage and the configured prices; null when it cannot be computed. */
  cost: Amount.nullable(),
  createdAt: DateTimeSchema,
  startedAt: DateTimeSchema.nullable(),
  updatedAt: DateTimeSchema,
  completedAt: DateTimeSchema.nullable(),
});

export const DesignGenerationEventSchema = z.strictObject({
  id: z.int().min(1),
  type: z.string().min(1).max(64),
  generationId: UuidSchema,
  status: DesignGenerationStatusSchema,
  imageIndex: z.int().min(1).max(8).nullable(),
  proposalId: UuidSchema.nullable(),
  timestamp: DateTimeSchema,
});

/** The longest review note: it becomes the instructions of the variant a change request asks for. */
export const MAX_DESIGN_DECISION_NOTE = 1200;
const DecisionNoteSchema = noteSchema(MAX_DESIGN_DECISION_NOTE);

export const DesignProposalSchema = z.strictObject({
  id: UuidSchema,
  generationId: UuidSchema,
  /** `own_prompt` proposals are inspiration images, never a template base. */
  mode: DesignModeSchema,
  name: z.string().min(1).max(120),
  contentType: DesignContentTypeSchema,
  format: DesignFormatSchema,
  width: z.int().min(1).max(4096),
  height: z.int().min(1).max(4096),
  mime: z.enum(['image/png', 'image/jpeg']),
  status: DesignProposalStatusSchema,
  model: ModelIdSchema,
  quality: QualitySchema,
  parentProposalId: UuidSchema.nullable(),
  references: z.array(DesignReferenceSchema).max(9),
  decisionNote: DecisionNoteSchema.nullable(),
  decidedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
});

const TokenCount = z.int().min(0).nullable();

export const DesignProposalDetailSchema = z.strictObject({
  proposal: DesignProposalSchema,
  generation: z.strictObject({
    id: UuidSchema,
    style: DesignStyleSchema.nullable(),
    mode: DesignModeSchema,
    instructions: DesignInstructionsSchema.nullable(),
    inheritedInstructions: noteSchema(MAX_DESIGN_INSTRUCTIONS).nullable(),
    requestSize: ImageSizeSchema,
    adaptation: z.enum(['none', 'center_crop']),
    prompt: z.string().min(1).max(32000),
    promptVersion: z.string().min(1).max(64),
    estimate: DesignCostEstimateSchema,
    requestedCount: z.int().min(1).max(8),
    createdAt: DateTimeSchema,
  }),
  usage: z
    .strictObject({
      inputTextTokens: TokenCount,
      inputImageTokens: TokenCount,
      outputImageTokens: TokenCount,
      outputTextTokens: TokenCount,
      totalTokens: TokenCount,
    })
    .nullable(),
  cost: Amount.nullable(),
  decisions: z
    .array(z.strictObject({ decision: DesignDecisionSchema, note: DecisionNoteSchema.nullable(), decidedAt: DateTimeSchema }))
    .max(200),
  variantIds: z.array(UuidSchema).max(200),
  /** Original brand assets drawn unchanged over the generated background, with their pixel boxes. */
  layers: z
    .array(
      z.strictObject({
        assetId: UuidSchema,
        label: LabelSchema,
        kind: BrandAssetKindSchema,
        x: z.int().min(0).max(4096),
        y: z.int().min(0).max(4096),
        width: z.int().min(1).max(4096),
        height: z.int().min(1).max(4096),
      }),
    )
    .max(3),
  /** True when the generated background is kept apart from the composed preview (getDesignProposalBackground). */
  hasBackground: z.boolean(),
});

export const DesignProposalDecisionInputSchema = z.strictObject({
  decision: DesignDecisionSchema,
  note: DecisionNoteSchema.optional(),
});

export const DesignModelAccessCheckSchema = z.strictObject({ model: ModelIdSchema });

export const DesignModelAccessSchema = z.strictObject({
  model: ModelIdSchema,
  access: z.enum(['available', 'unavailable', 'not_authorized', 'missing_api_key', 'disabled', 'error']),
  errorCode: DesignGenerationErrorCodeSchema.nullable(),
});

export const DesignGenerationStartSchema = z.strictObject({
  generation: DesignGenerationSchema,
  statusUrl: z.string().max(200).regex(contractRegExp('DesignGenerationUrl')),
  eventsUrl: z.string().max(200).regex(contractRegExp('DesignGenerationUrl')),
});

export const DesignProposalListSchema = z.strictObject({ proposals: z.array(DesignProposalSchema) });

export type DesignMode = z.infer<typeof DesignModeSchema>;
export type DesignContentType = z.infer<typeof DesignContentTypeSchema>;
export type DesignFormat = z.infer<typeof DesignFormatSchema>;
export type DesignReferenceRole = z.infer<typeof DesignReferenceRoleSchema>;
export type DesignGenerationStatus = z.infer<typeof DesignGenerationStatusSchema>;
export type DesignProposalStatus = z.infer<typeof DesignProposalStatusSchema>;
export type DesignDecision = z.infer<typeof DesignDecisionSchema>;
export type DesignGenerationErrorCode = z.infer<typeof DesignGenerationErrorCodeSchema>;
export type DesignPricing = z.infer<typeof DesignPricingSchema>;
export type DesignModel = z.infer<typeof DesignModelSchema>;
export type DesignCapabilities = z.infer<typeof DesignCapabilitiesSchema>;
export type DesignReferenceInput = z.infer<typeof DesignReferenceInputSchema>;
export type DesignGenerationInput = z.infer<typeof DesignGenerationInputSchema>;
export type DesignGenerationCreate = z.infer<typeof DesignGenerationCreateSchema>;
export type DesignReference = z.infer<typeof DesignReferenceSchema>;
export type DesignCostEstimate = z.infer<typeof DesignCostEstimateSchema>;
export type DesignEstimate = z.infer<typeof DesignEstimateSchema>;
export type DesignGeneration = z.infer<typeof DesignGenerationSchema>;
export type DesignGenerationEvent = z.infer<typeof DesignGenerationEventSchema>;
export type DesignProposal = z.infer<typeof DesignProposalSchema>;
export type DesignProposalDetail = z.infer<typeof DesignProposalDetailSchema>;
export type DesignProposalDecisionInput = z.infer<typeof DesignProposalDecisionInputSchema>;
export type DesignModelAccess = z.infer<typeof DesignModelAccessSchema>;
export type DesignGenerationStart = z.infer<typeof DesignGenerationStartSchema>;
