import type { Carousel, Project } from '@edr/contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { featurePaths } from '../../app/routes';
import { Badge, buttonClassName, classNames, Icon } from '../../ui';
import { contentTypeLabel, projectStatus, sportsContextSummary } from '../projects/dashboardModel';
import { reviewCopy, workspaceCopy } from './copy';
import type { ReviewIndicators } from './model';

export interface ReviewHeaderProps {
  projectId: string;
  project: Project | null;
  carousels: readonly Carousel[];
  carousel: Carousel | undefined;
  onSelectCarousel: (id: string) => void;
  indicators: ReviewIndicators;
  /** Width and height of the carousel's slides, when the server reports them. */
  format: { width: number; height: number } | null;
  /** The final approval or the downloads, with the review menu. */
  actions: ReactNode;
}

function Indicator({
  label,
  value,
  tone,
  symbol,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  symbol: string;
}) {
  return (
    <li
      className={classNames(
        'inline-flex min-h-8 items-center gap-1.5 rounded-control border px-2.5 py-1 text-body-sm',
        tone === 'success'
          ? 'border-success bg-success-surface'
          : tone === 'warning'
            ? 'border-warning bg-warning-surface'
            : tone === 'danger'
              ? 'border-danger bg-danger-surface'
              : tone === 'info'
                ? 'border-info bg-info-surface'
                : 'border-border-default bg-surface-card',
      )}
    >
      <span
        aria-hidden="true"
        className={
          tone === 'success'
            ? 'text-success'
            : tone === 'warning'
              ? 'text-warning'
              : tone === 'danger'
                ? 'text-danger'
                : 'text-info'
        }
      >
        {symbol}
      </span>
      <span className="text-caption font-bold text-text-secondary">{label}:</span>
      <span className="font-bold text-text-primary">{value}</span>
    </li>
  );
}

/**
 * The persistent header of the review (UX-REVIEW-01): the way back to the project, the project's full title and
 * context (content type, competition, season, stage and round, slide format and project state, never truncated), the
 * compact indicators of the selected carousel (slides, copy, blocking items, warnings, all derived from the shown
 * state), the carousel picker when there are several, and the final approval or the downloads with
 * the review menu (refresh and the secondary downloads).
 */
export function ReviewHeader({
  projectId,
  project,
  carousels,
  carousel,
  onSelectCarousel,
  indicators,
  format,
  actions,
}: ReviewHeaderProps) {
  const status = project === null ? null : projectStatus(project);
  const slidesDone = indicators.slidesTotal > 0 && indicators.slidesApproved === indicators.slidesTotal;
  const copyDone = indicators.copyTotal > 0 && indicators.copyApproved === indicators.copyTotal;
  return (
    <header className="grid gap-3 rounded-panel border border-border-subtle bg-surface-raised px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            className={buttonClassName('secondary', 'sm')}
            to={`${featurePaths.projects}/${encodeURIComponent(projectId)}`}
          >
            <Icon name="arrow-left" size={16} />
            {reviewCopy.backToProject}
          </Link>
          <h1
            id="review-title"
            className="m-0 font-sans text-caption font-bold tracking-label text-text-secondary uppercase"
          >
            {reviewCopy.title}
          </h1>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] lg:items-start">
        <div className="grid min-w-0 gap-2">
          {project === null ? null : (
            <div className="grid gap-1" data-testid="review-project-context">
              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-heading-sm font-extrabold tracking-heading break-words text-text-primary 2xl:text-heading-md">
                  {project.title}
                </span>
                {status === null ? null : <Badge tone={status.tone}>{status.label}</Badge>}
              </p>
              <p className="m-0 text-body-sm text-text-secondary">
                {[
                  contentTypeLabel(project),
                  sportsContextSummary(project),
                  ...(format === null ? [] : [workspaceCopy.format(format.width, format.height)]),
                ].join(' · ')}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {carousel === undefined ? null : (
              <ul aria-label={workspaceCopy.indicatorsLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
                <Indicator
                  label={workspaceCopy.slidesIndicator}
                  value={workspaceCopy.slidesValue(indicators.slidesApproved, indicators.slidesTotal)}
                  tone={slidesDone ? 'success' : 'neutral'}
                  symbol={slidesDone ? '✓' : '◐'}
                />
                <Indicator
                  label={workspaceCopy.copyIndicator}
                  value={`${workspaceCopy.copyValue(indicators.copyApproved, indicators.copyTotal)}${
                    indicators.editorialGenerated ? '' : ` · ${workspaceCopy.copyNotGenerated}`
                  }`}
                  tone={copyDone && indicators.editorialGenerated ? 'success' : 'neutral'}
                  symbol={copyDone && indicators.editorialGenerated ? '✓' : '◐'}
                />
                <Indicator
                  label={workspaceCopy.blockingIndicator}
                  value={workspaceCopy.blockingValue(indicators.blocking)}
                  tone={indicators.blocking > 0 ? 'danger' : 'success'}
                  symbol={indicators.blocking > 0 ? '!' : '✓'}
                />
                {indicators.warnings === 0 ? null : (
                  <Indicator
                    label={workspaceCopy.warningsIndicator}
                    value={String(indicators.warnings)}
                    tone="warning"
                    symbol="!"
                  />
                )}
              </ul>
            )}
            {carousels.length > 1 && carousel !== undefined ? (
              <nav aria-label={reviewCopy.carouselPicker}>
                <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                  {carousels.map((item) => {
                    const itemSlides = item.elements.filter((element) => element.kind === 'slide');
                    const count = itemSlides.filter((element) => element.currentVersion.state === 'approved').length;
                    const current = item.id === carousel.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={current ? 'true' : undefined}
                          aria-pressed={current}
                          className={classNames(
                            'focus-studio m-0 inline-flex min-h-touch cursor-pointer flex-col items-start rounded-control border px-3 py-1 text-left',
                            current
                              ? 'border-brand-gold bg-surface-overlay text-text-primary'
                              : 'border-border-default bg-surface-card text-text-secondary hover:border-border-strong',
                          )}
                          onClick={() => onSelectCarousel(item.id)}
                        >
                          <span className="font-sans text-body-sm font-bold">
                            {reviewCopy.carouselPosition(item.sequence, item.total)}
                          </span>
                          <span className="font-sans text-caption">
                            {reviewCopy.slideProgress(count, itemSlides.length)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}
          </div>
        </div>
        <section aria-label="Aprobación final" className="min-w-0">
          {actions}
        </section>
      </div>
    </header>
  );
}
