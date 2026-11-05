/**
 * Content generation from a locally managed competition (PD-ARCH-01E-A). A four-step wizard: sports context, content
 * type, matches, and a review of the plan the server computes from the local data, with the compatible templates and
 * the reason of every skipped piece. Nothing is generated until the operator confirms; the confirmation carries one
 * request key, so a double click or a retry returns the same batch. Going back keeps every choice.
 */
import type { CompetitionMatch, CompetitionRound, ContentBatchSelection, ContentPieceKind } from '@edr/contracts';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Alert, Badge, Button, Card, ErrorBanner, LoadingState, Select, formatDateTime } from '../../ui';
import { generationSteps, matchStatusCopy, pieceKindCopy, scoreText, skipReasonCopy } from './generationCopy';
import { contentBatchPath } from './paths';
import { useProjectsDependencies } from './ProjectsContext';
import { useApiRequest } from './useApiRequest';

const ALL_STAGES = '';
const NO_STAGE = 'none';
const KINDS: readonly ContentPieceKind[] = ['round_results', 'match_result'];

/** Whether the local values can show the match as a result (the server's preview is authoritative). */
function looksLikeResult(match: CompetitionMatch): boolean {
  return (
    match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && match.kickoffAt !== null
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol aria-label="Pasos de la generación" className="m-0 flex list-none flex-wrap gap-2 p-0">
      {generationSteps.map((label, index) => {
        const current = index + 1 === step;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`rounded-control border-hairline px-3 py-1.5 text-body-sm ${
              current
                ? 'border-brand-gold bg-surface-raised font-bold text-text-primary'
                : index + 1 < step
                  ? 'border-border-subtle text-text-secondary'
                  : 'border-border-subtle text-text-muted'
            }`}
          >
            {index + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function roundLabel(round: CompetitionRound, stageNames: ReadonlyMap<string, string>, matches: number): string {
  const stage = round.stageId === null ? null : (stageNames.get(round.stageId) ?? null);
  const name = stage === null ? round.name : `${stage} · ${round.name}`;
  return matches === 0 ? `${name} (sin partidos)` : `${name} (${String(matches)} partidos)`;
}

export function GenerateContentPage() {
  const { api } = useProjectsDependencies();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [competitionId, setCompetitionId] = useState(params.get('competitionId') ?? '');
  const [seasonId, setSeasonId] = useState(params.get('seasonId') ?? '');
  const [stageFilter, setStageFilter] = useState(ALL_STAGES);
  const [roundId, setRoundId] = useState(params.get('roundId') ?? '');
  const [kinds, setKinds] = useState<ReadonlySet<ContentPieceKind>>(new Set(['round_results']));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [requestKey, setRequestKey] = useState<{ signature: string; key: string } | null>(null);

  const competitions = useApiRequest(
    'local-competitions',
    useCallback((signal: AbortSignal) => api.listLocalCompetitions(signal), [api]),
  );
  const seasons = useApiRequest(
    competitionId === '' ? null : `seasons:${competitionId}`,
    useCallback((signal: AbortSignal) => api.listLocalSeasons(competitionId, signal), [api, competitionId]),
  );
  const calendar = useApiRequest(
    competitionId === '' || seasonId === '' ? null : `calendar:${competitionId}:${seasonId}`,
    useCallback(
      async (signal: AbortSignal) => {
        const [stages, rounds, matches] = await Promise.all([
          api.listLocalStages(competitionId, seasonId, signal),
          api.listLocalRounds(competitionId, seasonId, signal),
          api.listLocalMatches(competitionId, seasonId, signal),
        ]);
        return { stages, rounds, matches };
      },
      [api, competitionId, seasonId],
    ),
  );

  const stageNames = useMemo(
    () =>
      new Map(
        calendar.state.status === 'success' ? calendar.state.data.stages.map((stage) => [stage.id, stage.name]) : [],
      ),
    [calendar.state],
  );
  const rounds = calendar.state.status === 'success' ? calendar.state.data.rounds : [];
  const visibleRounds = rounds
    .filter((round) =>
      stageFilter === ALL_STAGES
        ? true
        : stageFilter === NO_STAGE
          ? round.stageId === null
          : round.stageId === stageFilter,
    )
    .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));
  const round = rounds.find((candidate) => candidate.id === roundId) ?? null;
  const roundMatches =
    calendar.state.status === 'success' && round !== null
      ? calendar.state.data.matches.filter((match) => match.round?.id === round.id)
      : [];
  const matchesPerRound = (id: string): number =>
    calendar.state.status === 'success'
      ? calendar.state.data.matches.filter((match) => match.round?.id === id).length
      : 0;

  const selection: ContentBatchSelection | null =
    round === null || selected.size === 0 || kinds.size === 0
      ? null
      : {
          competitionId,
          seasonId,
          stageId: round.stageId,
          roundId: round.id,
          matchIds: roundMatches.filter((match) => selected.has(match.id)).map((match) => match.id),
          kinds: KINDS.filter((kind) => kinds.has(kind)),
        };
  const signature = selection === null ? null : JSON.stringify(selection);
  const preview = useApiRequest(
    step === 4 && signature !== null ? `preview:${signature}` : null,
    useCallback(
      (signal: AbortSignal) => {
        if (selection === null) {
          throw new Error('no selection to preview');
        }
        return api.previewContentBatch(selection, signal);
      },
      // `selection` is encoded in `signature`.
      [api, signature],
    ),
  );

  function chooseCompetition(value: string) {
    setCompetitionId(value);
    setSeasonId('');
    setStageFilter(ALL_STAGES);
    setRoundId('');
    setSelected(new Set());
  }

  function chooseSeason(value: string) {
    setSeasonId(value);
    setStageFilter(ALL_STAGES);
    setRoundId('');
    setSelected(new Set());
  }

  function chooseRound(value: string) {
    setRoundId(value);
    setSelected(new Set());
  }

  function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }

  async function confirm() {
    if (selection === null || signature === null || submitting) {
      return;
    }
    // One request key per confirmed selection: a retry or a second click returns the same batch.
    const key = requestKey?.signature === signature ? requestKey.key : crypto.randomUUID();
    setRequestKey({ signature, key });
    setSubmitting(true);
    setSubmitError(null);
    try {
      const batch = await api.createContentBatch({ requestKey: key, selection });
      void navigate(contentBatchPath(batch.id));
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  }

  const canContinue =
    (step === 1 && round !== null && roundMatches.length > 0) ||
    (step === 2 && kinds.size > 0) ||
    (step === 3 && selected.size > 0);
  const ready = preview.state.status === 'success' ? preview.state.data.totals.ready : 0;

  return (
    <section aria-labelledby="generate-title" className="grid min-w-0 gap-6">
      <div className="grid gap-3">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Competiciones locales</p>
        <h1 id="generate-title" className="m-0 font-display text-heading-md font-extrabold tracking-display">
          Generar contenido desde una competición
        </h1>
        <p className="m-0 max-w-reading text-body-md text-text-secondary">
          Usa los datos guardados en el estudio, incluidas tus correcciones manuales. No se consulta ningún proveedor
          externo y nada se genera hasta que confirmes.
        </p>
        <StepIndicator step={step} />
      </div>

      {step === 1 ? (
        <Card as="section" aria-labelledby="step-context-title" className="grid gap-4">
          <h2 id="step-context-title" className="m-0 text-heading-sm font-bold">
            1. Contexto deportivo
          </h2>
          {competitions.state.status === 'loading' ? <LoadingState label="Cargando competiciones…" /> : null}
          {competitions.state.status === 'error' ? (
            <ErrorBanner error={competitions.state.error} onRetry={competitions.reload} />
          ) : null}
          {competitions.state.status === 'success' && competitions.state.data.length === 0 ? (
            <Alert title="No hay competiciones locales">
              Crea una competición con su calendario en{' '}
              <Link to="/competitions" className="text-text-link underline">
                Competiciones
              </Link>
              .
            </Alert>
          ) : null}
          {competitions.state.status === 'success' && competitions.state.data.length > 0 ? (
            <Select
              id="generate-competition"
              label="Competición"
              value={competitionId}
              onChange={(event) => chooseCompetition(event.target.value)}
            >
              <option value="">Selecciona una competición</option>
              {competitions.state.data.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </Select>
          ) : null}
          {seasons.state.status === 'loading' ? <LoadingState label="Cargando temporadas…" /> : null}
          {seasons.state.status === 'error' ? (
            <ErrorBanner error={seasons.state.error} onRetry={seasons.reload} />
          ) : null}
          {seasons.state.status === 'success' ? (
            <Select
              id="generate-season"
              label="Temporada"
              value={seasonId}
              onChange={(event) => chooseSeason(event.target.value)}
            >
              <option value="">Selecciona una temporada</option>
              {seasons.state.data.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </Select>
          ) : null}
          {calendar.state.status === 'loading' ? <LoadingState label="Cargando calendario…" /> : null}
          {calendar.state.status === 'error' ? (
            <ErrorBanner error={calendar.state.error} onRetry={calendar.reload} />
          ) : null}
          {calendar.state.status === 'success' ? (
            <>
              {calendar.state.data.stages.length > 0 ? (
                <Select
                  id="generate-stage"
                  label="Fase"
                  description="Filtra las jornadas por fase."
                  value={stageFilter}
                  onChange={(event) => {
                    setStageFilter(event.target.value);
                    setRoundId('');
                    setSelected(new Set());
                  }}
                >
                  <option value={ALL_STAGES}>Todas las fases</option>
                  <option value={NO_STAGE}>Jornadas sin fase</option>
                  {calendar.state.data.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {visibleRounds.length === 0 ? (
                <Alert title="Sin jornadas">Esta temporada no tiene jornadas en el contexto elegido.</Alert>
              ) : (
                <Select
                  id="generate-round"
                  label="Jornada"
                  value={roundId}
                  onChange={(event) => chooseRound(event.target.value)}
                >
                  <option value="">Selecciona una jornada</option>
                  {visibleRounds.map((candidate) => (
                    <option key={candidate.id} value={candidate.id} disabled={matchesPerRound(candidate.id) === 0}>
                      {roundLabel(candidate, stageNames, matchesPerRound(candidate.id))}
                    </option>
                  ))}
                </Select>
              )}
            </>
          ) : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card as="section" aria-labelledby="step-kind-title" className="grid gap-4">
          <h2 id="step-kind-title" className="m-0 text-heading-sm font-bold">
            2. Tipo de contenido
          </h2>
          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="mb-2 text-body-sm font-bold text-text-primary">Piezas a preparar</legend>
            {KINDS.map((kind) => (
              <label
                key={kind}
                className="flex min-h-touch items-start gap-3 rounded-xl border border-border-subtle px-3 py-2 text-text-primary"
              >
                <input type="checkbox" checked={kinds.has(kind)} onChange={() => setKinds(toggle(kinds, kind))} />
                <span>
                  <strong>{pieceKindCopy[kind].label}</strong>
                  <small className="block text-text-secondary">{pieceKindCopy[kind].description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="m-0 text-body-sm text-text-secondary">
            Ambos tipos usan el carrusel de resultados existente. El calendario de jornada, los próximos partidos y la
            previa individual requieren una ampliación del motor de plantillas (PD-ARCH-01E-B).
          </p>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card as="section" aria-labelledby="step-matches-title" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="step-matches-title" className="m-0 text-heading-sm font-bold">
              3. Partidos de {round?.name}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelected(new Set(roundMatches.map((match) => match.id)))}
              >
                Seleccionar todos
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
                Quitar selección
              </Button>
            </div>
          </div>
          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="sr-only">Partidos de la jornada</legend>
            {roundMatches.map((match) => (
              <label
                key={match.id}
                className="flex min-h-touch flex-wrap items-center gap-3 rounded-xl border border-border-subtle px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(match.id)}
                  onChange={() => setSelected(toggle(selected, match.id))}
                />
                <span className="min-w-0 flex-1">
                  <strong>
                    {match.homeTeam.name} – {match.awayTeam.name}
                  </strong>
                  <small className="block text-text-secondary">
                    {match.kickoffAt === null ? 'Sin fecha' : formatDateTime(match.kickoffAt)} ·{' '}
                    {matchStatusCopy[match.status]} · {scoreText(match.homeScore, match.awayScore)}
                  </small>
                </span>
                {looksLikeResult(match) ? (
                  <Badge tone="success">Resultado final</Badge>
                ) : (
                  <Badge tone="warning">Sin resultado final</Badge>
                )}
              </label>
            ))}
          </fieldset>
          <p className="m-0 text-body-sm text-text-secondary" aria-live="polite">
            {selected.size} de {roundMatches.length} partidos seleccionados.
          </p>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card as="section" aria-labelledby="step-review-title" className="grid gap-5">
          <h2 id="step-review-title" className="m-0 text-heading-sm font-bold">
            4. Revisión de la generación propuesta
          </h2>
          {preview.state.status === 'loading' ? <LoadingState label="Calculando la propuesta…" /> : null}
          {preview.state.status === 'error' ? (
            <ErrorBanner error={preview.state.error} onRetry={preview.reload} />
          ) : null}
          {preview.state.status === 'success' ? (
            <>
              <dl className="m-0 grid gap-2 text-body-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold">Competición</dt>
                  <dd className="m-0 text-text-secondary">{preview.state.data.context.competitionName}</dd>
                </div>
                <div>
                  <dt className="font-bold">Temporada</dt>
                  <dd className="m-0 text-text-secondary">{preview.state.data.context.seasonLabel}</dd>
                </div>
                <div>
                  <dt className="font-bold">Fase</dt>
                  <dd className="m-0 text-text-secondary">{preview.state.data.context.stageName ?? 'Sin fase'}</dd>
                </div>
                <div>
                  <dt className="font-bold">Jornada</dt>
                  <dd className="m-0 text-text-secondary">{preview.state.data.context.roundName}</dd>
                </div>
              </dl>
              <section aria-labelledby="review-templates-title" className="grid gap-2">
                <h3 id="review-templates-title" className="m-0 text-body-lg font-bold">
                  Plantillas compatibles
                </h3>
                <p className="m-0 text-body-sm text-text-secondary">
                  Cada diapositiva usa la versión vigente de su plantilla; los datos que faltan no se completan.
                </p>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {preview.state.data.templates.map((template) => (
                    <li key={`${template.id}@${template.version}`}>
                      <Badge>
                        {template.label} · v{template.version}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="review-pieces-title" className="grid gap-2">
                <h3 id="review-pieces-title" className="m-0 text-body-lg font-bold">
                  Piezas
                </h3>
                <p className="m-0 text-body-md" data-testid="preview-totals">
                  Se prepararán {preview.state.data.totals.ready} de {preview.state.data.totals.requested} piezas
                  solicitadas · {preview.state.data.totals.skipped} omitidas.
                </p>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {preview.state.data.pieces.map((piece) => (
                    <li
                      key={piece.position}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-subtle px-3 py-2"
                    >
                      <span className="min-w-0">
                        <strong>{piece.title}</strong>
                        <small className="block text-text-secondary">
                          {pieceKindCopy[piece.kind].label} · {piece.matchIds.length}{' '}
                          {piece.matchIds.length === 1 ? 'partido' : 'partidos'}
                        </small>
                        {piece.skipReason === null ? null : (
                          <small className="block text-warning">{skipReasonCopy[piece.skipReason]}</small>
                        )}
                      </span>
                      <Badge tone={piece.status === 'ready' ? 'success' : 'neutral'}>
                        {piece.status === 'ready' ? 'Se generará' : 'Omitida'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
              {ready === 0 ? (
                <Alert tone="warning" title="Nada que generar">
                  Ninguna pieza de esta selección puede generarse con los datos locales.
                </Alert>
              ) : null}
            </>
          ) : null}
          {submitError === null ? null : <ErrorBanner error={submitError} />}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <Button variant="secondary" disabled={submitting} onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        ) : null}
        {step < 4 ? (
          <Button disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button
            disabled={ready === 0 || submitting || preview.state.status !== 'success'}
            isLoading={submitting}
            loadingLabel="Preparando contenidos"
            onClick={() => void confirm()}
          >
            Confirmar y generar {ready} {ready === 1 ? 'pieza' : 'piezas'}
          </Button>
        )}
      </div>
    </section>
  );
}
