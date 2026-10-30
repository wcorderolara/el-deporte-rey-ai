import { useId } from 'react';
import { Link } from 'react-router';

import { Alert, buttonClassName, EmptyState, LoadingState } from '../../ui';
import { loadGlobalExportHistory, useHistoryApi, type GlobalExportHistoryItem } from './api';
import { ExportHistoryCard } from './ExportHistoryCard';
import { exportPath } from './paths';
import { useLoad } from './useLoad';

function ExportCard({ item }: { item: GlobalExportHistoryItem }) {
  return (
    <ExportHistoryCard
      title={item.project.title}
      exportedAt={item.export.exportedAt}
      files={item.export.files}
      exportId={item.export.id}
      contentHref={exportPath(item.project.id, item.export.id)}
      headingLevel="h2"
    />
  );
}

export function GlobalExportHistoryPage() {
  const client = useHistoryApi();
  const history = useLoad('global-export-history', (signal) => loadGlobalExportHistory(client, signal));
  const refresh = () => history.reload();
  const titleId = useId();
  const state = history.state;
  return (
    <section aria-labelledby={titleId} className="grid min-w-0 gap-6">
      <header className="grid gap-2">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Tu biblioteca</p>
        <h1 id={titleId} className="m-0 font-display text-heading-lg font-extrabold tracking-display">
          Exportaciones
        </h1>
      </header>
      {state.status === 'loading' ? <LoadingState layout="panel" label="Cargando exportaciones…" /> : null}
      {state.status === 'error' ? (
        <Alert role="alert" tone="danger" title="No se pudo cargar el historial">
          <p className="m-0">Revisa la conexión y vuelve a intentarlo.</p>
          <button type="button" className={buttonClassName('secondary', 'sm', 'mt-3')} onClick={refresh}>
            Reintentar
          </button>
        </Alert>
      ) : null}
      {state.status === 'success' && state.data.length === 0 ? (
        <EmptyState
          title="Todavía no hay exportaciones"
          description="Cuando exportes un carrusel aprobado, podrás descargarlo de nuevo desde aquí."
          icon="⇩"
          action={
            <Link className={buttonClassName('primary', 'md')} to="/projects">
              Ver mis proyectos
            </Link>
          }
        />
      ) : null}
      {state.status === 'success' && state.data.length > 0 ? (
        <>
          <ul aria-label="Historial de exportaciones" className="m-0 grid min-w-0 list-none gap-4 p-0 lg:grid-cols-2">
            {state.data.map((item) => (
              <li key={item.export.id} className="min-w-0">
                <ExportCard item={item} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
