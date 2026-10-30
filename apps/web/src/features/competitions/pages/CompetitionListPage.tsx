import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card, EmptyState, Input, LoadingState, buttonClassName, describeError } from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';
import type { ManagedCompetition } from '@edr/contracts';

export function CompetitionListPage() {
  const api = useCompetitionsApi();
  const [items, setItems] = useState<ManagedCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        setItems(await api.list(signal));
        setError(undefined);
      } catch (cause) {
        if (!signal?.aborted) setError(cause);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const created = await api.create({ name: name.trim() });
      setItems((current) => [created, ...current]);
      setName('');
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  }

  const problem = error === undefined ? null : describeError(error);
  return (
    <section aria-labelledby="competitions-title" className="grid min-w-0 gap-6">
      <header>
        <p className="m-0 mb-2 text-caption font-bold tracking-label text-brand-gold uppercase">Administración local</p>
        <h1 id="competitions-title" className="m-0 font-display text-heading-lg font-extrabold text-text-primary">
          Competiciones
        </h1>
        <p className="m-0 mt-2 max-w-reading text-body-md text-text-secondary">
          Organiza competiciones para reutilizar su información en distintos contenidos.
        </p>
      </header>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo completar la operación">
          <p className="m-0">{problem.message}</p>
          <Button variant="quiet" onClick={() => void load()}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      <Card className="grid min-w-0 gap-4">
        <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Crear competición</h2>
        <form
          className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => void create(event)}
        >
          <Input
            id="competition-name"
            label="Nombre de la competición"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <Button type="submit" disabled={saving || name.trim().length === 0}>
            {saving ? 'Guardando…' : 'Crear competición'}
          </Button>
        </form>
      </Card>
      <section aria-labelledby="competition-list-title" className="grid min-w-0 gap-4">
        <h2 id="competition-list-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
          Tus competiciones
        </h2>
        {loading ? (
          <Card>
            <LoadingState layout="panel" label="Cargando competiciones…" />
          </Card>
        ) : null}
        {!loading && !problem && items.length === 0 ? (
          <EmptyState
            title="Aún no hay competiciones"
            description="Crea una competición para iniciar su administración local."
            icon="◉"
          />
        ) : null}
        {!loading && items.length > 0 ? (
          <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li className="min-w-0" key={item.id}>
                <Card as="article" className="grid min-w-0 gap-3">
                  <div aria-hidden="true" className="text-brand-gold">
                    ◉
                  </div>
                  <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                    {item.name}
                  </h3>
                  <Link className={buttonClassName('secondary')} to={`/competitions/${item.id}`}>
                    Ver competición
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
