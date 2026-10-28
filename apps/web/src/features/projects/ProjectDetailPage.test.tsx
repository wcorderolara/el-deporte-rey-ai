/**
 * Project detail (R-200, R-203, R-236, R-269): selection, source and mode, demonstration banner, links, language
 * change, start run, per-stage status with failure reason, restart, and polling of the active run.
 */
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  fakeServer,
  json,
  MANUAL_PROJECT_ID,
  manualProject,
  NEW_RUN_ID,
  problem,
  project,
  PROJECT_ID,
  renderApp,
  run,
  RUN_ID,
} from './test/support';

afterEach(cleanup);

const PROJECT = `GET /api/v1/projects/${PROJECT_ID}`;
const RUNS = `POST /api/v1/projects/${PROJECT_ID}/runs`;

function stageRow(name: string): HTMLElement {
  const table = screen.getByRole('table', { name: 'Estado de cada etapa' });
  const header = within(table).getByRole('rowheader', { name });
  const row = header.closest('tr');
  if (row === null) {
    throw new Error('missing row');
  }
  return row;
}

describe('Project detail: selection and links (R-200, R-269)', () => {
  it('shows competition, season, stage, matchday, source and mode, with the demonstration banner', async () => {
    const server = fakeServer({
      [PROJECT]: () =>
        json(project({ latestRun: run(['completed', 'completed', 'completed', 'completed', 'completed']) })),
    });
    renderApp(`/projects/${PROJECT_ID}`, server);

    expect(await screen.findByRole('heading', { level: 1, name: project().title })).toBeTruthy();
    const selection = screen.getByRole('region', { name: 'Selección' });
    const text = selection.textContent ?? '';
    for (const value of [
      'Copa Continental Demo',
      '2025-26',
      'Fase de liga',
      'Jornada 3',
      'Fixtures de copa',
      'Datos de demostración',
      'En revisión',
      'Sin exportaciones',
    ]) {
      expect(text).toContain(value);
    }
    const banner = screen.getByRole('note', { name: 'Contenido de demostración' });
    expect(banner.textContent).toContain('no deben publicarse');

    const sections = screen.getByRole('navigation', { name: 'Secciones del proyecto' });
    const links = within(sections).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Datos y verificación (ejecución 1)', `/projects/${PROJECT_ID}/runs/${RUN_ID}/facts`],
      ['Revisión y aprobación', `/projects/${PROJECT_ID}/review`],
      ['Exportaciones e historial', `/projects/${PROJECT_ID}/exports`],
    ]);
  });

  it('links a MANUAL_DATA project to the import page, without a demonstration banner', async () => {
    const server = fakeServer({ [`GET /api/v1/projects/${MANUAL_PROJECT_ID}`]: () => json(manualProject()) });
    renderApp(`/projects/${MANUAL_PROJECT_ID}`, server);

    await screen.findByRole('heading', { level: 1, name: manualProject().title });
    expect(screen.queryByRole('note', { name: 'Contenido de demostración' })).toBeNull();
    const selection = screen.getByRole('region', { name: 'Selección' });
    expect(selection.textContent).toContain('Fase completa');
    expect(selection.textContent).toContain('Datos manuales');
    expect(selection.textContent).toContain('atestiguado por el operador');
    const sections = screen.getByRole('navigation', { name: 'Secciones del proyecto' });
    expect(within(sections).getByRole('link', { name: 'Importaciones manuales' }).getAttribute('href')).toBe(
      '/imports',
    );
    expect(sections.textContent).toContain('disponibles después de la primera ejecución');
    expect(within(sections).queryByRole('link', { name: /Datos y verificación/ })).toBeNull();
  });

  it('shows a not-found message for an address that is no project, without any request', async () => {
    const server = fakeServer({});
    renderApp('/projects/not-a-project', server);

    expect(await screen.findByText('La dirección no corresponde a ningún proyecto.')).toBeTruthy();
    expect(server.calls).toEqual([]);
  });

  it('shows an unknown project as an error', async () => {
    const server = fakeServer({ [PROJECT]: () => problem({ status: 404, code: 'NOT_FOUND' }) });
    renderApp(`/projects/${PROJECT_ID}`, server);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el proyecto');
    expect(alert.textContent).toContain('El elemento solicitado no existe.');
    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeTruthy();
  });
});

describe('Project detail: language (R-236)', () => {
  it('changes the content language and asks for a redraft', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [PROJECT]: () => json(project()),
      [`PATCH /api/v1/projects/${PROJECT_ID}`]: () => json(project({ language: 'en' })),
    });
    renderApp(`/projects/${PROJECT_ID}`, server);

    const select = (await screen.findByRole('combobox', { name: 'Idioma' })) as HTMLSelectElement;
    expect(select.value).toBe('es');
    const save = screen.getByRole('button', { name: 'Cambiar idioma' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.selectOptions(select, 'en');
    await user.click(save);

    expect(await screen.findByText(/Idioma cambiado a Inglés/)).toBeTruthy();
    const [patch] = server.callsTo('PATCH', `/api/v1/projects/${PROJECT_ID}`);
    expect(patch?.body).toEqual({ language: 'en' });
    expect(patch?.headers['X-EDR-Client']).toBe('web');
  });
});

describe('Project detail: runs (R-203)', () => {
  it('starts a full run and polls it, showing each stage status until it completes', async () => {
    const user = userEvent.setup();
    const states = [
      run(['running'], { id: NEW_RUN_ID }),
      run(['completed', 'running'], { id: NEW_RUN_ID }),
      run(['completed', 'completed', 'completed', 'completed', 'completed'], { id: NEW_RUN_ID }),
    ];
    let polls = 0;
    const server = fakeServer({
      [PROJECT]: () => json(project()),
      [RUNS]: () => json(run([], { id: NEW_RUN_ID }), 202),
      [`GET /api/v1/projects/${PROJECT_ID}/runs/${NEW_RUN_ID}`]: () => {
        const state = states[Math.min(polls, states.length - 1)];
        polls += 1;
        return json(state);
      },
    });
    renderApp(`/projects/${PROJECT_ID}`, server);

    expect(await screen.findByText('El proyecto todavía no tiene ejecuciones.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Iniciar ejecución completa' }));

    const [post] = server.callsTo('POST', `/api/v1/projects/${PROJECT_ID}/runs`);
    expect(post?.body).toEqual({ kind: 'full' });
    expect(post?.headers['X-EDR-Client']).toBe('web');

    expect(await screen.findByText(/Ejecución 1: completada\./, {}, { timeout: 3000 })).toBeTruthy();
    for (const name of [
      'Obtención de datos',
      'Verificación',
      'Redacción del contenido',
      'Generación de imágenes',
      'Control visual',
    ]) {
      expect(stageRow(name).textContent).toContain('Completada');
      expect(stageRow(name).textContent).toContain('✓');
    }
    expect(polls).toBeGreaterThanOrEqual(3);
    const pollsAtEnd = polls;
    // Finished: the project is refreshed once and polling stops.
    await screen.findByRole('button', { name: 'Iniciar ejecución completa' });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(polls).toBe(pollsAtEnd);
    expect(server.callsTo('GET', `/api/v1/projects/${PROJECT_ID}`).length).toBeGreaterThanOrEqual(2);
    expect(server.unexpected).toEqual([]);
  });

  it('disables starting another run while a run is active', async () => {
    const server = fakeServer({
      [PROJECT]: () => json(project({ latestRun: run(['completed', 'running']) })),
      [`GET /api/v1/projects/${PROJECT_ID}/runs/${RUN_ID}`]: () => json(run(['completed', 'running'])),
    });
    renderApp(`/projects/${PROJECT_ID}`, server, 1000);

    const start = (await screen.findByRole('button', { name: 'Iniciar ejecución completa' })) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Volver a redactar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Hay una ejecución en curso/)).toBeTruthy();
    expect(screen.getByText(/Ejecución 1: en curso\. Verificación: en curso\./)).toBeTruthy();
    expect(stageRow('Obtención de datos').textContent).toContain('Completada');
    expect(stageRow('Verificación').textContent).toContain('En curso');
    expect(stageRow('Redacción del contenido').textContent).toContain('Pendiente');
  });

  it('shows a failed stage with its reason, later stages skipped, and restarts the run', async () => {
    const user = userEvent.setup();
    const failed = run(
      ['failed', 'skipped', 'skipped', 'skipped', 'skipped'],
      { failure: { code: 'access_refused', sourceId: 'demo-cup', path: null, httpStatus: 403 } },
      { research: { code: 'access_refused', sourceId: 'demo-cup', path: null, httpStatus: 403 } },
    );
    const server = fakeServer({
      [PROJECT]: () => json(project({ latestRun: failed })),
      [RUNS]: () => json(run([], { id: NEW_RUN_ID, runNumber: 2 }), 202),
      [`GET /api/v1/projects/${PROJECT_ID}/runs/${NEW_RUN_ID}`]: () =>
        json(run(['running'], { id: NEW_RUN_ID, runNumber: 2 })),
    });
    renderApp(`/projects/${PROJECT_ID}`, server, 1000);

    expect(await screen.findByText(/Ejecución 1: fallida\./)).toBeTruthy();
    const research = stageRow('Obtención de datos');
    expect(research.textContent).toContain('Fallida');
    expect(research.textContent).toContain('✕');
    expect(research.textContent).toContain('El proveedor rechazó el acceso.');
    expect(research.textContent).toContain('Fuente: demo-cup');
    expect(research.textContent).toContain('Código de respuesta: 403');
    expect(stageRow('Verificación').textContent).toContain('Omitida');
    expect(screen.getByText(/La ejecución falló/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reiniciar ejecución completa' }));

    expect(await screen.findByText(/Ejecución 2: pendiente\./)).toBeTruthy();
    expect(server.callsTo('POST', `/api/v1/projects/${PROJECT_ID}/runs`)[0]?.body).toEqual({ kind: 'full' });
  });

  it('starts a redraft after a previous run', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [PROJECT]: () =>
        json(project({ latestRun: run(['completed', 'completed', 'completed', 'completed', 'completed']) })),
      [RUNS]: () => json(run([], { id: NEW_RUN_ID, runNumber: 2, kind: 'redraft' }), 202),
      [`GET /api/v1/projects/${PROJECT_ID}/runs/${NEW_RUN_ID}`]: () =>
        json(run([], { id: NEW_RUN_ID, runNumber: 2, kind: 'redraft' })),
    });
    renderApp(`/projects/${PROJECT_ID}`, server, 1000);

    await user.click(await screen.findByRole('button', { name: 'Volver a redactar' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Ejecución 2 (nueva redacción)' })).toBeTruthy();
    expect(server.callsTo('POST', `/api/v1/projects/${PROJECT_ID}/runs`)[0]?.body).toEqual({ kind: 'redraft' });
  });

  it('reports a refused start (run in progress) with a retry', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [PROJECT]: () => json(project()),
      [RUNS]: () => problem({ status: 409, code: 'RUN_IN_PROGRESS' }),
    });
    renderApp(`/projects/${PROJECT_ID}`, server);

    await user.click(await screen.findByRole('button', { name: 'Iniciar ejecución completa' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo iniciar la ejecución');
    expect(alert.textContent).toContain('Ya hay una ejecución en curso');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('stops polling after a non-retryable failure and resumes on request', async () => {
    const user = userEvent.setup();
    let polls = 0;
    const server = fakeServer({
      [PROJECT]: () => json(project({ latestRun: run(['running']) })),
      [`GET /api/v1/projects/${PROJECT_ID}/runs/${RUN_ID}`]: () => {
        polls += 1;
        return polls === 1
          ? problem({ status: 404, code: 'NOT_FOUND' })
          : json(run(['completed', 'completed', 'completed', 'completed', 'completed']));
      },
    });
    renderApp(`/projects/${PROJECT_ID}`, server);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo actualizar el estado de la ejecución');
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(polls).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }));

    expect(await screen.findByText(/Ejecución 1: completada\./)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
