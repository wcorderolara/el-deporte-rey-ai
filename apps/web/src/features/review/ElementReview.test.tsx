/**
 * Per-element review (R-206, R-217, R-271, R-272, R-406, OD-09, OD-26, OD-38): approval of the exact version,
 * blocked facts named with their block reasons (both republishing-permission states and both PD-17 eligibility
 * states), server refusals, content flags, QA results and the acknowledgement of warnings, withdrawal and
 * regeneration of one element only.
 */
import type { Element, FactRef, QaResult } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  API,
  blockingFact,
  CAROUSEL_ID,
  caption,
  carousel,
  checkedElement,
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
  PASSING_QA,
  problem,
  PROJECT_ID,
  renderApp,
  slide,
  version,
  versionId,
} from './test/support';

afterEach(cleanup);

const REVIEW = `/projects/${PROJECT_ID}/review`;
const DRAFT_GET = `${API}/projects/${PROJECT_ID}/draft`;
const SLIDE = 'Diapositiva 1: Resultado';

async function card(name = SLIDE): Promise<HTMLElement> {
  return screen.findByRole('article', { name });
}

function button(container: HTMLElement, name: string | RegExp): HTMLButtonElement {
  if (name === 'Aprobar esta versión') {
    name = container.textContent?.includes('Texto de publicación y hashtags')
      ? 'Aprobar texto del carrusel'
      : 'Aprobar diapositiva';
  }
  if (name === 'Regenerar este elemento') name = /^Regenerar (diapositiva|texto del carrusel)$/;
  return within(container).getByRole('button', { name }) as HTMLButtonElement;
}

/** One match-result slide at position 1, plus an approved caption, with the given version overrides. */
function singleSlideDraft(
  overrides: Parameters<typeof version>[1] = {},
  mode: 'DEMO_DATA' | 'LIVE_DATA' | 'MANUAL_DATA' = 'DEMO_DATA',
) {
  return modeDraft(mode, {
    carousels: [carousel([slide(1, 1, 'match_result', overrides), caption(2, 2, { state: 'approved' })])],
  });
}

function approved(element: Element): Element {
  return checkedElement({ ...element, currentVersion: { ...element.currentVersion, state: 'approved' } });
}

describe('Element approval binds to the exact version (R-406)', () => {
  it('approves the shown version with its version ID and the client header, then refreshes the draft', async () => {
    const element = slide(1, 1, 'match_result');
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(singleSlideDraft()), draftResponse(singleSlideDraft({ state: 'approved' }))],
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () => json(approved(element)),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    expect(slideCard.textContent).toContain('Lista para aprobar');

    await userEvent.click(button(slideCard, 'Aprobar esta versión'));

    expect(await within(slideCard).findByText('Versión 1 aprobada.')).toBeTruthy();
    const [call] = server.callsTo('PUT', elementPath(CAROUSEL_ID, elementId(1), 'approval'));
    expect(call?.body).toEqual({ versionId: versionId(1) });
    expect(call?.headers['X-EDR-Client']).toBe('web');
    expect(within(slideCard).getAllByText('Aprobada').length).toBeGreaterThan(0);
    expect(button(slideCard, 'Retirar la aprobación')).toBeTruthy();
    expect(server.callsTo('GET', DRAFT_GET).length).toBeGreaterThanOrEqual(2);
  });

  it('withdraws an approval', async () => {
    const element = slide(1, 1, 'match_result', { state: 'approved' });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(singleSlideDraft({ state: 'approved' })), draftResponse(singleSlideDraft())],
      [`DELETE ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () =>
        json(checkedElement({ ...element, currentVersion: { ...element.currentVersion, state: 'ready' } })),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Retirar la aprobación'));
    expect(await within(slideCard).findByText('Aprobación retirada.')).toBeTruthy();
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(false);
    const [call] = server.callsTo('DELETE', elementPath(CAROUSEL_ID, elementId(1), 'approval'));
    expect(call?.body).toBeUndefined();
    expect(call?.headers['X-EDR-Client']).toBe('web');
  });

  it('announces a version conflict and refreshes the view (the UI never assumes success)', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(singleSlideDraft()),
        draftResponse(singleSlideDraft({ id: versionId(9), versionNumber: 2 })),
      ],
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () =>
        problem({ status: 409, code: 'VERSION_CONFLICT' }),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Aprobar esta versión'));
    const alert = await within(slideCard).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo aprobar: Diapositiva 1: Resultado');
    expect(alert.textContent).toContain('El contenido cambió mientras tanto');
    expect(await within(slideCard).findByRole('img', { name: /versión 2$/ })).toBeTruthy();
    expect(within(slideCard).queryByText('Aprobada')).toBeNull();
  });
});

describe('Blocked content (R-206): approval refused naming the fact, other content still approvable', () => {
  const unverifiedScore = blockingFact({ factId: factId(1) });

  it('names the blocking fact and its reason, disables approval, and keeps unaffected content approvable', async () => {
    const blockedSlide = slide(1, 1, 'match_result', {
      blocked: true,
      blockingFacts: [unverifiedScore],
      fields: [{ field: 'score', segments: [factSegment('2-1', factId(1), 'unverified')] }],
    });
    const freeCaption = caption(2, 2, { fields: [{ field: 'caption', segments: [commentary('Sin datos')] }] });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(draft({ carousels: [carousel([blockedSlide, freeCaption])] })),
      [`PUT ${elementPath(CAROUSEL_ID, elementId(2), 'approval')}`]: () =>
        json(checkedElement({ ...freeCaption, currentVersion: { ...freeCaption.currentVersion, state: 'approved' } })),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();

    expect(within(slideCard).getByText('Bloqueada')).toBeTruthy();
    const blocked = within(slideCard).getByRole('list', { name: 'Datos que bloquean la aprobación' });
    expect(blocked.textContent).toContain('Marcador: 2-1');
    expect(blocked.textContent).toContain('Sin verificar');
    expect(blocked.textContent).toContain('Dato sin verificar: pendiente de verificación independiente.');
    const approve = button(slideCard, 'Aprobar esta versión');
    expect(approve.disabled).toBe(true);
    const description = document.getElementById(approve.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('usa datos que no son publicables');

    const captionCard = await openCaption();
    expect(within(captionCard).queryByText('Bloqueada')).toBeNull();
    await userEvent.click(button(captionCard, 'Aprobar esta versión'));
    expect(await within(captionCard).findByText('Versión 1 aprobada.')).toBeTruthy();
    expect(server.callsTo('PUT', elementPath(CAROUSEL_ID, elementId(1), 'approval'))).toHaveLength(0);
  });

  it('shows the facts named by an APPROVAL_BLOCKED refusal of the server', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(singleSlideDraft()),
        draftResponse(singleSlideDraft({ blocked: true, blockingFacts: [unverifiedScore] })),
      ],
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () =>
        problem({
          status: 409,
          code: 'APPROVAL_BLOCKED',
          facts: [unverifiedScore, { factId: 'not-a-uuid', hostile: '<script>' }],
        }),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Aprobar esta versión'));
    const alert = await within(slideCard).findByRole('alert');
    expect(alert.textContent).toContain('hay datos que bloquean la aprobación');
    const refused = within(slideCard).getByRole('list', { name: 'El servidor rechazó la aprobación por estos datos:' });
    expect(within(refused).getAllByRole('listitem')).toHaveLength(1);
    expect(refused.textContent).toContain('Marcador: 2-1');
    expect(refused.textContent).toContain('pendiente de verificación independiente');
    expect(slideCard.innerHTML).not.toContain('<script>');
    // The refresh shows the server's blocked overlay.
    expect(await within(slideCard).findByText('Bloqueada')).toBeTruthy();
  });
});

describe('Republishing permission (R-271, R-078): both states', () => {
  const liveScore: FactRef = blockingFact({
    factId: factId(1),
    status: 'verified',
    unverifiedReason: null,
    blockReason: 'publication_permission_unconfirmed',
  });

  it('refuses approval with the reason "permission not confirmed" while no confirmation is recorded', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        singleSlideDraft(
          {
            blocked: true,
            blockingFacts: [liveScore],
            fields: [{ field: 'score', segments: [factSegment('2-1', factId(1), 'verified')] }],
          },
          'LIVE_DATA',
        ),
      ),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    const blocked = within(slideCard).getByRole('list', { name: 'Datos que bloquean la aprobación' });
    expect(blocked.textContent).toContain('Permiso de republicación no confirmado.');
    expect(blocked.textContent).toContain('Verificado');
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
  });

  it('allows approval once the confirmation is recorded (the fact is no longer blocking)', async () => {
    const element = slide(1, 1, 'match_result', {
      fields: [{ field: 'score', segments: [factSegment('2-1', factId(1), 'verified')] }],
    });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        modeDraft('LIVE_DATA', { carousels: [carousel([element, caption(2, 2, { state: 'approved' })])] }),
      ),
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () => json(approved(element)),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    expect(within(slideCard).queryByText('Permiso de republicación no confirmado.')).toBeNull();
    await userEvent.click(button(slideCard, 'Aprobar esta versión'));
    expect(await within(slideCard).findByText('Versión 1 aprobada.')).toBeTruthy();
  });

  it('shows the permission reason when the server refuses a stale view', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(singleSlideDraft({}, 'LIVE_DATA')),
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () =>
        problem({ status: 409, code: 'APPROVAL_BLOCKED', facts: [liveScore] }),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Aprobar esta versión'));
    const refused = await within(slideCard).findByRole('list', {
      name: 'El servidor rechazó la aprobación por estos datos:',
    });
    expect(refused.textContent).toContain('Permiso de republicación no confirmado.');
  });
});

describe('Manually approved facts (R-272, PD-17): both eligibility states, always operator-attested', () => {
  const attestedName = blockingFact({
    factId: factId(3),
    kind: 'team_official_name',
    factKey: 'team:equipo-1a:name',
    status: 'manually_approved',
    unverifiedReason: null,
    display: 'Atlético Demo',
    blockReason: 'manually_approved_not_publishable',
  });
  const segments = [
    { field: 'team_home' as const, segments: [factSegment('Atlético Demo', factId(3), 'manually_approved')] },
  ];

  it('refuses approval for a competition with an accepted public source, naming the fact', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        singleSlideDraft({ blocked: true, blockingFacts: [attestedName], fields: segments }, 'MANUAL_DATA'),
      ),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    const blocked = within(slideCard).getByRole('list', { name: 'Datos que bloquean la aprobación' });
    expect(blocked.textContent).toContain('Nombre oficial del equipo: Atlético Demo');
    expect(blocked.textContent).toContain('Aprobado manualmente');
    expect(blocked.textContent).toContain('atestiguado por el operador');
    expect(blocked.textContent).toContain('Aprobación manual no publicable con la política actual');
    expect(blocked.textContent).not.toContain('Verificado');
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
  });

  it('allows approval for a competition configured without an accepted public source, labelled operator-attested', async () => {
    const element = slide(1, 1, 'match_result', { fields: segments });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        modeDraft('MANUAL_DATA', { carousels: [carousel([element, caption(2, 2, { state: 'approved' })])] }),
      ),
      [`PUT ${elementPath(CAROUSEL_ID, elementId(1), 'approval')}`]: () => json(approved(element)),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    expect(within(slideCard).queryByText('Bloqueada')).toBeNull();
    await userEvent.click(button(slideCard, 'Aprobar esta versión'));
    expect(await within(slideCard).findByText('Versión 1 aprobada.')).toBeTruthy();
  });
});

describe('Content flags and blocking QA failures (R-207, OD-09)', () => {
  it('lists content flags as text and blocks approval until regeneration', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(
        singleSlideDraft({
          contentFlags: [
            { code: 'UNVERIFIED_NUMBER', field: 'headline', excerpt: 'tres goles <b>' },
            { code: 'NON_OFFICIAL_TEAM_NAME', field: 'description', excerpt: 'Atletico' },
          ],
        }),
      ),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    const flags = within(slideCard).getByRole('region', { name: `Observaciones del contenido: ${SLIDE}` });
    expect(flags.textContent).toContain('Número o cantidad que no viene de un dato');
    expect(flags.textContent).toContain('«tres goles <b>»');
    expect(flags.textContent).toContain('Nombre de equipo no oficial');
    expect(flags.querySelector('b')).toBeNull();
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
    expect(slideCard.textContent).toContain('tiene observaciones del contenido; regenere el elemento');
  });

  it('shows a blocking QA failure with its details, without an acknowledgement control', async () => {
    const qa = PASSING_QA.map((result) =>
      result.check === 'text_fit'
        ? { ...result, outcome: 'fail' as const, details: { overflowingElements: ['headline'] } }
        : result.check === 'data_match'
          ? {
              ...result,
              outcome: 'fail' as const,
              details: { mismatches: [{ elementId: 'score', factId: factId(1), expected: '2-1', actual: '2-7' }] },
            }
          : result,
    );
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(singleSlideDraft({ state: 'qa_failed', qa })) });
    renderApp(REVIEW, server);
    const slideCard = await card();
    const qaRegion = within(slideCard).getByRole('region', { name: `Control visual: ${SLIDE}` });
    expect(qaRegion.textContent).toContain('Ajuste del texto');
    expect(qaRegion.textContent).toContain('Textos que no caben: headline');
    expect(qaRegion.textContent).toContain('esperado «2-1», obtenido «2-7»');
    expect(qaRegion.textContent).toContain('Un fallo bloqueante solo se resuelve regenerando el elemento.');
    expect(within(qaRegion).queryByRole('button')).toBeNull();
    expect(within(slideCard).getAllByText('Control visual fallido').length).toBeGreaterThan(0);
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
  });
});

describe('QA warnings (OD-09, OD-26, OD-38): acknowledged one check per request', () => {
  const warnings = PASSING_QA.map((result) =>
    result.check === 'style_consistency'
      ? {
          ...result,
          outcome: 'fail' as const,
          details: { colorsOutsidePalette: ['#ff00ff'], fontsOutsideSet: [], templateVersions: ['cover@1', 'cover@2'] },
        }
      : result.check === 'capitalized_tokens'
        ? { ...result, outcome: 'fail' as const, details: { tokens: ['Fulano', '<img src=x>'] } }
        : result,
  );

  it('shows the flagged tokens as text and sends each acknowledgement separately', async () => {
    const element = slide(1, 1, 'match_result', { qa: warnings });
    const afterTokens = checkedElement({
      ...element,
      currentVersion: {
        ...element.currentVersion,
        qa: warnings.map((result) =>
          result.check === 'capitalized_tokens' ? { ...result, acknowledgedAt: '2026-10-27T12:30:00Z' } : result,
        ),
      },
    });
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(singleSlideDraft({ qa: warnings })),
        draftResponse(singleSlideDraft({ qa: afterTokens.currentVersion.qa })),
      ],
      [`POST ${elementPath(CAROUSEL_ID, elementId(1), 'qa-acknowledgements')}`]: () => json(afterTokens),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    const qaRegion = within(slideCard).getByRole('region', { name: `Control visual: ${SLIDE}` });
    expect(qaRegion.textContent).toContain('Palabras señaladas');
    expect(within(qaRegion).getByText('Fulano')).toBeTruthy();
    expect(within(qaRegion).getByText('<img src=x>')).toBeTruthy();
    expect(qaRegion.querySelector('img')).toBeNull();
    expect(qaRegion.textContent).toContain('Colores fuera de la paleta: #ff00ff');
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
    expect(slideCard.textContent).toContain('hay advertencias del control visual sin confirmar');
    expect(slideCard.textContent).toContain('Hay 2 advertencias del control visual.');

    // Only the failed checks are listed, next to the actions (PD-ARCH-01E-B review).
    expect(qaRegion.textContent).not.toContain('Ajuste del texto');
    await userEvent.click(button(qaRegion, 'Confirmar la advertencia: Palabras con mayúscula no reconocidas'));
    expect(await within(slideCard).findByText('Advertencia confirmada.')).toBeTruthy();
    const calls = server.callsTo('POST', elementPath(CAROUSEL_ID, elementId(1), 'qa-acknowledgements'));
    expect(calls.map((call) => call.body)).toEqual([{ versionId: versionId(1), checks: ['capitalized_tokens'] }]);
    expect(calls[0]?.headers['X-EDR-Client']).toBe('web');
    // The acknowledged warning leaves the list; the style warning still needs its own acknowledgement.
    const stillPending = within(slideCard).getByRole('region', { name: `Control visual: ${SLIDE}` });
    expect(stillPending.textContent).not.toContain('Palabras con mayúscula');
    expect(button(stillPending, 'Confirmar la advertencia: Coherencia visual')).toBeTruthy();
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
  });

  it('announces a refused acknowledgement', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(singleSlideDraft({ qa: warnings })),
      [`POST ${elementPath(CAROUSEL_ID, elementId(1), 'qa-acknowledgements')}`]: () =>
        problem({ status: 409, code: 'VERSION_CONFLICT' }),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Confirmar la advertencia: Coherencia visual'));
    const alert = await within(slideCard).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo confirmar la advertencia');
  });
});

describe('Caption review (PD-ARCH-01E-B)', () => {
  const CAPTION = 'Texto de publicación y hashtags';
  const tokenWarning = PASSING_QA.filter((result) => result.check === 'capitalized_tokens').map((result) => ({
    ...result,
    outcome: 'fail' as const,
    details: { tokens: ['Calendario'] },
  }));

  function captionDraft(qa: QaResult[] = tokenWarning) {
    return modeDraft('MANUAL_DATA', {
      carousels: [
        carousel([slide(1, 1, 'match_result', { state: 'approved' }), caption(2, 2, { state: 'ready', qa })]),
      ],
    });
  }

  it('shows one heading and no technical details, and acknowledges a warning next to the actions', async () => {
    const element = caption(2, 2, { state: 'ready', qa: tokenWarning });
    const acknowledged = checkedElement({
      ...element,
      currentVersion: {
        ...element.currentVersion,
        qa: tokenWarning.map((result) => ({ ...result, acknowledgedAt: '2026-11-05T12:00:00Z' })),
      },
    });
    const server = fakeServer({
      [DRAFT_PATH]: [draftResponse(captionDraft()), draftResponse(captionDraft(acknowledged.currentVersion.qa))],
      [`POST ${elementPath(CAROUSEL_ID, elementId(2), 'qa-acknowledgements')}`]: () => json(acknowledged),
    });
    renderApp(REVIEW, server);
    await card('Diapositiva 1: Resultado');
    const captionCard = await openCaption();
    const section = captionCard.closest<HTMLElement>('section[aria-label]') ?? captionCard;
    expect(within(section).getAllByRole('heading', { name: CAPTION })).toHaveLength(1);
    expect(within(captionCard).queryByText('Detalles y verificaciones')).toBeNull();
    expect(button(captionCard, 'Aprobar texto del carrusel').disabled).toBe(true);

    const pending = within(captionCard).getByRole('region', { name: `Control visual: ${CAPTION}` });
    expect(pending.textContent).toContain('Palabras con mayúscula no reconocidas');
    expect(within(pending).getByText('Calendario')).toBeTruthy();
    await userEvent.click(button(pending, 'Confirmar la advertencia: Palabras con mayúscula no reconocidas'));
    expect(await within(captionCard).findByText('Advertencia confirmada.')).toBeTruthy();
    expect(server.callsTo('POST', elementPath(CAROUSEL_ID, elementId(2), 'qa-acknowledgements'))).toHaveLength(1);
    expect(within(captionCard).queryByRole('region', { name: `Control visual: ${CAPTION}` })).toBeNull();
    expect(button(captionCard, 'Aprobar texto del carrusel').disabled).toBe(false);
  });
});

describe('Regeneration of one element (R-217, R-040)', () => {
  it('creates a new version of that element only, which needs QA and approval again', async () => {
    const first = slide(1, 1, 'match_result', { state: 'approved' });
    const second = slide(2, 2, 'closing', { state: 'approved' });
    const regenerated = checkedElement({
      ...first,
      currentVersion: version(7, {
        versionNumber: 2,
        state: 'pending_qa',
        qa: [],
        imageUrl: null,
        width: null,
        height: null,
        fields: [{ field: 'headline', segments: [commentary('Titular regenerado')] }],
      }),
    });
    const server = fakeServer({
      [DRAFT_PATH]: [
        draftResponse(draft({ carousels: [carousel([first, second])] })),
        draftResponse(draft({ carousels: [carousel([regenerated, second])] })),
      ],
      [`POST ${elementPath(CAROUSEL_ID, elementId(1), 'regenerate')}`]: () => json(regenerated, 201),
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Regenerar este elemento'));

    expect(await within(slideCard).findByText(/Se creó la versión 2/)).toBeTruthy();
    expect(slideCard.textContent).toContain('necesita una aprobación nueva');
    expect(within(slideCard).getAllByText('Pendiente del control visual').length).toBeGreaterThan(0);
    expect(button(slideCard, 'Aprobar esta versión').disabled).toBe(true);
    expect(document.activeElement).toBe(within(slideCard).getByRole('heading', { name: SLIDE }));
    const [call] = server.callsTo('POST', elementPath(CAROUSEL_ID, elementId(1), 'regenerate'));
    expect(call?.body).toBeUndefined();
    expect(call?.headers['X-EDR-Client']).toBe('web');

    await userEvent.click(screen.getByRole('button', { name: /^Diapositiva 2: Cierre/ }));
    const otherCard = await card('Diapositiva 2: Cierre');
    expect(within(otherCard).getAllByText('Aprobada').length).toBeGreaterThan(0);
    expect(server.callsTo('POST', elementPath(CAROUSEL_ID, elementId(2), 'regenerate'))).toHaveLength(0);
  });

  it('offers a retry when the AI provider fails (502)', async () => {
    const element = slide(1, 1, 'match_result');
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(singleSlideDraft()),
      [`POST ${elementPath(CAROUSEL_ID, elementId(1), 'regenerate')}`]: [
        () => problem({ status: 502, code: 'PROVIDER_FAILED' }),
        () =>
          json(
            checkedElement({ ...element, currentVersion: version(8, { versionNumber: 2, state: 'pending_qa' }) }),
            201,
          ),
      ],
    });
    renderApp(REVIEW, server);
    const slideCard = await card();
    await userEvent.click(button(slideCard, 'Regenerar este elemento'));
    const alert = await within(slideCard).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo regenerar');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await within(slideCard).findByText(/Se creó la versión 2/)).toBeTruthy();
  });
});
