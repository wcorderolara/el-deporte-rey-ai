/**
 * Export history of a project (PD-ARCH-01F), shown as a secondary, collapsible section of the project detail: every
 * export of the project with its date, carousel, state and number of images, a download and the export detail with
 * the exact exported versions. An export is current only when it was made from the valid final approval of a carousel
 * of the active draft; any other export is kept as history and marked superseded.
 */
import type { Carousel } from '@edr/contracts';
import { Link } from 'react-router';

import { Badge, buttonClassName, ErrorBanner, formatDateTime, LoadingState } from '../../ui';
import { loadProjectExports, useHistoryApi } from './api';
import { currentExport } from './CarouselDownload';
import { DownloadExportButton } from './DownloadExportButton';
import { exportPath } from './paths';
import { useLoad } from './useLoad';

export interface ProjectExportHistoryProps {
  projectId: string;
  /** Carousels of the active draft (empty without a draft). */
  carousels: readonly Carousel[];
  /** Changes whenever an export is written, so the list reloads. */
  refreshKey?: string;
}

export function ProjectExportHistory({ projectId, carousels, refreshKey = '' }: ProjectExportHistoryProps) {
  const client = useHistoryApi();
  const exports = useLoad(`project-exports\u0000${projectId}\u0000${refreshKey}`, (signal) =>
    loadProjectExports(client, projectId, signal),
  );
  const byId = new Map(carousels.map((carousel) => [carousel.id, carousel]));
  const current = new Set(
    carousels
      .map((carousel) => currentExport(exports.latest ?? [], carousel)?.id)
      .filter((id): id is string => id !== undefined),
  );

  if (exports.state.status === 'error' && exports.latest === null) {
    return <ErrorBanner title="No se pudo cargar el historial" error={exports.state.error} onRetry={exports.reload} />;
  }
  if (exports.latest === null) {
    return <LoadingState label="Cargando historial de exportaciones…" />;
  }
  if (exports.latest.length === 0) {
    return <p className="m-0 text-body-sm text-text-secondary">Este proyecto todavía no tiene exportaciones.</p>;
  }
  return (
    <ul aria-label="Historial de exportaciones del proyecto" className="m-0 grid list-none gap-2 p-0">
      {exports.latest.map((item) => {
        const carousel = byId.get(item.carouselId);
        const images = item.files.filter((file) => file.kind === 'slide_image').length;
        const isCurrent = current.has(item.id);
        return (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle px-3 py-2"
          >
            <span className="grid min-w-0 gap-1">
              <strong className="text-text-primary">
                {carousel === undefined
                  ? 'Carrusel de un borrador anterior'
                  : `Carrusel ${String(carousel.sequence)} de ${String(carousel.total)}`}
              </strong>
              <small className="text-text-secondary">
                <time dateTime={item.exportedAt}>{formatDateTime(item.exportedAt)}</time> · {images}{' '}
                {images === 1 ? 'imagen' : 'imágenes'}
              </small>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={isCurrent ? 'success' : 'neutral'}>{isCurrent ? 'Vigente' : 'Sustituida'}</Badge>
              <DownloadExportButton
                exportId={item.id}
                className={buttonClassName('secondary', 'sm')}
                label="Descargar"
              />
              <Link className={buttonClassName('secondary', 'sm')} to={exportPath(projectId, item.id)}>
                Ver detalle
              </Link>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
