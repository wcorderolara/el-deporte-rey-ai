import type { ManualVersion } from '@edr/contracts';
import { Link, useParams } from 'react-router';

import { DataModeBadge, ErrorBanner, formatDateTime } from '../../ui';
import { formCopy, matchStatusLabel, selectionName, versionCopy } from './copy';
import type { ImportsApi } from './importsApi';
import styles from './Imports.module.css';
import { importsPath, isUuid } from './paths';
import { useApiResource } from './useApiResource';

export interface VersionPageProps {
  api: ImportsApi;
}

/**
 * One version of a MANUAL_DATA selection, current or superseded (getManualVersion; R-068, R-278), at
 * `/imports/versions/:versionId`. An address that is not a server identifier makes no request.
 */
export function VersionPage({ api }: VersionPageProps) {
  const versionId = useParams().versionId;
  const valid = isUuid(versionId);
  const version = useApiResource(valid ? versionId : null, (signal) => api.getManualVersion(versionId ?? '', signal));

  let content;
  if (!valid) {
    content = (
      <>
        <h1 id="version-title">{versionCopy.loadFailedTitle}</h1>
        <p>{versionCopy.invalidAddress}</p>
      </>
    );
  } else if (version.state.status === 'ready') {
    content = <VersionDetails version={version.state.data} />;
  } else if (version.state.status === 'error') {
    content = (
      <>
        <h1 id="version-title">{versionCopy.loadFailedTitle}</h1>
        <ErrorBanner error={version.state.error} title={versionCopy.loadFailedTitle} onRetry={version.reload} />
      </>
    );
  } else {
    content = (
      <>
        <h1 id="version-title">{versionCopy.loading}</h1>
        <p role="status" aria-live="polite">
          {versionCopy.loading}
        </p>
      </>
    );
  }

  return (
    <section aria-labelledby="version-title">
      <p>
        <Link to={importsPath}>{versionCopy.back}</Link>
      </p>
      {content}
    </section>
  );
}

function VersionDetails({ version }: { version: ManualVersion }) {
  const { selection } = version;
  const name = selectionName(selection.stage.name, selection.matchday);
  const teamNames = new Map(selection.teams.map((team) => [team.key, team.name]));
  const teamName = (key: string): string => teamNames.get(key) ?? key;

  return (
    <>
      <h1 id="version-title">{versionCopy.title(version.versionNumber, name)}</h1>
      <p className={styles.notice}>
        {version.supersededAt === null
          ? versionCopy.current
          : versionCopy.superseded(formatDateTime(version.supersededAt))}
      </p>
      <h2>{versionCopy.details}</h2>
      <dl className={styles.details}>
        <dt>{versionCopy.dataMode}</dt>
        <dd>
          <DataModeBadge mode="MANUAL_DATA" />
        </dd>
        <dt>{versionCopy.createdAt}</dt>
        <dd>
          <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
        </dd>
        <dt>{versionCopy.competition}</dt>
        <dd>
          <code className={styles.code} translate="no">
            {version.competitionId}
          </code>
        </dd>
        <dt>{versionCopy.season}</dt>
        <dd>
          <code className={styles.code} translate="no">
            {version.seasonId}
          </code>
        </dd>
        <dt>{versionCopy.stageOrder}</dt>
        <dd>{selection.stage.order}</dd>
        <dt>{versionCopy.importId}</dt>
        <dd>
          <code className={styles.code} translate="no">
            {version.importId}
          </code>
        </dd>
      </dl>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption>{versionCopy.teams}</caption>
          <thead>
            <tr>
              <th scope="col">{versionCopy.teamName}</th>
              <th scope="col">{versionCopy.teamKey}</th>
            </tr>
          </thead>
          <tbody>
            {selection.teams.map((team) => (
              <tr key={team.key}>
                <th scope="row">{team.name}</th>
                <td>
                  <code className={styles.code} translate="no">
                    {team.key}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption>{versionCopy.matches}</caption>
          <thead>
            <tr>
              <th scope="col">{versionCopy.home}</th>
              <th scope="col">{versionCopy.away}</th>
              <th scope="col">{versionCopy.kickoff}</th>
              <th scope="col">{versionCopy.status}</th>
              <th scope="col">{versionCopy.score}</th>
            </tr>
          </thead>
          <tbody>
            {selection.matches.map((match) => (
              <tr key={`${match.home}-${match.away}`}>
                <td>{teamName(match.home)}</td>
                <td>{teamName(match.away)}</td>
                <td>
                  <time dateTime={match.kickoff}>{formatDateTime(match.kickoff)}</time>
                </td>
                <td>{matchStatusLabel[match.status]}</td>
                <td>{match.score === null ? versionCopy.noScore : `${match.score.home} - ${match.score.away}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selection.standings === null ? (
        <p>{versionCopy.noStandings}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>{versionCopy.standingsAsOf(formatDateTime(selection.standings.asOf))}</caption>
            <thead>
              <tr>
                <th scope="col">{formCopy.position}</th>
                <th scope="col">{versionCopy.teamName}</th>
                <th scope="col">{formCopy.played}</th>
                <th scope="col">{formCopy.won}</th>
                <th scope="col">{formCopy.drawn}</th>
                <th scope="col">{formCopy.lost}</th>
                <th scope="col">{formCopy.goalsFor}</th>
                <th scope="col">{formCopy.goalsAgainst}</th>
                <th scope="col">{formCopy.goalDifference}</th>
                <th scope="col">{formCopy.points}</th>
              </tr>
            </thead>
            <tbody>
              {selection.standings.rows.map((row) => (
                <tr key={`${row.position}-${row.team}`}>
                  <td>{row.position}</td>
                  <th scope="row">{teamName(row.team)}</th>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>{row.goalsFor}</td>
                  <td>{row.goalsAgainst}</td>
                  <td>{row.goalDifference}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
