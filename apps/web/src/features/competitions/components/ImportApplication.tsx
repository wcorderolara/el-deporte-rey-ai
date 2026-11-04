import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ImportApplyEventSchema,
  type ImportApplyCounts,
  type ImportApplyDecision,
  type ImportApplyOperation,
  type ImportApplyPlan,
  type ImportApplyPlanItem,
  type ImportPreview,
  type ImportResource,
} from '@edr/contracts';
import { ApiError } from '../../../api/client';
import {
  Alert,
  Button,
  Card,
  LoadingState,
  Modal,
  ModalFooter,
  Select,
  buttonClassName,
  describeError,
} from '../../../ui';
import type { CompetitionsApi } from '../api';

const resourceLabels: Record<ImportResource, string> = {
  season: 'Temporada',
  teams: 'Equipo',
  participants: 'Participante',
  stages: 'Fase',
  rounds: 'Jornada',
  matches: 'Partido',
  results: 'Resultado',
};
const stageSteps = [
  ['validating', 'Validando la vista previa', 'Vigencia, huella del snapshot, vínculo con la fuente y datos locales.'],
  [
    'resolving_identities',
    'Resolviendo identidades',
    'Vínculos existentes y decisiones explícitas; nunca coincidencias por nombre.',
  ],
  [
    'transforming',
    'Transformando datos',
    'Temporada, equipos, fases, jornadas, partidos y resultados en el modelo local.',
  ],
  [
    'persisting',
    'Guardando en la base de datos',
    'Una única transacción: se guarda todo o nada. Ya no puede cancelarse.',
  ],
] as const;
const countLabels: [keyof ImportApplyCounts, string][] = [
  ['seasonsCreated', 'Temporadas creadas'],
  ['teamsCreated', 'Equipos creados'],
  ['teamsReused', 'Equipos reutilizados'],
  ['associationsCreated', 'Asociaciones con la competición'],
  ['participantsCreated', 'Participantes inscritos'],
  ['stagesCreated', 'Fases creadas'],
  ['roundsCreated', 'Jornadas creadas'],
  ['matchesCreated', 'Partidos creados'],
  ['matchesUpdated', 'Partidos actualizados'],
  ['resultsApplied', 'Resultados aplicados'],
  ['unchanged', 'Registros sin cambios'],
  ['skipped', 'Registros omitidos'],
  ['conflictsNotApplied', 'Conflictos no aplicados'],
];
export const CONFIRMATION_TEXT =
  'Esta acción guardará los datos seleccionados en la base de datos local. Revisa los cambios antes de continuar.';

const applicationKey = (competitionId: string) => `import-application:${competitionId}`;
const decisionKey = (item: Pick<ImportApplyPlanItem, 'resource' | 'externalScope' | 'externalId'>) =>
  JSON.stringify([item.resource, item.externalScope ?? '', item.externalId]);
const active = (operation?: ImportApplyOperation) => operation?.status === 'queued' || operation?.status === 'running';
function valueText(value: unknown) {
  return value === null ? 'Sin dato' : String(value);
}

/**
 * State of the PD-ARCH-01D-C confirmation of one preview: the backend plan for the current decisions, the durable
 * application operation (recovered after reloads) and its SSE progress. The UI never computes readiness itself.
 */
export function useImportApplication(api: CompetitionsApi, competitionId: string | undefined, preview?: ImportPreview) {
  const [decisions, setDecisions] = useState<ImportApplyDecision[]>([]);
  const [plan, setPlan] = useState<ImportApplyPlan>();
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<unknown>();
  const [operation, setOperation] = useState<ImportApplyOperation>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>();
  const previewId = preview?.previewId;
  const operationStatus = operation?.status;

  useEffect(() => {
    // Keep the array identity when nothing changes, so a new preview does not trigger a second plan request.
    setDecisions((current) => (current.length ? [] : current));
  }, [previewId]);
  useEffect(() => {
    if (!competitionId || !previewId || operationStatus === 'queued' || operationStatus === 'running') return;
    if (operationStatus === 'completed') return;
    const controller = new AbortController();
    setPlanLoading(true);
    void api
      .planImportApplication(competitionId, previewId, decisions, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setPlan(next);
        setPlanError(undefined);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setPlan(undefined);
          setPlanError(cause);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanLoading(false);
      });
    return () => controller.abort();
  }, [api, competitionId, previewId, decisions, operationStatus]);

  // Recover an application started earlier in this browser session.
  useEffect(() => {
    if (!competitionId) return;
    const saved = sessionStorage.getItem(applicationKey(competitionId));
    if (!saved) return;
    const controller = new AbortController();
    void api
      .getImportApplication(competitionId, saved, controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setOperation(current);
      })
      .catch(() => {
        if (!controller.signal.aborted) sessionStorage.removeItem(applicationKey(competitionId));
      });
    return () => controller.abort();
  }, [api, competitionId]);

  const liveId = active(operation) ? operation!.operationId : null;
  useEffect(() => {
    if (!competitionId || !liveId) return;
    let alive = true;
    const stream = new EventSource(`/api/v1/competitions/${competitionId}/import-applications/${liveId}/events`);
    const refresh = async () => {
      try {
        const current = await api.getImportApplication(competitionId, liveId);
        if (alive) setOperation(current);
        if (!active(current)) stream.close();
      } catch {
        /* The next event or a reload recovers the authoritative state. */
      }
    };
    const onEvent = (message: Event) => {
      if (!alive || !(message instanceof MessageEvent)) return;
      let decoded: unknown;
      try {
        decoded = JSON.parse(String(message.data));
      } catch {
        return;
      }
      const parsed = ImportApplyEventSchema.safeParse(decoded);
      if (!parsed.success || parsed.data.operationId !== liveId) return;
      const event = parsed.data;
      if (
        event.type === 'operation.completed' ||
        event.type === 'operation.failed' ||
        event.type === 'operation.cancelled'
      ) {
        stream.close();
        void refresh();
        return;
      }
      setOperation((previous) =>
        previous && previous.operationId === liveId
          ? {
              ...previous,
              status: event.status,
              currentStage: event.stage,
              cancellable: event.stage !== 'persisting',
              completedStages:
                event.type === 'stage.completed' && event.stage && !previous.completedStages.includes(event.stage)
                  ? [...previous.completedStages, event.stage]
                  : previous.completedStages,
              updatedAt: event.timestamp,
            }
          : previous,
      );
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
    stream.onerror = () => void refresh();
    return () => {
      alive = false;
      stream.close();
    };
  }, [api, competitionId, liveId]);

  const decide = useCallback((item: ImportApplyPlanItem, value: string) => {
    setDecisions((current) => {
      const rest = current.filter((decision) => decisionKey(decision) !== decisionKey(item));
      if (!value) return rest;
      const [action, localId] = value.split(':') as [ImportApplyDecision['action'], string | undefined];
      return [
        ...rest,
        {
          resource: item.resource,
          externalId: item.externalId,
          externalScope: item.externalScope,
          action,
          localId: localId || null,
        },
      ];
    });
  }, []);
  const skipAll = useCallback((items: readonly ImportApplyPlanItem[]) => {
    setDecisions((current) => {
      const keys = new Set(items.map(decisionKey));
      return [
        ...current.filter((decision) => !keys.has(decisionKey(decision))),
        ...items.map((item) => ({
          resource: item.resource,
          externalId: item.externalId,
          externalScope: item.externalScope,
          action: 'skip' as const,
          localId: null,
        })),
      ];
    });
  }, []);

  const start = useCallback(async () => {
    if (!competitionId || !previewId || !plan || starting) return false;
    setStarting(true);
    setStartError(undefined);
    try {
      const next = await api.startImportApplication(competitionId, previewId, { decisions, planHash: plan.planHash });
      sessionStorage.setItem(applicationKey(competitionId), next.operationId);
      setOperation(next);
      return true;
    } catch (cause) {
      setStartError(cause);
      // A changed or rejected plan is refreshed so the operator reviews the current proposal.
      setDecisions((current) => [...current]);
      return false;
    } finally {
      setStarting(false);
    }
  }, [api, competitionId, decisions, plan, previewId, starting]);
  const cancel = useCallback(async () => {
    if (!competitionId || !operation) return;
    try {
      setOperation(await api.cancelImportApplication(competitionId, operation.operationId));
    } catch (cause) {
      setStartError(cause);
    }
  }, [api, competitionId, operation]);
  const reset = useCallback(() => {
    if (competitionId) sessionStorage.removeItem(applicationKey(competitionId));
    setOperation(undefined);
    setStartError(undefined);
    setDecisions([]);
  }, [competitionId]);

  const unresolved = plan?.totals.blocked ?? 0;
  const disabledReason = planLoading
    ? 'Calculando la propuesta con tus decisiones…'
    : !plan
      ? 'No se pudo calcular la propuesta de importación.'
      : preview?.stale
        ? 'La vista previa quedó obsoleta. Genera otra antes de importar.'
        : !plan.ready
          ? (plan.blockers[0]?.message ?? `Resuelve ${unresolved} registros antes de importar.`)
          : active(operation)
            ? 'Hay una importación en curso.'
            : null;
  return {
    plan,
    planLoading,
    planError,
    decisions,
    decide,
    skipAll,
    operation,
    start,
    starting,
    startError,
    cancel,
    reset,
    canConfirm: disabledReason === null,
    disabledReason,
  };
}
export type ImportApplicationState = ReturnType<typeof useImportApplication>;

function DecisionControl({ item, state }: { item: ImportApplyPlanItem; state: ImportApplicationState }) {
  const current = state.decisions.find((decision) => decisionKey(decision) === decisionKey(item));
  const value = current ? `${current.action}${current.localId ? `:${current.localId}` : ''}` : '';
  const id = `decision-${item.resource}-${item.externalId}`.replace(/[^A-Za-z0-9_-]/g, '-');
  const keepLocal =
    item.action === 'keep_local' || (item.options.length === 1 && item.options[0] === 'accept_incoming');
  return (
    <Select
      id={id}
      label={`Decisión para ${resourceLabels[item.resource].toLowerCase()} «${item.title}»`}
      value={value}
      onChange={(event) => state.decide(item, event.target.value)}
    >
      <option value="">{keepLocal ? 'Conservar el valor local' : 'Sin decidir'}</option>
      {item.options.includes('link')
        ? item.candidates.map((candidate) => (
            <option key={`link-${candidate.id}`} value={`link:${candidate.id}`}>
              Vincular con «{candidate.label}»
            </option>
          ))
        : null}
      {item.options.includes('accept_incoming')
        ? item.candidates.length && !keepLocal
          ? item.candidates.map((candidate) => (
              <option key={`accept-${candidate.id}`} value={`accept_incoming:${candidate.id}`}>
                Vincular con «{candidate.label}» y aceptar valores entrantes
              </option>
            ))
          : [
              <option key="accept" value="accept_incoming">
                Aceptar el valor entrante
              </option>,
            ]
        : null}
      {item.options.includes('skip') ? <option value="skip">Omitir este registro</option> : null}
    </Select>
  );
}

function ReviewItem({ item, state }: { item: ImportApplyPlanItem; state: ImportApplicationState }) {
  return (
    <li className="grid gap-2 rounded-xl border border-border-subtle bg-surface-raised p-3 sm:grid-cols-[1fr_minmax(14rem,22rem)] sm:items-start">
      <div className="min-w-0">
        <p className="m-0 text-caption text-text-secondary">{resourceLabels[item.resource]}</p>
        <p className="m-0 font-semibold text-text-primary">{item.title}</p>
        {item.reason ? <p className="m-0 mt-1 text-body-sm text-warning">{item.reason}</p> : null}
        {item.changes.length ? (
          <ul className="m-0 mt-1 grid list-none gap-1 p-0 text-body-sm text-text-secondary">
            {item.changes.map((change) => (
              <li key={change.field}>
                {change.field}: local {valueText(change.localValue)} · entrante {valueText(change.incomingValue)} ·{' '}
                <strong className={change.applied ? 'text-info' : 'text-warning'}>
                  {change.applied ? 'se actualizará' : 'se conserva el valor local'}
                </strong>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {item.options.length ? <DecisionControl item={item} state={state} /> : null}
    </li>
  );
}

const LIST_LIMIT = 100;

/** Plan review: totals, blockers and the explicit decisions the backend still needs. */
export function ImportApplyReview({ state }: { state: ImportApplicationState }) {
  const { plan, planLoading, planError } = state;
  const groups = useMemo(() => {
    const items = plan?.reviewItems ?? [];
    const decidable = items.filter((item) => item.candidates.length > 0 || item.resource === 'season');
    const dependents = items.filter(
      (item) => item.action === 'blocked' && item.candidates.length === 0 && item.resource !== 'season',
    );
    const protectedValues = items.filter(
      (item) => item.options.includes('accept_incoming') && item.candidates.length === 0,
    );
    const skipped = items.filter((item) => item.action === 'skip' && item.candidates.length === 0);
    return { decidable, dependents, protectedValues, skipped };
  }, [plan]);
  if (!plan)
    return (
      <Card className="grid gap-3" aria-live="polite">
        {planLoading ? (
          <LoadingState layout="inline" label="Calculando la propuesta de importación…" />
        ) : (
          <Alert role="alert" tone="danger" title="No se pudo calcular la propuesta">
            <p className="m-0">{planError ? describeError(planError).message : 'Vuelve a intentarlo.'}</p>
          </Alert>
        )}
      </Card>
    );
  const totals = [
    ['Se crearán', plan.totals.create],
    ['Se actualizarán', plan.totals.update],
    ['Sin cambios', plan.totals.unchanged],
    ['Valores locales conservados', plan.totals.keepLocal],
    ['Omitidos', plan.totals.skip],
    ['Requieren decisión', plan.totals.blocked],
  ] as const;
  return (
    <section aria-labelledby="apply-review-title" className="grid min-w-0 gap-4">
      <Card className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="apply-review-title" className="m-0 font-display text-heading-sm font-bold text-text-primary">
              Revisión de importación
            </h2>
            <p className="m-0 mt-1 text-body-sm text-text-secondary">
              Destino local: {plan.destinationLabel}
              {plan.destinationIsNew ? ' (se creará)' : ''}. Calculado a partir del snapshot guardado; no se consulta
              otra vez al proveedor.
            </p>
          </div>
          <span
            role="status"
            aria-live="polite"
            className={`rounded-full border px-3 py-1 text-caption font-semibold ${plan.ready ? 'border-success bg-success-surface text-success' : 'border-warning bg-warning-surface text-warning'}`}
          >
            {planLoading ? 'Actualizando…' : plan.ready ? 'Lista para confirmar' : 'Requiere revisión'}
          </span>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {totals.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
              <dt className="text-caption text-text-secondary">{label}</dt>
              <dd className="m-0 mt-1 font-display text-heading-sm font-extrabold text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        {plan.blockers.length ? (
          <Alert tone="warning" title="Antes de importar">
            <ul className="m-0 grid gap-1 pl-5">
              {plan.blockers.map((blocker) => (
                <li key={blocker.code}>
                  {blocker.message}
                  {blocker.count > 1 ? ` (${blocker.count})` : ''}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {plan.warnings.length ? (
          <Alert tone="info" title="Advertencias">
            <ul className="m-0 grid gap-1 pl-5">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </Card>
      {groups.decidable.length ? (
        <Card className="grid min-w-0 gap-3">
          <h3 className="m-0 text-body-md font-bold text-text-primary">Identidades por confirmar</h3>
          <p className="m-0 text-body-sm text-text-secondary">
            Hay registros locales con el mismo nombre. No se vinculan automáticamente: elige el registro local o omite
            el registro externo.
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {groups.decidable.slice(0, LIST_LIMIT).map((item) => (
              <ReviewItem key={decisionKey(item)} item={item} state={state} />
            ))}
          </ul>
        </Card>
      ) : null}
      {groups.protectedValues.length ? (
        <Card className="grid min-w-0 gap-3">
          <h3 className="m-0 text-body-md font-bold text-text-primary">Valores locales protegidos</h3>
          <p className="m-0 text-body-sm text-text-secondary">
            Estos valores cambiaron localmente o no tienen un valor importado previo. Se conservan salvo que aceptes el
            valor entrante.
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {groups.protectedValues.slice(0, LIST_LIMIT).map((item) => (
              <ReviewItem key={decisionKey(item)} item={item} state={state} />
            ))}
          </ul>
        </Card>
      ) : null}
      {groups.dependents.length ? (
        <Card className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-body-md font-bold text-text-primary">
              Registros con dependencias sin resolver ({groups.dependents.length})
            </h3>
            <Button variant="secondaryFilled" size="sm" onClick={() => state.skipAll(groups.dependents)}>
              Omitir estos registros
            </Button>
          </div>
          <p className="m-0 text-body-sm text-text-secondary">
            Dependen de equipos, fases o jornadas que no se importarán o no están en la vista previa. Puedes omitirlos o
            generar otra vista previa que incluya esos recursos.
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {groups.dependents.slice(0, LIST_LIMIT).map((item) => (
              <ReviewItem key={decisionKey(item)} item={item} state={state} />
            ))}
          </ul>
          {groups.dependents.length > LIST_LIMIT ? (
            <p className="m-0 text-caption text-text-secondary">
              Y {groups.dependents.length - LIST_LIMIT} registros más.
            </p>
          ) : null}
        </Card>
      ) : null}
      {groups.skipped.length ? (
        <details className="rounded-xl border border-border-subtle bg-surface-raised p-3">
          <summary className="cursor-pointer text-body-sm font-semibold text-text-primary">
            Registros que no se importarán ({groups.skipped.length})
          </summary>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">
            {groups.skipped.slice(0, LIST_LIMIT).map((item) => (
              <ReviewItem key={decisionKey(item)} item={item} state={state} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Explicit confirmation. Opening it never persists anything. */
export function ConfirmImportModal({
  state,
  competitionName,
  onClose,
}: {
  state: ImportApplicationState;
  competitionName: string;
  onClose: () => void;
}) {
  const { plan } = state;
  if (!plan) return null;
  const rows: [string, string | number][] = [
    ['Competición', competitionName],
    ['Temporada', plan.externalSeasonLabel],
    ['Proveedor', plan.providerName],
    ['Destino local', `${plan.destinationLabel}${plan.destinationIsNew ? ' (nueva)' : ''}`],
    ['Registros que se crearán', plan.totals.create],
    ['Registros que se actualizarán', plan.totals.update],
    ['Registros sin cambios', plan.totals.unchanged],
    ['Valores locales conservados', plan.totals.keepLocal],
    ['Registros omitidos', plan.totals.skip],
    ['Conflictos bloqueantes', plan.totals.blocked],
  ];
  return (
    <Modal title="Confirmar importación" onClose={onClose} closeDisabled={state.starting}>
      <div className="grid gap-4">
        <p className="m-0 text-body-md text-text-primary">{CONFIRMATION_TEXT}</p>
        <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border-subtle p-3">
              <dt className="text-caption text-text-secondary">{label}</dt>
              <dd className="m-0 mt-1 font-semibold text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        {plan.warnings.length ? (
          <Alert tone="info" title="Advertencias relevantes">
            <ul className="m-0 grid gap-1 pl-5">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {state.startError ? (
          <Alert role="alert" tone="danger" title="No se inició la importación">
            <p className="m-0">{describeError(state.startError).message}</p>
          </Alert>
        ) : null}
      </div>
      <ModalFooter onCancel={onClose} cancelDisabled={state.starting}>
        <Button
          isLoading={state.starting}
          loadingLabel="Iniciando importación…"
          disabled={!state.canConfirm}
          onClick={() => void state.start().then((started) => started && onClose())}
        >
          Confirmar importación
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** Progress confirmed by the backend only; there are no estimated percentages. */
export function ImportApplyProgress({ state }: { state: ImportApplicationState }) {
  const operation = state.operation!;
  const failed = operation.status === 'failed';
  const cancelled = operation.status === 'cancelled';
  return (
    <Card
      className="mx-auto grid w-full max-w-4xl gap-6 border-t-2 border-t-brand-gold bg-surface-raised shadow-card"
      aria-live="polite"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-5">
        <h2 className="m-0 font-display text-heading-md font-extrabold text-text-primary">
          {failed ? 'No se completó la importación' : cancelled ? 'Importación cancelada' : 'Importando datos'}
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-caption font-bold ${failed ? 'border-danger bg-danger-surface text-danger' : cancelled ? 'border-border-subtle text-text-secondary' : 'border-warning bg-warning-surface text-warning'}`}
        >
          {failed ? 'Error' : cancelled ? 'Cancelada' : operation.status === 'queued' ? 'En espera' : 'En proceso'}
        </span>
      </header>
      <ol aria-label="Etapas de importación" className="m-0 grid list-none gap-0 p-0">
        {stageSteps.map(([stage, title, description], index) => {
          const done = operation.completedStages.includes(stage);
          const current = operation.currentStage === stage && !done;
          const stageFailed = failed && current;
          const running = current && !failed && !cancelled;
          return (
            <li
              key={stage}
              className={`grid grid-cols-[auto_1fr] gap-4 border-l-2 py-3 pl-4 ${done ? 'border-success' : stageFailed ? 'border-danger' : running ? 'border-warning' : 'border-border-subtle'}`}
            >
              <span
                aria-hidden="true"
                className={`-ml-9 flex size-11 aspect-square shrink-0 items-center justify-center self-start rounded-full border font-bold ${done ? 'border-success bg-success-surface text-success' : stageFailed ? 'border-danger bg-danger-surface text-danger' : running ? 'border-warning bg-warning-surface text-warning' : 'border-border-subtle bg-surface-card text-text-secondary'}`}
              >
                {done ? '✓' : index + 1}
              </span>
              <div className="min-w-0">
                <strong className={running ? 'text-warning' : 'text-text-primary'}>{title}</strong>{' '}
                <span className="text-caption font-semibold text-text-secondary">
                  {done ? 'Completado' : stageFailed ? 'Error' : running ? 'En proceso' : 'Pendiente'}
                </span>
                <p className="m-0 mt-1 text-body-sm text-text-secondary">{description}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {failed ? (
        <Alert role="alert" tone="danger" title="La importación no se aplicó">
          <p className="m-0">{operation.errorMessage ?? 'No se guardó ningún cambio.'}</p>
        </Alert>
      ) : null}
      {cancelled ? (
        <Alert role="status" tone="info" title="No se importaron datos">
          <p className="m-0">La importación se canceló antes de guardar datos.</p>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
        {failed || cancelled ? (
          <Button variant="secondaryFilled" onClick={state.reset}>
            Volver a la revisión
          </Button>
        ) : (
          <>
            <p className="m-0 mr-auto text-caption text-text-secondary">
              {operation.cancellable
                ? 'Puedes cancelar mientras no empiece el guardado.'
                : 'El guardado está en curso y terminará completo o sin cambios.'}
            </p>
            <Button
              variant="danger"
              disabled={!operation.cancellable || operation.cancellationRequested}
              onClick={() => void state.cancel()}
            >
              {operation.cancellationRequested ? 'Cancelación solicitada' : 'Cancelar importación'}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/** Persisted result: counts come from the committed transaction, never from the preview. */
export function ImportApplyResult({
  competitionId,
  operation,
  onNewImport,
}: {
  competitionId: string;
  operation: ImportApplyOperation;
  onNewImport: () => void;
}) {
  const application = operation.application!;
  const firstHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => firstHeading.current?.focus(), []);
  return (
    <Card className="mx-auto grid w-full max-w-4xl gap-6 border-t-2 border-t-brand-gold bg-surface-raised shadow-card">
      <header className="grid gap-2 border-b border-border-subtle pb-5">
        <h2
          ref={firstHeading}
          tabIndex={-1}
          className="m-0 font-display text-heading-md font-extrabold text-text-primary"
        >
          Importación completada
        </h2>
        <p className="m-0 text-body-sm text-text-secondary">
          {application.providerName} · Temporada {application.externalSeasonLabel} →{' '}
          {application.destinationSeasonLabel} · {new Date(application.appliedAt).toLocaleString()}
        </p>
      </header>
      <section aria-label="Cambios guardados">
        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {countLabels.map(([key, label]) => (
            <div key={key} className="rounded-lg border border-border-subtle bg-surface-card p-3">
              <dt className="text-caption text-text-secondary">{label}</dt>
              <dd className="m-0 mt-1 font-display text-heading-sm font-extrabold text-text-primary">
                {application.counts[key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {application.notApplied.length ? (
        <details className="rounded-xl border border-border-subtle bg-surface-card p-3">
          <summary className="cursor-pointer text-body-sm font-semibold text-text-primary">
            Registros no aplicados ({application.notApplied.length})
          </summary>
          <ul className="m-0 mt-2 grid gap-1 pl-5 text-body-sm text-text-secondary">
            {application.notApplied.map((item) => (
              <li key={`${item.resource}-${item.externalId}`}>
                {resourceLabels[item.resource]} «{item.title}»:{' '}
                {item.action === 'keep_local' ? 'se conservó el valor local' : 'omitido'}
                {item.reason ? ` — ${item.reason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <nav
        aria-label="Ver datos importados"
        className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4"
      >
        <Button variant="quiet" onClick={onNewImport}>
          Preparar otra importación
        </Button>
        <Link className={buttonClassName('secondaryFilled')} to={`/competitions/${competitionId}`}>
          Volver a competición
        </Link>
        <Link className={buttonClassName('secondaryFilled')} to={`/competitions/${competitionId}/teams`}>
          Ver equipos
        </Link>
        <Link
          className={buttonClassName('primary')}
          to={`/competitions/${competitionId}/seasons/${application.destinationSeasonId}`}
        >
          Ver temporada
        </Link>
      </nav>
    </Card>
  );
}

export function isExpiredProblem(error: unknown) {
  return error instanceof ApiError && error.kind === 'problem' && error.problem?.code === 'IMPORT_PREVIEW_EXPIRED';
}
