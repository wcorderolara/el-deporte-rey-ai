/**
 * Test support of the review feature: a fake fetch that answers by method and path (no network, R-241), synthetic
 * contract-shaped fixtures (no real competition, provider, team or person), and a renderer that mounts the
 * application's route table with the feature's API built on the real client over the fake fetch.
 */
import {
  DraftSchema,
  ElementSchema,
  type Carousel,
  type DataMode,
  type Draft,
  type Element,
  type ElementVersion,
  type FactListResponse,
  type FactRef,
  type QaResult,
  type Run,
  type TextField,
} from '@edr/contracts';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { createApiClient, type FetchFunction } from '../../../api/client';
import { appRoutes } from '../../../app/routes';
import { createReviewApi } from '../api';
import { ReviewProvider } from '../ReviewContext';

export interface RecordedCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export type Handler = (call: RecordedCall) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function problem(body: Record<string, unknown>): Response {
  const status = Number(body.status);
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Problem', ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/** Answers each request from `routes` (`"GET /api/v1/..."`); an unknown request fails as a network error. */
export function fakeServer(routes: Record<string, Handler | Handler[]>) {
  const calls: RecordedCall[] = [];
  const unexpected: string[] = [];
  const counters = new Map<string, number>();
  const fetch = vi.fn<FetchFunction>(async (url, init) => {
    const method = init.method ?? 'GET';
    const call: RecordedCall = {
      method,
      path: url,
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const key = `${method} ${url}`;
    const entry = routes[key];
    if (entry === undefined) {
      unexpected.push(key);
      throw new TypeError('fake network failure');
    }
    // A list of handlers answers successive calls in order; the last one answers every later call.
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    const handler = Array.isArray(entry) ? entry[Math.min(index, entry.length - 1)] : entry;
    if (handler === undefined) {
      throw new TypeError('empty handler list');
    }
    return handler(call);
  });
  return {
    fetch,
    calls,
    unexpected,
    callsTo: (method: string, path: string) => calls.filter((call) => call.method === method && call.path === path),
  };
}

export type FakeServer = ReturnType<typeof fakeServer>;

/** Mounts the application routes at `path` with the review API over the fake server. */
export function renderApp(path: string, server: FakeServer) {
  const api = createReviewApi(createApiClient({ fetch: server.fetch }));
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <ReviewProvider value={{ api }}>
      <RouterProvider router={router} />
    </ReviewProvider>,
  );
  return router;
}

// ---------------------------------------------------------------------------------------------------------------
// Synthetic identifiers
// ---------------------------------------------------------------------------------------------------------------

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const FACTS_RUN_ID = '44444444-4444-4444-8444-444444444444';
export const REDRAFT_RUN_ID = '55555555-5555-4555-8555-555555555555';
export const CAROUSEL_ID = 'c0000000-0000-4000-8000-000000000001';
export const CAROUSEL_2_ID = 'c0000000-0000-4000-8000-000000000002';

/** Deterministic UUID for element `n` (`e...`), version `n` (`v...` as hex `a`), fact `n` (`f...`). */
export function elementId(n: number): string {
  return `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
export function versionId(n: number): string {
  return `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
export function factId(n: number): string {
  return `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const API = '/api/v1';
export const DRAFT_PATH = `GET ${API}/projects/${PROJECT_ID}/draft`;

export function elementPath(carouselId: string, element: string, suffix: string): string {
  return `${API}/carousels/${carouselId}/elements/${element}/${suffix}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------------------------------------------

export const PASSING_QA: QaResult[] = [
  { check: 'data_match', outcome: 'pass', severity: 'blocking', details: { mismatches: [] }, acknowledgedAt: null },
  { check: 'team_names', outcome: 'pass', severity: 'blocking', details: { mismatches: [] }, acknowledgedAt: null },
  {
    check: 'text_fit',
    outcome: 'pass',
    severity: 'blocking',
    details: { overflowingElements: [] },
    acknowledgedAt: null,
  },
  {
    check: 'style_consistency',
    outcome: 'pass',
    severity: 'warning',
    details: { colorsOutsidePalette: [], fontsOutsideSet: [], templateVersions: ['match-result@1'] },
    acknowledgedAt: null,
  },
  {
    check: 'dimensions',
    outcome: 'pass',
    severity: 'blocking',
    details: { expectedWidth: 1080, expectedHeight: 1350, actualWidth: 1080, actualHeight: 1350 },
    acknowledgedAt: null,
  },
  { check: 'capitalized_tokens', outcome: 'pass', severity: 'warning', details: { tokens: [] }, acknowledgedAt: null },
];

export function commentary(text: string): TextField['segments'][number] {
  return { provenance: 'commentary', text, factId: null, factStatus: null };
}

export function template(text: string): TextField['segments'][number] {
  return { provenance: 'template_text', text, factId: null, factStatus: null };
}

export function factSegment(
  text: string,
  id: string,
  status: TextField['segments'][number]['factStatus'] = 'verified',
): TextField['segments'][number] {
  return { provenance: 'fact', text, factId: id, factStatus: status };
}

export function blockingFact(overrides: Partial<FactRef> & Pick<FactRef, 'factId'>): FactRef {
  return {
    factKey: 'match:demo-1:score',
    kind: 'match_score',
    status: 'unverified',
    unverifiedReason: 'awaiting_independent_verification',
    reason: null,
    display: '2-1',
    blockReason: 'not_verified',
    ...overrides,
  };
}

export function version(n: number, overrides: Partial<ElementVersion> = {}): ElementVersion {
  return {
    id: versionId(n),
    versionNumber: 1,
    createdAt: '2026-10-27T12:00:00Z',
    state: 'ready',
    blocked: false,
    blockingFacts: [],
    contentFlags: [],
    qa: PASSING_QA,
    fields: [{ field: 'headline', segments: [commentary(`Titular de la versión ${n}`)] }],
    imageUrl: `/element-versions/${versionId(n)}/image`,
    width: 1080,
    height: 1350,
    ...overrides,
  };
}

export function slide(
  n: number,
  position: number,
  slideType: Element['slideType'],
  versionOverrides: Partial<ElementVersion> = {},
  carouselId = CAROUSEL_ID,
): Element {
  return {
    id: elementId(n),
    carouselId,
    kind: 'slide',
    position,
    slideType,
    currentVersion: version(n, versionOverrides),
  };
}

export function caption(
  n: number,
  position: number,
  versionOverrides: Partial<ElementVersion> = {},
  carouselId = CAROUSEL_ID,
): Element {
  return {
    id: elementId(n),
    carouselId,
    kind: 'caption',
    position,
    slideType: null,
    currentVersion: version(n, {
      qa: [],
      imageUrl: null,
      width: null,
      height: null,
      fields: [
        {
          field: 'caption',
          segments: [commentary('Texto de publicación de prueba con '), factSegment('2-1', factId(1))],
        },
        { field: 'hashtags', segments: [template('#JornadaDemo #FutbolDemo')] },
      ],
      ...versionOverrides,
    }),
  };
}

export function carousel(elements: Element[], overrides: Partial<Carousel> = {}): Carousel {
  return {
    id: CAROUSEL_ID,
    sequence: 1,
    total: 1,
    elements,
    readyForFinalApproval: false,
    finalApproval: null,
    ...overrides,
  };
}

/** A carousel whose slides are listed out of order, to check that the preview orders them (R-215). */
export function standardCarousel(overrides: Partial<Carousel> = {}): Carousel {
  return carousel(
    [
      caption(4, 4),
      slide(3, 3, 'closing'),
      slide(1, 1, 'cover', {
        fields: [
          { field: 'title', segments: [template('Liga Uno Demo')] },
          { field: 'demo_label', segments: [template('DEMOSTRACIÓN · datos sintéticos')] },
        ],
      }),
      slide(2, 2, 'match_result', {
        fields: [
          { field: 'score', segments: [factSegment('2-1', factId(1), 'verified')] },
          { field: 'headline', segments: [commentary('Victoria ajustada en la jornada')] },
        ],
      }),
    ],
    overrides,
  );
}

export function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: DRAFT_ID,
    projectId: PROJECT_ID,
    runId: RUN_ID,
    factsRunId: FACTS_RUN_ID,
    language: 'es',
    dataMode: 'DEMO_DATA',
    demonstration: true,
    standingsIncluded: true,
    createdAt: '2026-10-27T12:00:00Z',
    excludedMatchKeys: [],
    leftOutMatches: [],
    carousels: [standardCarousel()],
    ...overrides,
  };
}

/** Validates a fixture against the contract, so that a fixture mistake fails loudly instead of as a bad response. */
export function checked(value: Draft): Draft {
  return DraftSchema.parse(value);
}

export function checkedElement(value: Element): Element {
  return ElementSchema.parse(value);
}

export function draftResponse(value: Draft = draft()): Handler {
  const body = checked(value);
  return () => json(body);
}

export function modeDraft(mode: DataMode, overrides: Partial<Draft> = {}): Draft {
  return draft({ dataMode: mode, demonstration: mode === 'DEMO_DATA', ...overrides });
}

export function redraftRun(): Run {
  return {
    id: REDRAFT_RUN_ID,
    projectId: PROJECT_ID,
    runNumber: 2,
    kind: 'redraft',
    status: 'pending',
    startedAt: '2026-10-27T13:00:00Z',
    finishedAt: null,
    failure: null,
    stages: (['research', 'verification', 'content', 'rendering', 'visual_qa'] as const).map((stage) => ({
      stage,
      status: stage === 'research' || stage === 'verification' ? 'skipped' : 'pending',
      startedAt: null,
      finishedAt: null,
      failure: null,
    })),
  };
}

function matchTeamsFact(n: number, matchKey: string, display: string): FactListResponse['facts'][number] {
  return {
    factId: factId(100 + n),
    factKey: `${matchKey}:teams`,
    kind: 'match_teams',
    status: 'verified',
    unverifiedReason: null,
    reason: null,
    display,
    value: { homeTeamId: `equipo-${n}a`, awayTeamId: `equipo-${n}b` },
    candidateValue: null,
    subject: { matchKey },
    evidence: [],
    dispute: null,
    manualApproval: null,
  };
}

/** Facts of the draft's run: three matches, one of them left out as not finished. */
export function matchFacts(): FactListResponse {
  return {
    dataMode: 'DEMO_DATA',
    facts: [
      matchTeamsFact(1, 'demo-m1', 'Atlético Demo - Club Ejemplo'),
      matchTeamsFact(2, 'demo-m2', 'Deportivo Prueba - Unión Ficticia'),
      matchTeamsFact(3, 'demo-m3', 'Real Muestra - Sporting Modelo'),
    ],
    leftOutMatches: [],
    standings: { available: true, reason: null },
  };
}
