import type { Carousel, Element, FinalApproval } from '@edr/contracts';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { Button, ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import { carouselCopy, elementCopy, finalCopy, finalRefusalLabel, slideTypeLabel, versionStateLabel } from './copy';
import { ElementReview } from './ElementReview';
import { elementName, finalApprovalObstacles, hasValidFinalApproval, orderedElements, problemItems } from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';

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
          <p>
            <Link to={featurePaths.history(projectId)}>{finalCopy.goToExports}</Link>
          </p>
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
  onRefresh: () => void;
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
  const slideButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((element) => element.id === selectedSlideId),
  );
  const selectedSlide = slides[selectedIndex];

  const handleChanged = (element: Element) => {
    onElementChanged(element);
    onRefresh();
  };
  const handleApproved = (approval: FinalApproval) => {
    onFinalApproved(approval);
    onRefresh();
  };
  function navigateByKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? index + 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? index - 1
          : -1;
    if (next >= 0 && next < slides.length) {
      event.preventDefault();
      setSelectedSlideId(slides[next]?.id ?? null);
      slideButtons.current[next]?.focus();
    }
  }

  const navigation = (
    <nav aria-label={carouselCopy.slideNavigation} className={styles.slideNavigation}>
      <h3>{carouselCopy.slidesHeading(slides.length)}</h3>
      {slides.length === 0 ? <p className={styles.hint}>{carouselCopy.noSlides}</p> : null}
      <ol className={styles.thumbnailList}>
        {slides.map((element, index) => {
          const version = element.currentVersion;
          const selected = element.id === selectedSlide?.id;
          return (
            <li key={element.id}>
              <button
                ref={(node) => {
                  slideButtons.current[index] = node;
                }}
                type="button"
                aria-current={selected ? 'true' : undefined}
                aria-label={carouselCopy.slideButton(element.position, element.slideType, version.state)}
                className={styles.thumbnailButton}
                data-selected={selected}
                onClick={() => setSelectedSlideId(element.id)}
                onKeyDown={(event) => navigateByKeyboard(event, index)}
              >
                {version.imageUrl === null ? (
                  <span className={styles.thumbnailPlaceholder}>{element.position}</span>
                ) : (
                  <img src={api.slideImageUrl(version.id)} alt="" loading="lazy" />
                )}
                <span className={styles.thumbnailText}>
                  <strong>
                    {String(element.position).padStart(2, '0')} ·{' '}
                    {element.slideType ? slideTypeLabel[element.slideType] : 'Diapositiva'}
                  </strong>
                  <span>{versionStateLabel[version.state]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
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
          onClick={() => setSelectedSlideId(slides[selectedIndex - 1]?.id ?? null)}
        >
          {carouselCopy.previous}
        </Button>
        <span aria-live="polite">{carouselCopy.slidePosition(selectedSlide.position, slides.length)}</span>
        <Button
          variant="quiet"
          size="sm"
          disabled={selectedIndex >= slides.length - 1}
          onClick={() => setSelectedSlideId(slides[selectedIndex + 1]?.id ?? null)}
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
            onApproved={
              selectedIndex < slides.length - 1
                ? () => setSelectedSlideId(slides[selectedIndex + 1]?.id ?? null)
                : undefined
            }
            approveAndNext={selectedIndex < slides.length - 1}
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
    </section>
  );
}
