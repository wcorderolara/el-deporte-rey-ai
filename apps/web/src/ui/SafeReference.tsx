import { referenceCopy } from './copy';
import { classNames } from './format';
import styles from './Notice.module.css';

/** Control and format characters (including bidirectional overrides) are shown as U+FFFD, never interpreted. */
const UNSAFE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

export interface SafeReferenceProps {
  /** Source or attribution reference as received from the API (`source:`, `fixture:`, `import:` or anything else). */
  value: string | null | undefined;
  className?: string;
}

/**
 * Renders a source reference as plain text only, never as a link, whatever its content (T10-F16, T11H-F14, AD-36):
 * references are provider-neutral and the browser never links to a provider host. Every reference in the UI is
 * rendered with this component.
 */
export function SafeReference({ value, className }: SafeReferenceProps) {
  if (value === null || value === undefined || value === '') {
    return <span className={className}>{referenceCopy.empty}</span>;
  }
  return (
    <code className={classNames(styles.reference, className)} dir="ltr" translate="no">
      {value.replace(UNSAFE_CHARACTERS, '�')}
    </code>
  );
}
