import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { CompetitionProviderBinding, ExternalCompetition, SportsProvider } from '@edr/contracts';
import { Alert, Button, Card, Modal, ModalFooter, describeError } from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';

type DataMode = 'manual' | 'provider' | 'hybrid';

export function ProviderBindingPanel({ competitionId }: { competitionId: string }) {
  const api = useCompetitionsApi();
  const [providers, setProviders] = useState<SportsProvider[]>([]);
  const [binding, setBinding] = useState<CompetitionProviderBinding | null>(null);
  const [external, setExternal] = useState<ExternalCompetition[]>([]);
  const [providerKey, setProviderKey] = useState('');
  const [externalId, setExternalId] = useState('');
  const [mode, setMode] = useState<DataMode>('manual');
  const [replace, setReplace] = useState(false);
  const [confirmManual, setConfirmManual] = useState(false);
  const [modal, setModal] = useState<'configure' | 'unlink' | null>(null);
  const [busy, setBusy] = useState(false);
  const [externalLoading, setExternalLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<unknown>();
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const [error, setError] = useState<unknown>();
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const catalogueRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [available, current] = await Promise.all([
        api.listSportsProviders(signal),
        api.getProviderBinding(competitionId, signal),
      ]);
      setProviders(available);
      setBinding(current);
      setError(undefined);
    },
    [api, competitionId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause);
    });
    return () => controller.abort();
  }, [refresh]);

  const selectedProvider = providers.find((item) => item.key === providerKey);
  const catalogueProviderKey = modal === 'configure' && mode !== 'manual' ? providerKey : '';
  const providerAvailability = selectedProvider?.availability;

  useEffect(() => {
    catalogueRequest.current?.abort();
    catalogueRequest.current = null;

    if (!catalogueProviderKey || (providerAvailability && providerAvailability !== 'available')) {
      setExternal([]);
      setExternalLoading(false);
      return;
    }

    const controller = new AbortController();
    catalogueRequest.current = controller;
    let current = true;
    setExternalLoading(true);
    setCatalogueError(undefined);
    void api
      .listExternalCompetitions(catalogueProviderKey, controller.signal)
      .then((listing) => {
        if (!current || controller.signal.aborted) return;
        setExternal(listing);
        setExternalId((selectedId) =>
          selectedId && listing.some((item) => item.externalCompetitionId === selectedId) ? selectedId : '',
        );
      })
      .catch((cause: unknown) => {
        if (!current || controller.signal.aborted) return;
        setExternal([]);
        setCatalogueError(cause);
      })
      .finally(() => {
        if (current && !controller.signal.aborted) {
          setExternalLoading(false);
          if (catalogueRequest.current === controller) catalogueRequest.current = null;
        }
      });

    return () => {
      current = false;
      controller.abort();
      if (catalogueRequest.current === controller) catalogueRequest.current = null;
    };
  }, [api, catalogueProviderKey, providerAvailability, catalogueRevision]);

  function openConfigure() {
    setError(undefined);
    setCatalogueError(undefined);
    setSuccess('');
    setFormError('');
    setProviderKey(binding?.providerKey ?? providers[0]?.key ?? '');
    setExternalId(binding?.externalCompetitionId ?? '');
    setMode(binding?.mode ?? 'manual');
    setReplace(false);
    setConfirmManual(false);
    setExternal([]);
    setModal('configure');
  }

  function selectProvider(key: string) {
    if (key === providerKey) return;
    catalogueRequest.current?.abort();
    catalogueRequest.current = null;
    setExternalLoading(false);
    setProviderKey(key);
    setExternalId('');
    setExternal([]);
    setCatalogueError(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!configurationChanged) {
      setFormError('No hay cambios pendientes por guardar.');
      return;
    }
    if (mode !== 'manual' && (!providerKey || !externalId)) {
      setFormError('Selecciona un proveedor disponible y una competición externa.');
      return;
    }
    if (mode !== 'manual' && selectedProvider?.availability !== 'available') {
      setFormError('El proveedor seleccionado no está disponible.');
      return;
    }
    if (mode !== 'manual' && binding && !sameExternalBinding && !replace) {
      setFormError('Confirma el reemplazo de la vinculación actual para continuar.');
      return;
    }
    if (mode === 'manual' && binding && !confirmManual) {
      setFormError('Confirma el cambio a modo Manual para continuar.');
      return;
    }
    setBusy(true);
    setError(undefined);
    setFormError('');
    setSuccess('');
    try {
      if (mode === 'manual') {
        if (binding) await api.removeProviderBinding(competitionId);
        setBinding(null);
        setModal(null);
        setSuccess('La competición quedó en modo Manual. Los datos locales se conservaron.');
        return;
      }
      const next = await api.setProviderBinding(competitionId, {
        providerKey,
        externalCompetitionId: externalId,
        mode,
        ...(binding && !sameExternalBinding && replace ? { replaceExisting: true } : {}),
      });
      setBinding(next);
      setModal(null);
      setReplace(false);
      setSuccess('Configuración de fuente guardada.');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setSuccess('');
    try {
      await api.removeProviderBinding(competitionId);
      setBinding(null);
      setModal(null);
      setSuccess('La competición quedó en modo Manual. Sus datos locales se conservaron.');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const problem = error === undefined ? null : describeError(error);
  const sameExternalBinding = Boolean(
    binding && binding.providerKey === providerKey && binding.externalCompetitionId === externalId,
  );
  const configurationChanged =
    mode === 'manual' ? binding !== null : binding === null || binding.mode !== mode || !sameExternalBinding;
  const saveDisabled =
    busy ||
    !configurationChanged ||
    (mode === 'manual'
      ? Boolean(binding && !confirmManual)
      : !providerKey ||
        !externalId ||
        selectedProvider?.availability !== 'available' ||
        Boolean(binding && !sameExternalBinding && !replace));
  const configurationHint = !configurationChanged
    ? 'No hay cambios pendientes.'
    : mode !== 'manual' && !providerKey
      ? 'Selecciona un proveedor para continuar.'
      : mode !== 'manual' && !externalId
        ? 'Selecciona una competición externa para continuar.'
        : mode !== 'manual' && selectedProvider?.availability !== 'available'
          ? 'El proveedor seleccionado no está disponible.'
          : mode !== 'manual' && binding && !sameExternalBinding && !replace
            ? 'Confirma el reemplazo de la vinculación actual.'
            : mode === 'manual' && binding && !confirmManual
              ? 'Confirma el cambio a modo Manual.'
              : '';
  const unavailableReason = selectedProvider?.availabilityMessage;

  return (
    <Card className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-heading-sm font-bold text-text-primary">Fuente de datos</h2>
          <p className="m-0 mt-1 text-body-sm text-text-secondary">
            {binding ? (
              <>
                {binding.mode === 'provider' ? 'Provider' : 'Hybrid'} · {binding.providerName} ·{' '}
                {binding.externalCompetitionName} · Vinculación configurada
              </>
            ) : (
              'Manual · Los datos se administran localmente.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {binding ? (
            <Link
              className="inline-flex min-h-touch items-center rounded-control border border-border-subtle px-4 py-2.5 text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-2 hover:bg-surface-card focus-studio"
              to={`/competitions/${competitionId}/import`}
            >
              Importar datos
            </Link>
          ) : null}
          <Button variant="secondary" onClick={openConfigure}>
            {binding ? 'Configurar fuente' : 'Configurar fuente de datos'}
          </Button>
          {binding ? (
            <Button
              variant="danger"
              onClick={() => {
                setError(undefined);
                setModal('unlink');
              }}
            >
              Desvincular
            </Button>
          ) : null}
        </div>
      </div>
      {problem ? (
        <Alert role="alert" tone="danger" title="No se pudo actualizar la fuente">
          <p className="m-0">{problem.message}</p>
          <Button variant="secondary" onClick={() => void refresh()}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      {success ? (
        <p className="m-0 text-body-sm text-status-success" role="status">
          {success}
        </p>
      ) : null}
      {modal === 'configure' ? (
        <Modal title="Configurar fuente de datos" closeDisabled={busy} onClose={() => !busy && setModal(null)}>
          <form className="grid gap-4" onSubmit={(event) => void save(event)}>
            <p className="m-0 text-body-sm text-text-secondary">
              Elige cómo administrar los datos de esta competición. Las credenciales se mantienen en el servidor.
            </p>
            <label className="grid gap-1 text-body-sm font-semibold text-text-primary" htmlFor="data-mode">
              Modo de administración
              <select
                id="data-mode"
                className="min-h-11 rounded-xl border border-border-subtle bg-surface-raised px-3 text-text-primary focus-studio"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as DataMode);
                  setFormError('');
                }}
              >
                <option value="manual">Manual</option>
                <option value="provider">Provider</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            {mode !== 'manual' ? (
              <>
                {providers.length === 0 ? (
                  <Alert tone="info" title="No hay proveedores disponibles">
                    <p className="m-0">
                      Solicita al administrador que configure y habilite un proveedor deportivo en el servidor.
                    </p>
                  </Alert>
                ) : null}
                <label className="grid gap-1 text-body-sm font-semibold text-text-primary" htmlFor="provider-key">
                  Proveedor
                  <select
                    id="provider-key"
                    className="min-h-11 rounded-xl border border-border-subtle bg-surface-raised px-3 text-text-primary focus-studio"
                    value={providerKey}
                    onChange={(event) => {
                      setFormError('');
                      selectProvider(event.target.value);
                    }}
                    disabled={busy}
                  >
                    <option value="">Selecciona un proveedor</option>
                    {providers.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                        {item.availability !== 'available' ? ' · No disponible' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {unavailableReason ? (
                  <Alert tone="info" title={`${selectedProvider?.name ?? 'Proveedor'} no disponible`}>
                    <p className="m-0">{unavailableReason}</p>
                  </Alert>
                ) : null}
                <label
                  className="grid gap-1 text-body-sm font-semibold text-text-primary"
                  htmlFor="external-competition"
                >
                  Competición externa
                  <select
                    id="external-competition"
                    className="min-h-11 rounded-xl border border-border-subtle bg-surface-raised px-3 text-text-primary focus-studio"
                    value={externalId}
                    onChange={(event) => {
                      setExternalId(event.target.value);
                      setFormError('');
                    }}
                    disabled={
                      busy || externalLoading || !external.length || selectedProvider?.availability !== 'available'
                    }
                  >
                    <option value="">
                      {externalLoading
                        ? 'Cargando competiciones…'
                        : !providerKey
                          ? 'Selecciona primero un proveedor'
                          : catalogueError !== undefined
                            ? 'No se pudieron cargar las competiciones'
                            : external.length
                              ? 'Selecciona una competición'
                              : 'No hay competiciones disponibles'}
                    </option>
                    {external.map((item) => (
                      <option key={item.externalCompetitionId} value={item.externalCompetitionId}>
                        {item.name}
                        {item.areaName ? ` · ${item.areaName}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {externalLoading ? (
                  <p className="m-0 text-body-sm text-text-secondary" role="status">
                    Cargando competiciones…
                  </p>
                ) : null}
                {catalogueError !== undefined ? (
                  <Alert role="alert" tone="danger" title="No se pudieron cargar las competiciones">
                    <p className="m-0">{describeError(catalogueError).message}</p>
                    <Button variant="secondary" onClick={() => setCatalogueRevision((revision) => revision + 1)}>
                      Reintentar
                    </Button>
                  </Alert>
                ) : null}
              </>
            ) : null}
            {mode === 'manual' && binding ? (
              <label className="flex items-start gap-2 text-body-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={confirmManual}
                  onChange={(event) => setConfirmManual(event.target.checked)}
                />
                Confirmo cambiar a Manual y desvincular el proveedor. No se borrarán datos deportivos ni historiales.
              </label>
            ) : null}
            {mode !== 'manual' && binding && !sameExternalBinding ? (
              <label className="flex items-start gap-2 text-body-sm text-text-secondary">
                <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                Confirmo reemplazar la vinculación actual. Los datos locales se conservarán.
              </label>
            ) : null}
            {problem ? (
              <p className="m-0 text-body-sm text-status-danger" role="alert">
                {problem.message}
              </p>
            ) : null}
            {formError ? (
              <p className="m-0 text-body-sm text-status-danger" role="alert">
                {formError}
              </p>
            ) : configurationHint ? (
              <p className="m-0 text-body-sm text-text-secondary" role="status">
                {configurationHint}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setModal(null)} cancelDisabled={busy}>
              <Button type="submit" disabled={saveDisabled} isLoading={busy} loadingLabel="Guardando configuración">
                Guardar configuración
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}
      {modal === 'unlink' ? (
        <Modal title="Desvincular proveedor" closeDisabled={busy} onClose={() => !busy && setModal(null)}>
          <div className="grid gap-4">
            <p className="m-0 text-body-sm text-text-secondary">
              La competición volverá al modo Manual. Los datos deportivos locales y sus historiales no se eliminarán.
            </p>
            {problem ? (
              <p role="alert" className="m-0 text-body-sm text-status-danger">
                {problem.message}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setModal(null)} cancelDisabled={busy}>
              <Button variant="danger" disabled={busy} onClick={() => void unlink()}>
                {busy ? 'Desvinculando…' : 'Desvincular'}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}
