import type { LeftOutMatch } from '@edr/contracts';

import { leftOutCopy, leftOutReasonLabel, matchStatusLabel } from './copy';
import styles from './Facts.module.css';

export interface LeftOutMatchesProps {
  matches: readonly LeftOutMatch[];
}

/**
 * Matches left out of the content, each with its status (including postponed, suspended, cancelled, abandoned and
 * awarded) and the reason (OD-05, R-255, R-409).
 */
export function LeftOutMatches({ matches }: LeftOutMatchesProps) {
  if (matches.length === 0) {
    return <p>{leftOutCopy.none}</p>;
  }
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <caption>{leftOutCopy.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{leftOutCopy.match}</th>
            <th scope="col">{leftOutCopy.status}</th>
            <th scope="col">{leftOutCopy.reason}</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.matchKey} data-testid="left-out-match">
              <th scope="row">{match.label}</th>
              <td>{match.status === null ? leftOutCopy.statusUnknown : matchStatusLabel[match.status]}</td>
              <td>{leftOutReasonLabel[match.reason]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
