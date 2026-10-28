/**
 * The Verification status concept (`data-model.md` section 0, OD-17): `verified`, `unverified` with a reason, or
 * `manually_approved` (operator-attested MANUAL_DATA fact; never verification, R-071).
 */
import { z } from 'zod';

export const UNVERIFIED_REASONS = [
  'awaiting_independent_verification',
  'disputed',
  'no_accepted_source',
  'team_identity_unmatched',
] as const;

/** A status with its reason; the reason is set exactly when the status is unverified. */
export const VerificationStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('verified'), unverifiedReason: z.null() }),
  z.object({ status: z.literal('unverified'), unverifiedReason: z.enum(UNVERIFIED_REASONS) }),
  z.object({ status: z.literal('manually_approved'), unverifiedReason: z.null() }),
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type DomainUnverifiedReason = (typeof UNVERIFIED_REASONS)[number];
