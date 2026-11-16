import { contractRegExp, type Element, type Project } from '@edr/contracts';
import { Link, useParams } from 'react-router';
import { useEffect, useId, useRef, useState } from 'react';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { classNames, ErrorBanner, Tabs, tabId, tabPanelId, type TabOption } from '../../ui';
import { CarouselReview } from './CarouselReview';
import { EditorialCopy } from './editorial/EditorialCopy';
import { useEditorialPackage } from './editorial/useEditorialPackage';
import { finalCopy, reviewCopy, workspaceCopy } from './copy';
import { FinalApprovalAction } from './FinalApproval';
import { orderedElements, reviewIndicators } from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { ReviewDownloads, ReviewMenu, type ReviewMenuMessage } from './ReviewDownloads';
import { ReviewHeader } from './ReviewHeader';
import { useDraft } from './useDraft';

const UUID = contractRegExp('Uuid');

function projectPath(projectId: string): string {
  return `${featurePaths.projects}/${encodeURIComponent(projectId)}`;
}

function isNoDraft(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'problem' && error.problem?.code === 'NOT_FOUND';
}

/** The project the review belongs to (PD-ARCH-01F); omitted, without blocking the review, if it cannot be read. */
function useReviewProject(projectId: string, refreshKey: string): Project | null {
  const { api } = useReviewDependencies();
  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.getProject(projectId, controller.signal).then(
      (loaded) => {
        if (!controller.signal.aborted) setProject(loaded);
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [api, projectId, refreshKey]);
  return project;
}

type ReviewMode = 'design' | 'copy';

function ProjectReview({ projectId }: { projectId: string }) {
  const { api } = useReviewDependencies();
  const request = useDraft(api, projectId);
  const [selectedCarouselId, setSelectedCarouselId] = useState<string | null>(null);
  // The selected slide of each carousel, kept here so that it survives a change of mode.
  const [selectedSlides, setSelectedSlides] = useState<Readonly<Record<string, string>>>({});
  const [mode, setMode] = useState<ReviewMode>('design');
  const [copyDirty, setCopyDirty] = useState(false);
  const [exportsWritten, setExportsWritten] = useState(0);
  const [finalMessage, setFinalMessage] = useState('');
  const [menuMessage, setMenuMessage] = useState<ReviewMenuMessage>({ text: '', failed: false });
  const [focusDownload, setFocusDownload] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const modesId = useId();
  const state = request.state;
  const draft = state.status === 'success' ? state.draft : null;
  const editorial = useEditorialPackage(projectId, draft?.id ?? null);
  // The header status follows the final approvals shown in the review and the exports written from it.
  const project = useReviewProject(
    projectId,
    `${draft === null ? '' : draft.carousels.map((item) => `${item.id}:${item.finalApproval?.id ?? ''}`).join(',')}#${exportsWritten}`,
  );

  // After the final approval the download becomes the main action: the focus moves to it.
  useEffect(() => {
    if (!focusDownload) return;
    actionsRef.current?.focus();
    setFocusDownload(false);
  });

  if (state.status !== 'success') {
    return (
      <section aria-labelledby="review-title" className={styles.page}>
        <h1 id="review-title">{reviewCopy.title}</h1>
        {state.status === 'loading' ? (
          <p role="status">{reviewCopy.loading}</p>
        ) : isNoDraft(state.error) ? (
          <p role="status">{reviewCopy.noDraft}</p>
        ) : (
          <ErrorBanner title={reviewCopy.loadError} error={state.error} onRetry={request.reload} />
        )}
        <p>
          <Link to={projectPath(projectId)}>{reviewCopy.backToProject}</Link>
        </p>
      </section>
    );
  }

  const loaded = state.draft;
  const carousels = [...loaded.carousels].sort((a, b) => a.sequence - b.sequence);
  const carousel = carousels.find((item) => item.id === selectedCarouselId) ?? carousels[0];
  const slides = carousel === undefined ? [] : orderedElements(carousel).filter((element) => element.kind === 'slide');
  const selectedSlide = slides.find((element) => element.id === selectedSlides[carousel?.id ?? '']) ?? slides[0];
  const caption = carousel?.elements.find((element) => element.kind === 'caption');
  const indicators = reviewIndicators(carousel, editorial.pkg);
  const firstVersion = slides[0]?.currentVersion;
  const format =
    firstVersion === undefined || firstVersion.width === null || firstVersion.height === null
      ? null
      : { width: firstVersion.width, height: firstVersion.height };
  const slidesPending = indicators.slidesTotal - indicators.slidesApproved;
  const copyPending = indicators.copyTotal - indicators.copyApproved;

  const handleElementChanged = (element: Element) => {
    request.showElement(element);
    void request.refresh();
  };

  const modes: TabOption<ReviewMode>[] = [
    {
      value: 'design',
      label: workspaceCopy.designTab,
      ...(slidesPending > 0
        ? { badge: workspaceCopy.pending(slidesPending), badgeTone: 'warning' as const }
        : indicators.slidesTotal > 0
          ? { badge: workspaceCopy.approved, badgeTone: 'success' as const }
          : {}),
    },
    {
      value: 'copy',
      label: workspaceCopy.copyTab,
      ...(copyDirty
        ? { badge: workspaceCopy.unsaved, badgeTone: 'warning' as const }
        : copyPending > 0
          ? { badge: workspaceCopy.pending(copyPending), badgeTone: 'warning' as const }
          : indicators.editorialGenerated
            ? { badge: workspaceCopy.approved, badgeTone: 'success' as const }
            : { badge: workspaceCopy.notGenerated, badgeTone: 'neutral' as const }),
    },
  ];

  const menu = (
    <ReviewMenu
      carousel={carousel}
      selectedSlide={selectedSlide}
      editorial={editorial.pkg}
      refreshing={request.refreshing}
      onRefresh={() => void request.refresh()}
      onMessage={setMenuMessage}
    />
  );

  const actions = (
    <div ref={actionsRef} tabIndex={-1} className="focus-studio grid gap-1 rounded-control">
      {carousel === undefined ? (
        <div className="flex justify-end">{menu}</div>
      ) : (
        <>
          <FinalApprovalAction
            carousel={carousel}
            editorial={editorial.pkg}
            menu={menu}
            onApproved={(approval) => {
              request.showFinalApproval(approval);
              setFinalMessage(finalCopy.recorded);
              setFocusDownload(true);
              void request.refresh();
            }}
            onRefused={() => void request.refresh()}
          />
          <ReviewDownloads
            carousel={carousel}
            menu={menu}
            onExported={() => setExportsWritten((count) => count + 1)}
            onStale={() => void request.refresh()}
          />
        </>
      )}
      <p role="status" aria-live="polite" className="m-0 text-caption font-bold text-success lg:text-right">
        {finalMessage}
      </p>
      {/* Menu results: a failure is shown, a success is only announced. */}
      <p
        role="status"
        aria-live="polite"
        className={menuMessage.failed ? 'm-0 text-caption text-danger lg:text-right' : 'sr-only'}
      >
        {menuMessage.text}
      </p>
    </div>
  );

  return (
    <article aria-labelledby="review-title" className={`${styles.theme} grid gap-4`}>
      {/*
       * From the lg breakpoint the workspace fills the height of the window below the header and the tabs, and never
       * gets less than 34rem: on a short window (1280 × 720, R-03) the page grows and scrolls instead of the preview
       * running past its column. The open mode is size-contained, so its content scrolls inside its panels instead of
       * growing the row.
       */}
      <div
        className={classNames(
          'flex min-w-0 flex-col gap-3',
          carousel === undefined ? '' : 'lg:grid lg:min-h-[calc(100dvh-1.5rem)] lg:grid-rows-[auto_minmax(34rem,1fr)]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <ReviewHeader
            projectId={projectId}
            project={project}
            carousels={carousels}
            carousel={carousel}
            onSelectCarousel={(id) => {
              setSelectedCarouselId(id);
              setFinalMessage('');
            }}
            indicators={indicators}
            format={format}
            actions={actions}
          />
          {loaded.demonstration || loaded.dataMode === 'DEMO_DATA' ? (
            <p
              role="note"
              className="m-0 rounded-control border-alert border-demo bg-demo-surface px-3 py-2 text-body-sm text-demo"
            >
              {workspaceCopy.demoNote}
            </p>
          ) : null}
          <p role="status" aria-live="polite" className={styles.visuallyHidden}>
            {request.refreshing ? reviewCopy.refreshing : ''}
          </p>
          {request.refreshError === null ? null : (
            <ErrorBanner title={reviewCopy.refreshError} error={request.refreshError} onRetry={request.refresh} />
          )}
          {carousel === undefined ? (
            <p className="m-0 rounded-panel border border-dashed border-border-strong p-6 text-text-secondary">
              {reviewCopy.noCarousels}
            </p>
          ) : (
            <Tabs
              id={modesId}
              label={workspaceCopy.modesLabel}
              size="lg"
              options={modes}
              value={mode}
              onChange={setMode}
              className="self-start"
            />
          )}
        </div>
        {carousel === undefined ? null : (
          <>
            {/* Both modes stay mounted: the selected slide, open edits and messages survive a change of mode. */}
            <div
              role="tabpanel"
              id={tabPanelId(modesId, 'design')}
              aria-labelledby={tabId(modesId, 'design')}
              hidden={mode !== 'design'}
              className={mode === 'design' ? 'min-h-0 min-w-0 flex-1 lg:[contain:size]' : 'hidden'}
            >
              <CarouselReview
                key={carousel.id}
                carousel={carousel}
                selectedSlideId={selectedSlide?.id ?? null}
                onSelectSlide={(id) => setSelectedSlides((current) => ({ ...current, [carousel.id]: id }))}
                onElementChanged={request.showElement}
                onRefresh={request.refresh}
              />
            </div>
            <div
              role="tabpanel"
              id={tabPanelId(modesId, 'copy')}
              aria-labelledby={tabId(modesId, 'copy')}
              hidden={mode !== 'copy'}
              className={mode === 'copy' ? 'min-h-0 min-w-0 flex-1 lg:[contain:size]' : 'hidden'}
            >
              <EditorialCopy
                key={loaded.id}
                projectId={projectId}
                editorial={editorial}
                caption={caption}
                onCaptionChanged={handleElementChanged}
                onCaptionRefused={() => void request.refresh()}
                onDirtyChange={setCopyDirty}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

/** Shown for a review address whose project identifier is not a server identifier. */
export function ReviewNotFound() {
  return (
    <section aria-labelledby="review-title" className={styles.page}>
      <h1 id="review-title">{reviewCopy.title}</h1>
      <p>{reviewCopy.notFound}</p>
      <p>
        <Link to="/">{reviewCopy.backToList}</Link>
      </p>
    </section>
  );
}

/**
 * Review of the active draft of a project (layout UX-REVIEW-01): a persistent header with the project, the compact
 * indicators and the final approval or downloads; two modes, «Diseño visual» (slides) and «Copy editorial» (the
 * editorial deliverables and the carousel text). It keeps the requirements of the review (R-206, R-208, R-215,
 * R-217, R-240, R-269, R-271, R-272): demonstration banner, numbered carousels
 * with the preview of every slide, the caption, state, blocked facts, flags, QA, acknowledgement, approval,
 * withdrawal and regeneration, and the final approval of each carousel. The draft details and the left-out matches
 * are no longer part of the review, and the exclusions editor was removed (Product Owner, 2026-11-10); the left-out
 * matches stay in «Datos y verificación».
 */
export function ReviewPage() {
  const { projectId } = useParams();
  if (projectId === undefined || !UUID.test(projectId)) {
    return <ReviewNotFound />;
  }
  return <ProjectReview key={projectId} projectId={projectId} />;
}
