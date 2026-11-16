/**
 * Schemas of the content stage (architecture.md sections 6 and 8; data-model.md section 3.3; contracts/provider-ports.md
 * section 3): the facts view the stage reads, the stored element text with provenance segments, the element subject,
 * and the stage input and output.
 *
 * Every object is closed. The facts view carries only fact IDs, keys, kinds, subjects, statuses and the per-kind
 * values of the contract (team- and competition-level only, R-232): no source reference, attribution, import metadata
 * or data mode can reach the stage input, and therefore none can reach the AI request (T11H-F16, V-13a).
 */
import {
  ContentFlagSchema,
  ContextItemValueSchema,
  DisplayNameSchema,
  ElementKindSchema,
  FactStatusSchema,
  FactSubjectSchema,
  LanguageSchema,
  LeftOutMatchSchema,
  MatchKeySchema,
  MatchKickoffValueSchema,
  MatchScoreValueSchema,
  MatchStatusValueSchema,
  MatchTeamsValueSchema,
  MatchdayInfoValueSchema,
  SegmentProvenanceSchema,
  SlideTypeSchema,
  SlugSchema,
  StageNameSchema,
  StandingRowValueSchema,
  StandingsAvailabilitySchema,
  TeamOfficialNameValueSchema,
  TextFieldNameSchema,
  UnverifiedReasonSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

// ---------------------------------------------------------------------------------------------------------------
// Facts view
// ---------------------------------------------------------------------------------------------------------------

/** Longest fact key (data-model.md; contract `FactRef.factKey`). */
export const MAX_FACT_KEY_LENGTH = 200;

/** Most facts one draft reads (bounded by the snapshot caps of a selection). */
export const MAX_FACTS = 5000;

/** Most aliases read per draft. */
export const MAX_ALIASES = 5000;

function factVariant<K extends string, V extends z.ZodType>(kind: K, value: V) {
  return z.strictObject({
    id: UuidSchema,
    factKey: z.string().min(1).max(MAX_FACT_KEY_LENGTH),
    kind: z.literal(kind),
    subject: FactSubjectSchema,
    /** Effective status: `manually_approved` is derived from the manual approvals (AD-28). */
    status: FactStatusSchema,
    unverifiedReason: UnverifiedReasonSchema,
    /** The verified value; null unless verified. */
    value: value.nullable(),
    /** The single consistent value of an unverified or manually approved fact; null otherwise. */
    candidateValue: value.nullable(),
  });
}

/** One fact as the content stage sees it (data-model.md `facts`; contract per-kind values, T10-F17). */
export const ContentFactSchema = z.discriminatedUnion('kind', [
  factVariant('match_teams', MatchTeamsValueSchema),
  factVariant('match_kickoff', MatchKickoffValueSchema),
  factVariant('match_status', MatchStatusValueSchema),
  factVariant('match_score', MatchScoreValueSchema),
  factVariant('standing_row', StandingRowValueSchema),
  factVariant('matchday_info', MatchdayInfoValueSchema),
  factVariant('context_item', ContextItemValueSchema),
  factVariant('team_official_name', TeamOfficialNameValueSchema),
]);

export type ContentFact = z.infer<typeof ContentFactSchema>;

/** A known name form of a team (data-model.md `team_aliases`), used only by the checks, never sent to the AI. */
export const TeamAliasSchema = z.strictObject({
  teamId: SlugSchema,
  alias: z.string().min(1).max(200),
});

export type TeamAlias = z.infer<typeof TeamAliasSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Stored element text (`element_versions.text`) and subject (`elements.subject`)
// ---------------------------------------------------------------------------------------------------------------

/** Longest segment text (contract `TextField.segments[].text`). */
export const MAX_SEGMENT_TEXT = 2200;

/**
 * One provenance segment (OD-01, R-028, R-208): `commentary` (AI text), `template_text` (fixed text from the
 * per-language tables and the project's selection labels) or `fact` (a substituted value, with its fact ID). The
 * current status of a fact segment is added at read time (contract `factStatus`), so a segment is labelled "verified
 * fact" only while its fact is verified (R-071).
 */
export const SegmentSchema = z
  .strictObject({
    provenance: SegmentProvenanceSchema,
    text: z.string().max(MAX_SEGMENT_TEXT),
    factId: UuidSchema.nullable(),
  })
  .refine((segment) => (segment.provenance === 'fact') === (segment.factId !== null), {
    message: 'a fact segment has a fact ID and no other segment has one',
  });

export type Segment = z.infer<typeof SegmentSchema>;

export const StoredTextFieldSchema = z.strictObject({
  field: TextFieldNameSchema,
  segments: z.array(SegmentSchema).max(2000),
});

export type ElementTextField = z.infer<typeof StoredTextFieldSchema>;

/** Version of the stored text layout. */
export const ELEMENT_TEXT_VERSION = 1;

/**
 * The text of an element version (`element_versions.text`). Field layout by slide type:
 * - cover: `title` (template text segments: competition name, stage display, season label), `footer` ("1/2" when
 *   the selection is split into several carousels), `headline`, `description`;
 * - match_result: `title` (fixed result title and the deterministic result relation phrase, T10-F06), `team_home`,
 *   `team_away`, `score`, `kickoff` (fact segments), `headline`, `description`;
 * - standings: `title`, `standings` (per row: a fact segment of the standing row with the cells of
 *   `standingRowCells`, a fact segment of the team name, and a template-text line break between rows), `headline`,
 *   `description`;
 * - closing: `title` (the fixed follow text and the brand handle), `headline`, `description`;
 * - caption element: `caption` and `hashtags` (one segment per hashtag).
 */
export const ElementTextSchema = z.strictObject({
  version: z.literal(ELEMENT_TEXT_VERSION),
  fields: z.array(StoredTextFieldSchema).max(20),
});

export type ElementText = z.infer<typeof ElementTextSchema>;

/** What an element shows (`elements.subject`), enough to rebuild its slide for a regeneration. */
export const ElementSubjectSchema = z.strictObject({
  /** Canonical match key of a match-result slide; null otherwise. */
  matchKey: MatchKeySchema.nullable(),
  /** Position of the match in the draft's match order (its placeholder prefix `m<n>`); null otherwise. */
  matchIndex: z.int().min(1).nullable(),
  /** Page number of a standings slide; null otherwise. */
  standingsPage: z.int().min(1).nullable(),
  /** The teams of the standings rows of a standings slide, in order; empty otherwise. */
  teamIds: z.array(SlugSchema).max(400),
});

export type ElementSubject = z.infer<typeof ElementSubjectSchema>;

export const FactRefUsageSchema = z.enum(['template', 'placeholder']);

/** A fact an element version uses (`element_fact_refs`): blocking (R-026, R-271, R-272) and traceability. */
export const ElementFactRefSchema = z.strictObject({ factId: UuidSchema, usage: FactRefUsageSchema });

export type ElementFactRef = z.infer<typeof ElementFactRefSchema>;

/** The content of one new element version. */
export const ElementVersionContentSchema = z.strictObject({
  text: ElementTextSchema,
  contentFlags: z.array(ContentFlagSchema).max(40),
  factRefs: z.array(ElementFactRefSchema).max(2000),
});

export type ElementVersionContent = z.infer<typeof ElementVersionContentSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Stage input and output
// ---------------------------------------------------------------------------------------------------------------

/** Brand handle pattern of the configuration and of the AI port. */
const BrandHandleSchema = z.string().regex(/^@[A-Za-z0-9._]{1,30}$/);

/** Content kinds (`structure.ts`): the results carousel and the kinds of matches not played yet. */
export const ContentKindSchema = z.enum(['results', 'calendar', 'upcoming', 'preview']);

export const ContentInputSchema = z.strictObject({
  projectId: UuidSchema,
  runId: UuidSchema,
  /** The run whose facts the draft uses: the run itself (full) or its base run (redraft). */
  factsRunId: UuidSchema,
  language: LanguageSchema,
  /** Selection labels of the project (snapshots taken at creation; AD-21). */
  competitionName: DisplayNameSchema,
  seasonLabel: DisplayNameSchema,
  stageLabel: StageNameSchema,
  matchday: z.int().min(1).nullable(),
  /** The structure of the project's carousels (PD-ARCH-01E-B). */
  contentKind: ContentKindSchema,
  /**
   * True when the project uses a visual template (PD-ARCH-01G-D): the match slides also store each team's goals, the
   * kickoff time and, on results, the status, as fact segments the template can draw independently.
   */
  templateFields: z.boolean().optional(),
  /**
   * True when the project's badge snapshot covers the calendar rows (PD-ARCH-01G-E.2, version 3): the round overview
   * pages hold six fixtures, and each line also stores the kickoff time and the status of a match that is not
   * scheduled, as fact segments a calendar row draws on their own.
   */
  calendarRows: z.boolean().optional(),
  brand: z.strictObject({ name: z.string().min(1).max(80), handle: BrandHandleSchema }),
  utcOffsetMinutes: z.int(),
  maxSlidesPerCarousel: z.int().min(3).max(100),
  standingsRowsPerSlide: z.int().min(1).max(100),
  /** Standings availability recorded by research for the facts run; null when none was recorded. */
  standings: StandingsAvailabilitySchema.nullable(),
  excludedMatchKeys: z.array(MatchKeySchema).max(64),
  facts: z.array(ContentFactSchema).max(MAX_FACTS),
  teamAliases: z.array(TeamAliasSchema).max(MAX_ALIASES),
});

export type ContentInput = z.infer<typeof ContentInputSchema>;

export const DraftElementSchema = z
  .strictObject({
    kind: ElementKindSchema,
    /** 0 for the caption, then 1, 2, ... for the slides in order. */
    position: z.int().min(0),
    slideType: SlideTypeSchema.nullable(),
    slideKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/),
    subject: ElementSubjectSchema,
    version: ElementVersionContentSchema,
  })
  .refine((element) => (element.kind === 'slide') === (element.slideType !== null), {
    message: 'a slide has a slide type and the caption has none',
  });

export type DraftElement = z.infer<typeof DraftElementSchema>;

export const DraftCarouselSchema = z.strictObject({
  sequence: z.int().min(1),
  total: z.int().min(1),
  elements: z.array(DraftElementSchema).min(3).max(101),
});

export type DraftCarousel = z.infer<typeof DraftCarouselSchema>;

export const ContentOutputSchema = z.strictObject({
  projectId: UuidSchema,
  factsRunId: UuidSchema,
  language: LanguageSchema,
  /** False when the selection has no standings slide (R-077, R-285). */
  standingsIncluded: z.boolean(),
  excludedMatchKeys: z.array(MatchKeySchema).max(64),
  leftOutMatches: z.array(LeftOutMatchSchema).max(1000),
  /** The AI adapter that drafted the text (`element_versions.ai_adapter`). */
  aiAdapter: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
  carousels: z.array(DraftCarouselSchema).min(1).max(100),
});

export type ContentOutput = z.infer<typeof ContentOutputSchema>;

/** Stored list columns (`element_versions.content_flags`, `element_fact_refs`, `content_drafts.left_out_matches`). */
export const ContentFlagListSchema = z.array(ContentFlagSchema).max(40);
export const ElementFactRefListSchema = z
  .array(ElementFactRefSchema)
  .max(2000)
  .refine((refs) => new Set(refs.map((ref) => ref.factId)).size === refs.length, {
    message: 'a fact is referenced once per version',
  });
export const LeftOutMatchListSchema = z.array(LeftOutMatchSchema).max(1000);
