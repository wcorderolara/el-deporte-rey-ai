import { useCallback } from 'react';
import { Link } from 'react-router';
import { Alert, Button, buttonClassName, Card, describeError, EmptyState, LoadingState } from '../../ui';
import { listCopy } from './copy';
import { generateContentPath, newProjectPath } from './paths';
import { ProjectCard } from './ProjectCard';
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

/** Creator home and library alias; actions use only the existing approval summary. */
export function ProjectListPage() {
  const { api } = useProjectsDependencies();
  const load = useCallback((signal: AbortSignal) => api.listProjects(signal), [api]);
  const { state, reload } = useApiRequest('projects', load);
  const projects = state.status === 'success' ? state.data : [];
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
              <Link className={buttonClassName('primary', 'md')} to={newProjectPath}>
                <span aria-hidden="true">＋</span>Crear contenido
              </Link>
              <Link className={buttonClassName('secondary', 'md')} to={generateContentPath}>
                Generar desde una competición
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
              Retoma una creación o consulta lo que ya descargaste.
            </p>
          </div>
          <span className="text-caption text-text-subtle">Del más reciente al más antiguo</span>
        </div>
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
              <Link className={buttonClassName()} to={newProjectPath}>
                Crear contenido
              </Link>
            }
          />
        ) : null}
        {state.status === 'success' && projects.length > 0 ? (
          <ul aria-label="Proyectos e historial" className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id} className="min-w-0">
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
