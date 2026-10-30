import type { Language, Project, RunKind } from '@edr/contracts';
import { useCallback, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { featurePaths } from '../../app/routes';
import { Badge, buttonClassName, Card, dataModeLabel, ErrorBanner, featureCopy, formatDateTime } from '../../ui';
import { createCopy, detailCopy, languageLabel, runCopy } from './copy';
import { isProjectId } from './paths';
import styles from './Projects.module.css';
import { useProjectsDependencies } from './ProjectsContext';
import { isRunActive, RunProgress, runSummary } from './RunProgress';
import { LanguageField } from './SelectionFields';
import { useApiRequest } from './useApiRequest';
import { useRunPolling } from './useRunPolling';
import { ProjectGeneratedContent } from './ProjectGeneratedContent';

/** Page shown for an address inside `/projects/` that is no project. */
export function ProjectNotFound() {
  return (
    <section aria-labelledby="project-not-found-title">
      <h1 id="project-not-found-title">{featureCopy.projects}</h1>
      <p>{detailCopy.notFound}</p>
      <p>
        <Link to="/">{detailCopy.backToList}</Link>
      </p>
    </section>
  );
}

function SelectionSummary({ project }: { project: Project }) {
  const period = `${project.seasonLabel} · ${project.stageLabel}${project.matchday === null ? '' : ` · ${createCopy.matchday(project.matchday)}`}`;
  return (
    <Card
      as="section"
      aria-labelledby="project-selection-title"
      className="grid min-w-0 gap-4 bg-gradient-to-br from-surface-overlay via-surface-raised to-surface-card sm:p-6"
    >
      <div className="grid min-w-0 gap-1">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">
          Carrusel de Instagram · 4:5
        </p>
        <p data-testid="project-summary" className="m-0 text-body-sm text-text-secondary">
          {project.competitionName} · {period}
        </p>
      </div>
      <h1
        id="project-selection-title"
        className="m-0 break-normal text-pretty font-display text-heading-lg font-extrabold tracking-display"
      >
        {project.title}
      </h1>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ProjectStatus project={project} />
      </div>
      {project.demonstration || project.dataMode === 'DEMO_DATA' ? (
        <p role="note" className="m-0 border-l-2 border-demo px-3 py-1 text-caption text-demo">
          Datos sintéticos · no verificados ni publicables.
        </p>
      ) : null}
      <details className="rounded-control border-hairline border-border-subtle bg-surface-subtle p-3">
        <summary className="focus-studio min-h-touch cursor-pointer content-center text-body-sm text-text-link underline decoration-border-strong underline-offset-4">
          Detalles de selección
        </summary>
        <dl className="mt-3 grid gap-2 text-body-sm text-text-secondary sm:grid-cols-2">
          <div>
            <dt className="font-bold">Modo de datos</dt>
            <dd className="m-0">{dataModeLabel[project.dataMode]}</dd>
          </div>
          <div>
            <dt className="font-bold">Fuente de datos</dt>
            <dd className="m-0">{project.sourceName}</dd>
          </div>
          <div>
            <dt className="font-bold">Creado</dt>
            <dd className="m-0">
              <time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time>
            </dd>
          </div>
        </dl>
        {project.dataMode === 'MANUAL_DATA' ? (
          <p className="m-0 mt-3 text-caption text-text-secondary">{detailCopy.manualNote}</p>
        ) : null}
      </details>
    </Card>
  );
}

function ProjectStatus({ project }: { project: Project }) {
  if (project.latestRun?.status === 'pending' || project.latestRun?.status === 'running')
    return <Badge tone="info">Preparando contenido</Badge>;
  if (project.latestRun?.status === 'failed') return <Badge tone="danger">La generación necesita atención</Badge>;
  const status = {
    no_draft: { label: 'En preparación', tone: 'neutral' as const },
    in_review: { label: 'Pendiente de revisión', tone: 'warning' as const },
    final_approved: { label: 'Listo para exportar', tone: 'success' as const },
    exported: { label: 'Exportado', tone: 'info' as const },
  }[project.approvalState];
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

function LanguageSection({ project, onUpdated }: { project: Project; onUpdated: (project: Project) => void }) {
  const { api } = useProjectsDependencies();
  const [choice, setChoice] = useState<Language>(project.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choice === project.language || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const updated = await api.updateProject(project.id, { language: choice });
      onUpdated(updated);
      setMessage(detailCopy.languageSaved(languageLabel[updated.language]));
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  const unchanged = choice === project.language;
  return (
    <section aria-labelledby="project-language-title">
      <h2 id="project-language-title">{detailCopy.languageTitle}</h2>
      <form className={styles.inlineForm} onSubmit={save} noValidate>
        <LanguageField value={choice} onChange={setChoice} label={detailCopy.languageLabel} />
        <button type="submit" className={styles.secondaryButton} disabled={unchanged || saving}>
          {saving ? detailCopy.languageSaving : detailCopy.languageSave}
        </button>
      </form>
      <p role="status" className={styles.hint}>
        {message}
      </p>
      {error === null ? null : <ErrorBanner title={detailCopy.languageError} error={error} />}
    </section>
  );
}

function RunSection({
  project,
  onRunFinished,
  creationGenerationFailed,
}: {
  project: Project;
  onRunFinished: () => void;
  creationGenerationFailed: boolean;
}) {
  const { api, runPollIntervalMs } = useProjectsDependencies();
  const polling = useRunPolling(api, project.id, project.latestRun, runPollIntervalMs, onRunFinished);
  const [starting, setStarting] = useState<RunKind | null>(null);
  const [startError, setStartError] = useState<{ kind: RunKind; error: unknown } | null>(null);
  const run = polling.run;
  const active = run !== null && isRunActive(run);

  async function start(kind: RunKind) {
    if (starting !== null) {
      return;
    }
    setStarting(kind);
    setStartError(null);
    try {
      polling.setRun(await api.startRun(project.id, { kind }));
    } catch (error) {
      setStartError({ kind, error });
    } finally {
      setStarting(null);
    }
  }

  const disabled = active || starting !== null;
  return (
    <section id="project-generation" aria-labelledby="project-run-title" className="grid min-w-0 gap-3">
      <h2 id="project-run-title" className="m-0 font-display text-heading-sm font-extrabold">
        {runCopy.title}
      </h2>
      {creationGenerationFailed ? (
        <p role="alert" className={styles.note}>
          El proyecto quedó guardado, pero no se pudo iniciar la generación. Puedes volver a intentarlo aquí.
        </p>
      ) : null}
      <p role="status" className="m-0 text-body-sm text-text-secondary">
        {run === null ? runCopy.none : runSummary(run)}
        {starting === null ? '' : ` ${runCopy.starting}`}
      </p>
      {run !== null && run.status === 'failed' ? (
        <p className={styles.note}>
          <span aria-hidden="true">✕ </span>
          {runCopy.restartHint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClassName('secondary', 'sm')}
          disabled={disabled}
          onClick={() => void start('full')}
        >
          {run !== null && run.status === 'failed' ? runCopy.restartFull : runCopy.startFull}
        </button>
        {run === null ? null : (
          <button
            type="button"
            className={buttonClassName('quiet', 'sm')}
            disabled={disabled}
            onClick={() => void start('redraft')}
          >
            {runCopy.startRedraft}
          </button>
        )}
      </div>
      <p className="m-0 text-body-sm text-text-secondary">{active ? runCopy.activeHint : runCopy.fullHint}</p>
      {run === null || active ? null : <p className="m-0 text-caption text-text-subtle">{runCopy.redraftHint}</p>}
      {startError === null ? null : (
        <ErrorBanner title={runCopy.startError} error={startError.error} onRetry={() => void start(startError.kind)} />
      )}
      {polling.pollError === null ? null : (
        <div className="grid gap-2">
          <ErrorBanner title={runCopy.pollError} error={polling.pollError} />
          {polling.stopped ? (
            <button type="button" className={buttonClassName('quiet', 'sm')} onClick={polling.resume}>
              {runCopy.pollRetry}
            </button>
          ) : null}
        </div>
      )}
      {run === null ? null : (
        <details
          open={active}
          className="min-w-0 rounded-control border-hairline border-border-subtle bg-surface-subtle p-3"
        >
          <summary className="focus-studio min-h-touch cursor-pointer content-center text-text-link underline decoration-border-strong underline-offset-4">
            Detalles del progreso de generación
          </summary>
          <div className="mt-3 min-w-0 overflow-x-auto">
            <RunProgress run={run} />
          </div>
        </details>
      )}
    </section>
  );
}

function ProjectSections({ project }: { project: Project }) {
  const run = project.latestRun;
  return (
    <details className="rounded-card border-hairline border-border-subtle bg-surface-raised p-4">
      <summary className="focus-studio min-h-touch cursor-pointer content-center font-bold text-text-link underline decoration-border-strong underline-offset-4">
        Más opciones del proyecto
      </summary>
      <nav className="mt-3" aria-label={detailCopy.sectionsNav}>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          <li>
            {run === null ? (
              <span>{detailCopy.factsUnavailable}</span>
            ) : (
              <Link
                className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
                to={featurePaths.facts(project.id, run.id)}
              >
                {detailCopy.facts(run.runNumber)}
              </Link>
            )}
          </li>
          {project.dataMode === 'MANUAL_DATA' ? (
            <li>
              <Link
                className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
                to={featurePaths.imports}
              >
                {detailCopy.imports}
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </details>
  );
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { api } = useProjectsDependencies();
  const location = useLocation();
  const creationGenerationFailed =
    typeof location.state === 'object' &&
    location.state !== null &&
    'creationGenerationFailed' in location.state &&
    location.state.creationGenerationFailed === true;
  const request = useApiRequest(
    projectId,
    useCallback((signal: AbortSignal) => api.getProject(projectId, signal), [api, projectId]),
  );
  const { replace } = request;

  const refresh = useCallback(() => {
    // Background refresh after a run ends (approval state, active draft, latest run). A failure keeps the shown
    // project; the run itself is already up to date.
    api.getProject(projectId).then(replace, () => undefined);
  }, [api, projectId, replace]);

  const state = request.state;
  if (state.status !== 'success') {
    return (
      <section aria-labelledby="project-title" className="grid gap-4">
        <h1 id="project-title" className="m-0 font-display text-heading-lg font-extrabold">
          {featureCopy.projects}
        </h1>
        {state.status === 'error' ? (
          <ErrorBanner title={detailCopy.loadError} error={state.error} onRetry={request.reload} />
        ) : (
          <p role="status">{detailCopy.loading}</p>
        )}
        <p>
          <Link className="focus-studio text-text-link underline decoration-border-strong underline-offset-4" to="/">
            {detailCopy.backToList}
          </Link>
        </p>
      </section>
    );
  }

  const project = state.data;
  // A refreshed project with a newer latest run than the one shown would be rare (another tab); the latest run is
  // taken from the project only on first display.
  return (
    <article aria-labelledby="project-selection-title" className="grid min-w-0 gap-4">
      <SelectionSummary project={project} />
      <ProjectGeneratedContent project={project} />
      <ProjectSections project={project} />
      <details
        open={project.activeDraftId === null ? true : undefined}
        className="rounded-card border-hairline border-border-subtle bg-surface-raised p-4"
      >
        <summary className="focus-studio min-h-touch cursor-pointer content-center font-bold text-text-link underline decoration-border-strong underline-offset-4">
          Generación y progreso
        </summary>
        <div className="mt-3">
          <RunSection project={project} onRunFinished={refresh} creationGenerationFailed={creationGenerationFailed} />
        </div>
      </details>
      <details className="rounded-card border-hairline border-border-subtle bg-surface-raised p-4">
        <summary className="focus-studio min-h-touch cursor-pointer content-center font-bold text-text-link underline decoration-border-strong underline-offset-4">
          Idioma y ajustes del proyecto
        </summary>
        <div className="mt-3">
          <LanguageSection project={project} onUpdated={replace} />
        </div>
      </details>
    </article>
  );
}

/**
 * Project detail (R-200, R-203, R-236, R-269): competition, source and data mode, season, stage and matchday,
 * demonstration banner, language change, runs with per-stage status and restart, and links to facts, review,
 * exports and, for MANUAL_DATA, the import page. The active run is polled until it ends.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams();
  if (!isProjectId(projectId)) {
    return <ProjectNotFound />;
  }
  return <ProjectDetail key={projectId} projectId={projectId} />;
}
