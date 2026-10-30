import type { Export, Project } from '@edr/contracts';
import { useId } from 'react';
import { Link, useParams } from 'react-router';

import { featurePaths } from '../../app/routes';
import { appCopy, DataModeBadge, DemoBanner, ErrorBanner, featureCopy, formatDateTime, pageCopy } from '../../ui';
import { approvalStateLabel } from '../projects/copy';
import { loadExportsPage, useHistoryApi } from './api';
import { exportActionCopy, historyCopy, listCopy } from './copy';
import { ExportAction } from './ExportAction';
import styles from './History.module.css';
import { exportPath, isUuid, projectPath } from './paths';
import { useLoad } from './useLoad';

/** Route component: export action and export history of a project (`/projects/:projectId/exports`). */
export function ExportsPage() {
  const { projectId } = useParams();
  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title">{featureCopy.history}</h1>
      <p className={styles.intro}>{historyCopy.intro}</p>
      {isUuid(projectId) ? (
        <ExportsView key={projectId} projectId={projectId} />
      ) : (
        <>
          <p>{historyCopy.invalidAddress}</p>
          <p>
            <Link to={featurePaths.projectList}>{pageCopy.backToProjects}</Link>
          </p>
        </>
      )}
    </section>
  );
}

function ExportsView({ projectId }: { projectId: string }) {
  const client = useHistoryApi();
  const page = useLoad(`exports\u0000${projectId}`, (signal) => loadExportsPage(client, projectId, signal));
  const data = page.latest;

  if (data === null) {
    return page.state.status === 'error' ? (
      <>
        <ErrorBanner error={page.state.error} title={historyCopy.loadErrorTitle} onRetry={page.reload} />
        <ProjectLinks projectId={projectId} />
      </>
    ) : (
      <p role="status" aria-live="polite">
        {appCopy.loading}
      </p>
    );
  }

  return (
    <>
      <ProjectLinks projectId={projectId} />
      <ProjectSummary project={data.project} />
      {data.project.demonstration || data.project.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      <p className={styles.note}>{historyCopy.noPublication}</p>
      <ExportAction projectId={projectId} onExported={page.reload} />
      <p>
        <a href="#export-history">{exportActionCopy.historyLink}</a>
      </p>
      {page.state.status === 'error' ? (
        <ErrorBanner error={page.state.error} title={historyCopy.loadErrorTitle} onRetry={page.reload} />
      ) : null}
      <ExportList projectId={projectId} exports={data.exports} />
    </>
  );
}

function ProjectLinks({ projectId }: { projectId: string }) {
  return (
    <p className={styles.links}>
      <Link to={projectPath(projectId)}>{historyCopy.backToProject}</Link>
      {' · '}
      <Link to={featurePaths.review(projectId)}>{historyCopy.toReview}</Link>
    </p>
  );
}

/** The project in the history: title, data mode, approval state and last export time (R-220, R-269). */
function ProjectSummary({ project }: { project: Project }) {
  return (
    <dl className={styles.summary} data-testid="project-summary">
      <div>
        <dt>{historyCopy.projectTitle}</dt>
        <dd>{project.title}</dd>
      </div>
      <div>
        <dt>{historyCopy.dataMode}</dt>
        <dd>
          <DataModeBadge mode={project.dataMode} />
        </dd>
      </div>
      <div>
        <dt>{historyCopy.approvalState}</dt>
        <dd>{approvalStateLabel[project.approvalState]}</dd>
      </div>
      <div>
        <dt>{historyCopy.lastExport}</dt>
        <dd>
          {project.lastExportAt === null ? (
            historyCopy.neverExported
          ) : (
            <time dateTime={project.lastExportAt}>{formatDateTime(project.lastExportAt)}</time>
          )}
        </dd>
      </div>
    </dl>
  );
}

/**
 * Exports of the project, newest first as the server lists them (R-220), with export time, data mode and the
 * demonstration label (R-269). Exports are kept; there is no deletion control (OD-08).
 */
function ExportList({ projectId, exports }: { projectId: string; exports: readonly Export[] }) {
  const titleId = useId();
  return (
    <section id="export-history" className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{listCopy.title}</h2>
      <p className={styles.muted}>{listCopy.kept}</p>
      {exports.length === 0 ? (
        <p>{listCopy.empty}</p>
      ) : (
        <div className={styles.tableWrapper} role="region" aria-labelledby={titleId} tabIndex={0}>
          <table className={styles.table}>
            <caption>{listCopy.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{listCopy.exportedAt}</th>
                <th scope="col">{listCopy.dataMode}</th>
                <th scope="col">{listCopy.label}</th>
                <th scope="col">{listCopy.finalApproval}</th>
                <th scope="col">{listCopy.files}</th>
                <th scope="col">{listCopy.directory}</th>
                <th scope="col">{listCopy.open}</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((item) => {
                const exportedAt = formatDateTime(item.exportedAt);
                return (
                  <tr key={item.id} data-testid="export-row">
                    <th scope="row">
                      <time dateTime={item.exportedAt}>{exportedAt}</time>
                    </th>
                    <td>
                      <DataModeBadge mode={item.dataMode} />
                    </td>
                    <td data-testid="export-label">
                      {item.demonstration || item.dataMode === 'DEMO_DATA' ? (
                        <strong>
                          <span aria-hidden="true">⚠ </span>
                          {listCopy.demonstration}
                        </strong>
                      ) : (
                        listCopy.notDemonstration
                      )}
                    </td>
                    <td>{listCopy.finalApprovalRecorded}</td>
                    <td>{listCopy.fileCount(item.files.length)}</td>
                    <td>
                      <code className={styles.path} dir="ltr" translate="no">
                        {item.directory}
                      </code>
                    </td>
                    <td>
                      <Link to={exportPath(projectId, item.id)} aria-label={listCopy.openLabel(exportedAt)}>
                        {listCopy.open}
                      </Link>
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
