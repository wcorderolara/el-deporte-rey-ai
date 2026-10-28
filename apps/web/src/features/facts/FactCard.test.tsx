/**
 * Fact card reason texts (OD-63 F-2, R-416): the reason and the publication block reason come from the closed codes in
 * the interface language (Spanish by default, English on request), marked with their language; the server's reason is
 * shown, marked as English, only for an unverified fact without a reason code. Everything renders as text.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FactCard, type FactCardProps } from './FactCard';
import { PROJECT_ID, RUN_ID, scoreFact } from './test/fixtures';

afterEach(cleanup);

function renderCard(overrides: Partial<FactCardProps>) {
  const props: FactCardProps = {
    fact: scoreFact({ n: 1, matchKey: 'm1', display: '2-1' }),
    label: 'Marcador: Equipo A - Equipo B',
    teams: new Map(),
    projectId: PROJECT_ID,
    runId: RUN_ID,
    manualApproval: 'not_manual_data',
    headingLevel: 3,
    onUpdated: () => undefined,
    announce: () => undefined,
    ...overrides,
  };
  render(
    <ul>
      <FactCard {...props} />
    </ul>,
  );
  return screen.getByTestId('fact');
}

describe('FactCard reason texts', () => {
  it('shows the Spanish reason and block reason by default', () => {
    const card = renderCard({
      fact: scoreFact({
        n: 1,
        matchKey: 'm1',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        reason: 'Awaiting independent verification; single source: demo-a.',
        blockReason: 'not_verified',
      }),
    });
    const reason = within(card).getByTestId('fact-reason');
    expect(reason.textContent).toBe(
      'Sin verificar: pendiente de verificación independiente; el valor tiene el respaldo de una sola fuente ' +
        'aceptada independiente.',
    );
    expect(reason.getAttribute('lang')).toBe('es');
    const note = within(card).getByTestId('publication-note');
    expect(note.textContent).toBe(
      '⛔ Bloquea la aprobación de publicación del contenido que lo usa: el dato no está verificado.',
    );
    expect(note.querySelector('[lang="es"]')?.textContent).toBe('el dato no está verificado.');
    expect(card.textContent).not.toContain('single source');
  });

  it('shows the English reason and block reason when the language is English', () => {
    const card = renderCard({
      language: 'en',
      fact: scoreFact({
        n: 1,
        matchKey: 'm1',
        status: 'manually_approved',
        reason: 'Manually approved by the operator (operator-attested); not verified.',
        blockReason: 'manually_approved_not_publishable',
      }),
    });
    const reason = within(card).getByTestId('fact-reason');
    expect(reason.textContent).toBe(
      'Manually approved: the operator attests the imported value. It does not count as an accepted source or as a ' +
        'second source.',
    );
    expect(reason.getAttribute('lang')).toBe('en');
    expect(card.querySelector('dl')?.textContent).not.toMatch(/verific/i);
    expect(within(card).getByTestId('publication-note').querySelector('[lang="en"]')?.textContent).toBe(
      'manual approval allows publication only in competitions configured as having no accepted public source, and ' +
        'this competition is not.',
    );
  });

  it('shows the server reason, marked as English, only for an unverified fact without a reason code', () => {
    const card = renderCard({
      fact: scoreFact({
        n: 1,
        matchKey: 'm1',
        status: 'unverified',
        unverifiedReason: null,
        reason: '<b>Server</b> reason text.',
      }),
    });
    const reason = within(card).getByTestId('fact-reason');
    expect(reason.textContent).toBe('<b>Server</b> reason text.');
    expect(reason.getAttribute('lang')).toBe('en');
    expect(reason.getAttribute('data-origin')).toBe('server');
    expect(reason.querySelector('b')).toBeNull();
  });

  it('shows the reason of a verified fact even when the server sends none', () => {
    const card = renderCard({ fact: scoreFact({ n: 1, matchKey: 'm1', display: '2-1', reason: null }) });
    expect(within(card).getByTestId('fact-reason').textContent).toBe(
      'Verificado: fuentes aceptadas independientes coinciden en el valor.',
    );
  });
});
