/**
 * Result of a content generation batch (PD-ARCH-01E-A): the real state of every requested piece, derived by the
 * server from the run of its project. The page polls while any piece is pending or running and never reports the
 * batch as complete before every run has stopped. Each generated piece links to its project, where it is reviewed,
 * approved and exported with the existing workflow.
 */
import type { ContentBatch } from '@edr/contracts';
import { useCallback, useEffect } from 'react';
import { Link, useParams } from 'react-router';

import { Badge, buttonClassName, Card, ErrorBanner, LoadingState } from '../../ui';
import { batchStateCopy, itemStatusCopy, pieceKindCopy, skipReasonCopy } from './generationCopy';
import { generateContentPath, isProjectId, projectPath } from './paths';
import { ProjectNotFound } from './ProjectDetailPage';
import { useProjectsDependencies } from './ProjectsContext';
import { useApiRequest } from './useApiRequest';

function Totals({ batch }: { batch: ContentBatch }) {
  const entries = [
    ['Solicitadas', batch.totals.requested],
    ['Generadas', batch.totals.generated],
    ['Fallidas', batch.totals.failed],
    ['Omitidas', batch.totals.skipped],
    ['Pendientes', batch.totals.pending],
  ] as const;
  return (
    <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-card border-hairline border-border-subtle bg-surface-subtle p-3">
          <dt className="text-caption font-bold tracking-label text-text-secondary uppercase">{label}</dt>
          <dd className="m-0 font-display text-heading-sm font-extrabold text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContentBatchPage() {
  const { batchId } = useParams();
  const { api, runPollIntervalMs } = useProjectsDependencies();
  const valid = isProjectId(batchId);
  const load = useCallback((signal: AbortSignal) => api.getContentBatch(batchId ?? '', signal), [api, batchId]);
  const { state, reload } = useApiRequest(valid ? `batch:${batchId}` : null, load);
  const inProgress = state.status === 'success' && state.data.state === 'in_progress';

  useEffect(() => {
    if (!inProgress) {
      return undefined;
    }
    const timer = setTimeout(reload, runPollIntervalMs);
    return () => clearTimeout(timer);
  }, [inProgress, reload, runPollIntervalMs, state]);

  if (!valid) {
    return <ProjectNotFound />;
  }
  return (
    <section aria-labelledby="batch-title" className="grid min-w-0 gap-6">
      <div className="grid gap-2">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Generación múltiple</p>
        <h1 id="batch-title" className="m-0 font-display text-heading-md font-extrabold tracking-display">
          Resultado de la generación
        </h1>
      </div>
      {state.status === 'loading' || state.status === 'idle' ? <LoadingState label="Cargando la generación…" /> : null}
      {state.status === 'error' ? <ErrorBanner error={state.error} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <>
          <Card as="section" aria-labelledby="batch-context-title" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="batch-context-title" className="m-0 text-heading-sm font-bold">
                {state.data.context.competitionName} · {state.data.context.seasonLabel} ·{' '}
                {state.data.context.stageName === null ? '' : `${state.data.context.stageName} · `}
                {state.data.context.roundName}
              </h2>
              <span role="status" aria-live="polite">
                <Badge tone={batchStateCopy[state.data.state].tone}>{batchStateCopy[state.data.state].label}</Badge>
              </span>
            </div>
            <Totals batch={state.data} />
            {inProgress ? (
              <LoadingState label="Las piezas pendientes se están preparando; esta página se actualiza sola." />
            ) : null}
          </Card>
          <Card as="section" aria-labelledby="batch-items-title" className="grid gap-3">
            <h2 id="batch-items-title" className="m-0 text-heading-sm font-bold">
              Piezas
            </h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {state.data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-subtle px-3 py-2"
                >
                  <span className="min-w-0">
                    <strong>{item.title}</strong>
                    <small className="block text-text-secondary">
                      {pieceKindCopy[item.kind].label} · Identificador <code translate="no">{item.id}</code>
                    </small>
                    {item.skipReason === null ? null : (
                      <small className="block text-text-secondary">{skipReasonCopy[item.skipReason]}</small>
                    )}
                    {item.failure === null ? null : (
                      <small className="block text-danger">La preparación falló ({item.failure.code}).</small>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={itemStatusCopy[item.status].tone}>{itemStatusCopy[item.status].label}</Badge>
                    {item.projectId === null ? null : (
                      <Link className={buttonClassName('secondary', 'sm')} to={projectPath(item.projectId)}>
                        Abrir proyecto
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <div>
            <Link className={buttonClassName('secondary')} to={generateContentPath}>
              Nueva generación
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
