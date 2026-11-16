import type { ProjectSummary } from '@edr/contracts';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  buttonClassName,
  Card,
  describeError,
  EmptyState,
  LoadingState,
  ViewModeToggle,
} from '../../ui';
import { listCopy } from './copy';
import { contentTypeLabel, projectStatus, sportsContextSummary } from './dashboardModel';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { generateContentPath } from './paths';
import { ProjectActions, ProjectCard } from './ProjectCard';
import { useProjectsDependencies } from './ProjectsContext';
import { useApiRequest } from './useApiRequest';

export { stageDisplay } from './ProjectCard';

function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  const description = describeError(error);
  return (
    <Alert role="alert" tone="danger" title={listCopy.loadError}>
      <p className="m-0">{description.message}</p>
      {description.reason ? <p>{description.reason}</p> : null}
      {description.hint ? <p>{description.hint}</p> : null}
      {description.retryAfterSeconds !== null ? (
        <p>Reintento disponible en {description.retryAfterSeconds} segundos.</p>
      ) : null}
      {description.validationIssues.length > 0 ? (
        <ul>
          {description.validationIssues.map((issue, index) => (
            <li key={index}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {description.retryable ? (
        <Button className="mt-4" variant="quiet" onClick={retry}>
          Reintentar
        </Button>
      ) : null}
    </Alert>
  );
}

function ProjectTable({
  projects,
  onDelete,
}: {
  projects: readonly ProjectSummary[];
  onDelete: (project: ProjectSummary) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Proyectos e historial</caption>
        <thead>
          <tr className="border-b border-border-subtle text-caption text-text-secondary">
            <th scope="col" className="px-4 py-3">
              Proyecto
            </th>
            <th scope="col" className="px-4 py-3">
              Tipo de contenido
            </th>
            <th scope="col" className="px-4 py-3">
              Contexto deportivo
            </th>
            <th scope="col" className="px-4 py-3">
              Estado
            </th>
            {/* <th scope="col" className="px-4 py-3">
              Creado
            </th> */}
            <th scope="col" className="px-4 py-3 text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const state = projectStatus(project);
            return (
              <tr key={project.id} className="border-b border-border-subtle align-middle last:border-0">
                <th scope="row" className="px-4 py-4 font-display text-body-md font-bold text-text-primary">
                  {project.title}
                </th>
                <td className="px-4 py-4 text-body-sm text-text-secondary">{contentTypeLabel(project)}</td>
                <td className="px-4 py-4 text-body-sm text-text-secondary">{sportsContextSummary(project)}</td>
                <td className="px-4 py-4">
                  <Badge tone={state.tone}>{state.label}</Badge>
                </td>
                {/* <td className="px-4 py-4 text-body-sm text-text-secondary">
                  <time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time>
                </td> */}
                <td className="px-4 py-4">
                  <ProjectActions
                    project={project}
                    onDelete={onDelete}
                    compact
                    className="flex items-center justify-end gap-2 whitespace-nowrap"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Creator home and project library (PD-ARCH-01F): a table by default and an alternative card view over the same list,
 * with the same two actions for every project in any state: open its detail and delete it after confirmation.
 */
export function ProjectListPage() {
  const { api } = useProjectsDependencies();
  const load = useCallback((signal: AbortSignal) => api.listProjects(signal), [api]);
  const { state, reload, replace } = useApiRequest('projects', load);
  const projects = state.status === 'success' ? state.data : [];
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function deleted(project: ProjectSummary) {
    setDeleting(null);
    replace(projects.filter((item) => item.id !== project.id));
    setAnnouncement(`Se eliminó el proyecto «${project.title}».`);
  }

  function requestDelete(project: ProjectSummary) {
    setAnnouncement('');
    setDeleting(project);
  }
  return (
    <section aria-labelledby="projects-title" className="grid min-w-0 gap-8">
      <div className="relative overflow-hidden rounded-panel border-hairline border-border-subtle bg-gradient-to-br from-brand-purple-deep via-surface-overlay to-surface-raised p-6 shadow-card sm:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="max-w-reading">
            <p className="m-0 mb-4 text-caption font-bold tracking-label text-brand-gold uppercase">
              Tu estudio deportivo
            </p>
            <h1
              id="projects-title"
              className="m-0 font-display text-heading-md font-extrabold tracking-display text-text-primary sm:text-heading-lg"
            >
              Tu próximo contenido empieza aquí
            </h1>
            <p className="m-0 mt-4 text-body-lg text-text-secondary">
              Convierte resultados deportivos en contenido visual listo para descargar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className={buttonClassName('primary', 'md')} to={generateContentPath}>
                <span aria-hidden="true">＋</span>Crear contenido
              </Link>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="hidden w-36 rotate-3 rounded-card border-hairline border-brand-gold bg-surface-canvas p-4 shadow-gold-glow md:block"
          >
            <span className="text-caption font-bold tracking-label text-brand-gold">4:5</span>
            <div className="my-4 grid gap-2">
              <div className="h-2 w-12 bg-brand-purple" />
              <div className="h-3 w-full bg-text-primary" />
              <div className="h-3 w-16 bg-brand-gold" />
              <div className="mt-3 h-10 border-y border-border-subtle" />
            </div>
            <span className="text-caption font-bold text-text-secondary">CARRUSEL</span>
          </div>
        </div>
        <p className="m-0 mt-6 border-t border-border-subtle pt-4 text-body-sm text-text-secondary">
          Carruseles estáticos 4:5 · Imágenes, textos y hashtags · Publicación manual
        </p>
      </div>
      <section aria-labelledby="library-title" className="grid min-w-0 gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="library-title" className="m-0 font-display text-heading-sm font-extrabold text-text-primary">
              Tus proyectos
            </h2>
            <p className="m-0 mt-2 text-body-sm text-text-secondary">
              Retoma una creación o consulta lo que ya descargaste. Del más reciente al más antiguo.
            </p>
          </div>
          {state.status === 'success' && projects.length > 0 ? (
            <ViewModeToggle value={view} onChange={setView} />
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="m-0 text-body-sm text-text-secondary">
          {announcement}
        </p>
        {state.status === 'loading' || state.status === 'idle' ? (
          <Card className="min-h-36">
            <LoadingState layout="panel" label={listCopy.loading} />
          </Card>
        ) : null}
        {state.status === 'error' ? <DashboardError error={state.error} retry={reload} /> : null}
        {state.status === 'success' && projects.length === 0 ? (
          <EmptyState
            title="Todavía no has creado contenido"
            description="Selecciona una competición y transforma sus resultados en imágenes deportivas."
            icon="◇"
            action={
              <Link className={buttonClassName()} to={generateContentPath}>
                Crear contenido
              </Link>
            }
          />
        ) : null}
        {state.status === 'success' && projects.length > 0 && view === 'table' ? (
          <ProjectTable projects={projects} onDelete={requestDelete} />
        ) : null}
        {state.status === 'success' && projects.length > 0 && view === 'cards' ? (
          <ul aria-label="Proyectos e historial" className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id} className="min-w-0">
                <ProjectCard project={project} onDelete={requestDelete} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {deleting === null ? null : (
        <DeleteProjectDialog project={deleting} onCancel={() => setDeleting(null)} onDeleted={deleted} />
      )}
    </section>
  );
}
