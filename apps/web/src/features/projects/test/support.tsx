/**
 * Test support of the projects feature: a fake fetch that answers by method and path (no network, R-241), synthetic
 * contract-shaped fixtures (no real competition, provider or person), and a renderer that mounts the application's
 * route table with the feature's API built on the real client over the fake fetch.
 */
import type { Catalogue, Project, ProjectSummary, Run, SeasonList, StageList, StageStatus } from '@edr/contracts';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { createApiClient, type FetchFunction } from '../../../api/client';
import { appRoutes } from '../../../app/routes';
import { createProjectsApi } from '../api';
import { ProjectsProvider } from '../ProjectsContext';
import { createReviewApi } from '../../review/api';
import { ReviewProvider } from '../../review/ReviewContext';
import { HistoryApiContext } from '../../history/api';

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

/** Answers each request from `routes` (`"GET /api/v1/projects"`); an unknown request fails as a network error. */
export function fakeServer(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const unexpected: string[] = [];
  const fetch = vi.fn<FetchFunction>(async (url, init) => {
    const method = init.method ?? 'GET';
    const call: RecordedCall = {
      method,
      path: url,
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const handler = routes[`${method} ${url}`];
    if (handler === undefined) {
      unexpected.push(`${method} ${url}`);
      throw new TypeError('fake network failure');
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

/** Mounts the application routes at `path` with the projects API over the fake server. */
export function renderApp(path: string, server: FakeServer, runPollIntervalMs = 10) {
  const api = createProjectsApi(createApiClient({ fetch: server.fetch }));
  const reviewApi = createReviewApi(createApiClient({ fetch: server.fetch }));
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <ProjectsProvider value={{ api, runPollIntervalMs }}>
      <ReviewProvider value={{ api: reviewApi }}>
        <HistoryApiContext.Provider value={createApiClient({ fetch: server.fetch })}>
          <RouterProvider router={router} />
        </HistoryApiContext.Provider>
      </ReviewProvider>
    </ProjectsProvider>,
  );
  return router;
}

// ---------------------------------------------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------------------------------------------

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const MANUAL_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const NEW_RUN_ID = '44444444-4444-4444-8444-444444444444';

const FRESH_LISTING = { retrievedAt: '2026-10-27T10:00:00Z', fromCache: false, stale: false, retryAfterSeconds: null };
const CACHED_LISTING = { retrievedAt: '2026-10-27T09:30:00Z', fromCache: true, stale: false, retryAfterSeconds: null };
/** Cached listing past its validity, served because the source's request budget is exhausted (R-291). */
export const STALE_LISTING = {
  retrievedAt: '2026-10-27T08:00:00Z',
  fromCache: true,
  stale: true,
  retryAfterSeconds: 30,
};
const AVAILABLE = { available: true, reason: null };

/**
 * Catalogue with: a league competition (DEMO_DATA), a stage-based reference competition with a selectable DEMO_DATA
 * source and a non-selectable verification source, a competition whose only source is restricted by the
 * subscription (unavailable, R-286), and a MANUAL_DATA competition with two selectable sources, the first unavailable.
 */
export const catalogue: Catalogue = {
  competitions: [
    {
      id: 'demo-liga-uno',
      name: 'Liga Uno Demo',
      areaName: 'Zona Norte',
      reference: false,
      sources: [
        {
          sourceId: 'demo-fixtures',
          sourceName: 'Fixtures de demostración',
          mode: 'DEMO_DATA',
          selectable: true,
          availability: AVAILABLE,
        },
      ],
    },
    {
      id: 'demo-copa-continental',
      name: 'Copa Continental Demo',
      areaName: null,
      reference: true,
      sources: [
        {
          sourceId: 'demo-cup',
          sourceName: 'Fixtures de copa',
          mode: 'DEMO_DATA',
          selectable: true,
          availability: AVAILABLE,
        },
        {
          sourceId: 'demo-verify',
          sourceName: 'Verificación de demostración',
          mode: 'DEMO_DATA',
          selectable: false,
          availability: AVAILABLE,
        },
      ],
    },
    {
      id: 'live-liga-restringida',
      name: 'Liga Restringida',
      areaName: 'Zona Sur',
      reference: false,
      sources: [
        {
          sourceId: 'live-api',
          sourceName: 'Proveedor en vivo',
          mode: 'LIVE_DATA',
          selectable: true,
          availability: { available: false, reason: 'subscription_restricted' },
        },
      ],
    },
    {
      id: 'manual-liga-nacional',
      name: 'Liga Nacional Manual',
      areaName: 'Zona Centro',
      reference: false,
      sources: [
        {
          sourceId: 'live-api',
          sourceName: 'Proveedor en vivo',
          mode: 'LIVE_DATA',
          selectable: true,
          availability: { available: false, reason: 'not_found' },
        },
        {
          sourceId: 'manual',
          sourceName: 'Importaciones del operador',
          mode: 'MANUAL_DATA',
          selectable: true,
          availability: AVAILABLE,
        },
      ],
    },
  ],
  sources: [
    {
      sourceId: 'demo-fixtures',
      sourceName: 'Fixtures de demostración',
      mode: 'DEMO_DATA',
      availability: AVAILABLE,
      listing: FRESH_LISTING,
    },
    {
      sourceId: 'live-api',
      sourceName: 'Proveedor en vivo',
      mode: 'LIVE_DATA',
      availability: AVAILABLE,
      listing: STALE_LISTING,
    },
  ],
};

export const cupSeasons: SeasonList = {
  competitionId: 'demo-copa-continental',
  sourceId: 'demo-cup',
  availability: AVAILABLE,
  listing: CACHED_LISTING,
  seasons: [
    { id: '2025-26', label: '2025-26', current: true, startDate: '2025-09-01', endDate: '2026-06-30' },
    { id: '2024-25', label: '2024-25', current: false, startDate: null, endDate: null },
  ],
};

/** Stage-based competition (R-283, R-284): a league phase with matchdays and standings, then stages without. */
export const cupStages: StageList = {
  competitionId: 'demo-copa-continental',
  sourceId: 'demo-cup',
  seasonId: '2025-26',
  availability: AVAILABLE,
  listing: FRESH_LISTING,
  stages: [
    {
      id: 'octavos',
      name: 'Octavos de final',
      order: 3,
      standings: 'not_expected',
      selectableAsWhole: true,
      matchdays: [2, 1],
      availability: AVAILABLE,
    },
    {
      id: 'fase-liga',
      name: 'Fase de liga',
      order: 1,
      standings: 'expected',
      selectableAsWhole: false,
      matchdays: [1, 2, 3, 4, 5, 6, 7, 8],
      availability: AVAILABLE,
    },
    {
      id: 'playoff',
      name: 'Eliminatoria de playoff',
      order: 2,
      standings: 'not_expected',
      selectableAsWhole: true,
      matchdays: [],
      availability: AVAILABLE,
    },
    {
      id: 'final',
      name: 'Final',
      order: 4,
      standings: 'unknown',
      selectableAsWhole: true,
      matchdays: [],
      availability: { available: false, reason: 'not_provided' },
    },
  ],
};

export const leagueSeasonsUnavailable: SeasonList = {
  competitionId: 'demo-liga-uno',
  sourceId: 'demo-fixtures',
  availability: { available: false, reason: 'subscription_restricted' },
  listing: FRESH_LISTING,
  seasons: [],
};

export const summaries: ProjectSummary[] = [
  {
    id: PROJECT_ID,
    title: 'Copa Continental Demo 2025-26 Fase de liga J3',
    competitionName: 'Copa Continental Demo',
    seasonLabel: '2025-26',
    stageLabel: 'Fase de liga',
    matchday: 3,
    sourceName: 'Fixtures de copa',
    dataMode: 'DEMO_DATA',
    demonstration: true,
    language: 'es',
    createdAt: '2026-10-27T10:00:00Z',
    approvalState: 'in_review',
    lastExportAt: null,
  },
  {
    id: MANUAL_PROJECT_ID,
    title: 'Liga Nacional Manual Apertura',
    competitionName: 'Liga Nacional Manual',
    seasonLabel: '2026',
    stageLabel: 'Apertura',
    matchday: null,
    sourceName: 'Importaciones del operador',
    dataMode: 'MANUAL_DATA',
    demonstration: false,
    language: 'en',
    createdAt: '2026-10-26T10:00:00Z',
    approvalState: 'exported',
    lastExportAt: '2026-10-26T18:30:00Z',
  },
];

const STAGES = ['research', 'verification', 'content', 'rendering', 'visual_qa'] as const;

/** Run with the given per-stage statuses (in workflow order); missing statuses are pending. */
export function run(
  statuses: StageStatus['status'][],
  overrides: Partial<Run> = {},
  failures: Partial<Record<(typeof STAGES)[number], StageStatus['failure']>> = {},
): Run {
  const stages: StageStatus[] = STAGES.map((stage, index) => {
    const status = statuses[index] ?? 'pending';
    const started = status !== 'pending' && status !== 'skipped';
    return {
      stage,
      status,
      startedAt: started ? '2026-10-27T11:00:00Z' : null,
      finishedAt: status === 'completed' || status === 'failed' ? '2026-10-27T11:01:00Z' : null,
      failure: failures[stage] ?? null,
    };
  });
  const status: Run['status'] = statuses.includes('failed')
    ? 'failed'
    : stages.every((stage) => stage.status === 'completed')
      ? 'completed'
      : statuses.some((value) => value !== 'pending')
        ? 'running'
        : 'pending';
  return {
    id: RUN_ID,
    projectId: PROJECT_ID,
    runNumber: 1,
    kind: 'full',
    status,
    startedAt: '2026-10-27T11:00:00Z',
    finishedAt: status === 'completed' || status === 'failed' ? '2026-10-27T11:05:00Z' : null,
    failure: null,
    stages,
    ...overrides,
  };
}

export function project(overrides: Partial<Project> = {}): Project {
  const [summary] = summaries;
  if (summary === undefined) {
    throw new Error('missing fixture');
  }
  return {
    ...summary,
    competitionId: 'demo-copa-continental',
    sourceId: 'demo-cup',
    seasonId: '2025-26',
    stageId: 'fase-liga',
    latestRun: null,
    activeDraftId: null,
    ...overrides,
  };
}

export function manualProject(overrides: Partial<Project> = {}): Project {
  const summary = summaries[1];
  if (summary === undefined) {
    throw new Error('missing fixture');
  }
  return {
    ...summary,
    competitionId: 'manual-liga-nacional',
    sourceId: 'manual',
    seasonId: '2026',
    stageId: 'apertura',
    latestRun: null,
    activeDraftId: null,
    ...overrides,
  };
}
