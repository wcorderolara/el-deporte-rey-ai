/** Nested routes of the imports feature under the `/imports/*` mount point of `app/routes.tsx`. */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ImportsFeature from './index';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  // The feature uses the application API; the platform fetch is replaced so that no request leaves the test.
  const fetch = vi.fn(() => new Promise<Response>(() => undefined));
  vi.stubGlobal('fetch', fetch);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/imports/*" element={<ImportsFeature />} />
      </Routes>
    </MemoryRouter>,
  );
  return fetch;
}

describe('ImportsFeature routes', () => {
  it('shows the imports page at /imports', () => {
    const fetch = renderAt('/imports');
    expect(screen.getByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/v1/imports', expect.objectContaining({ method: 'GET' }));
  });

  it('shows an import detail page at /imports/:importId, inside the feature heading', () => {
    const fetch = renderAt('/imports/00000000-0000-4000-8000-000000000003');
    expect(screen.getByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/imports/00000000-0000-4000-8000-000000000003',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('shows a version page at /imports/versions/:versionId', () => {
    renderAt('/imports/versions/00000000-0000-4000-8000-0000000000c1');
    expect(screen.getByRole('link', { name: 'Volver a las importaciones' })).toBeTruthy();
  });

  it('refuses an import address that is not an identifier without a request', () => {
    const fetch = renderAt('/imports/unknown');
    expect(screen.getByText('La dirección no identifica una importación válida.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the not-found page for any other address', () => {
    renderAt('/imports/unknown/deeper');
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeTruthy();
  });
});
