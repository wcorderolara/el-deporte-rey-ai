import type { Element, QaWarningCheck } from '@edr/contracts';

import { Badge } from '../../ui';
import { BlockingFacts } from './BlockingFacts';
import { contentFlagLabel, elementCopy } from './copy';
import { elementName, isBlockingFailure, needsAcknowledgement } from './model';
import { QaResults } from './QaResults';
import styles from './Review.module.css';

export interface ValidationSummaryProps {
  element: Element;
  /** Acknowledge one QA warning (null while another action runs). */
  onAcknowledge: ((check: QaWarningCheck) => void) | null;
  acknowledging: QaWarningCheck | null;
}

/**
 * The validations of the shown version (UX-REVIEW-01), as a compact summary («Sin errores», «2 advertencias»,
 * «1 bloqueo») that expands into the details: each group names its severity, what it is, the element it affects and
 * the correction that exists (regenerate, confirm the warning, or make the data publishable). Only real results are
 * listed: the server's blocking facts, content flags and visual-QA results. The details start open when something
 * needs the operator, so a disabled approval is always explained.
 */
export function ValidationSummary({ element, onAcknowledge, acknowledging }: ValidationSummaryProps) {
  const version = element.currentVersion;
  const name = elementName(element);
  const approved = version.state === 'approved';
  // Only the QA checks that need the operator: warnings to acknowledge and blocking failures to regenerate.
  const qaToReview = approved
    ? []
    : version.qa.filter((result) => needsAcknowledgement(result) || isBlockingFailure(result));
  const flags = approved ? [] : version.contentFlags;
  const passed = version.qa.filter((result) => result.outcome === 'pass').length;
  const blocking =
    (version.blockingFacts.length > 0 ? 1 : 0) +
    (flags.length > 0 ? 1 : 0) +
    qaToReview.filter(isBlockingFailure).length;
  const warnings = qaToReview.filter(needsAcknowledgement).length;
  const actionable = blocking > 0 || warnings > 0;
  const summary = elementCopy.validationSummary(blocking, warnings, version.state === 'pending_qa');

  return (
    <details
      key={version.id}
      open={actionable}
      className="rounded-card border border-border-subtle bg-surface-subtle p-3"
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="text-caption font-bold tracking-label text-text-secondary uppercase">
          {elementCopy.validationsTitle}
        </span>
        <Badge tone={blocking > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success'} symbol={actionable ? '!' : '✓'}>
          {summary}
        </Badge>
      </summary>
      <div className="mt-3 grid gap-3 text-body-sm">
        {passed === 0 ? null : <p className="m-0 text-text-secondary">{elementCopy.qaPassed(passed)}</p>}
        {version.blockingFacts.length === 0 ? null : (
          <section className={styles.blockedPanel} aria-label={`${elementCopy.blockedTitle}: ${name}`}>
            <p className={styles.panelTitle}>
              <Badge tone="danger">{elementCopy.severityBlocking}</Badge> {elementCopy.blockedTitle}
            </p>
            <p>{elementCopy.blockedIntro}</p>
            <BlockingFacts facts={version.blockingFacts} label={elementCopy.blockedTitle} />
            <p className={styles.hint}>{elementCopy.blockedAction}</p>
          </section>
        )}
        {flags.length === 0 ? null : (
          <section className={styles.flagPanel} aria-label={`${elementCopy.flagsTitle}: ${name}`}>
            <p className={styles.panelTitle}>
              <Badge tone="danger">{elementCopy.severityBlocking}</Badge> {elementCopy.flagsTitle}
            </p>
            <ul className={styles.detailList}>
              {flags.map((flag, index) => (
                <li key={`${flag.code}-${index}`}>
                  <strong>{contentFlagLabel[flag.code]}</strong>. {elementCopy.flagField}: {flag.field}.{' '}
                  {elementCopy.flagExcerpt}: «{flag.excerpt}»
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{elementCopy.flagsAction}</p>
          </section>
        )}
        {qaToReview.length === 0 ? null : (
          <section aria-label={`${elementCopy.qaTitle}: ${name}`}>
            <p className={styles.panelTitle}>{elementCopy.qaTitle}</p>
            <p className={styles.hint}>{elementCopy.qaIntro}</p>
            <QaResults results={qaToReview} onAcknowledge={onAcknowledge} acknowledging={acknowledging} />
          </section>
        )}
        <p className="m-0 text-caption text-text-subtle">{elementCopy.affects(name)}</p>
      </div>
    </details>
  );
}
