/**
 * Export detail: the exact exported slides and caption in carousel order (R-220), slide images from the same origin
 * only, provenance of each text segment, folder and files (R-218), demonstration label (R-269), operator-attested
 * label (OD-28), trace links (R-221), loading and errors.
 */
import { ExportDetailSchema } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
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
import { DETAIL_PATH, EXPORTS_PATH, renderHistory, tracePathFor } from './test/render';

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

  it('reopens the export with the exact exported slides and caption in order; reads getExport only', async () => {
    const { fetch, calls } = server();
    renderHistory(fetch, DETAIL_PATH);

    expect(screen.getByRole('status').textContent).toBe('Cargando…');
    await waitForDetail();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([`GET ${urls.export(EXPORT_ID)}`]);

    const summary = screen.getByTestId('export-summary');
    expect(summary.textContent).toContain(formatDateTime('2026-10-26T15:00:00Z'));
    expect(summary.textContent).toContain('Datos de demostración');

    const elements = screen.getAllByTestId('exported-element');
    expect(elements.map((element) => element.querySelector('h3')?.textContent)).toEqual([
      'Diapositiva 1 (versión 1)',
      'Diapositiva 2 (versión 2)',
      'Texto de la publicación (versión 3)',
    ]);

    const [slide1, slide2, caption] = elements as [HTMLElement, HTMLElement, HTMLElement];
    expect(slide1.textContent).toContain('Resultados de la jornada');
    expect(slide1.textContent).toContain('Texto de plantilla');
    expect(slide1.textContent).toContain('Comentario');
    expect(slide2.textContent).toContain('2-1');
    expect(slide2.textContent).toContain('Dato: verificado');

    const captionFields = within(caption).getAllByTestId('exported-field');
    expect(captionFields.map((field) => field.getAttribute('data-field'))).toEqual(['caption', 'hashtags']);
    expect(captionFields[0]?.textContent).toContain('Así terminó la jornada.');
    expect(captionFields[1]?.textContent).toContain('#LigaDemo #Jornada3');
    expect(within(caption).queryByRole('img')).toBeNull();
    expect(within(caption).queryByRole('link')).toBeNull();
  });

  it('shows each slide image from the same-origin contract path, with a text alternative', async () => {
    const { fetch } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    const images = screen.getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      urls.image(VERSION_IDS[0]),
      urls.image(VERSION_IDS[1]),
    ]);
    expect(images[0]?.getAttribute('alt')).toBe('Imagen exportada de la diapositiva 1, versión 1');
    expect(images[0]?.getAttribute('width')).toBe('1080');
    expect(images[0]?.getAttribute('height')).toBe('1350');
  });

  it('never takes the image source from the server-provided URL and shows no image when none is recorded', async () => {
    const detail = exportDetail();
    detail.elements[0]!.version = version(0, { imageUrl: 'https://example.invalid/slide.png' });
    detail.elements[1]!.version = version(1, { imageUrl: null });
    const { fetch } = server(detail);
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('src')).toBe(urls.image(VERSION_IDS[0]));
    expect(document.body.innerHTML).not.toContain('example.invalid');
    expect(screen.getByText('No hay imagen registrada para esta versión.')).toBeTruthy();
  });

  it('links each slide to its trace, and shows the folder and the files in order', async () => {
    const { fetch } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    expect(screen.getByRole('link', { name: 'Ver la trazabilidad de la diapositiva 1' }).getAttribute('href')).toBe(
      tracePathFor(1),
    );
    expect(screen.getByRole('link', { name: 'Ver la trazabilidad de la diapositiva 2' }).getAttribute('href')).toBe(
      tracePathFor(2),
    );
    expect(screen.getByTestId('export-directory').textContent).toBe(exportDetail().directory);
    expect(screen.getAllByTestId('export-file').map((row) => row.querySelector('th')?.textContent)).toEqual([
      '01.png',
      '02.png',
      'caption.txt',
      'manifest.json',
    ]);
    expect(screen.getByRole('link', { name: 'Volver a las exportaciones del proyecto' }).getAttribute('href')).toBe(
      EXPORTS_PATH,
    );
  });

  it('labels demonstration content and offers no publication or deletion control', async () => {
    const { fetch } = server();
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    expect(screen.getByTestId('demo-banner')).toBeTruthy();
    expect(screen.queryByTestId('attested-note')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('labels content using a manually approved fact as operator-attested, never as verified', async () => {
    const detail = exportDetail({ dataMode: 'MANUAL_DATA', demonstration: false }, { attested: true });
    const { fetch } = server(detail);
    renderHistory(fetch, DETAIL_PATH);
    await waitForDetail();

    const note = screen.getByTestId('attested-note');
    expect(note.textContent).toContain('Contenido atestiguado por el operador');
    expect(note.textContent).not.toMatch(/\bverificad/i);
    expect(screen.queryByTestId('demo-banner')).toBeNull();
    const score = screen.getAllByTestId('exported-field').find((field) => field.getAttribute('data-field') === 'score');
    expect(score?.textContent).toContain('Dato: aprobado manualmente');
    expect(score?.textContent).toContain('atestiguado por el operador');
    expect(score?.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('attested');
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
    expect(screen.queryAllByTestId('exported-element')).toHaveLength(0);
  });

  it('sends no request for an address that is not an export', () => {
    const { fetch, calls } = server();
    renderHistory(fetch, `${EXPORTS_PATH}/not-an-export`);

    expect(screen.getByText('La dirección no identifica una exportación válida.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
