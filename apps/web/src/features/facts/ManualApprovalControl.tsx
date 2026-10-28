import type { Fact } from '@edr/contracts';
import { useEffect, useId, useRef, useState } from 'react';

import { ErrorBanner } from '../../ui';
import { approveFactManually, revokeManualFactApproval, useFactsApi } from './api';
import { manualCopy } from './copy';
import styles from './Facts.module.css';
import { Heading, type HeadingLevel } from './Heading';

export interface ManualApprovalControlProps {
  mode: 'approve' | 'revoke';
  projectId: string;
  runId: string;
  fact: Fact;
  /** Name of the fact, added to the accessible name of the trigger button. */
  factLabel: string;
  headingLevel: HeadingLevel;
  /** Called with the fact returned by the server after a successful action. */
  onUpdated: (fact: Fact) => void;
  /** Announces the result in the page's polite live region. */
  announce: (message: string) => void;
}

type Step = { kind: 'idle' } | { kind: 'confirming' } | { kind: 'sending' } | { kind: 'failed'; error: unknown };

/**
 * Approve or revoke the manual approval of one MANUAL_DATA fact (approveFactManually, revokeManualFactApproval;
 * R-071, R-272), after an inline confirmation. A refusal (MANUAL_APPROVAL_REFUSED) is announced with its reason. The
 * resulting status is MANUALLY_APPROVED (operator-attested) or back to unverified, never verified (R-412).
 */
export function ManualApprovalControl({
  mode,
  projectId,
  runId,
  fact,
  factLabel,
  headingLevel,
  onUpdated,
  announce,
}: ManualApprovalControlProps) {
  const client = useFactsApi();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  // Focus follows the inline confirmation: into it when it opens, back to the trigger when it closes, fails or the
  // action completes (the trigger then offers the opposite action); a failure is also announced by the alert.
  useEffect(() => {
    if (step.kind === 'confirming') {
      confirmRef.current?.focus();
    } else if ((step.kind === 'idle' || step.kind === 'failed') && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [step.kind, mode]);

  const label = mode === 'approve' ? manualCopy.approve : manualCopy.revoke;

  async function submit(): Promise<void> {
    setStep({ kind: 'sending' });
    try {
      const updated =
        mode === 'approve'
          ? await approveFactManually(client, projectId, runId, fact.factId)
          : await revokeManualFactApproval(client, projectId, runId, fact.factId);
      restoreFocus.current = true;
      setStep({ kind: 'idle' });
      onUpdated(updated);
      announce(mode === 'approve' ? manualCopy.approved : manualCopy.revoked);
    } catch (error) {
      restoreFocus.current = true;
      setStep({ kind: 'failed', error });
    }
  }

  function cancel(): void {
    restoreFocus.current = true;
    setStep({ kind: 'idle' });
  }

  const sending = step.kind === 'sending';

  return (
    <div className={styles.manual}>
      {step.kind === 'confirming' || step.kind === 'sending' ? (
        <div className={styles.confirm} role="group" aria-labelledby={titleId} aria-describedby={bodyId}>
          <Heading level={headingLevel} id={titleId}>
            {mode === 'approve' ? manualCopy.approveTitle : manualCopy.revokeTitle}
          </Heading>
          <p id={bodyId}>{mode === 'approve' ? manualCopy.approveBody : manualCopy.revokeBody}</p>
          <div className={styles.actions}>
            <button
              ref={confirmRef}
              type="button"
              className={styles.button}
              onClick={() => void submit()}
              disabled={sending}
              aria-busy={sending}
            >
              {sending ? manualCopy.sending : manualCopy.confirm}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={cancel} disabled={sending}>
              {manualCopy.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={mode === 'approve' ? styles.button : styles.secondaryButton}
          onClick={() => setStep({ kind: 'confirming' })}
          aria-label={`${label}: ${factLabel}`}
        >
          {label}
        </button>
      )}
      {step.kind === 'failed' ? (
        <ErrorBanner
          error={step.error}
          title={manualCopy.actionErrorTitle}
          onRetry={() => {
            void submit();
          }}
        />
      ) : null}
    </div>
  );
}
