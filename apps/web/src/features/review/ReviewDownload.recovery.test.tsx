/**
 * UI-06.3 export errors and recovery in the review download (PD-ARCH-01F): an export the server could not write
 * (500), a lost connection and export files that are missing or fail their check each give a fixed Spanish message,
 * never claim a download or an invalid approval, and leave the download available to retry; a second click while the
 * export is being written sends no second request. All data is synthetic.
 */
import type { Export, FinalApproval } from '@edr/contracts';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API,
  CAROUSEL_ID,
  caption,
  carousel,
  draft,
  DRAFT_PATH,
  draftResponse,
  fakeServer,
  json,
  problem,
  PROJECT_ID,
  renderApp,
  slide,
} from './test/support';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:review-download');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

const REVIEW = `/projects/${PROJECT_ID}/review`;
const EXPORTS = `GET ${API}/projects/${PROJECT_ID}/exports`;
const EXPORT = `POST ${API}/carousels/${CAROUSEL_ID}/exports`;
const FAILED_TEXT = 'No se pudo preparar la descarga. Comprueba la conexión e inténtalo de nuevo.';
const FILES_TEXT = 'Los archivos de esta exportación no están disponibles o no se pudieron verificar.';

const CURRENT: FinalApproval = {
  id: '99999999-9999-4999-8999-999999999991',
  carouselId: CAROUSEL_ID,
  approvedAt: '2026-10-27T14:00:00Z',
  versionSetSha256: 'a'.repeat(64),
  valid: true,
};
const WRITTEN: Export = {
  id: 'e1000000-0000-4000-8000-000000000007',
  projectId: PROJECT_ID,
  carouselId: CAROUSEL_ID,
  finalApprovalId: CURRENT.id,
  exportedAt: '2026-10-27T15:00:00Z',
  directory: `exports/${PROJECT_ID}/e1000000-0000-4000-8000-000000000007`,
  dataMode: 'DEMO_DATA',
  demonstration: true,
  files: [],
};
const DOWNLOAD = `GET ${API}/exports/${WRITTEN.id}/download`;

const approvedDraft = () =>
  draftResponse(
    draft({
      carousels: [
        carousel(
          [
            slide(1, 1, 'cover', { state: 'approved' }),
            slide(2, 2, 'match_result', { state: 'approved' }),
            caption(3, 3, { state: 'approved' }),
          ],
          { id: CAROUSEL_ID, sequence: 1, total: 1, readyForFinalApproval: true, finalApproval: CURRENT },
        ),
      ],
    }),
  );

const ZIP = () =>
  new Response(new Uint8Array([80, 75]), { status: 200, headers: { 'Content-Type': 'application/zip' } });

describe('download from the review: export errors and retry (UI-06.3)', () => {
  it('reports an export the server could not write, keeps the approval, and a retry downloads', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: approvedDraft(),
      [EXPORTS]: () => json({ exports: [] }),
      [EXPORT]: [
        () => problem({ status: 500, code: 'INTERNAL', detail: 'An internal error occurred.' }),
        () => json(WRITTEN, 201),
      ],
      [DOWNLOAD]: ZIP,
    });
    renderApp(REVIEW, server);
    const button = await screen.findByRole('button', { name: 'Descargar carrusel' });
    const draftReads = server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length;

    await userEvent.click(button);
    expect(await screen.findByText(FAILED_TEXT)).toBeTruthy();
    // Nothing is downloaded, the approval is not reported as invalid, and the review is not reloaded as stale.
    expect(server.callsTo('GET', `${API}/exports/${WRITTEN.id}/download`)).toHaveLength(0);
    expect(screen.queryByText(/La aprobación final ya no es válida/)).toBeNull();
    expect(screen.queryByText('La descarga está lista.')).toBeNull();
    expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`)).toHaveLength(draftReads);
    expect(document.body.textContent).not.toContain('An internal error occurred.');

    // The same control retries, and the retry downloads the newly written export.
    const again = screen.getByRole('button', { name: 'Descargar carrusel' });
    expect((again as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(again);
    expect(await screen.findByText('La descarga está lista.')).toBeTruthy();
    expect(screen.queryByText(FAILED_TEXT)).toBeNull();
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(2);
    expect(server.callsTo('GET', `${API}/exports/${WRITTEN.id}/download`)).toHaveLength(1);
  });

  it('reports a lost connection with the same retryable message', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: approvedDraft(),
      [EXPORTS]: () => json({ exports: [] }),
      [EXPORT]: () => {
        throw new TypeError('synthetic network failure');
      },
    });
    renderApp(REVIEW, server);
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel' }));
    expect(await screen.findByText(FAILED_TEXT)).toBeTruthy();
    expect(document.body.textContent).not.toContain('synthetic network failure');
    expect((screen.getByRole('button', { name: 'Descargar carrusel' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(['EXPORT_FILES_MISSING', 'EXPORT_FILES_CORRUPT'])(
    'reports export files that are %s without claiming a download',
    async (code) => {
      const server = fakeServer({
        [DRAFT_PATH]: approvedDraft(),
        [EXPORTS]: () => json({ exports: [] }),
        [EXPORT]: () => json(WRITTEN, 201),
        [DOWNLOAD]: () => problem({ status: code === 'EXPORT_FILES_MISSING' ? 404 : 409, code, detail: 'synthetic' }),
      });
      renderApp(REVIEW, server);
      await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel' }));
      const status = await screen.findByText(FILES_TEXT);
      expect(status.getAttribute('role')).toBe('status');
      expect(screen.queryByText('La descarga está lista.')).toBeNull();
      expect(document.body.textContent).not.toContain('synthetic');
    },
  );

  it('sends one export request when the download is clicked again while it is being prepared', async () => {
    let finish: (response: Response) => void = () => undefined;
    const server = fakeServer({
      [DRAFT_PATH]: approvedDraft(),
      [EXPORTS]: () => json({ exports: [] }),
      [EXPORT]: () => new Promise<Response>((resolve) => (finish = resolve)),
      [DOWNLOAD]: ZIP,
    });
    renderApp(REVIEW, server);
    const button = await screen.findByRole('button', { name: 'Descargar carrusel' });
    await userEvent.click(button);
    const busy = await screen.findByRole('button', { name: 'Preparando exportación…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await userEvent.click(busy);
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(1);
    finish(json(WRITTEN, 201));
    expect(await screen.findByText('La descarga está lista.')).toBeTruthy();
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(1);
  });
});
