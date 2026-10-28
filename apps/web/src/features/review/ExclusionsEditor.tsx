import type { Draft, FactListResponse, Run } from '@edr/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { featurePaths } from '../../app/routes';
import { ErrorBanner } from '../../ui';
import { exclusionsCopy } from './copy';
import styles from './Review.module.css';
import { useReviewDependencies } from './ReviewContext';

/** Contract limit of setExcludedMatches (`excludedMatchKeys` maxItems). */
export const MAX_EXCLUDED_MATCHES = 64;

export interface MatchChoice {
  matchKey: string;
  label: string;
}

/**
 * Matches the operator can exclude or include again: every match of the facts run (named by its `match_teams`
 * fact), except those left out for another reason (not finished, no usable value), plus every match already
 * excluded. Labels come from the fact's display form or the left-out entry; the match key is the last resort.
 */
export function matchChoices(draft: Draft, facts: FactListResponse): MatchChoice[] {
  const leftOutOther = new Set(
    draft.leftOutMatches.filter((match) => match.reason !== 'excluded_by_operator').map((match) => match.matchKey),
  );
  const leftOutLabels = new Map(draft.leftOutMatches.map((match) => [match.matchKey, match.label]));
  const choices = new Map<string, string>();
  for (const fact of facts.facts) {
    const key = fact.subject.matchKey;
    if (fact.kind !== 'match_teams' || key === undefined || leftOutOther.has(key) || choices.has(key)) {
      continue;
    }
    choices.set(key, fact.display ?? leftOutLabels.get(key) ?? key);
  }
  for (const key of draft.excludedMatchKeys) {
    if (!choices.has(key)) {
      choices.set(key, leftOutLabels.get(key) ?? key);
    }
  }
  return [...choices].map(([matchKey, label]) => ({ matchKey, label }));
}

type FactsState =
  { status: 'loading' } | { status: 'success'; data: FactListResponse } | { status: 'error'; error: unknown };

function ExclusionsForm({ projectId, draft }: { projectId: string; draft: Draft }) {
  const { api } = useReviewDependencies();
  const [attempt, setAttempt] = useState(0);
  const [facts, setFacts] = useState<{ attempt: number; state: FactsState } | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(draft.excludedMatchKeys));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [started, setStarted] = useState<Run | null>(null);
  const legendId = useId();

  useEffect(() => {
    const controller = new AbortController();
    api.listFacts(projectId, draft.factsRunId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setFacts({ attempt, state: { status: 'success', data } });
        }
      },
      (caught: unknown) => {
        if (!controller.signal.aborted) {
          setFacts({ attempt, state: { status: 'error', error: caught } });
        }
      },
    );
    return () => controller.abort();
  }, [api, projectId, draft.factsRunId, attempt]);

  const state: FactsState = facts !== null && facts.attempt === attempt ? facts.state : { status: 'loading' };

  if (state.status === 'loading') {
    return <p role="status">{exclusionsCopy.loading}</p>;
  }
  if (state.status === 'error') {
    return (
      <ErrorBanner
        title={exclusionsCopy.loadError}
        error={state.error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const choices = matchChoices(draft, state.data);
  const current = new Set(draft.excludedMatchKeys);
  const unchanged = selected.size === current.size && [...selected].every((key) => current.has(key));
  const tooMany = selected.size > MAX_EXCLUDED_MATCHES;

  function toggle(matchKey: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(matchKey);
      } else {
        next.delete(matchKey);
      }
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || unchanged || tooMany) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Keep the order of the choices, so the request does not depend on the order of the clicks.
      const keys = choices.map((choice) => choice.matchKey).filter((key) => selected.has(key));
      setStarted(await api.setExcludedMatches(projectId, keys));
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (started !== null) {
    return (
      <div role="status">
        <p>{exclusionsCopy.started(started.runNumber)}</p>
        <p>
          <Link to={`${featurePaths.projects}/${encodeURIComponent(projectId)}`}>{exclusionsCopy.followRun}</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <p className={styles.hint}>{exclusionsCopy.intro}</p>
      {choices.length === 0 ? (
        <p>{exclusionsCopy.empty}</p>
      ) : (
        <fieldset className={styles.fieldset} aria-describedby={legendId}>
          <legend>{exclusionsCopy.legend}</legend>
          <ul className={styles.choiceList}>
            {choices.map((choice) => {
              const id = `${legendId}-${choice.matchKey}`;
              return (
                <li key={choice.matchKey} className={styles.choice}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.has(choice.matchKey)}
                    onChange={(event) => toggle(choice.matchKey, event.target.checked)}
                  />
                  <label htmlFor={id}>{exclusionsCopy.exclude(choice.label)}</label>
                </li>
              );
            })}
          </ul>
          <p id={legendId} className={styles.hint} aria-live="polite">
            {exclusionsCopy.count(selected.size)}
          </p>
        </fieldset>
      )}
      {tooMany ? (
        <p className={styles.fieldError} role="alert">
          {exclusionsCopy.tooMany(MAX_EXCLUDED_MATCHES)}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton} disabled={saving || unchanged || tooMany}>
          {saving ? exclusionsCopy.submitting : exclusionsCopy.submit}
        </button>
      </div>
      {unchanged ? <p className={styles.hint}>{exclusionsCopy.unchanged}</p> : null}
      {error === null ? null : <ErrorBanner title={exclusionsCopy.submitError} error={error} />}
    </form>
  );
}

/**
 * Exclusions editor (OD-03): the operator leaves matches out of the content or includes them again. Saving starts a
 * redraft run (setExcludedMatches); the active draft is superseded and approvals do not carry over (R-406). The
 * match list is loaded only when the editor is opened.
 */
export function ExclusionsEditor({ projectId, draft }: { projectId: string; draft: Draft }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      <h2 id={titleId}>{exclusionsCopy.title}</h2>
      <p>{exclusionsCopy.count(draft.excludedMatchKeys.length)}</p>
      <button
        type="button"
        className={styles.secondaryButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? exclusionsCopy.close : exclusionsCopy.open}
      </button>
      <div id={panelId} hidden={!open}>
        {open ? <ExclusionsForm projectId={projectId} draft={draft} /> : null}
      </div>
    </section>
  );
}
