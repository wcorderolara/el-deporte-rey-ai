import type { ElementVersion } from '@edr/contracts';

import { ProvenanceLabel } from '../../ui';
import { elementCopy, textFieldLabel } from './copy';
import styles from './Review.module.css';

export interface TextFieldsProps {
  version: ElementVersion;
}

/**
 * Text of an element version, field by field, with the provenance of every segment (OD-01, R-208): a fact segment
 * shows its fact's current status (verified; UNVERIFIED with its reason when the version names it; MANUALLY_APPROVED
 * as operator-attested), so an unverified or manually approved value is never labelled verified (R-071). Commentary
 * and template text are labelled as such. All text is rendered as text nodes.
 */
export function TextFields({ version }: TextFieldsProps) {
  if (version.fields.length === 0) {
    return <p className={styles.hint}>{elementCopy.noText}</p>;
  }
  const reasons = new Map(version.blockingFacts.map((fact) => [fact.factId, fact.unverifiedReason]));
  return (
    <dl className={styles.fields}>
      {version.fields.map((field, fieldIndex) => (
        <div key={`${field.field}-${fieldIndex}`} className={styles.field}>
          <dt>{textFieldLabel[field.field]}</dt>
          <dd>
            {field.segments.length === 0 ? (
              <span className={styles.hint}>{elementCopy.noText}</span>
            ) : (
              <ul className={styles.segments}>
                {field.segments.map((segment, index) => (
                  <li key={index} className={styles.segment} data-provenance={segment.provenance}>
                    <span className={styles.segmentText}>{segment.text}</span>{' '}
                    <ProvenanceLabel
                      provenance={segment.provenance}
                      factStatus={segment.factStatus}
                      unverifiedReason={segment.factId === null ? null : (reasons.get(segment.factId) ?? null)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
