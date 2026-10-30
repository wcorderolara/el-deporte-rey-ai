import type { Carousel, Export } from '@edr/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { appCopy, buttonClassName, Card, ErrorBanner, formatDateTime } from '../../ui';
import { exportCarousel, loadActiveDraft, useHistoryApi } from './api';
import { exportActionCopy, historyCopy } from './copy';
import { DownloadExportButton } from './DownloadExportButton';
import { exportPath } from './paths';
import { useLoad } from './useLoad';

export interface ExportActionProps {
  projectId: string;
  /** Called after an export was written, so that the history list is refreshed. */
  onExported: (written: Export) => void;
}

/** Problem codes after which the draft is reloaded: the final approval or the version set changed meanwhile. */
const STALE_DRAFT_CODES = new Set(['FINAL_APPROVAL_REQUIRED', 'VERSION_CONFLICT', 'NOT_FOUND']);

function isStaleDraftError(error: unknown): boolean {
  return error instanceof ApiError && error.problem !== null && STALE_DRAFT_CODES.has(error.problem.code);
}

/**
 * Export of a carousel of the active draft that has a valid final approval (R-216, R-218, R-240). The control exists
 * only for such carousels; the server still decides and refuses with FINAL_APPROVAL_REQUIRED otherwise. The result
 * shows the folder path and the files written. Nothing is published (R-219).
 */
export function ExportAction({ projectId, onExported }: ExportActionProps) {
  const client = useHistoryApi();
  const draft = useLoad(`draft\u0000${projectId}`, (signal) => loadActiveDraft(client, projectId, signal));
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [result, setResult] = useState<Export | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (result !== null) {
      resultHeading.current?.focus();
    }
  }, [result]);

  async function startExport(carousel: Carousel) {
    setPending(carousel.id);
    setFailure(null);
    setAnnouncement(exportActionCopy.exporting);
    try {
      const written = await exportCarousel(client, carousel.id);
      setResult(written);
      setAnnouncement(exportActionCopy.resultTitle);
      onExported(written);
    } catch (error) {
      setFailure(error);
      setAnnouncement('');
      if (isStaleDraftError(error)) {
        draft.reload();
      }
    } finally {
      setPending(null);
    }
  }

  let body;
  switch (draft.state.status) {
    case 'loading':
      body = <p>{appCopy.loading}</p>;
      break;
    case 'error':
      body = <ErrorBanner error={draft.state.error} title={exportActionCopy.loadErrorTitle} onRetry={draft.reload} />;
      break;
    case 'success': {
      const current = draft.state.data;
      if (current === null) {
        body = <p>{exportActionCopy.noDraft}</p>;
      } else if (current.carousels.length === 0) {
        body = <p>{exportActionCopy.noCarousels}</p>;
      } else {
        body = (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {[...current.carousels]
              .sort((a, b) => a.sequence - b.sequence)
              .map((carousel) => (
                <CarouselExport
                  key={carousel.id}
                  carousel={carousel}
                  projectId={projectId}
                  busy={pending !== null}
                  exporting={pending === carousel.id}
                  onExport={() => void startExport(carousel)}
                />
              ))}
          </ul>
        );
      }
      break;
    }
  }

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby={titleId}>
      <h2 id={titleId} className="m-0 font-display text-heading-sm font-extrabold">
        {exportActionCopy.title}
      </h2>
      <p className="m-0 text-body-sm text-text-secondary" role="status" aria-live="polite" data-testid="export-status">
        {announcement}
      </p>
      {failure === null ? null : <ErrorBanner error={failure} title={exportActionCopy.exportErrorTitle} />}
      {body}
      {result === null ? null : (
        <Card as="section" className="grid gap-4 border-brand-gold/40" data-testid="export-result">
          <h3 ref={resultHeading} className="m-0 font-display text-heading-sm font-extrabold" tabIndex={-1}>
            {exportActionCopy.resultTitle}
          </h3>
          <p className="m-0 text-body-sm text-text-secondary">
            {result.files.filter((file) => file.kind === 'slide_image').length} imágenes · Carrusel de Instagram ·{' '}
            {formatDateTime(result.exportedAt)}
          </p>
          <div className="flex flex-wrap gap-3">
            <DownloadExportButton exportId={result.id} className={buttonClassName('primary', 'md')} />
            <Link className={buttonClassName('secondary', 'md')} to={exportPath(projectId, result.id)}>
              {exportActionCopy.openExport}
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

interface CarouselExportProps {
  carousel: Carousel;
  projectId: string;
  /** An export is in progress (any carousel): every control is disabled. */
  busy: boolean;
  /** This carousel is being exported. */
  exporting: boolean;
  onExport: () => void;
}

function CarouselExport({ carousel, projectId, busy, exporting, onExport }: CarouselExportProps) {
  const titleId = useId();
  const approval = carousel.finalApproval;
  const exportable = approval !== null && approval.valid;
  return (
    <li
      className="min-w-0 rounded-card border-hairline border-border-subtle bg-surface-raised p-4"
      data-testid="carousel-export"
    >
      <article className="grid gap-3" aria-labelledby={titleId}>
        <h3 id={titleId} className="m-0 font-display text-body-md font-bold">
          {exportActionCopy.carousel(carousel.sequence, carousel.total)}
        </h3>
        {exportable ? (
          <>
            <p>
              <span aria-hidden="true">✓ </span>
              {exportActionCopy.approved(formatDateTime(approval.approvedAt))}
            </p>
            <button type="button" className={buttonClassName('primary', 'md')} onClick={onExport} disabled={busy}>
              {exporting ? exportActionCopy.exporting : exportActionCopy.export(carousel.sequence)}
            </button>
          </>
        ) : (
          <>
            <p className="m-0 text-body-sm text-text-secondary">
              {approval === null ? exportActionCopy.notApproved : exportActionCopy.invalidated}
            </p>
            <p>
              <Link
                className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
                to={featurePaths.review(projectId)}
              >
                {historyCopy.toReview}
              </Link>
            </p>
          </>
        )}
      </article>
    </li>
  );
}
