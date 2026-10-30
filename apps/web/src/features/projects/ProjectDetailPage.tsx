import type { Language, Project, RunKind } from '@edr/contracts';
import { useCallback, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { featurePaths } from '../../app/routes';
import { DataModeBadge, DemoBanner, ErrorBanner, featureCopy, formatDateTime } from '../../ui';
import { approvalStateLabel, createCopy, detailCopy, languageLabel, runCopy } from './copy';
import { isProjectId } from './paths';
import styles from './Projects.module.css';
import { useProjectsDependencies } from './ProjectsContext';
import { isRunActive, RunProgress, runSummary } from './RunProgress';
import { LanguageField } from './SelectionFields';
import { useApiRequest } from './useApiRequest';
import { useRunPolling } from './useRunPolling';

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
  return (
    <section aria-labelledby="project-selection-title">
      <h2 id="project-selection-title">{detailCopy.selectionTitle}</h2>
      <dl className={styles.details}>
        <dt>{detailCopy.competition}</dt>
        <dd>{project.competitionName}</dd>
        <dt>{detailCopy.season}</dt>
        <dd>{project.seasonLabel}</dd>
        <dt>{detailCopy.stage}</dt>
        <dd>{project.stageLabel}</dd>
        <dt>{detailCopy.matchday}</dt>
        <dd>{project.matchday === null ? detailCopy.wholeStage : createCopy.matchday(project.matchday)}</dd>
        <dt>{detailCopy.source}</dt>
        <dd>{project.sourceName}</dd>
        <dt>{detailCopy.dataMode}</dt>
        <dd>
          <DataModeBadge mode={project.dataMode} />
        </dd>
        <dt>{detailCopy.createdAt}</dt>
        <dd>
          <time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time>
        </dd>
        <dt>{detailCopy.approval}</dt>
        <dd>{approvalStateLabel[project.approvalState]}</dd>
        <dt>{detailCopy.lastExport}</dt>
        <dd>
          {project.lastExportAt === null ? (
            detailCopy.neverExported
          ) : (
            <time dateTime={project.lastExportAt}>{formatDateTime(project.lastExportAt)}</time>
          )}
        </dd>
      </dl>
      {project.dataMode === 'MANUAL_DATA' ? <p className={styles.note}>{detailCopy.manualNote}</p> : null}
    </section>
  );
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
    <section aria-labelledby="project-run-title">
      <h2 id="project-run-title">{runCopy.title}</h2>
      {creationGenerationFailed ? (
        <p role="alert" className={styles.note}>
          El proyecto quedó guardado, pero no se pudo iniciar la generación. Puedes volver a intentarlo aquí.
        </p>
      ) : null}
      <p role="status" className={styles.runSummary}>
        {run === null ? runCopy.none : runSummary(run)}
        {starting === null ? '' : ` ${runCopy.starting}`}
      </p>
      {run !== null && run.status === 'failed' ? (
        <p className={styles.note}>
          <span aria-hidden="true">✕ </span>
          {runCopy.restartHint}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} disabled={disabled} onClick={() => void start('full')}>
          {run !== null && run.status === 'failed' ? runCopy.restartFull : runCopy.startFull}
        </button>
        {run === null ? null : (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={disabled}
            onClick={() => void start('redraft')}
          >
            {runCopy.startRedraft}
          </button>
        )}
      </div>
      <p className={styles.hint}>{active ? runCopy.activeHint : runCopy.fullHint}</p>
      {run === null || active ? null : <p className={styles.hint}>{runCopy.redraftHint}</p>}
      {startError === null ? null : (
        <ErrorBanner title={runCopy.startError} error={startError.error} onRetry={() => void start(startError.kind)} />
      )}
      {polling.pollError === null ? null : (
        <div>
          <ErrorBanner title={runCopy.pollError} error={polling.pollError} />
          {polling.stopped ? (
            <button type="button" className={styles.secondaryButton} onClick={polling.resume}>
              {runCopy.pollRetry}
            </button>
          ) : null}
        </div>
      )}
      {run === null ? null : <RunProgress run={run} />}
    </section>
  );
}

function ProjectSections({ project }: { project: Project }) {
  const run = project.latestRun;
  return (
    <nav aria-label={detailCopy.sectionsNav}>
      <ul className={styles.sectionLinks}>
        <li>
          {run === null ? (
            <span>{detailCopy.factsUnavailable}</span>
          ) : (
            <Link to={featurePaths.facts(project.id, run.id)}>{detailCopy.facts(run.runNumber)}</Link>
          )}
        </li>
        <li>
          <Link to={featurePaths.review(project.id)}>{detailCopy.review}</Link>
        </li>
        <li>
          <Link to={featurePaths.history(project.id)}>{detailCopy.exports}</Link>
        </li>
        {project.dataMode === 'MANUAL_DATA' ? (
          <li>
            <Link to={featurePaths.imports}>{detailCopy.imports}</Link>
          </li>
        ) : null}
      </ul>
    </nav>
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
      <section aria-labelledby="project-title">
        <h1 id="project-title">{featureCopy.projects}</h1>
        {state.status === 'error' ? (
          <ErrorBanner title={detailCopy.loadError} error={state.error} onRetry={request.reload} />
        ) : (
          <p role="status">{detailCopy.loading}</p>
        )}
        <p>
          <Link to="/">{detailCopy.backToList}</Link>
        </p>
      </section>
    );
  }

  const project = state.data;
  // A refreshed project with a newer latest run than the one shown would be rare (another tab); the latest run is
  // taken from the project only on first display.
  return (
    <article aria-labelledby="project-title" className={styles.detail}>
      <p>
        <Link to="/">{detailCopy.backToList}</Link>
      </p>
      <h1 id="project-title">{project.title}</h1>
      {project.demonstration || project.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      <SelectionSummary project={project} />
      <ProjectSections project={project} />
      <LanguageSection project={project} onUpdated={replace} />
      <RunSection project={project} onRunFinished={refresh} creationGenerationFailed={creationGenerationFailed} />
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
