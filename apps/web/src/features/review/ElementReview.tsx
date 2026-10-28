import type { Element, QaWarningCheck } from '@edr/contracts';
import { useId, useState } from 'react';

import { ApiError } from '../../api/client';
import { ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import { BlockingFacts } from './BlockingFacts';
import { approvalObstacleLabel, contentFlagLabel, elementCopy, versionStateLabel } from './copy';
import { approvalObstacles, elementName, problemFacts } from './model';
import { QaResults } from './QaResults';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { TextFields } from './TextFields';

type Action = { kind: 'approve' | 'withdraw' | 'regenerate' } | { kind: 'acknowledge'; check: QaWarningCheck };

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
}

/**
 * One slide or the caption of a carousel (R-215, R-217, R-206, R-208, OD-09): image of the current version, text
 * with provenance labels, review state, blocked facts with their block reasons, content flags, QA results with the
 * acknowledgement of warnings, and the approve, withdraw and regenerate actions. Approval sends the exact version
 * shown (R-406). The server's answer is always shown; a refusal is announced with the facts it names.
 */
export function ElementReview({ element, onChanged, onRefused }: ElementReviewProps) {
  const { api } = useReviewDependencies();
  const [action, setAction] = useState<Action | null>(null);
  const [failure, setFailure] = useState<{ action: Action; error: unknown } | null>(null);
  const [message, setMessage] = useState('');
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const obstaclesId = `${baseId}-obstacles`;

  const version = element.currentVersion;
  const name = elementName(element);
  const obstacles = approvalObstacles(version);
  const approved = version.state === 'approved';
  const busy = action !== null;

  async function run(next: Action) {
    if (busy) {
      return;
    }
    setAction(next);
    setFailure(null);
    setMessage('');
    try {
      let result: Element;
      switch (next.kind) {
        case 'approve':
          result = await api.approveElement(element.carouselId, element.id, version.id);
          setMessage(elementCopy.approved(result.currentVersion.versionNumber));
          break;
        case 'withdraw':
          result = await api.withdrawElementApproval(element.carouselId, element.id);
          setMessage(elementCopy.withdrawn);
          break;
        case 'regenerate':
          result = await api.regenerateElement(element.carouselId, element.id);
          setMessage(elementCopy.regenerated(result.currentVersion.versionNumber));
          break;
        case 'acknowledge':
          result = await api.acknowledgeQaWarning(element.carouselId, element.id, version.id, next.check);
          setMessage(elementCopy.acknowledged);
          break;
      }
      onChanged(result);
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

  return (
    <article
      aria-labelledby={titleId}
      className={styles.element}
      data-blocked={version.blocked ? 'true' : 'false'}
      data-state={version.state}
    >
      <header className={styles.elementHeader}>
        <h4 id={titleId}>{name}</h4>
        <p className={styles.elementMeta}>
          {elementCopy.version(version.versionNumber)}, {elementCopy.createdAt}{' '}
          <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
        </p>
        <p className={styles.badges}>
          <StatusBadge
            label={versionStateLabel[version.state]}
            tone={approved ? 'positive' : version.state === 'qa_failed' ? 'caution' : 'neutral'}
            symbol={approved ? '✓' : version.state === 'qa_failed' ? '!' : '•'}
          />
          {version.blocked ? <StatusBadge label={elementCopy.blocked} tone="caution" symbol="⛔" /> : null}
        </p>
      </header>

      {element.kind === 'slide' ? (
        version.imageUrl === null ? (
          <p className={styles.hint}>{elementCopy.noImage}</p>
        ) : (
          <figure className={styles.figure}>
            <img
              className={styles.slideImage}
              src={api.slideImageUrl(version.id)}
              alt={elementCopy.imageAlt(name, version.versionNumber)}
              width={version.width ?? undefined}
              height={version.height ?? undefined}
              loading="lazy"
            />
            {version.width === null || version.height === null ? null : (
              <figcaption className={styles.hint}>{elementCopy.dimensions(version.width, version.height)}</figcaption>
            )}
          </figure>
        )
      ) : null}

      <section aria-label={`${elementCopy.textTitle}: ${name}`}>
        <TextFields version={version} />
      </section>

      {version.blockingFacts.length === 0 ? null : (
        <section className={styles.blockedPanel} aria-label={`${elementCopy.blockedTitle}: ${name}`}>
          <p className={styles.panelTitle}>
            <span aria-hidden="true">⛔ </span>
            {elementCopy.blockedTitle}
          </p>
          <p>{elementCopy.blockedIntro}</p>
          <BlockingFacts facts={version.blockingFacts} label={elementCopy.blockedTitle} />
        </section>
      )}

      {version.contentFlags.length === 0 ? null : (
        <section className={styles.flagPanel} aria-label={`${elementCopy.flagsTitle}: ${name}`}>
          <p className={styles.panelTitle}>
            <span aria-hidden="true">! </span>
            {elementCopy.flagsTitle}
          </p>
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

      {element.kind === 'slide' || version.qa.length > 0 ? (
        <section aria-label={`${elementCopy.qaTitle}: ${name}`}>
          <p className={styles.panelTitle}>{elementCopy.qaTitle}</p>
          <QaResults
            results={version.qa}
            onAcknowledge={busy ? null : (check) => void run({ kind: 'acknowledge', check })}
            acknowledging={action?.kind === 'acknowledge' ? action.check : null}
          />
        </section>
      ) : null}

      <div className={styles.actions} role="group" aria-label={`${elementCopy.actionsTitle}: ${name}`}>
        {approved ? (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => void run({ kind: 'withdraw' })}
          >
            {action?.kind === 'withdraw' ? elementCopy.withdrawing : elementCopy.withdraw}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy || obstacles.length > 0}
            aria-describedby={obstacles.length > 0 ? obstaclesId : undefined}
            onClick={() => void run({ kind: 'approve' })}
          >
            {action?.kind === 'approve' ? elementCopy.approving : elementCopy.approve}
          </button>
        )}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={busy || version.state === 'superseded'}
          onClick={() => void run({ kind: 'regenerate' })}
        >
          {elementCopy.regenerate}
        </button>
      </div>
      {obstacles.length === 0 ? null : (
        <div id={obstaclesId} className={styles.obstacles}>
          <p>{elementCopy.cannotApprove}</p>
          <ul className={styles.detailList}>
            {obstacles.map((obstacle) => (
              <li key={obstacle}>{approvalObstacleLabel[obstacle]}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.hint}>{elementCopy.regenerateHint}</p>

      <p role="status" aria-live="polite" className={styles.status}>
        {action?.kind === 'regenerate' ? elementCopy.regenerating : message}
      </p>
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
    </article>
  );
}
