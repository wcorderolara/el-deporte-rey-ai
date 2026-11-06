/**
 * Contract schema Problem (`application/problem+json`): every error response of every operation, with the closed
 * list of problem codes and the refusal reasons. `detail` and messages are fixed text plus sanitized parameters only
 * (T10-F10).
 */
import { z } from 'zod';

import { FactRefSchema } from './facts.js';
import { ImportErrorSchema } from './imports.js';
import { UuidSchema } from './primitives.js';

/** Media type of every error response. */
export const PROBLEM_MEDIA_TYPE = 'application/problem+json';

export const PROBLEM_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'FORBIDDEN_ORIGIN',
  'MISDIRECTED_HOST',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'RUN_IN_PROGRESS',
  'NO_VERIFIED_RUN',
  'VERSION_CONFLICT',
  'APPROVAL_BLOCKED',
  'CONTENT_FLAGGED',
  'QA_FAILED',
  'QA_ACK_REQUIRED',
  'FINAL_APPROVAL_REFUSED',
  'FINAL_APPROVAL_REQUIRED',
  'EXPORT_FILES_MISSING',
  'EXPORT_FILES_CORRUPT',
  'DUPLICATE_ASSET',
  'DUPLICATE_SEASON',
  'DUPLICATE_TEAM',
  'DUPLICATE_PARTICIPANT',
  'DUPLICATE_COMPETITION_TEAM',
  'COMPETITION_TEAM_IN_USE',
  'TEAM_NOT_IN_COMPETITION',
  'DUPLICATE_STAGE',
  'DUPLICATE_ROUND',
  'DUPLICATE_MATCH',
  'ROUND_HAS_MATCHES',
  'TEAM_IN_USE',
  'PROVIDER_FAILED',
  'PROVIDER_BINDING_EXISTS',
  'PROVIDER_AMBIGUOUS',
  'PROVIDER_RATE_LIMITED',
  'SELECTION_UNAVAILABLE',
  'IMPORT_REJECTED',
  'MANUAL_APPROVAL_REFUSED',
  'INTERNAL',
  'PROVIDER_UNAVAILABLE',
  'IMPORT_PREVIEW_EXPIRED',
  'CONTENT_BATCH_NOT_GENERATABLE',
  'REQUEST_KEY_REUSED',
  'ASSET_IN_USE',
] as const;

export const ProblemCodeSchema = z.enum(PROBLEM_CODES);

/** Reason of a MANUAL_APPROVAL_REFUSED or SELECTION_UNAVAILABLE problem. */
export const RefusalReasonSchema = z.enum([
  'not_manual_data',
  'verified',
  'disputed',
  'team_identity_unmatched',
  'accepted_source_disagrees',
  'not_latest_run',
  'already_approved',
  'not_approved',
  'competition_unavailable',
  'season_unavailable',
  'stage_unavailable',
  'source_not_selectable',
]);

export const FinalApprovalRefusalReasonSchema = z.enum([
  'not_approved',
  'blocked',
  'flagged',
  'qa_failed',
  'qa_ack_required',
]);

export const ProblemSchema = z.strictObject({
  /** "about:blank" or "urn:edr:problem:<code>". */
  type: z.string().max(200),
  title: z.string().max(200),
  status: z.int(),
  code: ProblemCodeSchema,
  /** Fixed text plus sanitized parameters only (T10-F10). */
  detail: z.string().max(500).optional(),
  errors: z
    .array(z.strictObject({ path: z.string().max(200), message: z.string().max(200) }))
    .max(50)
    .optional(),
  /** Facts that block an approval (APPROVAL_BLOCKED), each named with its block reason. */
  facts: z.array(FactRefSchema).optional(),
  /** Elements that prevent a final approval (FINAL_APPROVAL_REFUSED). */
  items: z.array(z.strictObject({ elementId: UuidSchema, reason: FinalApprovalRefusalReasonSchema })).optional(),
  /** Every error of a rejected import, reported together (IMPORT_REJECTED, R-274). */
  importErrors: z.array(ImportErrorSchema).max(500).optional(),
  /** Seconds until the provider request budget allows a new request (PROVIDER_RATE_LIMITED, R-291). */
  retryAfterSeconds: z.int().min(0).nullable().optional(),
  refusalReason: RefusalReasonSchema.nullable().optional(),
});

export type ProblemCode = z.infer<typeof ProblemCodeSchema>;
export type RefusalReason = z.infer<typeof RefusalReasonSchema>;
export type FinalApprovalRefusalReason = z.infer<typeof FinalApprovalRefusalReasonSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
