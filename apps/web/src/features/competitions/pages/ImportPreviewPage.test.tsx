import { StrictMode } from 'react';
import type {
  CompetitionProviderBinding,
  ImportOperation,
  ImportPreview,
  ImportResourceCapability,
  ManagedCompetition,
  ManagedSeason,
  ExternalSeasonOption,
} from '@edr/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(cancel.className).toContain('bg-danger-surface');
    expect(cancel).not.toHaveProperty('disabled', true);
    expect(api.startImportOperation).toHaveBeenCalledTimes(1);
  });
  it('explains that import is unavailable and keeps review actions solid', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    expect(screen.getByRole('link', { name: 'Volver a competición' }).className).toContain('bg-surface-overlay');
    expect(screen.getByRole('button', { name: 'Ver vista previa' }).className).toContain('bg-brand-gold');
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    expect(screen.getByText(/La confirmación e importación se implementarán en PD-ARCH-01D-C/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modificar selección' }).className).toContain('bg-surface-overlay');
    expect(screen.getByRole('button', { name: 'Verificar cambios locales' }).className).toContain('bg-surface-overlay');
    expect(screen.queryByRole('button', { name: /Confirmar importación/i })).toBeNull();
  });
  it('presents record differences as a solid native disclosure control', async () => {
    sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
    renderPage({ getImportOperation: vi.fn().mockResolvedValue(completed) });
    await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    const summary = screen.getByText('Revisar datos y diferencias');
    const details = summary.closest('details');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.className).toContain('bg-surface-overlay');
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
    expect(busy.className).toContain('bg-surface-overlay');
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
    expect(retry.className).toContain('bg-surface-overlay');
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
});
