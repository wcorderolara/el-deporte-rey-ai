import type {
  CompetitionProviderBinding,
  ExternalCompetition,
  ManagedCompetition,
  ManagedSeason,
  ManagedTeam,
  SeasonParticipant,
  SportsProvider,
} from '@edr/contracts';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompetitionsApi } from '../api';
import { CompetitionsProvider } from '../CompetitionsContext';
import { CompetitionListPage } from './CompetitionListPage';
import { CompetitionDetailPage } from './CompetitionDetailPage';
import { SeasonDetailPage } from './SeasonDetailPage';
import { CompetitionTeamsPage } from './CompetitionTeamsPage';
import { ProviderBindingPanel } from '../components/ProviderBindingPanel';

afterEach(cleanup);

async function flushInitialLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const first: ManagedCompetition = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Liga Local',
  createdAt: '2026-10-30T12:00:00Z',
  updatedAt: '2026-10-30T12:00:00Z',
};
const season: ManagedSeason = {
  id: '22222222-2222-4222-8222-222222222222',
  competitionId: first.id,
  label: '2026/27',
  createdAt: first.createdAt,
};
const team: ManagedTeam = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Club Uno',
  region: null,
  createdAt: first.createdAt,
  updatedAt: first.updatedAt,
};
const awayTeam: ManagedTeam = { ...team, id: '44444444-4444-4444-8444-444444444444', name: 'Club Dos' };
const stage = {
  id: '55555555-5555-4555-8555-555555555555',
  seasonId: season.id,
  name: 'Fase de grupos',
  displayOrder: 0,
  createdAt: first.createdAt,
};
const round = {
  id: '66666666-6666-4666-8666-666666666666',
  seasonId: season.id,
  stageId: null,
  name: 'Jornada especial',
  displayOrder: 0,
  createdAt: first.createdAt,
};
const match = {
  id: '77777777-7777-4777-8777-777777777777',
  seasonId: season.id,
  stage: null,
  round: null,
  homeTeam: team,
  awayTeam,
  kickoffAt: null,
  status: 'scheduled' as const,
  homeScore: null,
  awayScore: null,
  createdAt: first.createdAt,
  updatedAt: first.updatedAt,
};

const providerA: SportsProvider = {
  key: 'test-live',
  name: 'Proveedor A',
  capabilities: { competitionCatalogue: true, seasons: true, stages: true },
  availability: 'available',
  availabilityMessage: null,
};
const providerB: SportsProvider = { ...providerA, key: 'test-other', name: 'Proveedor B' };
const externalLeague: ExternalCompetition = {
  externalCompetitionId: 'league-1',
  name: 'Liga de prueba',
  areaName: null,
};
const binding: CompetitionProviderBinding = {
  id: '88888888-8888-4888-8888-888888888888',
  competitionId: first.id,
  providerKey: providerA.key,
  providerName: providerA.name,
  externalCompetitionId: externalLeague.externalCompetitionId,
  externalCompetitionName: externalLeague.name,
  mode: 'provider',
  status: 'active',
  linkedAt: first.createdAt,
  unlinkedAt: null,
  createdAt: first.createdAt,
  updatedAt: first.updatedAt,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function apiStub(overrides: Partial<CompetitionsApi> = {}): CompetitionsApi {
  return {
    listSportsProviders: vi.fn().mockResolvedValue([]),
    listExternalCompetitions: vi.fn().mockResolvedValue([]),
    getProviderBinding: vi.fn().mockResolvedValue(null),
    setProviderBinding: vi.fn(),
    removeProviderBinding: vi.fn(),
    listExternalSeasons: vi.fn().mockResolvedValue([]),
    getImportCapabilities: vi.fn().mockResolvedValue([]),
    startImportOperation: vi.fn(),
    getImportOperation: vi.fn(),
    cancelImportOperation: vi.fn(),
    createImportPreview: vi.fn(),
    getImportPreview: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    get: vi.fn(),
    listSeasons: vi.fn().mockResolvedValue([]),
    createSeason: vi.fn(),
    updateSeason: vi.fn(),
    getSeason: vi.fn(),
    listTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    getTeam: vi.fn(),
    listCompetitionTeams: vi.fn().mockResolvedValue([]),
    addCompetitionTeam: vi.fn(),
    removeCompetitionTeam: vi.fn(),
    listParticipants: vi.fn().mockResolvedValue([]),
    addParticipant: vi.fn(),
    addParticipants: vi.fn(),
    removeParticipant: vi.fn(),
    listStages: vi.fn().mockResolvedValue([]),
    createStage: vi.fn(),
    updateStage: vi.fn(),
    getStage: vi.fn(),
    listSeasonRounds: vi.fn().mockResolvedValue([]),
    createSeasonRound: vi.fn(),
    updateRound: vi.fn(),
    deleteRound: vi.fn(),
    listStageRounds: vi.fn().mockResolvedValue([]),
    createStageRound: vi.fn(),
    getSeasonRound: vi.fn(),
    listMatches: vi.fn().mockResolvedValue([]),
    createMatch: vi.fn(),
    updateMatchSchedule: vi.fn(),
    updateMatchResult: vi.fn(),
    listMatchHistory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('competition foundation page', () => {
  it.each(['provider', 'hybrid'] as const)(
    'loads the catalogue automatically when entering %s mode with the preselected provider',
    async (mode) => {
      const api = apiStub({
        listSportsProviders: vi.fn().mockResolvedValue([providerA]),
        listExternalCompetitions: vi.fn().mockResolvedValue([externalLeague]),
      });
      render(
        <MemoryRouter>
          <CompetitionsProvider api={api}>
            <ProviderBindingPanel competitionId={first.id} />
          </CompetitionsProvider>
        </MemoryRouter>,
      );
      await screen.findByText('Manual · Los datos se administran localmente.');
      await flushInitialLoad();
      await userEvent.click(screen.getByRole('button', { name: 'Configurar fuente de datos' }));
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), mode);
      expect((screen.getByRole('combobox', { name: 'Proveedor' }) as HTMLSelectElement).value).toBe(providerA.key);
      expect(await screen.findByRole('option', { name: 'Liga de prueba' })).toBeTruthy();
      expect(api.listExternalCompetitions).toHaveBeenCalledWith(providerA.key, expect.any(AbortSignal));
    },
  );

  it('does not reload the same provider when changing Provider to Hybrid and preserves the selected competition', async () => {
    const api = apiStub({
      listSportsProviders: vi.fn().mockResolvedValue([providerA]),
      listExternalCompetitions: vi.fn().mockResolvedValue([externalLeague]),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <ProviderBindingPanel competitionId={first.id} />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Manual · Los datos se administran localmente.');
    await flushInitialLoad();
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar fuente de datos' }));
    const modeSelect = screen.getByRole('combobox', { name: 'Modo de administración' });
    await userEvent.selectOptions(modeSelect, 'provider');
    const externalSelect = screen.getByRole('combobox', { name: 'Competición externa' });
    await screen.findByRole('option', { name: externalLeague.name });
    await userEvent.selectOptions(externalSelect, externalLeague.externalCompetitionId);
    await userEvent.selectOptions(modeSelect, 'hybrid');
    expect((externalSelect as HTMLSelectElement).value).toBe(externalLeague.externalCompetitionId);
    expect(api.listExternalCompetitions).toHaveBeenCalledTimes(1);
  });

  it('hydrates an existing binding, loads its provider catalogue, and retains the linked external competition', async () => {
    const api = apiStub({
      listSportsProviders: vi.fn().mockResolvedValue([providerA]),
      getProviderBinding: vi.fn().mockResolvedValue(binding),
      listExternalCompetitions: vi.fn().mockResolvedValue([externalLeague]),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <ProviderBindingPanel competitionId={first.id} />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar fuente' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => {
      expect(
        (within(dialog).getByRole('combobox', { name: 'Modo de administración' }) as HTMLSelectElement).value,
      ).toBe('provider');
      expect((within(dialog).getByRole('combobox', { name: 'Proveedor' }) as HTMLSelectElement).value).toBe(
        providerA.key,
      );
      expect((within(dialog).getByRole('combobox', { name: 'Competición externa' }) as HTMLSelectElement).value).toBe(
        externalLeague.externalCompetitionId,
      );
    });
    expect(api.listExternalCompetitions).toHaveBeenCalledTimes(1);
  });

  it('discards out-of-order catalogue responses after the selected provider changes', async () => {
    const firstResponse = deferred<ExternalCompetition[]>();
    const secondResponse = deferred<ExternalCompetition[]>();
    const otherLeague: ExternalCompetition = {
      externalCompetitionId: 'league-2',
      name: 'Liga del proveedor B',
      areaName: null,
    };
    const api = apiStub({
      listSportsProviders: vi.fn().mockResolvedValue([providerA, providerB]),
      listExternalCompetitions: vi.fn((key) =>
        key === providerA.key ? firstResponse.promise : secondResponse.promise,
      ),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <ProviderBindingPanel competitionId={first.id} />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Manual · Los datos se administran localmente.');
    await flushInitialLoad();
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar fuente de datos' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), 'provider');
    await waitFor(() => expect(api.listExternalCompetitions).toHaveBeenCalledTimes(1));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Proveedor' }), providerB.key);
    await waitFor(() => expect(api.listExternalCompetitions).toHaveBeenCalledTimes(2));

    await act(async () => secondResponse.resolve([otherLeague]));
    expect(await screen.findByRole('option', { name: otherLeague.name })).toBeTruthy();
    await act(async () => firstResponse.resolve([externalLeague]));
    expect(screen.queryByRole('option', { name: externalLeague.name })).toBeNull();
    expect((screen.getByRole('combobox', { name: 'Competición externa' }) as HTMLSelectElement).value).toBe('');
  });

  it('shows a recoverable error when the catalogue request fails', async () => {
    const api = apiStub({
      listSportsProviders: vi.fn().mockResolvedValue([providerA]),
      listExternalCompetitions: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <ProviderBindingPanel competitionId={first.id} />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Manual · Los datos se administran localmente.');
    await flushInitialLoad();
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar fuente de datos' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), 'provider');
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert.textContent).toContain('No se pudieron cargar las competiciones');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('waits for a provider selection instead of requesting the catalogue with an empty key', async () => {
    const api = apiStub({
      listSportsProviders: vi.fn().mockResolvedValue([providerA]),
      listExternalCompetitions: vi.fn().mockResolvedValue([externalLeague]),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <ProviderBindingPanel competitionId={first.id} />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Manual · Los datos se administran localmente.');
    await flushInitialLoad();
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar fuente de datos' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), 'provider');
    await screen.findByRole('option', { name: providerA.name });
    vi.mocked(api.listExternalCompetitions).mockClear();
    const providerSelect = screen.getByRole('combobox', { name: 'Proveedor' });
    await userEvent.selectOptions(providerSelect, '');
    const externalSelect = screen.getByRole('combobox', { name: 'Competición externa' });
    expect((externalSelect as HTMLSelectElement).value).toBe('');
    expect((externalSelect as HTMLSelectElement).disabled).toBe(true);
    expect(api.listExternalCompetitions).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Selecciona primero un proveedor' })).toBeTruthy();
  });

  it('shows competitions in a table by default and creates one from a modal', async () => {
    const api = apiStub({
      list: vi.fn().mockResolvedValue([first]),
      create: vi.fn().mockResolvedValue({ ...first, id: '22222222-2222-4222-8222-222222222222', name: 'Copa Local' }),
    });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <CompetitionListPage />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Tus competiciones' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver competición Liga Local' }).getAttribute('href')).toBe(
      `/competitions/${first.id}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear competición' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre de la competición' }), 'Copa Local');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear competición' }));
    expect(await screen.findByRole('rowheader', { name: 'Copa Local' })).toBeTruthy();
    expect(api.create).toHaveBeenCalledWith({ name: 'Copa Local' });
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('switches competition list to cards and supports modal cancellation without creating', async () => {
    const api = apiStub({ list: vi.fn().mockResolvedValue([first]) });
    render(
      <MemoryRouter>
        <CompetitionsProvider api={api}>
          <CompetitionListPage />
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('rowheader', { name: 'Liga Local' });
    await userEvent.click(screen.getByRole('button', { name: 'Vista de tarjetas' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Liga Local' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Crear competición' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nombre de la competición' }), 'No crear');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('loads the selected competition detail through its local identifier', async () => {
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listSeasons: vi.fn().mockResolvedValue([]),
      createSeason: vi.fn().mockResolvedValue(season),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId" element={<CompetitionDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Liga Local' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Equipos' }).getAttribute('href')).toBe(`/competitions/${first.id}/teams`);
    expect(api.get).toHaveBeenCalledWith(first.id, expect.any(AbortSignal));
  });

  it('creates a season from the competition workspace', async () => {
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listSeasons: vi.fn().mockResolvedValue([]),
      createSeason: vi.fn().mockResolvedValue(season),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId" element={<CompetitionDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Liga Local' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear temporada' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre o periodo' }), '2026/27');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(await screen.findByRole('rowheader', { name: '2026/27' })).toBeTruthy();
    expect(api.createSeason).toHaveBeenCalledWith(first.id, { label: '2026/27' });
  });

  it('links an external competition only after explicit selection and confirmation', async () => {
    const external = {
      externalCompetitionId: 'league-test',
      name: 'Liga externa de prueba',
      areaName: 'Región de prueba',
    };
    const binding = {
      id: '88888888-8888-4888-8888-888888888888',
      competitionId: first.id,
      providerKey: 'test-provider',
      providerName: 'Proveedor de prueba',
      externalCompetitionId: 'league-test',
      externalCompetitionName: 'Liga externa de prueba',
      mode: 'provider' as const,
      status: 'active' as const,
      linkedAt: first.createdAt,
      unlinkedAt: null,
      createdAt: first.createdAt,
      updatedAt: first.updatedAt,
    };
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listSeasons: vi.fn().mockResolvedValue([]),
      listSportsProviders: vi.fn().mockResolvedValue([
        {
          key: 'test-provider',
          name: 'Proveedor de prueba',
          capabilities: { competitionCatalogue: true, seasons: true, stages: true },
          availability: 'available',
          availabilityMessage: null,
        },
      ]),
      listExternalCompetitions: vi.fn().mockResolvedValue([external]),
      setProviderBinding: vi.fn().mockResolvedValue(binding),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId" element={<CompetitionDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Liga Local' });
    await flushInitialLoad();
    await userEvent.click(screen.getByRole('button', { name: 'Configurar fuente de datos' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), 'provider');
    await screen.findByRole('option', { name: 'Proveedor de prueba' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Proveedor' }), 'test-provider');
    expect(api.listExternalCompetitions).toHaveBeenCalledWith('test-provider', expect.any(AbortSignal));
    await screen.findByRole('option', { name: 'Liga externa de prueba · Región de prueba' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Competición externa' }), 'league-test');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(api.setProviderBinding).toHaveBeenCalledWith(first.id, {
      providerKey: 'test-provider',
      externalCompetitionId: 'league-test',
      mode: 'provider',
    });
    expect(await screen.findByText(/Proveedor de prueba · Liga externa de prueba/)).toBeTruthy();
  });

  it('shows Manual by default and explains an unconfigured provider without exposing empty external data', async () => {
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listSeasons: vi.fn().mockResolvedValue([]),
      listSportsProviders: vi.fn().mockResolvedValue([
        {
          key: 'provider-test',
          name: 'Fuente de prueba',
          capabilities: { competitionCatalogue: true, seasons: true, stages: true },
          availability: 'not_configured',
          availabilityMessage: 'El administrador debe configurar el proveedor y sus credenciales en el servidor.',
        },
      ]),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId" element={<CompetitionDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Liga Local' });
    await userEvent.click(screen.getByRole('button', { name: 'Configurar fuente de datos' }));
    expect((screen.getByRole('combobox', { name: 'Modo de administración' }) as HTMLSelectElement).value).toBe(
      'manual',
    );
    expect(screen.queryByLabelText('Proveedor')).toBeNull();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo de administración' }), 'hybrid');
    await screen.findByRole('option', { name: 'Fuente de prueba · No disponible' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Proveedor' }), 'provider-test');
    expect(await screen.findByText(/configurar el proveedor y sus credenciales en el servidor/i)).toBeTruthy();
    expect(api.listExternalCompetitions).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Guardar configuración' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.setProviderBinding).not.toHaveBeenCalled();
    expect(api.removeProviderBinding).not.toHaveBeenCalled();
  });

  it('searches reusable catalogue teams and creates new competition teams', async () => {
    const association = { team, associatedAt: first.createdAt };
    const addCompetitionTeam = vi.fn().mockResolvedValue(association);
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listCompetitionTeams: vi.fn().mockResolvedValue([]),
      listTeams: vi.fn().mockResolvedValue([team]),
      addCompetitionTeam,
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/teams`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/teams" element={<CompetitionTeamsPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Liga Local' });
    await userEvent.click(screen.getByRole('button', { name: 'Agregar equipo' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Puedes reutilizar equipos registrados en otras competiciones o crear uno nuevo.'),
    ).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Buscar equipo por nombre' }), 'Club Uno');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Club Uno/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar equipo' }));
    expect(addCompetitionTeam).toHaveBeenCalledWith(first.id, { teamId: team.id });

    await userEvent.click(screen.getByRole('button', { name: 'Agregar equipo' }));
    const createDialog = screen.getByRole('dialog');
    await userEvent.click(within(createDialog).getByRole('button', { name: 'Nuevo equipo' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'Club Nuevo');
    await userEvent.click(within(createDialog).getByRole('button', { name: 'Agregar equipo' }));
    expect(addCompetitionTeam).toHaveBeenCalledWith(first.id, { name: 'Club Nuevo', region: null });
  });

  it('edits the global team and confirms removing only its competition association', async () => {
    const association = { team, associatedAt: first.createdAt };
    const updated = { ...team, name: 'Club Uno Actualizado', region: 'Ciudad Nueva' };
    const api = apiStub({
      get: vi.fn().mockResolvedValue(first),
      listCompetitionTeams: vi.fn().mockResolvedValue([association]),
      listTeams: vi.fn().mockResolvedValue([team]),
      updateTeam: vi.fn().mockResolvedValue(updated),
      removeCompetitionTeam: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/teams`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/teams" element={<CompetitionTeamsPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('rowheader', { name: 'Club Uno' });
    expect(screen.queryByRole('link', { name: 'Ver temporadas' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Editar equipo' }));
    const editDialog = screen.getByRole('dialog');
    await userEvent.clear(within(editDialog).getByRole('textbox', { name: 'Nombre del equipo' }));
    await userEvent.type(within(editDialog).getByRole('textbox', { name: 'Nombre del equipo' }), updated.name);
    await userEvent.clear(within(editDialog).getByRole('textbox', { name: 'Zona o ciudad (opcional)' }));
    await userEvent.type(
      within(editDialog).getByRole('textbox', { name: 'Zona o ciudad (opcional)' }),
      updated.region!,
    );
    await userEvent.click(within(editDialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('rowheader', { name: updated.name })).toBeTruthy();
    expect(api.updateTeam).toHaveBeenCalledWith(team.id, { name: updated.name, region: updated.region });

    await userEvent.click(screen.getByRole('button', { name: 'Quitar de competición' }));
    const removeDialog = screen.getByRole('dialog');
    expect(within(removeDialog).getByText(/El equipo global se conservará/)).toBeTruthy();
    await userEvent.click(within(removeDialog).getByRole('button', { name: 'Quitar de competición' }));
    expect(api.removeCompetitionTeam).toHaveBeenCalledWith(first.id, team.id);
    expect(await screen.findByText('Aún no hay equipos asociados')).toBeTruthy();
  });

  it('adds multiple competition-associated teams to a season in one action', async () => {
    const participant: SeasonParticipant = { team, joinedAt: first.createdAt };
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([]),
      listCompetitionTeams: vi.fn().mockResolvedValue([
        { team, associatedAt: first.createdAt },
        { team: awayTeam, associatedAt: first.createdAt },
      ]),
      listParticipants: vi.fn().mockResolvedValue([]),
      addParticipants: vi.fn().mockResolvedValue([participant, { team: awayTeam, joinedAt: first.createdAt }]),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/participants`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/participants" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: '2026/27' });
    expect(screen.queryByText('Crear equipo local')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar participantes' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Club Uno' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Club Dos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar seleccionados' }));
    expect(await screen.findByRole('rowheader', { name: 'Club Uno' })).toBeTruthy();
    expect(api.addParticipants).toHaveBeenCalledWith(first.id, season.id, [team.id, awayTeam.id]);
  });

  it('shows participants in a table by default and switches to compact cards', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listCompetitionTeams: vi.fn().mockResolvedValue([{ team, associatedAt: first.createdAt }]),
      listParticipants: vi.fn().mockResolvedValue([{ team, joinedAt: first.createdAt }]),
      listTeams: vi.fn().mockResolvedValue([]),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/participants`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/participants" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '2026/27' });
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vista de tabla' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Quitar Club Uno de esta temporada' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Vista de tarjetas' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Club Uno' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vista de tarjetas' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Quitar Club Uno de esta temporada' })).toBeTruthy();
  });

  it('keeps enrolled teams visible and reports no remaining teams only inside the add modal', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listCompetitionTeams: vi.fn().mockResolvedValue([{ team, associatedAt: first.createdAt }]),
      listParticipants: vi.fn().mockResolvedValue([{ team, joinedAt: first.createdAt }]),
      listTeams: vi.fn().mockResolvedValue([]),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/participants`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/participants" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '2026/27' });
    expect(screen.getByRole('rowheader', { name: 'Club Uno' })).toBeTruthy();
    expect(screen.queryByText('No hay equipos disponibles para agregar')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar participantes' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('No hay más equipos disponibles para inscribir.')).toBeTruthy();
    expect(
      within(dialog).getByText('Todos los equipos asociados a la competición ya participan en esta temporada.'),
    ).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a contextual empty state only when a season has no enrolled participants', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listCompetitionTeams: vi.fn().mockResolvedValue([{ team, associatedAt: first.createdAt }]),
      listParticipants: vi.fn().mockResolvedValue([]),
      listTeams: vi.fn().mockResolvedValue([]),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/participants`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/participants" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '2026/27' });
    expect(screen.getByText('Esta temporada todavía no tiene equipos inscritos')).toBeTruthy();
    expect(screen.queryByText('No hay equipos disponibles para agregar')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar participantes' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: 'Club Uno' })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  });

  it('creates optional calendar groups without inventing a score', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([team, awayTeam]),
      listParticipants: vi.fn().mockResolvedValue([
        { team, joinedAt: first.createdAt },
        { team: awayTeam, joinedAt: first.createdAt },
      ]),
      createStage: vi.fn().mockResolvedValue(stage),
      createSeasonRound: vi.fn().mockResolvedValue(round),
      createStageRound: vi.fn().mockResolvedValue({ ...round, stageId: stage.id }),
      updateStage: vi
        .fn()
        .mockImplementation((_competitionId, _seasonId, id, input) =>
          Promise.resolve({ ...stage, id, name: input.name }),
        ),
      createMatch: vi.fn().mockImplementation((_competitionId, _seasonId, input) =>
        Promise.resolve({
          ...match,
          stage: input.stageId ? { id: input.stageId, name: stage.name } : null,
          round: input.roundId ? { id: input.roundId, name: round.name } : null,
        }),
      ),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/calendar" element={<SeasonDetailPage />} />
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/stages/:stageId"
              element={<SeasonDetailPage />}
            />
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/stages/:stageId/rounds/:roundId"
              element={<SeasonDetailPage />}
            />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Calendario' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear fase' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de fase' }), 'Fase de grupos');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Fase de grupos' }));
    await screen.findByRole('heading', { name: 'Fase de grupos' });
    expect(screen.getByRole('link', { name: 'Regresar al calendario' }).getAttribute('href')).toBe(
      `/competitions/${first.id}/seasons/${season.id}/calendar`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nombre de fase' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de fase' }), 'Fase principal');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('heading', { name: 'Fase principal' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Crear jornada' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de jornada o ronda' }), 'Jornada especial');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(await screen.findByRole('heading', { name: 'Jornada especial' })).toBeTruthy();
    expect(api.createStageRound).toHaveBeenCalledWith(first.id, season.id, stage.id, { name: 'Jornada especial' });
    expect(api.updateStage).toHaveBeenCalledWith(first.id, season.id, stage.id, { name: 'Fase principal' });
  });

  it('shows only the selected calendar tab panel', async () => {
    const api = apiStub({ getSeason: vi.fn().mockResolvedValue(season) });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId/calendar" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Calendario' });
    const stagesPanel = document.getElementById('calendar-organization-panel-stages')!;
    const directPanel = document.getElementById('calendar-organization-panel-direct')!;
    expect(stagesPanel.className.split(' ')).toContain('grid');
    expect(directPanel.className.split(' ')).toContain('hidden');
    expect(directPanel.hasAttribute('hidden')).toBe(true);

    await userEvent.click(screen.getByRole('tab', { name: 'Jornadas directas' }));
    expect(stagesPanel.className.split(' ')).toContain('hidden');
    expect(stagesPanel.hasAttribute('hidden')).toBe(true);
    expect(directPanel.className.split(' ')).toContain('grid');
    expect(directPanel.hasAttribute('hidden')).toBe(false);
  });

  it('loads a season detail when calendar collections are empty', async () => {
    const api = apiStub({ get: vi.fn().mockResolvedValue(first), getSeason: vi.fn().mockResolvedValue(season) });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '2026/27' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Calendario' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Regresar a Liga Local' }).getAttribute('href')).toBe(
      `/competitions/${first.id}`,
    );
    expect(screen.getByRole('link', { name: 'Competiciones' }).getAttribute('href')).toBe('/competitions');
    expect(api.listStages).toHaveBeenCalledWith(first.id, season.id, expect.any(AbortSignal));
    expect(api.listSeasonRounds).toHaveBeenCalledWith(first.id, season.id, expect.any(AbortSignal));
    expect(api.listMatches).toHaveBeenCalledWith(first.id, season.id, expect.any(AbortSignal));
  });

  it('shows no score for a scheduled match and accepts an explicit finished 0–0 result', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([team, awayTeam]),
      listParticipants: vi.fn().mockResolvedValue([
        { team, joinedAt: first.createdAt },
        { team: awayTeam, joinedAt: first.createdAt },
      ]),
      listMatches: vi.fn().mockResolvedValue([match]),
      updateMatchResult: vi.fn().mockResolvedValue({ ...match, status: 'finished', homeScore: 0, awayScore: 0 }),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar/unassigned`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/unassigned"
              element={<SeasonDetailPage />}
            />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('vs')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Regresar al calendario' }).getAttribute('href')).toBe(
      `/competitions/${first.id}/seasons/${season.id}/calendar`,
    );
    await userEvent.click(screen.getByText('Registrar o corregir resultado'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado del partido' }), 'finished');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Marcador · Club Uno' }), '0');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Marcador · Club Dos' }), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar estado y marcador' }));
    expect(await screen.findByText('0 – 0')).toBeTruthy();
    expect(api.updateMatchResult).toHaveBeenCalledWith(first.id, season.id, match.id, {
      status: 'finished',
      homeScore: 0,
      awayScore: 0,
    });
  });

  it('allows editing a cancelled match to in progress with its score fields still editable', async () => {
    const cancelledMatch = { ...match, status: 'cancelled' as const };
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([team, awayTeam]),
      listParticipants: vi.fn().mockResolvedValue([
        { team, joinedAt: first.createdAt },
        { team: awayTeam, joinedAt: first.createdAt },
      ]),
      listMatches: vi.fn().mockResolvedValue([cancelledMatch]),
      updateMatchResult: vi
        .fn()
        .mockResolvedValue({ ...cancelledMatch, status: 'in_progress', homeScore: 1, awayScore: 2 }),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar/unassigned`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/unassigned"
              element={<SeasonDetailPage />}
            />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByText('vs');
    await userEvent.click(screen.getByText('Registrar o corregir resultado'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado del partido' }), 'in_progress');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Marcador · Club Uno' }), '1');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Marcador · Club Dos' }), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar estado y marcador' }));
    expect(api.updateMatchResult).toHaveBeenCalledWith(first.id, season.id, match.id, {
      status: 'in_progress',
      homeScore: 1,
      awayScore: 2,
    });
  });

  it('opens a round detail and adds a match to that round context', async () => {
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([team, awayTeam]),
      listParticipants: vi.fn().mockResolvedValue([
        { team, joinedAt: first.createdAt },
        { team: awayTeam, joinedAt: first.createdAt },
      ]),
      listSeasonRounds: vi.fn().mockResolvedValue([round]),
      createMatch: vi.fn().mockResolvedValue({ ...match, round: { id: round.id, name: round.name } }),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar/rounds/${round.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/rounds/:roundId"
              element={<SeasonDetailPage />}
            />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Jornada especial' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Regresar al calendario' }).getAttribute('href')).toBe(
      `/competitions/${first.id}/seasons/${season.id}/calendar`,
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Agregar partido' }).at(-1)!);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Equipo local' }), team.id);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Equipo visitante' }), awayTeam.id);
    await userEvent.click(screen.getAllByRole('button', { name: 'Agregar partido' }).at(-1)!);
    expect(api.createMatch).toHaveBeenCalledWith(first.id, season.id, {
      homeTeamId: team.id,
      awayTeamId: awayTeam.id,
      kickoffAt: null,
      stageId: null,
      roundId: round.id,
    });
  });

  it('keeps a round open in its new phase context after reassignment', async () => {
    const movedRound = { ...round, stageId: stage.id };
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listStages: vi.fn().mockResolvedValue([stage]),
      listSeasonRounds: vi.fn().mockResolvedValueOnce([round]).mockResolvedValue([]),
      listStageRounds: vi.fn().mockResolvedValue([movedRound]),
      listMatches: vi
        .fn()
        .mockResolvedValue([
          { ...match, stage: { id: stage.id, name: stage.name }, round: { id: round.id, name: round.name } },
        ]),
      updateRound: vi.fn().mockResolvedValue(movedRound),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}/calendar/rounds/${round.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/rounds/:roundId"
              element={<SeasonDetailPage />}
            />
            <Route
              path="/competitions/:competitionId/seasons/:seasonId/calendar/stages/:stageId/rounds/:roundId"
              element={<SeasonDetailPage />}
            />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Jornada especial' });
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Fase' }), stage.id);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(api.updateRound).toHaveBeenCalledWith(first.id, season.id, round.id, {
      name: round.name,
      stageId: stage.id,
    });
    expect(await screen.findByRole('link', { name: 'Fase de grupos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: `Regresar a ${stage.name}` }).getAttribute('href')).toBe(
      `/competitions/${first.id}/seasons/${season.id}/calendar/stages/${stage.id}`,
    );
  });
});
