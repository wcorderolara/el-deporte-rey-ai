/**
 * Version page of a MANUAL_DATA selection (getManualVersion; R-278) at `/imports/versions/:versionId`: current or
 * superseded state, teams, matches with status and score as stored, standings or their absence, and no request for
 * an address that is not a server identifier.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createImportsApi } from './importsApi';
import { fakeFetch, jsonResponse, problemResponse, VERSION_1, VERSION_ID_1, type Handler } from './testSupport';
import { VersionPage } from './VersionPage';

afterEach(cleanup);

function renderAt(path: string, handler: Handler | Handler[] = () => jsonResponse(VERSION_1)) {
  const fake = fakeFetch({ [`GET /manual-data/versions/${VERSION_ID_1}`]: handler });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/imports/versions/:versionId"
          element={<VersionPage api={createImportsApi({ fetch: fake.fetch })} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return fake;
}

describe('VersionPage', () => {
  it('shows a superseded version with its teams, matches and no standings', async () => {
    renderAt(`/imports/versions/${VERSION_ID_1}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Versión 1: Apertura, jornada 1' })).toBeTruthy();
    expect(screen.getByText(/Versión anterior, sustituida el/)).toBeTruthy();
    expect(screen.getByText('Datos manuales')).toBeTruthy();
    const teams = screen.getByRole('table', { name: 'Equipos' });
    expect(within(teams).getByRole('rowheader', { name: 'Equipo Norte' })).toBeTruthy();
    const matches = screen.getByRole('table', { name: 'Partidos' });
    const row = within(matches).getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByText('Equipo Norte')).toBeTruthy();
    expect(within(row).getByText('Equipo Sur')).toBeTruthy();
    expect(within(row).getByText('Finalizado')).toBeTruthy();
    expect(within(row).getByText('2 - 1')).toBeTruthy();
    expect(screen.getByText('Esta versión no incluye clasificación.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a las importaciones' }).getAttribute('href')).toBe('/imports');
  });

  it('shows the current version, scheduled matches without score and the standings as stored', async () => {
    const current = {
      ...VERSION_1,
      supersededAt: null,
      selection: {
        ...VERSION_1.selection,
        matchday: null,
        matches: [{ ...VERSION_1.selection.matches[0], status: 'scheduled', score: null }],
        standings: {
          asOf: '2026-10-01T09:00:00Z',
          rows: [
            {
              position: 1,
              team: 'equipo-sur',
              played: 3,
              won: 2,
              drawn: 1,
              lost: 0,
              goalsFor: 5,
              goalsAgainst: 2,
              goalDifference: 3,
              points: 7,
            },
          ],
        },
      },
    };
    renderAt(`/imports/versions/${VERSION_ID_1}`, () => jsonResponse(current));

    expect(await screen.findByRole('heading', { level: 1, name: 'Versión 1: Apertura, fase completa' })).toBeTruthy();
    expect(screen.getByText(/Versión actual/)).toBeTruthy();
    expect(screen.getByText('Sin marcador')).toBeTruthy();
    const standings = screen.getByRole('table', { name: /Clasificación a fecha de/ });
    const row = within(standings).getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByRole('rowheader', { name: 'Equipo Sur' })).toBeTruthy();
    expect(within(row).getByText('7')).toBeTruthy();
  });

  it('makes no request for an address that is not a version identifier', () => {
    const { fetch } = renderAt('/imports/versions/not-a-uuid');
    expect(screen.getByText('La dirección no identifica una versión válida.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a missing version and retries a failed load', async () => {
    const user = userEvent.setup();
    renderAt(`/imports/versions/${VERSION_ID_1}`, [
      () => problemResponse(500, 'INTERNAL'),
      () => problemResponse(404, 'NOT_FOUND'),
    ]);
    expect(await screen.findByText('Ocurrió un error interno en el servidor local.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('El elemento solicitado no existe.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
