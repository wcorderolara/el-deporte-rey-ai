import type { ImportSummary } from '@edr/contracts';
import { Link } from 'react-router';

import { ErrorBanner, formatDateTime } from '../../ui';
import { channelLabel, historyCopy, importDetailCopy, resultCopy, selectionName } from './copy';
import styles from './Imports.module.css';
import { importPath, versionPath } from './paths';
import type { ResourceState } from './useApiResource';

export interface ImportHistoryProps {
  state: ResourceState<ImportSummary[]>;
  onRetry: () => void;
  /** URL of the original of an import (getImportOriginal). */
  originalUrl: (importId: string) => string;
}

/**
 * Applied imports, newest first (R-067, R-277): receipt time, channel, file name (as text), declared source,
 * competition and season, the selection versions created, the SHA-256 of the original and a download link to the
 * original. The link uses the `download` attribute and the server names the file (T11H-F11); the page notes that
 * originals are opened as text (Q12, residual R10). Nothing can be deleted (OD-08).
 */
export function ImportHistory({ state, onRetry, originalUrl }: ImportHistoryProps) {
  return (
    <section className={styles.section} aria-labelledby="import-history-title">
      <h2 id="import-history-title">{historyCopy.heading}</h2>
      <p className={styles.notice}>{historyCopy.openAsText}</p>
      <p className={styles.hint}>{historyCopy.hashNote}</p>
      {state.status === 'idle' || state.status === 'loading' ? (
        <p role="status" aria-live="polite">
          {historyCopy.loading}
        </p>
      ) : state.status === 'error' ? (
        <ErrorBanner error={state.error} title={historyCopy.loadFailedTitle} onRetry={onRetry} />
      ) : state.data.length === 0 ? (
        <p>{historyCopy.empty}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>{historyCopy.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{historyCopy.receivedAt}</th>
                <th scope="col">{historyCopy.channel}</th>
                <th scope="col">{historyCopy.fileName}</th>
                <th scope="col">{historyCopy.declaredSource}</th>
                <th scope="col">{historyCopy.competition}</th>
                <th scope="col">{historyCopy.selections}</th>
                <th scope="col">{historyCopy.hash}</th>
                <th scope="col">{historyCopy.original}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((item) => {
                const receivedAt = formatDateTime(item.receivedAt);
                return (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link to={importPath(item.id)} aria-label={importDetailCopy.rowLink(receivedAt)}>
                        <time dateTime={item.receivedAt}>{receivedAt}</time>
                      </Link>
                    </th>
                    <td>{channelLabel[item.channel]}</td>
                    <td>
                      {item.fileName === null ? historyCopy.noFileName : <span translate="no">{item.fileName}</span>}
                    </td>
                    <td>{item.declaredSource ?? historyCopy.noDeclaredSource}</td>
                    <td>
                      {item.competitionName}, {item.seasonLabel}
                    </td>
                    <td>
                      <ul className={styles.selectionList}>
                        {item.selections.map((selection) => (
                          <li key={selection.versionId}>
                            <Link to={versionPath(selection.versionId)}>
                              {selectionName(selection.stageName, selection.matchday)}
                            </Link>
                            : {resultCopy.newVersion(selection.versionNumber)}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <code className={styles.code} translate="no">
                        {item.originalSha256}
                      </code>
                    </td>
                    <td>
                      <a href={originalUrl(item.id)} download="">
                        {historyCopy.download}{' '}
                        <span className={styles.visuallyHidden}>
                          {historyCopy.downloadContext(item.fileName ?? channelLabel[item.channel], receivedAt)}
                        </span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
