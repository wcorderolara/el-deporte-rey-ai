/**
 * Closed value lists and shapes of the HTTP contract used by the API client and the shared UI.
 *
 * Every value list and shape is re-exported or derived from `@edr/contracts` (T20, the Zod mirror of
 * `contracts/http-api.openapi.yaml` 1.0.0; AD-04), so the web app keeps no copy of a contract enum (OD-36). The
 * names exported here are the ones the web app has used since T16; consumers keep importing them from this module.
 *
 * `Problem` is the one shape that is not the contract's: it is the normalized form produced by `parseProblem`
 * (`api/client.ts`), in which every optional member of the contract `Problem` is present (null or empty), so the UI
 * never branches on `undefined`. Its member types come from the contract.
 */
import {
  AvailabilityReasonSchema,
  DataModeSchema,
  FactStatusSchema,
  ImportErrorSchema,
  ImportProblemSchema,
  PROBLEM_CODES as CONTRACT_PROBLEM_CODES,
  RefusalReasonSchema,
  SegmentProvenanceSchema,
  StandingsAvailabilitySchema,
  UnverifiedReasonSchema,
  type AvailabilityReason,
  type DataMode,
  type FactStatus,
  type ImportError as ContractImportError,
  type Problem as ContractProblem,
  type ProblemCode,
  type RefusalReason,
  type SegmentProvenance,
  type StandingsAvailability,
  type UnverifiedReason as ContractUnverifiedReason,
} from '@edr/contracts';

export type {
  Availability,
  AvailabilityReason,
  DataMode,
  FactStatus,
  ListingMeta,
  ProblemCode,
  RefusalReason,
  SegmentProvenance,
  StandingsAvailability,
} from '@edr/contracts';

/** DataMode (PD-13). */
export const DATA_MODES: readonly DataMode[] = DataModeSchema.options;

/** FactStatus (OD-17, BR-12). */
export const FACT_STATUSES: readonly FactStatus[] = FactStatusSchema.options;

/** Reason of an unverified fact; the contract schema is nullable, the reason itself never is. */
export type UnverifiedReason = NonNullable<ContractUnverifiedReason>;
export const UNVERIFIED_REASONS: readonly UnverifiedReason[] = UnverifiedReasonSchema.unwrap().options;

/** Provenance of a text segment (OD-01, R-208). */
export const SEGMENT_PROVENANCES: readonly SegmentProvenance[] = SegmentProvenanceSchema.options;

/** Availability.reason (R-075, R-286). */
export const AVAILABILITY_REASONS: readonly AvailabilityReason[] = AvailabilityReasonSchema.options;

/** StandingsAvailability.reason (R-077, R-254, R-284). */
export type StandingsAvailabilityReason = NonNullable<StandingsAvailability['reason']>;
export const STANDINGS_AVAILABILITY_REASONS: readonly StandingsAvailabilityReason[] =
  StandingsAvailabilitySchema.shape.reason.unwrap().options;

/** Problem.code: the closed list of the contract. */
export const PROBLEM_CODES: readonly ProblemCode[] = CONTRACT_PROBLEM_CODES;

/** Problem.refusalReason (MANUAL_APPROVAL_REFUSED, SELECTION_UNAVAILABLE). */
export const REFUSAL_REASONS: readonly RefusalReason[] = RefusalReasonSchema.options;

/** One error of a rejected manual import (IMPORT_REJECTED, R-274). */
export type ImportError = ContractImportError;
export type ImportErrorLocation = ImportError['location'];
export type ImportErrorProblem = ImportError['problem'];
export const IMPORT_ERROR_LOCATIONS: readonly ImportErrorLocation[] = ImportErrorSchema.shape.location.options;
export const IMPORT_ERROR_PROBLEMS: readonly ImportErrorProblem[] = ImportProblemSchema.options;

/** One request validation error (VALIDATION_FAILED). */
export type ValidationIssue = NonNullable<ContractProblem['errors']>[number];

/**
 * Parsed `application/problem+json` body (see the module comment). `facts` and `items` (approval refusals) are kept
 * as received for the review features, which validate them with the contract schemas.
 */
export interface Problem {
  type: ContractProblem['type'];
  title: ContractProblem['title'];
  status: ContractProblem['status'];
  code: ProblemCode;
  detail: string | null;
  errors: ValidationIssue[];
  importErrors: ImportError[];
  retryAfterSeconds: number | null;
  refusalReason: RefusalReason | null;
  facts: unknown[];
  items: unknown[];
}
