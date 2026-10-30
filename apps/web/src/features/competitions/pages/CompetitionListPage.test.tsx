import type { ManagedCompetition, ManagedSeason, ManagedTeam, SeasonParticipant } from '@edr/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompetitionsApi } from '../api';
import { CompetitionsProvider } from '../CompetitionsContext';
import { CompetitionListPage } from './CompetitionListPage';
import { CompetitionDetailPage } from './CompetitionDetailPage';
import { SeasonDetailPage } from './SeasonDetailPage';

afterEach(cleanup);

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

function apiStub(overrides: Partial<CompetitionsApi> = {}): CompetitionsApi {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    get: vi.fn(),
    listSeasons: vi.fn().mockResolvedValue([]),
    createSeason: vi.fn(),
    getSeason: vi.fn(),
    listTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn(),
    getTeam: vi.fn(),
    listParticipants: vi.fn().mockResolvedValue([]),
    addParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    ...overrides,
  };
}

describe('competition foundation page', () => {
  it('lists persisted competitions and creates a new one without leaving the section', async () => {
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
    expect(await screen.findByRole('heading', { name: 'Liga Local' })).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de la competición' }), 'Copa Local');
    await userEvent.click(screen.getByRole('button', { name: 'Crear competición' }));
    expect(await screen.findByRole('heading', { name: 'Copa Local' })).toBeTruthy();
    expect(api.create).toHaveBeenCalledWith({ name: 'Copa Local' });
    expect(api.list).toHaveBeenCalledTimes(1);
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
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre o periodo' }), '2026/27');
    await userEvent.click(screen.getByRole('button', { name: 'Crear temporada' }));
    expect(await screen.findByRole('heading', { name: '2026/27' })).toBeTruthy();
    expect(api.createSeason).toHaveBeenCalledWith(first.id, { label: '2026/27' });
  });

  it('creates a local team and associates it with the selected season', async () => {
    const participant: SeasonParticipant = { team, joinedAt: first.createdAt };
    const api = apiStub({
      getSeason: vi.fn().mockResolvedValue(season),
      listTeams: vi.fn().mockResolvedValue([]),
      listParticipants: vi.fn().mockResolvedValue([]),
      createTeam: vi.fn().mockResolvedValue(team),
      addParticipant: vi.fn().mockResolvedValue(participant),
    });
    render(
      <MemoryRouter initialEntries={[`/competitions/${first.id}/seasons/${season.id}`]}>
        <CompetitionsProvider api={api}>
          <Routes>
            <Route path="/competitions/:competitionId/seasons/:seasonId" element={<SeasonDetailPage />} />
          </Routes>
        </CompetitionsProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: '2026/27' });
    await userEvent.click(screen.getByText('Crear equipo local'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'Club Uno');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en el catálogo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Añadir a la temporada' }));
    expect(await screen.findByRole('heading', { name: 'Club Uno' })).toBeTruthy();
    expect(api.createTeam).toHaveBeenCalledWith({ name: 'Club Uno', region: null });
    expect(api.addParticipant).toHaveBeenCalledWith(first.id, season.id, team.id);
  });
});
