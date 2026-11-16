/**
 * Review context and integrated download (PD-ARCH-01F): the review names its project and leads back to it; a carousel
 * with a valid final approval is downloaded from the review. Every download asks the server to write the export from
 * the current state first (E2E-F01, WI-2 UI-06.1): an earlier export, of this or of an earlier approval, is never
 * downloaded in its place; the download is always for the selected carousel. All data is synthetic.
 */
import type { Export, FinalApproval } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API,
  CAROUSEL_2_ID,
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

function approval(carouselId: string, id: string): FinalApproval {
  return { id, carouselId, approvedAt: '2026-10-27T14:00:00Z', versionSetSha256: 'a'.repeat(64), valid: true };
}

const CURRENT = approval(CAROUSEL_ID, '99999999-9999-4999-8999-999999999991');
const EARLIER_APPROVAL_ID = '99999999-9999-4999-8999-999999999990';

function exportOf(id: string, carouselId: string, finalApprovalId: string): Export {
  return {
    id,
    projectId: PROJECT_ID,
    carouselId,
    finalApprovalId,
    exportedAt: '2026-10-27T15:00:00Z',
    directory: `exports/${PROJECT_ID}/${id}`,
    dataMode: 'DEMO_DATA',
    demonstration: true,
    files: [],
  };
}

function approvedCarousel(id: string, sequence: number, total: number, finalApproval: FinalApproval) {
  return carousel(
    [
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { state: 'approved' }),
      caption(3, 3, { state: 'approved' }),
    ],
    { id, sequence, total, readyForFinalApproval: true, finalApproval },
  );
}

const ZIP = () =>
  new Response(new Uint8Array([80, 75]), { status: 200, headers: { 'Content-Type': 'application/zip' } });

describe('review context (PD-ARCH-01F)', () => {
  it('names the project, its content type, context and state, and leads back to the project', async () => {
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse() }));
    const context = await screen.findByTestId('review-project-context');
    expect(context.textContent).toContain('Liga de Prueba 2026 · Jornada 3');
    expect(context.textContent).toContain('Carrusel de resultados');
    expect(context.textContent).toContain('Liga de Prueba · 2026 · Fase regular · Jornada 3');
    expect(context.textContent).toContain('Pendiente de revisión');
    expect(screen.getByRole('link', { name: 'Volver al proyecto' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}`,
    );
  });
});

describe('download from the review (PD-ARCH-01F)', () => {
  it('writes a new export even when one of the current final approval exists, and downloads the new one', async () => {
    // The earlier export may hold editorial copy that is no longer the approved copy (E2E-F01): only the server, when
    // it writes the export, knows the copy exportable now.
    const earlier = exportOf('e1000000-0000-4000-8000-000000000001', CAROUSEL_ID, CURRENT.id);
    const written = exportOf('e1000000-0000-4000-8000-000000000005', CAROUSEL_ID, CURRENT.id);
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [approvedCarousel(CAROUSEL_ID, 1, 1, CURRENT)] })),
      [EXPORTS]: () => json({ exports: [earlier] }),
      [`POST ${API}/carousels/${CAROUSEL_ID}/exports`]: () => json(written, 201),
      [`GET ${API}/exports/${written.id}/download`]: ZIP,
    });
    renderApp(REVIEW, server);
    const download = await screen.findByRole('button', { name: 'Descargar carrusel' });

    await userEvent.click(download);
    // The success is announced to assistive technology only (Product Owner, 2026-11-10).
    expect((await screen.findByText('La descarga está lista.')).className).toBe('sr-only');
    // A second download without changes asks the server again: nothing is reused on the web side.
    await userEvent.click(download);

    await vi.waitFor(() => {
      expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(2);
      expect(server.callsTo('GET', `${API}/exports/${written.id}/download`)).toHaveLength(2);
    });
    expect(server.callsTo('GET', `${API}/exports/${earlier.id}/download`)).toHaveLength(0);
  });

  it('never reuses an export of an earlier final approval: it exports the current version first', async () => {
    const obsolete = exportOf('e1000000-0000-4000-8000-000000000002', CAROUSEL_ID, EARLIER_APPROVAL_ID);
    const written = exportOf('e1000000-0000-4000-8000-000000000003', CAROUSEL_ID, CURRENT.id);
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [approvedCarousel(CAROUSEL_ID, 1, 1, CURRENT)] })),
      [EXPORTS]: [() => json({ exports: [obsolete] }), () => json({ exports: [written, obsolete] })],
      [`POST ${API}/carousels/${CAROUSEL_ID}/exports`]: () => json(written, 201),
      [`GET ${API}/exports/${written.id}/download`]: ZIP,
    });
    renderApp(REVIEW, server);

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel' }));

    expect(await screen.findByText('La descarga está lista.')).toBeTruthy();
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(1);
    expect(server.callsTo('GET', `${API}/exports/${written.id}/download`)).toHaveLength(1);
    expect(server.callsTo('GET', `${API}/exports/${obsolete.id}/download`)).toHaveLength(0);
  });

  it('downloads the selected carousel when the project has several', async () => {
    const second = approval(CAROUSEL_2_ID, '99999999-9999-4999-8999-999999999992');
    const written = exportOf('e1000000-0000-4000-8000-000000000004', CAROUSEL_2_ID, second.id);
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        draft({
          carousels: [approvedCarousel(CAROUSEL_ID, 1, 2, CURRENT), approvedCarousel(CAROUSEL_2_ID, 2, 2, second)],
        }),
      ),
      [EXPORTS]: () => json({ exports: [] }),
      [`POST ${API}/carousels/${CAROUSEL_2_ID}/exports`]: () => json(written, 201),
      [`GET ${API}/exports/${written.id}/download`]: ZIP,
    });
    renderApp(REVIEW, server);
    const picker = await screen.findByRole('navigation', { name: 'Elegir carrusel para revisar' });
    await userEvent.click(within(picker).getByRole('button', { name: /Carrusel 2 de 2/ }));

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel 2 de 2' }));

    expect(await screen.findByText('La descarga está lista.')).toBeTruthy();
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_2_ID}/exports`)).toHaveLength(1);
    expect(server.callsTo('POST', `${API}/carousels/${CAROUSEL_ID}/exports`)).toHaveLength(0);
  });

  it('reports a final approval that is no longer valid and reloads the review', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [approvedCarousel(CAROUSEL_ID, 1, 1, CURRENT)] })),
      [EXPORTS]: () => json({ exports: [] }),
      [`POST ${API}/carousels/${CAROUSEL_ID}/exports`]: () =>
        problem({ status: 409, code: 'FINAL_APPROVAL_REQUIRED', detail: 'synthetic' }),
    });
    renderApp(REVIEW, server);

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel' }));

    expect(await screen.findByText(/La aprobación final ya no es válida/)).toBeTruthy();
    expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length).toBeGreaterThan(1);
  });

  it('reports editorial copy that changed while the export was written, without claiming the approval is invalid', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [approvedCarousel(CAROUSEL_ID, 1, 1, CURRENT)] })),
      [`POST ${API}/carousels/${CAROUSEL_ID}/exports`]: () =>
        problem({ status: 409, code: 'VERSION_CONFLICT', detail: 'synthetic' }),
    });
    renderApp(REVIEW, server);

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar carrusel' }));

    expect(
      await screen.findByText(
        'El copy editorial cambió mientras se preparaba la descarga. Vuelve a descargar el carrusel.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/La aprobación final ya no es válida/)).toBeNull();
  });
});
