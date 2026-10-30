import type { CatalogueCompetition, CompetitionSource, DataMode, Stage } from '@edr/contracts';
import { useCallback, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { ErrorBanner } from '../../ui';
import { createCopy, languageLabel } from './copy';
import { projectPath } from './paths';
import styles from './Projects.module.css';
import { useProjectsDependencies } from './ProjectsContext';
import {
  CatalogueSources,
  CompetitionField,
  LanguageField,
  MatchdayField,
  SeasonField,
  StageField,
} from './SelectionFields';
import {
  EMPTY_SELECTION,
  firstAvailableSource,
  initialMatchday,
  missingItems,
  selectableSources,
  toProjectCreate,
  type SelectionState,
} from './selection';
import { useApiRequest } from './useApiRequest';

const modeOptions: Record<DataMode, { label: string; description: string }> = {
  LIVE_DATA: { label: createCopy.modeAutomatic, description: createCopy.modeAutomaticDescription },
  MANUAL_DATA: { label: createCopy.modeManual, description: createCopy.modeManualDescription },
  DEMO_DATA: { label: createCopy.modeDemo, description: createCopy.modeDemoDescription },
};

/** Two real preparation steps: define the supported carousel scope, then confirm data mode and readiness. */
export function CreateProjectPage() {
  const { api } = useProjectsDependencies();
  const navigate = useNavigate();
  const statusId = useId();
  const modeId = useId();
  const [step, setStep] = useState<1 | 2>(1);
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
  const modeSources =
    competition === null ? [] : selectableSources(competition).filter((candidate) => candidate.availability.available);
  const modes = [...new Set(modeSources.map((candidate) => candidate.mode))];

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

  function chooseMode(mode: DataMode) {
    if (competition === null || source?.mode === mode) return;
    const next = modeSources.find((candidate) => candidate.mode === mode);
    if (next) chooseSource(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body === null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await api.createProject(body);
      try {
        await api.startRun(project.id, { kind: 'full' });
        navigate(projectPath(project.id));
      } catch {
        // The project is durable; open its existing run controls for a safe retry.
        navigate(projectPath(project.id), { state: { creationGenerationFailed: true } });
      }
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  }

  const canContinue = body !== null;
  const selectedSeason = seasonList?.seasons.find((candidate) => candidate.id === selection.seasonId) ?? null;
  const selectedMatchday =
    selection.matchday === 'whole'
      ? 'Fase completa'
      : typeof selection.matchday === 'number'
        ? `Jornada ${selection.matchday}`
        : null;

  return (
    <section aria-labelledby="create-project-title" className={styles.guided}>
      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>ESTUDIO CREATIVO · CARRUSEL</p>
        <h1 id="create-project-title">{createCopy.title}</h1>
        <p>{createCopy.intro}</p>
      </div>

      <nav aria-label="Progreso de creación" className={styles.progress}>
        <ol>
          {[createCopy.stepDefinition, createCopy.stepConfirmation].map((label, index) => {
            const number = (index + 1) as 1 | 2;
            const current = number === step;
            const complete = number < step;
            return (
              <li
                key={label}
                aria-current={current ? 'step' : undefined}
                className={current ? styles.currentStep : complete ? styles.completeStep : undefined}
              >
                <span aria-hidden="true">{complete ? '✓' : number}</span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {createCopy.stepProgress(step)}
        </p>
      </nav>

      {catalogue.state.status === 'loading' ? <p role="status">{createCopy.catalogueLoading}</p> : null}
      {catalogue.state.status === 'error' ? (
        <ErrorBanner title={createCopy.catalogueError} error={catalogue.state.error} onRetry={catalogue.reload} />
      ) : null}

      {catalogue.state.status === 'success' ? (
        <>
          <details className={styles.sourceDetails}>
            <summary>{createCopy.availabilityDetails}</summary>
            <CatalogueSources sources={catalogue.state.data.sources} />
          </details>

          {step === 1 ? (
            <div className={styles.stepPanel}>
              <div className={styles.formatCard}>
                <span className={styles.formatIcon} aria-hidden="true">
                  ▤
                </span>
                <div>
                  <p className={styles.eyebrow}>{createCopy.formatTitle}</p>
                  <h2>{createCopy.formatCarousel}</h2>
                  <p>{createCopy.formatDescription}</p>
                </div>
                <span className={styles.availableBadge}>Disponible</span>
              </div>

              <form
                className={styles.guidedForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep(2);
                }}
                noValidate
              >
                <CompetitionField catalogue={catalogue.state.data} value={competitionId} onChange={chooseCompetition} />
                {competition === null ? null : (
                  <div className={styles.selectionGrid}>
                    <div className={styles.selectionFields}>
                      {source === null ? (
                        <p role="status">Esta competición no tiene una fuente disponible para continuar.</p>
                      ) : null}
                      {seasons.state.status === 'loading' ? <p role="status">{createCopy.seasonsLoading}</p> : null}
                      {seasons.state.status === 'error' ? (
                        <ErrorBanner
                          title={createCopy.seasonsError}
                          error={seasons.state.error}
                          onRetry={seasons.reload}
                        />
                      ) : null}
                      {seasonList === null ? null : (
                        <SeasonField seasonList={seasonList} value={seasonId} onChange={chooseSeason} />
                      )}
                      {seasonList !== null && seasonId !== null && stages.state.status === 'loading' ? (
                        <p role="status">{createCopy.stagesLoading}</p>
                      ) : null}
                      {stages.state.status === 'error' ? (
                        <ErrorBanner
                          title={createCopy.stagesError}
                          error={stages.state.error}
                          onRetry={stages.reload}
                        />
                      ) : null}
                      {stageList === null ? null : (
                        <StageField stageList={stageList} value={selection.stageId} onChange={chooseStage} />
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
                    </div>
                    <aside className={styles.scopeSummary} aria-label="Resumen de selección">
                      <h2>{createCopy.summaryTitle}</h2>
                      <dl>
                        <dt>Competición</dt>
                        <dd>{competition.name}</dd>
                        <dt>Temporada</dt>
                        <dd>{selectedSeason?.label ?? 'Selecciona una temporada'}</dd>
                        <dt>Fase</dt>
                        <dd>{stage?.name ?? 'Selecciona una fase'}</dd>
                        <dt>Periodo</dt>
                        <dd>{selectedMatchday ?? (stage ? 'Selecciona una jornada' : '—')}</dd>
                        <dt>Idioma</dt>
                        <dd>{languageLabel[selection.language]}</dd>
                      </dl>
                    </aside>
                  </div>
                )}
                <p id={statusId} className={styles.hint} role="status">
                  {missing.length === 0
                    ? createCopy.ready
                    : createCopy.missing(missing.map((item) => createCopy.missingItems[item]))}
                </p>
                <button
                  type="submit"
                  className={styles.continueButton}
                  disabled={!canContinue}
                  aria-describedby={statusId}
                >
                  {createCopy.continue}
                  <span aria-hidden="true"> →</span>
                </button>
              </form>
            </div>
          ) : (
            <form className={styles.guidedForm} onSubmit={submit} noValidate>
              <div className={styles.confirmGrid}>
                <section className={styles.confirmCard} aria-labelledby="confirmed-scope-title">
                  <p className={styles.eyebrow}>ALCANCE</p>
                  <h2 id="confirmed-scope-title">{createCopy.summaryTitle}</h2>
                  <dl>
                    <dt>Formato</dt>
                    <dd>{createCopy.formatCarousel}</dd>
                    <dt>Competición</dt>
                    <dd>{competition?.name ?? '—'}</dd>
                    <dt>Temporada</dt>
                    <dd>{selectedSeason?.label ?? '—'}</dd>
                    <dt>Fase</dt>
                    <dd>{stage?.name ?? '—'}</dd>
                    <dt>Jornada</dt>
                    <dd>{selectedMatchday ?? '—'}</dd>
                    <dt>Idioma</dt>
                    <dd>{languageLabel[selection.language]}</dd>
                  </dl>
                </section>
                <section className={styles.confirmCard} aria-labelledby="data-mode-title">
                  <p className={styles.eyebrow}>DATOS DEPORTIVOS</p>
                  <h2 id="data-mode-title">{createCopy.modeTitle}</h2>
                  <fieldset className={styles.modeChoices}>
                    <legend className={styles.srOnly}>{createCopy.modeTitle}</legend>
                    {modes.map((mode) => {
                      const id = `${modeId}-${mode.toLowerCase()}`;
                      return (
                        <label key={mode} htmlFor={id} className={styles.modeChoice}>
                          <input
                            id={id}
                            type="radio"
                            name="dataMode"
                            value={mode}
                            checked={source?.mode === mode}
                            onChange={() => chooseMode(mode)}
                          />
                          <span>
                            <strong>{modeOptions[mode].label}</strong>
                            <small>{modeOptions[mode].description}</small>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <div className={styles.importEntry}>
                    <p>{createCopy.importHint}</p>
                    <Link to="/imports">{createCopy.importEntry}</Link>
                  </div>
                  {source === null ? <p role="alert">No hay una fuente disponible para este modo.</p> : null}
                </section>
              </div>

              <section className={styles.readiness} aria-labelledby="readiness-title">
                <div>
                  <span className={styles.readinessMark} aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <h2 id="readiness-title">{createCopy.dataConfigured}</h2>
                    <p>
                      {competition?.name} · {selectedSeason?.label} · {stage?.name}
                      {selectedMatchday ? ` · ${selectedMatchday}` : ''}
                    </p>
                  </div>
                </div>
                <p>
                  {stage?.standings === 'not_expected'
                    ? createCopy.standingsMissing
                    : stage?.standings === 'unknown'
                      ? 'La disponibilidad de la tabla no está indicada para esta fase.'
                      : stage?.standings === 'expected'
                        ? 'La fase contempla tabla de posiciones.'
                        : ''}
                </p>
                <p>{createCopy.matchesNotLoaded}</p>
                {source === null ? <p role="alert">{createCopy.sourceChanged}</p> : null}
                {seasons.state.status === 'loading' || stages.state.status === 'loading' ? (
                  <p role="status">Actualizando disponibilidad para la fuente seleccionada…</p>
                ) : null}
              </section>
              <p className={styles.nextStep}>{createCopy.nextStep}</p>
              {submitError === null ? null : <ErrorBanner title={createCopy.createError} error={submitError} />}
              {body === null ? (
                <p className={styles.note} role="alert">
                  {createCopy.sourceChanged}
                </p>
              ) : null}
              <div className={styles.actions}>
                <button type="button" className={styles.backButton} onClick={() => setStep(1)}>
                  {createCopy.back}
                </button>
                <button
                  type="submit"
                  className={styles.continueButton}
                  disabled={body === null || submitting}
                  aria-describedby={statusId}
                >
                  {submitting ? createCopy.submitting : createCopy.submit}
                </button>
              </div>
              <p id={statusId} className={styles.srOnly} role="status" aria-live="polite">
                {body === null
                  ? 'Completa de nuevo la selección antes de crear.'
                  : 'La selección está lista para crear el carrusel.'}
              </p>
            </form>
          )}
        </>
      ) : null}
    </section>
  );
}
