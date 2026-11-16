/**
 * UI-06.3, conflicting sources in fact verification (mechanism 2, R-205, R-230, R-412): the dispute record names
 * every source with its value and independence group in an accessible table, states the consultation and its outcome
 * in words (never by colour alone), shows a resolved value only when the dispute is resolved, and offers no control;
 * the card of a disputed fact shows no value, says that publication is blocked, and offers no control that could set
 * a value in place of the dispute.
 */
import type { Dispute, Evidence, Fact } from '@edr/contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { disputeOutcomeLabel } from './copy';
import { DisputeRecord } from './DisputeRecord';
import { FactCard } from './FactCard';
import { evidence, PROJECT_ID, RUN_ID, scoreFact } from './test/fixtures';

afterEach(cleanup);

const OFFICIAL_AT = '2026-10-25T18:40:00Z';
const disagreeing: Evidence[] = [
  evidence({ relation: 'disagrees', value: { home: 2, away: 1 } }),
  evidence({
    sourceId: 'demo-b',
    sourceName: 'Fuente de demostración B',
    relation: 'disagrees',
    value: { home: 1, away: 1 },
  }),
  evidence({
    sourceId: 'demo-oficial',
    sourceName: 'Publicación oficial de demostración',
    role: 'verification',
    officialPublication: true,
    relation: 'consulted',
    value: { home: 2, away: 2 },
  }),
];

function dispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    sourceValues: [
      { sourceId: 'demo-a', independenceGroup: 'grupo-a', value: { home: 2, away: 1 } },
      { sourceId: 'demo-b', independenceGroup: 'grupo-b', value: { home: 1, away: 1 } },
      { sourceId: 'demo-oficial', independenceGroup: 'grupo-oficial', value: { home: 2, away: 2 } },
    ],
    consultedSourceId: 'demo-oficial',
    consultedAt: OFFICIAL_AT,
    outcome: 'no_match',
    resolvedValue: null,
    ...overrides,
  };
}

function renderRecord(value: Dispute, items: readonly Evidence[] = disagreeing) {
  render(<DisputeRecord dispute={value} evidence={items} teams={new Map()} headingId="dispute-1" headingLevel={4} />);
  return screen.getByRole('region', { name: 'Registro de disputa' });
}

describe('DisputeRecord', () => {
  it('lists every source with its independence group and value in a named table with headers', () => {
    const record = renderRecord(dispute());
    expect(within(record).getByRole('heading', { level: 4, name: 'Registro de disputa' })).toBeTruthy();
    const table = within(record).getByRole('table', { name: 'Valores por fuente' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Fuente', 'Grupo de independencia', 'Valor']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Fuente de demostración A (demo-a)',
      'Fuente de demostración B (demo-b)',
      'Publicación oficial de demostración (demo-oficial)',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['grupo-a', '2–1'],
      ['grupo-b', '1–1'],
      ['grupo-oficial', '2–2'],
    ]);
  });

  it('names a source missing from the evidence by its identifier instead of dropping it', () => {
    const record = renderRecord(dispute(), disagreeing.slice(0, 1));
    expect(
      within(record)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Fuente de demostración A (demo-a)', 'demo-b', 'demo-oficial']);
  });

  it.each([
    ['no_match', 'Sin resolver: la publicación oficial no coincide con ninguno de los valores.'],
    ['unavailable', 'Sin resolver: la publicación oficial no está disponible o no da un valor.'],
    ['same_source', 'Sin resolver: la publicación oficial es la misma fuente que uno de los valores en disputa.'],
  ] as const)('states the unresolved outcome %s in words and shows no resolved value', (outcome, text) => {
    const record = renderRecord(dispute({ outcome }));
    expect(disputeOutcomeLabel[outcome]).toBe(text);
    expect(record.textContent).toContain(`Resultado: ${text}`);
    expect(record.textContent).not.toContain('Valor resuelto');
    expect(record.textContent).toContain(
      'Consulta a la publicación oficial: Publicación oficial de demostración (demo-oficial) consultada el',
    );
    expect(record.querySelector('time')?.getAttribute('dateTime')).toBe(OFFICIAL_AT);
  });

  it('shows the resolved value only for a resolved dispute, next to the values it settled', () => {
    const record = renderRecord(dispute({ outcome: 'resolved', resolvedValue: { home: 2, away: 1 } }));
    expect(record.textContent).toContain(
      'Resultado: Resuelta: la publicación oficial coincide con uno de los valores.',
    );
    expect(record.textContent).toContain('Valor resuelto: 2–1');
    // Both disagreeing observations stay listed after the resolution.
    expect(within(record).getAllByRole('row')).toHaveLength(4);
  });

  it('says when no official publication was consulted', () => {
    const record = renderRecord(dispute({ consultedSourceId: null, consultedAt: null, outcome: 'unavailable' }));
    expect(record.textContent).toContain(
      'Consulta a la publicación oficial: No se consultó ninguna publicación oficial.',
    );
    expect(record.querySelector('time')).toBeNull();
  });

  it('offers no control: nothing in the record can resolve the dispute or pick a value', () => {
    const record = renderRecord(dispute());
    for (const role of ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio'] as const) {
      expect(within(record).queryAllByRole(role), role).toEqual([]);
    }
  });
});

describe('FactCard of a disputed fact', () => {
  function renderDisputed(manualApproval: 'not_manual_data' | 'available') {
    const fact: Fact = scoreFact({
      n: 4,
      matchKey: 'm2',
      status: 'unverified',
      unverifiedReason: 'disputed',
      reason: 'Disputed: accepted sources disagree (demo-a, demo-b).',
      blockReason: 'not_verified',
      score: null,
      evidence: disagreeing,
      dispute: dispute(),
    });
    render(
      <ul>
        <FactCard
          fact={fact}
          label="Marcador: Equipo A - Equipo B"
          teams={new Map()}
          projectId={PROJECT_ID}
          runId={RUN_ID}
          manualApproval={manualApproval}
          headingLevel={3}
          onUpdated={() => undefined}
          announce={() => undefined}
        />
      </ul>,
    );
    return screen.getByTestId('fact');
  }

  it.each(['not_manual_data', 'available'] as const)(
    'shows no value, the dispute in words, the publication block and no control (%s)',
    (manualApproval) => {
      const card = renderDisputed(manualApproval);
      const header = card.querySelector('article > div') as HTMLElement;
      expect(header.textContent).toContain('Sin verificar(en disputa entre fuentes)');
      expect(card.querySelector('dt')?.textContent).toBe('Sin valor');
      expect(within(card).getByTestId('fact-value').textContent).toBe(
        'No se muestra ningún valor mientras las fuentes no coincidan.',
      );
      const note = within(card).getByTestId('publication-note');
      expect(note.textContent).toBe(
        '⛔ Bloquea la aprobación de publicación del contenido que lo usa: el dato no está verificado.',
      );
      // The symbol is decorative; the words carry the meaning.
      expect(note.querySelector('[aria-hidden="true"]')?.textContent).toBe('⛔ ');
      // Every disagreeing observation is labelled as such in the evidence table, in words.
      const evidenceTable = within(card).getByRole('table', { name: 'Evidencia por fuente' });
      expect(within(evidenceTable).getAllByText('Discrepa')).toHaveLength(2);
      expect(within(card).getByRole('region', { name: 'Registro de disputa' })).toBeTruthy();
      expect(within(card).queryAllByRole('button')).toEqual([]);
      expect(within(card).queryAllByRole('textbox')).toEqual([]);
      if (manualApproval === 'available') {
        expect(within(card).getByTestId('manual-unavailable').textContent).toBe(
          'Aprobación manual no disponible: El dato está en disputa entre fuentes.',
        );
      }
    },
  );
});
