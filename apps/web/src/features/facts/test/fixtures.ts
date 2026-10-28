/**
 * Synthetic contract data and a fake fetch for the facts view tests. Every value is invented (SC-04); no network is
 * used. The fixtures are checked against the `@edr/contracts` schemas by the tests, so they stay contract-shaped.
 */
import type {
  DataMode,
  Evidence,
  Fact,
  FactListResponse,
  LeftOutMatch,
  RunListResponse,
  StandingsAvailability,
} from '@edr/contracts';
import { vi } from 'vitest';

import type { FetchFunction } from '../../../api/client';

type Run = RunListResponse['runs'][number];

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const RUN_ID = '22222222-2222-4222-8222-222222222222';
export const NEWER_RUN_ID = '33333333-3333-4333-8333-333333333333';
export const IMPORT_VERSION_ID = '44444444-4444-4444-8444-444444444444';

export const FACTS_URL = `/api/v1/projects/${PROJECT_ID}/runs/${RUN_ID}/facts`;
export const RUNS_URL = `/api/v1/projects/${PROJECT_ID}/runs`;
export const manualApprovalUrl = (factId: string): string => `${FACTS_URL}/${factId}/manual-approval`;

export const RETRIEVED_AT = '2026-10-25T18:30:00Z';

/** Lowercase UUID of a fixture fact, numbered. */
export function factId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export const HOSTILE_REFERENCES = [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'https://example.invalid/v4/matches/1',
] as const;

export function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    sourceId: 'demo-a',
    sourceName: 'Fuente de demostración A',
    dataMode: 'DEMO_DATA',
    role: 'primary',
    accepted: true,
    officialPublication: false,
    relation: 'supports',
    value: { home: 2, away: 1 },
    sourceRef: 'fixture:escenario-a/partidos.json',
    retrievedAt: RETRIEVED_AT,
    importVersionId: null,
    ...overrides,
  };
}

/** Manual import observation: never an accepted source (R-071). */
export function manualEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return evidence({
    sourceId: 'manual-liga',
    sourceName: 'Importación manual',
    dataMode: 'MANUAL_DATA',
    accepted: false,
    relation: 'supports',
    sourceRef: `import:${IMPORT_VERSION_ID}/v1`,
    importVersionId: IMPORT_VERSION_ID,
    ...overrides,
  });
}

interface FactBase {
  n: number;
  status?: Fact['status'];
  unverifiedReason?: Fact['unverifiedReason'];
  reason?: string | null;
  display?: string | null;
  blockReason?: Fact['blockReason'];
  evidence?: Evidence[];
  dispute?: Fact['dispute'];
  manualApproval?: Fact['manualApproval'];
  /** Set to null for an unverified fact without a candidate value. */
  candidate?: null;
}

function base(input: FactBase) {
  const status = input.status ?? 'verified';
  return {
    factId: factId(input.n),
    status,
    unverifiedReason: input.unverifiedReason ?? null,
    reason: input.reason ?? null,
    display: input.display === undefined ? null : input.display,
    ...(input.blockReason === undefined ? {} : { blockReason: input.blockReason }),
    evidence: input.evidence ?? [evidence(), evidence({ sourceId: 'demo-b', sourceName: 'Fuente de demostración B' })],
    dispute: input.dispute ?? null,
    manualApproval: input.manualApproval ?? null,
  };
}

/** Value goes to `value` when verified and to `candidateValue` otherwise (unless `candidate` is set explicitly). */
function values<V>(status: Fact['status'], value: V | null, candidate?: V | null) {
  if (status === 'verified') {
    return { value, candidateValue: null };
  }
  return { value: null, candidateValue: candidate === undefined ? value : candidate };
}

export function scoreFact(input: FactBase & { matchKey: string; score?: { home: number; away: number } | null }): Fact {
  const b = base(input);
  const score = input.score === undefined ? { home: 2, away: 1 } : input.score;
  return {
    ...b,
    factKey: `match:${input.matchKey}:score`,
    kind: 'match_score',
    subject: { matchKey: input.matchKey },
    ...values(b.status, score, input.candidate),
  };
}

export function teamsFact(input: FactBase & { matchKey: string; home: string; away: string }): Fact {
  const b = base(input);
  return {
    ...b,
    factKey: `match:${input.matchKey}:teams`,
    kind: 'match_teams',
    subject: { matchKey: input.matchKey },
    ...values(b.status, { homeTeamId: input.home, awayTeamId: input.away }, input.candidate),
  };
}

export function kickoffFact(input: FactBase & { matchKey: string; kickoff: string }): Fact {
  const b = base(input);
  return {
    ...b,
    factKey: `match:${input.matchKey}:kickoff`,
    kind: 'match_kickoff',
    subject: { matchKey: input.matchKey },
    ...values(b.status, { kickoff: input.kickoff }, input.candidate),
  };
}

export function teamNameFact(input: FactBase & { teamId: string; officialName: string }): Fact {
  const b = base(input);
  return {
    ...b,
    factKey: `team:${input.teamId}:name`,
    kind: 'team_official_name',
    subject: { teamId: input.teamId },
    ...values(b.status, { teamId: input.teamId, officialName: input.officialName }, input.candidate),
  };
}

export function standingFact(input: FactBase & { teamId: string; position: number }): Fact {
  const b = base(input);
  return {
    ...b,
    factKey: `standings:row:${input.teamId}`,
    kind: 'standing_row',
    subject: { teamId: input.teamId },
    ...values(
      b.status,
      {
        position: input.position,
        teamId: input.teamId,
        played: 10,
        won: 7,
        drawn: 2,
        lost: 1,
        goalsFor: 20,
        goalsAgainst: 8,
        goalDifference: 12,
        points: 23,
      },
      input.candidate,
    ),
  };
}

export function contextFact(input: FactBase & { index: number; count: number }): Fact {
  const b = base(input);
  return {
    ...b,
    factKey: `context:matches_in_selection:${input.index}`,
    kind: 'context_item',
    subject: { contextIndex: input.index },
    ...values(b.status, { type: 'matches_in_selection' as const, count: input.count }, input.candidate),
  };
}

export function run(overrides: Partial<Run> = {}): Run {
  return {
    id: RUN_ID,
    projectId: PROJECT_ID,
    runNumber: 1,
    kind: 'full',
    status: 'completed',
    startedAt: '2026-10-25T18:00:00Z',
    finishedAt: '2026-10-25T18:35:00Z',
    failure: null,
    stages: [],
    ...overrides,
  };
}

export function factList(
  dataMode: DataMode,
  facts: Fact[],
  options: { leftOutMatches?: LeftOutMatch[]; standings?: StandingsAvailability } = {},
): FactListResponse {
  return {
    dataMode,
    facts,
    leftOutMatches: options.leftOutMatches ?? [],
    standings: options.standings ?? { available: true, reason: null },
  };
}

// -------------------------------------------------------------------------------------------------------------
// Data sets
// -------------------------------------------------------------------------------------------------------------

const DISPUTE: NonNullable<Fact['dispute']> = {
  sourceValues: [
    { sourceId: 'demo-a', independenceGroup: 'grupo-a', value: { home: 2, away: 1 } },
    { sourceId: 'demo-b', independenceGroup: 'grupo-b', value: { home: 3, away: 1 } },
  ],
  consultedSourceId: 'demo-oficial',
  consultedAt: '2026-10-25T18:40:00Z',
  outcome: 'no_match',
  resolvedValue: null,
};

/** DEMO_DATA run with every status and unverified reason, a dispute, hostile references and left-out matches. */
export function demoFacts(): FactListResponse {
  return factList(
    'DEMO_DATA',
    [
      teamsFact({ n: 1, matchKey: 'm1', home: 'equipo-a', away: 'equipo-b', display: 'Equipo A - Equipo B' }),
      scoreFact({ n: 2, matchKey: 'm1', display: '2-1' }),
      kickoffFact({
        n: 3,
        matchKey: 'm1',
        kickoff: '2026-10-24T20:00:00Z',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        reason: 'Awaiting independent verification; single source: demo-a.',
        display: '24 oct 2026, 20:00',
        evidence: [evidence({ value: { kickoff: '2026-10-24T20:00:00Z' } })],
      }),
      scoreFact({
        n: 4,
        matchKey: 'm2',
        status: 'unverified',
        unverifiedReason: 'disputed',
        reason:
          'Disputed: accepted sources disagree (demo-a, demo-b); the official publication (demo-oficial) is independent and does not settle it.',
        score: null,
        evidence: [
          evidence({ relation: 'disagrees' }),
          evidence({
            sourceId: 'demo-b',
            sourceName: 'Fuente de demostración B',
            relation: 'disagrees',
            value: { home: 3, away: 1 },
          }),
          evidence({
            sourceId: 'demo-oficial',
            sourceName: 'Publicación oficial de demostración',
            role: 'verification',
            officialPublication: true,
            relation: 'consulted',
            value: { home: 4, away: 1 },
          }),
        ],
        dispute: DISPUTE,
      }),
      teamsFact({
        n: 5,
        matchKey: 'm3',
        home: 'equipo-c',
        away: 'equipo-d',
        status: 'unverified',
        unverifiedReason: 'team_identity_unmatched',
        display: 'Equipo C - Equipo D',
        evidence: [evidence({ value: { homeTeamId: 'equipo-c', awayTeamId: 'equipo-d' } })],
      }),
      contextFact({
        n: 6,
        index: 0,
        count: 3,
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        candidate: null,
        evidence: [],
      }),
      teamNameFact({
        n: 7,
        teamId: 'equipo-a',
        officialName: 'Equipo A',
        evidence: HOSTILE_REFERENCES.map((sourceRef, index) =>
          evidence({
            sourceId: `demo-${String.fromCharCode(99 + index)}`,
            sourceName: `Fuente hostil ${index + 1}`,
            sourceRef,
            value: { teamId: 'equipo-a', officialName: 'Equipo A' },
          }),
        ),
      }),
      standingFact({ n: 8, teamId: 'equipo-a', position: 1 }),
    ],
    {
      leftOutMatches: [
        { matchKey: 'm4', label: 'Equipo E - Equipo F', status: 'postponed', reason: 'not_finished' },
        { matchKey: 'm5', label: 'Equipo G - Equipo H', status: 'suspended', reason: 'not_finished' },
        { matchKey: 'm6', label: 'Equipo I - Equipo J', status: 'cancelled', reason: 'not_finished' },
        { matchKey: 'm7', label: 'Equipo K - Equipo L', status: 'awarded', reason: 'not_finished' },
        { matchKey: 'm2', label: 'Equipo M - Equipo N', status: 'finished', reason: 'not_verified' },
        { matchKey: 'm8', label: 'Equipo O - Equipo P', status: null, reason: 'excluded_by_operator' },
      ],
    },
  );
}

/** Fact numbers of the MANUAL_DATA data set. */
export const MANUAL = {
  eligibleNoSource: 11,
  eligibleAwaiting: 12,
  disputed: 13,
  unmatched: 14,
  acceptedDisagrees: 15,
  verified: 16,
  noCandidate: 17,
  attestedBlocked: 18,
  attestedPublishable: 19,
} as const;

/** MANUAL_DATA run: eligible and ineligible facts and manually approved facts in both PD-17 states. */
export function manualFacts(): FactListResponse {
  const accepted = evidence({ sourceId: 'demo-b', sourceName: 'Fuente aceptada B' });
  return factList(
    'MANUAL_DATA',
    [
      scoreFact({
        n: MANUAL.eligibleNoSource,
        matchKey: 'm1',
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        display: '2-1',
        evidence: [manualEvidence()],
      }),
      kickoffFact({
        n: MANUAL.eligibleAwaiting,
        matchKey: 'm1',
        kickoff: '2026-10-24T20:00:00Z',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        display: '24 oct 2026, 20:00',
        evidence: [
          manualEvidence({ value: { kickoff: '2026-10-24T20:00:00Z' } }),
          { ...accepted, value: { kickoff: '2026-10-24T20:00:00Z' } },
        ],
      }),
      scoreFact({
        n: MANUAL.disputed,
        matchKey: 'm2',
        status: 'unverified',
        unverifiedReason: 'disputed',
        score: null,
        evidence: [manualEvidence()],
        dispute: DISPUTE,
      }),
      teamsFact({
        n: MANUAL.unmatched,
        matchKey: 'm3',
        home: 'equipo-c',
        away: 'equipo-d',
        status: 'unverified',
        unverifiedReason: 'team_identity_unmatched',
        evidence: [manualEvidence({ value: { homeTeamId: 'equipo-c', awayTeamId: 'equipo-d' } })],
      }),
      scoreFact({
        n: MANUAL.acceptedDisagrees,
        matchKey: 'm4',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        display: '1-0',
        score: { home: 1, away: 0 },
        evidence: [
          manualEvidence({ value: { home: 1, away: 0 } }),
          { ...accepted, relation: 'disagrees', value: { home: 0, away: 0 } },
        ],
      }),
      scoreFact({ n: MANUAL.verified, matchKey: 'm5', display: '0-0', score: { home: 0, away: 0 } }),
      scoreFact({
        n: MANUAL.noCandidate,
        matchKey: 'm6',
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        score: null,
        evidence: [],
      }),
      scoreFact({
        n: MANUAL.attestedBlocked,
        matchKey: 'm7',
        status: 'manually_approved',
        display: '3-2',
        score: { home: 3, away: 2 },
        blockReason: 'manually_approved_not_publishable',
        evidence: [manualEvidence({ value: { home: 3, away: 2 } })],
        manualApproval: { approvedAt: '2026-10-25T19:00:00Z', carriedOverFromFactId: null },
      }),
      scoreFact({
        n: MANUAL.attestedPublishable,
        matchKey: 'm8',
        status: 'manually_approved',
        display: '1-1',
        score: { home: 1, away: 1 },
        evidence: [manualEvidence({ value: { home: 1, away: 1 } })],
        manualApproval: { approvedAt: '2026-10-25T19:05:00Z', carriedOverFromFactId: factId(99) },
      }),
    ],
    { standings: { available: false, reason: 'not_provided_for_stage' } },
  );
}

/** LIVE_DATA run: both republishing-permission states (PD-18, R-078) and a single-source fact (R-271). */
export function liveFacts(): FactListResponse {
  const live = (overrides: Partial<Evidence> = {}) =>
    evidence({
      sourceId: 'live-a',
      sourceName: 'Proveedor en vivo A',
      dataMode: 'LIVE_DATA',
      sourceRef: 'source:live-a/matches@2026-10-25T18:30:00Z',
      ...overrides,
    });
  const verification = live({ sourceId: 'live-b', sourceName: 'Proveedor en vivo B', role: 'verification' });
  return factList(
    'LIVE_DATA',
    [
      scoreFact({
        n: 21,
        matchKey: 'm1',
        display: '2-1',
        blockReason: 'publication_permission_unconfirmed',
        evidence: [live(), verification],
      }),
      scoreFact({
        n: 22,
        matchKey: 'm2',
        display: '0-1',
        score: { home: 0, away: 1 },
        evidence: [live(), verification],
      }),
      scoreFact({
        n: 23,
        matchKey: 'm3',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        reason: 'Awaiting independent verification; single source: live-a.',
        display: '1-1',
        score: { home: 1, away: 1 },
        blockReason: 'not_verified',
        evidence: [live()],
      }),
    ],
    { standings: { available: false, reason: 'not_available_with_subscription' } },
  );
}

// -------------------------------------------------------------------------------------------------------------
// Fake fetch
// -------------------------------------------------------------------------------------------------------------

export interface RecordedCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: code, status, code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** What the fake server answers: a response, a function building one, or an error thrown as a failed connection. */
export type Reply = Response | Error | (() => Response);

/**
 * Fake fetch keyed by `METHOD url`. Each key holds a queue of replies; the last reply of a queue is repeated. Every
 * call is recorded. An unknown key fails the request as a refused connection would.
 */
export function fakeServer(routes: Record<string, Reply | Reply[]>) {
  const queues = new Map<string, Reply[]>(
    Object.entries(routes).map(([key, reply]) => [key, Array.isArray(reply) ? [...reply] : [reply]]),
  );
  const calls: RecordedCall[] = [];
  const fetch = vi.fn<FetchFunction>(async (url, init) => {
    const method = init.method ?? 'GET';
    calls.push({
      method,
      url,
      headers: { ...(init.headers as Record<string, string>) },
      body: init.body,
    });
    const queue = queues.get(`${method} ${url}`);
    if (queue === undefined || queue.length === 0) {
      throw new TypeError(`unexpected request ${method} ${url}`);
    }
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (reply instanceof Error) {
      throw reply;
    }
    if (typeof reply === 'function') {
      return reply();
    }
    // A Response body can be read once: answer with a copy so that a repeated reply still works.
    return (reply as Response).clone();
  });
  return { fetch, calls };
}
