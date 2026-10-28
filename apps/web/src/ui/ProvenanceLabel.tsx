import type { FactStatus, SegmentProvenance, UnverifiedReason } from '../api/types';
import { factStatusLabel, operatorAttestedLabel, provenanceLabel, unverifiedReasonLabel } from './copy';
import { StatusBadge } from './StatusBadge';

export interface ProvenanceLabelProps {
  provenance: SegmentProvenance;
  /** Current status of the segment's fact; a fact segment without a status is shown as unverified. */
  factStatus?: FactStatus | null;
  unverifiedReason?: UnverifiedReason | null;
}

/**
 * Provenance of a text segment (OD-01, R-208): a fact with its current status, commentary or template text. An
 * unverified or manually approved value is never labelled verified.
 */
export function ProvenanceLabel({ provenance, factStatus = null, unverifiedReason = null }: ProvenanceLabelProps) {
  if (provenance !== 'fact') {
    return <StatusBadge label={provenanceLabel[provenance]} tone="neutral" />;
  }
  const status: FactStatus = factStatus ?? 'unverified';
  const label = `${provenanceLabel.fact}: ${factStatusLabel[status].toLowerCase()}`;
  switch (status) {
    case 'verified':
      return <StatusBadge label={label} tone="positive" symbol="✓" />;
    case 'manually_approved':
      return <StatusBadge label={label} tone="attested" symbol="✎" detail={operatorAttestedLabel} />;
    case 'unverified':
      return (
        <StatusBadge
          label={label}
          tone="caution"
          symbol="!"
          detail={unverifiedReason === null ? null : unverifiedReasonLabel[unverifiedReason]}
        />
      );
  }
}
