import type { Evidence } from '@edr/contracts';
import { Link } from 'react-router';

import { featurePaths } from '../../app/routes';
import { DataModeBadge, formatDateTime, SafeReference } from '../../ui';
import { evidenceCopy, evidenceRelationLabel, sourceRoleLabel } from './copy';
import styles from './Facts.module.css';
import { formatFactValue, type TeamNames } from './format';

export interface EvidenceTableProps {
  evidence: readonly Evidence[];
  teams: TeamNames;
  /** Name of the fact, used for the accessible name of the scrollable region. */
  factLabel: string;
}

/**
 * Evidence of a fact, one row per source observation: source name, data mode, role, accepted, relation, value,
 * reference, retrieval time and import version (R-204, R-269, R-287). The reference is rendered with
 * `SafeReference` only: plain text, never a link (T10-F16, T11H-F14).
 */
export function EvidenceTable({ evidence, teams, factLabel }: EvidenceTableProps) {
  if (evidence.length === 0) {
    return <p>{evidenceCopy.empty}</p>;
  }
  return (
    <div className={styles.tableWrapper} role="region" aria-label={evidenceCopy.scrollRegion(factLabel)} tabIndex={0}>
      <table className={styles.table}>
        <caption>{evidenceCopy.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{evidenceCopy.source}</th>
            <th scope="col">{evidenceCopy.mode}</th>
            <th scope="col">{evidenceCopy.role}</th>
            <th scope="col">{evidenceCopy.accepted}</th>
            <th scope="col">{evidenceCopy.relation}</th>
            <th scope="col">{evidenceCopy.value}</th>
            <th scope="col">{evidenceCopy.reference}</th>
            <th scope="col">{evidenceCopy.retrievedAt}</th>
            <th scope="col">{evidenceCopy.importVersion}</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((item, index) => (
            <tr key={`${item.sourceId}-${item.relation}-${index}`} data-testid="evidence-row">
              <th scope="row">
                {item.sourceName}{' '}
                <span translate="no">
                  (<code>{item.sourceId}</code>)
                </span>
              </th>
              <td>
                <DataModeBadge mode={item.dataMode} />
              </td>
              <td>
                {sourceRoleLabel[item.role]}
                {item.officialPublication ? `, ${evidenceCopy.officialPublication}` : null}
              </td>
              <td>{item.accepted ? evidenceCopy.yes : evidenceCopy.no}</td>
              <td>{evidenceRelationLabel[item.relation]}</td>
              <td>{formatFactValue(item.value, teams)}</td>
              <td data-testid="evidence-reference">
                <SafeReference value={item.sourceRef} />
              </td>
              <td>
                <time dateTime={item.retrievedAt}>{formatDateTime(item.retrievedAt)}</time>
              </td>
              <td>
                {item.importVersionId === null ? (
                  evidenceCopy.noImportVersion
                ) : (
                  <>
                    <code translate="no">{item.importVersionId}</code>{' '}
                    <Link to={featurePaths.imports}>{evidenceCopy.viewImports}</Link>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
