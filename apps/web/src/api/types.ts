/**
 * Closed value lists and shapes of the HTTP contract used by the API client and the shared UI.
 *
 * Source: `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml` (`1.0.0-proposed.2`), schemas
 * `DataMode`, `FactStatus`, `UnverifiedReason`, `Availability`, `StandingsAvailability`, `ListingMeta`,
 * `TextField.segments[].provenance`, `ImportError` and `Problem`.
 *
 * Temporary mirror: `packages/contracts` (T20) does not export these schemas yet. Once it does, this module should
 * re-export the contract types instead of declaring them, so that the web app never keeps its own copy. Every
 * consumer imports them from here, which keeps that change to this one file.
 */

export const DATA_MODES = ['LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA'] as const;
export type DataMode = (typeof DATA_MODES)[number];

export const FACT_STATUSES = ['verified', 'unverified', 'manually_approved'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const UNVERIFIED_REASONS = [
  'awaiting_independent_verification',
  'disputed',
  'no_accepted_source',
  'team_identity_unmatched',
] as const;
export type UnverifiedReason = (typeof UNVERIFIED_REASONS)[number];

export const SEGMENT_PROVENANCES = ['fact', 'commentary', 'template_text'] as const;
export type SegmentProvenance = (typeof SEGMENT_PROVENANCES)[number];

export const AVAILABILITY_REASONS = [
  'subscription_restricted',
  'not_found',
  'access_refused',
  'not_provided',
  'source_unavailable',
  'rate_limited',
] as const;
export type AvailabilityReason = (typeof AVAILABILITY_REASONS)[number];

/** Whether a source offers a competition, season or stage, and why not (R-075, R-286). */
export interface Availability {
  available: boolean;
  reason: AvailabilityReason | null;
}

export const STANDINGS_AVAILABILITY_REASONS = [
  'not_provided_for_stage',
  'not_provided_by_source',
  'not_available_with_subscription',
] as const;
export type StandingsAvailabilityReason = (typeof STANDINGS_AVAILABILITY_REASONS)[number];

/** Whether the selection has standings (R-077, R-254, R-284); never derived when missing. */
export interface StandingsAvailability {
  available: boolean;
  reason: StandingsAvailabilityReason | null;
}

/** Provenance of a catalogue listing (R-141, R-291). */
export interface ListingMeta {
  retrievedAt: string | null;
  fromCache: boolean;
  stale: boolean;
  retryAfterSeconds: number | null;
}

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
  'DUPLICATE_ASSET',
  'PROVIDER_FAILED',
  'PROVIDER_RATE_LIMITED',
  'SELECTION_UNAVAILABLE',
  'IMPORT_REJECTED',
  'MANUAL_APPROVAL_REFUSED',
  'INTERNAL',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export const REFUSAL_REASONS = [
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
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export const IMPORT_ERROR_LOCATIONS = ['file', 'form'] as const;
export type ImportErrorLocation = (typeof IMPORT_ERROR_LOCATIONS)[number];

export const IMPORT_ERROR_PROBLEMS = [
  'parse_error',
  'encoding_invalid',
  'too_large',
  'too_many_rows',
  'header_invalid',
  'column_unknown',
  'person_field',
  'required_missing',
  'type_invalid',
  'value_out_of_range',
  'value_inconsistent',
  'duplicate_match',
  'unknown_team',
  'metadata_missing',
  'metadata_conflict',
  'finished_without_score',
  'score_not_allowed',
] as const;
export type ImportErrorProblem = (typeof IMPORT_ERROR_PROBLEMS)[number];

/** One error of a rejected manual import (IMPORT_REJECTED, R-274). */
export interface ImportError {
  location: ImportErrorLocation;
  record: string;
  field: string | null;
  problem: ImportErrorProblem;
  message: string;
}

/** One request validation error (VALIDATION_FAILED). */
export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Parsed `application/problem+json` body. The client keeps the members the web app uses; `facts` and `items`
 * (approval refusals) are kept as received for the review features, which validate them with the contract schemas.
 */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  detail: string | null;
  errors: ValidationIssue[];
  importErrors: ImportError[];
  retryAfterSeconds: number | null;
  refusalReason: RefusalReason | null;
  facts: unknown[];
  items: unknown[];
}
