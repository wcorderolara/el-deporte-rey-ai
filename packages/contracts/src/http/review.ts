/**
 * Contract schemas of drafts, review and visual QA (operations getActiveDraft, regenerateElement, approveElement,
 * withdrawElementApproval, acknowledgeQaWarnings, approveCarousel): Draft, Carousel, Element,
 * ElementVersion, TextField, ContentFlag, QaResult (closed details per check, T10-F17), QaOutcome, QaMismatch,
 * VersionRef, FinalApproval.
 */
import { z } from 'zod';

import { FactRefSchema, FactStatusSchema, LeftOutMatchSchema } from './facts.js';
import {
  ContractPatterns,
  DataModeSchema,
  DateTimeSchema,
  LanguageSchema,
  MatchKeySchema,
  Sha256Schema,
  UuidSchema,
} from './primitives.js';

/**
 * Visual-QA check names. `capitalized_tokens` is the OD-26 warning check (capitalized tokens in AI-written text that
 * are not verified team or competition names, the language word list or the brand terms; T11H-F17). `team_badges` is
 * the PD-ARCH-01G-E.1 warning check (decision DE-E4): a badge slot of an engine match template left empty because its
 * team has no badge in the project's snapshot (PD-28 point 4).
 */
export const QA_CHECKS = [
  'data_match',
  'team_names',
  'text_fit',
  'style_consistency',
  'dimensions',
  'capitalized_tokens',
  'team_badges',
] as const;

export const QaCheckSchema = z.enum(QA_CHECKS);

/** Warning checks that the operator acknowledges through acknowledgeQaWarnings (OD-09, OD-26, DE-E4). */
export const QA_WARNING_CHECKS = ['style_consistency', 'capitalized_tokens', 'team_badges'] as const;

export const QaWarningCheckSchema = z.enum(QA_WARNING_CHECKS);

export const QaOutcomeSchema = z.enum(['pass', 'fail']);

export const QaMismatchSchema = z.strictObject({
  elementId: z.string().max(64),
  factId: UuidSchema.nullable(),
  expected: z.string().max(200),
  actual: z.string().max(200),
});

const mismatchDetails = z.strictObject({ mismatches: z.array(QaMismatchSchema) });

/** One QA check result; details are closed per check (T10-F17). */
export const QaResultSchema = z.discriminatedUnion('check', [
  z.strictObject({
    check: z.literal('data_match'),
    outcome: QaOutcomeSchema,
    severity: z.literal('blocking'),
    details: mismatchDetails,
    acknowledgedAt: z.null(),
  }),
  z.strictObject({
    check: z.literal('team_names'),
    outcome: QaOutcomeSchema,
    severity: z.literal('blocking'),
    details: mismatchDetails,
    acknowledgedAt: z.null(),
  }),
  z.strictObject({
    check: z.literal('text_fit'),
    outcome: QaOutcomeSchema,
    severity: z.literal('blocking'),
    details: z.strictObject({ overflowingElements: z.array(z.string().max(64)) }),
    acknowledgedAt: z.null(),
  }),
  z.strictObject({
    check: z.literal('style_consistency'),
    outcome: QaOutcomeSchema,
    severity: z.literal('warning'),
    details: z.strictObject({
      colorsOutsidePalette: z.array(z.string().regex(new RegExp(ContractPatterns.ColorHex, 'u'))),
      fontsOutsideSet: z.array(z.string().max(64)),
      templateVersions: z.array(z.string().max(64)),
    }),
    acknowledgedAt: DateTimeSchema.nullable(),
  }),
  z.strictObject({
    check: z.literal('dimensions'),
    outcome: QaOutcomeSchema,
    severity: z.literal('blocking'),
    details: z.strictObject({
      expectedWidth: z.int(),
      expectedHeight: z.int(),
      actualWidth: z.int(),
      actualHeight: z.int(),
    }),
    acknowledgedAt: z.null(),
  }),
  z.strictObject({
    check: z.literal('capitalized_tokens'),
    outcome: QaOutcomeSchema,
    severity: z.literal('warning'),
    details: z.strictObject({ tokens: z.array(z.string().max(64)) }),
    acknowledgedAt: DateTimeSchema.nullable(),
  }),
  z.strictObject({
    check: z.literal('team_badges'),
    outcome: QaOutcomeSchema,
    severity: z.literal('warning'),
    /** The badge slots left empty (`team-badge-home`, `team-badge-away`). */
    details: z.strictObject({ emptyBadgeSlots: z.array(z.enum(['team-badge-home', 'team-badge-away'])) }),
    acknowledgedAt: DateTimeSchema.nullable(),
  }),
]);

export const ContentFlagSchema = z.strictObject({
  /** `UNPLAYED_RESULT_CLAIM`: text that states or predicts a result of a match not played yet (PD-ARCH-01E-B). */
  code: z.enum([
    'UNKNOWN_FACT_REFERENCE',
    'UNVERIFIED_NUMBER',
    'NON_OFFICIAL_TEAM_NAME',
    'FORBIDDEN_CONTENT',
    'UNPLAYED_RESULT_CLAIM',
  ]),
  field: z.string().max(40),
  excerpt: z.string().max(120),
});

export const TextFieldNameSchema = z.enum([
  'headline',
  'description',
  'caption',
  'hashtags',
  'title',
  'score',
  'team_home',
  'team_away',
  'kickoff',
  'standings',
  'footer',
  'demo_label',
  'match_status',
  'fixtures',
  /**
   * Values of the slides of a project that uses a visual template (PD-ARCH-01G-D): each team's goals and the kickoff
   * time, as fact segments, so a template can draw them independently.
   */
  'score_home',
  'score_away',
  'kickoff_time',
]);

export const SegmentProvenanceSchema = z.enum(['fact', 'commentary', 'template_text']);

export const TextFieldSchema = z.strictObject({
  field: TextFieldNameSchema,
  segments: z.array(
    z.strictObject({
      /** OD-01, R-028, R-208; a fact segment shows the current status of its fact. */
      provenance: SegmentProvenanceSchema,
      text: z.string().max(2200),
      factId: UuidSchema.nullable(),
      factStatus: FactStatusSchema.nullable(),
    }),
  ),
});

export const ElementVersionStateSchema = z.enum(['pending_qa', 'qa_failed', 'ready', 'approved', 'superseded']);

export const ElementVersionSchema = z.strictObject({
  id: UuidSchema,
  versionNumber: z.int(),
  createdAt: DateTimeSchema,
  state: ElementVersionStateSchema,
  /** True when a referenced fact is not publishable (R-026, R-271, R-272). */
  blocked: z.boolean(),
  blockingFacts: z.array(FactRefSchema),
  contentFlags: z.array(ContentFlagSchema),
  qa: z.array(QaResultSchema),
  fields: z.array(TextFieldSchema),
  /** Relative API path of the slide image. */
  imageUrl: z.string().max(200).nullable(),
  width: z.int().nullable(),
  height: z.int().nullable(),
});

export const ElementKindSchema = z.enum(['slide', 'caption']);

/** `round_overview`, `fixture` and `match_preview` describe matches not played yet (PD-ARCH-01E-B). */
export const SlideTypeSchema = z.enum([
  'cover',
  'match_result',
  'standings',
  'closing',
  'round_overview',
  'fixture',
  'match_preview',
]);

export const ElementSchema = z.strictObject({
  id: UuidSchema,
  carouselId: UuidSchema,
  kind: ElementKindSchema,
  position: z.int(),
  slideType: SlideTypeSchema.nullable(),
  currentVersion: ElementVersionSchema,
});

export const FinalApprovalSchema = z.strictObject({
  id: UuidSchema,
  carouselId: UuidSchema,
  approvedAt: DateTimeSchema,
  versionSetSha256: Sha256Schema,
  valid: z.boolean(),
});

export const CarouselSchema = z.strictObject({
  id: UuidSchema,
  sequence: z.int(),
  total: z.int(),
  elements: z.array(ElementSchema),
  readyForFinalApproval: z.boolean(),
  finalApproval: FinalApprovalSchema.nullable(),
});

export const DraftSchema = z.strictObject({
  id: UuidSchema,
  projectId: UuidSchema,
  runId: UuidSchema,
  factsRunId: UuidSchema,
  language: LanguageSchema,
  dataMode: DataModeSchema,
  demonstration: z.boolean(),
  /** False when the selection has no standings; the carousel then has no standings slide (R-285). */
  standingsIncluded: z.boolean(),
  createdAt: DateTimeSchema,
  excludedMatchKeys: z.array(MatchKeySchema),
  leftOutMatches: z.array(LeftOutMatchSchema),
  carousels: z.array(CarouselSchema),
});

export const VersionRefSchema = z.strictObject({ versionId: UuidSchema });

export type QaCheck = z.infer<typeof QaCheckSchema>;
export type QaWarningCheck = z.infer<typeof QaWarningCheckSchema>;
export type QaOutcome = z.infer<typeof QaOutcomeSchema>;
export type QaMismatch = z.infer<typeof QaMismatchSchema>;
export type QaResult = z.infer<typeof QaResultSchema>;
export type ContentFlag = z.infer<typeof ContentFlagSchema>;
export type TextFieldName = z.infer<typeof TextFieldNameSchema>;
export type SegmentProvenance = z.infer<typeof SegmentProvenanceSchema>;
export type TextField = z.infer<typeof TextFieldSchema>;
export type ElementVersionState = z.infer<typeof ElementVersionStateSchema>;
export type ElementVersion = z.infer<typeof ElementVersionSchema>;
export type ElementKind = z.infer<typeof ElementKindSchema>;
export type SlideType = z.infer<typeof SlideTypeSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type FinalApproval = z.infer<typeof FinalApprovalSchema>;
export type Carousel = z.infer<typeof CarouselSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type VersionRef = z.infer<typeof VersionRefSchema>;
