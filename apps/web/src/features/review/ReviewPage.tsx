import { contractRegExp, type Draft } from '@edr/contracts';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../api/client';
import { featurePaths } from '../../app/routes';
import { DataModeBadge, DemoBanner, ErrorBanner, formatDateTime } from '../../ui';
import { CarouselReview } from './CarouselReview';
import { languageLabel, leftOutCopy, leftOutReasonLabel, matchStatusLabel, reviewCopy } from './copy';
import { ExclusionsEditor } from './ExclusionsEditor';
import { usesManuallyApprovedFacts } from './model';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';
import { useDraft } from './useDraft';

const UUID = contractRegExp('Uuid');

function projectPath(projectId: string): string {
  return `${featurePaths.projects}/${encodeURIComponent(projectId)}`;
}

function isNoDraft(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'problem' && error.problem?.code === 'NOT_FOUND';
}

function DraftSummary({ draft }: { draft: Draft }) {
  return (
    <section aria-labelledby="review-summary-title">
      <h2 id="review-summary-title">{reviewCopy.summaryTitle}</h2>
      <dl className={styles.details}>
        <dt>{reviewCopy.dataMode}</dt>
        <dd>
          <DataModeBadge mode={draft.dataMode} />
        </dd>
        <dt>{reviewCopy.language}</dt>
        <dd>{languageLabel[draft.language]}</dd>
        <dt>{reviewCopy.createdAt}</dt>
        <dd>
          <time dateTime={draft.createdAt}>{formatDateTime(draft.createdAt)}</time>
        </dd>
        <dt>{reviewCopy.carousels}</dt>
        <dd>{reviewCopy.carouselCount(draft.carousels.length)}</dd>
      </dl>
      {usesManuallyApprovedFacts(draft) ? (
        <p className={styles.attestedNote}>
          <span aria-hidden="true">✎ </span>
          {reviewCopy.attestedNote}
        </p>
      ) : null}
      {draft.standingsIncluded ? null : (
        <p className={styles.note}>
          <span aria-hidden="true">ℹ </span>
          {reviewCopy.noStandings}
        </p>
      )}
      <p className={styles.hint}>{reviewCopy.provenanceIntro}</p>
    </section>
  );
}

function LeftOutMatches({ draft }: { draft: Draft }) {
  return (
    <section aria-labelledby="review-left-out-title">
      <h2 id="review-left-out-title">{leftOutCopy.title}</h2>
      {draft.leftOutMatches.length === 0 ? (
        <p>{leftOutCopy.none}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>{leftOutCopy.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{leftOutCopy.match}</th>
                <th scope="col">{leftOutCopy.status}</th>
                <th scope="col">{leftOutCopy.reason}</th>
              </tr>
            </thead>
            <tbody>
              {draft.leftOutMatches.map((match) => (
                <tr key={match.matchKey}>
                  <th scope="row">{match.label}</th>
                  <td>{match.status === null ? leftOutCopy.unknownStatus : matchStatusLabel[match.status]}</td>
                  <td>{leftOutReasonLabel[match.reason]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectReview({ projectId }: { projectId: string }) {
  const { api } = useReviewDependencies();
  const request = useDraft(api, projectId);
  const state = request.state;

  if (state.status !== 'success') {
    return (
      <section aria-labelledby="review-title">
        <h1 id="review-title">{reviewCopy.title}</h1>
        {state.status === 'loading' ? (
          <p role="status">{reviewCopy.loading}</p>
        ) : isNoDraft(state.error) ? (
          <p role="status">{reviewCopy.noDraft}</p>
        ) : (
          <ErrorBanner title={reviewCopy.loadError} error={state.error} onRetry={request.reload} />
        )}
        <p>
          <Link to={projectPath(projectId)}>{reviewCopy.backToProject}</Link>
        </p>
      </section>
    );
  }

  const draft = state.draft;
  return (
    <article aria-labelledby="review-title" className={styles.page}>
      <p>
        <Link to={projectPath(projectId)}>{reviewCopy.backToProject}</Link>
      </p>
      <h1 id="review-title">{reviewCopy.title}</h1>
      {draft.demonstration || draft.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={request.refresh}
          disabled={request.refreshing}
        >
          {reviewCopy.refresh}
        </button>
        <p role="status" aria-live="polite" className={styles.status}>
          {request.refreshing ? reviewCopy.refreshing : ''}
        </p>
      </div>
      {request.refreshError === null ? null : (
        <ErrorBanner title={reviewCopy.refreshError} error={request.refreshError} onRetry={request.refresh} />
      )}
      <DraftSummary draft={draft} />
      {draft.carousels.length === 0 ? <p>{reviewCopy.noCarousels}</p> : null}
      {[...draft.carousels]
        .sort((a, b) => a.sequence - b.sequence)
        .map((carousel) => (
          <CarouselReview
            key={carousel.id}
            projectId={projectId}
            carousel={carousel}
            onElementChanged={request.showElement}
            onFinalApproved={request.showFinalApproval}
            onRefresh={request.refresh}
          />
        ))}
      <LeftOutMatches draft={draft} />
      <ExclusionsEditor key={draft.id} projectId={projectId} draft={draft} />
    </article>
  );
}

/** Shown for a review address whose project identifier is not a server identifier. */
export function ReviewNotFound() {
  return (
    <section aria-labelledby="review-title">
      <h1 id="review-title">{reviewCopy.title}</h1>
      <p>{reviewCopy.notFound}</p>
      <p>
        <Link to="/">{reviewCopy.backToList}</Link>
      </p>
    </section>
  );
}

/**
 * Review of the active draft of a project (R-206, R-208, R-215, R-217, R-240, R-269, R-271, R-272): demonstration
 * banner, data mode, numbered carousels with the preview of every slide, caption and hashtags in order, per-element
 * provenance, state, blocked facts, flags, QA, acknowledgement, approval, withdrawal and regeneration, the final
 * approval of each carousel, left-out matches and the exclusions editor.
 */
export function ReviewPage() {
  const { projectId } = useParams();
  if (projectId === undefined || !UUID.test(projectId)) {
    return <ReviewNotFound />;
  }
  return <ProjectReview key={projectId} projectId={projectId} />;
}
