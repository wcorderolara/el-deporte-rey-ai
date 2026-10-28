import type { Carousel, Element, FinalApproval } from '@edr/contracts';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import { carouselCopy, finalCopy, finalRefusalLabel } from './copy';
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
                  <ul className={styles.detailList}>
                    {obstacles.map((item) => (
                      <li key={item.elementId}>
                        {item.name}: {item.reasons.map((reason) => finalRefusalLabel[reason]).join(', ')}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <p className={styles.hint}>{finalCopy.exportNeedsApproval}</p>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!enabled}
            aria-describedby={carousel.readyForFinalApproval ? undefined : reasonsId}
            onClick={() => void approve()}
          >
            {sending ? finalCopy.approving : finalCopy.approve}
          </button>
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
  const titleId = useId();
  const elements = orderedElements(carousel);
  const handleChanged = (element: Element) => {
    onElementChanged(element);
    onRefresh();
  };
  const handleApproved = (approval: FinalApproval) => {
    onFinalApproved(approval);
    onRefresh();
  };
  return (
    <section aria-labelledby={titleId} className={styles.carousel}>
      <h2 id={titleId}>{carouselCopy.title(carousel.sequence, carousel.total)}</h2>
      <h3>{carouselCopy.previewTitle}</h3>
      <p className={styles.hint}>{carouselCopy.previewIntro}</p>
      {elements.length === 0 ? (
        <p>{carouselCopy.noElements}</p>
      ) : (
        <ol className={styles.elementList}>
          {elements.map((element) => (
            <li key={element.id}>
              <ElementReview element={element} onChanged={handleChanged} onRefused={onRefresh} />
            </li>
          ))}
        </ol>
      )}
      <FinalApprovalSection
        projectId={projectId}
        carousel={carousel}
        onApproved={handleApproved}
        onRefused={onRefresh}
      />
    </section>
  );
}
