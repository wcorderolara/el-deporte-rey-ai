/**
 * Contract schemas of facts (operations listFacts, approveFactManually, revokeManualFactApproval, traceExportedSlide):
 * statuses and reasons, fact references, per-kind closed values (T10-F17), evidence, disputes, manual approvals,
 * standings availability and left-out matches.
 */
import { z } from 'zod';

import {
  DataModeSchema,
  DateTimeSchema,
  MatchKeySchema,
  MatchStatusSchema,
  SlugSchema,
  SourceIdSchema,
  StageNameSchema,
  TeamNameSchema,
  UuidSchema,
} from './primitives.js';
import { SourceRoleSchema } from './system.js';

/** verified (BR-01), unverified with a reason, or manually_approved (never verification; OD-17, R-071). */
export const FactStatusSchema = z.enum(['verified', 'unverified', 'manually_approved']);

/** Reason of an unverified fact (OD-17); null unless the status is unverified. */
export const UnverifiedReasonSchema = z
  .enum(['awaiting_independent_verification', 'disputed', 'no_accepted_source', 'team_identity_unmatched'])
  .nullable();

/** Why a fact makes content not approvable for publication. */
export const BlockReasonSchema = z.enum([
  'not_verified',
  'manually_approved_not_publishable',
  'publication_permission_unconfirmed',
]);

export const FACT_KINDS = [
  'match_teams',
  'match_kickoff',
  'match_status',
  'match_score',
  'standing_row',
  'matchday_info',
  'context_item',
  'team_official_name',
] as const;

export const FactKindSchema = z.enum(FACT_KINDS);

/** Shape of the open base object FactRefFields (closed by the schemas that use it). */
const factRefShape = {
  factId: UuidSchema,
  factKey: z.string().max(200),
  kind: FactKindSchema,
  status: FactStatusSchema,
  unverifiedReason: UnverifiedReasonSchema,
  /** Built from fixed text and sanitized parameters. */
  reason: z.string().max(300).nullable(),
  /** Deterministic display form of the verified value, or of the candidate value when one exists. */
  display: z.string().nullable(),
  blockReason: BlockReasonSchema.optional(),
};

/** Open base object of FactRef and Fact. */
export const FactRefFieldsSchema = z.looseObject(factRefShape);

export const FactRefSchema = z.strictObject(factRefShape);

export const FactSubjectSchema = z.strictObject({
  matchKey: MatchKeySchema.optional(),
  teamId: SlugSchema.optional(),
  contextIndex: z.int().min(0).optional(),
});

export const MatchTeamsValueSchema = z.strictObject({ homeTeamId: SlugSchema, awayTeamId: SlugSchema });

export const MatchKickoffValueSchema = z.strictObject({ kickoff: DateTimeSchema });

export const MatchStatusValueSchema = z.strictObject({ matchStatus: MatchStatusSchema });

export const MatchScoreValueSchema = z.strictObject({ home: z.int().min(0), away: z.int().min(0) });

export const StandingRowValueSchema = z.strictObject({
  position: z.int().min(1),
  teamId: SlugSchema,
  played: z.int().min(0),
  won: z.int().min(0),
  drawn: z.int().min(0),
  lost: z.int().min(0),
  goalsFor: z.int().min(0),
  goalsAgainst: z.int().min(0),
  goalDifference: z.int(),
  points: z.int(),
});

export const MatchdayInfoValueSchema = z.strictObject({
  stageLabel: StageNameSchema,
  matchdayNumber: z.int().min(1).nullable(),
  totalMatchdays: z.int().min(1).nullable(),
});

export const ContextItemValueSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('matchday_of_total'), matchday: z.int().min(1), totalMatchdays: z.int().min(1) }),
  z.strictObject({ type: z.literal('teams_in_table'), count: z.int().min(1) }),
  z.strictObject({ type: z.literal('matches_in_selection'), count: z.int().min(0) }),
]);

export const TeamOfficialNameValueSchema = z.strictObject({ teamId: SlugSchema, officialName: TeamNameSchema });

/** Any closed fact value (used where the kind is given by the enclosing fact). */
export const FactValueSchema = z.union([
  MatchTeamsValueSchema,
  MatchKickoffValueSchema,
  MatchStatusValueSchema,
  MatchScoreValueSchema,
  StandingRowValueSchema,
  MatchdayInfoValueSchema,
  ContextItemValueSchema,
  TeamOfficialNameValueSchema,
]);

/** Value schema of each fact kind. */
export const FactValueSchemasByKind = {
  match_teams: MatchTeamsValueSchema,
  match_kickoff: MatchKickoffValueSchema,
  match_status: MatchStatusValueSchema,
  match_score: MatchScoreValueSchema,
  standing_row: StandingRowValueSchema,
  matchday_info: MatchdayInfoValueSchema,
  context_item: ContextItemValueSchema,
  team_official_name: TeamOfficialNameValueSchema,
} as const;

function kindValueShape<K extends FactKind, V extends z.ZodType>(kind: K, value: V) {
  return { kind: z.literal(kind), value: value.nullable(), candidateValue: value.nullable() };
}

/**
 * The value schemas selected by the fact kind (open base). value is set only when the fact is verified;
 * candidateValue is the single consistent value of an unverified or manually approved fact, null otherwise.
 */
export const FactKindValueSchema = z.discriminatedUnion('kind', [
  z.looseObject(kindValueShape('match_teams', MatchTeamsValueSchema)),
  z.looseObject(kindValueShape('match_kickoff', MatchKickoffValueSchema)),
  z.looseObject(kindValueShape('match_status', MatchStatusValueSchema)),
  z.looseObject(kindValueShape('match_score', MatchScoreValueSchema)),
  z.looseObject(kindValueShape('standing_row', StandingRowValueSchema)),
  z.looseObject(kindValueShape('matchday_info', MatchdayInfoValueSchema)),
  z.looseObject(kindValueShape('context_item', ContextItemValueSchema)),
  z.looseObject(kindValueShape('team_official_name', TeamOfficialNameValueSchema)),
]);

/** Audit view of the manual approval of a MANUAL_DATA fact (R-071, R-272). */
export const ManualApprovalSchema = z.strictObject({
  approvedAt: DateTimeSchema,
  /** Set when an unchanged fact keeps the approval of the same fact of the previous run (R-068). */
  carriedOverFromFactId: UuidSchema.nullable(),
});

export const EvidenceRelationSchema = z.enum(['supports', 'disagrees', 'consulted']);

export const EvidenceSchema = z.strictObject({
  sourceId: SourceIdSchema,
  sourceName: z.string().max(80),
  dataMode: DataModeSchema,
  role: SourceRoleSchema,
  accepted: z.boolean(),
  officialPublication: z.boolean(),
  relation: EvidenceRelationSchema,
  value: FactValueSchema,
  /** Provider-neutral attribution reference; never a URL; shown as text only (T10-F16, T11H-F14). */
  sourceRef: z.string().max(512),
  retrievedAt: DateTimeSchema,
  /** MANUAL_DATA version the value comes from (R-067, R-277); null for other modes. */
  importVersionId: UuidSchema.nullable(),
});

export const DisputeOutcomeSchema = z.enum(['resolved', 'unavailable', 'same_source', 'no_match']);

export const DisputeSchema = z.strictObject({
  sourceValues: z.array(
    z.strictObject({ sourceId: SourceIdSchema, independenceGroup: z.string().max(64), value: FactValueSchema }),
  ),
  consultedSourceId: SourceIdSchema.nullable(),
  consultedAt: DateTimeSchema.nullable(),
  outcome: DisputeOutcomeSchema,
  resolvedValue: FactValueSchema.nullable(),
});

const factExtraShape = {
  subject: FactSubjectSchema,
  evidence: z.array(EvidenceSchema),
  dispute: DisputeSchema.nullable(),
  manualApproval: ManualApprovalSchema.nullable(),
};

function factVariant<K extends FactKind, V extends z.ZodType>(kind: K, value: V) {
  return z.strictObject({ ...factRefShape, ...kindValueShape(kind, value), ...factExtraShape });
}

/** A fact with its closed per-kind value (FactRefFields + FactKindValue + subject, evidence, dispute, approval). */
export const FactSchema = z.discriminatedUnion('kind', [
  factVariant('match_teams', MatchTeamsValueSchema),
  factVariant('match_kickoff', MatchKickoffValueSchema),
  factVariant('match_status', MatchStatusValueSchema),
  factVariant('match_score', MatchScoreValueSchema),
  factVariant('standing_row', StandingRowValueSchema),
  factVariant('matchday_info', MatchdayInfoValueSchema),
  factVariant('context_item', ContextItemValueSchema),
  factVariant('team_official_name', TeamOfficialNameValueSchema),
]);

/** Whether the selection has standings (R-077, R-254, R-284); never derived when missing. */
export const StandingsAvailabilitySchema = z.strictObject({
  available: z.boolean(),
  reason: z.enum(['not_provided_for_stage', 'not_provided_by_source', 'not_available_with_subscription']).nullable(),
});

export const LeftOutMatchSchema = z.strictObject({
  matchKey: MatchKeySchema,
  label: z.string().max(200),
  status: MatchStatusSchema.nullable(),
  reason: z.enum(['not_finished', 'not_verified', 'excluded_by_operator']),
});

export type FactStatus = z.infer<typeof FactStatusSchema>;
export type UnverifiedReason = z.infer<typeof UnverifiedReasonSchema>;
export type BlockReason = z.infer<typeof BlockReasonSchema>;
export type FactKind = (typeof FACT_KINDS)[number];
export type FactRefFields = z.infer<typeof FactRefFieldsSchema>;
export type FactRef = z.infer<typeof FactRefSchema>;
export type FactSubject = z.infer<typeof FactSubjectSchema>;
export type MatchTeamsValue = z.infer<typeof MatchTeamsValueSchema>;
export type MatchKickoffValue = z.infer<typeof MatchKickoffValueSchema>;
export type MatchStatusValue = z.infer<typeof MatchStatusValueSchema>;
export type MatchScoreValue = z.infer<typeof MatchScoreValueSchema>;
export type StandingRowValue = z.infer<typeof StandingRowValueSchema>;
export type MatchdayInfoValue = z.infer<typeof MatchdayInfoValueSchema>;
export type ContextItemValue = z.infer<typeof ContextItemValueSchema>;
export type TeamOfficialNameValue = z.infer<typeof TeamOfficialNameValueSchema>;
export type FactValue = z.infer<typeof FactValueSchema>;
export type FactKindValue = z.infer<typeof FactKindValueSchema>;
export type ManualApproval = z.infer<typeof ManualApprovalSchema>;
export type EvidenceRelation = z.infer<typeof EvidenceRelationSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type DisputeOutcome = z.infer<typeof DisputeOutcomeSchema>;
export type Dispute = z.infer<typeof DisputeSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type StandingsAvailability = z.infer<typeof StandingsAvailabilitySchema>;
export type LeftOutMatch = z.infer<typeof LeftOutMatchSchema>;
