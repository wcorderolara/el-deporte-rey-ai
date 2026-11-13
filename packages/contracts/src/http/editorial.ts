/**
 * Editorial copy of a project (PD-ARCH-01H): the five deliverables written from the confirmed sports context, their
 * versions and approvals, the deterministic key events and the evidence they rest on, and the writer that drafted
 * them. Mirror of the `Editorial*` component schemas of `contracts/http-api.openapi.yaml` (AD-04).
 *
 * - A deliverable is a fixed list of named fields (`EDITORIAL_DELIVERABLE_FIELDS`), so every field can be shown and
 *   copied on its own. The text of a field is the final text: placeholders already replaced by the confirmed values.
 * - Evidence is never a confidence score: each item has a verification status. `CONFIRMED` comes from the local
 *   sports data (a verified or operator-approved fact); `VERIFIED_EXTERNAL` only from an authorized research adapter,
 *   which does not exist in PD-ARCH-01H (research mode `local_context`); `UNVERIFIED` and `CONFLICTING` facts are
 *   listed for the operator and never sent to the writer.
 * - No URL is ever produced by the writer: a source URL can only come from the system.
 */
import { z } from 'zod';

import { DateSchema, DateTimeSchema, LanguageSchema, UuidSchema, contractRegExp } from './primitives.js';

export const EDITORIAL_DELIVERABLES = [
  'facebook_instagram',
  'tiktok_reels',
  'viral_headlines',
  'youtube',
  'debate_question',
] as const;

export const EditorialDeliverableSchema = z.enum(EDITORIAL_DELIVERABLES);
export type EditorialDeliverable = z.infer<typeof EditorialDeliverableSchema>;

export const EDITORIAL_FIELD_NAMES = [
  'headline',
  'body',
  'question',
  'hashtags',
  'copy',
  'headline_1',
  'headline_2',
  'headline_3',
  'title',
  'description',
] as const;

export const EditorialFieldNameSchema = z.enum(EDITORIAL_FIELD_NAMES);
export type EditorialFieldName = z.infer<typeof EditorialFieldNameSchema>;

/** The fields of each deliverable, in display order. */
export const EDITORIAL_DELIVERABLE_FIELDS: Readonly<Record<EditorialDeliverable, readonly EditorialFieldName[]>> =
  Object.freeze({
    facebook_instagram: ['headline', 'body', 'question', 'hashtags'],
    tiktok_reels: ['copy'],
    viral_headlines: ['headline_1', 'headline_2', 'headline_3'],
    youtube: ['title', 'description'],
    debate_question: ['question'],
  });

/**
 * The paste-ready text of one deliverable from its fields, the same in the review's download and in the export's
 * `copy-editorial.txt` (REVIEW-APPROVAL-01): the post fields separated by blank lines, the three headlines numbered,
 * the YouTube title and description under their labels. A missing field is empty.
 */
export function editorialDeliverableText(
  deliverable: EditorialDeliverable,
  fields: readonly { readonly name: EditorialFieldName; readonly text: string }[],
): string {
  const field = (name: EditorialFieldName): string => fields.find((entry) => entry.name === name)?.text ?? '';
  switch (deliverable) {
    case 'facebook_instagram':
      return [field('headline'), field('body'), field('question'), field('hashtags')]
        .filter((text) => text !== '')
        .join('\n\n');
    case 'tiktok_reels':
      return field('copy');
    case 'viral_headlines':
      return (['headline_1', 'headline_2', 'headline_3'] as const)
        .map((name, index) => `${String(index + 1)}. ${field(name)}`)
        .join('\n');
    case 'youtube':
      return `Título:\n${field('title')}\n\nDescripción:\n${field('description')}`;
    case 'debate_question':
      return field('question');
  }
}

/** Longest text of one field (the YouTube description limit). */
export const MAX_EDITORIAL_FIELD_TEXT = 5000;
/** Longest operator instruction for a generation. */
export const MAX_EDITORIAL_INSTRUCTIONS = 500;

export const EditorialVerificationSchema = z.enum(['CONFIRMED', 'VERIFIED_EXTERNAL', 'UNVERIFIED', 'CONFLICTING']);
export const EditorialResearchModeSchema = z.enum(['local_context', 'verified_research']);
/** `test`: the deterministic stub, no AI; `hosted_ai`: a hosted model; `local_ai`: a model server on loopback. */
export const EditorialWriterKindSchema = z.enum(['test', 'hosted_ai', 'local_ai']);
export const EditorialRoundStatusSchema = z.enum(['complete', 'incomplete', 'unknown']);
export const EditorialRoundBasisSchema = z.enum(['local_round', 'selection', 'none']);
export const EditorialEventKindSchema = z.enum([
  'thrashing',
  'high_scoring',
  'away_win',
  'home_win',
  'goalless_draw',
  'scoring_draw',
  'round_incomplete',
  'postponed_matches',
  'upcoming_matches',
]);
export const EditorialVersionOriginSchema = z.enum(['generated', 'regenerated', 'edited']);
export const EditorialVersionStateSchema = z.enum(['ready', 'flagged', 'approved', 'superseded']);
export const EditorialGenerationStatusSchema = z.enum(['running', 'succeeded', 'failed']);
export const EditorialGenerationErrorCodeSchema = z.enum([
  'unavailable',
  'rate_limited',
  'timeout',
  'ai_response_invalid',
  'interrupted',
]);
export const EditorialUnavailableReasonSchema = z.enum(['no_draft', 'no_confirmed_facts']);
export const EditorialContentKindSchema = z.enum(['results', 'calendar', 'upcoming', 'preview']);
export const EditorialFlagCodeSchema = z.enum([
  'UNKNOWN_FACT_REFERENCE',
  'UNVERIFIED_NUMBER',
  'NON_OFFICIAL_TEAM_NAME',
  'FORBIDDEN_CONTENT',
  'UNPLAYED_RESULT_CLAIM',
  'LENGTH_OUT_OF_RANGE',
  'FORMAT_RULE',
  'UNKNOWN_EVENT_REFERENCE',
  'UNKNOWN_EVIDENCE_REFERENCE',
  'INCOMPLETE_ROUND_CLAIM',
  'STANDINGS_CLAIM_WITHOUT_DATA',
]);

export const EditorialEvidenceIdSchema = z.string().min(4).max(64).regex(contractRegExp('EditorialEvidenceId'));
export const EditorialEventIdSchema = z.string().min(5).max(64).regex(contractRegExp('EditorialEventId'));
export const AiModelIdSchema = z.string().min(1).max(100).regex(contractRegExp('AiModelId'));
export const EditorialInstructionsSchema = z
  .string()
  .min(1)
  .max(MAX_EDITORIAL_INSTRUCTIONS)
  .regex(contractRegExp('EditorialInstructions'));

const amount = z.number().min(0).max(100000);
const count = z.number().int().min(0).max(1000000);
const shortText = (max: number) => z.string().min(1).max(max);

export const EditorialFieldSchema = z.strictObject({
  name: EditorialFieldNameSchema,
  text: z.string().max(MAX_EDITORIAL_FIELD_TEXT),
  words: count,
  characters: count,
});

export const EditorialFlagSchema = z.strictObject({
  code: EditorialFlagCodeSchema,
  field: z.string().max(40),
  excerpt: z.string().max(120),
});

export const EditorialSourceSchema = z.strictObject({
  kind: z.enum(['local', 'external']),
  name: shortText(120),
  url: z.string().min(1).max(2048).nullable(),
});

export const EditorialEvidenceSchema = z.strictObject({
  id: EditorialEvidenceIdSchema,
  factType: z.enum(['match_result', 'match_fixture', 'standing_row']),
  description: shortText(300),
  competitionId: UuidSchema.nullable(),
  seasonId: UuidSchema.nullable(),
  roundId: UuidSchema.nullable(),
  matchKey: z.string().min(1).max(128).nullable(),
  factIds: z.array(UuidSchema).max(20),
  source: EditorialSourceSchema,
  publishedAt: DateTimeSchema.nullable(),
  retrievedAt: DateTimeSchema,
  verification: EditorialVerificationSchema,
  conflicts: z.array(shortText(300)).max(10),
});

export const EditorialEventSchema = z.strictObject({
  id: EditorialEventIdSchema,
  kind: EditorialEventKindSchema,
  description: shortText(300),
  matchKey: z.string().min(1).max(128).nullable(),
  evidenceIds: z.array(EditorialEvidenceIdSchema).max(40),
});

export const EditorialRoundStateSchema = z.strictObject({
  status: EditorialRoundStatusSchema,
  basis: EditorialRoundBasisSchema,
  total: count.nullable(),
  finished: count,
  inProgress: count,
  pending: count,
  postponed: count,
  cancelled: count,
});

export const EditorialContextSchema = z.strictObject({
  competitionName: shortText(80),
  seasonLabel: shortText(80),
  stageLabel: shortText(120),
  roundLabel: shortText(120).nullable(),
  contentKind: EditorialContentKindSchema,
  language: LanguageSchema,
  matchCount: count,
  confirmedMatchCount: count,
  standingsAvailable: z.boolean(),
  roundState: EditorialRoundStateSchema,
});

export const EditorialResearchSchema = z.strictObject({
  mode: EditorialResearchModeSchema,
  retrievedAt: DateTimeSchema.nullable(),
  keyEvents: z.array(EditorialEventSchema).max(40),
  evidence: z.array(EditorialEvidenceSchema).max(400),
  unverified: z.array(EditorialEvidenceSchema).max(400),
  conflicts: z.array(EditorialEvidenceSchema).max(400),
});

export const EditorialPricingSchema = z.strictObject({
  currency: z.literal('USD'),
  inputPerMillionTokens: amount,
  outputPerMillionTokens: amount,
  source: shortText(300),
  checkedOn: DateSchema,
});

export const EditorialWriterSchema = z.strictObject({
  adapter: z.string().min(1).max(41).regex(contractRegExp('SourceId')),
  kind: EditorialWriterKindSchema,
  model: AiModelIdSchema.nullable(),
  status: z.enum(['ready', 'missing_api_key']),
  requiresCostConfirmation: z.boolean(),
  pricing: EditorialPricingSchema.nullable(),
  maxGenerationsPerDay: count,
  generationsToday: count,
  monthlySpendLimit: amount.nullable(),
  spentThisMonth: amount.nullable(),
  estimate: z.strictObject({
    status: z.enum(['free', 'estimated', 'unavailable']),
    total: amount.nullable(),
  }),
});

export const EditorialVersionSchema = z.strictObject({
  id: UuidSchema,
  deliverable: EditorialDeliverableSchema,
  versionNumber: z.number().int().min(1).max(100000),
  origin: EditorialVersionOriginSchema,
  state: EditorialVersionStateSchema,
  fields: z.array(EditorialFieldSchema).min(1).max(4),
  flags: z.array(EditorialFlagSchema).max(40),
  generationId: UuidSchema.nullable(),
  instructions: EditorialInstructionsSchema.nullable(),
  eventIds: z.array(EditorialEventIdSchema).max(40),
  evidenceIds: z.array(EditorialEvidenceIdSchema).max(400),
  createdAt: DateTimeSchema,
  approvedAt: DateTimeSchema.nullable(),
});

export const EditorialDeliverableStateSchema = z.strictObject({
  deliverable: EditorialDeliverableSchema,
  current: EditorialVersionSchema.nullable(),
  versionCount: count,
  /**
   * REVIEW-APPROVAL-01: true when the current version would go into a carousel's export now: approved, without flags,
   * and every fact it rests on publishable (the export's own rule). An approved version whose facts stopped being
   * publishable is approved but not exportable. The export checks it again when it writes the files.
   */
  exportable: z.boolean(),
});

export const EditorialGenerationSchema = z.strictObject({
  id: UuidSchema,
  status: EditorialGenerationStatusSchema,
  deliverables: z.array(EditorialDeliverableSchema).min(1).max(5),
  instructions: EditorialInstructionsSchema.nullable(),
  adapter: z.string().min(1).max(41).regex(contractRegExp('SourceId')),
  writerKind: EditorialWriterKindSchema,
  model: AiModelIdSchema.nullable(),
  promptVersion: shortText(60),
  researchMode: EditorialResearchModeSchema,
  errorCode: EditorialGenerationErrorCodeSchema.nullable(),
  errorMessage: shortText(300).nullable(),
  estimatedCost: amount.nullable(),
  computedCost: amount.nullable(),
  createdAt: DateTimeSchema,
  completedAt: DateTimeSchema.nullable(),
});

export const EditorialPackageSchema = z.strictObject({
  projectId: UuidSchema,
  draftId: UuidSchema.nullable(),
  available: z.boolean(),
  unavailableReason: EditorialUnavailableReasonSchema.nullable(),
  context: EditorialContextSchema.nullable(),
  research: EditorialResearchSchema,
  writer: EditorialWriterSchema,
  deliverables: z.array(EditorialDeliverableStateSchema).max(5),
  lastGeneration: EditorialGenerationSchema.nullable(),
});

export const EditorialGenerationCreateSchema = z.strictObject({
  requestKey: UuidSchema,
  /** One deliverable to regenerate; absent: all five. */
  deliverable: EditorialDeliverableSchema.optional(),
  instructions: EditorialInstructionsSchema.optional(),
  /** Required (true) when the writer is billed (`requiresCostConfirmation`). */
  confirmCost: z.boolean().optional(),
});

export const EditorialGenerationResultSchema = z.strictObject({
  generation: EditorialGenerationSchema,
  package: EditorialPackageSchema,
});

export const EditorialEditFieldSchema = z.strictObject({
  name: EditorialFieldNameSchema,
  text: z.string().min(1).max(MAX_EDITORIAL_FIELD_TEXT).regex(contractRegExp('EditorialText')),
});

export const EditorialEditCreateSchema = z.strictObject({
  baseVersionId: UuidSchema,
  fields: z.array(EditorialEditFieldSchema).min(1).max(4),
});

export const EditorialDeliverableParamsSchema = z.strictObject({
  projectId: UuidSchema,
  deliverable: EditorialDeliverableSchema,
});

export type EditorialVerification = z.infer<typeof EditorialVerificationSchema>;
export type EditorialResearchMode = z.infer<typeof EditorialResearchModeSchema>;
export type EditorialWriterKind = z.infer<typeof EditorialWriterKindSchema>;
export type EditorialRoundStatus = z.infer<typeof EditorialRoundStatusSchema>;
export type EditorialEventKind = z.infer<typeof EditorialEventKindSchema>;
export type EditorialVersionOrigin = z.infer<typeof EditorialVersionOriginSchema>;
export type EditorialVersionState = z.infer<typeof EditorialVersionStateSchema>;
export type EditorialGenerationStatus = z.infer<typeof EditorialGenerationStatusSchema>;
export type EditorialGenerationErrorCode = z.infer<typeof EditorialGenerationErrorCodeSchema>;
export type EditorialUnavailableReason = z.infer<typeof EditorialUnavailableReasonSchema>;
export type EditorialContentKind = z.infer<typeof EditorialContentKindSchema>;
export type EditorialFlagCode = z.infer<typeof EditorialFlagCodeSchema>;
export type EditorialField = z.infer<typeof EditorialFieldSchema>;
export type EditorialFlag = z.infer<typeof EditorialFlagSchema>;
export type EditorialSource = z.infer<typeof EditorialSourceSchema>;
export type EditorialEvidence = z.infer<typeof EditorialEvidenceSchema>;
export type EditorialEvent = z.infer<typeof EditorialEventSchema>;
export type EditorialRoundState = z.infer<typeof EditorialRoundStateSchema>;
export type EditorialContext = z.infer<typeof EditorialContextSchema>;
export type EditorialResearch = z.infer<typeof EditorialResearchSchema>;
export type EditorialPricing = z.infer<typeof EditorialPricingSchema>;
export type EditorialWriter = z.infer<typeof EditorialWriterSchema>;
export type EditorialVersion = z.infer<typeof EditorialVersionSchema>;
export type EditorialDeliverableState = z.infer<typeof EditorialDeliverableStateSchema>;
export type EditorialGeneration = z.infer<typeof EditorialGenerationSchema>;
export type EditorialPackage = z.infer<typeof EditorialPackageSchema>;
export type EditorialGenerationCreate = z.infer<typeof EditorialGenerationCreateSchema>;
export type EditorialGenerationResult = z.infer<typeof EditorialGenerationResultSchema>;
export type EditorialEditField = z.infer<typeof EditorialEditFieldSchema>;
export type EditorialEditCreate = z.infer<typeof EditorialEditCreateSchema>;
