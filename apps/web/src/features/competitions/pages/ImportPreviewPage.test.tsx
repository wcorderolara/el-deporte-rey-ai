import { StrictMode } from 'react';
import type {
  CompetitionProviderBinding,
  ImportApplyOperation,
  ImportApplyPlan,
  ImportOperation,
  ImportPreview,
  ImportResourceCapability,
  ManagedCompetition,
  ManagedSeason,
  ExternalSeasonOption,
} from '@edr/contracts';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, parseProblem } from '../../../api/client';
import type { Problem } from '../../../api/types';
import type { CompetitionsApi } from '../api';
import { CompetitionsProvider } from '../CompetitionsContext';
import { ImportPreviewPage } from './ImportPreviewPage';

const competitionId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const previewId = '44444444-4444-4444-8444-444444444444';
const time = '2026-11-03T12:00:00.000Z';
const competition = {
  id: competitionId,
  name: 'Liga de ejemplo',
  createdAt: time,
  updatedAt: time,
} satisfies ManagedCompetition;
const binding = {
  id: '33333333-3333-4333-8333-333333333333',
  competitionId,
  providerKey: 'demo-provider',
  providerName: 'Proveedor de prueba',
  externalCompetitionId: 'league-demo',
  externalCompetitionName: 'Liga de ejemplo',
  mode: 'provider',
  status: 'active',
  linkedAt: time,
  unlinkedAt: null,
  createdAt: time,
  updatedAt: time,
} satisfies CompetitionProviderBinding;
const season = {
  externalSeasonId: '2025',
  label: '2025/26',
  startDate: '2025-08-01',
  endDate: '2026-05-31',
  current: true,
  localCandidates: [],
} satisfies ExternalSeasonOption;
const capabilities: ImportResourceCapability[] = [{ resource: 'season', available: true, reason: null }];
const preview = {
  previewId,
  competitionId,
  providerKey: 'demo-provider',
  providerName: 'Proveedor de prueba',
  externalCompetitionName: 'Liga de ejemplo',
  externalSeasonId: '2025',
  externalSeasonLabel: '2025/26',
  destinationSeasonId: null,
  retrievedAt: time,
  expiresAt: '2026-11-03T12:30:00.000Z',
  snapshotHash: 'a'.repeat(64),
  localFingerprint: 'b'.repeat(64),
  stale: false,
  resources: ['season'],
  summary: { new: 1, changed: 0, unchanged: 0, conflicts: 0, invalid: 0, skipped: 0 },
  capabilities,
  warnings: [],
  items: [
    {
      resource: 'season',
      externalId: '2025',
      externalScope: null,
      title: '2025/26',
      operation: 'new',
      localCandidate: null,
      relationships: [],
      fields: [],
      warnings: [],
    },
  ],
} satisfies ImportPreview;
const baseOperation = {
  operationId,
  competitionId,
  providerKey: 'demo-provider',
  externalSeasonId: '2025',
  destinationSeasonId: null,
  resources: ['season'],
  status: 'queued',
  currentStage: null,
  completedStages: [],
  cancellationRequested: false,
  previewId: null,
  errorCode: null,
  errorMessage: null,
  createdAt: time,
  startedAt: null,
  updatedAt: time,
  completedAt: null,
} satisfies ImportOperation;
const running: ImportOperation = { ...baseOperation, status: 'running', currentStage: 'fetching', startedAt: time };
const completed: ImportOperation = {
  ...baseOperation,
  status: 'completed',
  currentStage: null,
  completedStages: ['fetching', 'normalizing', 'comparing', 'preparing_preview'],
  previewId,
  startedAt: time,
  completedAt: time,
};

const applyOperationId = '55555555-5555-4555-8555-555555555555';
const seasonId = '66666666-6666-4666-8666-666666666666';
const teamId = '77777777-7777-4777-8777-777777777777';
const counts = {
  seasonsCreated: 1,
  teamsCreated: 20,
  teamsReused: 0,
  associationsCreated: 20,
  participantsCreated: 20,
  stagesCreated: 1,
  roundsCreated: 38,
  matchesCreated: 380,
  matchesUpdated: 0,
  resultsApplied: 120,
  mappingsCreated: 440,
  unchanged: 0,
  skipped: 0,
  conflictsNotApplied: 0,
};
const readyPlan = {
  previewId,
  competitionId,
  providerName: 'Proveedor de prueba',
  externalCompetitionName: 'Liga de ejemplo',
  externalSeasonLabel: '2025/26',
  destinationSeasonId: null,
  destinationLabel: '2025/26',
  destinationIsNew: true,
  expiresAt: '2026-11-03T12:30:00.000Z',
  planHash: 'c'.repeat(64),
  ready: true,
  totals: { create: 460, update: 0, unchanged: 0, keepLocal: 0, skip: 0, blocked: 0 },
  counts,
  blockers: [],
  warnings: [],
  reviewItems: [],
  reviewItemsTruncated: false,
} satisfies ImportApplyPlan;
const blockedPlan: ImportApplyPlan = {
  ...readyPlan,
  planHash: 'd'.repeat(64),
  ready: false,
  totals: { ...readyPlan.totals, blocked: 1 },
  blockers: [{ code: 'TEAM_IDENTITY_REQUIRED', message: 'Posible equipo duplicado: vincúlalo u omítelo.', count: 1 }],
  reviewItems: [
    {
      resource: 'teams',
      externalId: '57',
      externalScope: null,
      title: 'Arsenal FC',
      action: 'blocked',
      reason: 'Posible equipo duplicado: vincúlalo con un equipo local u omítelo.',
      localId: null,
      localLabel: null,
      candidates: [{ id: teamId, label: 'Arsenal FC' }],
      options: ['link', 'skip'],
      decision: null,
      changes: [],
    },
  ],
};
const queuedApply = {
  operationId: applyOperationId,
  competitionId,
  previewId,
  status: 'queued',
  currentStage: null,
  completedStages: [],
  cancellationRequested: false,
  cancellable: true,
  application: null,
  errorCode: null,
  errorMessage: null,
  createdAt: time,
  startedAt: null,
  updatedAt: time,
  completedAt: null,
} satisfies ImportApplyOperation;
const completedApply: ImportApplyOperation = {
  ...queuedApply,
  status: 'completed',
  completedStages: ['validating', 'resolving_identities', 'transforming'],
  cancellable: false,
  startedAt: time,
  completedAt: time,
  application: {
    applicationId: '88888888-8888-4888-8888-888888888888',
    operationId: applyOperationId,
    previewId,
    competitionId,
    providerName: 'Proveedor de prueba',
    externalSeasonLabel: '2025/26',
    destinationSeasonId: seasonId,
    destinationSeasonLabel: '2025/26',
    appliedAt: time,
    counts,
    notApplied: [],
  },
};

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readonly listeners = new Map<string, (event: Event) => void>();
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }
  emit(
    type: string,
    status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running',
    stage: 'fetching' | 'normalizing' | 'comparing' | 'preparing_preview' | null = null,
  ) {
    this.listeners.get(type)?.(
      new MessageEvent(type, {
        data: JSON.stringify({
          id: 1,
          type,
          operationId,
          status,
          stage,
          previewId: status === 'completed' ? previewId : null,
          timestamp: time,
        }),
      }),
    );
  }
  emitApply(
    type: string,
    status: 'running' | 'completed' | 'failed' = 'running',
    stage: 'validating' | 'resolving_identities' | 'transforming' | 'persisting' | null = null,
  ) {
    this.listeners.get(type)?.(
      new MessageEvent(type, {
        data: JSON.stringify({
          id: 2,
          type,
          operationId: applyOperationId,
          status,
          stage,
          applicationId: null,
          timestamp: time,
        }),
      }),
    );
  }
  close() {
    this.closed = true;
  }
}

function renderPage(overrides: Partial<CompetitionsApi> = {}, strict = false) {
  const api = {
    getProviderBinding: vi.fn().mockResolvedValue(binding),
    get: vi.fn().mockResolvedValue(competition),
    listExternalSeasons: vi.fn().mockResolvedValue([season]),
    listSeasons: vi.fn().mockResolvedValue([] as ManagedSeason[]),
    getImportCapabilities: vi.fn().mockResolvedValue(capabilities),
    startImportOperation: vi.fn().mockResolvedValue(baseOperation),
    getImportOperation: vi.fn().mockResolvedValue(running),
    cancelImportOperation: vi.fn().mockResolvedValue({ ...running, cancellationRequested: true }),
    getImportPreview: vi.fn().mockResolvedValue(preview),
    planImportApplication: vi.fn().mockResolvedValue(readyPlan),
    startImportApplication: vi.fn().mockResolvedValue(queuedApply),
    getImportApplication: vi.fn().mockResolvedValue(completedApply),
    cancelImportApplication: vi.fn().mockResolvedValue({ ...queuedApply, status: 'cancelled' }),
    ...overrides,
  } as unknown as CompetitionsApi;
  const page = (
    <MemoryRouter initialEntries={[`/competitions/${competitionId}/import`]}>
      <CompetitionsProvider api={api}>
        <Routes>
          <Route path="/competitions/:competitionId/import" element={<ImportPreviewPage />} />
        </Routes>
      </CompetitionsProvider>
    </MemoryRouter>
  );
  render(strict ? <StrictMode>{page}</StrictMode> : page);
  return api;
}
async function start() {
  await userEvent.selectOptions(await screen.findByLabelText('Temporada externa'), '2025');
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Temporada' }));
  await userEvent.click(screen.getByRole('button', { name: 'Consultar y preparar vista previa' }));
}

beforeEach(() => {
  sessionStorage.clear();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ImportPreviewPage async operations', () => {
  it('starts once, opens SSE, and shows only confirmed current stages', async () => {
    const api = renderPage();
    await start();
    await screen.findByRole('heading', { name: 'Preparando vista previa' });
    expect(api.startImportOperation).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances.at(-1)?.url).toContain(operationId);
    FakeEventSource.instances.at(-1)!.emit('stage.started', 'running', 'fetching');
    await waitFor(() => expect(screen.getAllByText('En proceso').length).toBeGreaterThan(0));
    expect(api.getImportOperation).not.toHaveBeenCalled();
    expect(screen.queryByText('Vista previa preparada correctamente')).toBeNull();
  });
  it('retrieves a completed preview by HTTP without polling for every SSE event', async () => {
    const get = vi.fn().mockResolvedValue(completed);
    const api = renderPage({ getImportOperation: get });
    await start();
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    FakeEventSource.instances.at(-1)!.emit('stage.started', 'running', 'fetching');
    FakeEventSource.instances.at(-1)!.emit('stage.completed', 'running', 'fetching');
    FakeEventSource.instances.at(-1)!.emit('operation.completed', 'completed');
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    expect(api.getImportPreview).toHaveBeenCalledWith(competitionId, previewId);
    expect(get).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    expect(screen.getAllByText('Pendiente de importación').length).toBeGreaterThan(0);
  });
  it('keeps one effective SSE subscription across StrictMode and stage changes', async () => {
    const api = renderPage({}, true);
    await start();
    await waitFor(() => expect(FakeEventSource.instances.filter((source) => !source.closed)).toHaveLength(1));
    const stream = FakeEventSource.instances.find((source) => !source.closed)!;
    stream.emit('stage.started', 'running', 'fetching');
    stream.emit('stage.completed', 'running', 'fetching');
    stream.emit('stage.started', 'running', 'normalizing');
    expect(FakeEventSource.instances.filter((source) => !source.closed)).toHaveLength(1);
    expect(api.getImportOperation).not.toHaveBeenCalled();
    cleanup();
    expect(FakeEventSource.instances.filter((source) => !source.closed)).toHaveLength(0);
  });
  it('recovers through HTTP after SSE disconnect without starting another operation', async () => {
    const get = vi.fn().mockResolvedValue(completed);
    const api = renderPage({ getImportOperation: get });
    await start();
    await waitFor(() => expect(FakeEventSource.instances.filter((source) => !source.closed)).toHaveLength(1));
    FakeEventSource.instances.at(-1)!.onerror?.();
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(api.startImportOperation).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances.filter((source) => !source.closed)).toHaveLength(0);
  });
  it('keeps step indicators circular and gives completed actions a clear hierarchy', async () => {
    const api = renderPage();
    await start();
    const progress = await screen.findByRole('list', { name: 'Etapas de preparación' });
    for (const indicator of progress.querySelectorAll('span[aria-hidden="true"]')) {
      expect(indicator.className).toContain('size-11');
      expect(indicator.className).toContain('aspect-square');
      expect(indicator.className).toContain('shrink-0');
      expect(indicator.className).toContain('rounded-full');
    }
    const cancel = screen.getByRole('button', { name: 'Cancelar consulta' });
    expect(cancel.className).toContain('bg-button-danger-bg');
    expect(cancel).not.toHaveProperty('disabled', true);
    expect(api.startImportOperation).toHaveBeenCalledTimes(1);
  });
  it('adds a solid gold confirmation as the primary action next to the review actions', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    expect(screen.getByRole('link', { name: 'Volver a competición' }).className).toContain('bg-button-secondary-bg');
    expect(screen.getByRole('button', { name: 'Ver vista previa' }).className).toContain('bg-button-primary-bg');
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    expect(
      screen.getAllByText(/Ningún registro deportivo local cambia hasta que confirmes la importación/).length,
    ).toBe(2);
    expect(screen.getByRole('button', { name: 'Modificar selección' }).className).toContain('bg-button-secondary-bg');
    expect(screen.getByRole('button', { name: 'Verificar cambios locales' }).className).toContain(
      'bg-button-secondary-bg',
    );
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' });
    expect(confirm.className).toContain('bg-button-primary-bg');
    expect(confirm.className).toContain('text-button-primary-text');
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  });
  it('presents record differences as a solid native disclosure control', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    const summary = screen.getByText('Revisar datos y diferencias');
    const details = summary.closest('details');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.className).toContain('bg-button-secondary-bg');
    expect(summary.querySelector('svg')).toBeTruthy();
    expect(details?.open).toBe(false);
    await userEvent.click(summary);
    expect(details?.open).toBe(true);
    await userEvent.click(summary);
    expect(details?.open).toBe(false);
  });
  it('keeps the local-change action visibly busy and disabled during verification', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    const readPreview = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockImplementationOnce(() => new Promise<ImportPreview>(() => {}));
    renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed), getImportPreview: readPreview });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Verificar cambios locales' }));
    const busy = await screen.findByRole('button', { name: 'Verificando…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.className).toContain('bg-button-secondary-bg');
    expect(readPreview).toHaveBeenCalledTimes(2);
  });
  it('shows counts from the selected preview resources, including teams when returned', async () => {
    const withTeams: ImportPreview = {
      ...preview,
      resources: ['season', 'stages', 'teams'],
      items: [
        ...preview.items,
        {
          resource: 'stages',
          externalId: 'regular',
          externalScope: '2025',
          title: 'Fase regular',
          operation: 'new',
          localCandidate: null,
          relationships: [],
          fields: [],
          warnings: [],
        },
        {
          resource: 'teams',
          externalId: 'team-a',
          externalScope: null,
          title: 'Equipo A',
          operation: 'new',
          localCandidate: null,
          relationships: [],
          fields: [],
          warnings: [],
        },
        {
          resource: 'teams',
          externalId: 'team-b',
          externalScope: null,
          title: 'Equipo B',
          operation: 'new',
          localCandidate: null,
          relationships: [],
          fields: [],
          warnings: [],
        },
      ],
    };
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    renderPage({
      getImportOperation: vi.fn().mockResolvedValue(completed),
      getImportPreview: vi.fn().mockResolvedValue(withTeams),
    });
    const summary = await screen.findByRole('region', { name: 'Resumen de datos preparados' });
    expect(summary.textContent).toContain('Equipos');
    expect(summary.textContent).toContain('2');
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    expect(screen.getByRole('tab', { name: 'Equipos (2)' })).toBeTruthy();
  });
  it('reports failure and allows retry without claiming completion', async () => {
    const failed: ImportOperation = {
      ...running,
      status: 'failed',
      errorCode: 'PROVIDER_FAILED',
      errorMessage: 'Proveedor no disponible',
      completedAt: time,
    };
    const api = renderPage({ getImportOperation: vi.fn().mockResolvedValue(failed) });
    await start();
    await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
    FakeEventSource.instances.at(-1)!.emit('operation.failed', 'failed', 'fetching');
    await screen.findByRole('heading', { name: 'No se pudo preparar la vista previa' });
    const retry = screen.getByRole('button', { name: 'Reintentar' });
    expect(retry.className).toContain('bg-button-secondary-bg');
    await userEvent.click(retry);
    expect(api.startImportOperation).toHaveBeenCalledTimes(2);
  });
  it('requests server cancellation and waits for confirmation', async () => {
    const api = renderPage();
    await start();
    await screen.findByRole('heading', { name: 'Preparando vista previa' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar consulta' }));
    await waitFor(() => expect(api.cancelImportOperation).toHaveBeenCalledWith(competitionId, operationId));
  });
  it('lets a reopened preview return to selection and loads external seasons only then', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    const api = renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Modificar selección' }));
    await waitFor(() => expect(api.listExternalSeasons).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(`import-operation:${competitionId}`)).toBeNull();
  });
  it('recovers a completed operation after reload without starting another provider consultation', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    const api = renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    expect(api.startImportOperation).not.toHaveBeenCalled();
    expect(api.listExternalSeasons).not.toHaveBeenCalled();
  });
  it('returns to selection when the saved operation lost its expired preview', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    const api = renderPage({ getImportOperation: vi.fn().mockResolvedValue({ ...completed, previewId: null }) });
    expect(await screen.findByLabelText('Temporada externa')).toBeTruthy();
    expect(api.listExternalSeasons).toHaveBeenCalled();
    expect(api.getImportPreview).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`import-operation:${competitionId}`)).toBeNull();
  });
  it('returns to selection when the saved preview no longer exists', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    const status = 404;
    const problem = parseProblem(
      {
        type: 'about:blank',
        title: 'Not found',
        status,
        code: 'NOT_FOUND',
        detail: 'No encontramos esta vista previa.',
      },
      status,
    ) as Problem;
    const api = renderPage({
      getImportOperation: vi.fn().mockResolvedValue(completed),
      getImportPreview: vi.fn().mockRejectedValue(new ApiError('problem', { status, problem })),
    });
    expect(await screen.findByLabelText('Temporada externa')).toBeTruthy();
    expect(api.listExternalSeasons).toHaveBeenCalled();
    expect(sessionStorage.getItem(`import-operation:${competitionId}`)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

async function openReview(overrides: Partial<CompetitionsApi> = {}) {
  sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
  const api = renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed), ...overrides });
  await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
  await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
  return api;
}

describe('ImportPreviewPage confirmed import', () => {
  it('keeps confirmation disabled with the backend reason until an explicit identity decision', async () => {
    const plan = vi.fn().mockResolvedValueOnce(blockedPlan).mockResolvedValue(readyPlan);
    const api = await openReview({ planImportApplication: plan });
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' });
    await waitFor(() => expect(screen.getByText('Requiere revisión')).toBeTruthy());
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    const reason = document.getElementById(confirm.getAttribute('aria-describedby')!);
    expect(reason?.textContent).toBe('Posible equipo duplicado: vincúlalo u omítelo.');
    const decision = screen.getByLabelText('Decisión para equipo «Arsenal FC»');
    expect(within(decision).getByRole('option', { name: 'Vincular con «Arsenal FC»' })).toBeTruthy();
    await userEvent.selectOptions(decision, `link:${teamId}`);
    await waitFor(() =>
      expect(plan).toHaveBeenLastCalledWith(
        competitionId,
        previewId,
        [{ resource: 'teams', externalId: '57', externalScope: null, action: 'link', localId: teamId }],
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(api.startImportApplication).not.toHaveBeenCalled();
  });

  it('opens an accessible summary without persisting and cancels without starting', async () => {
    const api = await openReview();
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(confirm);
    const dialog = screen.getByRole('dialog', { name: 'Confirmar importación' });
    expect(
      within(dialog).getByText(
        'Esta acción guardará los datos seleccionados en la base de datos local. Revisa los cambios antes de continuar.',
      ),
    ).toBeTruthy();
    for (const label of [
      'Competición',
      'Temporada',
      'Proveedor',
      'Destino local',
      'Registros que se crearán',
      'Conflictos bloqueantes',
    ])
      expect(within(dialog).getByText(label)).toBeTruthy();
    expect(within(dialog).getByText('460')).toBeTruthy();
    expect(within(dialog).getByText('2025/26 (nueva)')).toBeTruthy();
    expect(api.startImportApplication).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.startImportApplication).not.toHaveBeenCalled();
  });

  it('starts once, shows only backend-confirmed stages and the committed result with navigation', async () => {
    let resolveStart: (value: ImportApplyOperation) => void = () => {};
    const startApplication = vi.fn(() => new Promise<ImportApplyOperation>((resolve) => (resolveStart = resolve)));
    const api = await openReview({ startImportApplication: startApplication });
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(confirm);
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Confirmar importación' });
    await userEvent.click(submit);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Iniciando importación…' }));
    expect(startApplication).toHaveBeenCalledTimes(1);
    expect(startApplication).toHaveBeenCalledWith(competitionId, previewId, {
      decisions: [],
      planHash: readyPlan.planHash,
    });
    resolveStart(queuedApply);
    await screen.findByRole('heading', { name: 'Importando datos' });
    expect(sessionStorage.getItem(`import-application:${competitionId}`)).toBe(applyOperationId);
    const stream = FakeEventSource.instances.find((source) => source.url.includes('import-applications'))!;
    expect(stream.url).toContain(applyOperationId);
    stream.emitApply('stage.started', 'running', 'validating');
    const stages = await screen.findByRole('list', { name: 'Etapas de importación' });
    await waitFor(() => expect(within(stages).getAllByText('En proceso')).toHaveLength(1));
    expect(within(stages).getAllByText('Pendiente')).toHaveLength(3);
    expect(screen.queryByText(/%/)).toBeNull();
    stream.emitApply('operation.completed', 'completed');
    await screen.findByRole('heading', { name: 'Importación completada' });
    expect(api.getImportApplication).toHaveBeenCalledWith(competitionId, applyOperationId);
    const saved = screen.getByRole('region', { name: 'Cambios guardados' });
    expect(within(saved).getByText('Partidos creados').nextElementSibling?.textContent).toBe('380');
    expect(within(saved).getByText('Resultados aplicados').nextElementSibling?.textContent).toBe('120');
    expect(screen.getByRole('link', { name: 'Ver temporada' }).getAttribute('href')).toBe(
      `/competitions/${competitionId}/seasons/${seasonId}`,
    );
    expect(screen.getByRole('link', { name: 'Ver equipos' }).getAttribute('href')).toBe(
      `/competitions/${competitionId}/teams`,
    );
    expect(screen.getByRole('link', { name: 'Volver a competición' }).getAttribute('href')).toBe(
      `/competitions/${competitionId}`,
    );
    await waitFor(() => expect(api.listSeasons).toHaveBeenCalledTimes(2));
  });

  it('reports a failed application without claiming persisted data', async () => {
    const failed: ImportApplyOperation = {
      ...queuedApply,
      status: 'failed',
      currentStage: 'persisting',
      completedStages: ['validating', 'resolving_identities', 'transforming'],
      cancellable: false,
      errorCode: 'IMPORT_PREVIEW_STALE',
      errorMessage: 'Los datos locales cambiaron desde la vista previa. No se guardó ningún cambio.',
      completedAt: time,
    };
    await openReview({ getImportApplication: vi.fn().mockResolvedValue(failed) });
    const confirm = await screen.findByRole('button', { name: 'Confirmar importación' });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(confirm);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() =>
      expect(FakeEventSource.instances.some((source) => source.url.includes('import-applications'))).toBe(true),
    );
    FakeEventSource.instances
      .find((source) => source.url.includes('import-applications'))!
      .emitApply('operation.failed', 'failed', 'persisting');
    await screen.findByRole('heading', { name: 'No se completó la importación' });
    expect(
      screen.getByText('Los datos locales cambiaron desde la vista previa. No se guardó ningún cambio.'),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Importación completada' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a la revisión' }));
    expect(sessionStorage.getItem(`import-application:${competitionId}`)).toBeNull();
    expect(await screen.findByRole('button', { name: 'Confirmar importación' })).toBeTruthy();
  });

  it('recovers a completed application after a reload without applying it again', async () => {
    sessionStorage.setItem(`import-application:${competitionId}`, applyOperationId);
    const api = renderPage();
    await screen.findByRole('heading', { name: 'Importación completada' });
    expect(api.startImportApplication).not.toHaveBeenCalled();
    expect(api.planImportApplication).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Preparar otra importación' }));
    expect(sessionStorage.getItem(`import-application:${competitionId}`)).toBeNull();
    expect(await screen.findByLabelText('Temporada externa')).toBeTruthy();
  });
});
