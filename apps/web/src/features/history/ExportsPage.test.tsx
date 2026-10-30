/**
 * Exports page: project in the history with approval state and last export (R-220), export list with export time,
 * data mode and demonstration label (R-269), export action for a final-approved carousel only, with the resulting
 * folder and files (R-218), refusals, loading and errors, and no publication or deletion control (R-219, OD-08).
 */
import { DraftSchema, ExportListResponseSchema, ExportSchema, ProjectSchema } from '@edr/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CAROUSEL_ID,
  draft,
  EXPORT_ID,
  exportRecord,
  fakeServer,
  jsonResponse,
  NEW_EXPORT_ID,
  OLDER_EXPORT_ID,
  OLDER_EXPORTED_AT,
  problemResponse,
  project,
  urls,
} from './test/fixtures';
import { EXPORTS_PATH, renderHistory } from './test/render';

afterEach(cleanup);

const listed = () => ({
  exports: [
    exportRecord(),
    exportRecord({
      id: OLDER_EXPORT_ID,
      exportedAt: OLDER_EXPORTED_AT,
      dataMode: 'MANUAL_DATA',
      demonstration: false,
    }),
  ],
});

function server(overrides: Record<string, Response | Error | Array<Response | Error>> = {}) {
  return fakeServer({
    [`GET ${urls.project}`]: jsonResponse(project()),
    [`GET ${urls.exports()}`]: jsonResponse(listed()),
    [`GET ${urls.draft}`]: jsonResponse(draft()),
    ...overrides,
  });
}

async function waitForPage(): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: 'Exportaciones' });
}

function carouselItem(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name });
  const item = heading.closest('li');
  if (item === null) {
    throw new Error(`no carousel item for ${name}`);
  }
  return item;
}

describe('fixtures', () => {
  it('match the contract schemas', () => {
    expect(ProjectSchema.safeParse(project()).success).toBe(true);
    expect(ExportListResponseSchema.safeParse(listed()).success).toBe(true);
    expect(DraftSchema.safeParse(draft()).success).toBe(true);
    expect(ExportSchema.safeParse(exportRecord({ id: NEW_EXPORT_ID })).success).toBe(true);
  });
});

describe('history', () => {
  it('shows a loading status, then the project with approval state and last export; reads with GET only', async () => {
    const { fetch, calls } = server();
    renderHistory(fetch);

    expect(await screen.findByRole('heading', { level: 1, name: 'Exportaciones' })).toBeTruthy();
    await waitForPage();

    expect(screen.getByText('Datos sintéticos · no verificados ni publicables.')).toBeTruthy();

    await screen.findAllByTestId('carousel-export');
    expect(calls.map((call) => `${call.method} ${call.url}`).sort()).toEqual(
      [`GET ${urls.draft}`, `GET ${urls.exports()}`, `GET ${urls.project}`].sort(),
    );
    for (const call of calls) {
      expect(call.headers['X-EDR-Client']).toBeUndefined();
    }
  });

  it('keeps project export cards focused on title, status, image count and actions', async () => {
    const { fetch } = server();
    renderHistory(fetch);
    await waitForPage();

    const rows = screen.getAllByTestId('export-row');
    expect(rows).toHaveLength(2);
    const [newest, older] = rows as [HTMLElement, HTMLElement];
    expect(newest.textContent).toContain(project().title);
    expect(within(newest).getByTestId('export-label').textContent).toBe('Exportado');
    expect(newest.textContent).toContain('2 imágenes');
    expect(newest.textContent).not.toContain('Datos de demostración');
    expect(within(newest).queryByRole('img')).toBeNull();
    expect(newest.textContent).toContain('26 oct 2026');
    expect(within(newest).getByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(within(newest).getByRole('link', { name: 'Ver contenido' }).getAttribute('href')).toBe(
      `${EXPORTS_PATH}/${EXPORT_ID}`,
    );

    expect(older.textContent).toContain(project().title);
    expect(older.textContent).toContain('2 imágenes');
    expect(within(older).getByTestId('export-label').textContent).toBe('Exportado');
  });

  it('shows an empty history and no demonstration label for a LIVE_DATA project', async () => {
    const { fetch } = server({
      [`GET ${urls.project}`]: jsonResponse(
        project({ dataMode: 'LIVE_DATA', demonstration: false, approvalState: 'in_review', lastExportAt: null }),
      ),
      [`GET ${urls.exports()}`]: jsonResponse({ exports: [] }),
    });
    renderHistory(fetch);
    await waitForPage();

    expect(screen.getByText('Todavía no hay exportaciones')).toBeTruthy();
    expect(screen.queryByText('Contenido de demostración')).toBeNull();
  });

  it('offers no publication, sharing or deletion control', async () => {
    const { fetch } = server();
    renderHistory(fetch);
    await waitForPage();
    await screen.findAllByTestId('carousel-export');

    for (const control of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
      expect(control.textContent).not.toMatch(/publicar|compartir|eliminar|borrar|instagram/i);
    }
  });
});

describe('export action', () => {
  it('offers the export only for a carousel with a valid final approval', async () => {
    const { fetch } = server();
    renderHistory(fetch);
    await waitForPage();
    await screen.findAllByTestId('carousel-export');

    const approved = carouselItem('Carrusel 1 de 3');
    expect(approved.textContent).toContain('Aprobación final válida desde');
    expect(within(approved).getByRole('button', { name: 'Exportar el carrusel 1' })).toBeTruthy();

    const unapproved = carouselItem('Carrusel 2 de 3');
    expect(within(unapproved).queryByRole('button')).toBeNull();
    expect(unapproved.textContent).toContain('Sin aprobación final válida');
    expect(within(unapproved).getByRole('link', { name: 'Ir a la revisión del contenido' }).getAttribute('href')).toBe(
      `/projects/${project().id}/review`,
    );

    const invalidated = carouselItem('Carrusel 3 de 3');
    expect(within(invalidated).queryByRole('button')).toBeNull();
    expect(invalidated.textContent).toContain('La aprobación final ya no es válida');
  });

  it('exports with a mutating request, shows the folder and the files, and refreshes the history', async () => {
    const user = userEvent.setup();
    const written = exportRecord({ id: NEW_EXPORT_ID, exportedAt: '2026-10-27T10:00:00Z' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetch, calls } = server({
      [`GET ${urls.exports()}`]: [jsonResponse(listed()), jsonResponse({ exports: [written, ...listed().exports] })],
    });
    const baseFetch = fetch.getMockImplementation();
    fetch.mockImplementation(async (url, init) => {
      if (init.method === 'POST') {
        await gate;
        calls.push({ method: 'POST', url, headers: { ...(init.headers as Record<string, string>) }, body: init.body });
        return new Response(JSON.stringify(written), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return baseFetch!(url, init);
    });
    renderHistory(fetch);
    await waitForPage();
    await screen.findAllByTestId('carousel-export');

    await user.click(screen.getByRole('button', { name: 'Exportar el carrusel 1' }));
    const pendingButton = within(carouselItem('Carrusel 1 de 3')).getByRole('button');
    expect(pendingButton.textContent).toBe('Exportando…');
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    release();

    const result = await screen.findByTestId('export-result');
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url).toBe(urls.exportCarousel(CAROUSEL_ID));
    expect(post?.headers['X-EDR-Client']).toBe('web');
    expect(post?.body).toBeUndefined();

    expect(within(result).getByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(document.activeElement).toBe(within(result).getByRole('heading', { name: 'Tu carrusel está listo' }));
    expect(within(result).queryByRole('img')).toBeNull();
    expect(within(result).queryByText('Detalles técnicos')).toBeNull();
    expect(within(result).queryByText(written.directory)).toBeNull();
    expect(result.querySelectorAll('a[href]')).toHaveLength(1);
    expect(within(result).getByRole('link', { name: 'Abrir esta exportación' }).getAttribute('href')).toBe(
      `${EXPORTS_PATH}/${NEW_EXPORT_ID}`,
    );
    expect(within(result).queryByRole('note')).toBeNull();
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByTestId('export-status').textContent).toBe('Tu carrusel está listo');

    await waitFor(() => expect(screen.getAllByTestId('export-row')).toHaveLength(3));
    expect(calls.filter((call) => call.url === urls.exports())).toHaveLength(2);
  });

  it('announces a refusal without a valid final approval and reloads the draft', async () => {
    const user = userEvent.setup();
    const refusedDraft = draft([draft().carousels[0]!].map((item) => ({ ...item, finalApproval: null })));
    const { fetch, calls } = server({
      [`GET ${urls.draft}`]: [jsonResponse(draft()), jsonResponse(refusedDraft)],
      [`POST ${urls.exportCarousel(CAROUSEL_ID)}`]: problemResponse(409, 'FINAL_APPROVAL_REQUIRED'),
    });
    renderHistory(fetch);
    await waitForPage();
    await screen.findAllByTestId('carousel-export');

    await user.click(screen.getByRole('button', { name: 'Exportar el carrusel 1' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo exportar el carrusel');
    expect(alert.textContent).toContain('Se necesita la aprobación final antes de exportar.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Exportar el carrusel 1' })).toBeNull());
    expect(calls.filter((call) => call.url === urls.draft)).toHaveLength(2);
    expect(screen.queryByTestId('export-result')).toBeNull();
  });

  it('explains that there is no active draft', async () => {
    const { fetch } = server({ [`GET ${urls.draft}`]: problemResponse(404, 'NOT_FOUND') });
    renderHistory(fetch);
    await waitForPage();

    expect(await screen.findByText(/no tiene un borrador activo/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByTestId('export-row')).toHaveLength(2);
  });

  it('announces a draft that cannot be loaded and retries it', async () => {
    const user = userEvent.setup();
    const { fetch } = server({
      [`GET ${urls.draft}`]: [new TypeError('connection refused'), jsonResponse(draft())],
    });
    renderHistory(fetch);
    await waitForPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el borrador activo');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Exportar el carrusel 1' })).toBeTruthy();
  });
});

describe('loading errors and addresses', () => {
  it('announces a network failure and loads on retry', async () => {
    const user = userEvent.setup();
    const { fetch } = server({
      [`GET ${urls.exports()}`]: [new TypeError('connection refused'), jsonResponse(listed())],
    });
    renderHistory(fetch);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las exportaciones del proyecto');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await waitForPage();
    expect(screen.getAllByTestId('export-row')).toHaveLength(2);
  });

  it('explains a refused local request without any login wording', async () => {
    const { fetch } = server({ [`GET ${urls.project}`]: problemResponse(403, 'FORBIDDEN_ORIGIN') });
    renderHistory(fetch);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Abra la aplicación desde su dirección local (127.0.0.1)');
    expect(alert.textContent).not.toMatch(/iniciar sesi|log ?in|contraseña|password/i);
    expect(within(alert).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('refuses a response that does not match the contract', async () => {
    const { fetch } = server({ [`GET ${urls.exports()}`]: jsonResponse({ exports: [{ id: 'x' }] }) });
    renderHistory(fetch);

    expect((await screen.findByRole('alert')).textContent).toContain('respuesta inesperada');
  });

  it('sends no request for an address that is not a project', () => {
    const { fetch, calls } = server();
    renderHistory(fetch, '/projects/not-a-uuid/exports');

    expect(screen.getByText('La dirección no identifica un proyecto válido.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows not found for an unknown deeper address', () => {
    const { fetch, calls } = server();
    renderHistory(fetch, `${EXPORTS_PATH}/${EXPORT_ID}/unknown`);

    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
