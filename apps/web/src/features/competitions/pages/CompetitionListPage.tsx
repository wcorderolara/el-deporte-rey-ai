import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { CompetitionProviderBinding, ManagedCompetition } from '@edr/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  ViewModeToggle,
  describeError,
} from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';

type ViewMode = 'table' | 'cards';

export function CompetitionListPage() {
  const api = useCompetitionsApi();
  const [items, setItems] = useState<ManagedCompetition[]>([]);
  const [bindings, setBindings] = useState<Record<string, CompetitionProviderBinding | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('table');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const competitions = await api.list(signal);
        const providerBindings = await Promise.all(
          competitions.map(
            async (competition) => [competition.id, await api.getProviderBinding(competition.id, signal)] as const,
          ),
        );
        setItems(competitions);
        setBindings(Object.fromEntries(providerBindings));
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
    if (saving || name.trim().length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const created = await api.create({ name: name.trim() });
      setItems((current) => [created, ...current]);
      setBindings((current) => ({ ...current, [created.id]: null }));
      setName('');
      setCreateOpen(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  }

  const problem = error === undefined ? null : describeError(error);
  const modeLabel = (binding: CompetitionProviderBinding | null | undefined) =>
    binding ? (binding.mode === 'provider' ? 'Provider' : 'Hybrid') : 'Manual';
  const sourceLabel = (binding: CompetitionProviderBinding | null | undefined) =>
    binding ? `${binding.providerName} · Vinculación configurada` : 'Sin proveedor vinculado';
  const actionLink = (item: ManagedCompetition) => (
    <Link
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-control border border-border-default bg-transparent px-3 text-text-link underline decoration-from-font underline-offset-4 hover:bg-surface-card hover:text-text-primary focus-studio"
      to={`/competitions/${item.id}`}
      aria-label={`Ver competición ${item.name}`}
      title="Ver competición"
    >
      <Icon name="eye" />
    </Link>
  );

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
      <section aria-labelledby="competition-list-title" className="grid min-w-0 gap-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 id="competition-list-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
            Tus competiciones
          </h2>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <ViewModeToggle value={view} onChange={setView} />
            <Button
              onClick={() => {
                setError(undefined);
                setCreateOpen(true);
              }}
            >
              Crear competición
            </Button>
          </div>
        </div>
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
        {!loading && items.length > 0 && view === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
            <table className="w-full min-w-[38rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle text-caption text-text-secondary">
                  <th scope="col" className="px-4 py-3">
                    Competición
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fuente de datos
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const binding = bindings[item.id];
                  return (
                    <tr key={item.id} className="border-b border-border-subtle last:border-0">
                      <th scope="row" className="px-4 py-4 font-display text-body-md font-bold text-text-primary">
                        <Link
                          className="text-text-link underline decoration-from-font underline-offset-4 hover:text-text-primary focus-studio"
                          to={`/competitions/${item.id}`}
                        >
                          {item.name}
                        </Link>
                      </th>
                      <td className="px-4 py-4">
                        <Badge tone={binding ? 'info' : 'neutral'}>{modeLabel(binding)}</Badge>
                        <span className="mt-1 block text-caption text-text-secondary">{sourceLabel(binding)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{actionLink(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && items.length > 0 && view === 'cards' ? (
          <ul className="m-0 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const binding = bindings[item.id];
              return (
                <li className="min-w-0" key={item.id}>
                  <Card as="article" className="grid min-w-0 gap-3">
                    <h3 className="m-0 break-normal font-display text-heading-sm font-bold text-text-primary">
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={binding ? 'info' : 'neutral'}>{modeLabel(binding)}</Badge>
                      {binding ? (
                        <span className="text-body-sm text-text-secondary">{binding.providerName}</span>
                      ) : null}
                    </div>
                    <div>{actionLink(item)}</div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      {createOpen ? (
        <Modal title="Crear competición" onClose={() => !saving && setCreateOpen(false)} closeDisabled={saving}>
          <form className="grid gap-4" onSubmit={(event) => void create(event)}>
            <Input
              id="competition-name"
              label="Nombre de la competición"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              autoFocus
            />
            {problem ? (
              <p className="m-0 text-body-sm text-status-danger" role="alert">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setCreateOpen(false)} cancelDisabled={saving}>
              <Button
                type="submit"
                disabled={saving || name.trim().length === 0}
                isLoading={saving}
                loadingLabel="Creando…"
              >
                Crear competición
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
