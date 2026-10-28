import { Link, useParams } from 'react-router';

import { DataModeBadge, ErrorBanner, featureCopy } from '../../ui';
import { historyCopy, importDetailCopy, resultCopy } from './copy';
import { ImportDetails } from './ImportDetails';
import type { ImportsApi } from './importsApi';
import styles from './Imports.module.css';
import { importsPath, isUuid } from './paths';
import { useApiResource } from './useApiResource';

export interface ImportDetailPageProps {
  api: ImportsApi;
}

/**
 * One applied import (getImport; R-067, R-277, R-278) at `/imports/:importId`: its record, the original to download
 * (opened as text, T11H-F11, Q12), the selection versions it created and the link to create a project for the
 * competition (R-276). An address that is not a server identifier makes no request.
 */
export function ImportDetailPage({ api }: ImportDetailPageProps) {
  const importId = useParams().importId;
  const valid = isUuid(importId);
  const record = useApiResource(valid ? importId : null, (signal) => api.getImport(importId ?? '', signal));

  let content;
  if (!valid) {
    content = <p>{importDetailCopy.invalidAddress}</p>;
  } else if (record.state.status === 'ready') {
    const summary = record.state.data;
    content = (
      <section className={styles.section} aria-labelledby="import-detail-title">
        <h2 id="import-detail-title">{importDetailCopy.title(summary.competitionName, summary.seasonLabel)}</h2>
        <p>
          <DataModeBadge mode="MANUAL_DATA" /> {resultCopy.dataNotVerified}
        </p>
        <ImportDetails summary={summary} />
        <p>
          <a href={api.originalUrl(summary.id)} download="">
            {historyCopy.download}
          </a>
        </p>
        <p className={styles.notice}>{historyCopy.openAsText}</p>
      </section>
    );
  } else if (record.state.status === 'error') {
    content = (
      <ErrorBanner error={record.state.error} title={importDetailCopy.loadFailedTitle} onRetry={record.reload} />
    );
  } else {
    content = (
      <p role="status" aria-live="polite">
        {importDetailCopy.loading}
      </p>
    );
  }

  return (
    <section aria-labelledby="imports-title">
      <h1 id="imports-title">{featureCopy.imports}</h1>
      <p>
        <Link to={importsPath}>{importDetailCopy.back}</Link>
      </p>
      {content}
    </section>
  );
}
