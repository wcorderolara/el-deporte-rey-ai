import type { ImportSummary } from '@edr/contracts';
import { Link } from 'react-router';

import { formatDateTime } from '../../ui';
import { channelLabel, historyCopy, resultCopy, selectionName } from './copy';
import styles from './Imports.module.css';
import { newProjectPath, versionPath } from './paths';

export interface ImportDetailsProps {
  summary: ImportSummary;
}

/**
 * Record of an applied import (R-067, R-277): channel, file name (as text), declared source, receipt time and the
 * SHA-256 of the original; the selection versions it created, each linked to its content (R-278); and the link to
 * create a project for the imported competition (R-276).
 */
export function ImportDetails({ summary }: ImportDetailsProps) {
  return (
    <>
      <dl className={styles.details}>
        <dt>{historyCopy.channel}</dt>
        <dd>{channelLabel[summary.channel]}</dd>
        <dt>{historyCopy.fileName}</dt>
        <dd>{summary.fileName === null ? historyCopy.noFileName : <span translate="no">{summary.fileName}</span>}</dd>
        <dt>{historyCopy.declaredSource}</dt>
        <dd>{summary.declaredSource ?? historyCopy.noDeclaredSource}</dd>
        <dt>{historyCopy.receivedAt}</dt>
        <dd>
          <time dateTime={summary.receivedAt}>{formatDateTime(summary.receivedAt)}</time>
        </dd>
        <dt>{historyCopy.hash}</dt>
        <dd>
          <code className={styles.code} translate="no">
            {summary.originalSha256}
          </code>
        </dd>
      </dl>
      <h3>{resultCopy.selections}</h3>
      <ul className={styles.selectionList}>
        {summary.selections.map((selection) => (
          <li key={selection.versionId}>
            <Link to={versionPath(selection.versionId)}>{selectionName(selection.stageName, selection.matchday)}</Link>:{' '}
            {resultCopy.newVersion(selection.versionNumber)}
          </li>
        ))}
      </ul>
      <p>
        <Link to={newProjectPath}>{resultCopy.createProject(summary.competitionName)}</Link>
      </p>
      <p className={styles.hint}>{resultCopy.createProjectHint}</p>
    </>
  );
}
