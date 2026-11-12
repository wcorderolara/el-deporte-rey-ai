/**
 * Final carousel approval (R-240, OD-02, PD-09, AD-13): enabled only when the server reports the carousel ready,
 * reasons listed otherwise, server refusals listing the elements, a valid approval linking to the exports, and an
 * approval invalidated by a later change.
 */
import {
  EDITORIAL_DELIVERABLES,
  type EditorialDeliverable,
  type EditorialPackage,
  type EditorialVersion,
  type FinalApproval,
} from '@edr/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  API,
  blockingFact,
  CAROUSEL_ID,
  caption,
  carousel,
  draft,
  DRAFT_PATH,
  draftResponse,
  editorialPackage,
  elementId,
  factId,
  fakeServer,
  json,
  PASSING_QA,
  problem,
  PROJECT_ID,
  renderApp,
  slide,
} from './test/support';

afterEach(cleanup);

const REVIEW = `/projects/${PROJECT_ID}/review`;
const FINAL = `${API}/carousels/${CAROUSEL_ID}/final-approval`;

const APPROVAL: FinalApproval = {
  id: '99999999-9999-4999-8999-999999999999',
  carouselId: CAROUSEL_ID,
  approvedAt: '2026-10-27T14:00:00Z',
  versionSetSha256: 'a'.repeat(64),
  valid: true,
};

function allApproved() {
  return [
    slide(1, 1, 'cover', { state: 'approved' }),
    slide(2, 2, 'match_result', { state: 'approved' }),
    caption(3, 3, { state: 'approved' }),
  ];
}

async function finalPanel(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Aprobación final' });
}

function finalButton(panel: HTMLElement): HTMLButtonElement {
  return within(panel).getByRole('button', { name: 'Aprobar carrusel completo' }) as HTMLButtonElement;
}

describe('Final approval control (R-240)', () => {
  it('is disabled while elements are not approved or blocked, listing each element and reason', async () => {
    const elements = [
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true, blockingFacts: [blockingFact({ factId: factId(1) })] }),
      slide(4, 3, 'closing', {
        qa: PASSING_QA.map((result) =>
          result.check === 'capitalized_tokens'
            ? { ...result, outcome: 'fail' as const, details: { tokens: ['Fulano'] } }
            : result,
        ),
      }),
      caption(3, 4),
    ];
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(elements)] })) });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    const control = finalButton(panel);
    expect(control.disabled).toBe(true);
    const reasons = document.getElementById(control.getAttribute('aria-describedby') ?? '');
    await userEvent.click(within(reasons as HTMLElement).getByText('Ver elementos pendientes y motivos'));
    const items = within(reasons as HTMLElement)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toEqual([
      'Diapositiva 2: Resultado: no aprobado, bloqueado por datos no publicables',
      'Diapositiva 3: Cierre: no aprobado, con advertencias del control visual sin confirmar',
    ]);
    expect(panel.textContent).toContain('Faltan 2 diapositivas por aprobar o corregir.');
    expect(panel.textContent).toContain('La exportación necesita una aprobación final válida.');
    // There is no page of its own for the final approval (UX-REVIEW-01): nothing opens while it is disabled.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirms in a dialog with the real state, then offers the download in the review', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const after = draft({
      carousels: [carousel(allApproved(), { readyForFinalApproval: true, finalApproval: APPROVAL })],
    });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(ready), draftResponse(after)],
      [`PUT ${FINAL}`]: () => json(APPROVAL),
    });
    const router = renderApp(REVIEW, server);
    const panel = await finalPanel();
    expect(panel.textContent).toContain('Todas las diapositivas están aprobadas y ninguna está bloqueada.');
    const control = finalButton(panel);
    expect(control.disabled).toBe(false);

    await userEvent.click(control);
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    expect(dialog.textContent).toContain('Diapositivas aprobadas2 de 2');
    expect(dialog.textContent).toContain('Aprobado: se incluye en la descarga (caption.txt).');
    expect(dialog.textContent).toContain(
      'Sin generar. Opcional: puedes generarlo y aprobarlo después y volver a descargar; no anula la aprobación del carrusel.',
    );
    expect(dialog.textContent).toContain('Errores bloqueantesNinguno');
    // Nothing is approved before the confirmation.
    expect(server.callsTo('PUT', FINAL)).toHaveLength(0);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' }));

    expect(await within(panel).findByText('Aprobación final registrada.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(panel.textContent).toContain('La aprobación final es válida. El carrusel se puede exportar.');
    // PD-ARCH-01F: the carousel is downloaded from the review. The export history is not linked from the review
    // (Product Owner, 2026-11-10); it stays on the project page and in «Exportaciones».
    expect(await within(panel).findByRole('button', { name: 'Descargar carrusel' })).toBeTruthy();
    expect(within(panel).queryByRole('link', { name: 'Historial de exportaciones' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Aprobar carrusel completo' })).toBeNull();
    // The operator stays in the review (no navigation to the exports or to a page of the approved project).
    expect(router.state.location.pathname).toBe(REVIEW);
    expect(screen.getByRole('heading', { level: 3, name: 'Diapositiva 1: Portada' })).toBeTruthy();
    const [call] = server.callsTo('PUT', FINAL);
    expect(call?.body).toBeUndefined();
    expect(call?.headers['X-EDR-Client']).toBe('web');
  });

  it('counts only the texts the server can export, and keeps the carousel approvable (REVIEW-APPROVAL-01)', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const base = editorialPackage();
    const version = (deliverable: EditorialDeliverable, state: EditorialVersion['state']): EditorialVersion => ({
      id: `b0000000-0000-4000-8000-00000000000${String(EDITORIAL_DELIVERABLES.indexOf(deliverable) + 1)}`,
      deliverable,
      versionNumber: 1,
      origin: 'generated',
      state,
      fields: [{ name: 'question', text: '¿Pregunta?', words: 1, characters: 10 }],
      flags: [],
      generationId: 'b0000000-0000-4000-8000-0000000000aa',
      instructions: null,
      eventIds: [],
      evidenceIds: [],
      createdAt: '2026-11-12T10:00:00Z',
      approvedAt: state === 'approved' ? '2026-11-12T10:05:00Z' : null,
    });
    // Three approved, one of them with sports data that stopped being publishable (the server says not exportable),
    // and two pending.
    const states: EditorialVersion['state'][] = ['approved', 'ready', 'approved', 'approved', 'ready'];
    const exportable = [true, false, true, false, false];
    const withCopy: EditorialPackage = {
      ...base,
      deliverables: base.deliverables.map((entry, index) => ({
        ...entry,
        current: version(entry.deliverable, states[index] ?? 'ready'),
        versionCount: 1,
        exportable: exportable[index] ?? false,
      })),
    };
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(ready),
      [`GET ${API}/projects/${PROJECT_ID}/editorial`]: () => json(withCopy),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    await userEvent.click(finalButton(panel));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    expect(dialog.textContent).toContain('2 de 5 textos listos para exportar.');
    expect(dialog.textContent).toContain('1 texto aprobado requiere revisión por cambios en los datos deportivos.');
    expect(dialog.textContent).toContain(
      'Opcional: los textos listos se incluyen en la descarga (copy-editorial.txt) y los demás quedan fuera.',
    );
    expect(dialog.textContent).toContain('los cambios en el copy no anulan la aprobación del carrusel');
    expect(dialog.textContent).not.toContain('3 de 5');
    // The graphic approval does not depend on the copy.
    expect(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('keeps the final approval available when the copy state cannot be read', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(ready),
      [`GET ${API}/projects/${PROJECT_ID}/editorial`]: () =>
        problem({ status: 500, code: 'INTERNAL', detail: 'An internal error occurred.' }),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    await userEvent.click(finalButton(panel));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        'No se pudo leer su estado. Es opcional: no afecta a la aprobación del carrusel.',
      ),
    );
    expect(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('cancels without any request, and shows the pending state while the server answers', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    let answer: ((response: Response) => void) | undefined;
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(ready),
      [`PUT ${FINAL}`]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    await userEvent.click(finalButton(panel));
    let dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.callsTo('PUT', FINAL)).toHaveLength(0);

    await userEvent.click(finalButton(panel));
    dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' }));
    const pending = within(dialog).getByRole('button', { name: 'Registrando la aprobación final…' });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Aprobar carrusel completo' })).toBeTruthy();
    answer?.(json(APPROVAL));
    expect(await within(panel).findByText('Aprobación final registrada.')).toBeTruthy();
    expect(server.callsTo('PUT', FINAL)).toHaveLength(1);
  });

  it('lists the elements named by a FINAL_APPROVAL_REFUSED answer and refreshes the view', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(ready),
      [`PUT ${FINAL}`]: () =>
        problem({
          status: 409,
          code: 'FINAL_APPROVAL_REFUSED',
          items: [
            { elementId: elementId(2), reason: 'blocked' },
            { elementId: elementId(3), reason: 'not_approved' },
            { elementId: 'bad', reason: 'other' },
          ],
        }),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    await userEvent.click(finalButton(panel));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo dar la aprobación final');
    expect(alert.textContent).toContain('hay elementos pendientes');
    expect(dialog.textContent).toContain('Elementos que impiden la aprobación final:');
    expect(dialog.textContent).toContain('Diapositiva 2: Resultado: bloqueado por datos no publicables');
    expect(dialog.textContent).toContain('Texto de publicación y hashtags: no aprobado');
    expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length).toBeGreaterThanOrEqual(2);
  });

  it('disables the confirmation when a concurrent change leaves the carousel not ready', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const changed = draft({
      carousels: [
        carousel([slide(1, 1, 'cover', { state: 'approved' }), slide(2, 2, 'match_result'), caption(3, 3)], {
          readyForFinalApproval: false,
        }),
      ],
    });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(ready), draftResponse(changed)],
      [`PUT ${FINAL}`]: () =>
        problem({
          status: 409,
          code: 'FINAL_APPROVAL_REFUSED',
          items: [{ elementId: elementId(2), reason: 'not_approved' }],
        }),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    await userEvent.click(finalButton(panel));
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar carrusel completo' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar aprobación final' }));
    // The refusal names the slide, and the refreshed draft lists it as blocking too.
    expect((await within(dialog).findAllByText(/Diapositiva 2: Resultado: no aprobado/)).length).toBe(2);
    await waitFor(() =>
      expect(
        (within(dialog).getByRole('button', { name: 'Confirmar aprobación final' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect(dialog.textContent).toContain('Diapositivas aprobadas1 de 2');
    expect(server.callsTo('PUT', FINAL)).toHaveLength(1);
  });

  it('shows a final approval invalidated by a later change and offers it again once ready', async () => {
    const invalid = draft({
      carousels: [
        carousel(allApproved(), { readyForFinalApproval: true, finalApproval: { ...APPROVAL, valid: false } }),
      ],
    });
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(invalid) });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    expect(panel.textContent).toContain('ya no es válida porque el contenido cambió');
    expect(within(panel).queryByRole('link', { name: 'Historial de exportaciones' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Descargar carrusel' })).toBeNull();
    expect(finalButton(panel).disabled).toBe(false);
  });

  it('stays disabled with a generic note when the server reports not ready without a visible reason', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: false })] })),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    expect(finalButton(panel).disabled).toBe(true);
    expect(panel.textContent).toContain('todavía no está listo para la aprobación final');
  });
});
