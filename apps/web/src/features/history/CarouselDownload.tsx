/**
 * Download of one carousel (PD-ARCH-01F), offered where the operator reviews or opens the project. Approval,
 * export preparation and download stay separate operations, connected here:
 *
 * - shown only for a carousel with a valid final approval (the server still decides every export);
 * - every download asks the server to write the export first (exportCarousel), then downloads that export. The server
 *   plans it from the current state: the version set of the valid final approval and the editorial copy exportable
 *   at that moment (REVIEW-APPROVAL-01), re-checked when it records the export. The web never decides by itself that
 *   an earlier export still holds the current content (E2E-F01, WI-2 UI-06.1): copy approved, edited or withdrawn
 *   after an export reaches the next download, and the earlier exports stay in the history as they were written;
 * - an export of an earlier final approval (for example before a regeneration) is never downloaded from here.
 */
import type { Carousel, Export } from '@edr/contracts';
import { useState } from 'react';

import { ApiError } from '../../api/client';
import { buttonClassName } from '../../ui';
import { downloadExport, exportCarousel, saveExportZip, useHistoryApi } from './api';

export interface CarouselDownloadProps {
  carousel: Carousel;
  /** Called after a new export was written (to refresh a history list). */
  onExported?: (written: Export) => void;
  /** Called when the server reports the final approval as no longer valid (to reload the draft). */
  onStale?: () => void;
  className?: string;
  /** The success message is only announced to assistive technology, not shown (the review, UX-REVIEW-01). */
  quietSuccess?: boolean;
}

/**
 * The newest export of the carousel made from its current valid final approval (the history marks it Vigente); null
 * when there is none. The download never reuses it: it only names the latest export of the valid approval.
 */
export function currentExport(exports: readonly Export[], carousel: Carousel): Export | null {
  const approval = carousel.finalApproval;
  if (approval === null || !approval.valid) {
    return null;
  }
  return exports.find((item) => item.carouselId === carousel.id && item.finalApprovalId === approval.id) ?? null;
}

export function CarouselDownload({
  carousel,
  onExported,
  onStale,
  className,
  quietSuccess = false,
}: CarouselDownloadProps) {
  const client = useHistoryApi();
  const approval = carousel.finalApproval;
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
      // The server writes the export from the current state (E2E-F01); an earlier export is never reused here.
      setStep('exporting');
      const target = await exportCarousel(client, carousel.id);
      onExported?.(target);
      setStep('downloading');
      saveExportZip(await downloadExport(client, target.id), target.id);
      setMessage('La descarga está lista.');
      setSucceeded(true);
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      if (code === 'FINAL_APPROVAL_REQUIRED') {
        setMessage('La aprobación final ya no es válida. Vuelve a aprobar el carrusel para descargarlo.');
        onStale?.();
      } else if (code === 'VERSION_CONFLICT') {
        // The approved editorial copy changed while the export was written (REVIEW-APPROVAL-01): nothing was recorded.
        setMessage('El copy editorial cambió mientras se preparaba la descarga. Vuelve a descargar el carrusel.');
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

  return (
    <span className="grid gap-1">
      <button
        type="button"
        className={className ?? buttonClassName('primary', 'md')}
        disabled={step !== 'idle'}
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
