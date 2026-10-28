import type { Fact, SlideTrace } from '@edr/contracts';
import { useId, useMemo } from 'react';
import { Link, useParams } from 'react-router';

import { appCopy, DataModeBadge, DemoBanner, ErrorBanner, FactStatusBadge, formatDateTime } from '../../ui';
import { blockReasonLabel, factKindLabel, manualCopy, valueCopy } from '../facts/copy';
import { DisputeRecord } from '../facts/DisputeRecord';
import { EvidenceTable } from '../facts/EvidenceTable';
import { factValueText, matchLabel, teamNamesFrom, type TeamNames } from '../facts/format';
import { loadSlideTrace, useHistoryApi } from './api';
import { traceUsesAttestedFacts } from './attested';
import { AttestedNote } from './AttestedNote';
import { historyCopy, traceCopy } from './copy';
import styles from './History.module.css';
import { exportPath, exportsPath, isUuid, parsePosition } from './paths';
import { useLoad } from './useLoad';

/**
 * Route component: trace of one exported slide (`.../exports/:exportId/slides/:position/trace`; R-044, R-221,
 * R-287): every fact the slide uses with its status and reason, its evidence per source (source name, data mode,
 * reference as text only, retrieval time, import version), its manual approval and its dispute record. It is a
 * record: there is no control that changes a fact or an approval here.
 */
export function TracePage() {
  const { projectId, exportId, position: positionParam } = useParams();
  const position = parsePosition(positionParam);
  const valid = isUuid(projectId) && isUuid(exportId) && position !== null;
  return (
    <section aria-labelledby="trace-title">
      <h1 id="trace-title">{position === null ? traceCopy.titleUnknown : traceCopy.title(position)}</h1>
      <p className={styles.intro}>{traceCopy.intro}</p>
      {valid ? (
        <TraceView
          key={`${projectId}/${exportId}/${position}`}
          projectId={projectId}
          exportId={exportId}
          position={position}
        />
      ) : (
        <>
          <p>{traceCopy.invalidAddress}</p>
          {isUuid(projectId) ? (
            <p className={styles.links}>
              <Link to={exportsPath(projectId)}>{historyCopy.backToExports}</Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

interface TraceViewProps {
  projectId: string;
  exportId: string;
  position: number;
}

function TraceLinks({ projectId, exportId }: { projectId: string; exportId: string }) {
  return (
    <p className={styles.links}>
      <Link to={exportPath(projectId, exportId)}>{traceCopy.backToExport}</Link>
      {' · '}
      <Link to={exportsPath(projectId)}>{historyCopy.backToExports}</Link>
    </p>
  );
}

function TraceView({ projectId, exportId, position }: TraceViewProps) {
  const client = useHistoryApi();
  const trace = useLoad(`trace\u0000${exportId}\u0000${position}`, (signal) =>
    loadSlideTrace(client, exportId, position, signal),
  );

  switch (trace.state.status) {
    case 'loading':
      return (
        <p role="status" aria-live="polite">
          {appCopy.loading}
        </p>
      );
    case 'error':
      return (
        <>
          <ErrorBanner error={trace.state.error} title={traceCopy.loadErrorTitle} onRetry={trace.reload} />
          <TraceLinks projectId={projectId} exportId={exportId} />
        </>
      );
    case 'success':
      return (
        <>
          <TraceLinks projectId={projectId} exportId={exportId} />
          <TraceContent trace={trace.state.data} />
        </>
      );
  }
}

function TraceContent({ trace }: { trace: SlideTrace }) {
  const factsTitleId = useId();
  const { facts } = trace;
  const teams = useMemo(() => teamNamesFrom(facts), [facts]);
  const verified = facts.filter((fact) => fact.status === 'verified').length;
  const attested = facts.filter((fact) => fact.status === 'manually_approved').length;

  return (
    <>
      <dl className={styles.summary} data-testid="trace-summary">
        <div>
          <dt>{traceCopy.dataMode}</dt>
          <dd>
            <DataModeBadge mode={trace.dataMode} />
          </dd>
        </div>
        <div>
          <dt>{traceCopy.elementVersion}</dt>
          <dd>
            <code translate="no">{trace.elementVersionId}</code>
          </dd>
        </div>
      </dl>
      {trace.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      {traceUsesAttestedFacts(trace) ? <AttestedNote /> : null}
      <section className={styles.section} aria-labelledby={factsTitleId}>
        <h2 id={factsTitleId}>{traceCopy.factsTitle}</h2>
        {facts.length === 0 ? (
          <p>{traceCopy.noFacts}</p>
        ) : (
          <>
            <p data-testid="trace-count">
              {traceCopy.summary(facts.length, verified, facts.length - verified - attested, attested)}
            </p>
            <ul className={styles.factList}>
              {facts.map((fact) => (
                <TraceFact key={fact.factId} fact={fact} facts={facts} teams={teams} />
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/** Name of a fact: its kind and its subject (match, team or context item). */
function factTitle(fact: Fact, facts: readonly Fact[], teams: TeamNames): string {
  const kind = factKindLabel[fact.kind];
  const { matchKey, teamId, contextIndex } = fact.subject;
  if (matchKey !== undefined) {
    return `${kind} · ${matchLabel(matchKey, facts, teams)}`;
  }
  if (teamId !== undefined) {
    return `${kind} · ${teams.get(teamId) ?? teamId}`;
  }
  if (contextIndex !== undefined) {
    return `${kind} ${contextIndex + 1}`;
  }
  return kind;
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
 * One fact of the exported slide: status (MANUALLY_APPROVED labelled operator-attested, never verified), value,
 * reason, manual approval, publication block reported by the server, evidence per source and dispute record.
 */
function TraceFact({ fact, facts, teams }: { fact: Fact; facts: readonly Fact[]; teams: TeamNames }) {
  const titleId = useId();
  const disputeId = useId();
  const title = factTitle(fact, facts, teams);
  const valueText = factValueText(fact, teams);
  return (
    <li className={styles.fact} data-status={fact.status} data-testid="trace-fact" data-fact-key={fact.factKey}>
      <article aria-labelledby={titleId}>
        <div className={styles.factHeader}>
          <h3 id={titleId}>{title}</h3>
          <FactStatusBadge status={fact.status} unverifiedReason={fact.unverifiedReason} />
        </div>
        <dl className={styles.details}>
          <div>
            <dt>{valueText === null ? valueCopy.none : valueLabel(fact)}</dt>
            <dd data-testid="trace-value">{valueText ?? '—'}</dd>
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
          <div data-testid="trace-manual-approval">
            <dt>{traceCopy.manualApproval}</dt>
            <dd>
              {fact.manualApproval === null ? (
                traceCopy.noManualApproval
              ) : (
                <>
                  {manualCopy.approvedAt}{' '}
                  <time dateTime={fact.manualApproval.approvedAt}>
                    {formatDateTime(fact.manualApproval.approvedAt)}
                  </time>
                  {fact.manualApproval.carriedOverFromFactId === null ? null : <> ({manualCopy.carriedOver})</>}
                </>
              )}
            </dd>
          </div>
          {fact.blockReason === undefined ? null : (
            <div>
              <dt>{traceCopy.blockReason}</dt>
              <dd>{blockReasonLabel[fact.blockReason]}</dd>
            </div>
          )}
        </dl>
        <EvidenceTable evidence={fact.evidence} teams={teams} factLabel={title} />
        {fact.dispute === null ? null : (
          <DisputeRecord
            dispute={fact.dispute}
            evidence={fact.evidence}
            teams={teams}
            headingId={disputeId}
            headingLevel={4}
          />
        )}
      </article>
    </li>
  );
}
