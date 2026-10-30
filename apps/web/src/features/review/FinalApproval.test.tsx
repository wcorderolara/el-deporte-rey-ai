/**
 * Final carousel approval (R-240, OD-02, PD-09, AD-13): enabled only when the server reports the carousel ready,
 * reasons listed otherwise, server refusals listing the elements, a valid approval linking to the exports, and an
 * approval invalidated by a later change.
 */
import type { FinalApproval } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
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
  return within(panel).getByRole('button', { name: /aprobación final/ }) as HTMLButtonElement;
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
      'Texto de publicación y hashtags: no aprobado',
    ]);
    expect(panel.textContent).toContain('La exportación necesita una aprobación final válida.');
  });

  it('records the final approval when the carousel is ready, then links to the exports', async () => {
    const ready = draft({ carousels: [carousel(allApproved(), { readyForFinalApproval: true })] });
    const after = draft({
      carousels: [carousel(allApproved(), { readyForFinalApproval: true, finalApproval: APPROVAL })],
    });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(ready), draftResponse(after)],
      [`PUT ${FINAL}`]: () => json(APPROVAL),
    });
    renderApp(REVIEW, server);
    const panel = await finalPanel();
    expect(panel.textContent).toContain('2 de 2 diapositivas aprobadas');
    expect(panel.textContent).toContain('Copy aprobado');
    expect(panel.textContent).toContain('Todos los elementos están aprobados y ninguno está bloqueado.');
    const control = finalButton(panel);
    expect(control.disabled).toBe(false);

    await userEvent.click(control);

    expect(await within(panel).findByText('Aprobación final registrada.')).toBeTruthy();
    expect(panel.textContent).toContain('La aprobación final es válida. El carrusel se puede exportar.');
    expect(within(panel).getByRole('link', { name: 'Ir a exportaciones' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}/exports`,
    );
    expect(within(panel).queryByRole('button', { name: 'Dar la aprobación final' })).toBeNull();
    const [call] = server.callsTo('PUT', FINAL);
    expect(call?.body).toBeUndefined();
    expect(call?.headers['X-EDR-Client']).toBe('web');
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
    const alert = await within(panel).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo dar la aprobación final');
    expect(alert.textContent).toContain('hay elementos pendientes');
    expect(panel.textContent).toContain('Elementos que impiden la aprobación final:');
    expect(panel.textContent).toContain('Diapositiva 2: Resultado: bloqueado por datos no publicables');
    expect(panel.textContent).toContain('Texto de publicación y hashtags: no aprobado');
    expect(server.callsTo('GET', `${API}/projects/${PROJECT_ID}/draft`).length).toBeGreaterThanOrEqual(2);
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
    expect(within(panel).queryByRole('link', { name: 'Ir a exportaciones' })).toBeNull();
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
