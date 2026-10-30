import { cleanup, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fakeServer,
  jsonResponse,
  project,
  exportRecord,
  OLDER_EXPORT_ID,
  OLDER_EXPORTED_AT,
  PROJECT_ID,
  OTHER_PROJECT_ID,
  urls,
} from './test/fixtures';
import { GLOBAL_EXPORTS_PATH, renderHistory } from './test/render';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function summaryOf(value = project()) {
  const {
    id,
    title,
    competitionName,
    seasonLabel,
    stageLabel,
    matchday,
    sourceName,
    dataMode,
    demonstration,
    language,
    createdAt,
    approvalState,
    lastExportAt,
  } = value;
  return {
    id,
    title,
    competitionName,
    seasonLabel,
    stageLabel,
    matchday,
    sourceName,
    dataMode,
    demonstration,
    language,
    createdAt,
    approvalState,
    lastExportAt,
  };
}

function server(overrides: Record<string, Response | Error | Array<Response | Error>> = {}) {
  const olderProject = project({
    id: OTHER_PROJECT_ID,
    title: 'Copa de muestra',
    competitionName: 'Copa de muestra',
    dataMode: 'MANUAL_DATA',
    demonstration: false,
    approvalState: 'exported',
    lastExportAt: OLDER_EXPORTED_AT,
  });
  return fakeServer({
    [`GET ${urls.projectList}`]: jsonResponse({ projects: [summaryOf(), summaryOf(olderProject)] }),
    [`GET ${urls.exports(PROJECT_ID)}`]: jsonResponse({ exports: [exportRecord()] }),
    [`GET ${urls.exports(OTHER_PROJECT_ID)}`]: jsonResponse({
      exports: [
        exportRecord({
          id: OLDER_EXPORT_ID,
          projectId: OTHER_PROJECT_ID,
          dataMode: 'MANUAL_DATA',
          demonstration: false,
          exportedAt: OLDER_EXPORTED_AT,
        }),
      ],
    }),
    ...overrides,
  });
}

describe('global export history', () => {
  it('uses four stacked rows so a long title gets the full card width', async () => {
    const longTitle = 'Liga Demo 2026/27 · Temporada Regular · Jornada 3';
    const primaryProject = project({ title: longTitle });
    const { fetch } = server({
      [`GET ${urls.projectList}`]: jsonResponse({ projects: [summaryOf(primaryProject)] }),
    });
    renderHistory(fetch, GLOBAL_EXPORTS_PATH);

    const card = (await screen.findAllByTestId('export-row'))[0]!;
    const rows = [
      ...card.querySelectorAll(
        '[data-testid="export-card-title-row"], [data-testid="export-card-metadata-row"], [data-testid="export-card-actions-row"]',
      ),
    ];
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'export-card-title-row',
      'export-card-metadata-row',
      'export-card-actions-row',
    ]);
    const title = within(card).getByRole('heading', { name: longTitle });
    expect(title.textContent).toBe(longTitle);
    expect(title.className).toContain('line-clamp-3');
    expect(title.className).not.toMatch(/break-all|anywhere/);
    expect(within(card).queryByRole('list', { name: /Vistas previas/ })).toBeNull();
    expect(within(card).queryByRole('img')).toBeNull();
  });

  it('loads scoped histories through existing APIs and sorts export cards newest first', async () => {
    const { fetch, calls } = server();
    renderHistory(fetch, GLOBAL_EXPORTS_PATH);
    expect(screen.getByRole('heading', { level: 1, name: 'Exportaciones' })).toBeTruthy();
    expect(await screen.findAllByTestId('export-row')).toHaveLength(2);
    const cards = screen.getAllByTestId('export-row');
    expect(cards[0]?.textContent).toContain(project().title);
    expect(cards[0]?.textContent).toContain('Exportado');
    expect(cards[0]?.textContent).toContain('2 imágenes');
    expect(cards[0]?.textContent).not.toContain('Datos de demostración');
    expect(cards[0]?.textContent).toContain('26 oct 2026');
    expect(cards[1]?.textContent).toContain('Copa de muestra');
    expect(within(cards[0]!).queryByRole('img')).toBeNull();
    expect(within(cards[0]!).getByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(within(cards[0]!).getByRole('link', { name: 'Ver contenido' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}/exports/${exportRecord().id}`,
    );
    expect(calls.map((call) => call.url)).toEqual([
      urls.projectList,
      urls.exports(PROJECT_ID),
      urls.exports(OTHER_PROJECT_ID),
    ]);
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('downloads an existing archive directly and clears its success message automatically', async () => {
    const { fetch, calls } = server({
      [`GET ${urls.download(exportRecord().id)}`]: new Response(new Uint8Array([80, 75]), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ui05b');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderHistory(fetch, GLOBAL_EXPORTS_PATH);
    const row = (await screen.findAllByTestId('export-row'))[0]!;
    const button = within(row).getByRole('button', { name: 'Descargar carrusel' });
    const user = userEvent.setup();
    await user.click(button);
    expect(screen.getByText('La descarga está lista.')).toBeTruthy();
    expect(calls.some((call) => call.url === urls.download(exportRecord().id))).toBe(true);
    await waitForElementToBeRemoved(() => screen.queryByText('La descarga está lista.'), { timeout: 6000 });
  });

  it('shows an empty state when projects have no saved exports', async () => {
    const { fetch } = server({
      [`GET ${urls.exports(PROJECT_ID)}`]: jsonResponse({ exports: [] }),
      [`GET ${urls.exports(OTHER_PROJECT_ID)}`]: jsonResponse({ exports: [] }),
    });
    renderHistory(fetch, GLOBAL_EXPORTS_PATH);
    expect(await screen.findByText('Todavía no hay exportaciones')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver mis proyectos' }).getAttribute('href')).toBe('/projects');
  });

  it('offers a retry if scoped export history cannot be loaded', async () => {
    const user = userEvent.setup();
    const { fetch } = server({
      [`GET ${urls.exports(PROJECT_ID)}`]: [new TypeError('offline'), jsonResponse({ exports: [exportRecord()] })],
    });
    renderHistory(fetch, GLOBAL_EXPORTS_PATH);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el historial');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findAllByTestId('export-row')).toHaveLength(2);
  });
});
