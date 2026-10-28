import type { ImportSummary } from '@edr/contracts';
import { useId } from 'react';
import { Link } from 'react-router';

import { ErrorBanner, formatDateTime } from '../../ui';
import { resultCopy, selectionName, versionsCopy } from './copy';
import type { ImportsApi } from './importsApi';
import styles from './Imports.module.css';
import { newProjectPath, versionPath } from './paths';
import { useApiResource } from './useApiResource';

/** A competition season that has applied imports. */
export interface SeasonPair {
  key: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonLabel: string;
}

export function pairKey(competitionId: string, seasonId: string): string {
  return JSON.stringify([competitionId, seasonId]);
}

/** Distinct competition seasons of the imports, in the order of the history (newest first). */
export function seasonPairs(imports: readonly ImportSummary[]): SeasonPair[] {
  const pairs = new Map<string, SeasonPair>();
  for (const item of imports) {
    const key = pairKey(item.competitionId, item.seasonId);
    if (!pairs.has(key)) {
      pairs.set(key, {
        key,
        competitionId: item.competitionId,
        competitionName: item.competitionName,
        seasonId: item.seasonId,
        seasonLabel: item.seasonLabel,
      });
    }
  }
  return [...pairs.values()];
}

export interface SelectionVersionsProps {
  api: ImportsApi;
  pairs: readonly SeasonPair[];
  /** Chosen pair; the first pair when null or unknown. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Changes after an applied import, so that the versions are loaded again. */
  refreshToken: number;
}

/**
 * Versions per selection of a competition season (listManualSelections; R-068, R-278): the current version and every
 * earlier one, each linked to its normalized content. Also links to the project creation form for the competition
 * (R-276).
 */
export function SelectionVersions({ api, pairs, selectedKey, onSelect, refreshToken }: SelectionVersionsProps) {
  const id = useId();
  const selected = pairs.find((pair) => pair.key === selectedKey) ?? pairs[0] ?? null;
  const history = useApiResource(
    selected === null ? null : JSON.stringify([selected.competitionId, selected.seasonId, refreshToken]),
    (signal) => api.listManualSelections(selected?.competitionId ?? '', selected?.seasonId ?? '', signal),
  );

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{versionsCopy.heading}</h2>
      <p>{versionsCopy.intro}</p>
      {selected === null ? (
        <p>{versionsCopy.noPairs}</p>
      ) : (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-pair`}>
              {versionsCopy.pairField}
            </label>
            <select
              id={`${id}-pair`}
              className={styles.input}
              value={selected.key}
              onChange={(event) => onSelect(event.target.value)}
            >
              {pairs.map((pair) => (
                <option key={pair.key} value={pair.key}>
                  {pair.competitionName}, {pair.seasonLabel}
                </option>
              ))}
            </select>
          </div>
          <p>
            <Link to={newProjectPath}>{resultCopy.createProject(selected.competitionName)}</Link>
          </p>
          {history.state.status === 'idle' || history.state.status === 'loading' ? (
            <p role="status" aria-live="polite">
              {versionsCopy.loading}
            </p>
          ) : history.state.status === 'error' ? (
            <ErrorBanner error={history.state.error} title={versionsCopy.loadFailedTitle} onRetry={history.reload} />
          ) : history.state.data.selections.length === 0 ? (
            <p>{versionsCopy.empty}</p>
          ) : (
            history.state.data.selections.map((selection) => {
              const name = selectionName(selection.stageName, selection.matchday);
              const versions = [...selection.versions].sort((a, b) => b.versionNumber - a.versionNumber);
              return (
                <div key={`${selection.stageId}-${selection.matchday ?? 'stage'}`} className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <caption>{versionsCopy.versionsCaption(name)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{versionsCopy.versionColumn}</th>
                        <th scope="col">{versionsCopy.state}</th>
                        <th scope="col">{versionsCopy.createdAt}</th>
                        <th scope="col">{versionsCopy.view}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((version) => (
                        <tr key={version.versionId}>
                          <th scope="row">{versionsCopy.version(version.versionNumber)}</th>
                          <td>{version.current ? versionsCopy.current : versionsCopy.earlier}</td>
                          <td>
                            <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
                          </td>
                          <td>
                            <Link
                              to={versionPath(version.versionId)}
                              aria-label={versionsCopy.viewVersion(version.versionNumber, name)}
                            >
                              {versionsCopy.view}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </>
      )}
    </section>
  );
}
