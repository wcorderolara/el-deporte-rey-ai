import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { ManagedSeason, ManagedTeam, SeasonParticipant } from '@edr/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Select,
  buttonClassName,
  describeError,
} from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';

function teamLabel(team: ManagedTeam): string {
  return team.region ? team.name + ' · ' + team.region : team.name;
}

export function SeasonDetailPage() {
  const { competitionId, seasonId } = useParams();
  const api = useCompetitionsApi();
  const [season, setSeason] = useState<ManagedSeason>();
  const [teams, setTeams] = useState<ManagedTeam[]>([]);
  const [participants, setParticipants] = useState<SeasonParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamRegion, setTeamRegion] = useState('');
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId || !seasonId) return;
      setLoading(true);
      try {
        const [currentSeason, currentTeams, currentParticipants] = await Promise.all([
          api.getSeason(competitionId, seasonId, signal),
          api.listTeams(signal),
          api.listParticipants(competitionId, seasonId, signal),
        ]);
        setSeason(currentSeason);
        setTeams(currentTeams);
        setParticipants(currentParticipants);
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
    if (!competitionId || !seasonId || !selectedTeamId) return;
    setAdding(true);
    setError(undefined);
    try {
      const participant = await api.addParticipant(competitionId, seasonId, selectedTeamId);
      setParticipants((current) =>
        [...current, participant].sort((a, b) => a.team.name.localeCompare(b.team.name, 'es')),
      );
      setSelectedTeamId('');
    } catch (cause) {
      setError(cause);
    } finally {
      setAdding(false);
    }
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(undefined);
    try {
      const team = await api.createTeam({ name: teamName.trim(), region: teamRegion.trim() || null });
      setTeams((current) => [...current, team].sort((a, b) => teamLabel(a).localeCompare(teamLabel(b), 'es')));
      setSelectedTeamId(team.id);
      setTeamName('');
      setTeamRegion('');
    } catch (cause) {
      setError(cause);
    } finally {
      setCreating(false);
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
  return (
    <section className="grid min-w-0 gap-6" aria-labelledby="season-detail-title">
      <header>
        <p className="m-0 mb-2 text-caption font-bold tracking-label text-brand-gold uppercase">
          Equipos participantes
        </p>
        <h1
          id="season-detail-title"
          className="m-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
        >
          {season.label}
        </h1>
      </header>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo completar la operación">
          <p className="m-0">{problem.message}</p>
        </Alert>
      ) : null}

      <Card className="grid min-w-0 gap-5">
        <div>
          <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Añadir un equipo</h2>
          <p className="m-0 mt-1 text-body-sm text-text-secondary">
            Selecciona un equipo local existente o crea uno para reutilizarlo en otras temporadas.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => void addTeam(event)}
        >
          <Select
            id="participant-team"
            label="Equipo del catálogo local"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            disabled={availableTeams.length === 0}
          >
            <option value="">{availableTeams.length ? 'Selecciona un equipo' : 'No hay equipos disponibles'}</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {teamLabel(team)}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={adding || !selectedTeamId}>
            {adding ? 'Añadiendo…' : 'Añadir a la temporada'}
          </Button>
        </form>
        <details className="border-t border-border-subtle pt-4">
          <summary className="min-h-touch cursor-pointer content-center font-sans text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 focus-studio">
            Crear equipo local
          </summary>
          <form className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={(event) => void createTeam(event)}>
            <Input
              id="team-name"
              label="Nombre del equipo"
              required
              maxLength={64}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
            <Input
              id="team-region"
              label="Zona o ciudad (opcional)"
              maxLength={80}
              value={teamRegion}
              onChange={(event) => setTeamRegion(event.target.value)}
            />
            <Button type="submit" className="sm:col-span-2" disabled={creating || teamName.trim().length === 0}>
              {creating ? 'Guardando…' : 'Guardar en el catálogo'}
            </Button>
          </form>
        </details>
      </Card>

      <section className="grid min-w-0 gap-4" aria-labelledby="participants-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="participants-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
            Equipos de la temporada
          </h2>
          <span className="text-caption text-text-subtle">
            {participants.length} {participants.length === 1 ? 'equipo' : 'equipos'}
          </span>
        </div>
        {participants.length === 0 ? (
          <EmptyState
            title="Aún no hay participantes"
            description="Añade un equipo del catálogo o crea uno local."
            icon="♧"
          />
        ) : null}
        {participants.length > 0 ? (
          <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {participants.map(({ team }) => (
              <li key={team.id} className="min-w-0">
                <Card as="article" className="grid min-w-0 gap-3">
                  <div aria-hidden="true" className="text-brand-gold">
                    ♧
                  </div>
                  <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                    {team.name}
                  </h3>
                  {team.region ? <p className="m-0 text-body-sm text-text-secondary">{team.region}</p> : null}
                  <Button
                    variant="quiet"
                    className="w-full"
                    disabled={removingTeamId !== undefined}
                    onClick={() => void removeTeam(team.id)}
                  >
                    {removingTeamId === team.id ? 'Quitando…' : 'Quitar de esta temporada'}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <Link className={buttonClassName('secondary', 'sm')} to={'/competitions/' + competitionId}>
        Volver a temporadas
      </Link>
    </section>
  );
}
