/**
 * Review page (R-208, R-215, R-269, R-285, OD-03, OD-21, OD-28): loading and error states, the demonstration
 * banner, the preview of every slide in carousel order with caption and hashtags, provenance labels, numbered
 * carousels, left-out matches, a draft without standings, and the exclusions editor that starts a redraft.
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
  FACTS_RUN_ID,
  json,
  matchFacts,
  modeDraft,
  problem,
  PROJECT_ID,
  redraftRun,
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
  const details = await screen.findByText('Datos y trazabilidad del borrador');
  if (details.closest('details')?.open !== true) await userEvent.click(details);
  return screen.findByRole('heading', { level: 2, name: 'Borrador' });
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
    const summary = screen.getByRole('region', { name: 'Borrador' });
    expect(summary.textContent).toContain('Datos de demostración');
  });

  it('shows no demonstration banner for a MANUAL_DATA draft and names its mode', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(modeDraft('MANUAL_DATA')) });
    renderApp(REVIEW, server);
    await waitForDraft();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByRole('region', { name: 'Borrador' }).textContent).toContain('Datos manuales');
  });
});

describe('Review workspace navigation and hierarchy', () => {
  it('keeps one primary title, functional breadcrumbs, and no technical details section', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 1, name: 'Revisión del contenido' });
    await screen.findByRole('navigation', { name: 'Diapositivas del carrusel' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toBeTruthy();
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
    await userEvent.click(within(slideCard).getByRole('button', { name: 'Aprobar y siguiente' }));
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
    await userEvent.click(within(slideCard).getByRole('button', { name: 'Aprobar y siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: /Diapositiva 2: Resultado/ }));
    resolveApproval?.(json(approvedFirst));
    expect(await screen.findByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Diapositiva 2: Resultado/ }).getAttribute('aria-current')).toBe('true');
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
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar todas' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar aprobación de diapositivas' });
    expect(dialog.textContent).toContain('3 listas para aprobar');
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
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar todas' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar todas' }));
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

    const captionCard = screen.getByRole('article', { name: 'Texto de publicación y hashtags' });
    expect(captionCard.textContent).toContain('Texto de publicación de prueba con');
    expect(captionCard.textContent).toContain('#JornadaDemo #FutbolDemo');
    expect(within(captionCard).queryByRole('img')).toBeNull();
    const secondSlide = within(carouselRegion).getByRole('button', { name: /Diapositiva 2:/ });
    await userEvent.click(within(carouselRegion).getByRole('button', { name: /Diapositiva 1:/ }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
    expect(secondSlide.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(secondSlide);
    expect(screen.getByRole('article', { name: 'Diapositiva 2: Resultado' })).toBeTruthy();
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
    expect(screen.getByRole('region', { name: 'Borrador' }).textContent).toContain('2 carruseles');
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

describe('Review page: operator-attested facts (R-071, OD-28)', () => {
  it('says in the draft summary that manually approved facts are operator-attested, never verified', async () => {
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

    // The draft uses a MANUALLY_APPROVED fact: the summary says so, never calling it verified (OD-28).
    const summary = screen.getByRole('region', { name: 'Borrador' });
    expect(summary.textContent).toContain('atestiguados por el operador');
    expect(summary.textContent).toContain('No son datos verificados');
  });

  it('shows no operator-attested note when no fact is manually approved', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    await waitForDraft();
    expect(screen.getByRole('region', { name: 'Borrador' }).textContent).not.toContain('atestiguados');
  });
});

describe('Review page: left-out matches and standings (R-255, R-285)', () => {
  it('lists left-out matches with their status and reason', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        draft({
          excludedMatchKeys: ['demo-m3'],
          leftOutMatches: [
            { matchKey: 'demo-m4', label: 'Equipo Norte - Equipo Sur', status: 'postponed', reason: 'not_finished' },
            { matchKey: 'demo-m5', label: 'Equipo Este - Equipo Oeste', status: 'finished', reason: 'not_verified' },
            {
              matchKey: 'demo-m3',
              label: 'Real Muestra - Sporting Modelo',
              status: 'finished',
              reason: 'excluded_by_operator',
            },
            { matchKey: 'demo-m6', label: 'Equipo Uno - Equipo Dos', status: null, reason: 'not_finished' },
          ],
        }),
      ),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    const table = screen.getByRole('table', { name: 'Partidos fuera del borrador' });
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Equipo Norte - Equipo Sur', 'Aplazado', 'El partido no ha finalizado.'],
      ['Equipo Este - Equipo Oeste', 'Finalizado', 'Los datos del partido no tienen un valor utilizable.'],
      ['Real Muestra - Sporting Modelo', 'Finalizado', 'Excluido por el operador.'],
      ['Equipo Uno - Equipo Dos', 'Estado no informado', 'El partido no ha finalizado.'],
    ]);
  });

  it('says that every match is in the draft when none is left out', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    await waitForDraft();
    expect(screen.getByText('Todos los partidos de la selección están en el borrador.')).toBeTruthy();
  });

  it('presents a carousel without standings as complete, with a note and no standings slide', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ standingsIncluded: false })) });
    renderApp(REVIEW, server);
    await waitForDraft();
    const summary = screen.getByRole('region', { name: 'Borrador' });
    expect(summary.textContent).toContain('no incluye diapositivas de clasificación');
    expect(summary.textContent).toContain('no se calcula a partir de los resultados');
    expect(screen.queryByRole('article', { name: /Clasificación/ })).toBeNull();
    const carouselRegion = screen.getByRole('region', { name: 'Carrusel' });
    expect(within(carouselRegion).getAllByRole('article')).toHaveLength(2);
  });
});

describe('Review page: exclusions editor (OD-03)', () => {
  const FACTS = `GET ${API}/projects/${PROJECT_ID}/runs/${FACTS_RUN_ID}/facts`;
  const EXCLUSIONS = `PUT ${API}/projects/${PROJECT_ID}/draft/exclusions`;

  it('loads the matches only when opened, excludes one and starts a redraft', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        draft({
          leftOutMatches: [
            {
              matchKey: 'demo-m3',
              label: 'Real Muestra - Sporting Modelo',
              status: 'postponed',
              reason: 'not_finished',
            },
          ],
        }),
      ),
      [FACTS]: () => json(matchFacts()),
      [EXCLUSIONS]: () => json(redraftRun(), 202),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    expect(server.callsTo('GET', FACTS.slice(4))).toHaveLength(0);

    const open = screen.getByRole('button', { name: 'Editar partidos excluidos' });
    expect(open.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(open);
    expect(screen.getByRole('button', { name: 'Cerrar la edición de exclusiones' }).getAttribute('aria-expanded')).toBe(
      'true',
    );

    const group = await screen.findByRole('group', { name: 'Partidos de la selección' });
    const boxes = within(group).getAllByRole('checkbox');
    // The match left out as not finished is not offered.
    expect(boxes.map((box) => (box as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'Excluir Atlético Demo - Club Ejemplo',
      'Excluir Deportivo Prueba - Unión Ficticia',
    ]);
    const submit = screen.getByRole('button', { name: 'Guardar exclusiones y crear un borrador nuevo' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(within(group).getByRole('checkbox', { name: 'Excluir Deportivo Prueba - Unión Ficticia' }));
    expect(group.textContent).toContain('1 partido excluido.');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(submit);

    expect(await screen.findByText(/Se inició un borrador nuevo \(ejecución 2\)/)).toBeTruthy();
    const [call] = server.callsTo('PUT', EXCLUSIONS.slice(4));
    expect(call?.body).toEqual({ excludedMatchKeys: ['demo-m2'] });
    expect(call?.headers['X-EDR-Client']).toBe('web');
    expect(screen.getByRole('link', { name: 'Ver el progreso en la página del proyecto' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}`,
    );
  });

  it('offers an excluded match for inclusion again and sends the remaining exclusions', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        draft({
          excludedMatchKeys: ['demo-m1', 'demo-m3'],
          leftOutMatches: [
            {
              matchKey: 'demo-m1',
              label: 'Atlético Demo - Club Ejemplo',
              status: 'finished',
              reason: 'excluded_by_operator',
            },
            {
              matchKey: 'demo-m3',
              label: 'Real Muestra - Sporting Modelo',
              status: 'finished',
              reason: 'excluded_by_operator',
            },
          ],
        }),
      ),
      [FACTS]: () => json(matchFacts()),
      [EXCLUSIONS]: () => json(redraftRun(), 202),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Editar partidos excluidos' }));
    const group = await screen.findByRole('group', { name: 'Partidos de la selección' });
    const first = within(group).getByRole('checkbox', { name: 'Excluir Atlético Demo - Club Ejemplo' });
    expect((first as HTMLInputElement).checked).toBe(true);
    await userEvent.click(first);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar exclusiones y crear un borrador nuevo' }));
    await screen.findByText(/Se inició un borrador nuevo/);
    expect(server.callsTo('PUT', EXCLUSIONS.slice(4))[0]?.body).toEqual({ excludedMatchKeys: ['demo-m3'] });
  });

  it('announces a refused redraft (run in progress) and keeps the choices', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [FACTS]: () => json(matchFacts()),
      [EXCLUSIONS]: () => problem({ status: 409, code: 'RUN_IN_PROGRESS' }),
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Editar partidos excluidos' }));
    const group = await screen.findByRole('group', { name: 'Partidos de la selección' });
    await userEvent.click(within(group).getByRole('checkbox', { name: 'Excluir Atlético Demo - Club Ejemplo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar exclusiones y crear un borrador nuevo' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron guardar las exclusiones');
    expect(alert.textContent).toContain('Ya hay una ejecución en curso');
    expect(
      (within(group).getByRole('checkbox', { name: 'Excluir Atlético Demo - Club Ejemplo' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('announces a failure to load the matches, with a retry', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [FACTS]: [() => problem({ status: 500, code: 'INTERNAL' }), () => json(matchFacts())],
    });
    renderApp(REVIEW, server);
    await waitForDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Editar partidos excluidos' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar los partidos');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('group', { name: 'Partidos de la selección' })).toBeTruthy();
  });
});
