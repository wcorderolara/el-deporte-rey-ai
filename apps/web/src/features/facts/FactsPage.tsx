import { UuidSchema, type Fact } from '@edr/contracts';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { featurePaths } from '../../app/routes';
import { appCopy, AvailabilityNote, DataModeBadge, DemoBanner, ErrorBanner, featureCopy, pageCopy } from '../../ui';
import { loadFactsView, useFactsApi, type FactsViewData } from './api';
import { factKindLabel, factsCopy, manualCopy, runKindLabel, runStatusLabel, sectionCopy } from './copy';
import { manualApprovalPageState, type ManualApprovalPageState } from './eligibility';
import { FactCard } from './FactCard';
import styles from './Facts.module.css';
import { matchLabel, teamNamesFrom, type TeamNames } from './format';
import { LeftOutMatches } from './LeftOutMatches';

/** Route component: facts of one run (`/projects/:projectId/runs/:runId/facts`). */
export function FactsPage() {
  const { projectId = '', runId = '' } = useParams();
  const valid = UuidSchema.safeParse(projectId).success && UuidSchema.safeParse(runId).success;
  return (
    <section aria-labelledby="facts-title">
      <h1 id="facts-title">{featureCopy.facts}</h1>
      <p className={styles.intro}>{factsCopy.intro}</p>
      {valid ? (
        <FactsView key={`${projectId}/${runId}`} projectId={projectId} runId={runId} />
      ) : (
        <>
          <p>{factsCopy.invalidAddress}</p>
          <p>
            <Link to={featurePaths.projectList}>{pageCopy.backToProjects}</Link>
          </p>
        </>
      )}
    </section>
  );
}

interface ViewState {
  data: FactsViewData | null;
  error: unknown;
  loading: boolean;
}

function useFactsView(projectId: string, runId: string) {
  const client = useFactsApi();
  const [state, setState] = useState<ViewState>({ data: null, error: null, loading: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadFactsView(client, projectId, runId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({ data: previous.data, error, loading: false }));
        }
      },
    );
    return () => controller.abort();
  }, [client, projectId, runId, reloadKey]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, error: null, loading: true }));
    setReloadKey((key) => key + 1);
  }, []);

  const replaceFact = useCallback((updated: Fact) => {
    setState((previous) => {
      if (previous.data === null) {
        return previous;
      }
      const facts = previous.data.facts.facts.map((fact) => (fact.factId === updated.factId ? updated : fact));
      return { ...previous, data: { ...previous.data, facts: { ...previous.data.facts, facts } } };
    });
  }, []);

  return { state, reload, replaceFact };
}

interface FactsViewProps {
  projectId: string;
  runId: string;
}

function FactsView({ projectId, runId }: FactsViewProps) {
  const { state, reload, replaceFact } = useFactsView(projectId, runId);
  const [announcement, setAnnouncement] = useState('');

  if (state.data === null) {
    return state.loading ? (
      <p role="status" aria-live="polite">
        {appCopy.loading}
      </p>
    ) : (
      <>
        <ErrorBanner error={state.error} title={factsCopy.loadErrorTitle} onRetry={reload} />
        <ProjectLinks projectId={projectId} />
      </>
    );
  }

  const { facts: list, runs } = state.data;
  const run = runs.find((item) => item.id === runId) ?? null;
  const pageState = manualApprovalPageState(list.dataMode, runId, runs);

  return (
    <>
      <div className={styles.toolbar}>
        <p>
          {factsCopy.dataMode}: <DataModeBadge mode={list.dataMode} />
        </p>
        <p>
          {run === null
            ? factsCopy.runUnknown
            : `${factsCopy.run(run.runNumber)} (${runKindLabel[run.kind]}, ${runStatusLabel[run.status]})`}
        </p>
        <button type="button" className={styles.secondaryButton} onClick={reload} disabled={state.loading}>
          {factsCopy.refresh}
        </button>
        <ProjectLinks projectId={projectId} />
      </div>
      {list.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      <p role="status" aria-live="polite" data-testid="facts-status">
        {state.loading ? appCopy.loading : announcement}
      </p>
      {state.error === null ? null : (
        <ErrorBanner error={state.error} title={factsCopy.loadErrorTitle} onRetry={reload} />
      )}
      <p className={styles.pageNote} data-testid="manual-approval-note">
        {pageNoteText(pageState)}
      </p>
      <FactSections
        list={list}
        card={{ projectId, runId, manualApproval: pageState, onUpdated: replaceFact, announce: setAnnouncement }}
      />
    </>
  );
}

function ProjectLinks({ projectId }: { projectId: string }) {
  return (
    <p>
      <Link to={`${featurePaths.projects}/${encodeURIComponent(projectId)}`}>{factsCopy.backToProject}</Link>
      {' · '}
      <Link to={featurePaths.review(projectId)}>{factsCopy.toReview}</Link>
    </p>
  );
}

function pageNoteText(pageState: ManualApprovalPageState): string {
  switch (pageState) {
    case 'available':
      return manualCopy.pageManual;
    case 'not_manual_data':
      return manualCopy.pageNotManual;
    case 'not_latest_run':
      return manualCopy.pageNotLatest;
  }
}

/** Props shared by every fact card of the page. */
interface CardContext {
  projectId: string;
  runId: string;
  manualApproval: ManualApprovalPageState;
  onUpdated: (fact: Fact) => void;
  announce: (message: string) => void;
}

function teamTitle(teamId: string | undefined, teams: TeamNames): string {
  if (teamId === undefined) {
    return '';
  }
  return teams.get(teamId) ?? teamId;
}

/** Title (and accessible label) of a fact outside the match groups. */
function factTitle(fact: Fact, teams: TeamNames): string {
  const kind = factKindLabel[fact.kind];
  switch (fact.kind) {
    case 'standing_row': {
      const value = fact.value ?? fact.candidateValue;
      const team = teamTitle(fact.subject.teamId ?? value?.teamId, teams);
      return team === '' ? kind : `${kind}: ${team}`;
    }
    case 'team_official_name': {
      const teamId = fact.subject.teamId ?? (fact.value ?? fact.candidateValue)?.teamId;
      return teamId === undefined ? kind : `${kind} (${teamId})`;
    }
    case 'context_item':
      return fact.subject.contextIndex === undefined ? kind : `${kind} ${fact.subject.contextIndex + 1}`;
    default:
      return kind;
  }
}

interface GroupedFacts {
  matches: Array<[string, Fact[]]>;
  standings: Fact[];
  context: Fact[];
  teams: Fact[];
}

function groupFacts(facts: readonly Fact[]): GroupedFacts {
  const matches = new Map<string, Fact[]>();
  const grouped: GroupedFacts = { matches: [], standings: [], context: [], teams: [] };
  for (const fact of facts) {
    const matchKey = fact.subject.matchKey;
    if (matchKey !== undefined && fact.kind.startsWith('match_')) {
      const group = matches.get(matchKey);
      if (group === undefined) {
        matches.set(matchKey, [fact]);
      } else {
        group.push(fact);
      }
    } else if (fact.kind === 'standing_row') {
      grouped.standings.push(fact);
    } else if (fact.kind === 'team_official_name') {
      grouped.teams.push(fact);
    } else {
      grouped.context.push(fact);
    }
  }
  grouped.matches = [...matches.entries()];
  return grouped;
}

interface FactSectionsProps {
  list: FactsViewData['facts'];
  card: CardContext;
}

/**
 * The run's facts by section: matches (one group per match), standings (availability note first; R-254, R-284),
 * matchday and context, teams, and the matches left out of the content with their status.
 */
function FactSections({ list, card }: FactSectionsProps) {
  const { facts } = list;
  const teams = useMemo(() => teamNamesFrom(facts), [facts]);
  const grouped = useMemo(() => groupFacts(facts), [facts]);
  const verified = facts.filter((fact) => fact.status === 'verified').length;
  const attested = facts.filter((fact) => fact.status === 'manually_approved').length;

  return (
    <>
      {facts.length === 0 ? (
        <p>{factsCopy.noFacts}</p>
      ) : (
        <p className={styles.summary} data-testid="facts-summary">
          {factsCopy.summary(facts.length, verified, facts.length - verified - attested, attested)}
        </p>
      )}
      {grouped.matches.length === 0 ? null : (
        <section className={styles.section} aria-labelledby="facts-matches-title">
          <h2 id="facts-matches-title">{sectionCopy.matches}</h2>
          {grouped.matches.map(([matchKey, group]) => (
            <MatchGroup
              key={matchKey}
              label={matchLabel(matchKey, facts, teams)}
              facts={group}
              teams={teams}
              card={card}
            />
          ))}
        </section>
      )}
      <section className={styles.section} aria-labelledby="facts-standings-title">
        <h2 id="facts-standings-title">{sectionCopy.standings}</h2>
        {list.standings.available ? (
          <p>{sectionCopy.standingsAvailable}</p>
        ) : (
          <AvailabilityNote standings={list.standings} />
        )}
        {grouped.standings.length === 0 ? (
          <p>{sectionCopy.noStandingsFacts}</p>
        ) : (
          <FactList facts={grouped.standings} teams={teams} card={card} />
        )}
      </section>
      {grouped.context.length === 0 ? null : (
        <section className={styles.section} aria-labelledby="facts-context-title">
          <h2 id="facts-context-title">{sectionCopy.context}</h2>
          <FactList facts={grouped.context} teams={teams} card={card} />
        </section>
      )}
      {grouped.teams.length === 0 ? null : (
        <section className={styles.section} aria-labelledby="facts-teams-title">
          <h2 id="facts-teams-title">{sectionCopy.teams}</h2>
          <FactList facts={grouped.teams} teams={teams} card={card} />
        </section>
      )}
      <section className={styles.section} aria-labelledby="facts-left-out-title">
        <h2 id="facts-left-out-title">{sectionCopy.leftOut}</h2>
        <LeftOutMatches matches={list.leftOutMatches} />
      </section>
    </>
  );
}

function MatchGroup({
  label,
  facts,
  teams,
  card,
}: {
  label: string;
  facts: readonly Fact[];
  teams: TeamNames;
  card: CardContext;
}) {
  const titleId = useId();
  return (
    <section className={styles.matchGroup} aria-labelledby={titleId}>
      <h3 id={titleId}>{sectionCopy.match(label)}</h3>
      <ul className={styles.factList}>
        {facts.map((fact) => (
          <FactCard
            key={fact.factId}
            fact={fact}
            title={factKindLabel[fact.kind]}
            label={`${factKindLabel[fact.kind]} · ${label}`}
            teams={teams}
            headingLevel={4}
            {...card}
          />
        ))}
      </ul>
    </section>
  );
}

function FactList({ facts, teams, card }: { facts: readonly Fact[]; teams: TeamNames; card: CardContext }) {
  return (
    <ul className={styles.factList}>
      {facts.map((fact) => (
        <FactCard
          key={fact.factId}
          fact={fact}
          label={factTitle(fact, teams)}
          teams={teams}
          headingLevel={3}
          {...card}
        />
      ))}
    </ul>
  );
}
