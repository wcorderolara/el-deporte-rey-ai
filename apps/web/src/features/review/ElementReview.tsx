import type { Element, QaWarningCheck } from '@edr/contracts';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { ApiError } from '../../api/client';
import { Button, classNames, ErrorBanner, formatDateTime, Icon, StatusBadge } from '../../ui';
import { BlockingFacts } from './BlockingFacts';
import { approvalObstacleLabel, elementCopy, slideTypeLabel, textFieldLabel, versionStateLabel } from './copy';
import { copyText } from './editorial/download';
import { approvalObstacles, elementName, problemFacts } from './model';
import type { SlidePagerProps } from './SlidePreview';
import { SlidePanel, SlideWorkspace } from './SlideWorkspace';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { ValidationSummary } from './ValidationSummary';

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
  /** The slide list of the carousel, shown as the first column of a slide. */
  workspaceNavigation?: ReactNode;
  /** Position and previous/next of the selected slide. */
  pager?: SlidePagerProps;
  /** Called after a successful approval (the carousel moves to the next pending slide). */
  onApproved?: (element: Element) => void;
  /** The next slide that is not approved yet, offered as a shortcut. */
  nextPending?: { name: string; onSelect: () => void } | null;
  /** A collapsed slide list takes a narrow column. */
  navigationCollapsed?: boolean;
}

function templateVersions(element: Element): string[] {
  for (const result of element.currentVersion.qa) {
    if (result.check === 'style_consistency') return result.details.templateVersions;
  }
  return [];
}

/**
 * One slide or the caption of a carousel (R-215, R-217, R-206, R-208, OD-09; layout UX-REVIEW-01).
 *
 * - A slide is a workspace of three columns: the slide list, the preview (the protagonist) and the review inspector.
 * - The caption is the text in a reading column and the same inspector beside it.
 *
 * The inspector holds the state, a single approve action (or withdraw for an approved version), regeneration, the
 * validations (blocking facts, content flags, QA with the acknowledgement of warnings) and secondary details.
 * Approval sends the exact version shown (R-406); what prevents it is explained next to the action; the server's
 * answer is always shown, and a refusal is announced with the facts it names. No state is assumed before the answer.
 */
export function ElementReview({
  element,
  onChanged,
  onRefused,
  workspaceNavigation,
  pager,
  onApproved,
  nextPending = null,
  navigationCollapsed = false,
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
  const isSlide = element.kind === 'slide';
  const obstacles = approvalObstacles(version);
  const warningCount = version.qa.filter((result) => result.severity === 'warning' && result.outcome === 'fail').length;
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
      if (next.kind === 'approve') onApproved?.(result);
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
  const templates = isSlide ? templateVersions(element) : [];

  const inspector = (
    <SlidePanel
      label={`${elementCopy.reviewPanel}: ${name}`}
      eyebrow={isSlide ? elementCopy.slideEyebrow : elementCopy.captionEyebrow}
      badges={
        <span className="flex flex-wrap gap-1">
          <StatusBadge
            label={versionStateLabel[version.state]}
            tone={approved ? 'positive' : version.state === 'qa_failed' ? 'caution' : 'neutral'}
            symbol={approved ? '✓' : version.state === 'qa_failed' ? '!' : '•'}
          />
          {version.blocked ? <StatusBadge label={elementCopy.blocked} tone="caution" symbol="⛔" /> : null}
        </span>
      }
      title={name}
      titleId={titleId}
      titleRef={headingRef}
    >
      {/* What prevents the approval, next to it; nothing when the state badge and the validations already say it. */}
      {obstacles.length === 0 ? null : (
        <div
          className={classNames(
            'rounded-control border p-3 text-body-sm',
            version.blocked
              ? 'border-danger bg-danger-surface text-danger'
              : 'border-warning bg-warning-surface text-warning',
          )}
          aria-live="polite"
        >
          <strong>{elementCopy.needsAttention}</strong>
          <ul className={styles.detailList} id={obstaclesId}>
            {obstacles.map((obstacle) => (
              <li key={obstacle}>{approvalObstacleLabel[obstacle]}</li>
            ))}
          </ul>
          {warningCount > 0 && !approved ? (
            <p className={styles.warningSummary}>{elementCopy.warningSummary(warningCount)}</p>
          ) : null}
        </div>
      )}

      <div className="grid gap-2" role="group" aria-label={`${elementCopy.actionsTitle}: ${name}`}>
        {approved ? (
          <Button
            variant="secondary"
            className="w-full"
            isLoading={action?.kind === 'withdraw'}
            loadingLabel={elementCopy.withdrawing}
            disabled={busy}
            onClick={() => void run({ kind: 'withdraw' })}
          >
            {elementCopy.withdraw}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={action?.kind === 'approve'}
            loadingLabel={elementCopy.approving}
            disabled={busy || obstacles.length > 0}
            aria-describedby={obstacles.length > 0 ? obstaclesId : undefined}
            leadingIcon={<Icon name="check" size={18} />}
            onClick={() => void run({ kind: 'approve' })}
          >
            {isSlide ? elementCopy.approveSlide : elementCopy.approveCaption}
          </Button>
        )}
        <Button
          variant="secondary"
          className="w-full"
          isLoading={action?.kind === 'regenerate'}
          loadingLabel={elementCopy.regenerating}
          disabled={busy || version.state === 'superseded'}
          onClick={() => void run({ kind: 'regenerate' })}
        >
          {elementCopy.regenerateLabel(element.kind)}
        </Button>
        <p className="m-0 text-caption text-text-secondary">
          {isSlide && !approved && nextPending !== null ? `${elementCopy.approveAndNextHint} ` : ''}
          {elementCopy.regenerateHint}
        </p>
      </div>

      {failure === null ? null : (
        <div className="grid gap-2">
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
      <p role="status" aria-live="polite" className="m-0 text-body-sm font-bold text-text-primary">
        {action?.kind === 'regenerate' ? elementCopy.regenerating : message}
      </p>

      <ValidationSummary
        element={element}
        onAcknowledge={busy ? null : (check) => void run({ kind: 'acknowledge', check })}
        acknowledging={action?.kind === 'acknowledge' ? action.check : null}
      />

      {isSlide ? (
        <details className="rounded-card border border-border-subtle bg-surface-subtle p-3">
          <summary className="cursor-pointer text-caption font-bold tracking-label text-text-secondary uppercase">
            {elementCopy.detailsTitle}
          </summary>
          <dl className="m-0 mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
            <dt className="text-text-secondary">{elementCopy.versionLabel}</dt>
            <dd className="m-0">{version.versionNumber}</dd>
            <dt className="text-text-secondary">{elementCopy.createdAt}</dt>
            <dd className="m-0">
              <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
            </dd>
            {version.width === null || version.height === null ? null : (
              <>
                <dt className="text-text-secondary">{elementCopy.sizeLabel}</dt>
                <dd className="m-0">{elementCopy.dimensions(version.width, version.height)}</dd>
              </>
            )}
            {templates.length === 0 ? null : (
              <>
                <dt className="text-text-secondary">{elementCopy.templateLabel}</dt>
                <dd className="m-0 break-words">{templates.join(', ')}</dd>
              </>
            )}
          </dl>
          {version.fields.length === 0 ? null : (
            <>
              <p className="m-0 mt-3 text-caption font-bold text-text-secondary">{elementCopy.textTitle}</p>
              <dl className="m-0 mt-1 grid gap-1 text-body-sm">
                {version.fields.map((field, index) => (
                  <div key={`${field.field}-${index}`}>
                    <dt className="text-caption text-text-secondary">{textFieldLabel[field.field]}</dt>
                    <dd className="m-0 break-words">{field.segments.map((segment) => segment.text).join('')}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </details>
      ) : null}

      {isSlide && nextPending !== null ? (
        <button
          type="button"
          className="focus-studio m-0 flex w-full cursor-pointer items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface-card p-3 text-left text-text-primary hover:border-border-strong"
          onClick={nextPending.onSelect}
        >
          <span className="grid gap-0.5">
            <span className="text-caption font-bold tracking-label text-text-secondary uppercase">
              {elementCopy.nextPending}
            </span>
            <span className="font-sans text-body-sm font-bold">{nextPending.name}</span>
          </span>
          <Icon name="chevron-right" size={20} />
        </button>
      ) : null}
    </SlidePanel>
  );

  if (!isSlide) {
    return (
      <article
        className="grid min-w-0 gap-4 lg:h-full lg:min-h-0 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]"
        data-state={version.state}
        data-blocked={version.blocked ? 'true' : 'false'}
        aria-labelledby={titleId}
      >
        <CaptionText element={element} onCopied={setMessage} />
        {inspector}
      </article>
    );
  }

  return (
    <SlideWorkspace
      height="parent"
      navigation={workspaceNavigation}
      navigationCollapsed={navigationCollapsed}
      preview={{
        name,
        typeLabel: element.slideType === null ? null : slideTypeLabel[element.slideType],
        version,
        imageSource: version.imageUrl === null ? null : api.slideImageUrl(version.id),
        ...(pager === undefined ? {} : { pager }),
      }}
      panel={inspector}
      data-state={version.state}
      data-blocked={version.blocked ? 'true' : 'false'}
      aria-labelledby={titleId}
    />
  );
}

/** The caption in a comfortable reading column, with a copy action per field and for the whole text. */
function CaptionText({ element, onCopied }: { element: Element; onCopied: (message: string) => void }) {
  const fields = element.currentVersion.fields.map((field) => ({
    field: field.field,
    text: field.segments.map((segment) => segment.text).join(''),
  }));
  async function copy(text: string) {
    onCopied((await copyText(text)) ? elementCopy.copied : elementCopy.copyFailed);
  }
  return (
    <section
      aria-label={elementCopy.captionReadable}
      className="grid min-h-0 min-w-0 content-start gap-5 rounded-panel border border-border-subtle bg-surface-raised p-5 lg:overflow-y-auto"
    >
      <p className="m-0 max-w-reading text-body-sm text-text-secondary">{elementCopy.captionIntro}</p>
      {fields.length === 0 ? (
        <p className="m-0">{elementCopy.noText}</p>
      ) : (
        <dl className="m-0 grid max-w-reading gap-5">
          {fields.map((field, index) => (
            <div key={`${field.field}-${index}`} className="grid gap-2">
              <dt className="flex items-center justify-between gap-2">
                <span className="text-caption font-bold tracking-label text-text-secondary uppercase">
                  {textFieldLabel[field.field]}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={elementCopy.copyField(textFieldLabel[field.field])}
                  onClick={() => void copy(field.text)}
                >
                  {elementCopy.copy}
                </Button>
              </dt>
              <dd className="m-0 text-body-lg whitespace-pre-wrap text-text-primary">{field.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {fields.length === 0 ? null : (
        <div>
          <Button variant="secondary" onClick={() => void copy(fields.map((field) => field.text).join('\n\n'))}>
            {elementCopy.copyAll}
          </Button>
        </div>
      )}
    </section>
  );
}
