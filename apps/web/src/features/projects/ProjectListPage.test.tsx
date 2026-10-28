/**
 * Project list as the home page (R-200, R-235, R-269): history columns, demonstration label, data mode, loading,
 * empty and error states.
 */
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { fakeServer, json, MANUAL_PROJECT_ID, PROJECT_ID, renderApp, summaries } from './test/support';

afterEach(cleanup);

describe('Project list (home page)', () => {
  it('lists every project with the history columns, newest first', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => json({ projects: summaries }) });
    renderApp('/', server);

    const table = await screen.findByRole('table', { name: 'Proyectos e historial' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Título',
      'Competición y temporada',
      'Fase y jornada',
      'Fuente de datos',
      'Demostración',
      'Idioma',
      'Estado de aprobación',
      'Última exportación',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);

    const demo = rows[0];
    const manual = rows[1];
    if (demo === undefined || manual === undefined) {
      throw new Error('missing rows');
    }
    expect(within(demo).getByRole('link').getAttribute('href')).toBe(`/projects/${PROJECT_ID}`);
    expect(demo.textContent).toContain('Copa Continental Demo');
    expect(demo.textContent).toContain('2025-26');
    expect(demo.textContent).toContain('Fase de liga · Jornada 3');
    expect(demo.textContent).toContain('Fixtures de copa');
    expect(demo.textContent).toContain('Datos de demostración');
    expect(within(demo).getByText('Demostración')).toBeTruthy();
    expect(demo.textContent).toContain('Español');
    expect(demo.textContent).toContain('En revisión');
    expect(demo.textContent).toContain('Sin exportaciones');

    expect(within(manual).getByRole('link').getAttribute('href')).toBe(`/projects/${MANUAL_PROJECT_ID}`);
    expect(manual.textContent).toContain('Apertura · Fase completa');
    expect(manual.textContent).toContain('Datos manuales');
    expect(manual.textContent).not.toContain('Demostración');
    expect(manual.textContent).toContain('Inglés');
    expect(manual.textContent).toContain('Exportado');
    expect(
      within(manual)
        .getByText((_, element) => element?.tagName === 'TIME')
        .getAttribute('datetime'),
    ).toBe('2026-10-26T18:30:00Z');
    expect(server.unexpected).toEqual([]);
  });

  it('labels a demonstration project with text and a symbol, not colour alone (R-269)', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => json({ projects: summaries }) });
    renderApp('/projects', server);

    const table = await screen.findByRole('table');
    const label = within(table).getByText('Demostración', { selector: 'span' });
    expect(label.parentElement?.textContent).toContain('⚠');
  });

  it('offers the create page and has no form on the home page', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => json({ projects: [] }) });
    renderApp('/', server);

    expect(await screen.findByText('Todavía no hay proyectos.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Nuevo proyecto/ }).getAttribute('href')).toBe('/projects/new');
    expect(screen.getByRole('link', { name: 'Crear el primer proyecto' }).getAttribute('href')).toBe('/projects/new');
    expect(document.querySelector('form')).toBeNull();
  });

  it('shows a loading status, then an error with a retry that reloads the list', async () => {
    let attempts = 0;
    const server = fakeServer({
      'GET /api/v1/projects': () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError('connection refused');
        }
        return json({ projects: summaries });
      },
    });
    renderApp('/', server);

    expect(await screen.findByRole('status')).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar la lista de proyectos');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');

    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(server.callsTo('GET', '/api/v1/projects')).toHaveLength(2);
  });
});
