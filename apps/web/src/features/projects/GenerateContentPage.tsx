/**
 * Content generation from a locally managed competition (PD-ARCH-01E-A, PD-ARCH-01E-B, PD-ARCH-01G-D). A five-step
 * wizard: sports context, content type (results of played matches, or the calendar, upcoming matches and previews of
 * matches not played yet), matches, the templates (for each slide type of the carousels, a published 4:5 visual
 * template or the engine template; decision 01G-D-3), and a review of the plan the server computes from the local
 * data, with the templates, the team badges, a preview drawn by the slide engine and the reason of every skipped piece. The match step adapts its compatibility marks to the chosen types. Nothing is generated until the operator confirms; the confirmation carries one
 * request key, so a double click or a retry returns the same batch. Going back keeps every choice.
 */
import type {
  CompetitionMatch,
  CompetitionRound,
  ContentBatchSelection,
  ContentPieceKind,
  VisualTemplate,
  VisualTemplateContentType,
  VisualTemplateUsage,
} from '@edr/contracts';
import { contractRegExp, VisualTemplateContentTypeSchema } from '@edr/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Alert, Badge, Button, Card, ErrorBanner, LoadingState, Select, formatDateTime } from '../../ui';
import { PreviewImage } from '../brand/PreviewImage';
import { TeamBadge } from '../competitions/TeamBadge';
import { templateContentTypeLabel } from '../visual-templates/copy';
import { visualTemplateBackgroundUrl } from './api';
import {
  generationSteps,
  kindGroups,
  matchStatusCopy,
  pieceKindCopy,
  scoreText,
  skipReasonCopy,
} from './generationCopy';
import { contentBatchPath } from './paths';
import { useProjectsDependencies } from './ProjectsContext';
import { useApiRequest } from './useApiRequest';

const UUID = contractRegExp('Uuid');

/** Where the validation of a context received in the address stands (PD-ARCH-01F). */
type PresetStage = 'competition' | 'season' | 'round' | 'done';

interface Preset {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  /** Null when the address names a well-formed context (or none); otherwise why it is ignored. */
  readonly error: string | null;
}

/**
 * The sports context named by the address (`?competitionId=&seasonId=&roundId=`, as linked from a round). Every
 * identifier must be a server UUID and each level needs the previous one; otherwise nothing is preselected.
 */
export function presetOf(params: URLSearchParams): Preset {
  const competitionId = params.get('competitionId') ?? '';
  const seasonId = params.get('seasonId') ?? '';
  const roundId = params.get('roundId') ?? '';
  const named = [competitionId, seasonId, roundId].filter((value) => value !== '');
  const wellFormed =
    named.every((value) => UUID.test(value)) &&
    (seasonId === '' || competitionId !== '') &&
    (roundId === '' || seasonId !== '');
  return wellFormed
    ? { competitionId, seasonId, roundId, error: null }
    : {
        competitionId: '',
        seasonId: '',
        roundId: '',
        error: 'El enlace no contiene una competición, temporada y jornada válidas.',
      };
}

const ALL_STAGES = '';
const NO_STAGE = 'none';
const KINDS: readonly ContentPieceKind[] = kindGroups.flatMap((group) => group.kinds);

/** Whether the local values can show the match as a result (the server's preview is authoritative). */
function looksLikeResult(match: CompetitionMatch): boolean {
  return (
    match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && match.kickoffAt !== null
  );
}

/**
 * Whether the local values can show the match as not played yet: never a finished match, and for upcoming matches and
 * previews only a scheduled or postponed one. The status decides, never the date (the server's preview is
 * authoritative).
 */
function looksUnplayed(match: CompetitionMatch, use: 'calendar' | 'upcoming'): boolean {
  return (
    match.status !== 'finished' &&
    (use === 'calendar' || match.status === 'scheduled' || match.status === 'postponed') &&
    match.kickoffAt !== null
  );
}

/** One compatibility mark of a match for each family of chosen content types. */
interface Compatibility {
  readonly key: string;
  readonly compatible: boolean;
  readonly label: string;
}

function compatibilityOf(match: CompetitionMatch, kinds: ReadonlySet<ContentPieceKind>): Compatibility[] {
  const marks: Compatibility[] = [];
  if (kinds.has('round_results') || kinds.has('match_result')) {
    const compatible = looksLikeResult(match);
    marks.push({ key: 'result', compatible, label: compatible ? 'Resultado final' : 'Sin resultado final' });
  }
  if (kinds.has('round_calendar')) {
    const compatible = looksUnplayed(match, 'calendar');
    marks.push({ key: 'calendar', compatible, label: compatible ? 'Apto para calendario' : 'Fuera del calendario' });
  }
  if (kinds.has('upcoming_matches') || kinds.has('match_preview')) {
    const compatible = looksUnplayed(match, 'upcoming');
    marks.push({ key: 'upcoming', compatible, label: compatible ? 'Por jugar' : 'No está por jugar' });
  }
  return marks;
}

/** The hint of the match step for the chosen content types. */
function matchStepHint(kinds: ReadonlySet<ContentPieceKind>): string {
  if (kinds.size === 1 && kinds.has('match_preview')) {
    return 'Elige el partido o los partidos de la previa: se prepara una previa por partido.';
  }
  const played = kinds.has('round_results') || kinds.has('match_result');
  const unplayed = kinds.has('round_calendar') || kinds.has('upcoming_matches') || kinds.has('match_preview');
  if (played && unplayed) {
    return 'Cada tipo usa solo los partidos compatibles: los resultados, los finalizados; el calendario, los próximos partidos y las previas, los que no han finalizado.';
  }
  return unplayed
    ? 'Los partidos por jugar se eligen por su estado local, nunca por la fecha: un partido finalizado no aparece como próximo.'
    : 'Solo los partidos finalizados con marcador se publican como resultado.';
}

/**
 * The slide types each piece kind draws, as the content of a visual template (PD-ARCH-01G-D): every carousel opens
 * with a cover and ends with a closing (decision 01G-D-3).
 */
const TEMPLATE_TYPES_OF: Readonly<Record<ContentPieceKind, readonly VisualTemplateContentType[]>> = {
  round_results: ['cover', 'match_result', 'closing'],
  match_result: ['cover', 'match_result', 'closing'],
  round_calendar: ['cover', 'round_overview', 'fixture', 'closing'],
  upcoming_matches: ['cover', 'fixture', 'closing'],
  match_preview: ['cover', 'match_preview', 'closing'],
};

/** The slide types of the chosen kinds a visual template can draw, in carousel order (cover first, closing last). */
export function templateSlideTypes(kinds: ReadonlySet<ContentPieceKind>): VisualTemplateContentType[] {
  const types = new Set([...kinds].flatMap((kind) => TEMPLATE_TYPES_OF[kind]));
  return VisualTemplateContentTypeSchema.options.filter((type) => types.has(type));
}

/** The visual templates a selection can use: published, active, 4:5 and of a slide type of the chosen kinds. */
export function compatibleTemplates(
  templates: readonly VisualTemplate[],
  kinds: ReadonlySet<ContentPieceKind>,
): VisualTemplate[] {
  const types = new Set([...kinds].flatMap((kind) => TEMPLATE_TYPES_OF[kind]));
  return templates.filter(
    (template) =>
      template.status === 'published' &&
      template.publishedVersion !== null &&
      template.format === '4:5' &&
      types.has(template.contentType),
  );
}

/** The first selected match a template of the given type can show (none for a cover, a calendar or a closing). */
function previewMatch(
  matches: readonly CompetitionMatch[],
  type: VisualTemplateContentType,
): CompetitionMatch | undefined {
  if (type !== 'match_result' && type !== 'fixture' && type !== 'match_preview') return undefined;
  return matches.find((match) => (type === 'match_result' ? looksLikeResult(match) : looksUnplayed(match, 'upcoming')));
}

/** The visual template a selection uses for a slide type, if any. */
function usageOf(usages: readonly VisualTemplateUsage[], type: VisualTemplateContentType): VisualTemplateUsage | null {
  return usages.find((usage) => usage.contentType === type) ?? null;
}

/**
 * The slide engine's drawing of a chosen template with the selected local data (the first compatible match for a
 * match slide; the round for a cover, a calendar or a closing). No OpenAI call.
 */
function TemplatePreviewFigure({
  usage,
  selection,
}: {
  usage: VisualTemplateUsage;
  selection: { competitionId: string; seasonId: string; roundId: string; matchId: string | null };
}) {
  const { api } = useProjectsDependencies();
  const { competitionId, seasonId, roundId, matchId } = selection;
  const label = templateContentTypeLabel[usage.contentType];
  const request = useApiRequest(
    `template-preview:${usage.versionId}:${roundId}:${matchId ?? ''}`,
    useCallback(
      (signal: AbortSignal) =>
        api.previewVisualTemplate(
          usage.templateId,
          usage.versionId,
          { selection: { competitionId, seasonId, roundId, ...(matchId === null ? {} : { matchId }) } },
          signal,
        ),
      [api, usage.templateId, usage.versionId, competitionId, seasonId, roundId, matchId],
    ),
  );
  if (request.state.status === 'loading') return <LoadingState label={`Dibujando la vista previa de «${label}»…`} />;
  if (request.state.status === 'error') return <ErrorBanner error={request.state.error} onRetry={request.reload} />;
  if (request.state.status !== 'success') return null;
  const result = request.state.data;
  return (
    <figure className="m-0 grid min-w-0 gap-2">
      <img
        src={result.imageUrl}
        alt={`Vista previa de «${usage.name}» (${label}) con los datos seleccionados`}
        width={result.width}
        height={result.height}
        className="h-auto w-full rounded-lg border border-border-subtle"
      />
      <figcaption className="text-caption text-text-secondary">
        {label}: así se verá con el motor final; no usa OpenAI.
      </figcaption>
      {result.issues.length === 0 ? null : (
        <ul aria-label={`Avisos de la vista previa de «${usage.name}»`} className="m-0 grid list-none gap-1 p-0">
          {result.issues.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.layerId ?? ''}-${String(index)}`}
              className={`text-caption ${issue.severity === 'error' ? 'text-danger' : 'text-warning'}`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </figure>
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
  const [preset] = useState(() => presetOf(params));
  const [presetStage, setPresetStage] = useState<PresetStage>(preset.competitionId === '' ? 'done' : 'competition');
  const [presetError, setPresetError] = useState<string | null>(preset.error);
  const [step, setStep] = useState(1);
  const [competitionId, setCompetitionId] = useState(preset.competitionId);
  const [seasonId, setSeasonId] = useState(preset.seasonId);
  const [stageFilter, setStageFilter] = useState(ALL_STAGES);
  const [roundId, setRoundId] = useState(preset.roundId);
  const [kinds, setKinds] = useState<ReadonlySet<ContentPieceKind>>(new Set(['round_results']));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [requestKey, setRequestKey] = useState<{ signature: string; key: string } | null>(null);
  /**
   * The published version chosen for each slide type; a slide type without one uses its engine template
   * (PD-ARCH-01G-D, decision 01G-D-3).
   */
  const [templateChoices, setTemplateChoices] = useState<Readonly<Partial<Record<VisualTemplateContentType, string>>>>(
    {},
  );

  const competitions = useApiRequest(
    'local-competitions',
    useCallback((signal: AbortSignal) => api.listLocalCompetitions(signal), [api]),
  );
  // A preselected level is requested only after the previous one was found, so no identifier of another
  // competition or season is ever used.
  const seasons = useApiRequest(
    competitionId === '' || presetStage === 'competition' ? null : `seasons:${competitionId}`,
    useCallback((signal: AbortSignal) => api.listLocalSeasons(competitionId, signal), [api, competitionId]),
  );
  const calendar = useApiRequest(
    competitionId === '' || seasonId === '' || presetStage === 'competition' || presetStage === 'season'
      ? null
      : `calendar:${competitionId}:${seasonId}`,
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

  // Validates the context of the address level by level against the local data.
  useEffect(() => {
    const reject = (message: string, keep: 'none' | 'competition' | 'season') => {
      setPresetError(message);
      if (keep === 'none') setCompetitionId('');
      if (keep !== 'season') setSeasonId('');
      setRoundId('');
      setPresetStage('done');
    };
    if (presetStage === 'competition' && competitions.state.status === 'success') {
      if (!competitions.state.data.some((item) => item.id === preset.competitionId)) {
        reject('La competición del enlace no existe.', 'none');
      } else {
        setPresetStage(preset.seasonId === '' ? 'done' : 'season');
      }
    } else if (presetStage === 'season' && seasons.state.status === 'success') {
      if (!seasons.state.data.some((item) => item.id === preset.seasonId)) {
        reject('La temporada del enlace no pertenece a esa competición.', 'competition');
      } else {
        setPresetStage(preset.roundId === '' ? 'done' : 'round');
      }
    } else if (presetStage === 'round' && calendar.state.status === 'success') {
      const found = calendar.state.data.rounds.find((item) => item.id === preset.roundId);
      if (found === undefined) {
        reject('La jornada del enlace no pertenece a esa temporada.', 'season');
      } else {
        // The related stage is resolved from the round itself.
        if (calendar.state.data.stages.length > 0) setStageFilter(found.stageId ?? NO_STAGE);
        setPresetStage('done');
      }
    } else if (
      presetStage !== 'done' &&
      [competitions.state, seasons.state, calendar.state].some((state) => state.status === 'error')
    ) {
      reject('No se pudo comprobar el contexto del enlace.', 'none');
    }
  }, [presetStage, preset, competitions.state, seasons.state, calendar.state]);

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

  const visualTemplates = useApiRequest(
    step >= 4 ? 'visual-templates' : null,
    useCallback((signal: AbortSignal) => api.listVisualTemplates(signal), [api]),
  );
  const compatible =
    visualTemplates.state.status === 'success' ? compatibleTemplates(visualTemplates.state.data, kinds) : [];
  const slideTypes = templateSlideTypes(kinds);
  const chosenTemplates = slideTypes.flatMap((type) => {
    const template = compatible.find(
      (candidate) => candidate.contentType === type && candidate.publishedVersion?.id === templateChoices[type],
    );
    const versionId = template?.publishedVersion?.id;
    return template === undefined || versionId === undefined ? [] : [{ type, template, versionId }];
  });
  // A choice the chosen content types no longer use is dropped (its slide type uses the engine template again).
  const choiceCount = Object.keys(templateChoices).length;
  useEffect(() => {
    if (visualTemplates.state.status === 'success' && choiceCount !== chosenTemplates.length) {
      setTemplateChoices(Object.fromEntries(chosenTemplates.map((chosen) => [chosen.type, chosen.versionId])));
    }
  }, [visualTemplates.state.status, choiceCount, chosenTemplates]);
  function chooseTemplate(type: VisualTemplateContentType, versionId: string | null) {
    setTemplateChoices((current) => {
      const next = { ...current };
      if (versionId === null) delete next[type];
      else next[type] = versionId;
      return next;
    });
  }

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
          // Only with visual templates, so a selection without one is exactly as before.
          ...(chosenTemplates.length === 0
            ? {}
            : { visualTemplateVersionIds: chosenTemplates.map((chosen) => chosen.versionId) }),
        };
  const signature = selection === null ? null : JSON.stringify(selection);
  const preview = useApiRequest(
    step === 5 && signature !== null ? `preview:${signature}` : null,
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

  const selectedMatches = roundMatches.filter((match) => selected.has(match.id));
  /** The visual templates of the reviewed selection, as the server checked them. */
  const chosenUsages = preview.state.status === 'success' ? preview.state.data.visualTemplates : [];
  function chooseCompetition(value: string) {
    setPresetStage('done');
    setPresetError(null);
    setCompetitionId(value);
    setSeasonId('');
    setStageFilter(ALL_STAGES);
    setRoundId('');
    setSelected(new Set());
  }

  function chooseSeason(value: string) {
    setPresetStage('done');
    setPresetError(null);
    setSeasonId(value);
    setStageFilter(ALL_STAGES);
    setRoundId('');
    setSelected(new Set());
  }

  function chooseRound(value: string) {
    setPresetStage('done');
    setPresetError(null);
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
    (step === 1 && presetStage === 'done' && round !== null && roundMatches.length > 0) ||
    (step === 2 && kinds.size > 0) ||
    (step === 3 && selected.size > 0) ||
    step === 4;
  const ready = preview.state.status === 'success' ? preview.state.data.totals.ready : 0;

  return (
    <section aria-labelledby="generate-title" className="grid min-w-0 gap-6">
      <div className="grid gap-3">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Desde una competición</p>
        <h1 id="generate-title" className="m-0 font-display text-heading-md font-extrabold tracking-display">
          Crear contenido
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
          {presetError === null ? null : (
            <Alert tone="warning" role="alert" title="No pudimos abrir el contexto del enlace">
              {presetError} Elige la competición, la temporada y la jornada.
            </Alert>
          )}
          {presetStage === 'done' ? null : <LoadingState label="Comprobando el contexto del enlace…" />}
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
          {kindGroups.map((group) => (
            <fieldset key={group.label} className="grid gap-2 border-0 p-0">
              <legend className="mb-2 text-body-sm font-bold text-text-primary">{group.label}</legend>
              {group.kinds.map((kind) => (
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
          ))}
          <p className="m-0 text-body-sm text-text-secondary">
            Los partidos por jugar nunca se presentan como jugados: sin marcador, ganador, pronóstico ni alineaciones.
            Puedes elegir varios tipos a la vez; cada uno se prepara como una pieza propia.
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
                onClick={() =>
                  setSelected(
                    new Set(
                      roundMatches
                        .filter((match) => compatibilityOf(match, kinds).some((mark) => mark.compatible))
                        .map((match) => match.id),
                    ),
                  )
                }
              >
                Seleccionar compatibles
              </Button>
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
          <p className="m-0 text-body-sm text-text-secondary">{matchStepHint(kinds)}</p>
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
                <span className="inline-flex shrink-0 items-center gap-1">
                  <TeamBadge team={match.homeTeam} size="sm" />
                  <TeamBadge team={match.awayTeam} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong>
                    {match.homeTeam.name} – {match.awayTeam.name}
                  </strong>
                  <small className="block text-text-secondary">
                    {match.kickoffAt === null ? 'Sin fecha' : formatDateTime(match.kickoffAt)} ·{' '}
                    {matchStatusCopy[match.status]} · {scoreText(match.homeScore, match.awayScore)}
                  </small>
                </span>
                <span className="flex flex-wrap gap-2">
                  {compatibilityOf(match, kinds).map((mark) => (
                    <Badge key={mark.key} tone={mark.compatible ? 'success' : 'warning'}>
                      {mark.label}
                    </Badge>
                  ))}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="m-0 text-body-sm text-text-secondary" aria-live="polite">
            {selected.size} de {roundMatches.length} partidos seleccionados.
          </p>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card as="section" aria-labelledby="step-template-title" className="grid gap-4">
          <h2 id="step-template-title" className="m-0 text-heading-sm font-bold">
            4. Plantilla
          </h2>
          <p className="m-0 text-body-sm text-text-secondary">
            Para cada tipo de diapositiva del carrusel, elige una plantilla visual publicada o deja la plantilla del
            motor. Solo se muestran plantillas 4:5, el formato de los carruseles. Generar con plantillas no usa OpenAI.
          </p>
          {visualTemplates.state.status === 'loading' ? <LoadingState label="Cargando plantillas visuales…" /> : null}
          {visualTemplates.state.status === 'error' ? (
            <ErrorBanner error={visualTemplates.state.error} onRetry={visualTemplates.reload} />
          ) : null}
          {visualTemplates.state.status === 'success' && compatible.length === 0 ? (
            <p className="m-0 text-body-sm text-text-secondary">
              No hay plantillas visuales publicadas 4:5 para los tipos de contenido elegidos. Puedes crearlas en{' '}
              <Link to="/templates/create" className="text-text-link underline">
                Crear plantilla
              </Link>
              .
            </p>
          ) : null}
          {slideTypes.map((type) => {
            const label = templateContentTypeLabel[type];
            const options = compatible.filter((template) => template.contentType === type);
            const chosen = chosenTemplates.find((item) => item.type === type) ?? null;
            return (
              <fieldset
                key={type}
                className="grid min-w-0 gap-3 rounded-xl border border-border-subtle p-3"
                data-testid={`template-choice-${type}`}
              >
                <legend className="px-1 text-body-md font-bold text-text-primary">{label}</legend>
                <label className="flex min-h-touch items-start gap-3 rounded-xl border border-border-subtle px-3 py-3 text-text-primary">
                  <input
                    type="radio"
                    name={`generate-template-${type}`}
                    checked={chosen === null}
                    onChange={() => chooseTemplate(type, null)}
                  />
                  <span>
                    <strong>Plantilla del motor</strong>
                    <small className="block text-text-secondary">
                      La versión vigente de la plantilla «{label}» del motor, como hasta ahora.
                    </small>
                  </span>
                </label>
                {options.length > 0 ? (
                  <ul
                    aria-label={`Plantillas visuales de ${label}`}
                    className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3"
                  >
                    {options.map((template) => {
                      const version = template.publishedVersion;
                      if (version === null) return null;
                      return (
                        <li key={template.id} className="min-w-0">
                          <label
                            className={`grid h-full min-w-0 gap-2 rounded-xl border p-3 text-text-primary ${
                              chosen?.template.id === template.id
                                ? 'border-brand-gold bg-surface-raised'
                                : 'border-border-subtle'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`generate-template-${type}`}
                                checked={chosen?.template.id === template.id}
                                onChange={() => chooseTemplate(type, version.id)}
                              />
                              <strong className="min-w-0 break-words">{template.name}</strong>
                            </span>
                            <span className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
                              <PreviewImage
                                key={version.id}
                                src={visualTemplateBackgroundUrl(template.id, version.id)}
                                alt={`Fondo de la plantilla «${template.name}»`}
                                failedText="No se pudo cargar el fondo."
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              <Badge tone="info">{label}</Badge>
                              <Badge>{template.format}</Badge>
                              <Badge>Versión {version.version}</Badge>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : visualTemplates.state.status === 'success' ? (
                  <p className="m-0 text-caption text-text-subtle">No hay plantillas publicadas 4:5 de este tipo.</p>
                ) : null}
              </fieldset>
            );
          })}
        </Card>
      ) : null}

      {step === 5 ? (
        <Card as="section" aria-labelledby="step-review-title" className="grid gap-5">
          <h2 id="step-review-title" className="m-0 text-heading-sm font-bold">
            5. Revisión de la generación propuesta
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
              <section aria-labelledby="review-visual-title" className="grid gap-3">
                <h3 id="review-visual-title" className="m-0 text-body-lg font-bold">
                  Plantillas visuales
                </h3>
                {preview.state.data.visualTemplates.length === 0 ? (
                  <p className="m-0 text-body-sm text-text-secondary">
                    Sin plantillas visuales: se usan las plantillas del motor.
                  </p>
                ) : (
                  <>
                    <ul
                      aria-label="Plantilla de cada diapositiva"
                      className="m-0 grid list-none gap-1 p-0 text-body-md"
                    >
                      {slideTypes.map((type) => {
                        const usage = usageOf(chosenUsages, type);
                        return (
                          <li key={type}>
                            <strong>{templateContentTypeLabel[type]}:</strong>{' '}
                            {usage === null
                              ? 'Plantilla del motor'
                              : `${usage.name} · versión ${String(usage.version)}`}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="m-0 text-body-sm text-text-secondary">
                      El proyecto conserva estas versiones aunque después se publiquen otras.
                    </p>
                    {round === null ? null : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {preview.state.data.visualTemplates.map((usage) => (
                          <TemplatePreviewFigure
                            key={usage.versionId}
                            usage={usage}
                            selection={{
                              competitionId,
                              seasonId,
                              roundId: round.id,
                              matchId: previewMatch(selectedMatches, usage.contentType)?.id ?? null,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
              <section aria-labelledby="review-badges-title" className="grid gap-2">
                <h3 id="review-badges-title" className="m-0 text-body-lg font-bold">
                  Escudos
                </h3>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {selectedMatches.map((match) => (
                    <li
                      key={match.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle px-3 py-2"
                    >
                      {[match.homeTeam, match.awayTeam].map((team, index) => (
                        <span key={team.id} className="flex min-w-0 items-center gap-2">
                          {index === 1 ? <span aria-hidden="true">–</span> : null}
                          <TeamBadge team={team} size="sm" />
                          <span>{team.name}</span>
                          {team.badge === null ? <small className="text-warning">(sin escudo)</small> : null}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                {selectedMatches.some((match) => match.homeTeam.badge === null || match.awayTeam.badge === null) ? (
                  <p className="m-0 text-body-sm text-warning">
                    Un equipo sin escudo se muestra solo con su nombre; no impide generar. Puedes subirlo en
                    Competiciones.
                  </p>
                ) : null}
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
        {step < 5 ? (
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
