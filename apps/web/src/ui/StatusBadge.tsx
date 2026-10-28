import { classNames } from './format';
import styles from './StatusBadge.module.css';

export type BadgeTone = 'neutral' | 'info' | 'positive' | 'caution' | 'attested' | 'demo';

export interface StatusBadgeProps {
  /** Visible label; the badge never conveys its meaning by colour alone. */
  label: string;
  tone?: BadgeTone;
  /** Optional qualifier shown after the label (for example the reason of an unverified fact). */
  detail?: string | null;
  /** Optional decorative symbol, hidden from assistive technology. */
  symbol?: string;
}

/** Inline status label with a text label, an optional qualifier and a tone. */
export function StatusBadge({ label, tone = 'neutral', detail = null, symbol }: StatusBadgeProps) {
  return (
    <span className={classNames(styles.badge, styles[tone])} data-tone={tone}>
      {symbol === undefined ? null : (
        <span className={styles.symbol} aria-hidden="true">
          {symbol}
        </span>
      )}
      <span>{label}</span>
      {detail === null || detail === '' ? null : <span className={styles.detail}>({detail})</span>}
    </span>
  );
}
