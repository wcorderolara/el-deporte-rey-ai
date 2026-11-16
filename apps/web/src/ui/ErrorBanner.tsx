import { errorCopy } from './copy';
import { describeError } from './errorMessage';
import { Button } from './primitives/Button';
import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  /** The thrown value (normally an `ApiError` from the API client). */
  error: unknown;
  /** Offered only when the failure is retryable. */
  onRetry?: () => void;
  title?: string;
}

/**
 * Announces a failed request (role `alert`) with a Spanish message from the copy tables: the problem code, the
 * refusal reason, the wait before a retry and validation issues. Server-provided text other than the sanitized
 * validation messages is not shown. The errors of a rejected import (IMPORT_REJECTED, R-274) are listed by the import
 * page's own table, which labels each record by its kind and renders its detail from the closed codes (OD-63,
 * `ImportErrorTable`); this banner shows only the rejection message for them, never the server's `message` (OD-64).
 */
export function ErrorBanner({ error, onRetry, title = errorCopy.title }: ErrorBannerProps) {
  const description = describeError(error);
  return (
    <div className={styles.banner} role="alert">
      <p className={styles.title}>
        <span aria-hidden="true">✕ </span>
        {title}
      </p>
      <p>{description.message}</p>
      {description.reason === null ? null : <p>{description.reason}</p>}
      {description.hint === null ? null : <p>{description.hint}</p>}
      {description.retryAfterSeconds === null ? null : <p>{errorCopy.retryAfter(description.retryAfterSeconds)}</p>}
      {description.validationIssues.length === 0 ? null : (
        <>
          <p>{errorCopy.validationTitle}</p>
          <ul className={styles.list}>
            {description.validationIssues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </>
      )}
      {description.retryable && onRetry !== undefined ? (
        <Button type="button" variant="secondary" className="mt-2" onClick={onRetry}>
          {errorCopy.retry}
        </Button>
      ) : null}
    </div>
  );
}
