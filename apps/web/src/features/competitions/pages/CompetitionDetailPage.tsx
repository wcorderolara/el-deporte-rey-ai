import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { ManagedCompetition, ManagedSeason } from '@edr/contracts';
import { Alert, Button, Card, EmptyState, Input, LoadingState, buttonClassName, describeError } from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';

export function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const api = useCompetitionsApi();
  const [competition, setCompetition] = useState<ManagedCompetition>();
  const [seasons, setSeasons] = useState<ManagedSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [label, setLabel] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId) return;
      setLoading(true);
      try {
        const [currentCompetition, currentSeasons] = await Promise.all([
          api.get(competitionId, signal),
          api.listSeasons(competitionId, signal),
        ]);
        setCompetition(currentCompetition);
        setSeasons(currentSeasons);
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

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competitionId) return;
    setSaving(true);
    setError(undefined);
    try {
      const created = await api.createSeason(competitionId, { label: label.trim() });
      setSeasons((current) => [created, ...current]);
      setLabel('');
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  }

  const problem = error === undefined ? null : describeError(error);
  if (loading)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando competición…" />
      </Card>
    );
  if (!competition) {
    return (
      <Alert role="alert" tone="danger" title="No se pudo abrir la competición">
        <p className="m-0">{problem?.message ?? 'La competición no está disponible.'}</p>
        <Button variant="quiet" onClick={() => void load()}>
          Reintentar
        </Button>
        <Link to="/competitions">Volver a competiciones</Link>
      </Alert>
    );
  }

  return (
    <section className="grid min-w-0 gap-6" aria-labelledby="competition-detail-title">
      <header>
        <p className="m-0 mb-2 text-caption font-bold tracking-label text-brand-gold uppercase">Competición</p>
        <h1
          id="competition-detail-title"
          className="m-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
        >
          {competition.name}
        </h1>
      </header>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo guardar la temporada">
          <p className="m-0">{problem.message}</p>
        </Alert>
      ) : null}
      <Card className="grid min-w-0 gap-4">
        <div>
          <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Temporadas</h2>
          <p className="m-0 mt-1 text-body-sm text-text-secondary">
            Cada temporada conserva su propio equipo participante.
          </p>
        </div>
        <form
          className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => void createSeason(event)}
        >
          <Input
            id="season-label"
            label="Nombre o periodo"
            description="Por ejemplo, 2026/27 o 2027."
            required
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button type="submit" disabled={saving || label.trim().length === 0}>
            {saving ? 'Guardando…' : 'Crear temporada'}
          </Button>
        </form>
      </Card>
      {!loading && seasons.length === 0 ? (
        <EmptyState
          title="Aún no hay temporadas"
          description="Crea una temporada para comenzar a organizar sus equipos."
          icon="◷"
        />
      ) : null}
      {seasons.length > 0 ? (
        <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {seasons.map((season) => (
            <li key={season.id} className="min-w-0">
              <Card as="article" className="grid min-w-0 gap-3">
                <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Temporada</p>
                <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                  {season.label}
                </h3>
                <Link
                  className={buttonClassName('secondary', 'sm')}
                  to={'/competitions/' + competition.id + '/seasons/' + season.id}
                >
                  Administrar equipos
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
