import type { Element, QaWarningCheck } from '@edr/contracts';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { ApiError } from '../../api/client';
import { Button, ErrorBanner, StatusBadge } from '../../ui';
import { BlockingFacts } from './BlockingFacts';
import { approvalObstacleLabel, contentFlagLabel, elementCopy, textFieldLabel, versionStateLabel } from './copy';
import { approvalObstacles, elementName, isBlockingFailure, needsAcknowledgement, problemFacts } from './model';
import { QaResults } from './QaResults';
import { ReviewWorkspace } from './ReviewWorkspace';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';

type Action =
  | { kind: 'approve'; advance: boolean }
  | { kind: 'withdraw' | 'regenerate' }
  | { kind: 'acknowledge'; check: QaWarningCheck };

const errorTitle: Record<Action['kind'], string> = {
  approve: elementCopy.approveError,
  withdraw: elementCopy.withdrawError,
  regenerate: elementCopy.regenerateError,
  acknowledge: elementCopy.acknowledgeError,
};

export interface ElementReviewProps {
  element: Element;
  /** Called with the element returned by a successful operation. */
  onChanged: (element: Element) => void;
  /** Called after a refused operation, so the view shows the server's current state. */
  onRefused: () => void;
  workspaceNavigation?: ReactNode;
  workspaceControls?: ReactNode;
  onApproved?: (element: Element) => void;
  approveAndNext?: boolean;
}

/**
 * One slide or the caption of a carousel (R-215, R-217, R-206, R-208, OD-09): image of the current version, text
 * with provenance labels, review state, blocked facts with their block reasons, content flags, QA results with the
 * acknowledgement of warnings, and the approve, withdraw and regenerate actions. Approval sends the exact version
 * shown (R-406). What prevents the approval (blocking facts, content flags, warnings to acknowledge) is shown next to
 * the actions; there is no technical details section (PD-ARCH-01E-B review). The server's answer is always shown; a refusal is announced with the facts it names.
 */
export function ElementReview({
  element,
  onChanged,
  onRefused,
  workspaceNavigation,
  workspaceControls,
  onApproved,
  approveAndNext = false,
}: ElementReviewProps) {
  const { api } = useReviewDependencies();
  const [action, setAction] = useState<Action | null>(null);
  const [failure, setFailure] = useState<{ action: Action; error: unknown } | null>(null);
  const [message, setMessage] = useState('');
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const obstaclesId = `${baseId}-obstacles`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRegeneration = useRef(false);
  const previousVersionId = useRef(element.currentVersion.id);

  const version = element.currentVersion;
  const name = elementName(element);
  const obstacles = approvalObstacles(version);
  const warningCount = version.qa.filter((result) => result.severity === 'warning' && result.outcome === 'fail').length;
  // Only the QA checks that need the operator: warnings to acknowledge and blocking failures to regenerate.
  const qaToReview = version.qa.filter((result) => needsAcknowledgement(result) || isBlockingFailure(result));
  const approved = version.state === 'approved';
  const busy = action !== null;

  useEffect(() => {
    if (previousVersionId.current !== version.id) {
      previousVersionId.current = version.id;
      if (focusAfterRegeneration.current) {
        focusAfterRegeneration.current = false;
        headingRef.current?.focus();
      }
    }
  }, [version.id]);

  useEffect(() => {
    focusAfterRegeneration.current = false;
    setAction(null);
    setFailure(null);
    setMessage('');
  }, [element.id]);

  async function run(next: Action) {
    if (busy) {
      return;
    }
    setAction(next);
    setFailure(null);
    setMessage('');
    let approved = false;
    try {
      let result: Element;
      switch (next.kind) {
        case 'approve':
          result = await api.approveElement(element.carouselId, element.id, version.id);
          setMessage(elementCopy.approved(result.currentVersion.versionNumber));
          approved = true;
          break;
        case 'withdraw':
          result = await api.withdrawElementApproval(element.carouselId, element.id);
          setMessage(elementCopy.withdrawn);
          break;
        case 'regenerate':
          focusAfterRegeneration.current = true;
          result = await api.regenerateElement(element.carouselId, element.id);
          setMessage(elementCopy.regenerated(result.currentVersion.versionNumber));
          break;
        case 'acknowledge':
          result = await api.acknowledgeQaWarning(element.carouselId, element.id, version.id, next.check);
          setMessage(elementCopy.acknowledged);
          break;
      }
      onChanged(result);
      if (approved && next.kind === 'approve' && next.advance) onApproved?.(result);
    } catch (error) {
      setFailure({ action: next, error });
      if (error instanceof ApiError && error.kind === 'problem') {
        onRefused();
      }
    } finally {
      setAction(null);
    }
  }

  const refusedFacts =
    failure !== null && failure.error instanceof ApiError && failure.error.problem?.code === 'APPROVAL_BLOCKED'
      ? problemFacts(failure.error.problem)
      : [];

  const approvalLabel = element.kind === 'caption' ? elementCopy.approveCaption : elementCopy.approveSlide;

  return (
    <ReviewWorkspace
      navigation={workspaceNavigation}
      labelledBy={titleId}
      state={version.state}
      blocked={version.blocked}
      caption={element.kind === 'caption'}
    >
      <section className={styles.elementPreview} aria-label={name}>
        <header className={styles.elementHeader}>
          <div>
            <p className={styles.elementEyebrow}>
              {element.kind === 'slide' ? elementCopy.slideEyebrow : elementCopy.captionEyebrow}
            </p>
            <h3 id={titleId} ref={headingRef} tabIndex={-1}>
              {name}
            </h3>
          </div>
        </header>

        {element.kind === 'slide' ? (
          version.imageUrl === null ? (
            <div className={styles.imageUnavailable} role="status">
              {elementCopy.noImage}
            </div>
          ) : (
            <figure className={styles.figure}>
              <img
                className={styles.slideImage}
                src={api.slideImageUrl(version.id)}
                alt={elementCopy.imageAlt(name, version.versionNumber)}
                width={version.width ?? undefined}
                height={version.height ?? undefined}
                loading="eager"
              />
              {version.width === null || version.height === null ? null : (
                <figcaption className={styles.hint}>{elementCopy.dimensions(version.width, version.height)}</figcaption>
              )}
            </figure>
          )
        ) : (
          <div className={styles.captionCopy} aria-label={elementCopy.captionReadable}>
            {version.fields.length === 0 ? (
              <p>{elementCopy.noText}</p>
            ) : (
              <dl>
                {version.fields.map((field, index) => (
                  <div key={`${field.field}-${index}`}>
                    <dt>{textFieldLabel[field.field]}</dt>
                    <dd>{field.segments.map((segment) => segment.text).join('')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        {workspaceControls ? <div className={styles.workspaceControls}>{workspaceControls}</div> : null}
      </section>

      <section className={styles.reviewPanel} aria-label={`${elementCopy.reviewPanel}: ${name}`}>
        <div className={styles.reviewStatus}>
          <StatusBadge
            label={versionStateLabel[version.state]}
            tone={approved ? 'positive' : version.state === 'qa_failed' ? 'caution' : 'neutral'}
            symbol={approved ? '✓' : version.state === 'qa_failed' ? '!' : '•'}
          />
          {version.blocked ? <StatusBadge label={elementCopy.blocked} tone="caution" symbol="⛔" /> : null}
        </div>
        <div className={obstacles.length > 0 ? styles.obstacles : styles.readiness} aria-live="polite">
          <strong>
            {approved
              ? elementCopy.approvedStatus
              : obstacles.length > 0
                ? elementCopy.needsAttention
                : elementCopy.noIssues}
          </strong>
          {obstacles.length > 0 ? (
            <ul className={styles.detailList} id={obstaclesId}>
              {obstacles.map((obstacle) => (
                <li key={obstacle}>{approvalObstacleLabel[obstacle]}</li>
              ))}
            </ul>
          ) : null}
          {warningCount > 0 ? (
            <p className={styles.warningSummary}>{elementCopy.warningSummary(warningCount)}</p>
          ) : null}
        </div>
        {version.blockingFacts.length === 0 ? null : (
          <section className={styles.blockedPanel} aria-label={`${elementCopy.blockedTitle}: ${name}`}>
            <p className={styles.panelTitle}>{elementCopy.blockedTitle}</p>
            <p>{elementCopy.blockedIntro}</p>
            <BlockingFacts facts={version.blockingFacts} label={elementCopy.blockedTitle} />
          </section>
        )}
        {approved || version.contentFlags.length === 0 ? null : (
          <section className={styles.flagPanel} aria-label={`${elementCopy.flagsTitle}: ${name}`}>
            <p className={styles.panelTitle}>{elementCopy.flagsTitle}</p>
            <ul className={styles.detailList}>
              {version.contentFlags.map((flag, index) => (
                <li key={`${flag.code}-${index}`}>
                  <strong>{contentFlagLabel[flag.code]}</strong>. {elementCopy.flagField}: {flag.field}.{' '}
                  {elementCopy.flagExcerpt}: «{flag.excerpt}»
                </li>
              ))}
            </ul>
          </section>
        )}
        {approved || qaToReview.length === 0 ? null : (
          <section aria-label={`${elementCopy.qaTitle}: ${name}`}>
            <p className={styles.panelTitle}>{elementCopy.qaTitle}</p>
            <p className={styles.hint}>{elementCopy.qaIntro}</p>
            <QaResults
              results={qaToReview}
              onAcknowledge={busy ? null : (check) => void run({ kind: 'acknowledge', check })}
              acknowledging={action?.kind === 'acknowledge' ? action.check : null}
            />
          </section>
        )}
        <div className={styles.actions} role="group" aria-label={`${elementCopy.actionsTitle}: ${name}`}>
          {approved ? (
            <Button
              variant="secondary"
              isLoading={action?.kind === 'withdraw'}
              loadingLabel={elementCopy.withdrawing}
              disabled={busy}
              onClick={() => void run({ kind: 'withdraw' })}
            >
              {elementCopy.withdraw}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                isLoading={action?.kind === 'approve' && !action.advance}
                loadingLabel={elementCopy.approving}
                disabled={busy || obstacles.length > 0}
                aria-describedby={obstacles.length > 0 ? obstaclesId : undefined}
                onClick={() => void run({ kind: 'approve', advance: false })}
              >
                {approvalLabel}
              </Button>
              {element.kind === 'slide' && approveAndNext ? (
                <Button
                  variant="primary"
                  size="lg"
                  isLoading={action?.kind === 'approve' && action.advance}
                  loadingLabel={elementCopy.approving}
                  disabled={busy || obstacles.length > 0}
                  aria-describedby={obstacles.length > 0 ? obstaclesId : undefined}
                  onClick={() => void run({ kind: 'approve', advance: true })}
                >
                  {elementCopy.approveAndNext}
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant="secondary"
            isLoading={action?.kind === 'regenerate'}
            loadingLabel={elementCopy.regenerating}
            disabled={busy || version.state === 'superseded'}
            onClick={() => void run({ kind: 'regenerate' })}
          >
            {elementCopy.regenerateLabel(element.kind)}
          </Button>
        </div>
        {failure === null ? null : (
          <div>
            <ErrorBanner
              title={`${errorTitle[failure.action.kind]}: ${name}`}
              error={failure.error}
              onRetry={() => void run(failure.action)}
            />
            {refusedFacts.length === 0 ? null : (
              <div className={styles.blockedPanel}>
                <p>{elementCopy.refusedFacts}</p>
                <BlockingFacts facts={refusedFacts} label={elementCopy.refusedFacts} />
              </div>
            )}
          </div>
        )}
        <p role="status" aria-live="polite" className={styles.status}>
          {action?.kind === 'regenerate' ? elementCopy.regenerating : message}
        </p>
      </section>
    </ReviewWorkspace>
  );
}
