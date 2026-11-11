/**
 * Download of one carousel (PD-ARCH-01F), offered where the operator reviews or opens the project. Approval,
 * export preparation and download stay separate operations, connected here:
 *
 * - shown only for a carousel with a valid final approval (the server still decides every export);
 * - an existing export of this carousel made from its current final approval is downloaded again as is;
 * - otherwise the existing export operation writes it first, then it is downloaded;
 * - an export made from an earlier final approval (for example before a regeneration) is never reused.
 */
import type { Carousel, Export } from '@edr/contracts';
import { useState } from 'react';

import { ApiError } from '../../api/client';
import { buttonClassName } from '../../ui';
import { downloadExport, exportCarousel, loadProjectExports, saveExportZip, useHistoryApi } from './api';
import { useLoad } from './useLoad';

export interface CarouselDownloadProps {
  projectId: string;
  carousel: Carousel;
  /** Called after a new export was written (to refresh a history list). */
  onExported?: (written: Export) => void;
  /** Called when the server reports the final approval as no longer valid (to reload the draft). */
  onStale?: () => void;
  className?: string;
  /** The success message is only announced to assistive technology, not shown (the review, UX-REVIEW-01). */
  quietSuccess?: boolean;
}

/** The export of the carousel made from its current valid final approval, newest first; null when there is none. */
export function currentExport(exports: readonly Export[], carousel: Carousel): Export | null {
  const approval = carousel.finalApproval;
  if (approval === null || !approval.valid) {
    return null;
  }
  return exports.find((item) => item.carouselId === carousel.id && item.finalApprovalId === approval.id) ?? null;
}

const STALE_CODES = new Set(['FINAL_APPROVAL_REQUIRED', 'VERSION_CONFLICT']);

export function CarouselDownload({
  projectId,
  carousel,
  onExported,
  onStale,
  className,
  quietSuccess = false,
}: CarouselDownloadProps) {
  const client = useHistoryApi();
  const approval = carousel.finalApproval;
  const exports = useLoad(
    `carousel-exports\u0000${projectId}\u0000${carousel.id}\u0000${approval?.id ?? ''}`,
    (signal) => loadProjectExports(client, projectId, signal),
  );
  const [step, setStep] = useState<'idle' | 'exporting' | 'downloading'>('idle');
  const [message, setMessage] = useState('');
  const [succeeded, setSucceeded] = useState(false);

  if (approval === null || !approval.valid) {
    return null;
  }

  async function download() {
    if (step !== 'idle') {
      return;
    }
    setMessage('');
    setSucceeded(false);
    try {
      let target = currentExport(exports.latest ?? [], carousel);
      if (target === null) {
        setStep('exporting');
        target = await exportCarousel(client, carousel.id);
        onExported?.(target);
        exports.reload();
      }
      setStep('downloading');
      saveExportZip(await downloadExport(client, target.id), target.id);
      setMessage('La descarga está lista.');
      setSucceeded(true);
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      if (code !== undefined && STALE_CODES.has(code)) {
        setMessage('La aprobación final ya no es válida. Vuelve a aprobar el carrusel para descargarlo.');
        onStale?.();
      } else if (code === 'EXPORT_FILES_MISSING' || code === 'EXPORT_FILES_CORRUPT') {
        setMessage('Los archivos de esta exportación no están disponibles o no se pudieron verificar.');
      } else {
        setMessage('No se pudo preparar la descarga. Comprueba la conexión e inténtalo de nuevo.');
      }
    } finally {
      setStep('idle');
    }
  }

  const ready = exports.state.status !== 'loading' || exports.latest !== null;
  return (
    <span className="grid gap-1">
      <button
        type="button"
        className={className ?? buttonClassName('primary', 'md')}
        disabled={step !== 'idle' || !ready}
        aria-busy={step !== 'idle'}
        onClick={() => void download()}
      >
        {step === 'exporting'
          ? 'Preparando exportación…'
          : step === 'downloading'
            ? 'Descargando…'
            : carousel.total > 1
              ? `Descargar carrusel ${String(carousel.sequence)} de ${String(carousel.total)}`
              : 'Descargar carrusel'}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={quietSuccess && succeeded ? 'sr-only' : 'text-body-sm text-text-secondary'}
      >
        {message}
      </span>
    </span>
  );
}
