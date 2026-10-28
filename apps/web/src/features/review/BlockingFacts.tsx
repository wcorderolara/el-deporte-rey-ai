import type { FactRef } from '@edr/contracts';

import { FactStatusBadge } from '../../ui';
import { blockingFactCopy, factKindLabel } from './copy';
import { blockReasonText } from './model';
import styles from './Review.module.css';

export interface BlockingFactsProps {
  facts: readonly FactRef[];
  /** Accessible name of the list. */
  label: string;
}

/**
 * Facts that make content not approvable (R-026, R-206, R-271, R-272): each named by its kind and display value,
 * with its current status (MANUALLY_APPROVED labelled operator-attested, never verified) and its block reason in
 * clear text (awaiting independent verification, manual approval not publishable under the current policy,
 * republishing permission not confirmed).
 */
export function BlockingFacts({ facts, label }: BlockingFactsProps) {
  if (facts.length === 0) {
    return null;
  }
  return (
    <ul className={styles.factList} aria-label={label}>
      {facts.map((fact) => (
        <li key={fact.factId} className={styles.fact}>
          <span className={styles.factName}>
            {factKindLabel[fact.kind]}: {fact.display ?? blockingFactCopy.noDisplay}
          </span>{' '}
          <FactStatusBadge status={fact.status} unverifiedReason={fact.unverifiedReason} />
          <span className={styles.factReason}>
            <span className={styles.visuallyHidden}>{blockingFactCopy.reason}: </span>
            {blockReasonText(fact)}
          </span>
        </li>
      ))}
    </ul>
  );
}
