import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Card, LoadingState, buttonClassName, describeError } from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';
import type { ManagedCompetition } from '@edr/contracts';

export function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const api = useCompetitionsApi();
  const [item, setItem] = useState<ManagedCompetition>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (!competitionId) return;
    const controller = new AbortController();
    void api
      .get(competitionId, controller.signal)
      .then(setItem)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause);
      });
    return () => controller.abort();
  }, [api, competitionId]);
  if (error !== undefined)
    return (
      <Alert role="alert" tone="danger" title="No se pudo abrir la competición">
        <p className="m-0">{describeError(error).message}</p>
        <Link to="/competitions">Volver a competiciones</Link>
      </Alert>
    );
  if (!item)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando competición…" />
      </Card>
    );
  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="competition-detail-title">
      <Link to="/competitions" className="text-text-link underline underline-offset-2 hover:text-text-primary">
        ← Competiciones
      </Link>
      <header>
        <p className="m-0 mb-2 text-caption font-bold tracking-label text-brand-gold uppercase">Competición</p>
        <h1
          id="competition-detail-title"
          className="m-0 break-normal font-display text-heading-lg font-extrabold text-text-primary"
        >
          {item.name}
        </h1>
      </header>
      <Card className="grid gap-3">
        <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Espacio de competición</h2>
        <p className="m-0 text-body-md text-text-secondary">
          La competición está guardada localmente. La administración de temporadas, equipos y calendario se añadirá en
          incrementos posteriores.
        </p>
        <p className="m-0 text-caption text-text-subtle">Creada {new Date(item.createdAt).toLocaleDateString('es')}</p>
      </Card>
      <div>
        <Link className={buttonClassName('secondary')} to="/competitions">
          Volver al listado
        </Link>
      </div>
    </section>
  );
}
