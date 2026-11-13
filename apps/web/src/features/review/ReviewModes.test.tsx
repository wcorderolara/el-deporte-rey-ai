/**
 * The review workspace of UX-REVIEW-01 over the fake server: the two modes on one page with real pending counts, the
 * state kept across modes and copy tabs (selected slide, unsaved edits), the protection of unsaved edits, the
 * preview navigation and zoom, the collapsible slide list, the downloads of an approved carousel, and a project whose
 * editorial copy cannot be read. All data is synthetic; nothing calls a real or billed service.
 */
import type { EditorialPackage, EditorialVersion, FinalApproval } from '@edr/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  API,
  CAROUSEL_ID,
  caption,
  carousel,
  draft,
  DRAFT_PATH,
  draftResponse,
  editorialPackage,
  fakeServer,
  json,
  openCaption,
  openCopyTab,
  openMode,
  PASSING_QA,
  problem,
  PROJECT_ID,
  renderApp,
  slide,
  versionId,
} from './test/support';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const REVIEW = `/projects/${PROJECT_ID}/review`;
const EDITORIAL = `${API}/projects/${PROJECT_ID}/editorial`;
const T1 = '2026-11-10T10:00:00Z';

function editorialVersion(
  overrides: Partial<EditorialVersion> & Pick<EditorialVersion, 'deliverable' | 'fields'>,
): EditorialVersion {
  return {
    id: 'b0000000-0000-4000-8000-000000000001',
    versionNumber: 1,
    origin: 'generated',
    state: 'ready',
    flags: [],
    generationId: 'b0000000-0000-4000-8000-0000000000aa',
    instructions: null,
    eventIds: [],
    evidenceIds: [],
    createdAt: T1,
    approvedAt: null,
    ...overrides,
  };
}

const MAIN = editorialVersion({
  deliverable: 'facebook_instagram',
  fields: [
    { name: 'headline', text: 'NADIE LO VIO VENIR', words: 4, characters: 18 },
    { name: 'body', text: 'Equipo Norte 3-0 Equipo Sur y la jornada ardió.', words: 9, characters: 47 },
    { name: 'question', text: '¿Fue goleada o paseo?', words: 4, characters: 21 },
    { name: 'hashtags', text: '#ElDeporteRey #Futbol', words: 2, characters: 21 },
  ],
});
const TIKTOK = editorialVersion({
  id: 'b0000000-0000-4000-8000-000000000002',
  deliverable: 'tiktok_reels',
  fields: [{ name: 'copy', text: 'Corto y al pie: 3-0.', words: 5, characters: 20 }],
});

function withVersions(current: EditorialVersion[] = [MAIN, TIKTOK]): EditorialPackage {
  const base = editorialPackage();
  return {
    ...base,
    deliverables: base.deliverables.map((entry) => {
      const found = current.find((item) => item.deliverable === entry.deliverable) ?? null;
      return { ...entry, current: found, versionCount: found === null ? 0 : 1 };
    }),
  };
}

function modes() {
  return screen.getByRole('tablist', { name: 'Modo de revisión' });
}

describe('Review modes on one page (UX-REVIEW-01)', () => {
  it('opens on «Diseño visual» with the real pending counts, as accessible tabs', async () => {
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse() }));
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    const [design, copy] = within(modes()).getAllByRole('tab');
    expect(design?.textContent).toBe('Diseño visual 3 pendientes');
    expect(design?.getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(copy?.textContent).toBe('Copy editorial 1 pendiente'));
    expect(document.getElementById(copy?.getAttribute('aria-controls') ?? '')?.hidden).toBe(true);
    expect(screen.queryByRole('region', { name: 'Copy editorial' })).toBeNull();

    const indicators = screen.getByRole('list', { name: 'Estado de la revisión' });
    expect(
      within(indicators)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['◐Diapositivas:0/3 aprobadas', '◐Copy:0/1 aprobados · editorial sin generar', '✓Bloqueos:ninguno']);

    design?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(copy?.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('region', { name: 'Copy editorial' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Carrusel' })).toBeNull();
  });

  it('keeps the selected slide and unsaved copy edits across modes and copy tabs', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(), [`GET ${EDITORIAL}`]: () => json(withVersions()) });
    renderApp(REVIEW, server);
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();

    await openMode('Copy editorial');
    const region = await screen.findByRole('region', { name: 'Copy editorial' });
    await within(region).findByText('NADIE LO VIO VENIR');
    await user.click(within(region).getByRole('button', { name: 'Editar texto' }));
    const question = within(region).getByRole('textbox', { name: 'Pregunta' });
    await user.clear(question);
    await user.type(question, '¿Paseo o goleada?');
    // An open edit holds the approval of that deliverable.
    expect((within(region).getByRole('button', { name: 'Aprobar copy' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(modes()).getByRole('tab', { name: /^Copy editorial/ }).textContent).toBe(
      'Copy editorial Sin guardar',
    );

    await openCopyTab('TikTok / Reels');
    expect(within(region).getByText('Corto y al pie: 3-0.')).toBeTruthy();
    const tabs = within(region).getByRole('tablist', { name: 'Entregables del copy editorial' });
    expect(within(tabs).getByRole('tab', { name: /^Facebook/ }).textContent).toBe('Facebook / Instagram Sin guardar');
    await openCopyTab('Facebook / Instagram');
    expect((within(region).getByRole('textbox', { name: 'Pregunta' }) as HTMLTextAreaElement).value).toBe(
      '¿Paseo o goleada?',
    );

    await openMode('Diseño visual');
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
    await openMode('Copy editorial');
    expect((within(region).getByRole('textbox', { name: 'Pregunta' }) as HTMLTextAreaElement).value).toBe(
      '¿Paseo o goleada?',
    );
    expect(server.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  });

  it('asks before leaving the review with unsaved edits', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(), [`GET ${EDITORIAL}`]: () => json(withVersions()) });
    const router = renderApp(REVIEW, server);
    await openMode('Copy editorial');
    const region = await screen.findByRole('region', { name: 'Copy editorial' });
    await within(region).findByText('NADIE LO VIO VENIR');
    await user.click(within(region).getByRole('button', { name: 'Editar texto' }));
    await user.type(within(region).getByRole('textbox', { name: 'Pregunta' }), ' Sí.');

    await user.click(screen.getByRole('link', { name: 'Volver al proyecto' }));
    let dialog = await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(router.state.location.pathname).toBe(REVIEW);
    expect((within(region).getByRole('textbox', { name: 'Pregunta' }) as HTMLTextAreaElement).value).toBe(
      '¿Fue goleada o paseo? Sí.',
    );

    await user.click(screen.getByRole('link', { name: 'Volver al proyecto' }));
    dialog = await screen.findByRole('dialog', { name: 'Cambios sin guardar' });
    await user.click(within(dialog).getByRole('button', { name: 'Salir sin guardar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${PROJECT_ID}`));
  });

  it('keeps the edits on screen when the server refuses the save', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: () => json(withVersions()),
      [`POST ${EDITORIAL}/deliverables/facebook_instagram/edits`]: () =>
        problem({ status: 409, code: 'VERSION_CONFLICT' }),
    });
    renderApp(REVIEW, server);
    await openMode('Copy editorial');
    const region = await screen.findByRole('region', { name: 'Copy editorial' });
    await within(region).findByText('NADIE LO VIO VENIR');
    await user.click(within(region).getByRole('button', { name: 'Editar texto' }));
    await user.type(within(region).getByRole('textbox', { name: 'Pregunta' }), ' Sí.');
    await user.click(within(region).getByRole('button', { name: 'Guardar cambios' }));
    expect((await within(region).findByRole('alert')).textContent).toContain(
      'No se pudo completar la acción sobre el copy editorial',
    );
    expect((within(region).getByRole('textbox', { name: 'Pregunta' }) as HTMLTextAreaElement).value).toBe(
      '¿Fue goleada o paseo? Sí.',
    );
  });
});

describe('Design workspace (UX-REVIEW-01)', () => {
  it('moves with previous and next, and zooms the preview without changing the slide', async () => {
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse() }));
    const preview = await screen.findByRole('region', { name: 'Vista previa: Diapositiva 1: Portada' });
    expect(preview.textContent).toContain('Diapositiva 01 de 03');
    expect(preview.textContent).toContain('1080 × 1350 px · Versión 1');
    expect((within(preview).getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true);
    // Fullscreen is offered only where the browser supports it (not in this test environment).
    expect(within(preview).queryByRole('button', { name: 'Pantalla completa' })).toBeNull();

    await userEvent.click(within(preview).getByRole('button', { name: 'Acercar' }));
    await userEvent.click(within(preview).getByRole('button', { name: 'Acercar' }));
    const image = within(preview).getByRole('img', { name: 'Imagen de Diapositiva 1: Portada, versión 1' });
    expect(image.parentElement?.style.width).toBe('150%');
    await userEvent.click(within(preview).getByRole('button', { name: 'Ajustar al espacio (150 %)' }));
    expect(image.parentElement?.style.width).toBe('100%');

    await userEvent.click(within(preview).getByRole('button', { name: 'Siguiente' }));
    const next = await screen.findByRole('region', { name: 'Vista previa: Diapositiva 2: Resultado' });
    expect(next.textContent).toContain('Diapositiva 02 de 03');
    await userEvent.click(within(next).getByRole('button', { name: 'Siguiente' }));
    const last = await screen.findByRole('region', { name: 'Vista previa: Diapositiva 3: Cierre' });
    expect((within(last).getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(within(last).getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
  });

  it('collapses the slide list and keeps every slide reachable', async () => {
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse() }));
    const rail = await screen.findByRole('navigation', { name: 'Diapositivas del carrusel' });
    const collapse = within(rail).getByRole('button', { name: 'Contraer la lista de diapositivas' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(collapse);
    const expand = within(rail).getByRole('button', { name: 'Mostrar la lista de diapositivas' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(within(rail).queryByRole('img')).toBeNull();
    await userEvent.click(within(rail).getByRole('button', { name: /^Diapositiva 3: Cierre/ }));
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 3: Cierre' })).toBeTruthy();
    await userEvent.click(expand);
    expect(within(rail).getAllByRole('button', { name: /^Diapositiva/ })).toHaveLength(3);
  });

  it('shows each slide state and issue in the list, and offers the next pending slide', async () => {
    const items = [
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true }),
      slide(3, 3, 'closing'),
      caption(4, 4),
    ];
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(items)] })) }));
    const rail = await screen.findByRole('navigation', { name: 'Diapositivas del carrusel' });
    const labels = within(rail)
      .getAllByRole('button', { name: /^Diapositiva/ })
      .map((item) => item.textContent);
    expect(labels).toEqual([
      '01 · Portada✓Aprobada',
      '02 · Resultado!Bloqueada por datos',
      '03 · Cierre•Lista para aprobar',
    ]);
    expect(rail.textContent).toContain('1 diapositiva lista para aprobar');
    expect(rail.textContent).toContain('1 no se puede aprobar todavía');
    const header = screen.getByRole('list', { name: 'Estado de la revisión' });
    expect(header.textContent).toContain('Bloqueos:1');
    await userEvent.click(screen.getByRole('button', { name: /^Siguiente pendiente/ }));
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 2: Resultado' })).toBeTruthy();
  });
});

describe('Slide states: the name, the badge and the inspector agree (A11Y-02)', () => {
  const STATES = [
    'Aprobada',
    'Bloqueada por datos',
    'Advertencia por confirmar',
    'Requiere regenerar',
    'Pendiente del control visual',
    'Lista para aprobar',
  ];

  it('names each slide with the state its badge shows, and its inspector states the same and offers only what it allows', async () => {
    const warning = PASSING_QA.map((result) =>
      result.check === 'capitalized_tokens'
        ? { ...result, outcome: 'fail' as const, details: { tokens: ['GOLAZO'] } }
        : result,
    );
    const failed = PASSING_QA.map((result) =>
      result.check === 'text_fit'
        ? { ...result, outcome: 'fail' as const, details: { overflowingElements: ['headline'] } }
        : result,
    );
    const items = [
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true }),
      slide(3, 3, 'match_result', { qa: warning }),
      slide(4, 4, 'match_result', { state: 'qa_failed', qa: failed }),
      slide(5, 5, 'match_result', { state: 'pending_qa', qa: [] }),
      slide(6, 6, 'closing'),
      caption(7, 7),
    ];
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(items)] })) }));
    const rail = await screen.findByRole('navigation', { name: 'Diapositivas del carrusel' });
    const expected: [string, string, 'approved' | 'disabled' | 'enabled'][] = [
      ['Diapositiva 1: Portada', 'Aprobada', 'approved'],
      ['Diapositiva 2: Resultado', 'Bloqueada por datos', 'disabled'],
      ['Diapositiva 3: Resultado', 'Advertencia por confirmar', 'disabled'],
      ['Diapositiva 4: Resultado', 'Requiere regenerar', 'disabled'],
      ['Diapositiva 5: Resultado', 'Pendiente del control visual', 'disabled'],
      ['Diapositiva 6: Cierre', 'Lista para aprobar', 'enabled'],
    ];
    for (const [name, state, approval] of expected) {
      const item = within(rail).getByRole('button', { name: `${name}, ${state}` });
      // The visible badge of the list says the same as the name.
      expect(item.textContent).toContain(state);
      await userEvent.click(item);
      const inspector = await screen.findByRole('region', { name: `Estado y acciones: ${name}` });
      const badge = within(inspector).getByText(state);
      expect(badge.closest('header')).not.toBeNull();
      for (const other of STATES.filter((label) => label !== state)) {
        expect(inspector.textContent, `${name}: ${other}`).not.toContain(other);
      }
      if (approval === 'approved') {
        expect(within(inspector).getByRole('button', { name: 'Retirar la aprobación' })).toBeTruthy();
      } else {
        const approve = within(inspector).getByRole('button', { name: 'Aprobar diapositiva' }) as HTMLButtonElement;
        expect(approve.disabled, name).toBe(approval === 'disabled');
      }
    }
  });
});

describe('Review menu (UX-REVIEW-01)', () => {
  it('refreshes the view from the menu, which before the final approval only offers that', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    const panel = await screen.findByRole('region', { name: 'Aprobación final' });
    expect(screen.queryByRole('button', { name: 'Actualizar la vista' })).toBeNull();
    await userEvent.click(within(panel).getByRole('button', { name: 'Más opciones' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Actualizar la vista']);
    const before = server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length;
    await userEvent.click(items[0] as HTMLElement);
    await waitFor(() => expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length).toBe(before + 1));
  });
});

describe('Downloads of an approved carousel (UX-REVIEW-01)', () => {
  const APPROVAL: FinalApproval = {
    id: '99999999-9999-4999-8999-999999999999',
    carouselId: CAROUSEL_ID,
    approvedAt: '2026-10-27T14:00:00Z',
    versionSetSha256: 'a'.repeat(64),
    valid: true,
  };
  function approved() {
    return draft({
      carousels: [
        carousel(
          [
            slide(1, 1, 'cover', { state: 'approved' }),
            slide(2, 2, 'match_result', { state: 'approved' }),
            caption(3, 3, { state: 'approved' }),
          ],
          { readyForFinalApproval: true, finalApproval: APPROVAL },
        ),
      ],
    });
  }

  it('offers only the supported downloads in a menu, without leaving the review', async () => {
    const saved: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
    const router = renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse(approved()) }));
    const panel = await screen.findByRole('region', { name: 'Aprobación final' });
    expect(await within(panel).findByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Aprobar carrusel completo' })).toBeNull();

    await userEvent.click(within(panel).getByRole('button', { name: 'Más opciones' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, (item as HTMLButtonElement).disabled])).toEqual([
      ['Actualizar la vista', false],
      ['Descargar diapositiva 1 (PNG)', false],
      ['Descargar copy editorial (.txt)', true],
      ['Copiar copy editorial', true],
    ]);
    await userEvent.click(items[1] as HTMLElement);
    expect(saved).toEqual([{ href: `${API}/element-versions/${versionId(1)}/image`, download: 'diapositiva-01.png' }]);
    // A success is announced, not shown (Product Owner, 2026-11-10).
    expect((await within(panel).findByText('Descarga de la diapositiva 1 iniciada.')).className).toBe('sr-only');
    expect(within(panel).queryByRole('link', { name: 'Historial de exportaciones' })).toBeNull();
    expect(router.state.location.pathname).toBe(REVIEW);
  });

  it('downloads the editorial copy from the same menu once it exists', async () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:editorial';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderApp(
      REVIEW,
      fakeServer({ [DRAFT_PATH]: draftResponse(approved()), [`GET ${EDITORIAL}`]: () => json(withVersions()) }),
    );
    const panel = await screen.findByRole('region', { name: 'Aprobación final' });
    await userEvent.click(await within(panel).findByRole('button', { name: 'Más opciones' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Descargar copy editorial (.txt)' }));
    expect(await blobs[0]?.text()).toContain('=== FACEBOOK E INSTAGRAM (Listo para aprobar · Versión 1) ===');
    expect(await within(panel).findByText('Copy editorial descargado.')).toBeTruthy();
  });
});

describe('Compatibility (UX-REVIEW-01)', () => {
  it('keeps the review usable when the editorial copy cannot be read', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: () => problem({ status: 500, code: 'INTERNAL' }),
    });
    renderApp(REVIEW, server);
    expect(await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' })).toBeTruthy();
    await openMode('Copy editorial');
    const region = await screen.findByRole('region', { name: 'Copy editorial' });
    expect((await within(region).findByRole('alert')).textContent).toContain('No se pudo cargar el copy editorial.');
    expect(within(region).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    const captionCard = await openCaption();
    expect(within(captionCard).getByRole('button', { name: 'Aprobar texto del carrusel' })).toBeTruthy();
  });

  it('has no carousel-text tab for a carousel without caption', async () => {
    const items = [slide(1, 1, 'cover'), slide(2, 2, 'match_result')];
    renderApp(REVIEW, fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(items)] })) }));
    await screen.findByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' });
    await openMode('Copy editorial');
    const tabs = await screen.findByRole('tablist', { name: 'Entregables del copy editorial' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Copy para redes Sin generar']);
  });
});
