/**
 * UI-06.3, conflicting sources in a provider import (mechanism 1, field provenance): a provider observation that
 * contradicts a protected manual override is presented as a conflict in words (never by colour alone), the local
 * value is kept by default, and only an explicit, labelled decision sends `accept_incoming`; nothing in the page
 * replaces the protected value silently. The committed result lists the value that was kept.
 */
import type {
  CompetitionProviderBinding,
  ExternalSeasonOption,
  ImportApplyOperation,
  ImportApplyPlan,
  ImportApplyPlanItem,
  ImportOperation,
  ImportPreview,
  ImportPreviewItem,
  ManagedCompetition,
  ManagedSeason,
} from '@edr/contracts';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompetitionsApi } from '../api';
import { CompetitionsProvider } from '../CompetitionsContext';
import { ImportPreviewPage } from './ImportPreviewPage';

const competitionId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const previewId = '44444444-4444-4444-8444-444444444444';
const applyOperationId = '55555555-5555-4555-8555-555555555555';
const seasonId = '66666666-6666-4666-8666-666666666666';
const matchId = '77777777-7777-4777-8777-777777777777';
const time = '2026-11-03T12:00:00.000Z';
const RESULT_TITLE = 'Club Alfa 2-2 Club Beta';
const KEEP_REASON = 'Hay un marcador local diferente; se conserva el valor local.';

const competition = {
  id: competitionId,
  name: 'Liga en disputa',
  createdAt: time,
  updatedAt: time,
} satisfies ManagedCompetition;
const binding = {
  id: '33333333-3333-4333-8333-333333333333',
  competitionId,
  providerKey: 'demo-provider',
  providerName: 'Proveedor de prueba',
  externalCompetitionId: 'league-demo',
  externalCompetitionName: 'Liga en disputa',
  mode: 'hybrid',
  status: 'active',
  linkedAt: time,
  unlinkedAt: null,
  createdAt: time,
  updatedAt: time,
} satisfies CompetitionProviderBinding;
const externalSeason = {
  externalSeasonId: '2026',
  label: '2026/27',
  startDate: '2026-08-01',
  endDate: '2027-05-31',
  current: true,
  localCandidates: [],
} satisfies ExternalSeasonOption;

/** The provider now reports 2-2 for a result the operator corrected to 3-1 (a protected manual override). */
const conflictItem = {
  resource: 'results',
  externalId: 'm1:result',
  externalScope: 'copa-stub:2026',
  title: RESULT_TITLE,
  operation: 'conflict',
  localCandidate: { id: matchId, label: 'Club Alfa vs Club Beta' },
  relationships: [],
  fields: [{ name: 'score', localValue: '3-1', incomingValue: '2-2', baselineValue: '2-1', protected: true }],
  warnings: ['El marcador local se conserva como valor predeterminado.'],
} satisfies ImportPreviewItem;
const preview = {
  previewId,
  competitionId,
  providerKey: 'demo-provider',
  providerName: 'Proveedor de prueba',
  externalCompetitionName: 'Liga en disputa',
  externalSeasonId: '2026',
  externalSeasonLabel: '2026/27',
  destinationSeasonId: seasonId,
  retrievedAt: time,
  expiresAt: '2026-11-03T12:30:00.000Z',
  snapshotHash: 'a'.repeat(64),
  localFingerprint: 'b'.repeat(64),
  stale: false,
  resources: ['results'],
  summary: { new: 0, changed: 0, unchanged: 0, conflicts: 1, invalid: 0, skipped: 0 },
  capabilities: [{ resource: 'results', available: true, reason: null }],
  warnings: [],
  items: [conflictItem],
} satisfies ImportPreview;
const completedPreviewOperation = {
  operationId,
  competitionId,
  providerKey: 'demo-provider',
  externalSeasonId: '2026',
  destinationSeasonId: seasonId,
  resources: ['results'],
  status: 'completed',
  currentStage: null,
  completedStages: ['fetching', 'normalizing', 'comparing', 'preparing_preview'],
  cancellationRequested: false,
  previewId,
  errorCode: null,
  errorMessage: null,
  createdAt: time,
  startedAt: time,
  updatedAt: time,
  completedAt: time,
} satisfies ImportOperation;

const keepLocalItem = {
  resource: 'results',
  externalId: 'm1:result',
  externalScope: 'copa-stub:2026',
  title: RESULT_TITLE,
  action: 'keep_local',
  reason: KEEP_REASON,
  localId: matchId,
  localLabel: 'Club Alfa vs Club Beta',
  candidates: [],
  options: ['accept_incoming'],
  decision: null,
  changes: [{ field: 'marcador', localValue: '3-1', incomingValue: '2-2', applied: false }],
} satisfies ImportApplyPlanItem;
const counts = {
  seasonsCreated: 0,
  teamsCreated: 0,
  teamsReused: 0,
  associationsCreated: 0,
  participantsCreated: 0,
  stagesCreated: 0,
  roundsCreated: 0,
  matchesCreated: 0,
  matchesUpdated: 0,
  resultsApplied: 0,
  mappingsCreated: 0,
  unchanged: 1,
  skipped: 0,
  conflictsNotApplied: 1,
};
const keepPlan = {
  previewId,
  competitionId,
  providerName: 'Proveedor de prueba',
  externalCompetitionName: 'Liga en disputa',
  externalSeasonLabel: '2026/27',
  destinationSeasonId: seasonId,
  destinationLabel: '2026/27',
  destinationIsNew: false,
  expiresAt: '2026-11-03T12:30:00.000Z',
  planHash: 'c'.repeat(64),
  ready: true,
  totals: { create: 0, update: 0, unchanged: 1, keepLocal: 1, skip: 0, blocked: 0 },
  counts,
  blockers: [],
  warnings: ['Algunos valores locales distintos se conservarán; puedes aceptar el valor entrante por registro.'],
  reviewItems: [keepLocalItem],
  reviewItemsTruncated: false,
} satisfies ImportApplyPlan;
const acceptPlan: ImportApplyPlan = {
  ...keepPlan,
  planHash: 'd'.repeat(64),
  totals: { ...keepPlan.totals, update: 1, keepLocal: 0 },
  counts: { ...counts, resultsApplied: 1, conflictsNotApplied: 0 },
  warnings: [],
  reviewItems: [
    {
      ...keepLocalItem,
      action: 'update',
      reason: null,
      decision: 'accept_incoming',
      changes: [{ field: 'marcador', localValue: '3-1', incomingValue: '2-2', applied: true }],
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
const keptApply: ImportApplyOperation = {
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
    externalSeasonLabel: '2026/27',
    destinationSeasonId: seasonId,
    destinationSeasonLabel: '2026/27',
    appliedAt: time,
    counts,
    notApplied: [
      { resource: 'results', externalId: 'm1:result', title: RESULT_TITLE, action: 'keep_local', reason: KEEP_REASON },
    ],
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
  completeApplication() {
    this.listeners.get('operation.completed')?.(
      new MessageEvent('operation.completed', {
        data: JSON.stringify({
          id: 2,
          type: 'operation.completed',
          operationId: applyOperationId,
          status: 'completed',
          stage: null,
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

function renderReview(overrides: Partial<CompetitionsApi> = {}) {
  sessionStorage.setItem(`import-operation:${competitionId}`, operationId);
  const api = {
    getProviderBinding: vi.fn().mockResolvedValue(binding),
    get: vi.fn().mockResolvedValue(competition),
    listExternalSeasons: vi.fn().mockResolvedValue([externalSeason]),
    listSeasons: vi.fn().mockResolvedValue([] as ManagedSeason[]),
    getImportCapabilities: vi.fn().mockResolvedValue(preview.capabilities),
    startImportOperation: vi.fn(),
    getImportOperation: vi.fn().mockResolvedValue(completedPreviewOperation),
    cancelImportOperation: vi.fn(),
    getImportPreview: vi.fn().mockResolvedValue(preview),
    planImportApplication: vi.fn().mockResolvedValue(keepPlan),
    startImportApplication: vi.fn().mockResolvedValue(queuedApply),
    getImportApplication: vi.fn().mockResolvedValue(keptApply),
    cancelImportApplication: vi.fn(),
    ...overrides,
  } as unknown as CompetitionsApi;
  render(
    <MemoryRouter initialEntries={[`/competitions/${competitionId}/import`]}>
      <CompetitionsProvider api={api}>
        <Routes>
          <Route path="/competitions/:competitionId/import" element={<ImportPreviewPage />} />
        </Routes>
      </CompetitionsProvider>
    </MemoryRouter>,
  );
  return api;
}

async function openReview(overrides: Partial<CompetitionsApi> = {}) {
  const api = renderReview(overrides);
  await screen.findByRole('heading', { name: 'Vista previa preparada correctamente' });
  await userEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
  return api;
}

/** The "Valores locales protegidos" card of the plan review. */
async function protectedValues(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: 'Valores locales protegidos' });
  return heading.parentElement as HTMLElement;
}

async function confirmButton(): Promise<HTMLButtonElement> {
  const confirm = (await screen.findByRole('button', { name: 'Confirmar importación' })) as HTMLButtonElement;
  await waitFor(() => expect(confirm.disabled).toBe(false));
  return confirm;
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

describe('ImportPreviewPage: a provider value that contradicts a protected local value', () => {
  it('presents the preview conflict in words: both values, the kept local value and the reason', async () => {
    await openReview();
    expect(screen.getByRole('tab', { name: 'Resultados (1)' }).getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    const row = within(panel)
      .getByRole('rowheader', { name: /Club Alfa 2-2 Club Beta/ })
      .closest('tr') as HTMLElement;
    // The proposal is named, not only coloured.
    expect(within(row).getByText('Conflicto')).toBeTruthy();
    expect(row.textContent).toContain('Posible registro local: Club Alfa vs Club Beta');
    const summary = within(row).getByText('Revisar datos y diferencias');
    await userEvent.click(summary);
    const details = summary.closest('details') as HTMLElement;
    expect((details as HTMLDetailsElement).open).toBe(true);
    for (const text of [
      'Local: 3-1',
      'Entrante: 2-2',
      'Base importada: 2-1',
      'Se conserva el valor local por defecto.',
      'El marcador local se conserva como valor predeterminado.',
    ])
      expect(within(details).getByText(text)).toBeTruthy();
    // The summary of proposed operations counts the conflict by name.
    const operations = screen.getByRole('heading', { name: 'Operaciones propuestas' }).parentElement as HTMLElement;
    expect(within(operations).getByText('Conflictos').nextElementSibling?.textContent).toBe('1');
    // The preview itself has no control that writes the incoming value.
    expect(within(panel).queryByRole('button', { name: /aceptar|aplicar|reemplazar/i })).toBeNull();
  });

  it('keeps the local value by default and confirms without any decision', async () => {
    const api = await openReview();
    const card = await protectedValues();
    expect(card.textContent).toContain('Se conservan salvo que aceptes el valor entrante.');
    const item = within(card).getByText(RESULT_TITLE).closest('li') as HTMLElement;
    expect(item.textContent).toContain(KEEP_REASON);
    expect(item.textContent).toContain('marcador: local 3-1 · entrante 2-2 · se conserva el valor local');
    expect(within(item).getByText('Protegido')).toBeTruthy();
    const decision = within(item).getByRole('combobox', { name: `Decisión para resultado «${RESULT_TITLE}»` });
    expect((decision as HTMLSelectElement).value).toBe('');
    expect(within(decision).getByRole('option', { name: 'Conservar el valor local' })).toHaveProperty('selected', true);
    expect(within(decision).getByRole('option', { name: 'Aceptar el valor entrante' })).toHaveProperty(
      'selected',
      false,
    );
    expect(screen.getByText('Valores locales conservados').nextElementSibling?.textContent).toBe('1');
    expect(
      screen.getByText(
        'Algunos valores locales distintos se conservarán; puedes aceptar el valor entrante por registro.',
      ),
    ).toBeTruthy();

    await userEvent.click(await confirmButton());
    const dialog = screen.getByRole('dialog', { name: 'Confirmar importación' });
    expect(within(dialog).getByText('Valores locales conservados').nextElementSibling?.textContent).toBe('1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(api.startImportApplication).toHaveBeenCalledTimes(1));
    expect(api.startImportApplication).toHaveBeenCalledWith(competitionId, previewId, {
      decisions: [],
      planHash: keepPlan.planHash,
    });
    expect(api.planImportApplication).not.toHaveBeenCalledWith(
      competitionId,
      previewId,
      expect.arrayContaining([expect.objectContaining({ action: 'accept_incoming' })]),
      expect.anything(),
    );

    // The committed result says which value was kept and why.
    const stream = await waitFor(() => {
      const found = FakeEventSource.instances.find((source) => source.url.includes('import-applications'));
      expect(found).toBeDefined();
      return found as FakeEventSource;
    });
    stream.completeApplication();
    await screen.findByRole('heading', { name: 'Importación completada' });
    const saved = screen.getByRole('region', { name: 'Cambios guardados' });
    expect(within(saved).getByText('Conflictos no aplicados').nextElementSibling?.textContent).toBe('1');
    const notApplied = screen.getByText('Registros no aplicados (1)').closest('details') as HTMLElement;
    expect(notApplied.textContent).toContain(
      `Resultado «${RESULT_TITLE}»: se conservó el valor local — ${KEEP_REASON}`,
    );
  });

  it('replaces the protected value only through the explicit, labelled acceptance', async () => {
    const plan = vi
      .fn()
      .mockImplementation(async (_c: string, _p: string, decisions: unknown[]) =>
        decisions.length ? acceptPlan : keepPlan,
      );
    const api = await openReview({ planImportApplication: plan });
    const card = await protectedValues();
    const decision = within(card).getByRole('combobox', { name: `Decisión para resultado «${RESULT_TITLE}»` });
    await userEvent.selectOptions(decision, 'accept_incoming');
    const accept = {
      resource: 'results',
      externalId: 'm1:result',
      externalScope: 'copa-stub:2026',
      action: 'accept_incoming',
      localId: null,
    };
    await waitFor(() =>
      expect(plan).toHaveBeenLastCalledWith(competitionId, previewId, [accept], expect.any(AbortSignal)),
    );
    // The updated proposal says in words that the value will be replaced.
    await waitFor(() => expect(screen.getByText('Se actualizarán').nextElementSibling?.textContent).toBe('1'));
    expect(within(await protectedValues()).getByText(/se actualizará/)).toBeTruthy();
    expect(api.startImportApplication).not.toHaveBeenCalled();

    await userEvent.click(await confirmButton());
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() =>
      expect(api.startImportApplication).toHaveBeenCalledWith(competitionId, previewId, {
        decisions: [accept],
        planHash: acceptPlan.planHash,
      }),
    );
  });
});
