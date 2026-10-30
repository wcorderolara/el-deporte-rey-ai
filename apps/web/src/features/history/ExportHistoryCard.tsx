import { createElement, useId } from 'react';
import { Link } from 'react-router';

import { Badge, buttonClassName, Card, formatDateTime } from '../../ui';
import { DownloadExportButton } from './DownloadExportButton';
import type { ExportFile } from '@edr/contracts';

/** Shared vertical history card for both global and project-scoped exports. */
export function ExportHistoryCard({
  title,
  exportedAt,
  files,
  exportId,
  contentHref,
  headingLevel,
}: {
  title: string;
  exportedAt: string;
  files: readonly ExportFile[];
  exportId: string;
  contentHref: string;
  headingLevel: 'h2' | 'h3';
}) {
  const titleId = useId();
  const count = files.filter((file) => file.kind === 'slide_image').length;
  const Heading = headingLevel;
  return (
    <Card as="article" aria-labelledby={titleId} className="grid min-w-0 gap-3" data-testid="export-row">
      <div data-testid="export-card-title-row" className="min-w-0">
        {createElement(
          Heading,
          {
            id: titleId,
            className:
              'm-0 line-clamp-3 min-w-0 overflow-hidden text-pretty font-display text-heading-sm font-extrabold tracking-heading',
          },
          title,
        )}
      </div>
      <div data-testid="export-card-metadata-row" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <Badge tone="success" data-testid="export-label">
          Exportado
        </Badge>
        <span className="text-body-sm text-text-secondary">
          {count} {count === 1 ? 'imagen' : 'imágenes'}
        </span>
        <time className="text-body-sm text-text-subtle" dateTime={exportedAt}>
          {formatDateTime(exportedAt)}
        </time>
      </div>
      <div data-testid="export-card-actions-row" className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <DownloadExportButton
          exportId={exportId}
          containerClassName="block w-full sm:inline-block sm:w-auto"
          className={buttonClassName('primary', 'sm', 'w-full sm:w-auto')}
        />
        <Link className={buttonClassName('secondary', 'sm', 'w-full sm:w-auto')} to={contentHref}>
          Ver contenido
        </Link>
      </div>
    </Card>
  );
}
