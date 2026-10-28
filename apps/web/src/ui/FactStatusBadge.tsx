import type { FactStatus, UnverifiedReason } from '../api/types';
import { factStatusLabel, operatorAttestedLabel, unverifiedReasonLabel } from './copy';
import { StatusBadge } from './StatusBadge';

export interface FactStatusBadgeProps {
  status: FactStatus;
  /** Reason of an unverified fact; ignored for the other statuses. */
  unverifiedReason?: UnverifiedReason | null;
}

/**
 * Status of a fact (OD-17, BR-12): VERIFIED; UNVERIFIED with its reason; MANUALLY_APPROVED labelled
 * operator-attested and never styled or worded as verified (PD-17, R-320).
 */
export function FactStatusBadge({ status, unverifiedReason = null }: FactStatusBadgeProps) {
  switch (status) {
    case 'verified':
      return <StatusBadge label={factStatusLabel.verified} tone="positive" symbol="✓" />;
    case 'manually_approved':
      return (
        <StatusBadge
          label={factStatusLabel.manually_approved}
          tone="attested"
          symbol="✎"
          detail={operatorAttestedLabel}
        />
      );
    case 'unverified':
      return (
        <StatusBadge
          label={factStatusLabel.unverified}
          tone="caution"
          symbol="!"
          detail={unverifiedReason === null ? null : unverifiedReasonLabel[unverifiedReason]}
        />
      );
  }
}
