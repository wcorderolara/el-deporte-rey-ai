import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { CompetitionTeam, ManagedCompetition, ManagedTeam } from '@edr/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  ViewModeToggle,
  describeError,
} from '../../../ui';
import { ApiError } from '../../../api/client';
import { useCompetitionsApi } from '../CompetitionsContext';
import { TeamBadge } from '../TeamBadge';
import { TeamBadgeManager } from '../TeamBadgeManager';

type AddMode = 'catalogue' | 'create';

function identityKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function ActionIcon({
  label,
  id,
  icon,
  onClick,
  tone = 'default',
}: {
  label: string;
  id: string;
  icon: 'pencil' | 'trash';
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <span className="group relative inline-flex">
      <IconButton label={label} title={label} aria-describedby={id} tone={tone} onClick={onClick}>
        <Icon name={icon} />
      </IconButton>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

export function CompetitionTeamsPage() {
  const { competitionId } = useParams();
  const api = useCompetitionsApi();
  const [competition, setCompetition] = useState<ManagedCompetition>();
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [catalogue, setCatalogue] = useState<ManagedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [modalError, setModalError] = useState<unknown>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<CompetitionTeam | null>(null);
  const [removingTeam, setRemovingTeam] = useState<CompetitionTeam | null>(null);
  const [mode, setMode] = useState<AddMode>('catalogue');
  const [teamId, setTeamId] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [duplicateSuggestion, setDuplicateSuggestion] = useState<ManagedTeam | null>(null);
  const [alreadyAssociated, setAlreadyAssociated] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId) return;
      setLoading(true);
      try {
        const [current, associations, allTeams] = await Promise.all([
          api.get(competitionId, signal),
          api.listCompetitionTeams(competitionId, signal),
          api.listTeams(signal),
        ]);
        setCompetition(current);
        setTeams(associations);
        setCatalogue(allTeams);
        setError(undefined);
      } catch (cause) {
        if (!signal?.aborted) setError(cause);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api, competitionId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const associatedIds = useMemo(() => new Set(teams.map((item) => item.team.id)), [teams]);
  const available = catalogue.filter((team) => !associatedIds.has(team.id));
  const filteredAvailable = available.filter((team) =>
    team.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')),
  );
  const problem = error === undefined ? null : describeError(error);
  const modalProblem = modalError === undefined ? null : describeError(modalError);

  function clearDuplicateNotice() {
    setDuplicateSuggestion(null);
    setAlreadyAssociated(false);
  }
  function openModal() {
    setError(undefined);
    setModalError(undefined);
    clearDuplicateNotice();
    setTeamId('');
    setName('');
    setRegion('');
    setSearch('');
    setMode(available.length ? 'catalogue' : 'create');
    setModalOpen(true);
  }

  async function saveAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competitionId) return;
    setBusy(true);
    setModalError(undefined);
    clearDuplicateNotice();
    try {
      const creating = mode === 'create';
      const item = creating
        ? await api.addCompetitionTeam(competitionId, { name: name.trim(), region: region.trim() || null })
        : await api.addCompetitionTeam(competitionId, { teamId });
      setTeams((current) => [...current, item].sort((a, b) => a.team.name.localeCompare(b.team.name, 'es')));
      if (creating)
        setCatalogue((current) => [...current, item.team].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      setModalOpen(false);
      setTeamId('');
      setName('');
      setRegion('');
    } catch (cause) {
      if (mode === 'create' && cause instanceof ApiError && cause.problem?.code === 'DUPLICATE_TEAM') {
        const duplicate = catalogue.find(
          (team) =>
            identityKey(team.name) === identityKey(name) && identityKey(team.region ?? '') === identityKey(region),
        );
        if (duplicate && associatedIds.has(duplicate.id)) setAlreadyAssociated(true);
        else if (duplicate) {
          setDuplicateSuggestion(duplicate);
          setMode('catalogue');
          setTeamId(duplicate.id);
          setSearch(duplicate.name);
        } else setModalError(cause);
      } else setModalError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTeam) return;
    setBusy(true);
    setModalError(undefined);
    try {
      const updated = await api.updateTeam(editingTeam.team.id, {
        name: editName.trim(),
        region: editRegion.trim() || null,
      });
      setTeams((current) => current.map((item) => (item.team.id === updated.id ? { ...item, team: updated } : item)));
      setCatalogue((current) => current.map((team) => (team.id === updated.id ? updated : team)));
      setEditingTeam(null);
    } catch (cause) {
      setModalError(cause);
    } finally {
      setBusy(false);
    }
  }

  /** The team after a badge change (PD-ARCH-01G-D): updated everywhere it is shown. */
  function badgeChanged(updated: ManagedTeam) {
    setTeams((current) => current.map((item) => (item.team.id === updated.id ? { ...item, team: updated } : item)));
    setCatalogue((current) => current.map((team) => (team.id === updated.id ? updated : team)));
    setEditingTeam((current) => (current === null ? null : { ...current, team: updated }));
  }

  async function confirmRemoval() {
    if (!competitionId || !removingTeam) return;
    setBusy(true);
    setModalError(undefined);
    try {
      await api.removeCompetitionTeam(competitionId, removingTeam.team.id);
      setTeams((current) => current.filter((item) => item.team.id !== removingTeam.team.id));
      setRemovingTeam(null);
    } catch (cause) {
      setModalError(cause);
    } finally {
      setBusy(false);
    }
  }

  function edit(item: CompetitionTeam) {
    setModalError(undefined);
    setEditName(item.team.name);
    setEditRegion(item.team.region ?? '');
    setEditingTeam(item);
  }
  function actions(item: CompetitionTeam) {
    return (
      <div className="flex items-center justify-end gap-2">
        <ActionIcon
          label="Editar equipo"
          id={`edit-team-tip-${item.team.id}`}
          icon="pencil"
          onClick={() => edit(item)}
        />
        <ActionIcon
          label="Quitar de competición"
          id={`remove-team-tip-${item.team.id}`}
          icon="trash"
          tone="danger"
          onClick={() => {
            setModalError(undefined);
            setRemovingTeam(item);
          }}
        />
      </div>
    );
  }

  if (loading)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando equipos de la competición…" />
      </Card>
    );
  if (!competition)
    return (
      <Alert role="alert" tone="danger" title="No se pudo abrir la competición">
        <p className="m-0">{problem?.message ?? 'La competición no está disponible.'}</p>
        <Button variant="quiet" onClick={() => void load()}>
          Reintentar
        </Button>
        <Link to="/competitions">Volver a competiciones</Link>
      </Alert>
    );

  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="competition-teams-title">
      <nav aria-label="Ruta de navegación" className="text-caption text-text-subtle">
        <Link className="text-text-link underline underline-offset-2 focus-studio" to="/competitions">
          Competiciones
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          className="text-text-link underline underline-offset-2 focus-studio"
          to={`/competitions/${competition.id}`}
        >
          {competition.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Equipos</span>
      </nav>
      <header className="grid min-w-0 gap-2">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Equipos de la competición</p>
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <h1
            id="competition-teams-title"
            className="m-0 min-w-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
          >
            {competition.name}
          </h1>
          <Button onClick={openModal}>Agregar equipo</Button>
        </div>
        <Link
          className="inline-flex min-h-touch w-fit items-center rounded-lg px-2 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4 transition-colors hover:bg-surface-card hover:text-text-primary focus-studio"
          to={`/competitions/${competition.id}`}
        >
          Regresar a {competition.name}
        </Link>
      </header>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo completar la operación">
          <p className="m-0">{problem.message}</p>
          <Button variant="quiet" onClick={() => void load()}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">
          Equipos asociados <span className="text-body-sm font-normal text-text-secondary">({teams.length})</span>
        </h2>
        <ViewModeToggle value={view} onChange={setView} />
      </div>
      {teams.length === 0 ? (
        <EmptyState
          title="Aún no hay equipos asociados"
          description="Agrega equipos del catálogo o crea uno nuevo para esta competición."
          icon="♧"
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
          <table className="w-full min-w-[38rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle text-caption text-text-secondary">
                <th scope="col" className="px-4 py-3">
                  Equipo
                </th>
                <th scope="col" className="px-4 py-3">
                  Zona o ciudad
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((item) => (
                <tr key={item.team.id} className="border-b border-border-subtle last:border-0">
                  <th scope="row" className="px-4 py-4 font-display text-body-md font-bold text-text-primary">
                    <span className="flex items-center gap-3">
                      <TeamBadge team={item.team} size="sm" />
                      <span>{item.team.name}</span>
                    </span>
                  </th>
                  <td className="px-4 py-4 text-body-sm text-text-secondary">{item.team.region ?? '—'}</td>
                  <td className="px-4 py-3">{actions(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((item) => (
            <li key={item.team.id} className="min-w-0">
              <Card as="article" className="grid min-w-0 gap-2">
                <div className="flex items-center gap-3">
                  <TeamBadge team={item.team} size="md" />
                  <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                    {item.team.name}
                  </h3>
                </div>
                <p className="m-0 text-body-sm text-text-secondary">{item.team.region ?? 'Sin zona registrada'}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-caption font-semibold text-status-success">Asociado</p>
                  {actions(item)}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <Modal
          title="Agregar equipo a la competición"
          closeDisabled={busy}
          onClose={() => {
            if (!busy) setModalOpen(false);
          }}
        >
          <form className="grid min-w-0 gap-4" onSubmit={(event) => void saveAssociation(event)}>
            <p className="m-0 text-body-sm text-text-secondary">
              Puedes reutilizar equipos registrados en otras competiciones o crear uno nuevo.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo agregar un equipo">
              <Button
                type="button"
                variant={mode === 'catalogue' ? 'secondary' : 'quiet'}
                disabled={!available.length}
                aria-pressed={mode === 'catalogue'}
                onClick={() => {
                  setMode('catalogue');
                  setModalError(undefined);
                  clearDuplicateNotice();
                }}
              >
                Equipo existente
              </Button>
              <Button
                type="button"
                variant={mode === 'create' ? 'secondary' : 'quiet'}
                aria-pressed={mode === 'create'}
                onClick={() => {
                  setMode('create');
                  setModalError(undefined);
                  clearDuplicateNotice();
                }}
              >
                Nuevo equipo
              </Button>
            </div>
            {mode === 'catalogue' ? (
              <div className="grid min-w-0 gap-3">
                <Input
                  id="competition-team-search"
                  label="Buscar equipo por nombre"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    clearDuplicateNotice();
                    setTeamId('');
                  }}
                  disabled={!available.length}
                />
                {filteredAvailable.length ? (
                  <fieldset
                    className="m-0 grid max-h-72 min-w-0 gap-2 overflow-y-auto border-0 p-0"
                    aria-label="Equipos disponibles"
                  >
                    {filteredAvailable.map((team) => (
                      <label
                        key={team.id}
                        className="flex min-h-touch min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 text-body-sm text-text-primary hover:border-border-strong"
                      >
                        <input
                          type="radio"
                          name="competition-team"
                          className="size-5 accent-brand-gold focus-studio"
                          checked={teamId === team.id}
                          onChange={() => setTeamId(team.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">{team.name}</span>
                          {team.region ? (
                            <span className="block text-caption text-text-secondary">{team.region}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <EmptyState
                    title={
                      available.length
                        ? 'No encontramos equipos con ese nombre'
                        : 'No hay equipos registrados disponibles'
                    }
                    description={
                      available.length
                        ? 'Prueba con otra búsqueda o crea un equipo nuevo.'
                        : 'Puedes crear un equipo nuevo para agregarlo a esta competición.'
                    }
                    icon="♧"
                  />
                )}
                {duplicateSuggestion ? (
                  <Alert tone="info" title="Equipo ya registrado">
                    <p className="m-0">
                      Seleccionamos “{duplicateSuggestion.name}” del catálogo. Confirma “Agregar equipo” para
                      reutilizarlo; no se fusionará ningún registro.
                    </p>
                  </Alert>
                ) : null}
                {alreadyAssociated ? (
                  <Alert tone="info" title="El equipo ya pertenece a esta competición">
                    <p className="m-0">No se creó otro equipo ni se modificó ninguna asociación.</p>
                  </Alert>
                ) : null}
              </div>
            ) : (
              <div className="grid min-w-0 gap-3">
                <Input
                  id="competition-new-team-name"
                  label="Nombre del equipo"
                  required
                  maxLength={64}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearDuplicateNotice();
                  }}
                />
                <Input
                  id="competition-new-team-region"
                  label="Zona o ciudad (opcional)"
                  maxLength={80}
                  value={region}
                  onChange={(event) => {
                    setRegion(event.target.value);
                    clearDuplicateNotice();
                  }}
                />
              </div>
            )}
            {modalProblem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {modalProblem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setModalOpen(false)} cancelDisabled={busy}>
              <Button type="submit" disabled={busy || (mode === 'catalogue' ? !teamId : !name.trim())}>
                {busy ? 'Guardando…' : 'Agregar equipo'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}

      {editingTeam ? (
        <Modal
          title="Editar equipo"
          closeDisabled={busy}
          onClose={() => {
            if (!busy) setEditingTeam(null);
          }}
        >
          <form className="grid min-w-0 gap-4" onSubmit={(event) => void saveEdit(event)}>
            <p className="m-0 text-body-sm text-text-secondary">
              Los cambios afectan al equipo global y se reflejan en todas las competiciones donde se reutiliza.
            </p>
            <Input
              id="edit-team-name"
              label="Nombre del equipo"
              required
              maxLength={64}
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
            <Input
              id="edit-team-region"
              label="Zona o ciudad (opcional)"
              maxLength={80}
              value={editRegion}
              onChange={(event) => setEditRegion(event.target.value)}
            />
            {modalProblem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {modalProblem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setEditingTeam(null)} cancelDisabled={busy}>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !editName.trim() ||
                  (editName.trim() === editingTeam.team.name && (editRegion.trim() || null) === editingTeam.team.region)
                }
              >
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </ModalFooter>
          </form>
          <div className="mt-5">
            <TeamBadgeManager team={editingTeam.team} api={api} onChanged={badgeChanged} />
          </div>
        </Modal>
      ) : null}

      {removingTeam ? (
        <Modal
          title="Quitar equipo de la competición"
          closeDisabled={busy}
          onClose={() => {
            if (!busy) setRemovingTeam(null);
          }}
        >
          <div className="grid min-w-0 gap-4">
            <p className="m-0 text-body-sm text-text-secondary">
              ¿Quitar a <strong className="text-text-primary">{removingTeam.team.name}</strong> de {competition.name}?
              El equipo global se conservará. No se puede quitar mientras participe en alguna temporada de esta
              competición.
            </p>
            {modalProblem ? (
              <Alert role="alert" tone="danger" title="No se pudo quitar el equipo">
                <p className="m-0">{modalProblem.message}</p>
              </Alert>
            ) : null}
            <ModalFooter onCancel={() => setRemovingTeam(null)} cancelDisabled={busy}>
              <Button variant="danger" disabled={busy} onClick={() => void confirmRemoval()}>
                {busy ? 'Quitando…' : 'Quitar de competición'}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
