import type { Export, Project } from '@edr/contracts';
import { Link, useParams } from 'react-router';

import { featurePaths } from '../../app/routes';
import { Card, EmptyState, ErrorBanner, LoadingState } from '../../ui';
import { loadExportsPage, useHistoryApi } from './api';
import { exportActionCopy, historyCopy } from './copy';
import { ExportAction } from './ExportAction';
import { ExportHistoryCard } from './ExportHistoryCard';
import { exportPath, isUuid, projectPath } from './paths';
import { useLoad } from './useLoad';

/** Export creation and project-scoped history. */
export function ExportsPage() {
  const { projectId } = useParams();
  return isUuid(projectId) ? (
    <ExportsView key={projectId} projectId={projectId} />
  ) : (
    <p>{historyCopy.invalidAddress}</p>
  );
}

function ProjectLinks({ projectId }: { projectId: string }) {
  return (
    <p className="m-0 flex flex-wrap gap-4 text-body-sm">
      <Link
        className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
        to={projectPath(projectId)}
      >
        {historyCopy.backToProject}
      </Link>
      <Link
        className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
        to={featurePaths.review(projectId)}
      >
        {historyCopy.toReview}
      </Link>
    </p>
  );
}

function ExportCard({ project, item }: { project: Project; item: Export }) {
  return (
    <ExportHistoryCard
      title={project.title}
      exportedAt={item.exportedAt}
      files={item.files}
      exportId={item.id}
      contentHref={exportPath(project.id, item.id)}
      headingLevel="h3"
    />
  );
}

function ExportRows({ project, items }: { project: Project; items: readonly Export[] }) {
  return (
    <ul
      aria-label="Historial de exportaciones del proyecto"
      className="m-0 grid min-w-0 list-none gap-3 p-0 lg:grid-cols-2"
    >
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <ExportCard project={project} item={item} />
        </li>
      ))}
    </ul>
  );
}

function ExportsView({ projectId }: { projectId: string }) {
  const client = useHistoryApi();
  const page = useLoad(`exports\u0000${projectId}`, (signal) => loadExportsPage(client, projectId, signal));
  const data = page.latest;
  if (data === null) {
    if (page.state.status === 'error') {
      return (
        <section className="grid min-w-0 gap-4">
          <ProjectLinks projectId={projectId} />
          <header>
            <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Tu biblioteca</p>
            <h1 className="m-0 font-display text-heading-lg font-extrabold tracking-display">Exportaciones</h1>
          </header>
          <ErrorBanner error={page.state.error} title={historyCopy.loadErrorTitle} onRetry={page.reload} />
        </section>
      );
    }
    return (
      <section className="grid min-w-0 gap-4">
        <ProjectLinks projectId={projectId} />
        <header>
          <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Tu biblioteca</p>
          <h1 className="m-0 font-display text-heading-lg font-extrabold tracking-display">Exportaciones</h1>
        </header>
        <LoadingState layout="panel" label="Cargando exportaciones del proyecto…" />
      </section>
    );
  }
  return (
    <section className="grid min-w-0 gap-6">
      <header className="grid gap-3">
        <ProjectLinks projectId={projectId} />
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Tu biblioteca</p>
        <h1 className="m-0 font-display text-heading-lg font-extrabold tracking-display">Exportaciones</h1>
      </header>
      {data.project.demonstration || data.project.dataMode === 'DEMO_DATA' ? (
        <p role="note" className="m-0 border-l-2 border-demo px-3 py-1 text-caption text-demo">
          Datos sintéticos · no verificados ni publicables.
        </p>
      ) : null}
      <Card as="section" aria-label={exportActionCopy.title}>
        <ExportAction projectId={projectId} onExported={page.reload} />
      </Card>
      {page.state.status === 'error' ? (
        <ErrorBanner error={page.state.error} title={historyCopy.loadErrorTitle} onRetry={page.reload} />
      ) : null}
      <section aria-labelledby="export-history-title" className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="export-history-title" className="m-0 font-display text-heading-sm font-extrabold">
              Historial de exportaciones
            </h2>
            <p className="m-0 mt-1 text-body-sm text-text-secondary">Tus carruseles listos para descargar.</p>
          </div>
          <Link
            className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
            to="/exports"
          >
            Ver todas las exportaciones
          </Link>
        </div>
        {data.exports.length === 0 ? (
          <EmptyState
            title="Todavía no hay exportaciones"
            description="Cuando exportes un carrusel aprobado, aparecerá aquí para volver a descargarlo."
            icon="⇩"
          />
        ) : (
          <div className="grid min-w-0 gap-3">
            <ExportRows project={data.project} items={data.exports.slice(0, 3)} />
            {data.exports.length <= 3 ? null : (
              <details className="rounded-card border-hairline border-border-subtle bg-surface-raised p-3">
                <summary className="focus-studio min-h-touch cursor-pointer text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4">
                  Ver historial completo ({data.exports.length - 3} anteriores)
                </summary>
                <div className="mt-3">
                  <ExportRows project={data.project} items={data.exports.slice(3)} />
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
