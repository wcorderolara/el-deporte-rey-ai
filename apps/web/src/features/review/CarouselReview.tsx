import type { Carousel, Element } from '@edr/contracts';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Button, ErrorBanner, Icon, IconButton } from '../../ui';
import { approvalObstacleLabel, carouselCopy, slideTypeLabel, workspaceCopy } from './copy';
import { ElementReview } from './ElementReview';
import {
  approvalObstacles,
  bulkApprovalSummary,
  elementName,
  elementStatus,
  nextPendingSlide,
  orderedElements,
} from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { ReviewThumbnailRail } from './ReviewThumbnailRail';

export interface CarouselReviewProps {
  carousel: Carousel;
  /** The selected slide, kept by the page so that it survives a change of mode (Diseño / Copy editorial). */
  selectedSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onElementChanged: (element: Element) => void;
  onRefresh: () => Promise<boolean>;
}

interface BulkFailure {
  element: Element;
  error: unknown;
}
interface BulkResult {
  approved: number;
  failures: BulkFailure[];
  refreshed: boolean;
}

function BulkApprovalDialog({
  slides,
  running,
  result,
  onCancel,
  onConfirm,
  onRetry,
}: {
  slides: Element[];
  running: boolean;
  result: BulkResult | null;
  onCancel: () => void;
  onConfirm: (eligible: Element[]) => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const summary = bulkApprovalSummary(slides);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (running) dialogRef.current?.focus();
    else if (result !== null) cancelRef.current?.focus();
  }, [result, running]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !running) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
    const first = controls[0];
    const last = controls.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={styles.dialogBackdrop}>
      <div
        ref={dialogRef}
        className={styles.bulkDialog}
        role="dialog"
        aria-modal="true"
        aria-label={carouselCopy.bulkDialogLabel}
        aria-describedby="bulk-approval-summary"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h3 id="bulk-approval-title">
          {result
            ? carouselCopy.bulkResult(result.approved, result.failures.length, result.refreshed)
            : carouselCopy.approveAllTitle}
        </h3>
        {result === null ? (
          <>
            <ul id="bulk-approval-summary" className={styles.bulkCounts}>
              <li>{summary.total} diapositivas</li>
              <li>
                {summary.eligible.length} {carouselCopy.eligible}
              </li>
              <li>
                {summary.approved} {carouselCopy.alreadyApproved}
              </li>
              <li>{summary.warning.length} con advertencias sin confirmar</li>
              <li>{summary.blocked.length} bloqueadas</li>
              <li>{summary.pending.length} pendientes de control visual</li>
            </ul>
            <p>{workspaceCopy.bulkCopyNote}</p>
            {summary.warning.length > 0 ? (
              <section className={styles.bulkAttention}>
                <h4>{carouselCopy.warningSlides}</h4>
                <ul>
                  {summary.warning.map((item) => (
                    <li key={item.id}>{elementName(item)}</li>
                  ))}
                </ul>
                <p>Confirme cada advertencia desde los detalles de la diapositiva. No se confirmará automáticamente.</p>
              </section>
            ) : null}
            {summary.blocked.length > 0 ? (
              <section className={styles.bulkAttention}>
                <h4>{carouselCopy.blockedSlides}</h4>
                <ul>
                  {summary.blocked.map((item) => (
                    <li key={item.id}>
                      {elementName(item)}:{' '}
                      {approvalObstacles(item.currentVersion)
                        .map((obstacle) => approvalObstacleLabel[obstacle])
                        .join(', ')}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {summary.pending.length > 0 ? (
              <section className={styles.bulkAttention}>
                <h4>Pendientes del control visual</h4>
                <ul>
                  {summary.pending.map((item) => (
                    <li key={item.id}>{elementName(item)}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {summary.eligible.length === 0 ? (
              <p>
                {summary.total > 0 && summary.approved === summary.total
                  ? carouselCopy.allSlidesApproved
                  : carouselCopy.noEligible}
              </p>
            ) : null}
          </>
        ) : (
          <div id="bulk-approval-summary" aria-live="polite">
            {result.failures.length === 0 && result.refreshed ? (
              <p>{carouselCopy.allSlidesApproved}</p>
            ) : (
              <>
                <p>
                  Las aprobaciones completadas se conservaron.{' '}
                  {result.refreshed
                    ? 'Actualizamos el estado del carrusel.'
                    : 'No se pudo actualizar el borrador; actualice la vista antes de continuar.'}
                </p>
                <ul className={styles.bulkFailures}>
                  {result.failures.map(({ element, error }) => (
                    <li key={element.id}>
                      {carouselCopy.bulkFailure(element.position)}
                      <details>
                        <summary>Ver detalle</summary>
                        <ErrorBanner title={elementName(element)} error={error} />
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className={styles.dialogActions}>
          {result === null ? (
            <>
              <button
                ref={cancelRef}
                className={styles.dialogSecondary}
                type="button"
                onClick={onCancel}
                disabled={running}
              >
                {carouselCopy.cancel}
              </button>
              <button
                className={styles.dialogPrimary}
                type="button"
                onClick={() => onConfirm(summary.eligible)}
                disabled={running || summary.eligible.length === 0}
              >
                {running ? carouselCopy.bulkRunning : carouselCopy.confirmBulk(summary.eligible.length)}
              </button>
            </>
          ) : (
            <>
              {result.failures.length > 0 || !result.refreshed ? (
                <button className={styles.dialogSecondary} type="button" onClick={onRetry} disabled={running}>
                  {result.failures.length > 0 ? carouselCopy.retryRemaining : carouselCopy.refreshState}
                </button>
              ) : null}
              <button
                ref={cancelRef}
                className={styles.dialogPrimary}
                type="button"
                onClick={onCancel}
                disabled={running}
              >
                {carouselCopy.dismiss}
              </button>
            </>
          )}
        </div>
        <span className={styles.visuallyHidden} role="status" aria-live="polite">
          {running ? carouselCopy.bulkRunning : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * The design review of one numbered carousel (OD-03; layout UX-REVIEW-01): the slide list with each slide's state
 * and issues, the selected slide as the protagonist, and its review inspector, in three columns that scroll on their
 * own. Approving a slide moves to the next pending one. The bulk approval approves only the eligible slides, one
 * request each, never the caption or the editorial copy. The caption is reviewed in «Copy editorial» and the final
 * approval of the carousel is a header action of the page.
 */
export function CarouselReview({
  carousel,
  selectedSlideId,
  onSelectSlide,
  onElementChanged,
  onRefresh,
}: CarouselReviewProps) {
  const { api } = useReviewDependencies();
  const titleId = useId();
  const slides = orderedElements(carousel).filter((element) => element.kind === 'slide');
  const selectedIndex = Math.max(
    0,
    slides.findIndex((element) => element.id === selectedSlideId),
  );
  const selectedSlide = slides[selectedIndex];
  const selectedSlideIdRef = useRef<string | null>(selectedSlide?.id ?? null);
  selectedSlideIdRef.current = selectedSlide?.id ?? null;
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRunningRef = useRef(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const slideButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const approvalSummary = bulkApprovalSummary(slides);
  const held = approvalSummary.warning.length + approvalSummary.blocked.length + approvalSummary.pending.length;

  function selectSlide(id: string | null | undefined) {
    if (id === null || id === undefined) return;
    selectedSlideIdRef.current = id;
    onSelectSlide(id);
  }

  const handleChanged = (element: Element) => {
    onElementChanged(element);
    void onRefresh();
  };
  async function approveEligible(eligible: Element[]) {
    if (bulkRunningRef.current || eligible.length === 0) return;
    bulkRunningRef.current = true;
    setBulkRunning(true);
    setBulkResult(null);
    setWorkflowMessage('');
    let approved = 0;
    const failures: BulkFailure[] = [];
    try {
      for (const slide of eligible) {
        try {
          const result = await api.approveElement(carousel.id, slide.id, slide.currentVersion.id);
          onElementChanged(result);
          approved += 1;
        } catch (error) {
          failures.push({ element: slide, error });
        }
      }
      const refreshed = await onRefresh();
      setBulkResult({ approved, failures, refreshed });
    } finally {
      bulkRunningRef.current = false;
      setBulkRunning(false);
    }
  }
  async function retryRemaining() {
    if (bulkRunningRef.current) return;
    bulkRunningRef.current = true;
    setBulkRunning(true);
    try {
      const refreshed = await onRefresh();
      if (refreshed) setBulkResult(null);
    } finally {
      bulkRunningRef.current = false;
      setBulkRunning(false);
    }
  }
  function navigateByKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? index + 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? index - 1
          : -1;
    if (next >= 0 && next < slides.length) {
      event.preventDefault();
      selectSlide(slides[next]?.id);
      slideButtons.current[next]?.focus();
    }
  }
  function openBulk() {
    setBulkResult(null);
    setBulkOpen(true);
  }

  const bulk =
    approvalSummary.total === 0 || approvalSummary.approved === approvalSummary.total ? null : (
      <div className="mb-2 grid gap-1.5 rounded-control border border-border-subtle bg-surface-card p-2 text-caption text-text-secondary">
        <p className="m-0 font-bold tracking-label text-text-primary uppercase">{workspaceCopy.bulkTitle}</p>
        <p className="m-0">
          {approvalSummary.eligible.length > 0
            ? workspaceCopy.bulkEligible(approvalSummary.eligible.length)
            : workspaceCopy.bulkNone}
        </p>
        {held === 0 ? null : <p className="m-0">{workspaceCopy.bulkHeld(held)}</p>}
        <Button variant="secondary" size="sm" className="w-full" disabled={bulkRunning} onClick={openBulk}>
          {approvalSummary.eligible.length > 0
            ? workspaceCopy.approveAllCount(approvalSummary.eligible.length)
            : carouselCopy.bulkReasons}
        </Button>
      </div>
    );

  const navigation = (
    <ReviewThumbnailRail
      label={carouselCopy.slideNavigation}
      heading={carouselCopy.slidesHeading(slides.length)}
      selectedId={selectedSlide?.id}
      fill
      compact={railCollapsed}
      intro={bulk}
      headerAction={
        <IconButton
          label={railCollapsed ? workspaceCopy.railExpand : workspaceCopy.railCollapse}
          aria-expanded={!railCollapsed}
          className="size-9"
          onClick={() => setRailCollapsed((value) => !value)}
        >
          <Icon name={railCollapsed ? 'chevron-right' : 'chevron-left'} size={18} />
        </IconButton>
      }
      items={slides.map((element) => {
        const status = elementStatus(element);
        return {
          id: element.id,
          position: element.position,
          imageUrl: element.currentVersion.imageUrl,
          imageSource: element.currentVersion.imageUrl ? api.slideImageUrl(element.currentVersion.id) : null,
          title: element.slideType ? slideTypeLabel[element.slideType] : 'Diapositiva',
          status: { label: status.label, tone: status.tone, symbol: status.symbol },
          ariaLabel: carouselCopy.slideButton(element.position, element.slideType, element.currentVersion.state),
        };
      })}
      onSelect={selectSlide}
      onItemKeyDown={navigateByKeyboard}
      setButtonRef={(node, index) => {
        slideButtons.current[index] = node;
      }}
    />
  );

  const next = selectedSlide === undefined ? undefined : nextPendingSlide(slides, selectedSlide.id);

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 min-w-0 flex-col gap-2 lg:h-full">
      <h2 id={titleId} className={styles.visuallyHidden}>
        {carouselCopy.title(carousel.sequence, carousel.total)}
      </h2>
      <p role="status" aria-live="polite" className={styles.visuallyHidden}>
        {workflowMessage}
      </p>
      {selectedSlide === undefined ? (
        <div className="grid min-h-60 place-items-center rounded-panel border border-dashed border-border-strong p-6 text-text-secondary">
          {carouselCopy.noSlides}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ElementReview
            element={selectedSlide}
            onChanged={handleChanged}
            onRefused={() => void onRefresh()}
            workspaceNavigation={navigation}
            navigationCollapsed={railCollapsed}
            pager={{
              position: selectedSlide.position,
              total: slides.length,
              ...(selectedIndex > 0 ? { onPrevious: () => selectSlide(slides[selectedIndex - 1]?.id) } : {}),
              ...(selectedIndex < slides.length - 1
                ? { onNext: () => selectSlide(slides[selectedIndex + 1]?.id) }
                : {}),
            }}
            nextPending={next === undefined ? null : { name: elementName(next), onSelect: () => selectSlide(next.id) }}
            onApproved={(approvedElement) => {
              if (selectedSlideIdRef.current !== approvedElement.id) return;
              const currentSlides = slides.map((slide) => (slide.id === approvedElement.id ? approvedElement : slide));
              const nextPending = nextPendingSlide(currentSlides, approvedElement.id);
              if (nextPending) {
                selectSlide(nextPending.id);
                setWorkflowMessage(carouselCopy.movedToNext(elementName(approvedElement), elementName(nextPending)));
              } else setWorkflowMessage(carouselCopy.noNextPending);
            }}
          />
        </div>
      )}
      {bulkOpen ? (
        <BulkApprovalDialog
          slides={slides}
          running={bulkRunning}
          result={bulkResult}
          onCancel={() => {
            if (!bulkRunning) setBulkOpen(false);
          }}
          onConfirm={(eligible) => void approveEligible(eligible)}
          onRetry={() => void retryRemaining()}
        />
      ) : null}
    </section>
  );
}
