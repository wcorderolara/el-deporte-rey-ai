import type { Dispute, Evidence } from '@edr/contracts';

import { formatDateTime } from '../../ui';
import { disputeCopy, disputeOutcomeLabel } from './copy';
import styles from './Facts.module.css';
import { formatFactValue, type TeamNames } from './format';
import { Heading, type HeadingLevel } from './Heading';

export interface DisputeRecordProps {
  dispute: Dispute;
  /** Evidence of the same fact, used to name the sources of the dispute. */
  evidence: readonly Evidence[];
  teams: TeamNames;
  headingId: string;
  headingLevel: HeadingLevel;
}

function sourceName(sourceId: string, evidence: readonly Evidence[]): string {
  const match = evidence.find((item) => item.sourceId === sourceId);
  return match === undefined ? sourceId : `${match.sourceName} (${sourceId})`;
}

/**
 * Dispute record of a fact (R-048, R-205, R-230, R-423): the value of each source, the consultation of the official
 * publication and the outcome. Nothing here resolves a dispute; only a new run can (R-412).
 */
export function DisputeRecord({ dispute, evidence, teams, headingId, headingLevel }: DisputeRecordProps) {
  return (
    <section className={styles.dispute} aria-labelledby={headingId}>
      <Heading level={headingLevel} id={headingId} className={styles.subheading}>
        {disputeCopy.title}
      </Heading>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption>{disputeCopy.valuesCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{disputeCopy.source}</th>
              <th scope="col">{disputeCopy.independenceGroup}</th>
              <th scope="col">{disputeCopy.value}</th>
            </tr>
          </thead>
          <tbody>
            {dispute.sourceValues.map((item, index) => (
              <tr key={`${item.sourceId}-${index}`}>
                <th scope="row">{sourceName(item.sourceId, evidence)}</th>
                <td>
                  <code translate="no">{item.independenceGroup}</code>
                </td>
                <td>{formatFactValue(item.value, teams)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>{disputeCopy.consultation}:</strong>{' '}
        {dispute.consultedSourceId === null ? (
          disputeCopy.notConsulted
        ) : (
          <>
            {sourceName(dispute.consultedSourceId, evidence)}
            {dispute.consultedAt === null ? null : (
              <>
                {' '}
                {disputeCopy.consultedAt}{' '}
                <time dateTime={dispute.consultedAt}>{formatDateTime(dispute.consultedAt)}</time>
              </>
            )}
          </>
        )}
      </p>
      <p>
        <strong>{disputeCopy.outcome}:</strong> {disputeOutcomeLabel[dispute.outcome]}
      </p>
      {dispute.resolvedValue === null ? null : (
        <p>
          <strong>{disputeCopy.resolvedValue}:</strong> {formatFactValue(dispute.resolvedValue, teams)}
        </p>
      )}
    </section>
  );
}
