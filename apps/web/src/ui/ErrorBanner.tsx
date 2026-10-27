import { errorCopy, importProblemLabel } from './copy';
import { describeError } from './errorMessage';
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
 * refusal reason, the wait before a retry, validation issues and every import error (R-274). Server-provided text
 * other than the sanitized import-error and validation messages is not shown.
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
      {description.importErrors.length === 0 ? null : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>{errorCopy.importErrorsTitle(description.importErrors.length)}</caption>
            <thead>
              <tr>
                <th scope="col">{errorCopy.importErrorRecord}</th>
                <th scope="col">{errorCopy.importErrorField}</th>
                <th scope="col">{errorCopy.importErrorProblem}</th>
                <th scope="col">{errorCopy.importErrorMessage}</th>
              </tr>
            </thead>
            <tbody>
              {description.importErrors.map((importError, index) => (
                <tr key={`${importError.record}-${importError.field ?? ''}-${index}`}>
                  <td>
                    {errorCopy.importErrorLocation[importError.location]} {importError.record}
                  </td>
                  <td>{importError.field ?? '—'}</td>
                  <td>{importProblemLabel[importError.problem]}</td>
                  <td>{importError.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {description.retryable && onRetry !== undefined ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {errorCopy.retry}
        </button>
      ) : null}
    </div>
  );
}
