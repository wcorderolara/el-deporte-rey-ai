import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { ManagedCompetition, ManagedSeason } from '@edr/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  ViewModeToggle,
  buttonClassName,
  describeError,
} from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';
import { ProviderBindingPanel } from '../components/ProviderBindingPanel';

export function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const api = useCompetitionsApi();
  const [competition, setCompetition] = useState<ManagedCompetition>();
  const [seasons, setSeasons] = useState<ManagedSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [modal, setModal] = useState<'create' | ManagedSeason | null>(null);
  const [label, setLabel] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId) return;
      setLoading(true);
      try {
        const [current, items] = await Promise.all([
          api.get(competitionId, signal),
          api.listSeasons(competitionId, signal),
        ]);
        setCompetition(current);
        setSeasons(items);
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competitionId || !modal) return;
    setBusy(true);
    setError(undefined);
    try {
      const item =
        modal === 'create'
          ? await api.createSeason(competitionId, { label: label.trim() })
          : await api.updateSeason(competitionId, modal.id, { label: label.trim() });
      setSeasons((current) =>
        modal === 'create' ? [item, ...current] : current.map((season) => (season.id === item.id ? item : season)),
      );
      setModal(null);
      setLabel('');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  const problem = error === undefined ? null : describeError(error);
  if (loading)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando competición…" />
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
    <section className="grid min-w-0 gap-5" aria-labelledby="competition-detail-title">
      <nav aria-label="Ruta de navegación" className="text-caption text-text-subtle">
        <Link className="text-text-link underline underline-offset-2 focus-studio" to="/competitions">
          Competiciones
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{competition.name}</span>
      </nav>
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 mb-1 text-caption font-bold tracking-label text-brand-gold uppercase">Competición</p>
          <h1
            id="competition-detail-title"
            className="m-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
          >
            {competition.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClassName('secondary', 'md')} to={`/competitions/${competition.id}/teams`}>
            Equipos
          </Link>
          <Button
            onClick={() => {
              setLabel('');
              setError(undefined);
              setModal('create');
            }}
          >
            Crear temporada
          </Button>
        </div>
      </header>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo guardar la temporada">
          <p className="m-0">{problem.message}</p>
        </Alert>
      ) : null}
      <ProviderBindingPanel competitionId={competition.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">
          Temporadas <span className="text-body-sm font-normal text-text-secondary">({seasons.length})</span>
        </h2>
        <ViewModeToggle value={view} onChange={setView} />
      </div>
      {seasons.length === 0 ? (
        <EmptyState
          title="Aún no hay temporadas"
          description="Crea una temporada para organizar sus equipos y calendario."
          icon="◷"
        />
      ) : view === 'table' ? (
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle text-caption text-text-secondary">
                <th scope="col" className="px-4 py-3">
                  Temporada
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <tr key={season.id} className="border-b border-border-subtle last:border-0">
                  <th scope="row" className="px-4 py-4 font-display text-body-md font-bold text-text-primary">
                    {season.label}
                  </th>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        className={buttonClassName('secondary', 'sm')}
                        to={`/competitions/${competition.id}/seasons/${season.id}`}
                      >
                        Ver detalle
                      </Link>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => {
                          setLabel(season.label);
                          setError(undefined);
                          setModal(season);
                        }}
                      >
                        Editar temporada
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {seasons.map((season) => (
            <li key={season.id} className="min-w-0">
              <Card as="article" className="grid min-w-0 gap-3">
                <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                  {season.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={buttonClassName('secondary', 'sm')}
                    to={`/competitions/${competition.id}/seasons/${season.id}`}
                  >
                    Ver más
                  </Link>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      setLabel(season.label);
                      setError(undefined);
                      setModal(season);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {modal ? (
        <Modal
          title={modal === 'create' ? 'Crear temporada' : 'Editar temporada'}
          closeDisabled={busy}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form className="grid gap-4" onSubmit={(event) => void save(event)}>
            <Input
              id="season-label"
              label="Nombre o periodo"
              description="Por ejemplo, 2026/27 o 2027."
              required
              maxLength={80}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            {problem ? (
              <p className="m-0 text-body-sm text-status-danger" role="alert">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setModal(null)} cancelDisabled={busy}>
              <Button type="submit" disabled={busy || !label.trim()}>
                {busy ? 'Guardando…' : modal === 'create' ? 'Crear' : 'Guardar cambios'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
