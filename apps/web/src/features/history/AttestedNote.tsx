import { attestedCopy } from './copy';
import styles from './History.module.css';

/** Operator-attested label of exported content that uses MANUALLY_APPROVED facts (OD-28). */
export function AttestedNote() {
  return (
    <div className={styles.attested} role="note" aria-label={attestedCopy.title} data-testid="attested-note">
      <p>
        <strong>
          <span aria-hidden="true">✎ </span>
          {attestedCopy.title}
        </strong>
      </p>
      <p>{attestedCopy.body}</p>
    </div>
  );
}
