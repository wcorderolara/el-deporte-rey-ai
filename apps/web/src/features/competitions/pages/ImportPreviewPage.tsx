import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  type ImportPreview,
  type ImportOperation,
  ImportOperationEventSchema,
  type ImportPreviewItem,
  type ImportResource,
  type ImportResourceCapability,
  type ManagedCompetition,
  type ManagedSeason,
  type ExternalSeasonOption,
} from '@edr/contracts';
import { ApiError } from '../../../api/client';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  LoadingState,
  Select,
  Tabs,
  tabPanelId,
  ViewModeToggle,
  buttonClassName,
  describeError,
} from '../../../ui';
import { useCompetitionsApi } from '../CompetitionsContext';

const labels: Record<ImportResource, string> = {
  season: 'Temporada',
  teams: 'Equipos',
  participants: 'Participantes',
  stages: 'Fases',
  rounds: 'Jornadas',
  matches: 'Partidos',
  results: 'Resultados',
};
const resourceOrder: ImportResource[] = ['season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results'];
const operationLabels: Record<ImportPreviewItem['operation'], string> = {
  new: 'Nuevo',
  changed: 'Cambiaría',
  unchanged: 'Sin cambios',
  conflict: 'Conflicto',
  invalid: 'Inválido',
  skipped: 'Omitido',
};
const operationKeys = ['new', 'changed', 'unchanged', 'conflicts', 'invalid', 'skipped'] as const;
const operationNames: Record<(typeof operationKeys)[number], string> = {
  new: 'Nuevos',
  changed: 'Actualizaciones',
  unchanged: 'Sin cambios',
  conflicts: 'Conflictos',
  invalid: 'Inválidos',
  skipped: 'Omitidos',
};
const operationForFilter: Record<string, ImportPreviewItem['operation']> = {
  new: 'new',
  changed: 'changed',
  unchanged: 'unchanged',
  conflicts: 'conflict',
  invalid: 'invalid',
  skipped: 'skipped',
};
const pageSize = 25;
function valueText(value: unknown): string {
  return value === null ? 'Sin dato' : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);
}
function itemField(item: ImportPreviewItem, name: string) {
  return item.fields.find((field) => field.name === name)?.incomingValue ?? null;
}
function OperationBadge({ operation }: { operation: ImportPreviewItem['operation'] }) {
  const tone =
    operation === 'invalid' || operation === 'conflict'
      ? 'border-warning bg-warning-surface text-warning'
      : operation === 'skipped'
        ? 'border-border-subtle bg-surface-raised text-text-secondary'
        : 'border-info bg-info-surface text-info';
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2 text-caption font-semibold ${tone}`}>
      {operationLabels[operation]}
    </span>
  );
}

function DisclosureSummary({ children }: { children: ReactNode }) {
  return (
    <summary
      className={buttonClassName(
        'secondaryFilled',
        'sm',
        'w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden',
      )}
    >
      {children}
      <span className="transition-transform duration-fast group-open:rotate-180" aria-hidden="true">
        <Icon name="chevron-down" size={18} />
      </span>
    </summary>
  );
}

function ItemDetail({ item }: { item: ImportPreviewItem }) {
  return (
    <details className="group mt-2">
      <DisclosureSummary>Revisar datos y diferencias</DisclosureSummary>
      <dl className="mt-2 grid min-w-0 gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-secondary">Referencia externa</dt>
          <dd className="m-0 break-all text-text-primary">{item.externalId}</dd>
        </div>
        {item.externalScope ? (
          <div>
            <dt className="text-text-secondary">Contexto externo</dt>
            <dd className="m-0 text-text-primary">{item.externalScope}</dd>
          </div>
        ) : null}
        {item.localCandidate ? (
          <div>
            <dt className="text-text-secondary">Posible registro local</dt>
            <dd className="m-0 text-text-primary">{item.localCandidate.label}</dd>
          </div>
        ) : null}
        {item.fields.map((field) => (
          <div key={field.name} className="min-w-0 rounded-lg border border-border-subtle p-2">
            <dt className="font-semibold text-text-primary">{field.name}</dt>
            <dd className="m-0 mt-1 grid gap-1 text-text-secondary">
              <span>Local: {valueText(field.localValue)}</span>
              <span>Entrante: {valueText(field.incomingValue)}</span>
              {field.baselineValue !== null ? <span>Base importada: {valueText(field.baselineValue)}</span> : null}
              {field.protected ? (
                <span className="font-semibold text-warning">Se conserva el valor local por defecto.</span>
              ) : null}
            </dd>
          </div>
        ))}
        {item.relationships.length ? (
          <div className="sm:col-span-2">
            <dt className="text-text-secondary">Referencias relacionadas</dt>
            <dd className="m-0 grid gap-1">
              {item.relationships.map((ref, index) => (
                <span key={`${ref.role}-${ref.externalId}-${index}`} className="text-text-primary">
                  {ref.role.replace('_', ' ')}: {ref.externalId}
                  {ref.externalScope ? ` · ${ref.externalScope}` : ''}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      {item.warnings.map((warning) => (
        <p key={warning} className="mb-0 text-body-sm text-warning">
          {warning}
        </p>
      ))}
    </details>
  );
}

function ItemSummary({ item }: { item: ImportPreviewItem }) {
  if (item.resource === 'matches') {
    return (
      <div className="mt-2 grid gap-1 text-body-sm text-text-secondary sm:grid-cols-2">
        <span>Jornada: {valueText(itemField(item, 'jornada'))}</span>
        <span>Fecha: {valueText(itemField(item, 'fecha'))}</span>
        <span>Estado: {valueText(itemField(item, 'estado'))}</span>
        <span>Marcador: {valueText(itemField(item, 'marcador') ?? itemField(item, 'score'))}</span>
      </div>
    );
  }
  if (item.resource === 'results')
    return (
      <p className="m-0 mt-2 text-body-sm text-text-secondary">
        Marcador propuesto: {valueText(itemField(item, 'score'))}
      </p>
    );
  return null;
}

const progressSteps = [
  ['Consultando proveedor', 'Recuperando los recursos seleccionados de la fuente vinculada.'],
  ['Normalizando información', 'Preparando equipos, jornadas, partidos y resultados en el formato interno.'],
  ['Comparando datos locales', 'Identificando novedades, coincidencias y conflictos.'],
  ['Preparando vista previa', 'Guardando el snapshot temporal para su revisión.'],
] as const;

function ProcessPanel({
  completed,
  failed,
  operation,
  competition,
  season,
  provider,
  preview,
  onView,
  onCancel,
  backTo,
}: {
  completed: boolean;
  failed: boolean;
  operation?: ImportOperation;
  competition: string;
  season: string;
  provider: string;
  preview?: ImportPreview;
  onView?: () => void;
  onCancel?: () => void;
  backTo?: string;
}) {
  return (
    <Card className="mx-auto grid w-full max-w-4xl gap-6 border-t-2 border-t-brand-gold bg-surface-raised shadow-card sm:gap-8">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-5">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-heading-md font-extrabold text-text-primary">
            {completed
              ? 'Vista previa preparada correctamente'
              : failed
                ? 'No se pudo preparar la vista previa'
                : 'Preparando vista previa'}
          </h2>
          <p className="m-0 mt-2 text-body-sm text-text-secondary">
            {competition} · Temporada {season} · Fuente: {provider}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-caption font-bold ${completed ? 'border-success bg-success-surface text-success' : failed ? 'border-danger bg-danger-surface text-danger' : 'border-warning bg-warning-surface text-warning'}`}
        >
          {completed ? 'Completado' : failed ? 'Error' : operation?.status === 'queued' ? 'En espera' : 'En proceso'}
        </span>
      </header>
      <ol aria-label="Etapas de preparación" className="m-0 grid list-none gap-0 p-0">
        {progressSteps.map(([title, description], index) => {
          const stage = ['fetching', 'normalizing', 'comparing', 'preparing_preview'][index];
          const done =
            completed ||
            Boolean(stage && operation?.completedStages.includes(stage as ImportOperation['completedStages'][number]));
          const active = !completed && !failed && operation?.currentStage === stage && !done;
          const stageFailed = failed && operation?.currentStage === stage;
          return (
            <li
              key={title}
              className={`grid grid-cols-[auto_1fr] gap-4 border-l-2 py-3 pl-4 ${done ? 'border-success' : stageFailed ? 'border-danger' : active ? 'border-warning' : 'border-border-subtle'}`}
            >
              <span
                aria-hidden="true"
                className={`-ml-9 size-11 aspect-square shrink-0 self-start flex items-center justify-center rounded-full border font-bold ${done ? 'border-success bg-success-surface text-success' : stageFailed ? 'border-danger bg-danger-surface text-danger' : active ? 'border-warning bg-warning-surface text-warning' : 'border-border-subtle bg-surface-card text-text-secondary'}`}
              >
                {done ? '✓' : index + 1}
              </span>
              <div className={`min-w-0 ${active ? 'rounded-lg bg-warning-surface px-3 py-2' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className={active ? 'text-warning' : 'text-text-primary'}>{title}</strong>
                  <span
                    className={`text-caption font-semibold ${done ? 'text-success' : stageFailed ? 'text-danger' : active ? 'text-warning' : 'text-text-subtle'}`}
                  >
                    {done ? 'Completado' : stageFailed ? 'Error' : active ? 'En proceso' : 'Pendiente'}
                  </span>
                </div>
                <p className="m-0 mt-1 text-body-sm text-text-secondary">{description}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {preview ? (
        <section
          aria-label="Resumen de datos preparados"
          className="grid gap-3 rounded-xl border border-border-subtle bg-surface-card p-4"
        >
          <h3 className="m-0 font-display text-body-md font-bold text-text-primary">Resumen para revisar</h3>
          <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {resourceOrder
              .filter((resource) => preview.items.some((item) => item.resource === resource))
              .map((resource) => (
                <div key={resource} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                  <dt className="text-caption text-text-secondary">{labels[resource]}</dt>
                  <dd className="m-0 font-display text-heading-sm font-extrabold text-text-primary">
                    {preview.items.filter((item) => item.resource === resource).length}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="m-0 text-body-sm text-text-secondary">Los datos deportivos locales aún no se han importado.</p>
        </section>
      ) : (
        <p className="m-0 rounded-lg bg-info-surface p-4 text-body-sm text-text-secondary">
          {failed
            ? 'Conservamos tu selección para que puedas reintentar.'
            : 'La consulta puede tardar varios minutos según la cantidad de información. Las etapas se confirmarán al recibir la respuesta del servidor.'}
        </p>
      )}
      {completed ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
          {backTo ? (
            <Link className={buttonClassName('secondaryFilled')} to={backTo}>
              <Icon name="arrow-left" size={18} />
              Volver a competición
            </Link>
          ) : null}
          <Button onClick={onView}>Ver vista previa</Button>
        </div>
      ) : onCancel ? (
        <div className="grid justify-items-end gap-2 border-t border-border-subtle pt-4">
          <Button variant="danger" onClick={onCancel} disabled={operation?.cancellationRequested}>
            {operation?.cancellationRequested ? 'Cancelación solicitada' : 'Cancelar consulta'}
          </Button>
          <p className="m-0 text-caption text-text-secondary">
            La cancelación se confirma cuando el servidor detiene la operación.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

export function ImportPreviewPage() {
  const { competitionId } = useParams();
  const api = useCompetitionsApi();
  const [competition, setCompetition] = useState<ManagedCompetition>();
  const [seasons, setSeasons] = useState<ExternalSeasonOption[]>([]);
  const [localSeasons, setLocalSeasons] = useState<ManagedSeason[]>([]);
  const [capabilities, setCapabilities] = useState<ImportResourceCapability[]>([]);
  const [externalSeasonId, setExternalSeasonId] = useState('');
  const [destinationSeasonId, setDestinationSeasonId] = useState('');
  const [resources, setResources] = useState<ImportResource[]>([]);
  const [preview, setPreview] = useState<ImportPreview>();
  const [operation, setOperation] = useState<ImportOperation>();
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [activeTab, setActiveTab] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [operationFilter, setOperationFilter] = useState('all');
  const [roundFilter, setRoundFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [processFailed, setProcessFailed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [providerName, setProviderName] = useState('Proveedor vinculado');
  const requestRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  useEffect(
    () => () => {
      sequenceRef.current += 1;
      requestRef.current?.abort();
    },
    [],
  );
  const [verifying, setVerifying] = useState(false);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [expired, setExpired] = useState(false);
  const [verification, setVerification] = useState<{
    tone: 'success' | 'warning' | 'danger';
    title: string;
    message: string;
  }>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!competitionId) return;
      setLoading(true);
      try {
        const binding = await api.getProviderBinding(competitionId, signal);
        if (!binding)
          throw new Error(
            'Esta competición no tiene un proveedor vinculado. Configura una fuente antes de importar datos.',
          );
        setProviderName(binding.providerName);
        const savedOperation = sessionStorage.getItem(`import-operation:${competitionId}`);
        const [current, external, local] = await Promise.all([
          api.get(competitionId, signal),
          savedOperation ? Promise.resolve([]) : api.listExternalSeasons(competitionId, signal),
          api.listSeasons(competitionId, signal),
        ]);
        setCompetition(current);
        setSeasons(external);
        setLocalSeasons(local);
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
  useEffect(() => {
    if (!competitionId || !externalSeasonId) {
      setCapabilities([]);
      setResources([]);
      return;
    }
    const controller = new AbortController();
    setCapabilityLoading(true);
    setPreview(undefined);
    setError(undefined);
    setVerification(undefined);
    void api
      .getImportCapabilities(competitionId, externalSeasonId, controller.signal)
      .then((items) => setCapabilities(items))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilityLoading(false);
      });
    return () => controller.abort();
  }, [api, competitionId, externalSeasonId]);

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.externalSeasonId === externalSeasonId),
    [externalSeasonId, seasons],
  );
  const grouped = useMemo(() => {
    const counts = new Map<ImportResource, number>();
    for (const item of preview?.items ?? []) counts.set(item.resource, (counts.get(item.resource) ?? 0) + 1);
    return resourceOrder.filter((resource) => counts.has(resource) || preview?.resources.includes(resource));
  }, [preview]);
  const warningCount = preview?.warnings.reduce((total, warning) => total + warning.occurrenceCount, 0) ?? 0;
  const tabOptions = useMemo(
    () => [
      ...grouped.map((resource) => ({
        value: resource,
        label: `${labels[resource]} (${preview?.items.filter((item) => item.resource === resource).length ?? 0})`,
      })),
      ...(warningCount ? [{ value: 'warnings', label: `Advertencias (${preview?.warnings.length ?? 0})` }] : []),
    ],
    [grouped, preview, warningCount],
  );
  useEffect(() => {
    if (tabOptions.length && !tabOptions.some((tab) => tab.value === activeTab)) setActiveTab(tabOptions[0]!.value);
  }, [activeTab, tabOptions]);
  const isWarningTab = activeTab === 'warnings';
  const activeResource = grouped.includes(activeTab as ImportResource) ? (activeTab as ImportResource) : undefined;
  const records = useMemo(
    () => (preview?.items ?? []).filter((item) => item.resource === activeResource),
    [activeResource, preview],
  );
  const rounds = useMemo(
    () =>
      [...new Set(records.map((item) => String(itemField(item, 'jornada') ?? '')).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [records],
  );
  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const searchMatch =
          !search.trim() ||
          `${item.title} ${item.externalId} ${item.fields.map((field) => String(field.incomingValue ?? '')).join(' ')}`
            .toLocaleLowerCase('es')
            .includes(search.trim().toLocaleLowerCase('es'));
        const statusMatch = statusFilter === 'all' || String(itemField(item, 'estado') ?? '') === statusFilter;
        const operationMatch = operationFilter === 'all' || item.operation === operationForFilter[operationFilter];
        const roundMatch = roundFilter === 'all' || String(itemField(item, 'jornada') ?? '') === roundFilter;
        return searchMatch && statusMatch && operationMatch && roundMatch;
      }),
    [operationFilter, records, roundFilter, search, statusFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleItems = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const toggleResource = (resource: ImportResource) =>
    setResources((current) =>
      current.includes(resource) ? current.filter((item) => item !== resource) : [...current, resource],
    );
  const operationKey = competitionId ? `import-operation:${competitionId}` : '';
  useEffect(() => {
    if (!competitionId || !operationKey) return;
    const saved = sessionStorage.getItem(operationKey);
    if (!saved) return;
    const controller = new AbortController();
    void api
      .getImportOperation(competitionId, saved, controller.signal)
      .then((current) => {
        if (controller.signal.aborted) return;
        setOperation(current);
        setBusy(current.status === 'queued' || current.status === 'running');
        if (current.status === 'failed') setProcessFailed(true);
        if (current.status === 'failed' || current.status === 'cancelled') {
          setExternalSeasonId(current.externalSeasonId);
          setDestinationSeasonId(current.destinationSeasonId ?? '');
          setResources(current.resources);
          void api
            .listExternalSeasons(competitionId, controller.signal)
            .then(setSeasons)
            .catch((cause) => {
              if (!controller.signal.aborted) setError(cause);
            });
        }
        if (current.status === 'completed' && current.previewId)
          void api
            .getImportPreview(competitionId, current.previewId, controller.signal)
            .then(setPreview)
            .catch((cause) => {
              if (!controller.signal.aborted) setError(cause);
            });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          sessionStorage.removeItem(operationKey);
          void load(controller.signal);
        }
      });
    return () => controller.abort();
  }, [api, competitionId, operationKey, load]);
  const activeOperationId =
    operation?.status === 'queued' || operation?.status === 'running' ? operation.operationId : null;
  useEffect(() => {
    if (!competitionId || !activeOperationId) return;
    let alive = true;
    let requestVersion = 0;
    let terminalSeen = false;
    const stream = new EventSource(
      `/api/v1/competitions/${competitionId}/import-operations/${activeOperationId}/events`,
    );
    const refresh = async () => {
      if (!alive) return;
      const version = ++requestVersion;
      try {
        const current = await api.getImportOperation(competitionId, activeOperationId);
        if (!alive || version !== requestVersion || current.operationId !== activeOperationId) return;
        if (current.status === 'completed' && current.previewId) {
          terminalSeen = true;
          stream.close();
          const result = await api.getImportPreview(competitionId, current.previewId);
          if (alive && version === requestVersion) {
            setPreview(result);
            setOperation(current);
            setBusy(false);
            setProcessFailed(false);
          }
        } else {
          setOperation(current);
          if (current.status === 'failed' || current.status === 'cancelled') {
            terminalSeen = true;
            stream.close();
            setBusy(false);
            setProcessFailed(current.status === 'failed');
            if (current.status === 'failed')
              setError(new Error(current.errorMessage ?? 'No se pudo preparar la vista previa.'));
          }
        }
      } catch (cause) {
        if (alive && version === requestVersion) setError(cause);
      }
    };
    const onEvent = (message: Event) => {
      if (!alive || terminalSeen || !(message instanceof MessageEvent)) return;
      let decoded: unknown;
      try {
        decoded = JSON.parse(message.data);
      } catch {
        return;
      }
      const parsed = ImportOperationEventSchema.safeParse(decoded);
      if (!parsed.success || parsed.data.operationId !== activeOperationId) return;
      const event = parsed.data;
      requestVersion += 1; // A later persisted SSE event supersedes an earlier status response.
      if (event.type === 'operation.completed' && event.previewId) {
        terminalSeen = true;
        stream.close();
        void api
          .getImportPreview(competitionId, event.previewId)
          .then((result) => {
            if (alive) {
              setPreview(result);
              setBusy(false);
              setProcessFailed(false);
              setOperation((previous) =>
                previous
                  ? {
                      ...previous,
                      status: 'completed',
                      currentStage: null,
                      completedStages: previous.completedStages,
                      previewId: event.previewId,
                      completedAt: event.timestamp,
                      updatedAt: event.timestamp,
                    }
                  : previous,
              );
            }
          })
          .catch((cause) => {
            if (alive) {
              setError(cause);
              setBusy(false);
            }
          });
        return;
      }
      if (event.type === 'operation.failed') {
        terminalSeen = true;
        stream.close();
        void refresh();
        return;
      }
      setOperation((previous) => {
        if (!previous || previous.operationId !== activeOperationId) return previous;
        const completedStages =
          event.type === 'stage.completed' && event.stage && !previous.completedStages.includes(event.stage)
            ? [...previous.completedStages, event.stage]
            : previous.completedStages;
        return {
          ...previous,
          status: event.status,
          currentStage: event.stage,
          completedStages,
          previewId: event.previewId ?? previous.previewId,
          updatedAt: event.timestamp,
          completedAt: ['completed', 'failed', 'cancelled'].includes(event.status)
            ? event.timestamp
            : previous.completedAt,
        };
      });
      if (event.type === 'operation.cancelled') {
        terminalSeen = true;
        stream.close();
        setBusy(false);
      }
    };
    for (const type of [
      'operation.started',
      'stage.started',
      'stage.completed',
      'operation.completed',
      'operation.failed',
      'operation.cancelled',
    ])
      stream.addEventListener(type, onEvent);
    stream.onerror = () => {
      if (!terminalSeen) void refresh();
    };
    return () => {
      alive = false;
      stream.close();
    };
  }, [api, competitionId, activeOperationId]);
  async function createPreview() {
    if (!competitionId || !externalSeasonId || resources.length === 0 || busy) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const sequence = ++sequenceRef.current;
    setBusy(true);
    setProcessFailed(false);
    setError(undefined);
    setExpired(false);
    setPreview(undefined);
    setOperation(undefined);
    setVerification(undefined);
    setShowResults(false);
    try {
      const next = await api.startImportOperation(
        competitionId,
        { externalSeasonId, destinationSeasonId: destinationSeasonId || null, resources },
        controller.signal,
      );
      if (sequence !== sequenceRef.current) return;
      sessionStorage.setItem(operationKey, next.operationId);
      if (next.status === 'completed' && next.previewId) {
        const result = await api.getImportPreview(competitionId, next.previewId, controller.signal);
        if (sequence !== sequenceRef.current) return;
        setPreview(result);
        setBusy(false);
      } else {
        setOperation(next);
      }
      setPage(0);
      setSearch('');
      setOperationFilter('all');
      setStatusFilter('all');
      setRoundFilter('all');
    } catch (cause) {
      if (sequence === sequenceRef.current && !controller.signal.aborted) {
        setError(cause);
        setProcessFailed(true);
        setBusy(false);
      }
    } finally {
      if (sequence === sequenceRef.current) requestRef.current = null;
    }
  }
  async function cancelWait() {
    if (!competitionId || !operation || operation.cancellationRequested) return;
    try {
      setOperation(await api.cancelImportOperation(competitionId, operation.operationId));
    } catch (cause) {
      setError(cause);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createPreview();
  }
  async function verifyLocalChanges() {
    if (!competitionId || !preview || verifying) return;
    setVerifying(true);
    setError(undefined);
    setVerification(undefined);
    try {
      const updated = await api.getImportPreview(competitionId, preview.previewId);
      setPreview(updated);
      setExpired(false);
      setVerification(
        updated.stale
          ? {
              tone: 'warning',
              title: 'La vista previa quedó obsoleta',
              message:
                'Los datos locales o la fuente vinculada cambiaron desde la consulta. Genera una nueva vista previa para revisar el estado actual.',
            }
          : {
              tone: 'success',
              title: 'La vista previa sigue vigente',
              message: 'No se detectaron cambios locales desde que se preparó.',
            },
      );
    } catch (cause) {
      setError(cause);
      const isExpired =
        cause instanceof ApiError && cause.kind === 'problem' && cause.problem?.code === 'IMPORT_PREVIEW_EXPIRED';
      setExpired(isExpired);
      setVerification(
        isExpired
          ? {
              tone: 'warning',
              title: 'La vista previa expiró',
              message: 'Puedes volver a consultar el proveedor y generar otra vista previa.',
            }
          : {
              tone: 'danger',
              title: 'No se pudieron verificar los cambios',
              message: 'La vista previa se conserva. Reintenta la verificación cuando la conexión esté disponible.',
            },
      );
    } finally {
      setVerifying(false);
    }
  }
  const problem = error === undefined ? null : describeError(error);
  if (loading)
    return (
      <Card>
        <LoadingState layout="panel" label="Cargando opciones de importación…" />
      </Card>
    );
  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="import-preview-title">
      <nav aria-label="Ruta de navegación" className="text-caption text-text-subtle">
        <Link
          className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
          to="/competitions"
        >
          Competiciones
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          className="text-text-link underline decoration-border-strong underline-offset-2 focus-studio"
          to={`/competitions/${competitionId}`}
        >
          {competition?.name ?? 'Competición'}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Importar datos</span>
      </nav>
      <header className="grid gap-2">
        <h1 id="import-preview-title" className="m-0 font-display text-heading-lg font-extrabold text-text-primary">
          Importar datos
        </h1>
        <p className="m-0 max-w-3xl text-body-sm text-text-secondary">
          Consulta información de la fuente vinculada y revisa la propuesta antes de importarla. Ningún registro
          deportivo local ha sido modificado.
        </p>
      </header>
      {processFailed ? (
        <ProcessPanel
          completed={false}
          failed={true}
          operation={operation}
          competition={competition?.name ?? 'Competición'}
          season={selectedSeason?.label ?? operation?.externalSeasonId ?? externalSeasonId}
          provider={providerName}
        />
      ) : null}
      {problem && !preview ? (
        <Alert role="alert" tone="danger" title="No se pudo consultar la información">
          <p className="m-0">{operation?.errorMessage ?? problem.message}</p>
          <Button variant="secondaryFilled" onClick={() => void (processFailed ? createPreview() : load())}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      {operation?.status === 'cancelled' ? (
        <Alert role="status" tone="info" title="Consulta cancelada">
          <p className="m-0">No se importaron datos deportivos. Puedes preparar otra vista previa.</p>
        </Alert>
      ) : null}
      {!problem && !operation && seasons.length === 0 ? (
        <EmptyState
          title="No hay temporadas disponibles"
          description="El proveedor no devolvió temporadas para esta competición externa."
          icon="⌁"
        />
      ) : null}
      {seasons.length > 0 && !busy && !preview ? (
        <form onSubmit={(event) => void create(event)} className="grid min-w-0 gap-4">
          <Card className="grid min-w-0 gap-4">
            <Select
              id="external-season"
              label="Temporada externa"
              disabled={busy}
              value={externalSeasonId}
              onChange={(event) => {
                setExternalSeasonId(event.target.value);
                setResources([]);
                setPreview(undefined);
              }}
            >
              <option value="">Selecciona una temporada</option>
              {seasons.map((option) => (
                <option key={option.externalSeasonId} value={option.externalSeasonId}>
                  {option.label}
                  {option.current ? ' · Actual' : ''}
                </option>
              ))}
            </Select>
            {selectedSeason?.localCandidates.length ? (
              <p className="m-0 text-body-sm text-warning">
                Hay temporadas locales con nombre coincidente. La vinculación no se selecciona automáticamente.
              </p>
            ) : null}
            <Select
              id="destination-season"
              label="Destino local (opcional)"
              disabled={busy}
              value={destinationSeasonId}
              onChange={(event) => {
                setDestinationSeasonId(event.target.value);
                setPreview(undefined);
              }}
            >
              <option value="">Preparar una temporada local nueva</option>
              {localSeasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </Select>
            {capabilityLoading ? <LoadingState layout="inline" label="Consultando recursos disponibles…" /> : null}
            {externalSeasonId && !capabilityLoading ? (
              <fieldset className="grid gap-2 border-0 p-0">
                <legend className="mb-2 text-body-sm font-bold text-text-primary">Información a consultar</legend>
                {capabilities.map((capability) => (
                  <label
                    key={capability.resource}
                    className={`flex min-h-touch items-start gap-3 rounded-xl border border-border-subtle px-3 py-2 ${capability.available ? 'text-text-primary' : 'text-text-muted'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={busy || !capability.available}
                      checked={resources.includes(capability.resource)}
                      onChange={() => toggleResource(capability.resource)}
                    />
                    <span>
                      <strong>{labels[capability.resource]}</strong>
                      {!capability.available && capability.reason ? (
                        <small className="block text-text-secondary">{capability.reason}</small>
                      ) : null}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div>
              <Button type="submit" disabled={busy || capabilityLoading || !externalSeasonId || resources.length === 0}>
                {busy ? 'Consultando proveedor…' : 'Consultar y preparar vista previa'}
              </Button>
            </div>
          </Card>
        </form>
      ) : null}
      {busy ? (
        <section aria-live="polite">
          <ProcessPanel
            completed={false}
            failed={false}
            operation={operation}
            competition={competition?.name ?? 'Competición'}
            season={selectedSeason?.label ?? operation?.externalSeasonId ?? externalSeasonId}
            provider={providerName}
            onCancel={() => void cancelWait()}
          />
        </section>
      ) : null}
      {preview && !showResults ? (
        <ProcessPanel
          completed={true}
          failed={false}
          competition={preview.externalCompetitionName}
          season={preview.externalSeasonLabel}
          provider={preview.providerName}
          preview={preview}
          onView={() => setShowResults(true)}
          backTo={`/competitions/${competitionId}`}
        />
      ) : null}
      {preview && showResults ? (
        <section className="grid min-w-0 gap-4" aria-labelledby="preview-results-title">
          <Card className="grid min-w-0 gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="preview-results-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
                  Propuesta para {competition?.name ?? preview.externalCompetitionName}
                </h2>
                <p className="m-0 mt-1 text-body-sm text-text-secondary">
                  Temporada externa: {preview.externalSeasonLabel} · {preview.providerName}
                </p>
              </div>
              <span className="rounded-full border border-warning bg-warning-surface px-3 py-1 text-caption font-semibold text-warning">
                Pendiente de importación
              </span>
            </div>
            <ol aria-label="Estado del proceso" className="m-0 grid list-none gap-2 p-0 sm:grid-cols-4">
              {['Datos consultados', 'Datos normalizados', 'Vista previa preparada', 'Pendiente de importación'].map(
                (step, index) => (
                  <li
                    key={step}
                    className={`rounded-lg border px-3 py-2 text-body-sm ${index < 3 ? 'border-success bg-success-surface text-success' : 'border-warning bg-warning-surface text-warning'}`}
                  >
                    <span className="mr-2 font-bold">{index < 3 ? '✓' : '4'}</span>
                    {step}
                  </li>
                ),
              )}
            </ol>
            <Alert role="note" tone="info" title="Los datos aún no se han importado">
              <p className="m-0">
                La vista previa está preparada para revisar. Los datos todavía no se han importado y ningún registro
                deportivo local cambió. La confirmación e importación se implementarán en PD-ARCH-01D-C.
              </p>
            </Alert>
            <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 text-body-sm sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <dt className="text-text-secondary">Competición externa</dt>
                <dd className="m-0 font-semibold text-text-primary">{preview.externalCompetitionName}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Destino local</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {localSeasons.find((season) => season.id === preview.destinationSeasonId)?.label ??
                    'Temporada local nueva'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Consultada</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {new Date(preview.retrievedAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Expira</dt>
                <dd className="m-0 font-semibold text-text-primary">{new Date(preview.expiresAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Vigencia local</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {preview.stale ? 'Obsoleta: hubo cambios locales' : 'Vigente'}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="mb-2 mt-0 text-body-sm font-bold text-text-primary">Registros por recurso</h3>
              <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {grouped.map((resource) => (
                  <div key={resource} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                    <dt className="text-caption text-text-secondary">{labels[resource]}</dt>
                    <dd className="m-0 mt-1 text-heading-sm font-bold text-text-primary">
                      {preview.items.filter((item) => item.resource === resource).length}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="mb-2 mt-0 text-body-sm font-bold text-text-primary">Operaciones propuestas</h3>
              <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {operationKeys
                  .filter((key) => preview.summary[key] > 0)
                  .map((key) => (
                    <div key={key} className="rounded-lg border border-border-subtle p-3">
                      <dt className="text-caption text-text-secondary">{operationNames[key]}</dt>
                      <dd className="m-0 mt-1 font-bold text-text-primary">{preview.summary[key]}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {preview.stale ? (
              <Alert tone="warning" title="Los datos locales cambiaron">
                <p className="m-0">
                  Esta propuesta se generó antes de los cambios locales. Vuelve a consultar para revisar el estado
                  actual antes de una futura importación.
                </p>
              </Alert>
            ) : null}
            {preview.warnings.length ? (
              <Alert tone="warning" title={`${warningCount} advertencias en ${preview.warnings.length} tipos`}>
                <p className="m-0">
                  Consulta la pestaña Advertencias para revisar los grupos y sus registros relacionados.
                </p>
              </Alert>
            ) : null}
          </Card>
          {verification ? (
            <Alert role="status" tone={verification.tone} title={verification.title}>
              <p className="m-0">{verification.message}</p>
            </Alert>
          ) : null}
          {problem && preview && !verification ? (
            <Alert
              role="alert"
              tone={expired ? 'warning' : 'danger'}
              title={expired ? 'Vista previa expirada' : 'No se completó la verificación'}
            >
              <p className="m-0">{problem.message}</p>
            </Alert>
          ) : null}
          <div className="grid min-w-0 gap-3">
            <Tabs
              id="import-preview-resources"
              label="Recursos de la vista previa"
              options={tabOptions}
              value={activeTab || tabOptions[0]?.value || ''}
              onChange={(value) => {
                setActiveTab(value);
                setPage(0);
              }}
            />
            {isWarningTab ? (
              <div
                id={tabPanelId('import-preview-resources', 'warnings')}
                role="tabpanel"
                aria-labelledby="import-preview-resources-tab-warnings"
                className="grid gap-3"
              >
                {preview.warnings.map((warning) => (
                  <Alert
                    key={warning.code}
                    tone={warning.severity === 'error' ? 'danger' : warning.severity === 'info' ? 'info' : 'warning'}
                    title={`${warning.severity === 'conflict' ? 'Conflicto' : warning.severity === 'error' ? 'Error' : warning.severity === 'info' ? 'Información' : 'Advertencia'} · ${warning.occurrenceCount} ${warning.occurrenceCount === 1 ? 'ocurrencia' : 'ocurrencias'}`}
                  >
                    <p className="m-0">{warning.message}</p>
                    {warning.affectedExternalIds.length ? (
                      <details className="mt-2">
                        <DisclosureSummary>
                          Ver registros afectados ({warning.affectedExternalIds.length})
                        </DisclosureSummary>
                        <ul className="mb-0 mt-2 grid gap-1">
                          {warning.affectedExternalIds.map((id) => (
                            <li key={id}>{id}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </Alert>
                ))}
              </div>
            ) : activeResource ? (
              <div
                id={tabPanelId('import-preview-resources', activeResource)}
                role="tabpanel"
                aria-labelledby={`import-preview-resources-tab-${activeResource}`}
                className="grid min-w-0 gap-3"
              >
                <div className="flex min-w-0 flex-wrap items-end gap-3">
                  <div className="min-w-[min(100%,15rem)] flex-1">
                    <Input
                      id="preview-search"
                      label="Buscar por equipo o referencia"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  {activeResource === 'matches' ? (
                    <>
                      <div className="min-w-44">
                        <Select
                          id="preview-round"
                          label="Jornada"
                          value={roundFilter}
                          onChange={(event) => {
                            setRoundFilter(event.target.value);
                            setPage(0);
                          }}
                        >
                          <option value="all">Todas</option>
                          {rounds.map((round) => (
                            <option key={round} value={round}>
                              {round}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="min-w-44">
                        <Select
                          id="preview-status"
                          label="Estado"
                          value={statusFilter}
                          onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(0);
                          }}
                        >
                          <option value="all">Todos</option>
                          {[
                            ...new Set(records.map((item) => String(itemField(item, 'estado') ?? '')).filter(Boolean)),
                          ].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </>
                  ) : null}
                  <div className="min-w-44">
                    <Select
                      id="preview-operation"
                      label="Operación"
                      value={operationFilter}
                      onChange={(event) => {
                        setOperationFilter(event.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="all">Todas</option>
                      {operationKeys
                        .filter((key) => preview.summary[key] > 0)
                        .map((key) => (
                          <option key={key} value={key}>
                            {operationNames[key]}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <ViewModeToggle value={view} onChange={setView} />
                </div>
                <p role="status" className="m-0 text-caption text-text-secondary">
                  {filtered.length
                    ? `Mostrando ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} de ${filtered.length}`
                    : 'No hay registros que coincidan con estos filtros.'}
                </p>
                {visibleItems.length === 0 ? (
                  <EmptyState
                    title="No hay registros para mostrar"
                    description="Modifica la búsqueda o los filtros para ver otros registros."
                    icon="⌁"
                  />
                ) : view === 'table' ? (
                  <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised">
                    <table className="w-full min-w-[650px] text-left text-body-sm">
                      <thead>
                        <tr className="border-b border-border-subtle text-text-secondary">
                          <th className="p-3">Registro</th>
                          <th className="p-3">Datos principales</th>
                          <th className="p-3">Propuesta</th>
                          <th className="p-3">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item, index) => (
                          <tr
                            key={`${item.resource}-${item.externalScope}-${item.externalId}-${index}`}
                            className="border-b border-border-subtle last:border-0 align-top"
                          >
                            <th scope="row" className="max-w-md p-3 font-semibold text-text-primary">
                              {item.title}
                              {item.localCandidate ? (
                                <small className="mt-1 block text-warning">
                                  Posible registro local: {item.localCandidate.label}
                                </small>
                              ) : null}
                            </th>
                            <td className="p-3">
                              <ItemSummary item={item} />
                              {item.resource === 'teams' ? (
                                <span>{item.fields.find((field) => field.name === 'name')?.incomingValue}</span>
                              ) : null}
                            </td>
                            <td className="p-3">
                              <OperationBadge operation={item.operation} />
                            </td>
                            <td className="min-w-48 p-3">
                              <ItemDetail item={item} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleItems.map((item, index) => (
                      <li key={`${item.resource}-${item.externalScope}-${item.externalId}-${index}`}>
                        <Card className="grid min-w-0 gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-caption text-text-secondary">{labels[item.resource]}</span>
                            <OperationBadge operation={item.operation} />
                          </div>
                          <h3 className="m-0 break-words text-body-md font-bold text-text-primary">{item.title}</h3>
                          <ItemSummary item={item} />
                          <ItemDetail item={item} />
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
                {filtered.length > pageSize ? (
                  <nav
                    aria-label="Paginación de registros"
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <Button
                      variant="secondaryFilled"
                      disabled={page === 0}
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                    >
                      Anterior
                    </Button>
                    <span aria-live="polite" className="text-body-sm text-text-secondary">
                      Página {page + 1} de {pageCount}
                    </span>
                    <Button
                      variant="secondaryFilled"
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    >
                      Siguiente
                    </Button>
                  </nav>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondaryFilled"
              onClick={() => {
                if (preview) {
                  setExternalSeasonId(preview.externalSeasonId);
                  setDestinationSeasonId(preview.destinationSeasonId ?? '');
                  setResources(preview.resources);
                }
                if (operationKey) sessionStorage.removeItem(operationKey);
                setOperation(undefined);
                setPreview(undefined);
                setVerification(undefined);
                if (competitionId && seasons.length === 0)
                  void api.listExternalSeasons(competitionId).then(setSeasons).catch(setError);
              }}
            >
              Modificar selección
            </Button>
            <span className="group relative inline-flex">
              <Button
                variant="secondaryFilled"
                isLoading={verifying}
                loadingLabel="Verificando…"
                title="Comprueba si los datos locales cambiaron desde que se generó esta vista previa. No importa datos."
                onClick={() => void verifyLocalChanges()}
              >
                Verificar cambios locales
              </Button>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-72 rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption text-text-primary shadow-card group-hover:block group-focus-within:block"
              >
                Comprueba si los datos locales cambiaron desde que se generó esta vista previa. No importa datos.
              </span>
            </span>
            {expired ? (
              <Button disabled={busy} onClick={() => void createPreview()}>
                {busy ? 'Consultando proveedor…' : 'Generar otra vista previa'}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
