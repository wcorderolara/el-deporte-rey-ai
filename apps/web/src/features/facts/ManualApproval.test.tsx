/**
 * Manual approval in the facts view (R-071, R-272, R-412): controls only for eligible facts, reasons for the others,
 * approval and revocation through the contract operations, server refusals with their reason, and the publication
 * notes of PD-17 and PD-18 (R-026, R-078, R-271).
 */
import { FactSchema, type Fact } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTS_URL,
  factId,
  fakeServer,
  jsonResponse,
  liveFacts,
  MANUAL,
  manualApprovalUrl,
  manualFacts,
  NEWER_RUN_ID,
  problemResponse,
  run,
  RUNS_URL,
  type Reply,
} from './test/fixtures';
import { factCard, renderFacts, waitForFacts } from './test/render';

afterEach(cleanup);

function manualFact(n: number): Fact {
  const fact = manualFacts().facts.find((item) => item.factId === factId(n));
  if (fact === undefined) {
    throw new Error(`fixture fact ${n} missing`);
  }
  return fact;
}

function server(extra: Record<string, Reply | Reply[]> = {}, runs = [run()], facts: unknown = manualFacts()) {
  return fakeServer({
    [`GET ${FACTS_URL}`]: jsonResponse(facts),
    [`GET ${RUNS_URL}`]: jsonResponse({ runs }),
    ...extra,
  });
}

describe('controls only for eligible facts', () => {
  it('offers approval for eligible facts and revocation for manually approved facts', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(
      within(factCard('match:m1:score')).getByRole('button', { name: 'Aprobar manualmente: Marcador · m1' }),
    ).toBeTruthy();
    expect(within(factCard('match:m1:kickoff')).getByRole('button', { name: /^Aprobar manualmente/ })).toBeTruthy();
    for (const key of ['match:m7:score', 'match:m8:score']) {
      expect(within(factCard(key)).getByRole('button', { name: /^Revocar la aprobación manual/ })).toBeTruthy();
      expect(within(factCard(key)).queryByRole('button', { name: /^Aprobar manualmente/ })).toBeNull();
    }
    expect(screen.getAllByRole('button', { name: /^Aprobar manualmente/ })).toHaveLength(2);
    expect(screen.getByTestId('manual-approval-note').textContent).toContain('nunca marca un dato como verificado');
  });

  it.each([
    ['match:m2:score', 'El dato está en disputa entre fuentes.'],
    ['match:m3:teams', 'La identidad del equipo no está confirmada.'],
    ['match:m4:score', 'Una fuente aceptada no coincide con el dato.'],
    ['match:m5:score', 'El dato ya está verificado.'],
    ['match:m6:score', 'El dato no tiene un valor candidato.'],
  ])('gives %s no control and the reason "%s"', async (key, reason) => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard(key);
    expect(within(card).queryByRole('button')).toBeNull();
    expect(within(card).getByTestId('manual-unavailable').textContent).toBe(
      `Aprobación manual no disponible: ${reason}`,
    );
  });

  it('offers no control on a run that is not the latest completed full run', async () => {
    const { fetch } = server({}, [run({ id: NEWER_RUN_ID, runNumber: 2 }), run()]);
    renderFacts(fetch);
    await waitForFacts();

    expect(screen.queryByRole('button', { name: /Aprobar manualmente|Revocar/ })).toBeNull();
    expect(screen.getByTestId('manual-approval-note').textContent).toContain(
      'Esta no es la ejecución completa más reciente del proyecto',
    );
  });
});

describe('approval and revocation', () => {
  it('approves after confirmation with a bodyless PUT carrying the client header', async () => {
    const user = userEvent.setup();
    const approved = FactSchema.parse({
      ...manualFact(MANUAL.eligibleNoSource),
      status: 'manually_approved',
      unverifiedReason: null,
      manualApproval: { approvedAt: '2026-10-26T09:00:00Z', carriedOverFromFactId: null },
    });
    const url = manualApprovalUrl(factId(MANUAL.eligibleNoSource));
    const { fetch, calls } = server({ [`PUT ${url}`]: jsonResponse(approved) });
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m1:score');
    await user.click(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
    const group = within(card).getByRole('group', { name: 'Confirmar la aprobación manual' });
    expect(group.textContent).toContain('no es una verificación y no cuenta como segunda fuente');
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: 'Confirmar' }));
    await user.click(within(group).getByRole('button', { name: 'Confirmar' }));

    const revoke = await within(card).findByRole('button', { name: /^Revocar la aprobación manual/ });
    expect(document.activeElement).toBe(revoke);
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.url).toBe(url);
    expect(put?.headers['X-EDR-Client']).toBe('web');
    expect(put?.headers['Content-Type']).toBeUndefined();
    expect(put?.body).toBeUndefined();
    expect(card.getAttribute('data-status')).toBe('manually_approved');
    expect(card.querySelector('article > div')?.textContent).toContain(
      'Aprobado manualmente(atestiguado por el operador)',
    );
    expect(card.querySelector('article > div')?.textContent).not.toMatch(/verific/i);
    expect(screen.getByTestId('facts-status').textContent).toBe(
      'Dato aprobado manualmente (atestiguado por el operador).',
    );
    expect(screen.getByTestId('facts-summary').textContent).toContain('3 aprobados manualmente');
  });

  it('returns focus to the trigger and sends nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const { fetch, calls } = server();
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m1:score');
    await user.click(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
    await user.click(within(card).getByRole('button', { name: 'Cancelar' }));

    expect(document.activeElement).toBe(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
    expect(calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
  });

  it('announces a server refusal with its reason and leaves the fact unchanged', async () => {
    const user = userEvent.setup();
    const url = manualApprovalUrl(factId(MANUAL.eligibleNoSource));
    const { fetch } = server({
      [`PUT ${url}`]: problemResponse(409, 'MANUAL_APPROVAL_REFUSED', { refusalReason: 'accepted_source_disagrees' }),
    });
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m1:score');
    await user.click(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
    await user.click(within(card).getByRole('button', { name: 'Confirmar' }));

    const alert = await within(card).findByRole('alert');
    expect(alert.textContent).toContain('No se puede aprobar manualmente este dato.');
    expect(alert.textContent).toContain('Una fuente aceptada no coincide con el dato.');
    expect(within(alert).queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(card.getAttribute('data-status')).toBe('unverified');
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
  });

  it('offers a retry after a network failure and succeeds on retry', async () => {
    const user = userEvent.setup();
    const url = manualApprovalUrl(factId(MANUAL.eligibleNoSource));
    const approved = { ...manualFact(MANUAL.eligibleNoSource), status: 'manually_approved', unverifiedReason: null };
    const { fetch } = server({ [`PUT ${url}`]: [new TypeError('connection reset'), jsonResponse(approved)] });
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m1:score');
    await user.click(within(card).getByRole('button', { name: /^Aprobar manualmente/ }));
    await user.click(within(card).getByRole('button', { name: 'Confirmar' }));
    await user.click(await within(card).findByRole('button', { name: 'Reintentar' }));

    expect(await within(card).findByRole('button', { name: /^Revocar/ })).toBeTruthy();
    expect(within(card).queryByRole('alert')).toBeNull();
  });

  it('revokes with a DELETE and the fact returns to unverified', async () => {
    const user = userEvent.setup();
    const fact = manualFact(MANUAL.attestedBlocked);
    const revoked = {
      ...fact,
      status: 'unverified',
      unverifiedReason: 'no_accepted_source',
      blockReason: 'not_verified',
      manualApproval: null,
    };
    const url = manualApprovalUrl(fact.factId);
    const { fetch, calls } = server({ [`DELETE ${url}`]: jsonResponse(revoked) });
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m7:score');
    await user.click(within(card).getByRole('button', { name: /^Revocar/ }));
    expect(within(card).getByRole('group', { name: 'Confirmar la revocación' }).textContent).toContain(
      'se anularán las aprobaciones finales',
    );
    await user.click(within(card).getByRole('button', { name: 'Confirmar' }));

    expect(await within(card).findByRole('button', { name: /^Aprobar manualmente/ })).toBeTruthy();
    const call = calls.find((item) => item.method === 'DELETE');
    expect(call?.headers['X-EDR-Client']).toBe('web');
    expect(call?.body).toBeUndefined();
    expect(card.getAttribute('data-status')).toBe('unverified');
    expect(card.textContent).toContain('Sin verificar(sin fuente aceptada)');
    expect(screen.getByTestId('facts-status').textContent).toBe('Aprobación manual revocada.');
  });
});

describe('publication approval notes', () => {
  it('names the PD-17 block for a manually approved fact of a competition with an accepted source', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(within(factCard('match:m7:score')).getByTestId('publication-note').textContent).toContain(
      'la aprobación manual solo permite publicar en competiciones configuradas sin fuente pública aceptada',
    );
    expect(within(factCard('match:m8:score')).getByTestId('publication-note').textContent).toContain(
      'se etiqueta como atestiguado por el operador',
    );
    expect(within(factCard('match:m1:score')).getByTestId('publication-note').textContent).toContain(
      'el dato no está verificado.',
    );
  });

  it('shows both republishing-permission states and the single-source block (PD-18, R-078, R-271)', async () => {
    const { fetch } = server({}, [run()], liveFacts());
    renderFacts(fetch);
    await waitForFacts();

    expect(within(factCard('match:m1:score')).getByTestId('publication-note').textContent).toBe(
      '⛔ Bloquea la aprobación de publicación del contenido que lo usa: permiso de republicación no confirmado.',
    );
    expect(within(factCard('match:m2:score')).getByTestId('publication-note').textContent).toBe(
      'El servidor no indica ningún bloqueo de publicación para este dato.',
    );
    const single = factCard('match:m3:score');
    expect(within(single).getByTestId('fact-reason').textContent).toBe(
      'Sin verificar: pendiente de verificación independiente; el valor tiene el respaldo de una sola fuente ' +
        'aceptada independiente.',
    );
    expect(single.textContent).not.toContain('single source');
    expect(within(single).getByTestId('publication-note').textContent).toContain('el dato no está verificado.');
  });
});
