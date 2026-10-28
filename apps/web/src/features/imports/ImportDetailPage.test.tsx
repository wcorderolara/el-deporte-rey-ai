/**
 * Import detail page (getImport; R-067, R-276, R-277, R-278) at `/imports/:importId`: the import record, the original
 * download (T11H-F11), the selection versions and the project link; no request for an invalid address.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ImportDetailPage } from './ImportDetailPage';
import { createImportsApi } from './importsApi';
import { fakeFetch, IMPORT_ID_2, IMPORT_V2, jsonResponse, problemResponse, type Handler } from './testSupport';

afterEach(cleanup);

function renderAt(path: string, handler: Handler | Handler[] = () => jsonResponse(IMPORT_V2)) {
  const fake = fakeFetch({ [`GET /imports/${IMPORT_ID_2}`]: handler });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/imports/:importId" element={<ImportDetailPage api={createImportsApi({ fetch: fake.fetch })} />} />
      </Routes>
    </MemoryRouter>,
  );
  return fake;
}

describe('ImportDetailPage', () => {
  it('shows the import record, the original download, its new version and the project link', async () => {
    renderAt(`/imports/${IMPORT_ID_2}`);

    expect(screen.getByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Importación de «Liga Sintética», temporada «Temporada 2026»',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Archivo JSON')).toBeTruthy();
    expect(screen.getByText('jornada-1-corregida.json').closest('a')).toBeNull();
    expect(screen.getByText('2'.repeat(64))).toBeTruthy();
    expect(screen.getByText(/versión 2 \(nueva versión; las anteriores se conservan\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Apertura, jornada 1' }).getAttribute('href')).toBe(
      '/imports/versions/00000000-0000-4000-8000-0000000000c2',
    );
    const download = screen.getByRole('link', { name: 'Descargar original' });
    expect(download.getAttribute('href')).toBe(`/api/v1/imports/${IMPORT_ID_2}/original`);
    expect(download.hasAttribute('download')).toBe(true);
    expect(screen.getByText(/Abra los originales descargados como texto/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear un proyecto con «Liga Sintética»' }).getAttribute('href')).toBe(
      '/projects/new',
    );
  });

  it('makes no request for an address that is not an import identifier', () => {
    const { fetch } = renderAt('/imports/not-a-uuid');
    expect(screen.getByText('La dirección no identifica una importación válida.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries a failed load and reports a missing import', async () => {
    const user = userEvent.setup();
    renderAt(`/imports/${IMPORT_ID_2}`, [
      () => problemResponse(500, 'INTERNAL'),
      () => problemResponse(404, 'NOT_FOUND'),
    ]);
    expect(await screen.findByText('Ocurrió un error interno en el servidor local.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('El elemento solicitado no existe.')).toBeTruthy();
  });
});
