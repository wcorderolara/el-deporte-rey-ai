/**
 * Review page (R-208, R-215, R-269, R-285, OD-03, OD-21, OD-28): loading and error states, the demonstration
 * banner, the preview of every slide in carousel order with caption and hashtags, provenance labels, numbered
 * carousels and a draft without standings. The exclusions editor was removed (UX-REVIEW-01, PD-31).
 */
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  API,
  CAROUSEL_ID,
  CAROUSEL_2_ID,
  caption,
  carousel,
  commentary,
  draft,
  DRAFT_PATH,
  draftResponse,
  elementId,
  elementPath,
  factId,
  factSegment,
  fakeServer,
  json,
  modeDraft,
  openCaption,
  problem,
  PROJECT_ID,
  renderApp,
  slide,
  standardCarousel,
  checkedElement,
  template,
  versionId,
} from './test/support';

afterEach(cleanup);

const REVIEW = `/projects/${PROJECT_ID}/review`;

async function waitForDraft() {
  await screen.findByRole('heading', { level: 1, name: 'Revisión del contenido' });
  return screen.findByRole('tablist', { name: 'Modo de revisión' });
}

/** The project context of the header, once the project is read. */
function projectContext() {
  return screen.findByTestId('review-project-context');
}

describe('Review page: loading and errors', () => {
  it('shows the loading state, then the draft', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    expect(await screen.findByText('Cargando el borrador…')).toBeTruthy();
    await waitForDraft();
    expect(screen.getByRole('heading', { level: 1, name: 'Revisión del contenido' })).toBeTruthy();
    expect(server.unexpected).toEqual([]);
  });

  it('explains that the project has no active draft (404) and links back to the project', async () => {
    const server = fakeServer({ [DRAFT_PATH]: () => problem({ status: 404, code: 'NOT_FOUND' }) });
    renderApp(REVIEW, server);
    expect(await screen.findByText(/todavía no tiene un borrador activo/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver al proyecto' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}`,
    );
  });

  it('announces a network failure and retries on request', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: [
        () => {
          throw new TypeError('offline');
        },
        draftResponse(),
      ],
    });
    renderApp(REVIEW, server);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el borrador');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await waitForDraft();
    expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`)).toHaveLength(2);
  });

  it('shows a not-found page for an address that is no project identifier, without any request', async () => {
    const server = fakeServer({});
    renderApp('/projects/not-a-uuid/review', server);
    expect(await screen.findByText('La dirección no corresponde a ningún proyecto.')).toBeTruthy();
    expect(server.calls).toEqual([]);
  });

  it('shows a not-found page for an unknown address inside the review', async () => {
    const server = fakeServer({});
    renderApp(`${REVIEW}/otra-cosa`, server);
    expect(await screen.findByText('La dirección no corresponde a ningún proyecto.')).toBeTruthy();
    expect(server.calls).toEqual([]);
  });
});

describe('Review page: demonstration label and data mode (R-269, OD-21)', () => {
  it('labels a DEMO_DATA draft as a demonstration', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(modeDraft('DEMO_DATA')) });
    renderApp(REVIEW, server);
    await waitForDraft();
    const notice = screen.getByRole('note');
    expect(notice.textContent).toContain('no se consideran verificados ni listos para publicación');
    expect(screen.getAllByRole('note')).toHaveLength(1);
    // The draft details are not part of the review (Product Owner, 2026-11-10).
    expect(screen.queryByText('Datos y trazabilidad del borrador')).toBeNull();
  });

  it('shows no demonstration banner for a MANUAL_DATA draft', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(modeDraft('MANUAL_DATA')) });
    renderApp(REVIEW, server);
    await waitForDraft();
    await projectContext();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('Review workspace navigation and hierarchy', () => {
  it('keeps one primary title, a link back to the project, and no technical details section', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 1, name: 'Revisión del contenido' });
    await screen.findByRole('navigation', { name: 'Diapositivas del carrusel' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Volver al proyecto' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}`,
    );
    const slideCard = screen.getByRole('article', { name: 'Diapositiva 1: Portada' });
    expect(within(slideCard).queryByText('Detalles y verificaciones')).toBeNull();
  });

  it('shows a useful empty state when the draft has no carousels', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [] })) });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 1, name: 'Revisión del contenido' });
    expect(await screen.findByText('El borrador no tiene carruseles.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Diapositivas del carrusel' })).toBeNull();
  });

  it('approves the current slide and moves to the next slide using the existing version approval API', async () => {
    const first = slide(1, 1, 'cover');
    const alreadyApproved = slide(2, 2, 'match_result', { state: 'approved' });
    const nextPending = slide(3, 3, 'closing');
    const elements = [first, alreadyApproved, nextPending, caption(4, 4)];
    const approvedFirst = checkedElement({
      ...first,
      currentVersion: { ...first.currentVersion, state: 'approved' },
    });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(draft({ carousels: [carousel(elements)] }))],
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () => json(approvedFirst),
    });
    renderApp(REVIEW, server);
    const slideCard = await screen.findByRole('article', { name: 'Diapositiva 1: Portada' });
    // One approval action (UX-REVIEW-01): approving moves to the next pending slide, skipping approved ones.
    await userEvent.click(within(slideCard).getByRole('button', { name: 'Aprobar diapositiva' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Diapositiva 3: Cierre' })).toBeTruthy();
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, elementId(1), 'approval'))).toHaveLength(1);
  });

  it('does not move selection when the selected slide changes during approval', async () => {
    const first = slide(1, 1, 'cover');
    const second = slide(2, 2, 'match_result');
    const approvedFirst = checkedElement({ ...first, currentVersion: { ...first.currentVersion, state: 'approved' } });
    let resolveApproval: ((response: Response) => void) | undefined;
    const pendingApproval = new Promise<Response>((resolve) => {
      resolveApproval = resolve;
    });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel([first, second, caption(3, 3)])] })),
      [`PUT ${elementPath(CAROUSEL_ID, first.id, 'approval')}`]: () => pendingApproval,
    });
    renderApp(REVIEW, server);
    const slideCard = await screen.findByRole('article', { name: 'Diapositiva 1: Portada' });
    await userEvent.click(within(slideCard).getByRole('button', { name: 'Aprobar diapositiva' }));
    await userEvent.click(screen.getByRole('button', { name: /^Diapositiva 2: Resultado/ }));
    resolveApproval?.(json(approvedFirst));
    expect(await screen.findByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Diapositiva 2: Resultado/ }).getAttribute('aria-current')).toBe('true');
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, first.id, 'approval'))).toHaveLength(1);
  });

  it('confirms and approves only eligible slides in sequence, without approving the caption', async () => {
    const base = standardCarousel();
    const slides = base.elements.filter((item) => item.kind === 'slide');
    const updatedSlides = slides.map((item) =>
      checkedElement({
        ...item,
        currentVersion: { ...item.currentVersion, state: 'approved' },
      }),
    );
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(draft({ carousels: [base] })),
        draftResponse(
          draft({ carousels: [carousel([...updatedSlides, base.elements.find((item) => item.kind === 'caption')!])] }),
        ),
      ],
      ...Object.fromEntries(
        slides.map((item) => [
          `PUT ${elementPath(CAROUSEL_ID, item.id, 'approval')}`,
          () => json(updatedSlides.find((updated) => updated.id === item.id)),
        ]),
      ),
    });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar todas (3)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
    expect(dialog.textContent).toContain('3 listas para aprobar');
    expect(dialog.textContent).toContain('No aprueba el copy editorial ni el texto del carrusel.');
    expect(dialog.textContent).toContain('0 ya aprobadas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar 3 diapositivas' }));
    expect(await within(dialog).findByText('3 diapositivas aprobadas.')).toBeTruthy();
    expect(
      slides.every((item) => server.callsTo('PUT', elementPath(CAROUSEL_ID, item.id, 'approval')).length === 1),
    ).toBe(true);
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, elementId(4), 'approval'))).toHaveLength(0);
    expect(server.unexpected).toEqual([]);
  });

  it('does not bulk-approve slides with unacknowledged warnings or blockers', async () => {
    const warningQa = slide(1, 1, 'cover').currentVersion.qa.map((item) =>
      item.check === 'capitalized_tokens' ? { ...item, outcome: 'fail' as const } : item,
    );
    const items = [
      slide(1, 1, 'cover', { qa: warningQa }),
      slide(2, 2, 'match_result', { blocked: true }),
      caption(3, 3),
    ];
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(items)] })) });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    // «Aprobar todas» is offered only when a slide is eligible; otherwise the reasons stay one click away.
    expect(screen.queryByRole('button', { name: /^Aprobar todas/ })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Diapositivas del carrusel' }).textContent).toContain(
      'Ninguna diapositiva está lista para la aprobación masiva.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver motivos' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
    expect(dialog.textContent).toContain('Advertencias sin confirmar');
    expect(dialog.textContent).toContain('Diapositiva 1: Portada');
    expect(dialog.textContent).toContain('Diapositivas bloqueadas o pendientes');
    expect(within(dialog).getByRole('button', { name: 'Aprobar 0 diapositivas' }).hasAttribute('disabled')).toBe(true);
    expect(server.calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/approval'))).toHaveLength(0);
  });

  it('reports partial success and refreshes eligibility before offering a safe retry', async () => {
    const first = slide(1, 1, 'cover');
    const second = slide(2, 2, 'match_result');
    const copy = caption(3, 3);
    const firstApproved = checkedElement({ ...first, currentVersion: { ...first.currentVersion, state: 'approved' } });
    const secondApproved = checkedElement({
      ...second,
      currentVersion: { ...second.currentVersion, state: 'approved' },
    });
    const currentDraft = (approvedSecond: boolean) =>
      draftResponse(draft({ carousels: [carousel([firstApproved, approvedSecond ? secondApproved : second, copy])] }));
    let secondAttempt = 0;
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(draft({ carousels: [carousel([first, second, copy])] })),
        currentDraft(false),
        currentDraft(false),
        currentDraft(true),
      ],
      [`PUT ${elementPath(CAROUSEL_ID, first.id, 'approval')}`]: () => json(firstApproved),
      [`PUT ${elementPath(CAROUSEL_ID, second.id, 'approval')}`]: () => {
        secondAttempt += 1;
        return secondAttempt === 1 ? Promise.reject(new TypeError('network unavailable')) : json(secondApproved);
      },
    });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar todas (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar 2 diapositivas' }));
    expect(await within(dialog).findByText(/1 aprobada; 1 requiere atención/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revisar e intentar de nuevo las pendientes' }));
    expect(await within(dialog).findByText('1 listas para aprobar')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar 1 diapositiva' }));
    expect(await within(dialog).findByText('1 diapositiva aprobada.')).toBeTruthy();
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, first.id, 'approval'))).toHaveLength(1);
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, second.id, 'approval'))).toHaveLength(2);
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, elementId(3), 'approval'))).toHaveLength(0);
  });
});

describe('Review page: preview in carousel order (R-215)', () => {
  it('shows one selected slide, navigable thumbnails, and the publication copy separately', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    await waitForDraft();

    const carouselRegion = screen.getByRole('region', { name: 'Carrusel' });
    const thumbnails = within(carouselRegion).getAllByRole('button', { name: /^Diapositiva/ });
    expect(thumbnails).toHaveLength(3);
    expect(thumbnails[0]?.getAttribute('aria-current')).toBe('true');
    const selectedSlide = screen.getByRole('article', { name: 'Diapositiva 1: Portada' });
    const image = within(selectedSlide).getByRole('img', { name: 'Imagen de Diapositiva 1: Portada, versión 1' });
    expect(image.getAttribute('src')).toBe(`${API}/element-versions/${versionId(1)}/image`);
    expect(within(selectedSlide).queryByText('Detalles y verificaciones')).toBeNull();
    // The design mode holds the slides only; the publication text is reviewed in «Copy editorial».
    expect(within(carouselRegion).queryByRole('article', { name: 'Texto de publicación y hashtags' })).toBeNull();

    const secondSlide = within(carouselRegion).getByRole('button', { name: /^Diapositiva 2:/ });
    await userEvent.click(within(carouselRegion).getByRole('button', { name: /^Diapositiva 1:/ }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
    expect(secondSlide.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(secondSlide);
    expect(screen.getByRole('article', { name: 'Diapositiva 2: Resultado' })).toBeTruthy();

    const captionCard = await openCaption();
    expect(captionCard.textContent).toContain('Texto de publicación de prueba con');
    expect(captionCard.textContent).toContain('#JornadaDemo #FutbolDemo');
    expect(within(captionCard).queryByRole('img')).toBeNull();
  });

  it('shows numbered carousels in sequence order (OD-03)', async () => {
    const second = carousel([slide(11, 1, 'cover', {}, CAROUSEL_2_ID), caption(12, 2, {}, CAROUSEL_2_ID)], {
      id: CAROUSEL_2_ID,
      sequence: 2,
      total: 2,
    });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [second, standardCarousel({ total: 2 })] })),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    const picker = screen.getByRole('navigation', { name: 'Elegir carrusel para revisar' });
    expect(within(picker).getAllByRole('button')).toHaveLength(2);
    await userEvent.click(within(picker).getByRole('button', { name: /Carrusel 2 de 2/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Carrusel 2 de 2' })).toBeTruthy();
  });

  it('says that a slide image is not available yet when the version has none', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        draft({
          carousels: [
            carousel([slide(1, 1, 'cover', { state: 'pending_qa', imageUrl: null, width: null, height: null })]),
          ],
        }),
      ),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    const card = screen.getByRole('article', { name: 'Diapositiva 1: Portada' });
    expect(card.textContent).toContain('Imagen todavía no disponible.');
    expect(within(card).queryByRole('img')).toBeNull();
  });
});

describe('Review page: fact statuses (R-071, OD-28)', () => {
  it('never calls a manually approved or unverified value verified', async () => {
    const element = slide(2, 1, 'match_result', {
      blocked: true,
      blockingFacts: [
        {
          factId: factId(2),
          factKey: 'match:demo-1:kickoff',
          kind: 'match_kickoff',
          status: 'unverified',
          unverifiedReason: 'awaiting_independent_verification',
          reason: null,
          display: '25 oct 2026',
          blockReason: 'not_verified',
        },
      ],
      fields: [
        { field: 'score', segments: [factSegment('2-1', factId(1), 'verified')] },
        { field: 'kickoff', segments: [factSegment('25 oct 2026', factId(2), 'unverified')] },
        { field: 'team_home', segments: [factSegment('Atlético Demo', factId(3), 'manually_approved')] },
        { field: 'headline', segments: [commentary('Partido intenso')] },
        { field: 'footer', segments: [template('Jornada')] },
      ],
    });
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel([element])] })) });
    renderApp(REVIEW, server);
    await waitForDraft();

    // The per-segment provenance is no longer listed in the review (PD-ARCH-01E-B review); the exported manifest and
    // the trace keep it. The slide never calls an unverified or manually approved value verified.
    const slideCard = screen.getByRole('article', { name: 'Diapositiva 1: Resultado' });
    expect(within(slideCard).queryByText('Detalles y verificaciones')).toBeNull();
    expect(slideCard.textContent).not.toContain('Dato: verificado');
  });
});

describe('Review page: standings (R-285)', () => {
  it('presents a carousel without standings as complete, with no standings slide', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ standingsIncluded: false })) });
    renderApp(REVIEW, server);
    await waitForDraft();
    expect(screen.queryByRole('article', { name: /Clasificación/ })).toBeNull();
    const carouselRegion = screen.getByRole('region', { name: 'Carrusel' });
    expect(within(carouselRegion).getAllByRole('article')).toHaveLength(1);
    expect(within(carouselRegion).getAllByRole('button', { name: /^Diapositiva/ })).toHaveLength(3);
  });
});
