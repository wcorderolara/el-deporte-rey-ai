import type { Carousel, Element, FinalApproval } from '@edr/contracts';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { Button, buttonClassName, ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import {
  approvalObstacleLabel,
  carouselCopy,
  elementCopy,
  finalCopy,
  finalRefusalLabel,
  slideTypeLabel,
  versionStateLabel,
} from './copy';
import { CarouselDownload } from '../history/CarouselDownload';
import { ElementReview } from './ElementReview';
import {
  approvalObstacles,
  bulkApprovalSummary,
  elementName,
  finalApprovalObstacles,
  hasValidFinalApproval,
  orderedElements,
  problemItems,
} from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { ReviewThumbnailRail } from './ReviewThumbnailRail';

interface FinalApprovalSectionProps {
  projectId: string;
  carousel: Carousel;
  onApproved: (approval: FinalApproval) => void;
  onRefused: () => void;
}

/**
 * Final approval of one carousel (OD-02, PD-09, R-240): the control is enabled only when the server reports the
 * carousel ready and no valid final approval exists; otherwise the elements that prevent it are listed with their
 * reasons. A refusal lists the elements named by the server. A final approval that a later change invalidated is
 * shown as no longer valid (AD-13).
 */
function FinalApprovalSection({ projectId, carousel, onApproved, onRefused }: FinalApprovalSectionProps) {
  const { api } = useReviewDependencies();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const baseId = useId();
  const titleId = `${baseId}-final-title`;
  const reasonsId = `${baseId}-final-reasons`;

  const valid = hasValidFinalApproval(carousel);
  const obstacles = finalApprovalObstacles(carousel);
  const enabled = carousel.readyForFinalApproval && !valid && !sending;
  const names = new Map(carousel.elements.map((element) => [element.id, elementName(element)]));
  const slides = carousel.elements.filter((element) => element.kind === 'slide');
  const approvedCount = slides.filter((element) => element.currentVersion.state === 'approved').length;
  const caption = carousel.elements.find((element) => element.kind === 'caption');

  async function approve() {
    if (!enabled) {
      return;
    }
    setSending(true);
    setError(null);
    setMessage('');
    try {
      const approval = await api.approveCarousel(carousel.id);
      setMessage(finalCopy.recorded);
      onApproved(approval);
    } catch (caught) {
      setError(caught);
      if (caught instanceof ApiError && caught.kind === 'problem') {
        onRefused();
      }
    } finally {
      setSending(false);
    }
  }

  const refusedItems =
    error instanceof ApiError && error.problem?.code === 'FINAL_APPROVAL_REFUSED' ? problemItems(error.problem) : [];

  return (
    <section aria-labelledby={titleId} className={styles.finalPanel}>
      <h3 id={titleId}>{finalCopy.title}</h3>
      {carousel.finalApproval === null ? null : valid ? (
        <div>
          <p>
            <StatusBadge label={finalCopy.approvedAt} tone="positive" symbol="✓" />{' '}
            <time dateTime={carousel.finalApproval.approvedAt}>
              {formatDateTime(carousel.finalApproval.approvedAt)}
            </time>
          </p>
          <p>{finalCopy.valid}</p>
          <div className="flex flex-wrap items-start gap-3">
            <CarouselDownload projectId={projectId} carousel={carousel} onStale={onRefused} />
            <Link
              className={buttonClassName('secondary')}
              to={`${featurePaths.projects}/${encodeURIComponent(projectId)}#project-exports`}
            >
              {finalCopy.goToExports}
            </Link>
          </div>
        </div>
      ) : (
        <p className={styles.note}>
          <span aria-hidden="true">! </span>
          {finalCopy.invalid}
        </p>
      )}
      <p className={styles.finalProgress}>
        <strong>{finalCopy.slideProgress(approvedCount, slides.length)}</strong>
        <span>
          {caption?.currentVersion.state === 'approved' ? finalCopy.captionApproved : finalCopy.captionPending}
        </span>
      </p>
      {valid ? null : (
        <>
          {carousel.readyForFinalApproval ? (
            <p>{finalCopy.ready}</p>
          ) : (
            <div id={reasonsId} className={styles.obstacles}>
              {obstacles.length === 0 ? (
                <p>{finalCopy.notReadyUnknown}</p>
              ) : (
                <>
                  <p>{finalCopy.notReady}</p>
                  <details>
                    <summary>{finalCopy.pendingDetails}</summary>
                    <ul className={styles.detailList}>
                      {obstacles.map((item) => (
                        <li key={item.elementId}>
                          {item.name}: {item.reasons.map((reason) => finalRefusalLabel[reason]).join(', ')}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </div>
          )}
          <p className={styles.hint}>{finalCopy.exportNeedsApproval}</p>
          <Button
            variant="primary"
            size="lg"
            isLoading={sending}
            loadingLabel={finalCopy.approving}
            disabled={!enabled}
            aria-describedby={carousel.readyForFinalApproval ? undefined : reasonsId}
            onClick={() => void approve()}
          >
            {finalCopy.approve}
          </Button>
        </>
      )}
      <p role="status" aria-live="polite" className={styles.status}>
        {message}
      </p>
      {error === null ? null : (
        <div>
          <ErrorBanner title={finalCopy.error} error={error} onRetry={() => void approve()} />
          {refusedItems.length === 0 ? null : (
            <div className={styles.obstacles}>
              <p>{finalCopy.refusedItems}</p>
              <ul className={styles.detailList}>
                {refusedItems.map((item, index) => (
                  <li key={`${item.elementId}-${item.reason}-${index}`}>
                    {names.get(item.elementId) ?? finalCopy.unknownElement}: {finalRefusalLabel[item.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export interface CarouselReviewProps {
  projectId: string;
  carousel: Carousel;
  onElementChanged: (element: Element) => void;
  onFinalApproved: (approval: FinalApproval) => void;
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
 * One numbered carousel of the draft (OD-03): the preview of every slide in carousel order followed by the caption
 * and hashtags (R-215), each element with its review controls, and the final approval of the carousel.
 */
export function CarouselReview({
  projectId,
  carousel,
  onElementChanged,
  onFinalApproved,
  onRefresh,
}: CarouselReviewProps) {
  const { api } = useReviewDependencies();
  const titleId = useId();
  const elements = orderedElements(carousel);
  const slides = elements.filter((element) => element.kind === 'slide');
  const caption = elements.find((element) => element.kind === 'caption');
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const selectedSlideIdRef = useRef<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRunningRef = useRef(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState('');
  const slideButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((element) => element.id === selectedSlideId),
  );
  const selectedSlide = slides[selectedIndex];
  const approvalSummary = bulkApprovalSummary(slides);
  const firstSlideId = slides[0]?.id;

  useEffect(() => {
    if (selectedSlideId === null && firstSlideId !== undefined) {
      selectedSlideIdRef.current = firstSlideId;
      setSelectedSlideId(firstSlideId);
    }
  }, [carousel.id, firstSlideId, selectedSlideId]);

  function selectSlide(id: string | null) {
    selectedSlideIdRef.current = id;
    setSelectedSlideId(id);
  }

  const handleChanged = (element: Element) => {
    onElementChanged(element);
    void onRefresh();
  };
  const handleApproved = (approval: FinalApproval) => {
    onFinalApproved(approval);
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
      selectSlide(slides[next]?.id ?? null);
      slideButtons.current[next]?.focus();
    }
  }

  const navigation = (
    <ReviewThumbnailRail
      label={carouselCopy.slideNavigation}
      heading={carouselCopy.slidesHeading(slides.length)}
      selectedId={selectedSlide?.id}
      items={slides.map((element) => ({
        id: element.id,
        position: element.position,
        imageUrl: element.currentVersion.imageUrl,
        imageSource: element.currentVersion.imageUrl ? api.slideImageUrl(element.currentVersion.id) : null,
        title: element.slideType ? slideTypeLabel[element.slideType] : 'Diapositiva',
        subtitle: versionStateLabel[element.currentVersion.state],
        ariaLabel: carouselCopy.slideButton(element.position, element.slideType, element.currentVersion.state),
      }))}
      onSelect={selectSlide}
      onItemKeyDown={navigateByKeyboard}
      setButtonRef={(node, index) => {
        slideButtons.current[index] = node;
      }}
    />
  );

  const selectedControls =
    selectedSlide === undefined ? null : (
      <div
        className={styles.slideControls}
        role="group"
        aria-label={carouselCopy.slidePosition(selectedSlide.position, slides.length)}
      >
        <Button
          variant="quiet"
          size="sm"
          disabled={selectedIndex === 0}
          onClick={() => selectSlide(slides[selectedIndex - 1]?.id ?? null)}
        >
          {carouselCopy.previous}
        </Button>
        <span aria-live="polite">{carouselCopy.slidePosition(selectedSlide.position, slides.length)}</span>
        <Button
          variant="quiet"
          size="sm"
          disabled={selectedIndex >= slides.length - 1}
          onClick={() => selectSlide(slides[selectedIndex + 1]?.id ?? null)}
        >
          {carouselCopy.next}
        </Button>
      </div>
    );

  return (
    <section aria-labelledby={titleId} className={styles.carousel}>
      <h2 id={titleId} className={styles.visuallyHidden}>
        {carouselCopy.title(carousel.sequence, carousel.total)}
      </h2>
      <div className={styles.approvalToolbar}>
        <p className={styles.approvalSummary}>
          {carouselCopy.approvalSummary(
            approvalSummary.approved,
            approvalSummary.total,
            approvalSummary.pendingCount,
            approvalSummary.warning.length + approvalSummary.blocked.length + approvalSummary.pending.length,
          )}{' '}
          {caption?.currentVersion.state === 'approved' ? finalCopy.captionApproved : finalCopy.captionPending}
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={bulkRunning}
          onClick={() => {
            setBulkResult(null);
            setBulkOpen(true);
          }}
        >
          {carouselCopy.approveAll}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={styles.workflowStatus}>
        {workflowMessage}
      </p>
      <div className={styles.workspace}>
        {selectedSlide === undefined ? (
          <div className={styles.emptyWorkspace}>{carouselCopy.noSlides}</div>
        ) : (
          <ElementReview
            element={selectedSlide}
            onChanged={handleChanged}
            onRefused={onRefresh}
            workspaceNavigation={navigation}
            workspaceControls={selectedControls}
            onApproved={(approvedElement) => {
              if (selectedSlideIdRef.current !== approvedElement.id) return;
              const currentSlides = slides.map((slide) => (slide.id === approvedElement.id ? approvedElement : slide));
              const currentIndex = currentSlides.findIndex((slide) => slide.id === approvedElement.id);
              const nextPending = [
                ...currentSlides.slice(currentIndex + 1),
                ...currentSlides.slice(0, currentIndex),
              ].find((slide) => slide.currentVersion.state !== 'approved');
              if (nextPending) selectSlide(nextPending.id);
              else setWorkflowMessage(carouselCopy.noNextPending);
            }}
            approveAndNext
          />
        )}
      </div>
      {caption ? (
        <section aria-labelledby={`${titleId}-caption`} className={styles.captionSection}>
          <div className={styles.captionHeading}>
            <div>
              <p className={styles.eyebrow}>{carouselCopy.captionEyebrow}</p>
              <h3 id={`${titleId}-caption`}>{elementCopy.caption}</h3>
            </div>
            <StatusBadge
              label={caption.currentVersion.state === 'approved' ? finalCopy.captionApproved : finalCopy.captionPending}
              tone={caption.currentVersion.state === 'approved' ? 'positive' : 'neutral'}
              symbol={caption.currentVersion.state === 'approved' ? '✓' : '•'}
            />
          </div>
          <ElementReview key={caption.id} element={caption} onChanged={handleChanged} onRefused={onRefresh} />
        </section>
      ) : null}
      <FinalApprovalSection
        projectId={projectId}
        carousel={carousel}
        onApproved={handleApproved}
        onRefused={onRefresh}
      />
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
