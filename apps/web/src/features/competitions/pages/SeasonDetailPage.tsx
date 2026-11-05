import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type {
  CompetitionMatch,
  CompetitionMatchResultUpdate,
  CompetitionRound,
  CompetitionStage,
  ManagedCompetition,
  ManagedSeason,
  ManagedTeam,
  SeasonParticipant,
  SportsFieldProvenance,
} from '@edr/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Select,
  Icon,
  IconButton,
  buttonClassName,
  describeError,
  Modal,
  ModalFooter,
  Tabs,
  tabPanelId,
  ViewModeToggle,
} from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';
import { RoundStatusIndicator } from '../components/RoundStatusIndicator';
import { deriveRoundStatus, type RoundPresentationStatus } from '../round-status';

type RoundStatusFilter = 'all' | RoundPresentationStatus;

function RenameForm({
  label,
  value,
  disabled,
  onSave,
  onCancel,
  stages,
  stageId,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onSave: (value: string, stageId?: string | null) => Promise<void>;
  onCancel: () => void;
  stages?: CompetitionStage[];
  stageId?: string | null;
}) {
  const [name, setName] = useState(value);
  const [selectedStageId, setSelectedStageId] = useState(stageId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setName(value);
    setSelectedStageId(stageId ?? '');
  }, [value, stageId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSave(name.trim(), stages === undefined ? undefined : selectedStageId || null);
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="grid min-w-0 gap-4" onSubmit={(event) => void submit(event)}>
      <Input
        id={`rename-${label.toLowerCase().replaceAll(' ', '-')}`}
        label={`Nombre de ${label.toLowerCase()}`}
        value={name}
        maxLength={80}
        required
        onChange={(event) => setName(event.target.value)}
      />
      {stages !== undefined ? (
        <Select
          id="round-stage"
          label="Fase"
          value={selectedStageId}
          onChange={(event) => setSelectedStageId(event.target.value)}
        >
          <option value="">Sin fase · temporada</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      ) : null}
      {error ? (
        <p className="m-0 text-body-sm text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ModalFooter onCancel={onCancel} cancelDisabled={busy || disabled}>
        <Button
          type="submit"
          disabled={
            busy ||
            disabled ||
            !name.trim() ||
            (name.trim() === value && (stages === undefined || (selectedStageId || null) === (stageId ?? null)))
          }
        >
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </ModalFooter>
    </form>
  );
}

function teamLabel(team: ManagedTeam): string {
  return team.region ? team.name + ' · ' + team.region : team.name;
}

function RoundStatusFilterControl({
  id,
  value,
  onChange,
}: {
  id: string;
  value: RoundStatusFilter;
  onChange: (value: RoundStatusFilter) => void;
}) {
  const filterLabels: Record<RoundPresentationStatus, string> = {
    finished: 'Finalizadas',
    in_progress: 'En curso',
    scheduled: 'Por jugar',
    empty: 'Sin partidos',
  };
  return (
    <Select
      id={id}
      label="Filtrar jornadas"
      value={value}
      wrapperClassName="min-w-48"
      onChange={(event) => onChange(event.target.value as RoundStatusFilter)}
    >
      <option value="all">Todas</option>
      {(Object.entries(filterLabels) as Array<[RoundPresentationStatus, string]>).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}

const MATCH_STATES = [
  ['scheduled', 'Programado'],
  ['in_progress', 'En curso'],
  ['finished', 'Finalizado'],
  ['postponed', 'Pospuesto'],
  ['cancelled', 'Cancelado'],
] as const;

const MATCH_STATE_STYLES = {
  scheduled: 'bg-blue-200 border-blue-500 text-blue-700',
  in_progress: 'bg-green-200 border-green-500 text-green-700',
  finished: 'bg-gray-300 border-gray-500 text-gray-700',
  postponed: 'bg-amber-200 border-amber-500 text-amber-700',
  cancelled: 'bg-red-200 border-red-500 text-red-700',
} satisfies Record<string, string>;

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function displayDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Fecha por definir';
}

function MatchCard(props: {
  match: CompetitionMatch;
  stages: CompetitionStage[];
  rounds: CompetitionRound[];
  competitionId: string;
  seasonId: string;
  onUpdated: (match: CompetitionMatch) => void;
}) {
  const api = useCompetitionsApi();
  const { match, stages, rounds, competitionId, seasonId } = props;
  const [status, setStatus] = useState<CompetitionMatchResultUpdate['status']>(match.status);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '');
  const [kickoff, setKickoff] = useState(localDateTime(match.kickoffAt));
  const [stageId, setStageId] = useState(match.stage?.id ?? '');
  const [roundId, setRoundId] = useState(match.round?.id ?? '');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.listMatchHistory>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [provenance, setProvenance] = useState<SportsFieldProvenance[]>([]);
  const availableRounds = rounds.filter((round) => (round.stageId ?? '') === stageId);

  const loadProvenance = useCallback(async () => {
    if (!api.getFieldProvenance) return;
    const [matchFields, resultFields] = await Promise.all([
      api.getFieldProvenance(competitionId, 'match', match.id),
      api.getFieldProvenance(competitionId, 'result', match.id),
    ]);
    setProvenance([...matchFields, ...resultFields]);
  }, [api, competitionId, match.id]);

  useEffect(() => {
    const controller = new AbortController();
    if (api.getFieldProvenance)
      void Promise.all([
        api.getFieldProvenance(competitionId, 'match', match.id, controller.signal),
        api.getFieldProvenance(competitionId, 'result', match.id, controller.signal),
      ])
        .then(([matchFields, resultFields]) => setProvenance([...matchFields, ...resultFields]))
        .catch(() => undefined);
    return () => controller.abort();
  }, [api, competitionId, match.id]);

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const resultStatus = status;
      const nextHome = homeScore !== '' ? Number(homeScore) : null;
      const nextAway = awayScore !== '' ? Number(awayScore) : null;
      const updated = await api.updateMatchResult(competitionId, seasonId, match.id, {
        status: resultStatus,
        homeScore: nextHome,
        awayScore: nextAway,
      });
      props.onUpdated(updated);
      setHomeScore(updated.homeScore?.toString() ?? '');
      setAwayScore(updated.awayScore?.toString() ?? '');
      setStatus(updated.status);
      if (history !== undefined) setHistory(await api.listMatchHistory(competitionId, seasonId, match.id));
      await loadProvenance();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const updated = await api.updateMatchSchedule(competitionId, seasonId, match.id, {
        kickoffAt: kickoff ? new Date(kickoff).toISOString() : null,
        stageId: stageId || null,
        roundId: roundId || null,
      });
      props.onUpdated(updated);
      if (history !== undefined) setHistory(await api.listMatchHistory(competitionId, seasonId, match.id));
      await loadProvenance();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const problem = error === undefined ? null : describeError(error);
  const matchState = MATCH_STATES.find(([key]) => key === match.status);
  const stateLabel = matchState?.[1] ?? 'Programado';
  const stateClassName = matchState ? MATCH_STATE_STYLES[matchState[0]] : MATCH_STATE_STYLES.scheduled;
  const protectedCount = provenance.filter((field) => field.protected).length;
  const providerCount = provenance.filter((field) => field.origin === 'provider').length;
  return (
    <Card as="article" className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="m-0 min-w-0 text-body-sm text-text-secondary">{displayDate(match.kickoffAt)}</p>
        <span className={`rounded-full border px-3 py-1 text-caption font-bold ${stateClassName}`}>{stateLabel}</span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <h3 className="m-0 min-w-0 break-normal font-display text-heading-sm font-bold text-text-primary">
          {match.homeTeam.name}
        </h3>
        <strong
          className="font-display text-heading-md font-extrabold text-brand-gold"
          aria-label={match.homeScore === null ? 'Sin marcador' : `Marcador ${match.homeScore} a ${match.awayScore}`}
        >
          {match.homeScore === null ? 'vs' : `${match.homeScore} – ${match.awayScore}`}
        </strong>
        <h3 className="m-0 min-w-0 break-normal text-right font-display text-heading-sm font-bold text-text-primary">
          {match.awayTeam.name}
        </h3>
      </div>
      {match.stage || match.round ? (
        <p className="m-0 text-caption text-text-subtle">
          {[match.stage?.name, match.round?.name].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {provenance.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Procedencia de los datos del partido">
          {providerCount ? (
            <span className="rounded-full border border-info bg-info-surface px-2 py-1 text-caption font-semibold text-info">
              Dato del proveedor · {providerCount}
            </span>
          ) : null}
          {protectedCount ? (
            <span className="rounded-full border border-warning bg-warning-surface px-2 py-1 text-caption font-semibold text-warning">
              Modificado manualmente · Protegido · {protectedCount}
            </span>
          ) : null}
          <details className="text-body-sm text-text-secondary">
            <summary className="cursor-pointer text-text-link underline underline-offset-2 focus-studio">
              Ver procedencia
            </summary>
            <ul className="m-0 mt-2 grid list-none gap-1 p-0">
              {provenance.map((field) => (
                <li key={`${field.field}-${field.origin}`}>
                  <strong>{field.field}</strong>:{' '}
                  {field.protected ? 'valor local protegido' : field.origin === 'provider' ? 'proveedor' : 'manual'}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo guardar el cambio">
          <p className="m-0">{problem.message}</p>
        </Alert>
      ) : null}
      <div className="grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
        <details>
          <summary className="min-h-touch cursor-pointer content-center font-sans text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio">
            Registrar o corregir resultado
          </summary>
          <form className="mt-3 grid gap-3" onSubmit={(event) => void saveResult(event)}>
            <Select
              id={`match-status-${match.id}`}
              label="Estado del partido"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              {MATCH_STATES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id={`home-score-${match.id}`}
                label={`Marcador · ${match.homeTeam.name}`}
                type="number"
                min={0}
                step={1}
                value={homeScore}
                onChange={(event) => setHomeScore(event.target.value)}
              />
              <Input
                id={`away-score-${match.id}`}
                label={`Marcador · ${match.awayTeam.name}`}
                type="number"
                min={0}
                step={1}
                value={awayScore}
                onChange={(event) => setAwayScore(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar estado y marcador'}
            </Button>
          </form>
        </details>
        <details>
          <summary className="min-h-touch cursor-pointer content-center font-sans text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio">
            Cambiar programación
          </summary>
          <form className="mt-3 grid gap-3" onSubmit={(event) => void saveSchedule(event)}>
            <Input
              id={`kickoff-${match.id}`}
              label="Fecha y hora (opcional)"
              type="datetime-local"
              value={kickoff}
              onChange={(event) => setKickoff(event.target.value)}
            />
            <Select
              id={`stage-${match.id}`}
              label="Fase (opcional)"
              value={stageId}
              onChange={(event) => {
                setStageId(event.target.value);
                setRoundId('');
              }}
            >
              <option value="">Sin fase</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
            <Select
              id={`round-${match.id}`}
              label="Jornada o ronda (opcional)"
              value={roundId}
              onChange={(event) => setRoundId(event.target.value)}
            >
              <option value="">Sin jornada o ronda</option>
              {availableRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar programación'}
            </Button>
          </form>
        </details>
      </div>
    </Card>
  );
}

export function SeasonDetailPage() {
  const { competitionId, seasonId } = useParams();
  const { stageId: routeStageId, roundId: routeRoundId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const api = useCompetitionsApi();
  const [competition, setCompetition] = useState<ManagedCompetition>();
  const [season, setSeason] = useState<ManagedSeason>();
  const [teams, setTeams] = useState<ManagedTeam[]>([]);
  const [participants, setParticipants] = useState<SeasonParticipant[]>([]);
  const [participantView, setParticipantView] = useState<'table' | 'cards'>('table');
  const [stages, setStages] = useState<CompetitionStage[]>([]);
  const [rounds, setRounds] = useState<CompetitionRound[]>([]);
  const [matches, setMatches] = useState<CompetitionMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [participantsModal, setParticipantsModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string>();
  const [stageName, setStageName] = useState('');
  const [roundName, setRoundName] = useState('');
  const [roundStageId, setRoundStageId] = useState('');
  const [matchHomeId, setMatchHomeId] = useState('');
  const [matchAwayId, setMatchAwayId] = useState('');
  const [matchKickoff, setMatchKickoff] = useState('');
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarTab, setCalendarTab] = useState<'stages' | 'direct'>('stages');
  const [roundView, setRoundView] = useState<'table' | 'cards'>('table');
  const [roundStatusFilter, setRoundStatusFilter] = useState<RoundStatusFilter>('all');
  const [stageModal, setStageModal] = useState(false);
  const [roundModal, setRoundModal] = useState(false);
  const [matchModal, setMatchModal] = useState(false);
  const [editingStage, setEditingStage] = useState<CompetitionStage | null>(null);
  const [editingRound, setEditingRound] = useState<CompetitionRound | null>(null);
  const [deletingRound, setDeletingRound] = useState<CompetitionRound | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const basePath = `/competitions/${competitionId}/seasons/${seasonId}`;
  const sectionPath = pathname.slice(basePath.length) || '/';
  const isParticipants = sectionPath === '/participants';
  const isCalendar = sectionPath === '/calendar';
  const isStageDetail = sectionPath === `/calendar/stages/${routeStageId}` && Boolean(routeStageId);
  const isRoundDetail =
    Boolean(routeRoundId) &&
    (sectionPath === `/calendar/rounds/${routeRoundId}` ||
      sectionPath === `/calendar/stages/${routeStageId}/rounds/${routeRoundId}`);
  const isUngrouped = sectionPath === '/calendar/unassigned';
  const isSeasonHome = sectionPath === '/';

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId || !seasonId) return;
      setLoading(true);
      try {
        const [
          currentCompetition,
          currentSeason,
          currentTeams,
          currentParticipants,
          currentStages,
          directRounds,
          currentMatches,
        ] = await Promise.all([
          api.get(competitionId, signal),
          api.getSeason(competitionId, seasonId, signal),
          api.listCompetitionTeams(competitionId, signal),
          api.listParticipants(competitionId, seasonId, signal),
          api.listStages(competitionId, seasonId, signal),
          api.listSeasonRounds(competitionId, seasonId, signal),
          api.listMatches(competitionId, seasonId, signal),
        ]);
        const stageRoundLists = await Promise.all(
          currentStages.map((stage) => api.listStageRounds(competitionId, seasonId, stage.id, signal)),
        );
        setCompetition(currentCompetition);
        setSeason(currentSeason);
        setTeams(currentTeams.map((entry) => entry.team));
        setParticipants(currentParticipants);
        setStages(currentStages);
        setRounds([...directRounds, ...stageRoundLists.flat()]);
        setMatches(currentMatches);
        setError(undefined);
      } catch (cause) {
        if (!signal?.aborted) setError(cause);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api, competitionId, seasonId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competitionId || !seasonId || selectedTeamIds.length === 0) return;
    setAdding(true);
    setError(undefined);
    try {
      const newParticipants = await api.addParticipants(competitionId, seasonId, selectedTeamIds);
      setParticipants((current) =>
        [...current, ...newParticipants].sort((a, b) => a.team.name.localeCompare(b.team.name, 'es')),
      );
      setSelectedTeamIds([]);
      setParticipantsModal(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setAdding(false);
    }
  }

  async function removeTeam(teamId: string) {
    if (!competitionId || !seasonId) return;
    setRemovingTeamId(teamId);
    setError(undefined);
    try {
      await api.removeParticipant(competitionId, seasonId, teamId);
      setParticipants((current) => current.filter((entry) => entry.team.id !== teamId));
    } catch (cause) {
      setError(cause);
    } finally {
      setRemovingTeamId(undefined);
    }
  }

  async function createStage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!competitionId || !seasonId) return;
    setCalendarBusy(true);
    setError(undefined);
    try {
      const stage = await api.createStage(competitionId, seasonId, { name: stageName.trim() });
      setStages((current) => [...current, stage].sort((a, b) => a.displayOrder - b.displayOrder));
      setStageName('');
      setStageModal(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setCalendarBusy(false);
    }
  }

  async function createRound(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!competitionId || !seasonId) return;
    setCalendarBusy(true);
    setError(undefined);
    try {
      const selectedStageId = roundStageId || null;
      const round = selectedStageId
        ? await api.createStageRound(competitionId, seasonId, selectedStageId, { name: roundName.trim() })
        : await api.createSeasonRound(competitionId, seasonId, { name: roundName.trim() });
      setRounds((current) => [...current, round].sort((a, b) => a.displayOrder - b.displayOrder));
      setRoundName('');
      setRoundModal(false);
      setSuccessMessage('Jornada creada.');
      navigate(
        round.stageId
          ? `${basePath}/calendar/stages/${round.stageId}/rounds/${round.id}`
          : `${basePath}/calendar/rounds/${round.id}`,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setCalendarBusy(false);
    }
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competitionId || !seasonId) return;
    setCalendarBusy(true);
    setError(undefined);
    try {
      const selectedRound = isRoundDetail ? rounds.find((round) => round.id === routeRoundId) : undefined;
      const selectedStageId = isStageDetail ? routeStageId! : (selectedRound?.stageId ?? null);
      const selectedRoundId = selectedRound?.id ?? null;
      const match = await api.createMatch(competitionId, seasonId, {
        homeTeamId: matchHomeId,
        awayTeamId: matchAwayId,
        kickoffAt: matchKickoff ? new Date(matchKickoff).toISOString() : null,
        stageId: selectedStageId,
        roundId: selectedRoundId,
      });
      setMatches((current) => [...current, match].sort((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '')));
      setMatchKickoff('');
      setMatchHomeId('');
      setMatchAwayId('');
      setMatchModal(false);
      setSuccessMessage('Partido agregado.');
    } catch (cause) {
      setError(cause);
    } finally {
      setCalendarBusy(false);
    }
  }

  async function renameStage(id: string, name: string) {
    if (calendarBusy) return;
    setCalendarBusy(true);
    try {
      const updated = await api.updateStage(competitionId!, seasonId!, id, { name });
      setStages((current) => current.map((stage) => (stage.id === id ? updated : stage)));
      setEditingStage(null);
      setSuccessMessage('Fase actualizada.');
    } finally {
      setCalendarBusy(false);
    }
  }

  async function renameRound(id: string, name: string, stageId: string | null) {
    if (calendarBusy) return;
    setCalendarBusy(true);
    try {
      const updated = await api.updateRound(competitionId!, seasonId!, id, { name, stageId });
      setRounds((current) => current.map((round) => (round.id === id ? updated : round)));
      setEditingRound(null);
      setSuccessMessage('Jornada actualizada.');
      navigate(
        updated.stageId
          ? `${basePath}/calendar/stages/${updated.stageId}/rounds/${updated.id}`
          : `${basePath}/calendar/rounds/${updated.id}`,
        { replace: true },
      );
    } finally {
      setCalendarBusy(false);
    }
  }

  async function deleteRound(round: CompetitionRound) {
    if (calendarBusy) return;
    setCalendarBusy(true);
    try {
      await api.deleteRound(competitionId!, seasonId!, round.id);
      setRounds((current) => current.filter((item) => item.id !== round.id));
      setDeletingRound(null);
      setSuccessMessage('Jornada eliminada.');
    } catch (cause) {
      setError(cause);
    } finally {
      setCalendarBusy(false);
    }
  }

  function updateMatch(updated: CompetitionMatch) {
    setMatches((current) => current.map((match) => (match.id === updated.id ? updated : match)));
  }

  if (loading)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando temporada y equipos…" />
      </Card>
    );
  const problem = error === undefined ? null : describeError(error);
  if (!season || !competitionId || !seasonId) {
    return (
      <Alert role="alert" tone="danger" title="No se pudo abrir la temporada">
        <p className="m-0">{problem?.message ?? 'La temporada no está disponible.'}</p>
        <Button variant="quiet" onClick={() => void load()}>
          Reintentar
        </Button>
        <Link to="/competitions">Volver a competiciones</Link>
      </Alert>
    );
  }

  const participantIds = new Set(participants.map((entry) => entry.team.id));
  const availableTeams = teams.filter((team) => !participantIds.has(team.id));
  const selectedStage = stages.find((stage) => stage.id === routeStageId);
  const selectedRound = rounds.find((round) => round.id === routeRoundId);
  const matchesForRound = (roundId: string) => matches.filter((match) => match.round?.id === roundId);
  const matchesRoundFilter = (round: CompetitionRound) =>
    roundStatusFilter === 'all' || deriveRoundStatus(matchesForRound(round.id)).status === roundStatusFilter;
  const directRounds = rounds.filter((round) => round.stageId === null);
  const filteredDirectRounds = directRounds.filter(matchesRoundFilter);
  const selectedStageRounds = selectedStage ? rounds.filter((round) => round.stageId === selectedStage.id) : [];
  const filteredSelectedStageRounds = selectedStageRounds.filter(matchesRoundFilter);
  const stageOnlyMatches = matches.filter((match) => match.stage?.id === routeStageId && match.round === null);
  const roundMatches = matches.filter((match) => match.round?.id === routeRoundId);
  const ungroupedMatches = matches.filter((match) => match.stage === null && match.round === null);
  const contextualMatchLabel = isStageDetail
    ? selectedStage?.name
    : isRoundDetail
      ? selectedRound?.name
      : 'esta sección';
  const isCalendarSubview = isStageDetail || isRoundDetail || isUngrouped;
  const selectedRoundStage = selectedRound?.stageId
    ? stages.find((stage) => stage.id === selectedRound.stageId)
    : undefined;
  const matchCreation =
    isStageDetail || isRoundDetail ? (
      <Modal
        title="Agregar partido"
        closeDisabled={calendarBusy}
        onClose={() => {
          if (!calendarBusy) setMatchModal(false);
        }}
      >
        <div className="grid min-w-0 gap-4">
          <p className="m-0 text-body-sm text-text-secondary">
            Se agregará a {contextualMatchLabel ?? 'esta sección'}.
          </p>
          {participants.length < 2 ? (
            <>
              <EmptyState
                title="Añade al menos dos equipos"
                description="Los partidos solo pueden usar equipos participantes de esta temporada."
                icon="♧"
              />
              <ModalFooter onCancel={() => setMatchModal(false)} />
            </>
          ) : (
            <form className="grid min-w-0 gap-3" onSubmit={(event) => void createMatch(event)}>
              <Select
                id="match-home"
                label="Equipo local"
                value={matchHomeId}
                onChange={(event) => setMatchHomeId(event.target.value)}
              >
                <option value="">Selecciona equipo local</option>
                {participants.map(({ team }) => (
                  <option key={team.id} value={team.id}>
                    {teamLabel(team)}
                  </option>
                ))}
              </Select>
              <Select
                id="match-away"
                label="Equipo visitante"
                value={matchAwayId}
                onChange={(event) => setMatchAwayId(event.target.value)}
              >
                <option value="">Selecciona equipo visitante</option>
                {participants
                  .filter(({ team }) => team.id !== matchHomeId)
                  .map(({ team }) => (
                    <option key={team.id} value={team.id}>
                      {teamLabel(team)}
                    </option>
                  ))}
              </Select>
              <Input
                id="match-kickoff"
                label="Fecha y hora (opcional)"
                type="datetime-local"
                value={matchKickoff}
                onChange={(event) => setMatchKickoff(event.target.value)}
              />
              <ModalFooter onCancel={() => setMatchModal(false)} cancelDisabled={calendarBusy}>
                <Button
                  type="submit"
                  disabled={
                    calendarBusy ||
                    !matchHomeId ||
                    !matchAwayId ||
                    matchHomeId === matchAwayId ||
                    (isStageDetail && !selectedStage) ||
                    (isRoundDetail && !selectedRound)
                  }
                >
                  {calendarBusy ? 'Guardando…' : 'Agregar partido'}
                </Button>
              </ModalFooter>
            </form>
          )}
        </div>
      </Modal>
    ) : null;
  return (
    <section className="grid min-w-0 gap-6" aria-labelledby="season-detail-title">
      <nav
        aria-label="Ruta de navegación"
        className="flex min-w-0 flex-wrap items-center gap-2 text-caption text-text-subtle"
      >
        <Link
          className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
          to="/competitions"
        >
          Competiciones
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
          to={`/competitions/${competitionId}`}
        >
          {competition?.name ?? 'Temporadas'}
        </Link>
        {!isSeasonHome ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
              to={basePath}
            >
              {season.label}
            </Link>
          </>
        ) : (
          <>
            <span aria-hidden="true">/</span>
            <span>{season.label}</span>
          </>
        )}
        {isCalendarSubview ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
              to={`${basePath}/calendar`}
            >
              Calendario
            </Link>
            {isStageDetail && selectedStage ? (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{selectedStage.name}</span>
              </>
            ) : null}
            {isRoundDetail && selectedRoundStage ? (
              <>
                <span aria-hidden="true">/</span>
                <Link
                  className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
                  to={`${basePath}/calendar/stages/${selectedRoundStage.id}`}
                >
                  {selectedRoundStage.name}
                </Link>
              </>
            ) : null}
            {isRoundDetail && selectedRound ? (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{selectedRound.name}</span>
              </>
            ) : null}
            {isUngrouped ? (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Por organizar</span>
              </>
            ) : null}
          </>
        ) : isCalendar ? (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Calendario</span>
          </>
        ) : isParticipants ? (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Equipos</span>
          </>
        ) : null}
      </nav>
      <header className="grid min-w-0 gap-2">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Temporada</p>
        <h1
          id="season-detail-title"
          className="m-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
        >
          {isCalendar
            ? 'Calendario'
            : isStageDetail
              ? (selectedStage?.name ?? 'Fase')
              : isRoundDetail
                ? (selectedRound?.name ?? 'Jornada')
                : isUngrouped
                  ? 'Partidos por organizar'
                  : season.label}
        </h1>
        {isCalendar ? (
          <Link
            className="inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4 transition-colors hover:bg-surface-card hover:text-text-primary focus-studio active:text-brand-gold"
            to={basePath}
          >
            <Icon name="arrow-left" size={18} />
            Regresar a {season.label}
          </Link>
        ) : null}
        {isSeasonHome ? (
          <Link
            className="inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4 transition-colors hover:bg-surface-card hover:text-text-primary focus-studio active:text-brand-gold"
            to={`/competitions/${competitionId}`}
          >
            <Icon name="arrow-left" size={18} />
            Regresar a {competition?.name ?? 'la competición'}
          </Link>
        ) : null}
        {isParticipants ? (
          <Link
            className="inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4 transition-colors hover:bg-surface-card hover:text-text-primary focus-studio active:text-brand-gold"
            to={basePath}
          >
            <Icon name="arrow-left" size={18} />
            Regresar a {season.label}
          </Link>
        ) : null}
        {isStageDetail || isRoundDetail || isUngrouped ? (
          <Link
            className="inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4 transition-colors hover:bg-surface-card hover:text-text-primary focus-studio active:text-brand-gold"
            to={
              isRoundDetail && selectedRoundStage
                ? `${basePath}/calendar/stages/${selectedRoundStage.id}`
                : `${basePath}/calendar`
            }
          >
            <Icon name="arrow-left" size={18} />
            {isRoundDetail && selectedRoundStage ? `Regresar a ${selectedRoundStage.name}` : 'Regresar al calendario'}
          </Link>
        ) : null}
      </header>
      {successMessage ? (
        <p className="m-0 text-body-sm text-status-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo completar la operación">
          <p className="m-0">{problem.message}</p>
        </Alert>
      ) : null}
      {isSeasonHome ? (
        <>
          <Card className="grid min-w-0 gap-1">
            <p className="m-0 text-body-sm text-text-secondary">
              {participants.length} {participants.length === 1 ? 'equipo participante' : 'equipos participantes'} ·{' '}
              {stages.length} {stages.length === 1 ? 'fase' : 'fases'} · {matches.length}{' '}
              {matches.length === 1 ? 'partido' : 'partidos'}
            </p>
            <p className="m-0 text-body-sm text-text-secondary">
              {matches.filter((match) => match.status === 'finished').length} finalizados
            </p>
          </Card>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Card className="grid min-w-0 content-start gap-3">
              <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Equipos participantes</h2>
              <p className="m-0 text-body-sm text-text-secondary">
                Administra los equipos inscritos en {season.label}.
              </p>
              <Link className={buttonClassName('primary', 'md')} to={`${basePath}/participants`}>
                Administrar Equipos
              </Link>
            </Card>
            <Card className="grid min-w-0 content-start gap-3">
              <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Calendario</h2>
              <p className="m-0 text-body-sm text-text-secondary">
                Consulta fases, jornadas y partidos de la temporada.
              </p>
              <Link className={buttonClassName('primary', 'md')} to={`${basePath}/calendar`}>
                Ver calendario
              </Link>
            </Card>
          </div>
        </>
      ) : null}

      {isParticipants ? (
        <>
          <section className="grid min-w-0 gap-4" aria-labelledby="participants-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="participants-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
                  Equipos de la temporada
                </h2>
                <span className="text-caption text-text-subtle">
                  {participants.length} {participants.length === 1 ? 'equipo inscrito' : 'equipos inscritos'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ViewModeToggle value={participantView} onChange={setParticipantView} />
                <Button
                  onClick={() => {
                    setSelectedTeamIds([]);
                    setError(undefined);
                    setParticipantsModal(true);
                  }}
                >
                  Agregar participantes
                </Button>
              </div>
            </div>
            {participants.length === 0 ? (
              <EmptyState
                title="Esta temporada todavía no tiene equipos inscritos"
                description="Agrega participantes para comenzar a organizar el calendario de la temporada."
                icon="♧"
              />
            ) : participantView === 'table' ? (
              <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border-subtle text-caption text-text-secondary">
                      <th scope="col" className="px-4 py-3">
                        Equipo
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(({ team }) => {
                      const tooltipId = `remove-participant-tip-${team.id}`;
                      return (
                        <tr key={team.id} className="border-b border-border-subtle last:border-0">
                          <th scope="row" className="px-4 py-4 font-display text-body-md font-bold text-text-primary">
                            {team.name}
                            {team.region ? (
                              <span className="mt-1 block font-sans text-body-sm font-normal text-text-secondary">
                                {team.region}
                              </span>
                            ) : null}
                          </th>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <span className="group relative inline-flex">
                                <IconButton
                                  label={`Quitar ${team.name} de esta temporada`}
                                  title="Quitar de esta temporada"
                                  aria-describedby={tooltipId}
                                  tone="danger"
                                  disabled={removingTeamId !== undefined}
                                  onClick={() => void removeTeam(team.id)}
                                >
                                  <Icon name="trash" />
                                </IconButton>
                                <span
                                  id={tooltipId}
                                  role="tooltip"
                                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
                                >
                                  Quitar de esta temporada
                                </span>
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {participants.map(({ team }) => {
                  const tooltipId = `remove-participant-card-tip-${team.id}`;
                  return (
                    <li key={team.id} className="min-w-0">
                      <Card as="article" className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                            {team.name}
                          </h3>
                          {team.region ? (
                            <p className="m-0 mt-1 text-body-sm text-text-secondary">{team.region}</p>
                          ) : null}
                        </div>
                        <span className="group relative inline-flex">
                          <IconButton
                            label={`Quitar ${team.name} de esta temporada`}
                            title="Quitar de esta temporada"
                            aria-describedby={tooltipId}
                            tone="danger"
                            disabled={removingTeamId !== undefined}
                            onClick={() => void removeTeam(team.id)}
                          >
                            {removingTeamId === team.id ? (
                              <span aria-hidden="true" className="text-caption">
                                …
                              </span>
                            ) : (
                              <Icon name="trash" />
                            )}
                          </IconButton>
                          <span
                            id={tooltipId}
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
                          >
                            Quitar de esta temporada
                          </span>
                        </span>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {isParticipants && participantsModal ? (
        <Modal
          title="Agregar participantes"
          closeDisabled={adding}
          onClose={() => {
            if (!adding) setParticipantsModal(false);
          }}
        >
          <form className="grid min-w-0 gap-4" onSubmit={(event) => void addTeam(event)}>
            {availableTeams.length ? (
              <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
                <legend className="mb-2 text-body-sm font-semibold text-text-primary">
                  Selecciona uno o varios equipos
                </legend>
                {availableTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex min-h-touch min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 text-body-sm text-text-primary hover:border-border-strong"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-brand-gold focus-studio"
                      checked={selectedTeamIds.includes(team.id)}
                      disabled={adding}
                      onChange={(event) =>
                        setSelectedTeamIds((current) =>
                          event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id),
                        )
                      }
                    />
                    <span className="min-w-0">{teamLabel(team)}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="grid min-w-0 gap-2" role="status">
                <p className="m-0 text-body-sm font-semibold text-text-primary">
                  No hay más equipos disponibles para inscribir.
                </p>
                {teams.length === 0 ? (
                  <p className="m-0 text-body-sm text-text-secondary">
                    Primero asocia equipos a esta competición desde{' '}
                    <Link
                      className="text-text-link underline underline-offset-2 focus-studio"
                      to={`/competitions/${competitionId}/teams`}
                    >
                      Equipos de la competición
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="m-0 text-body-sm text-text-secondary">
                    Todos los equipos asociados a la competición ya participan en esta temporada.
                  </p>
                )}
              </div>
            )}
            <p className="m-0 text-caption text-text-secondary" aria-live="polite">
              {selectedTeamIds.length} {selectedTeamIds.length === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}
            </p>
            {problem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setParticipantsModal(false)} cancelDisabled={adding}>
              <Button type="submit" disabled={adding || selectedTeamIds.length === 0}>
                {adding ? 'Agregando…' : 'Agregar seleccionados'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}

      {isCalendar ? (
        <section className="grid min-w-0 gap-5" aria-labelledby="calendar-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="calendar-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
              Calendario de {season.label}
            </h2>
            <span className="text-caption text-text-subtle">{matches.length} partidos</span>
          </div>
          <Tabs
            id="calendar-organization"
            label="Organización del calendario"
            options={[
              { value: 'stages', label: 'Fases' },
              { value: 'direct', label: 'Jornadas directas' },
            ]}
            value={calendarTab}
            onChange={setCalendarTab}
          />
          <div
            id={tabPanelId('calendar-organization', 'stages')}
            role="tabpanel"
            aria-labelledby="calendar-organization-tab-stages"
            tabIndex={0}
            hidden={calendarTab !== 'stages'}
            className={`${calendarTab === 'stages' ? 'grid' : 'hidden'} min-w-0 gap-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0 font-display text-heading-sm font-bold text-text-primary">Fases</h3>
              <Button
                onClick={() => {
                  setStageName('');
                  setError(undefined);
                  setStageModal(true);
                }}
              >
                Crear fase
              </Button>
            </div>
            {stages.length ? (
              <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {stages.map((stage) => {
                  const stageRounds = rounds.filter((round) => round.stageId === stage.id);
                  const count = matches.filter((match) => match.stage?.id === stage.id).length;
                  return (
                    <li key={stage.id} className="min-w-0">
                      <Card className="grid min-w-0 content-start gap-2">
                        <Link
                          className="min-h-touch content-center font-display text-heading-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
                          to={`${basePath}/calendar/stages/${stage.id}`}
                        >
                          {stage.name}
                        </Link>
                        <p className="m-0 text-caption text-text-secondary">
                          {stageRounds.length} jornadas · {count} partidos
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Sin fases configuradas"
                description="Crea una fase si la temporada necesita esta organización."
                icon="⌁"
              />
            )}
          </div>
          <div
            id={tabPanelId('calendar-organization', 'direct')}
            role="tabpanel"
            aria-labelledby="calendar-organization-tab-direct"
            tabIndex={0}
            hidden={calendarTab !== 'direct'}
            className={`${calendarTab === 'direct' ? 'grid' : 'hidden'} min-w-0 gap-4`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="m-0 font-display text-heading-sm font-bold text-text-primary">Jornadas directas</h3>
              <div className="flex flex-wrap items-end justify-end gap-2">
                <RoundStatusFilterControl
                  id="direct-round-status-filter"
                  value={roundStatusFilter}
                  onChange={setRoundStatusFilter}
                />
                <Button
                  onClick={() => {
                    setRoundName('');
                    setRoundStageId('');
                    setError(undefined);
                    setRoundModal(true);
                  }}
                >
                  Crear jornada
                </Button>
              </div>
            </div>
            {directRounds.length && filteredDirectRounds.length ? (
              <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDirectRounds.map((round) => {
                  const currentMatches = matchesForRound(round.id);
                  return (
                    <li key={round.id} className="min-w-0">
                      <Card className="grid gap-2">
                        <Link
                          className="min-h-touch content-center font-display text-heading-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
                          to={`${basePath}/calendar/rounds/${round.id}`}
                        >
                          {round.name}
                        </Link>
                        <RoundStatusIndicator matches={currentMatches} />
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : directRounds.length ? (
              <EmptyState
                title="No hay jornadas con este estado"
                description="Selecciona otro filtro para consultar las jornadas directas."
                icon="⌁"
              />
            ) : (
              <EmptyState
                title="Sin jornadas directas"
                description="Crea una jornada cuando la temporada no se organiza por fases."
                icon="⌁"
              />
            )}
          </div>
          {ungroupedMatches.length ? (
            <Card className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-body-sm text-text-secondary">
                Hay {ungroupedMatches.length} partidos por organizar.
              </p>
              <Link className={buttonClassName('secondary', 'sm')} to={`${basePath}/calendar/unassigned`}>
                Revisar partidos
              </Link>
            </Card>
          ) : null}
        </section>
      ) : null}

      {isStageDetail ? (
        <section className="grid min-w-0 gap-4" aria-labelledby="stage-detail-title">
          {!selectedStage ? (
            <EmptyState
              title="No encontramos esta fase"
              description="Regresa al calendario para elegir otra fase."
              icon="⌁"
            />
          ) : (
            <>
              <Card className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-caption font-bold text-brand-gold">Fase</p>
                  <p className="m-0 mt-1 text-body-sm text-text-secondary">
                    {rounds.filter((round) => round.stageId === selectedStage.id).length} jornadas ·{' '}
                    {matches.filter((match) => match.stage?.id === selectedStage.id).length} partidos
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setEditingStage(selectedStage)}>
                  Editar
                </Button>
              </Card>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3 className="m-0 font-display text-heading-sm font-bold text-text-primary">Jornadas</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <RoundStatusFilterControl
                    id="stage-round-status-filter"
                    value={roundStatusFilter}
                    onChange={setRoundStatusFilter}
                  />
                  <ViewModeToggle value={roundView} onChange={setRoundView} />
                  <Button
                    onClick={() => {
                      setRoundName('');
                      setRoundStageId(selectedStage.id);
                      setError(undefined);
                      setRoundModal(true);
                    }}
                  >
                    Crear jornada
                  </Button>
                </div>
              </div>
              {selectedStageRounds.length && filteredSelectedStageRounds.length ? (
                roundView === 'table' ? (
                  <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border-subtle text-caption text-text-secondary">
                          <th className="px-4 py-3">Jornada</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSelectedStageRounds.map((round) => {
                          const currentMatches = matchesForRound(round.id);
                          const count = currentMatches.length;
                          const tooltip =
                            count > 0 ? 'No puedes eliminar una jornada con partidos' : 'Eliminar jornada';
                          const tooltipId = `delete-round-tip-${round.id}`;
                          return (
                            <tr key={round.id} className="border-b border-border-subtle last:border-0">
                              <th scope="row" className="px-4 py-4 font-bold text-text-primary">
                                {round.name}
                              </th>
                              <td className="px-4 py-4">
                                <RoundStatusIndicator matches={currentMatches} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Link
                                    className={buttonClassName('secondary', 'sm')}
                                    to={`${basePath}/calendar/stages/${selectedStage.id}/rounds/${round.id}`}
                                  >
                                    Ver jornada
                                  </Link>
                                  <Button variant="quiet" size="sm" onClick={() => setEditingRound(round)}>
                                    Editar jornada
                                  </Button>
                                  <span className="group relative inline-flex" title={tooltip}>
                                    <IconButton
                                      label={tooltip}
                                      aria-describedby={tooltipId}
                                      disabled={count > 0}
                                      tone="danger"
                                      onClick={() => setDeletingRound(round)}
                                    >
                                      <Icon name="trash" />
                                    </IconButton>
                                    <span
                                      id={tooltipId}
                                      role="tooltip"
                                      className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
                                    >
                                      {tooltip}
                                    </span>
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2">
                    {filteredSelectedStageRounds.map((round) => {
                      const currentMatches = matchesForRound(round.id);
                      const count = currentMatches.length;
                      const tooltip = count > 0 ? 'No puedes eliminar una jornada con partidos' : 'Eliminar jornada';
                      const tooltipId = `delete-round-tip-${round.id}`;
                      return (
                        <li key={round.id}>
                          <Card className="grid gap-3">
                            <h4 className="m-0 font-display text-heading-sm font-bold text-text-primary">
                              {round.name}
                            </h4>
                            <RoundStatusIndicator matches={currentMatches} />
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                className={buttonClassName('secondary', 'sm')}
                                to={`${basePath}/calendar/stages/${selectedStage.id}/rounds/${round.id}`}
                              >
                                Ver jornada
                              </Link>
                              <Button variant="quiet" size="sm" onClick={() => setEditingRound(round)}>
                                Editar jornada
                              </Button>
                              <span className="group relative inline-flex" title={tooltip}>
                                <IconButton
                                  label={tooltip}
                                  aria-describedby={tooltipId}
                                  disabled={count > 0}
                                  tone="danger"
                                  onClick={() => setDeletingRound(round)}
                                >
                                  <Icon name="trash" />
                                </IconButton>
                                <span
                                  id={tooltipId}
                                  role="tooltip"
                                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
                                >
                                  {tooltip}
                                </span>
                              </span>
                            </div>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : selectedStageRounds.length ? (
                <EmptyState
                  title="No hay jornadas con este estado"
                  description="Selecciona otro filtro para consultar las jornadas de esta fase."
                  icon="⌁"
                />
              ) : (
                <EmptyState
                  title="Esta fase no tiene jornadas"
                  description="Crea una jornada para organizar sus partidos."
                  icon="⌁"
                />
              )}
              {stageOnlyMatches.length ? (
                <details className="rounded-xl border border-border-subtle bg-surface-raised p-4">
                  <summary className="min-h-touch cursor-pointer content-center font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio">
                    Partidos existentes asociados directamente a esta fase ({stageOnlyMatches.length})
                  </summary>
                  <p className="mb-0 mt-2 text-body-sm text-text-secondary">
                    Son registros existentes. Puedes conservarlos aquí o reasignarlos a una jornada desde “Cambiar
                    programación”.
                  </p>
                  <ul className="m-0 mt-3 grid min-w-0 list-none gap-3 p-0 lg:grid-cols-2">
                    {stageOnlyMatches.map((match) => (
                      <li key={match.id}>
                        <MatchCard
                          match={match}
                          stages={stages}
                          rounds={rounds}
                          competitionId={competitionId!}
                          seasonId={seasonId!}
                          onUpdated={updateMatch}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {isRoundDetail ? (
        <section className="grid min-w-0 gap-4" aria-labelledby="round-detail-title">
          {!selectedRound ? (
            <EmptyState
              title="No encontramos esta jornada"
              description="Regresa al calendario para elegir otra jornada."
              icon="⚽"
            />
          ) : (
            <>
              <Card className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-caption font-bold text-brand-gold">
                    {selectedRoundStage?.name ?? 'Jornada directa'}
                  </p>
                  <div id="round-detail-title" className="mt-2">
                    <RoundStatusIndicator matches={roundMatches} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roundMatches.length ? (
                    <Link
                      className={buttonClassName('secondary')}
                      to={`/projects/generate?${new URLSearchParams({
                        competitionId: competitionId ?? '',
                        seasonId: seasonId ?? '',
                        roundId: selectedRound.id,
                      }).toString()}`}
                    >
                      Generar contenido
                    </Link>
                  ) : null}
                  <Button variant="secondary" onClick={() => setEditingRound(selectedRound)}>
                    Editar
                  </Button>
                  <Button
                    onClick={() => {
                      setMatchHomeId('');
                      setMatchAwayId('');
                      setMatchKickoff('');
                      setError(undefined);
                      setMatchModal(true);
                    }}
                  >
                    Agregar partido
                  </Button>
                </div>
              </Card>
              {roundMatches.length ? (
                <ul className="m-0 grid min-w-0 list-none gap-3 p-0 lg:grid-cols-2">
                  {roundMatches.map((match) => (
                    <li key={match.id}>
                      <MatchCard
                        match={match}
                        stages={stages}
                        rounds={rounds}
                        competitionId={competitionId!}
                        seasonId={seasonId!}
                        onUpdated={updateMatch}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Aún no hay partidos"
                  description="Agrega el primer encuentro a esta jornada."
                  icon="⚽"
                  action={
                    <Button
                      onClick={() => {
                        setMatchHomeId('');
                        setMatchAwayId('');
                        setMatchKickoff('');
                        setError(undefined);
                        setMatchModal(true);
                      }}
                    >
                      Agregar partido
                    </Button>
                  }
                />
              )}
            </>
          )}
        </section>
      ) : null}

      {isUngrouped ? (
        <section className="grid min-w-0 gap-4" aria-labelledby="ungrouped-title">
          <p id="ungrouped-title" className="m-0 text-body-sm text-text-secondary">
            Estos encuentros existentes pueden organizarse desde “Cambiar programación”.
          </p>
          {ungroupedMatches.length ? (
            <ul className="m-0 grid min-w-0 list-none gap-3 p-0 lg:grid-cols-2">
              {ungroupedMatches.map((match) => (
                <li key={match.id}>
                  <MatchCard
                    match={match}
                    stages={stages}
                    rounds={rounds}
                    competitionId={competitionId!}
                    seasonId={seasonId!}
                    onUpdated={updateMatch}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No hay partidos por organizar"
              description="Los partidos agregados directamente a la temporada aparecerán aquí."
              icon="⚽"
            />
          )}
        </section>
      ) : null}

      {stageModal ? (
        <Modal
          title="Crear fase"
          closeDisabled={calendarBusy}
          onClose={() => {
            if (!calendarBusy) setStageModal(false);
          }}
        >
          <form className="grid gap-4" onSubmit={(event) => void createStage(event)}>
            <Input
              id="stage-name"
              label="Nombre de fase"
              placeholder="Ej. Apertura, fase de liga"
              required
              maxLength={80}
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
            />
            {problem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setStageModal(false)} cancelDisabled={calendarBusy}>
              <Button type="submit" disabled={calendarBusy || !stageName.trim()}>
                {calendarBusy ? 'Guardando…' : 'Crear'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}
      {roundModal ? (
        <Modal
          title="Crear jornada"
          closeDisabled={calendarBusy}
          onClose={() => {
            if (!calendarBusy) setRoundModal(false);
          }}
        >
          <form className="grid gap-4" onSubmit={(event) => void createRound(event)}>
            <Input
              id="round-name"
              label="Nombre de jornada o ronda"
              placeholder="Ej. Jornada 1, semifinal"
              required
              maxLength={80}
              value={roundName}
              onChange={(event) => setRoundName(event.target.value)}
            />
            {problem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setRoundModal(false)} cancelDisabled={calendarBusy}>
              <Button type="submit" disabled={calendarBusy || !roundName.trim()}>
                {calendarBusy ? 'Guardando…' : 'Crear'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}
      {matchModal ? matchCreation : null}
      {editingStage ? (
        <Modal
          title="Editar fase"
          closeDisabled={calendarBusy}
          onClose={() => {
            if (!calendarBusy) setEditingStage(null);
          }}
        >
          <RenameForm
            label="fase"
            value={editingStage.name}
            disabled={calendarBusy}
            onSave={(name) => renameStage(editingStage.id, name)}
            onCancel={() => setEditingStage(null)}
          />
        </Modal>
      ) : null}
      {editingRound ? (
        <Modal
          title="Editar jornada"
          closeDisabled={calendarBusy}
          onClose={() => {
            if (!calendarBusy) setEditingRound(null);
          }}
        >
          <RenameForm
            label="jornada"
            value={editingRound.name}
            disabled={calendarBusy}
            stageId={editingRound.stageId}
            stages={stages}
            onSave={(name, targetStageId) => renameRound(editingRound.id, name, targetStageId ?? null)}
            onCancel={() => setEditingRound(null)}
          />
        </Modal>
      ) : null}
      {deletingRound ? (
        <Modal
          title="Eliminar jornada"
          closeDisabled={calendarBusy}
          onClose={() => {
            if (!calendarBusy) setDeletingRound(null);
          }}
        >
          <div className="grid gap-4">
            <p className="m-0 text-body-sm text-text-secondary">
              ¿Eliminar “{deletingRound.name}”? Esta acción no elimina partidos ni resultados. Si existe historial
              asociado, la operación será rechazada.
            </p>
            {problem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setDeletingRound(null)} cancelDisabled={calendarBusy}>
              <Button variant="danger" disabled={calendarBusy} onClick={() => void deleteRound(deletingRound)}>
                {calendarBusy ? 'Eliminando…' : 'Eliminar jornada'}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}

      {!isSeasonHome && !isParticipants && !isCalendar && !isStageDetail && !isRoundDetail && !isUngrouped ? (
        <EmptyState
          title="Sección no disponible"
          description="Vuelve al resumen de temporada para continuar."
          icon="⌁"
        />
      ) : null}
    </section>
  );
}
