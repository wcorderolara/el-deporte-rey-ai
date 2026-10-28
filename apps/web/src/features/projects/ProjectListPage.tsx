import type { ProjectSummary } from '@edr/contracts';
import { useCallback } from 'react';
import { Link } from 'react-router';

import { DataModeBadge, ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import { approvalStateLabel, createCopy, languageLabel, listCopy } from './copy';
import { newProjectPath, projectPath } from './paths';
import styles from './Projects.module.css';
import { useProjectsDependencies } from './ProjectsContext';
import { useApiRequest } from './useApiRequest';

/** "Stage · Matchday N" or "Stage · whole stage", with the stage name as the source gives it (R-077). */
export function stageDisplay(stageLabel: string, matchday: number | null): string {
  return `${stageLabel} · ${matchday === null ? createCopy.wholeStage : createCopy.matchday(matchday)}`;
}

function ProjectRow({ project }: { project: ProjectSummary }) {
  const demonstration = project.demonstration || project.dataMode === 'DEMO_DATA';
  return (
    <tr>
      <th scope="row">
        <Link to={projectPath(project.id)}>{project.title}</Link>
      </th>
      <td>
        {project.competitionName}
        <span className={styles.secondary}>{project.seasonLabel}</span>
      </td>
      <td>{stageDisplay(project.stageLabel, project.matchday)}</td>
      <td>
        <span className={styles.sourceCell}>
          {project.sourceName} <DataModeBadge mode={project.dataMode} />
        </span>
      </td>
      <td>
        {demonstration ? (
          <StatusBadge label={listCopy.demonstration} tone="demo" symbol="⚠" />
        ) : (
          listCopy.notDemonstration
        )}
      </td>
      <td>{languageLabel[project.language]}</td>
      <td>{approvalStateLabel[project.approvalState]}</td>
      <td>
        {project.lastExportAt === null ? (
          listCopy.neverExported
        ) : (
          <time dateTime={project.lastExportAt}>{formatDateTime(project.lastExportAt)}</time>
        )}
      </td>
    </tr>
  );
}

/**
 * Home page: the project list and history, newest first as the API returns it (R-200), with competition, stage and
 * matchday, source and data mode, demonstration label (R-269, OD-21), language, approval state and last export.
 */
export function ProjectListPage() {
  const { api } = useProjectsDependencies();
  const load = useCallback((signal: AbortSignal) => api.listProjects(signal), [api]);
  const { state, reload } = useApiRequest('projects', load);

  return (
    <section aria-labelledby="projects-title">
      <div className={styles.pageHeader}>
        <h1 id="projects-title">{listCopy.title}</h1>
        <Link className={styles.primaryLink} to={newProjectPath}>
          <span aria-hidden="true">+ </span>
          {listCopy.newProject}
        </Link>
      </div>
      <p>{listCopy.intro}</p>
      {state.status === 'loading' || state.status === 'idle' ? <p role="status">{listCopy.loading}</p> : null}
      {state.status === 'error' ? (
        <ErrorBanner title={listCopy.loadError} error={state.error} onRetry={reload} />
      ) : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <p>
          {listCopy.empty} <Link to={newProjectPath}>{listCopy.createFirst}</Link>
        </p>
      ) : null}
      {state.status === 'success' && state.data.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>{listCopy.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{listCopy.columns.title}</th>
                <th scope="col">{listCopy.columns.competition}</th>
                <th scope="col">{listCopy.columns.stage}</th>
                <th scope="col">{listCopy.columns.source}</th>
                <th scope="col">{listCopy.columns.demonstration}</th>
                <th scope="col">{listCopy.columns.language}</th>
                <th scope="col">{listCopy.columns.approval}</th>
                <th scope="col">{listCopy.columns.lastExport}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
