import type { CatalogueCompetition, CompetitionSource, Stage } from '@edr/contracts';
import { useCallback, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ErrorBanner } from '../../ui';
import { createCopy } from './copy';
import { projectPath } from './paths';
import styles from './Projects.module.css';
import { useProjectsDependencies } from './ProjectsContext';
import {
  CatalogueSources,
  CompetitionField,
  LanguageField,
  MatchdayField,
  SeasonField,
  SourceField,
  StageField,
} from './SelectionFields';
import {
  EMPTY_SELECTION,
  firstAvailableSource,
  initialMatchday,
  missingItems,
  toProjectCreate,
  type SelectionState,
} from './selection';
import { useApiRequest } from './useApiRequest';

/**
 * Create form (R-243, R-077): competition from the catalogue, data source (first available preselected, OD-16),
 * season loaded on source choice, stage by the source's names with its matchdays or the whole stage, and the content
 * language (Spanish by default). Submit stays disabled until the selection is complete.
 */
export function CreateProjectPage() {
  const { api } = useProjectsDependencies();
  const navigate = useNavigate();
  const statusId = useId();
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const catalogue = useApiRequest(
    'catalogue',
    useCallback((signal: AbortSignal) => api.listCompetitions(signal), [api]),
  );

  const { competitionId, sourceId, seasonId } = selection;
  const seasons = useApiRequest(
    competitionId !== null && sourceId !== null ? JSON.stringify([competitionId, sourceId]) : null,
    (signal) => api.listSeasons(competitionId ?? '', sourceId ?? '', signal),
  );
  const stages = useApiRequest(
    competitionId !== null && sourceId !== null && seasonId !== null
      ? JSON.stringify([competitionId, sourceId, seasonId])
      : null,
    (signal) => api.listStages(competitionId ?? '', sourceId ?? '', seasonId ?? '', signal),
  );

  const competition =
    catalogue.state.status === 'success'
      ? (catalogue.state.data.competitions.find((candidate) => candidate.id === competitionId) ?? null)
      : null;
  const source = competition?.sources.find((candidate) => candidate.sourceId === sourceId) ?? null;
  const seasonList = seasons.state.status === 'success' ? seasons.state.data : null;
  const stageList = stages.state.status === 'success' ? stages.state.data : null;
  const stage =
    stageList !== null && stageList.availability.available
      ? (stageList.stages.find((candidate) => candidate.id === selection.stageId) ?? null)
      : null;
  const resolved = { competition, source, seasonList, stageList };
  const missing = missingItems(selection, resolved);
  const body = toProjectCreate(selection, resolved);

  function chooseCompetition(next: CatalogueCompetition) {
    setSubmitError(null);
    setSelection((current) => ({
      ...EMPTY_SELECTION,
      language: current.language,
      competitionId: next.id,
      sourceId: firstAvailableSource(next)?.sourceId ?? null,
    }));
  }

  function chooseSource(next: CompetitionSource) {
    setSubmitError(null);
    setSelection((current) => ({ ...current, sourceId: next.sourceId, seasonId: null, stageId: null, matchday: null }));
  }

  function chooseSeason(next: string | null) {
    setSubmitError(null);
    setSelection((current) => ({ ...current, seasonId: next, stageId: null, matchday: null }));
  }

  function chooseStage(next: Stage) {
    setSubmitError(null);
    setSelection((current) => ({ ...current, stageId: next.id, matchday: initialMatchday(next) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body === null || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await api.createProject(body);
      navigate(projectPath(project.id));
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-project-title">
      <p>
        <Link to="/">{createCopy.backToList}</Link>
      </p>
      <h1 id="create-project-title">{createCopy.title}</h1>
      <p>{createCopy.intro}</p>

      {catalogue.state.status === 'loading' ? <p role="status">{createCopy.catalogueLoading}</p> : null}
      {catalogue.state.status === 'error' ? (
        <ErrorBanner title={createCopy.catalogueError} error={catalogue.state.error} onRetry={catalogue.reload} />
      ) : null}

      {catalogue.state.status === 'success' ? (
        <>
          <CatalogueSources sources={catalogue.state.data.sources} />
          <form className={styles.form} onSubmit={submit} noValidate>
            <CompetitionField catalogue={catalogue.state.data} value={competitionId} onChange={chooseCompetition} />

            {competition === null ? null : (
              <SourceField competition={competition} value={sourceId} onChange={chooseSource} />
            )}

            {competition === null || sourceId === null ? null : (
              <>
                {seasons.state.status === 'loading' ? <p role="status">{createCopy.seasonsLoading}</p> : null}
                {seasons.state.status === 'error' ? (
                  <ErrorBanner title={createCopy.seasonsError} error={seasons.state.error} onRetry={seasons.reload} />
                ) : null}
                {seasonList === null ? null : (
                  <SeasonField seasonList={seasonList} value={seasonId} onChange={chooseSeason} />
                )}
              </>
            )}

            {seasonList === null || seasonId === null ? null : (
              <>
                {stages.state.status === 'loading' ? <p role="status">{createCopy.stagesLoading}</p> : null}
                {stages.state.status === 'error' ? (
                  <ErrorBanner title={createCopy.stagesError} error={stages.state.error} onRetry={stages.reload} />
                ) : null}
                {stageList === null ? null : (
                  <StageField stageList={stageList} value={selection.stageId} onChange={chooseStage} />
                )}
              </>
            )}

            {stage === null ? null : (
              <MatchdayField
                stage={stage}
                value={selection.matchday}
                onChange={(matchday) => setSelection((current) => ({ ...current, matchday }))}
              />
            )}

            <LanguageField
              value={selection.language}
              onChange={(language) => setSelection((current) => ({ ...current, language }))}
            />

            {submitError === null ? null : <ErrorBanner title={createCopy.createError} error={submitError} />}

            <p id={statusId} className={styles.hint}>
              {missing.length === 0
                ? createCopy.ready
                : createCopy.missing(missing.map((item) => createCopy.missingItems[item]))}
            </p>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={body === null || submitting}
              aria-describedby={statusId}
            >
              {submitting ? createCopy.submitting : createCopy.submit}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
