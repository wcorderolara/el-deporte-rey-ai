import type { Availability, StandingsAvailability } from '../api/types';
import { availabilityCopy, availabilityReasonLabel, standingsReasonLabel } from './copy';
import styles from './Notice.module.css';

export type AvailabilityNoteProps =
  { availability: Availability; standings?: never } | { standings: StandingsAvailability; availability?: never };

/**
 * Why a competition, season, stage or source is not available (subscription restriction, not found, ...; R-075,
 * R-286), or why a selection has no standings (R-077, R-254, R-284). Renders nothing when available.
 */
export function AvailabilityNote(props: AvailabilityNoteProps) {
  let title: string;
  let reason: string;
  if (props.standings !== undefined) {
    if (props.standings.available) {
      return null;
    }
    title = availabilityCopy.standingsUnavailable;
    reason =
      props.standings.reason === null ? availabilityCopy.unknownReason : standingsReasonLabel[props.standings.reason];
  } else {
    if (props.availability.available) {
      return null;
    }
    title = availabilityCopy.unavailable;
    reason =
      props.availability.reason === null
        ? availabilityCopy.unknownReason
        : availabilityReasonLabel[props.availability.reason];
  }
  return (
    <p className={styles.note}>
      <span className={styles.label}>{title}:</span> {reason}
    </p>
  );
}
