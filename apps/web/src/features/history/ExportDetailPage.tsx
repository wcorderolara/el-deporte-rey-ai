import type { ExportDetail, TextField } from '@edr/contracts';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { appCopy, buttonClassName, ErrorBanner, formatDateTime, Icon, StatusBadge } from '../../ui';
import { loadExport, slideImageSource, useHistoryApi } from './api';
import { detailCopy, historyCopy, textFieldLabel } from './copy';
import { DownloadExportButton } from './DownloadExportButton';
import { ReviewThumbnailRail, type ReviewThumbnail } from '../review/ReviewThumbnailRail';
import { SlidePanel, SlideWorkspace } from '../review/SlideWorkspace';
import { exportsPath, isUuid, projectPath } from './paths';
import { useLoad } from './useLoad';

/**
 * Route component: one export reopened with the exact exported slides and caption (`.../exports/:exportId`, R-220),
 * in the layout of the content review (UX-REVIEW-01), with the demonstration label (R-269). The operator-attested
 * label is not shown here (Product Owner, 2026-11-11); the export manifest still states it (OD-28).
 */
export function ExportDetailPage() {
  const { projectId, exportId } = useParams();
  const valid = isUuid(projectId) && isUuid(exportId);
  return (
    <section aria-labelledby="export-title">
      <h1 id="export-title">{detailCopy.title}</h1>
      {valid ? (
        <ExportDetailView key={`${projectId}/${exportId}`} projectId={projectId} exportId={exportId} />
      ) : (
        <>
          <p>{detailCopy.invalidAddress}</p>
          {isUuid(projectId) ? <BackLinks projectId={projectId} /> : null}
        </>
      )}
    </section>
  );
}

function BackLinks({ projectId }: { projectId: string }) {
  return (
    <p className="m-0 flex flex-wrap gap-4 text-body-sm">
      <Link
        className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
        to={exportsPath(projectId)}
      >
        {historyCopy.backToExports}
      </Link>
      <Link
        className="focus-studio text-text-link underline decoration-border-strong underline-offset-4"
        to={projectPath(projectId)}
      >
        {historyCopy.backToProject}
      </Link>
    </p>
  );
}

function ExportDetailView({ projectId, exportId }: { projectId: string; exportId: string }) {
  const client = useHistoryApi();
  const detail = useLoad(`export\u0000${exportId}`, (signal) => loadExport(client, exportId, signal));

  switch (detail.state.status) {
    case 'loading':
      return (
        <p role="status" aria-live="polite">
          {appCopy.loading}
        </p>
      );
    case 'error':
      return (
        <>
          <ErrorBanner error={detail.state.error} title={detailCopy.loadErrorTitle} onRetry={detail.reload} />
          <BackLinks projectId={projectId} />
        </>
      );
    case 'success':
      // The address and the export must agree on the project; another project's export is not shown here.
      if (detail.state.data.projectId !== projectId) {
        return (
          <>
            <p>{detailCopy.otherProject}</p>
            <BackLinks projectId={projectId} />
          </>
        );
      }
      return <ExportContent projectId={projectId} detail={detail.state.data} />;
  }
}

function ExportContent({ projectId, detail }: { projectId: string; detail: ExportDetail }) {
  const slideCount = detail.files.filter((file) => file.kind === 'slide_image').length;
  const isDemo = detail.demonstration || detail.dataMode === 'DEMO_DATA';
  const slides = detail.elements.filter((element) => element.kind === 'slide').sort((a, b) => a.position - b.position);
  const caption = detail.elements.find((element) => element.kind === 'caption');
  const [selectedPosition, setSelectedPosition] = useState(slides[0]?.position ?? 1);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((element) => element.position === selectedPosition),
  );
  const selectedSlide = slides[selectedIndex];
  const previousSlide = slides[selectedIndex - 1];
  const nextSlide = slides[selectedIndex + 1];
  const items: ReviewThumbnail[] = slides.map((element) => ({
    id: String(element.position),
    position: element.position,
    imageUrl: element.version.imageUrl,
    imageSource: element.version.imageUrl ? slideImageSource(element.version.id) : null,
    title: 'Diapositiva',
    ariaLabel: `Diapositiva ${element.position}`,
  }));
  return (
    <div className="grid min-w-0 gap-4" data-testid="export-summary">
      {isDemo ? (
        <p role="note" className="m-0 border-l-2 border-demo px-3 py-1 text-caption text-demo">
          Datos sintéticos · no verificados ni publicables.
        </p>
      ) : null}
      {slides.length === 0 ? <p className="m-0 text-text-secondary">{detailCopy.noElements}</p> : null}
      {selectedSlide ? (
        <>
          <h2 className="sr-only">{detailCopy.previewTitle}</h2>
          <SlideWorkspace
            aria-labelledby="export-title"
            navigation={
              <ReviewThumbnailRail
                label="Diapositivas del carrusel"
                heading={`${slideCount} diapositivas`}
                items={items}
                selectedId={String(selectedSlide.position)}
                onSelect={(id) => setSelectedPosition(Number(id))}
                fill
              />
            }
            preview={{
              name: detailCopy.slide(selectedSlide.position),
              typeLabel: null,
              version: selectedSlide.version,
              imageSource: selectedSlide.version.imageUrl ? slideImageSource(selectedSlide.version.id) : null,
              imageAlt: detailCopy.imageAlt(selectedSlide.position, selectedSlide.version.versionNumber),
              noImageText: detailCopy.noImage,
              pager: {
                position: selectedSlide.position,
                total: slides.length,
                ...(previousSlide ? { onPrevious: () => setSelectedPosition(previousSlide.position) } : {}),
                ...(nextSlide ? { onNext: () => setSelectedPosition(nextSlide.position) } : {}),
              },
            }}
            panel={
              <SlidePanel
                label="Resumen de la diapositiva"
                eyebrow="Resumen"
                badges={<StatusBadge label="Exportado" tone="positive" symbol="✓" />}
                title={detailCopy.slide(selectedSlide.position)}
                meta={
                  <p className="m-0 text-body-sm text-text-secondary">
                    <time dateTime={detail.exportedAt}>{formatDateTime(detail.exportedAt)}</time> · {slideCount}{' '}
                    {slideCount === 1 ? 'imagen' : 'imágenes'}
                  </p>
                }
              >
                <SummaryFields fields={selectedSlide.version.fields} />
                <div className="grid gap-2">
                  <DownloadExportButton
                    exportId={detail.id}
                    className={buttonClassName('primary', 'md', 'w-full')}
                    containerClassName="grid gap-1"
                    statusClassName="text-caption text-text-secondary"
                  />
                  <Link className={buttonClassName('secondary', 'md', 'w-full')} to={projectPath(projectId)}>
                    <Icon name="arrow-left" size={16} />
                    {historyCopy.backToProject}
                  </Link>
                </div>
              </SlidePanel>
            }
          />
        </>
      ) : null}
      {caption ? (
        <details className="rounded-card border-hairline border-border-subtle bg-surface-raised p-4">
          <summary className="focus-studio min-h-touch cursor-pointer text-body-sm font-bold text-text-link underline decoration-border-strong underline-offset-4">
            Ver texto de publicación
          </summary>
          <div className="mt-3">
            <SummaryFields fields={caption.version.fields.filter((field) => field.field === 'caption')} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SummaryFields({ fields }: { fields: readonly TextField[] }) {
  const summaryFields = fields.filter((field) =>
    ['title', 'kickoff', 'score', 'team_home', 'team_away', 'caption'].includes(field.field),
  );
  if (summaryFields.length === 0) return null;
  return (
    <dl className="m-0 grid min-w-0 gap-3">
      {summaryFields.map((field, index) => (
        <div
          key={`${field.field}-${index}`}
          className="min-w-0"
          data-testid="export-summary-field"
          data-field={field.field}
        >
          <dt className="text-caption font-bold text-text-secondary">{textFieldLabel[field.field]}</dt>
          <dd className="m-0 whitespace-pre-wrap break-words text-body-md text-text-primary">
            {field.segments.map((segment) => segment.text).join(' ')}
          </dd>
        </div>
      ))}
    </dl>
  );
}
