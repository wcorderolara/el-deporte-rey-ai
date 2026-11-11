/**
 * Core of the editorial copy (PD-ARCH-01H): the typed editorial context of a draft, its deterministic key events and
 * evidence, and the writer request. Pure: the inputs are the draft's facts (the same `FactIndex` and plan the content
 * stage uses), the round state read by the repository and the project's local sports context; no database, no I/O.
 *
 * - Matches: the matches of the draft's plan (results, or matches not played yet by content kind), each with the
 *   verification of its facts: `CONFIRMED` when every fact is verified or operator-approved, `CONFLICTING` when one is
 *   disputed, `UNVERIFIED` otherwise. Only confirmed matches reach the writer; the others are listed for the operator.
 * - Placeholders: the same bindings as the slides and the caption (selection labels, teams, scores, result relations,
 *   kickoffs, statuses, standings rows), plus the round counts as template text. Nothing else can become a number.
 * - Round state: from the local round of the project when it has one (every match of the round, by its local status;
 *   nothing inferred from dates or scores), else from the statuses of the selection's matches, else `unknown`.
 * - Key events: computed from confirmed scores and statuses only, ranked by editorial potential; at most three match
 *   events, plus the round events (incomplete round, postponed or upcoming matches).
 */
import type {
  EditorialContentKind,
  EditorialContext,
  EditorialEvent,
  EditorialEventKind,
  EditorialEvidence,
  EditorialRoundState,
  EditorialVerification,
  LeftOutMatch,
  MatchStatus,
} from '@edr/contracts';

import { type Language, formatScore, hashtagFor, templateText } from '../../platform/format/index.js';
import type {
  EditorialFact,
  EditorialKeyEvent,
  EditorialLimits,
  EditorialMatch,
  EditorialRequest,
} from '../../providers/ai/index.js';
import type { EditorialDeliverable } from '@edr/contracts';
import {
  type CheckContext,
  type ContentFact,
  type DraftContext,
  FactIndex,
  type FixturePlan,
  type MatchPlan,
  type PlaceholderBinding,
  type StandingsRowPlan,
  type TeamAlias,
  checkContextOf,
  fixtureBindings,
  labelBindings,
  matchBindings,
  planDraft,
  rowBindings,
  teamPlaceholder,
} from '../content/index.js';

/** Most match events offered to the writer ("hasta tres acontecimientos"). */
export const MAX_MATCH_EVENTS = 3;

/** The limits of the deliverables (encargo section 8), checked on the final text. */
export const EDITORIAL_LIMITS: Readonly<EditorialLimits> = Object.freeze({
  headlineMaxChars: 90,
  bodyMinWords: 100,
  bodyMaxWords: 160,
  questionMaxChars: 200,
  minHashtags: 5,
  maxHashtags: 8,
  shortCopyMaxWords: 70,
  viralHeadlineMaxChars: 100,
  youtubeTitleMaxChars: 100,
  youtubeDescriptionMaxChars: 1500,
});

/** Number words a narrative cannot avoid (editorial checks only; see `CheckContext.numberWordExemptions`). */
export const EDITORIAL_NUMBER_WORD_EXEMPTIONS: ReadonlySet<string> = new Set(['un', 'una', 'uno', 'one', 'once']);

/** Local identifiers of the project's selection (a project generated from a local competition), or null. */
export interface LocalSelection {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly roundName: string;
}

/** Local status counts of every match of the round (`competition_matches.status`). */
export interface LocalRoundCounts {
  readonly total: number;
  readonly finished: number;
  readonly inProgress: number;
  readonly scheduled: number;
  readonly postponed: number;
  readonly cancelled: number;
}

export interface EditorialInput {
  readonly projectId: string;
  readonly draft: {
    readonly id: string;
    readonly createdAt: string;
    readonly excludedMatchKeys: readonly string[];
  };
  readonly language: Language;
  readonly contentKind: EditorialContentKind;
  readonly draftContext: DraftContext;
  readonly facts: readonly ContentFact[];
  readonly teamAliases: readonly TeamAlias[];
  readonly standings: Parameters<typeof planDraft>[1]['standings'];
  readonly local: LocalSelection | null;
  readonly localRound: LocalRoundCounts | null;
  /** Name of the project's source as shown in the research panel. */
  readonly sourceName: string;
}

/** A match of the draft with its placeholders and verification. */
export interface EditorialMatchEntry {
  readonly ref: string;
  readonly matchKey: string;
  readonly played: boolean;
  readonly home: { readonly teamId: string; readonly name: string };
  readonly away: { readonly teamId: string; readonly name: string };
  readonly score: { readonly home: number; readonly away: number } | null;
  readonly status: MatchStatus;
  readonly factIds: readonly string[];
  readonly verification: EditorialVerification;
  readonly bindings: readonly PlaceholderBinding[];
}

/** Everything the module needs to request, check and show one draft's editorial copy. */
export interface EditorialCore {
  readonly context: EditorialContext;
  readonly matches: readonly EditorialMatchEntry[];
  readonly confirmed: readonly EditorialMatchEntry[];
  /** Placeholder → binding, for the confirmed context only. */
  readonly bindings: ReadonlyMap<string, PlaceholderBinding>;
  readonly keyEvents: readonly EditorialEvent[];
  readonly writerEvents: readonly EditorialKeyEvent[];
  readonly evidence: readonly EditorialEvidence[];
  readonly unverified: readonly EditorialEvidence[];
  readonly conflicts: readonly EditorialEvidence[];
  readonly standingsAvailable: boolean;
  readonly checks: CheckContext;
  readonly retrievedAt: string;
}

const CONFIRMED_STATUSES = new Set(['verified', 'manually_approved']);

function verificationOf(index: FactIndex, factIds: readonly string[]): EditorialVerification {
  let result: EditorialVerification = 'CONFIRMED';
  for (const factId of factIds) {
    const fact = index.byId(factId);
    if (fact === undefined) {
      return 'UNVERIFIED';
    }
    if (fact.status === 'unverified' && fact.unverifiedReason === 'disputed') {
      return 'CONFLICTING';
    }
    if (!CONFIRMED_STATUSES.has(fact.status)) {
      result = 'UNVERIFIED';
    }
  }
  return result;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function resultEntry(match: MatchPlan, index: FactIndex, context: DraftContext): EditorialMatchEntry {
  const factIds = unique(
    [
      match.teamsFactId,
      match.statusFactId,
      match.scoreFactId,
      match.kickoffFactId,
      match.home.factId,
      match.away.factId,
    ].filter((id): id is string => id !== null),
  );
  return {
    ref: `m${String(match.index)}`,
    matchKey: match.matchKey,
    played: true,
    home: { teamId: match.home.teamId, name: match.home.name },
    away: { teamId: match.away.teamId, name: match.away.name },
    score: match.score,
    status: 'finished',
    factIds,
    verification: verificationOf(index, factIds),
    bindings: matchBindings(match, context),
  };
}

function fixtureEntry(fixture: FixturePlan, index: FactIndex, context: DraftContext): EditorialMatchEntry {
  const factIds = unique([
    fixture.teamsFactId,
    fixture.statusFactId,
    fixture.kickoffFactId,
    fixture.home.factId,
    fixture.away.factId,
  ]);
  return {
    ref: `m${String(fixture.index)}`,
    matchKey: fixture.matchKey,
    played: false,
    home: { teamId: fixture.home.teamId, name: fixture.home.name },
    away: { teamId: fixture.away.teamId, name: fixture.away.name },
    score: null,
    status: fixture.status,
    factIds,
    verification: verificationOf(index, factIds),
    bindings: fixtureBindings(fixture, context),
  };
}

/** The round state: the local round first, else the selection's statuses, else unknown. */
export function roundStateOf(index: FactIndex, localRound: LocalRoundCounts | null): EditorialRoundState {
  if (localRound !== null && localRound.total > 0) {
    const pending = localRound.scheduled;
    return {
      status: pending + localRound.inProgress + localRound.postponed === 0 ? 'complete' : 'incomplete',
      basis: 'local_round',
      total: localRound.total,
      finished: localRound.finished,
      inProgress: localRound.inProgress,
      pending,
      postponed: localRound.postponed,
      cancelled: localRound.cancelled,
    };
  }
  const counts = { finished: 0, inProgress: 0, pending: 0, postponed: 0, cancelled: 0 };
  let total = 0;
  for (const fact of index.facts) {
    if (fact.kind !== 'match_status') {
      continue;
    }
    const value = fact.value ?? fact.candidateValue;
    if (value === null) {
      continue;
    }
    total += 1;
    switch (value.matchStatus) {
      case 'finished':
      case 'awarded':
        counts.finished += 1;
        break;
      case 'in_play':
      case 'suspended':
        counts.inProgress += 1;
        break;
      case 'postponed':
        counts.postponed += 1;
        break;
      case 'cancelled':
      case 'abandoned':
        counts.cancelled += 1;
        break;
      default:
        counts.pending += 1;
    }
  }
  if (total === 0) {
    return {
      status: 'unknown',
      basis: 'none',
      total: null,
      finished: 0,
      inProgress: 0,
      pending: 0,
      postponed: 0,
      cancelled: 0,
    };
  }
  return {
    status: counts.pending + counts.inProgress + counts.postponed === 0 ? 'complete' : 'incomplete',
    basis: 'selection',
    total,
    ...counts,
  };
}

const ROUND_TEXT: Readonly<
  Record<
    Language,
    { readonly finished: string; readonly pending: string; readonly total: string; readonly inProgress: string }
  >
> = {
  es: { finished: 'finalizados', pending: 'pendientes', total: 'partidos', inProgress: 'en curso' },
  en: { finished: 'finished', pending: 'pending', total: 'matches', inProgress: 'in progress' },
};

/** Round counts as template-text placeholders (`{{f:round:...}}`), known only when the count is. */
function roundBindings(state: EditorialRoundState): PlaceholderBinding[] {
  if (state.total === null) {
    return [];
  }
  const label = (key: string, kind: string, value: number): PlaceholderBinding => ({
    placeholder: `{{f:round:${key}}}`,
    kind,
    text: String(value),
    provenance: 'template_text',
    factId: null,
  });
  return [
    label('total', 'round_total', state.total),
    label('finished', 'round_finished', state.finished),
    label('pending', 'round_pending', state.pending + state.postponed),
    label('in_progress', 'round_in_progress', state.inProgress),
  ];
}

interface RankedEvent {
  readonly kind: EditorialEventKind;
  readonly match: EditorialMatchEntry;
  readonly weight: number;
}

/** The match event of a confirmed result, by editorial potential (higher weight first). */
function matchEvent(match: EditorialMatchEntry): RankedEvent | null {
  if (match.score === null) {
    return null;
  }
  const { home, away } = match.score;
  const difference = Math.abs(home - away);
  const goals = home + away;
  if (difference >= 3) {
    return { kind: 'thrashing', match, weight: 600 + difference * 10 + goals };
  }
  if (goals >= 5) {
    return { kind: 'high_scoring', match, weight: 500 + goals };
  }
  if (away > home) {
    return { kind: 'away_win', match, weight: 400 + goals };
  }
  if (home === 0 && away === 0) {
    return { kind: 'goalless_draw', match, weight: 300 };
  }
  if (home === away) {
    return { kind: 'scoring_draw', match, weight: 200 + goals };
  }
  return { kind: 'home_win', match, weight: 100 + goals };
}

const EVENT_LABELS: Readonly<Record<Language, Readonly<Record<EditorialEventKind, string>>>> = {
  es: {
    thrashing: 'Goleada',
    high_scoring: 'Partido de muchos goles',
    away_win: 'Victoria visitante',
    home_win: 'Victoria local',
    goalless_draw: 'Empate sin goles',
    scoring_draw: 'Empate con goles',
    round_incomplete: 'Jornada sin terminar',
    postponed_matches: 'Partidos aplazados',
    upcoming_matches: 'Partidos por jugarse',
  },
  en: {
    thrashing: 'Thrashing',
    high_scoring: 'High-scoring match',
    away_win: 'Away win',
    home_win: 'Home win',
    goalless_draw: 'Goalless draw',
    scoring_draw: 'Scoring draw',
    round_incomplete: 'Matchday not finished',
    postponed_matches: 'Postponed matches',
    upcoming_matches: 'Matches to be played',
  },
};

function matchLine(match: EditorialMatchEntry, language: Language): string {
  if (match.score !== null) {
    return `${match.home.name} ${formatScore(match.score)} ${match.away.name}`;
  }
  const status = templateText(language).matchStatus[match.status];
  return `${match.home.name} - ${match.away.name} · ${status}`;
}

function evidenceIdOf(match: EditorialMatchEntry): string {
  return `ev-${match.ref}`;
}

function truncate(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join('')}…`;
}

function eventsOf(
  confirmed: readonly EditorialMatchEntry[],
  round: EditorialRoundState,
  contentKind: EditorialContentKind,
  language: Language,
): { events: EditorialEvent[]; writer: EditorialKeyEvent[] } {
  const labels = EVENT_LABELS[language];
  const events: EditorialEvent[] = [];
  const writer: EditorialKeyEvent[] = [];
  if (contentKind === 'results') {
    const ranked = confirmed
      .map(matchEvent)
      .filter((event): event is RankedEvent => event !== null)
      .sort((a, b) => b.weight - a.weight || a.match.ref.localeCompare(b.match.ref))
      .slice(0, MAX_MATCH_EVENTS);
    for (const event of ranked) {
      const id = `evt-${event.match.ref}-${event.kind.replace(/_/g, '-')}`;
      events.push({
        id,
        kind: event.kind,
        description: truncate(`${labels[event.kind]}: ${matchLine(event.match, language)}`, 300),
        matchKey: event.match.matchKey,
        evidenceIds: [evidenceIdOf(event.match)],
      });
      writer.push({ id, kind: event.kind, matchRef: event.match.ref });
    }
  } else if (confirmed.length > 0) {
    const id = 'evt-round-upcoming';
    events.push({
      id,
      kind: 'upcoming_matches',
      description: truncate(`${labels.upcoming_matches}: ${String(confirmed.length)}`, 300),
      matchKey: null,
      evidenceIds: confirmed.map(evidenceIdOf).slice(0, 40),
    });
    writer.push({ id, kind: 'upcoming_matches', matchRef: null });
  }
  if (round.status === 'incomplete') {
    const id = 'evt-round-incomplete';
    const text = ROUND_TEXT[language];
    const detail =
      round.total === null
        ? ''
        : `: ${String(round.finished)} ${text.finished}, ${String(round.pending + round.postponed)} ${text.pending}, ` +
          `${String(round.inProgress)} ${text.inProgress} (${String(round.total)} ${text.total})`;
    events.push({
      id,
      kind: 'round_incomplete',
      description: truncate(`${labels.round_incomplete}${detail}`, 300),
      matchKey: null,
      evidenceIds: [],
    });
    writer.push({ id, kind: 'round_incomplete', matchRef: null });
  }
  if (round.postponed > 0) {
    const id = 'evt-round-postponed';
    events.push({
      id,
      kind: 'postponed_matches',
      description: truncate(`${labels.postponed_matches}: ${String(round.postponed)}`, 300),
      matchKey: null,
      evidenceIds: [],
    });
    writer.push({ id, kind: 'postponed_matches', matchRef: null });
  }
  return { events, writer };
}

const CONFLICT_TEXT: Readonly<Record<Language, string>> = {
  es: 'Las fuentes no coinciden: el dato queda sin verificar y no se usa en el copy (BR-02).',
  en: 'The sources disagree: the fact stays unverified and is not used in the copy (BR-02).',
};

function evidenceOf(match: EditorialMatchEntry, input: EditorialInput, retrievedAt: string): EditorialEvidence {
  const language = input.language;
  return {
    id: evidenceIdOf(match),
    factType: match.played ? 'match_result' : 'match_fixture',
    description: truncate(matchLine(match, language), 300),
    competitionId: input.local?.competitionId ?? null,
    seasonId: input.local?.seasonId ?? null,
    roundId: input.local?.roundId ?? null,
    matchKey: match.matchKey,
    factIds: match.factIds.slice(0, 20),
    source: { kind: 'local', name: truncate(input.sourceName, 120), url: null },
    publishedAt: null,
    retrievedAt,
    verification: match.verification,
    conflicts: match.verification === 'CONFLICTING' ? [CONFLICT_TEXT[language]] : [],
  };
}

function rowEvidence(
  row: StandingsRowPlan,
  order: number,
  index: FactIndex,
  input: EditorialInput,
  retrievedAt: string,
): EditorialEvidence {
  const verification = verificationOf(index, [row.factId, row.team.factId]);
  return {
    id: `ev-row-${String(order + 1)}`,
    factType: 'standing_row',
    description: truncate(`${String(row.value.position)}. ${row.team.name} · ${String(row.value.points)} pts`, 300),
    competitionId: input.local?.competitionId ?? null,
    seasonId: input.local?.seasonId ?? null,
    roundId: input.local?.roundId ?? null,
    matchKey: null,
    factIds: unique([row.factId, row.team.factId]),
    source: { kind: 'local', name: truncate(input.sourceName, 120), url: null },
    publishedAt: null,
    retrievedAt,
    verification,
    conflicts: verification === 'CONFLICTING' ? [CONFLICT_TEXT[input.language]] : [],
  };
}

/**
 * The matches the plan left out because a fact is not verified (a disputed fact, or no value at all): listed for the
 * operator as `CONFLICTING` or `UNVERIFIED`, never sent to the writer.
 */
function leftOutEvidence(
  leftOut: readonly LeftOutMatch[],
  index: FactIndex,
  input: EditorialInput,
  retrievedAt: string,
): EditorialEvidence[] {
  return leftOut
    .filter((match) => match.reason === 'not_verified')
    .map((match, order) => {
      const facts = index.facts.filter(
        (fact) => 'matchKey' in fact.subject && (fact.subject as { matchKey?: string }).matchKey === match.matchKey,
      );
      const disputed = facts.some((fact) => fact.status === 'unverified' && fact.unverifiedReason === 'disputed');
      return {
        id: `ev-out-${String(order + 1)}`,
        factType: input.contentKind === 'results' ? 'match_result' : 'match_fixture',
        description: truncate(match.label === '' ? match.matchKey : match.label, 300),
        competitionId: input.local?.competitionId ?? null,
        seasonId: input.local?.seasonId ?? null,
        roundId: input.local?.roundId ?? null,
        matchKey: match.matchKey,
        factIds: facts.map((fact) => fact.id).slice(0, 20),
        source: { kind: 'local', name: truncate(input.sourceName, 120), url: null },
        publishedAt: null,
        retrievedAt,
        verification: disputed ? 'CONFLICTING' : 'UNVERIFIED',
        conflicts: disputed ? [CONFLICT_TEXT[input.language]] : [],
      } satisfies EditorialEvidence;
    });
}

/** Builds the editorial core of a draft. */
export function buildEditorialCore(input: EditorialInput): EditorialCore {
  const index = new FactIndex(input.facts);
  const plan = planDraft(index, {
    contentKind: input.contentKind,
    standings: input.standings,
    excludedMatchKeys: input.draft.excludedMatchKeys,
    maxSlidesPerCarousel: 100,
    standingsRowsPerSlide: 100,
  });
  const context = input.draftContext;
  const matches: EditorialMatchEntry[] = [];
  const rows: StandingsRowPlan[] = [];
  const seen = new Set<string>();
  for (const carousel of plan.carousels) {
    for (const slide of carousel.slides) {
      const entry =
        slide.type === 'match_result'
          ? resultEntry(slide.match, index, context)
          : slide.type === 'fixture' || slide.type === 'match_preview'
            ? fixtureEntry(slide.fixture, index, context)
            : null;
      if (entry !== null && !seen.has(entry.ref)) {
        seen.add(entry.ref);
        matches.push(entry);
      }
      if (slide.type === 'standings') {
        rows.push(...slide.rows);
      }
    }
  }
  const confirmed = matches.filter((match) => match.verification === 'CONFIRMED');
  const round = roundStateOf(index, input.localRound);
  const retrievedAt = input.draft.createdAt;

  const evidenceRows = rows.map((row, order) => ({
    row,
    evidence: rowEvidence(row, order, index, input, retrievedAt),
  }));
  const confirmedRows = evidenceRows.filter((entry) => entry.evidence.verification === 'CONFIRMED');
  const standingsAvailable = plan.standingsIncluded && rows.length > 0 && confirmedRows.length === rows.length;

  const bindings = new Map<string, PlaceholderBinding>();
  const add = (binding: PlaceholderBinding): void => {
    if (!bindings.has(binding.placeholder)) {
      bindings.set(binding.placeholder, binding);
    }
  };
  labelBindings(context).forEach(add);
  confirmed.forEach((match) => match.bindings.forEach(add));
  if (standingsAvailable) {
    confirmedRows.forEach((entry) => rowBindings(entry.row).forEach(add));
  }
  roundBindings(round).forEach(add);

  const { events, writer } = eventsOf(confirmed, round, input.contentKind, input.language);
  const all = [
    ...matches.map((match) => evidenceOf(match, input, retrievedAt)),
    ...leftOutEvidence(plan.leftOutMatches, index, input, retrievedAt),
    ...evidenceRows.map((entry) => entry.evidence),
  ];
  const checks = checkContextOf(index, input.teamAliases, context.brand.handle, input.contentKind);
  return {
    context: {
      competitionName: truncate(context.competitionName, 80),
      seasonLabel: truncate(context.seasonLabel, 80),
      stageLabel: truncate(bindings.get('{{f:stage}}')?.text ?? context.stageLabel, 120),
      roundLabel: input.local === null ? null : truncate(input.local.roundName, 120),
      contentKind: input.contentKind,
      language: input.language,
      matchCount: matches.length,
      confirmedMatchCount: confirmed.length,
      standingsAvailable,
      roundState: round,
    },
    matches,
    confirmed,
    bindings,
    keyEvents: events,
    writerEvents: writer,
    evidence: all.filter((item) => item.verification === 'CONFIRMED'),
    unverified: all.filter((item) => item.verification === 'UNVERIFIED'),
    conflicts: all.filter((item) => item.verification === 'CONFLICTING'),
    standingsAvailable,
    checks: { ...checks, numberWordExemptions: EDITORIAL_NUMBER_WORD_EXEMPTIONS },
    retrievedAt,
  };
}

function writerMatch(match: EditorialMatchEntry): EditorialMatch {
  return {
    ref: match.ref,
    home: teamPlaceholder(match.home.teamId),
    away: teamPlaceholder(match.away.teamId),
    played: match.played,
    score: match.played ? `{{f:${match.ref}:score}}` : null,
    result: match.played ? `{{f:${match.ref}:result}}` : null,
    kickoff: match.bindings.some((binding) => binding.placeholder === `{{f:${match.ref}:kickoff}}`)
      ? `{{f:${match.ref}:kickoff}}`
      : null,
    status: match.played ? null : `{{f:${match.ref}:status}}`,
  };
}

/** The writer request of a core for some deliverables, with the operator's instruction as a preference. */
export function buildEditorialRequest(
  core: EditorialCore,
  input: Pick<EditorialInput, 'language' | 'contentKind' | 'draftContext'>,
  deliverables: readonly EditorialDeliverable[],
  instructions: string | null,
): EditorialRequest {
  const facts: EditorialFact[] = [...core.bindings.values()].map((binding) => ({
    placeholder: binding.placeholder,
    kind: binding.kind,
    display: binding.text,
  }));
  const round = core.context.roundState;
  const known = (placeholder: string): string | null => (core.bindings.has(placeholder) ? placeholder : null);
  const teams = new Map<string, string>();
  for (const match of core.confirmed) {
    for (const team of [match.home, match.away]) {
      const hashtag = hashtagFor(team.name);
      if (hashtag !== null && /^#[\p{L}\p{M}\p{N}_]{1,60}$/u.test(hashtag)) {
        teams.set(teamPlaceholder(team.teamId), hashtag);
      }
    }
  }
  return {
    language: input.language,
    brand: { name: input.draftContext.brand.name, handle: input.draftContext.brand.handle },
    contentKind: input.contentKind,
    deliverables: [...deliverables],
    selection: { competition: '{{f:competition}}', stage: '{{f:stage}}', season: '{{f:season}}' },
    facts,
    matches: core.confirmed.map(writerMatch),
    round: {
      status: round.status,
      total: known('{{f:round:total}}'),
      finished: known('{{f:round:finished}}'),
      pending: known('{{f:round:pending}}'),
      inProgress: known('{{f:round:in_progress}}'),
    },
    standingsAvailable: core.standingsAvailable,
    keyEvents: [...core.writerEvents],
    evidence: core.evidence
      .filter((item) => item.factType !== 'standing_row' || core.standingsAvailable)
      .map((item) => ({
        id: item.id,
        verification: 'CONFIRMED' as const,
        matchRef: item.id.startsWith('ev-m') ? item.id.slice(3) : null,
      })),
    teamHashtags: [...teams.entries()].map(([team, hashtag]) => ({ team, hashtag })),
    research: { mode: 'local_context' },
    operatorInstructions: instructions,
    limits: { ...EDITORIAL_LIMITS },
  };
}
