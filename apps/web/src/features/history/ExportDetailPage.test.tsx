import { ExportDetailSchema } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { formatDateTime } from '../../ui';
import {
  EXPORT_ID,
  exportDetail,
  fakeServer,
  jsonResponse,
  OTHER_PROJECT_ID,
  problemResponse,
  urls,
  version,
  VERSION_IDS,
} from './test/fixtures';
import { DETAIL_PATH, EXPORTS_PATH, renderHistory } from './test/render';

afterEach(cleanup);

function server(detail: unknown = exportDetail()) {
  return fakeServer({ [`GET ${urls.export(EXPORT_ID)}`]: jsonResponse(detail) });
}

async function waitForDetail(): Promise<void> {
  await screen.findByTestId('export-summary');
}

describe('export detail', () => {
  it('uses contract-shaped fixtures', () => {
    expect(ExportDetailSchema.safeParse(exportDetail()).success).toBe(true);
    expect(ExportDetailSchema.safeParse(exportDetail({}, { attested: true })).success).toBe(true);
  });

  it('shows a visual carousel and summarizes title, match data and caption', async () => {
    const { fetch, calls } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([`GET ${urls.export(EXPORT_ID)}`]);
    const summary = screen.getByTestId('export-summary');
    expect(summary.textContent).toContain(formatDateTime('2026-10-26T15:00:00Z'));
    expect(summary.textContent).toContain('2 imágenes');
    expect(within(summary).getByText('Exportado')).toBeTruthy();

    const navigation = screen.getByRole('navigation', { name: 'Diapositivas del carrusel' });
    const slides = within(navigation).getAllByRole('button');
    expect(slides).toHaveLength(2);
    expect(slides[0]?.getAttribute('aria-current')).toBe('true');
    const first = screen.getByRole('region', { name: 'Resumen de la diapositiva' });
    expect(within(first).getByText('Resultados de la jornada')).toBeTruthy();
    expect(within(first).queryByText('Una jornada intensa')).toBeNull();
    expect(
      within(first)
        .getAllByTestId('export-summary-field')
        .map((field) => field.getAttribute('data-field')),
    ).toEqual(['title']);

    await userEvent.setup().click(slides[1]!);
    const second = screen.getByRole('region', { name: 'Resumen de la diapositiva' });
    expect(slides[1]?.getAttribute('aria-current')).toBe('true');
    expect(
      within(second)
        .getAllByTestId('export-summary-field')
        .map((field) => field.getAttribute('data-field')),
    ).toEqual(['team_home', 'score', 'team_away']);
    expect(within(second).getByText('2-1')).toBeTruthy();

    const captionDisclosure = screen.getByText('Ver texto de publicación');
    await userEvent.setup().click(captionDisclosure);
    expect(screen.getByText('Así terminó la jornada. Equipo A')).toBeTruthy();
    expect(screen.queryByText('#LigaDemo #Jornada3')).toBeNull();
    expect(screen.queryByText(/Detalles técnicos|trazabilidad/i)).toBeNull();
  });

  it('loads the actual slide image and preserves the original aspect ratio', async () => {
    const { fetch } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    const image = within(screen.getByTestId('selected-slide-preview')).getByRole('img', {
      name: 'Imagen exportada de la diapositiva 1',
    });
    expect(image.getAttribute('src')).toBe(urls.image(VERSION_IDS[0]));
    expect(image.getAttribute('width')).toBe('1080');
    expect(image.getAttribute('height')).toBe('1350');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Diapositiva 2' }));
    expect(
      within(screen.getByTestId('selected-slide-preview'))
        .getByRole('img', {
          name: 'Imagen exportada de la diapositiva 2',
        })
        .getAttribute('src'),
    ).toBe(urls.image(VERSION_IDS[1]));
  });

  it('never loads a server-provided external image URL and handles a slide with no image', async () => {
    const detail = exportDetail();
    detail.elements[0]!.version = version(0, { imageUrl: 'https://example.invalid/slide.png' });
    detail.elements[1]!.version = version(1, { imageUrl: null });
    const { fetch } = server(detail);
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    const image = within(screen.getByTestId('selected-slide-preview')).getByRole('img', {
      name: 'Imagen exportada de la diapositiva 1',
    });
    expect(image.getAttribute('src')).toBe(urls.image(VERSION_IDS[0]));
    expect(document.body.innerHTML).not.toContain('example.invalid');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Diapositiva 2' }));
    expect(
      within(screen.getByTestId('selected-slide-preview')).getByText('No hay imagen registrada para esta versión.'),
    ).toBeTruthy();
  });

  it('keeps demo and operator-attested safety information without technical clutter', async () => {
    const { fetch } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();
    expect(screen.getByRole('note').textContent).toContain('Datos sintéticos');
    expect(screen.getByRole('note').textContent).toContain('no verificados ni publicables');
    expect(screen.queryByText('Demostración')).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /trazabilidad/i })).toBeNull();
    expect(screen.queryByText(/UUID|SHA-256|ruta técnica/i)).toBeNull();

    const attested = exportDetail({ dataMode: 'MANUAL_DATA', demonstration: false }, { attested: true });
    const manualServer = server(attested);
    cleanup();
    renderHistory(manualServer.fetch, DETAIL_PATH);
    await waitForDetail();
    expect(screen.getByTestId('attested-note').textContent).toContain('Contenido atestiguado por el operador');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Diapositiva 2' }));
    expect(
      screen.getAllByTestId('export-summary-field').find((field) => field.getAttribute('data-field') === 'score')
        ?.textContent,
    ).toContain('2-1');
    expect(document.body.textContent).not.toMatch(/verificado/i);
  });
});

describe('errors and addresses', () => {
  it('announces a missing export', async () => {
    const { fetch } = fakeServer({ [`GET ${urls.export(EXPORT_ID)}`]: problemResponse(404, 'NOT_FOUND') });
    renderHistory(fetch, DETAIL_PATH);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo abrir la exportación');
    expect(alert.textContent).toContain('El elemento solicitado no existe.');
  });

  it('does not show an export of another project under this project', async () => {
    const { fetch } = server(exportDetail({ projectId: OTHER_PROJECT_ID }));
    renderHistory(fetch, DETAIL_PATH);
    expect(await screen.findByText('Esta exportación no pertenece a este proyecto.')).toBeTruthy();
    expect(screen.queryAllByTestId('export-summary')).toHaveLength(0);
  });

  it('sends no request for an address that is not an export', () => {
    const { fetch, calls } = server();
    renderHistory(fetch, `${EXPORTS_PATH}/not-an-export`);
    expect(screen.getByText('La dirección no identifica una exportación válida.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
