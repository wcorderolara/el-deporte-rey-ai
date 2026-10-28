import type { QaResult, QaWarningCheck } from '@edr/contracts';

import { formatDateTime, StatusBadge } from '../../ui';
import { elementCopy, qaCheckLabel, qaCopy } from './copy';
import { isBlockingFailure, isWarningCheck, needsAcknowledgement } from './model';
import styles from './Review.module.css';

function listOrNone(values: readonly string[]): string {
  return values.length === 0 ? qaCopy.none : values.join(', ');
}

function QaDetails({ result }: { result: QaResult }) {
  switch (result.check) {
    case 'data_match':
    case 'team_names':
      return result.details.mismatches.length === 0 ? null : (
        <ul className={styles.detailList}>
          {result.details.mismatches.map((mismatch, index) => (
            <li key={index}>{qaCopy.mismatch(mismatch.expected, mismatch.actual)}</li>
          ))}
        </ul>
      );
    case 'text_fit':
      return result.details.overflowingElements.length === 0 ? null : (
        <p className={styles.detailText}>
          {qaCopy.overflowing}: {listOrNone(result.details.overflowingElements)}
        </p>
      );
    case 'style_consistency':
      return result.outcome === 'pass' ? null : (
        <ul className={styles.detailList}>
          <li>
            {qaCopy.colors}: {listOrNone(result.details.colorsOutsidePalette)}
          </li>
          <li>
            {qaCopy.fonts}: {listOrNone(result.details.fontsOutsideSet)}
          </li>
          <li>
            {qaCopy.templates}: {listOrNone(result.details.templateVersions)}
          </li>
        </ul>
      );
    case 'dimensions':
      return result.outcome === 'pass' ? null : (
        <p className={styles.detailText}>
          {qaCopy.dimensions(
            result.details.expectedWidth,
            result.details.expectedHeight,
            result.details.actualWidth,
            result.details.actualHeight,
          )}
        </p>
      );
    case 'capitalized_tokens':
      return result.details.tokens.length === 0 ? null : (
        <div className={styles.detailText}>
          <p>{qaCopy.tokens}:</p>
          <ul className={styles.tokenList}>
            {result.details.tokens.map((token, index) => (
              <li key={`${token}-${index}`}>{token}</li>
            ))}
          </ul>
          <p className={styles.hint}>{qaCopy.tokensHint}</p>
        </div>
      );
  }
}

export interface QaResultsProps {
  results: readonly QaResult[];
  /** Acknowledge one warning check (null while another action runs). */
  onAcknowledge: ((check: QaWarningCheck) => void) | null;
  /** Check whose acknowledgement is being sent. */
  acknowledging: QaWarningCheck | null;
}

/**
 * Visual-QA results of a version (AD-12, OD-09): every check with its outcome and severity as text and symbol, its
 * closed details (mismatches, overflowing texts, colours, fonts, dimensions, flagged capitalized tokens as text), and
 * an acknowledgement control for each failed warning not yet acknowledged (style_consistency, capitalized_tokens;
 * one check per request, OD-38). Blocking failures cannot be acknowledged.
 */
export function QaResults({ results, onAcknowledge, acknowledging }: QaResultsProps) {
  if (results.length === 0) {
    return <p className={styles.hint}>{elementCopy.qaNone}</p>;
  }
  return (
    <ul className={styles.qaList}>
      {results.map((result) => {
        const failed = result.outcome === 'fail';
        const label = qaCheckLabel[result.check];
        return (
          <li key={result.check} className={styles.qaItem}>
            <span className={styles.qaName}>{label}</span>{' '}
            <StatusBadge
              label={failed ? qaCopy.fail : qaCopy.pass}
              tone={failed ? 'caution' : 'positive'}
              symbol={failed ? '!' : '✓'}
              detail={result.severity === 'blocking' ? qaCopy.blocking : qaCopy.warning}
            />
            <QaDetails result={result} />
            {isBlockingFailure(result) ? <p className={styles.hint}>{qaCopy.blockingHint}</p> : null}
            {result.acknowledgedAt === null ? null : (
              <p className={styles.hint}>
                {qaCopy.acknowledgedAt}:{' '}
                <time dateTime={result.acknowledgedAt}>{formatDateTime(result.acknowledgedAt)}</time>
              </p>
            )}
            {needsAcknowledgement(result) && isWarningCheck(result.check) ? (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={onAcknowledge === null}
                onClick={() => {
                  if (onAcknowledge !== null && isWarningCheck(result.check)) {
                    onAcknowledge(result.check);
                  }
                }}
              >
                {acknowledging === result.check ? qaCopy.acknowledging : qaCopy.acknowledge(label)}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
