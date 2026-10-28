/**
 * Trace of an exported slide (R-221, R-287): facts with status and reason, evidence with source name, data mode,
 * retrieval time and import version, manual approval, dispute record; references rendered as plain text only, never
 * a link, including hostile values (T10-F16, T11H-F14, AD-36); demonstration and operator-attested labels (R-269,
 * OD-28); no control; loading and errors.
 */
import { SlideTraceSchema, type Fact } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { formatDateTime } from '../../ui';
import { factReasonTable } from '../facts/reasonText';
import {
  evidence,
  EXPORT_ID,
  fakeServer,
  HOSTILE_REFERENCES,
  IMPORT_VERSION_ID,
  jsonResponse,
  manualEvidence,
  problemResponse,
  scoreFact,
  teamNameFact,
  teamsFact,
  trace,
  urls,
  VERSION_IDS,
} from './test/fixtures';
import { DETAIL_PATH, EXPORTS_PATH, renderHistory, tracePathFor } from './test/render';

afterEach(cleanup);

const RETRIEVED_AT = '2026-10-25T18:30:00Z';

const HOSTILE_EXTRA = [
  '<a href="https://example.invalid">x</a>',
  '//example.invalid/path',
  'source:demo-a/matches@2026-10-25T18:30:00Z‮gnp.exe',
] as const;

function demoTraceFacts(): Fact[] {
  return [
    teamsFact({ n: 1, matchKey: 'm1', home: 'equipo-a', away: 'equipo-b', display: 'Equipo A - Equipo B' }),
    scoreFact({ n: 2, matchKey: 'm1', display: '2-1' }),
    scoreFact({
      n: 3,
      matchKey: 'm2',
      status: 'unverified',
      unverifiedReason: 'disputed',
      reason: 'Disputed: demo-a reports 2-1, demo-b reports 3-1.',
      score: null,
      evidence: [
        evidence({ relation: 'disagrees' }),
        evidence({
          sourceId: 'demo-b',
          sourceName: 'Fuente de demostración B',
          relation: 'disagrees',
          value: { home: 3, away: 1 },
        }),
      ],
      dispute: {
        sourceValues: [
          { sourceId: 'demo-a', independenceGroup: 'grupo-a', value: { home: 2, away: 1 } },
          { sourceId: 'demo-b', independenceGroup: 'grupo-b', value: { home: 3, away: 1 } },
        ],
        consultedSourceId: null,
        consultedAt: null,
        outcome: 'unavailable',
        resolvedValue: null,
      },
    }),
    teamNameFact({
      n: 4,
      teamId: 'equipo-a',
      officialName: 'Equipo A',
      evidence: [...HOSTILE_REFERENCES, ...HOSTILE_EXTRA].map((sourceRef, index) =>
        evidence({
          sourceId: `demo-h${index}`,
          sourceName: `Fuente hostil ${index + 1}`,
          sourceRef,
          value: { teamId: 'equipo-a', officialName: 'Equipo A' },
        }),
      ),
    }),
  ];
}

function manualTraceFacts(): Fact[] {
  return [
    scoreFact({
      n: 11,
      matchKey: 'm1',
      status: 'manually_approved',
      display: '3-2',
      score: { home: 3, away: 2 },
      evidence: [manualEvidence({ value: { home: 3, away: 2 } })],
      manualApproval: { approvedAt: '2026-10-25T19:00:00Z', carriedOverFromFactId: null },
    }),
  ];
}

function server(body: unknown = trace(demoTraceFacts()), position = 2) {
  return fakeServer({ [`GET ${urls.trace(EXPORT_ID, position)}`]: jsonResponse(body) });
}

function traceFact(factKey: string): HTMLElement {
  const card = document.querySelector<HTMLElement>(`[data-testid="trace-fact"][data-fact-key="${factKey}"]`);
  if (card === null) {
    throw new Error(`no trace card for ${factKey}`);
  }
  return card;
}

async function waitForTrace(): Promise<void> {
  await screen.findByTestId('trace-summary');
}

describe('slide trace', () => {
  it('uses contract-shaped fixtures', () => {
    expect(SlideTraceSchema.safeParse(trace(demoTraceFacts())).success).toBe(true);
    expect(SlideTraceSchema.safeParse(trace(manualTraceFacts(), 'MANUAL_DATA')).success).toBe(true);
  });

  it('loads the trace of the slide with one GET and shows its data mode and element version', async () => {
    const { fetch, calls } = server();
    renderHistory(fetch, tracePathFor(2));

    expect(screen.getByRole('heading', { level: 1, name: 'Trazabilidad de la diapositiva 2' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Cargando…');
    await waitForTrace();

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([`GET ${urls.trace(EXPORT_ID, 2)}`]);
    expect(calls[0]?.headers['X-EDR-Client']).toBeUndefined();
    const summary = screen.getByTestId('trace-summary');
    expect(summary.textContent).toContain('Datos de demostración');
    expect(summary.textContent).toContain(VERSION_IDS[1]);
    expect(screen.getByTestId('demo-banner')).toBeTruthy();
    expect(screen.getByTestId('trace-count').textContent).toBe(
      '4 datos: 3 verificados, 1 sin verificar, 0 aprobados manualmente (atestiguados por el operador).',
    );
    expect(screen.getByRole('link', { name: 'Volver a la exportación' }).getAttribute('href')).toBe(DETAIL_PATH);
  });

  it('shows each fact with status, reason and value, and its evidence with source, mode and retrieval time', async () => {
    const { fetch } = server();
    renderHistory(fetch, tracePathFor(2));
    await waitForTrace();

    const score = traceFact('match:m1:score');
    expect(within(score).getByRole('heading', { level: 3 }).textContent).toBe('Marcador · Equipo A - Equipo B');
    expect(score.textContent).toContain('Verificado');
    expect(within(score).getByTestId('trace-value').textContent).toBe('2-1');
    expect(within(score).getByTestId('trace-reason').textContent).toBe(factReasonTable.es.verified);
    expect(within(score).getByTestId('trace-manual-approval').textContent).toContain('Sin aprobación manual');
    const rows = within(score).getAllByTestId('evidence-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Fuente de demostración A');
    expect(rows[0]?.textContent).toContain('Datos de demostración');
    expect(rows[0]?.textContent).toContain(formatDateTime(RETRIEVED_AT));
    expect(rows[0]?.querySelector('time')?.getAttribute('dateTime')).toBe(RETRIEVED_AT);
    expect(rows[0]?.textContent).toContain('No aplica');

    const disputed = traceFact('match:m2:score');
    expect(disputed.textContent).toContain('Sin verificar(en disputa entre fuentes)');
    expect(within(disputed).getByTestId('trace-reason').textContent).toBe(factReasonTable.es.unverified.disputed);
    expect(disputed.textContent).not.toContain('Disputed: demo-a reports');
    expect(within(disputed).getByRole('heading', { level: 4, name: 'Registro de disputa' })).toBeTruthy();
    expect(disputed.textContent).toContain('grupo-b');
    expect(disputed.textContent).toContain('Sin resolver: la publicación oficial no está disponible');
  });

  it('renders every hostile reference as plain text, never as a link', async () => {
    const { fetch } = server();
    renderHistory(fetch, tracePathFor(2));
    await waitForTrace();

    const card = traceFact('team:equipo-a:name');
    const cells = within(card).getAllByTestId('evidence-reference');
    expect(cells).toHaveLength(HOSTILE_REFERENCES.length + HOSTILE_EXTRA.length);
    for (const cell of cells) {
      expect(cell.querySelector('a')).toBeNull();
      expect(cell.querySelector('code')).not.toBeNull();
    }
    expect(cells[0]?.textContent).toBe('javascript:alert(1)');
    expect(cells[1]?.textContent).toBe('data:text/html,<script>alert(1)</script>');
    expect(cells[3]?.textContent).toBe('<a href="https://example.invalid">x</a>');
    expect(cells[5]?.textContent).not.toContain('‮');
    expect(document.querySelectorAll('script')).toHaveLength(0);
    for (const anchor of document.querySelectorAll('a')) {
      const href = anchor.getAttribute('href') ?? '';
      expect(href.startsWith('/')).toBe(true);
      expect(href.startsWith('//')).toBe(false);
      expect(href).not.toContain('example.invalid');
    }
  });

  it('labels a manually approved fact as operator-attested and shows its manual approval and import version', async () => {
    const { fetch } = server(trace(manualTraceFacts(), 'MANUAL_DATA'));
    renderHistory(fetch, tracePathFor(2));
    await waitForTrace();

    expect(screen.queryByTestId('demo-banner')).toBeNull();
    const note = screen.getByTestId('attested-note');
    expect(note.textContent).toContain('Contenido atestiguado por el operador');

    const card = traceFact('match:m1:score');
    expect(card.getAttribute('data-status')).toBe('manually_approved');
    expect(card.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('attested');
    expect(card.textContent).toContain('Aprobado manualmente(atestiguado por el operador)');
    expect(card.textContent).not.toMatch(/\bVerificado\b/);
    expect(card.querySelector('dt')?.textContent).toBe('Valor aprobado manualmente (atestiguado por el operador)');
    const reason = within(card).getByTestId('trace-reason');
    expect(reason.textContent).toBe(factReasonTable.es.manuallyApproved);
    expect(reason.textContent).not.toMatch(/verific/i);
    expect(within(card).getByTestId('trace-manual-approval').textContent).toContain(
      formatDateTime('2026-10-25T19:00:00Z'),
    );
    const row = within(card).getByTestId('evidence-row');
    expect(row.textContent).toContain('Importación manual');
    expect(row.textContent).toContain('Datos manuales');
    expect(row.textContent).toContain(IMPORT_VERSION_ID);
    expect(within(row).getByTestId('evidence-reference').textContent).toBe(`import:${IMPORT_VERSION_ID}/v1`);
  });

  it('offers no control that changes a fact, an approval or an export', async () => {
    const { fetch } = server();
    renderHistory(fetch, tracePathFor(2));
    await waitForTrace();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('explains a slide without facts', async () => {
    const { fetch } = server(trace([], 'LIVE_DATA', 1), 1);
    renderHistory(fetch, tracePathFor(1));
    await waitForTrace();

    expect(screen.getByText('Esta diapositiva no usa ningún dato.')).toBeTruthy();
    expect(screen.queryByTestId('demo-banner')).toBeNull();
    expect(screen.getByTestId('trace-summary').textContent).toContain('Datos en vivo');
  });
});

describe('fact reasons (R-416, OD-63, OD-64)', () => {
  const SERVER_REASONS = {
    verified: 'Verified: demo-a and demo-b agree.',
    resolved: 'Verified after dispute: official publication demo-o agrees with demo-a.',
    manual: 'Manually approved by the operator.',
    awaiting: 'Awaiting independent verification; single source: demo-a.',
    unmatched: 'Team identity unmatched in demo-b.',
    noSource: 'No accepted source provides a value.',
    uncoded: 'Pending review by <b>source</b> demo-a',
  } as const;

  function reasonFacts(): Fact[] {
    return [
      scoreFact({ n: 21, matchKey: 'm1', display: '2-1', reason: SERVER_REASONS.verified }),
      scoreFact({
        n: 22,
        matchKey: 'm2',
        display: '1-0',
        score: { home: 1, away: 0 },
        reason: SERVER_REASONS.resolved,
        dispute: {
          sourceValues: [
            { sourceId: 'demo-a', independenceGroup: 'grupo-a', value: { home: 1, away: 0 } },
            { sourceId: 'demo-b', independenceGroup: 'grupo-b', value: { home: 2, away: 0 } },
          ],
          consultedSourceId: 'demo-a',
          consultedAt: '2026-10-25T18:45:00Z',
          outcome: 'resolved',
          resolvedValue: { home: 1, away: 0 },
        },
      }),
      scoreFact({
        n: 23,
        matchKey: 'm3',
        status: 'manually_approved',
        display: '3-2',
        score: { home: 3, away: 2 },
        reason: SERVER_REASONS.manual,
        evidence: [manualEvidence({ value: { home: 3, away: 2 } })],
        manualApproval: { approvedAt: '2026-10-25T19:00:00Z', carriedOverFromFactId: null },
      }),
      scoreFact({
        n: 24,
        matchKey: 'm4',
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        reason: SERVER_REASONS.awaiting,
        evidence: [evidence()],
      }),
      scoreFact({
        n: 25,
        matchKey: 'm5',
        status: 'unverified',
        unverifiedReason: 'team_identity_unmatched',
        reason: SERVER_REASONS.unmatched,
      }),
      scoreFact({
        n: 26,
        matchKey: 'm6',
        status: 'unverified',
        unverifiedReason: 'no_accepted_source',
        reason: SERVER_REASONS.noSource,
        score: null,
        evidence: [],
      }),
      scoreFact({
        n: 27,
        matchKey: 'm7',
        status: 'unverified',
        unverifiedReason: null,
        reason: SERVER_REASONS.uncoded,
        evidence: [evidence()],
      }),
      scoreFact({ n: 28, matchKey: 'm8', status: 'unverified', unverifiedReason: null, reason: null }),
    ];
  }

  async function renderReasons(): Promise<void> {
    const body = trace(reasonFacts());
    expect(SlideTraceSchema.safeParse(body).success).toBe(true);
    const { fetch } = server(body);
    renderHistory(fetch, tracePathFor(2));
    await waitForTrace();
  }

  function reasonOf(matchKey: string): HTMLElement {
    return within(traceFact(`match:${matchKey}:score`)).getByTestId('trace-reason');
  }

  it('renders each coded reason in Spanish from the closed codes, never the server reason', async () => {
    await renderReasons();

    const expected: [string, string][] = [
      ['m1', factReasonTable.es.verified],
      ['m2', factReasonTable.es.verifiedAfterDispute],
      ['m3', factReasonTable.es.manuallyApproved],
      ['m4', factReasonTable.es.unverified.awaiting_independent_verification],
      ['m5', factReasonTable.es.unverified.team_identity_unmatched],
      ['m6', factReasonTable.es.unverified.no_accepted_source],
      ['m8', factReasonTable.es.unverifiedNoReason],
    ];
    for (const [matchKey, text] of expected) {
      const reason = reasonOf(matchKey);
      expect(reason.textContent).toBe(text);
      expect(reason.getAttribute('lang')).toBe('es');
      expect(reason.getAttribute('data-origin')).toBe('code');
      expect(reason.previousElementSibling?.textContent).toBe('Motivo');
    }
    const page = document.body.textContent ?? '';
    for (const serverText of Object.values(SERVER_REASONS).filter((text) => text !== SERVER_REASONS.uncoded)) {
      expect(page).not.toContain(serverText);
    }
  });

  it('never words a manually approved reason as verified (PD-17)', async () => {
    await renderReasons();

    const card = traceFact('match:m3:score');
    expect(card.getAttribute('data-status')).toBe('manually_approved');
    expect(reasonOf('m3').textContent).not.toMatch(/verific/i);
    expect(card.textContent).toContain('Aprobado manualmente(atestiguado por el operador)');
    expect(card.textContent).not.toMatch(/\bVerificado\b/);
  });

  it('shows the server reason only for an unverified fact without a reason code, marked English and as text', async () => {
    await renderReasons();

    const reason = reasonOf('m7');
    expect(reason.textContent).toBe(SERVER_REASONS.uncoded);
    expect(reason.getAttribute('lang')).toBe('en');
    expect(reason.getAttribute('data-origin')).toBe('server');
    expect(reason.querySelector('b')).toBeNull();
    expect(reason.children).toHaveLength(0);
  });
});

describe('errors and addresses', () => {
  it('announces a missing slide and keeps the way back', async () => {
    const { fetch } = fakeServer({ [`GET ${urls.trace(EXPORT_ID, 2)}`]: problemResponse(404, 'NOT_FOUND') });
    renderHistory(fetch, tracePathFor(2));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar la trazabilidad de la diapositiva');
    expect(alert.textContent).toContain('El elemento solicitado no existe.');
    expect(screen.getByRole('link', { name: 'Volver a las exportaciones del proyecto' }).getAttribute('href')).toBe(
      EXPORTS_PATH,
    );
  });

  it.each(['0', '100', '01', 'abc', '-1'])('sends no request for the slide position %s', (position) => {
    const { fetch, calls } = server();
    renderHistory(fetch, tracePathFor(position));

    expect(screen.getByText('La dirección no identifica una diapositiva exportada válida.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
