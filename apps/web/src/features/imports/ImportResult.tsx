import type { ImportChannel, ImportSummary } from '@edr/contracts';
import type { Ref } from 'react';

import { ApiError } from '../../api/client';
import { DataModeBadge, ErrorBanner } from '../../ui';
import { resultCopy } from './copy';
import { ImportDetails } from './ImportDetails';
import styles from './Imports.module.css';

/** Errors reported by the server at most (contract `ImportError` list, R-274). */
const SERVER_ERROR_CAP = 500;

export interface ImportOrigin {
  channel: ImportChannel;
  /** NFC file name as sent; null for the form. */
  fileName: string | null;
}

export type ImportOutcome =
  { status: 'applied'; summary: ImportSummary } | { status: 'failed'; error: unknown; origin: ImportOrigin };

export interface ImportResultProps {
  outcome: ImportOutcome;
  /** Offered for a retryable failure (network, server error); never for a rejected import. */
  onRetry?: () => void;
  /** The result heading, focused when a new result is shown. */
  headingRef?: Ref<HTMLHeadingElement>;
}

function isRejection(error: unknown): boolean {
  return error instanceof ApiError && error.problem?.code === 'IMPORT_REJECTED';
}

/**
 * Result of the last import: the applied import with its new selection versions and the link to create a project
 * for the competition (R-276, R-278), or the rejection view listing every error by file or form, record, field and
 * problem, as the server gives them (R-274, T11H-F12; the shared `ErrorBanner` table).
 */
export function ImportResult({ outcome, onRetry, headingRef }: ImportResultProps) {
  if (outcome.status === 'applied') {
    return <AppliedImport summary={outcome.summary} headingRef={headingRef} />;
  }

  const { error, origin } = outcome;
  if (isRejection(error)) {
    const errorCount = error instanceof ApiError ? (error.problem?.importErrors.length ?? 0) : 0;
    return (
      <section className={styles.section} aria-labelledby="import-result-title">
        <h2 id="import-result-title" ref={headingRef} tabIndex={-1}>
          {resultCopy.rejectedTitle}
        </h2>
        <p>{origin.fileName === null ? resultCopy.rejectedForm : resultCopy.rejectedFile(origin.fileName)}</p>
        {errorCount >= SERVER_ERROR_CAP ? <p className={styles.notice}>{resultCopy.errorCap}</p> : null}
        <ErrorBanner error={error} title={resultCopy.rejectedTitle} />
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="import-result-title">
      <h2 id="import-result-title" ref={headingRef} tabIndex={-1}>
        {resultCopy.failedTitle}
      </h2>
      <ErrorBanner error={error} title={resultCopy.failedTitle} {...(onRetry === undefined ? {} : { onRetry })} />
    </section>
  );
}

function AppliedImport({ summary, headingRef }: { summary: ImportSummary; headingRef?: Ref<HTMLHeadingElement> }) {
  return (
    <section className={`${styles.section} ${styles.success}`} aria-labelledby="import-result-title">
      <h2 id="import-result-title" className={styles.resultTitle} ref={headingRef} tabIndex={-1}>
        <span aria-hidden="true">✓ </span>
        {resultCopy.appliedTitle}
      </h2>
      <p>{resultCopy.applied(summary.competitionName, summary.seasonLabel)}</p>
      <p>
        <DataModeBadge mode="MANUAL_DATA" /> {resultCopy.dataNotVerified}
      </p>
      <ImportDetails summary={summary} />
    </section>
  );
}
