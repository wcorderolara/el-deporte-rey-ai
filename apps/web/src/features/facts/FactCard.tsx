import type { Fact } from '@edr/contracts';
import { useId } from 'react';

import { FactStatusBadge, formatDateTime, refusalReasonLabel } from '../../ui';
import { blockReasonLabel, manualCopy, publicationCopy, valueCopy } from './copy';
import { DisputeRecord } from './DisputeRecord';
import {
  manualControlFor,
  publicationNoteFor,
  type IneligibleReason,
  type ManualApprovalPageState,
} from './eligibility';
import { EvidenceTable } from './EvidenceTable';
import styles from './Facts.module.css';
import { factValueText, type TeamNames } from './format';
import { Heading, nextLevel, type HeadingLevel } from './Heading';
import { ManualApprovalControl } from './ManualApprovalControl';

export interface FactCardProps {
  fact: Fact;
  /** Full name of the fact (kind and subject), for accessible names. */
  label: string;
  /** Visible title; defaults to the full name. */
  title?: string;
  teams: TeamNames;
  projectId: string;
  runId: string;
  manualApproval: ManualApprovalPageState;
  headingLevel: HeadingLevel;
  onUpdated: (fact: Fact) => void;
  announce: (message: string) => void;
}

function ineligibleText(reason: IneligibleReason): string {
  switch (reason) {
    case 'no_candidate_value':
      return manualCopy.noCandidateValue;
    case 'not_eligible':
      return manualCopy.notEligible;
    default:
      return refusalReasonLabel[reason];
  }
}

function valueLabel(fact: Fact): string {
  switch (fact.status) {
    case 'verified':
      return valueCopy.verified;
    case 'manually_approved':
      return valueCopy.attested;
    case 'unverified':
      return valueCopy.candidate;
  }
}

/**
 * One fact of the run: status (VERIFIED; UNVERIFIED with its reason; MANUALLY_APPROVED labelled operator-attested and
 * never styled or worded as verified; OD-17, OD-28), value or candidate value, server reason, manual approval audit,
 * publication approval note (R-026, R-271, R-272, R-078), evidence per source, dispute record and, for eligible facts
 * only, the manual approval or revocation control (R-272). No control sets a fact to verified (R-412).
 */
export function FactCard({
  fact,
  label,
  title = label,
  teams,
  projectId,
  runId,
  manualApproval,
  headingLevel,
  onUpdated,
  announce,
}: FactCardProps) {
  const titleId = useId();
  const disputeId = useId();
  const valueText = factValueText(fact, teams);
  const control = manualControlFor(fact, manualApproval);
  const publication = publicationNoteFor(fact);
  const subLevel = nextLevel(headingLevel);

  return (
    <li className={styles.fact} data-status={fact.status} data-testid="fact" data-fact-key={fact.factKey}>
      <article aria-labelledby={titleId}>
        <div className={styles.factHeader}>
          <Heading level={headingLevel} id={titleId} className={styles.factTitle}>
            {title}
          </Heading>
          <FactStatusBadge status={fact.status} unverifiedReason={fact.unverifiedReason} />
        </div>
        <dl className={styles.details}>
          <div>
            <dt>{valueText === null ? valueCopy.none : valueLabel(fact)}</dt>
            <dd data-testid="fact-value">
              {valueText ?? (fact.unverifiedReason === 'disputed' ? valueCopy.noneDisputed : '—')}
            </dd>
          </div>
          {fact.reason === null || fact.reason === '' ? null : (
            <div>
              <dt>{valueCopy.reason}</dt>
              <dd>{fact.reason}</dd>
            </div>
          )}
          <div>
            <dt>{valueCopy.factKey}</dt>
            <dd>
              <code translate="no">{fact.factKey}</code>
            </dd>
          </div>
          {fact.manualApproval === null ? null : (
            <div>
              <dt>{manualCopy.approvedAt}</dt>
              <dd>
                <time dateTime={fact.manualApproval.approvedAt}>{formatDateTime(fact.manualApproval.approvedAt)}</time>
                {fact.manualApproval.carriedOverFromFactId === null ? null : <> ({manualCopy.carriedOver})</>}
              </dd>
            </div>
          )}
        </dl>
        {publication.kind === 'blocked' ? (
          <p className={styles.blocked} data-testid="publication-note">
            <span aria-hidden="true">⛔ </span>
            <strong>{publicationCopy.blocked}:</strong> {blockReasonLabel[publication.reason]}
          </p>
        ) : (
          <p className={styles.noBlock} data-testid="publication-note">
            {fact.status === 'manually_approved' ? publicationCopy.attestedNoBlock : publicationCopy.noBlockReported}
          </p>
        )}
        <EvidenceTable evidence={fact.evidence} teams={teams} factLabel={label} />
        {fact.dispute === null ? null : (
          <DisputeRecord
            dispute={fact.dispute}
            evidence={fact.evidence}
            teams={teams}
            headingId={disputeId}
            headingLevel={subLevel}
          />
        )}
        {control.kind === 'approve' || control.kind === 'revoke' ? (
          <ManualApprovalControl
            mode={control.kind}
            projectId={projectId}
            runId={runId}
            fact={fact}
            factLabel={label}
            headingLevel={subLevel}
            onUpdated={onUpdated}
            announce={announce}
          />
        ) : null}
        {control.kind === 'unavailable' ? (
          <p className={`${styles.manual} ${styles.unavailable}`} data-testid="manual-unavailable">
            <strong>{manualCopy.unavailableTitle}:</strong> {ineligibleText(control.reason)}
          </p>
        ) : null}
      </article>
    </li>
  );
}
