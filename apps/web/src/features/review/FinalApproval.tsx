import type { Carousel, EditorialPackage, FinalApproval } from '@edr/contracts';
import { useId, useState, type ReactNode } from 'react';

import { ApiError } from '../../api/client';
import { Alert, Button, ErrorBanner, Icon, Modal, ModalFooter } from '../../ui';
import { finalCopy, finalDialogCopy, finalRefusalLabel } from './copy';
import {
  currentEditorialVersions,
  editorialExportSummary,
  elementName,
  finalApprovalObstacles,
  hasValidFinalApproval,
  problemItems,
} from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';

export interface FinalApprovalActionProps {
  carousel: Carousel;
  /** The editorial package, only to report its state in the confirmation (it is not part of the carousel). */
  editorial: EditorialPackage | null;
  onApproved: (approval: FinalApproval) => void;
  /** Called after a refused confirmation, so the view shows the server's current state. */
  onRefused: () => void;
  /** The review menu, shown next to the action. */
  menu?: ReactNode;
}

/**
 * «Aprobar carrusel completo» (R-240, OD-02, PD-09; UX-REVIEW-01): a header action, enabled only when the server
 * reports the carousel ready and no valid final approval exists; otherwise the slides that prevent it are listed with
 * their reasons. It opens a confirmation dialog; nothing is approved before the server answers. A final approval
 * that a later change invalidated is shown as no longer valid (AD-13). The caption and the editorial copy are not
 * required (PD-ARCH-01E-PD-02; PD-33 option A, independent approvals): the dialog only says what their state means for
 * the download, the editorial copy by the server's `exportable` state (REVIEW-APPROVAL-01).
 */
export function FinalApprovalAction({ carousel, editorial, onApproved, onRefused, menu }: FinalApprovalActionProps) {
  const [open, setOpen] = useState(false);
  const reasonsId = useId();
  const obstacles = finalApprovalObstacles(carousel);
  const ready = carousel.readyForFinalApproval;

  if (hasValidFinalApproval(carousel)) {
    return null;
  }
  return (
    <div className="grid justify-items-stretch gap-1 lg:justify-items-end">
      {carousel.finalApproval === null ? null : (
        <p className="m-0 max-w-md text-caption text-warning lg:text-right" role="note">
          <span aria-hidden="true">! </span>
          {finalCopy.invalid}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        <Button
          variant="primary"
          size="lg"
          disabled={!ready}
          aria-describedby={ready ? undefined : reasonsId}
          leadingIcon={<Icon name={ready ? 'check' : 'lock'} size={18} />}
          onClick={() => setOpen(true)}
        >
          {finalCopy.approve}
        </Button>
        {menu}
      </div>
      {ready ? (
        <p className="m-0 text-caption text-text-secondary lg:text-right">{finalCopy.ready}</p>
      ) : (
        <div id={reasonsId} className="relative grid justify-items-stretch gap-0.5 text-caption lg:justify-items-end">
          {obstacles.length === 0 ? (
            <p className="m-0 max-w-sm text-text-secondary lg:text-right">{finalCopy.notReadyUnknown}</p>
          ) : (
            <>
              <p className="m-0 text-text-secondary lg:text-right">
                {finalDialogCopy.notReadyReason(obstacles.length)} {finalCopy.exportNeedsApproval}
              </p>
              <details className="group">
                <summary className="cursor-pointer font-bold text-text-link lg:text-right">
                  {finalCopy.pendingDetails}
                </summary>
                <ul className="absolute right-0 z-20 m-0 mt-1 grid w-80 max-w-[90vw] list-none gap-1 rounded-card border border-border-subtle bg-surface-overlay p-3 text-left text-body-sm text-text-primary shadow-overlay">
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
      {open ? (
        <FinalApprovalDialog
          carousel={carousel}
          editorial={editorial}
          onClose={() => setOpen(false)}
          onApproved={(approval) => {
            setOpen(false);
            onApproved(approval);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </div>
  );
}

function FinalApprovalDialog({
  carousel,
  editorial,
  onClose,
  onApproved,
  onRefused,
}: {
  carousel: Carousel;
  editorial: EditorialPackage | null;
  onClose: () => void;
  onApproved: (approval: FinalApproval) => void;
  onRefused: () => void;
}) {
  const { api } = useReviewDependencies();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const slides = carousel.elements.filter((element) => element.kind === 'slide');
  const approvedSlides = slides.filter((element) => element.currentVersion.state === 'approved').length;
  const caption = carousel.elements.find((element) => element.kind === 'caption');
  const versions = currentEditorialVersions(editorial);
  const copy = editorial === null ? null : editorialExportSummary(editorial);
  const obstacles = finalApprovalObstacles(carousel);
  // The view follows the refreshed draft: a concurrent change that makes the carousel not ready disables the
  // confirmation (the server would refuse it anyway).
  const ready = carousel.readyForFinalApproval && !hasValidFinalApproval(carousel);
  const names = new Map(carousel.elements.map((element) => [element.id, elementName(element)]));

  async function confirm() {
    if (sending || !ready) return;
    setSending(true);
    setError(null);
    try {
      const approval = await api.approveCarousel(carousel.id);
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
    <Modal
      title={finalDialogCopy.title}
      closeDisabled={sending}
      onClose={() => {
        if (!sending) onClose();
      }}
    >
      <div className="grid gap-4 font-sans text-body-md text-text-primary">
        <p className="m-0 text-text-secondary">{finalDialogCopy.intro}</p>
        <dl className="m-0 grid gap-3 rounded-card border border-border-subtle bg-surface-card p-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-6">
          <dt className="text-body-sm font-bold text-text-secondary">{finalDialogCopy.slides}</dt>
          <dd className="m-0 font-bold">{finalDialogCopy.slidesValue(approvedSlides, slides.length)}</dd>
          <dt className="text-body-sm font-bold text-text-secondary">{finalDialogCopy.caption}</dt>
          <dd className="m-0">
            {caption === undefined
              ? finalDialogCopy.captionMissing
              : caption.currentVersion.state === 'approved'
                ? finalDialogCopy.captionApproved
                : finalDialogCopy.captionPending}
          </dd>
          <dt className="text-body-sm font-bold text-text-secondary">{finalDialogCopy.editorial}</dt>
          <dd className="m-0">
            {editorial === null || copy === null
              ? finalDialogCopy.editorialUnknown
              : versions.length === 0
                ? finalDialogCopy.editorialNone
                : finalDialogCopy.editorialValue(copy.exportable, copy.total, copy.needsReview)}
          </dd>
          <dt className="text-body-sm font-bold text-text-secondary">{finalDialogCopy.blocking}</dt>
          <dd className="m-0">
            {obstacles.length === 0 ? (
              finalDialogCopy.blockingNone
            ) : (
              <ul className="m-0 grid list-none gap-1 p-0">
                {obstacles.map((item) => (
                  <li key={item.elementId}>
                    {item.name}: {item.reasons.map((reason) => finalRefusalLabel[reason]).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
        {ready || error !== null ? null : (
          <Alert tone="warning" role="status">
            {finalDialogCopy.notReadyAnymore}
          </Alert>
        )}
        {error === null ? null : (
          <div className="grid gap-2">
            <ErrorBanner title={finalCopy.error} error={error} {...(ready ? { onRetry: () => void confirm() } : {})} />
            {refusedItems.length === 0 ? null : (
              <div className="text-body-sm">
                <p className="m-0">{finalCopy.refusedItems}</p>
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
        <span className={styles.visuallyHidden} role="status" aria-live="polite">
          {sending ? finalCopy.approving : ''}
        </span>
        <ModalFooter onCancel={onClose} cancelDisabled={sending}>
          <Button
            variant="primary"
            isLoading={sending}
            loadingLabel={finalCopy.approving}
            disabled={!ready}
            onClick={() => void confirm()}
          >
            {finalDialogCopy.confirm}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
