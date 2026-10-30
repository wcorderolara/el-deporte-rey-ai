import type { ManagedCompetition } from '@edr/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompetitionsApi } from '../api';
import { CompetitionsProvider } from '../CompetitionsContext';
import { CompetitionListPage } from './CompetitionListPage';
import { CompetitionDetailPage } from './CompetitionDetailPage';

afterEach(cleanup);

const first: ManagedCompetition = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Liga Local',
  createdAt: '2026-10-30T12:00:00Z',
  updatedAt: '2026-10-30T12:00:00Z',
};

describe('competition foundation page', () => {
  it('lists persisted competitions and creates a new one without leaving the section', async () => {
    const api: CompetitionsApi = {
      list: vi.fn().mockResolvedValue([first]),
      create: vi.fn().mockResolvedValue({ ...first, id: '22222222-2222-4222-8222-222222222222', name: 'Copa Local' }),
      get: vi.fn(),
    };
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
    const api: CompetitionsApi = { list: vi.fn(), create: vi.fn(), get: vi.fn().mockResolvedValue(first) };
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
});
