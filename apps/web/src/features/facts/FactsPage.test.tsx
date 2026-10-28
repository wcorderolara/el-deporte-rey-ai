/**
 * Facts view: statuses and reasons (R-205, R-270), values and candidate values, evidence per source with mode and
 * reference (R-204, R-269, R-287), references as text only (T10-F16, T11H-F14), dispute records (R-230), standings
 * availability, left-out matches, the demonstration banner (R-269), no verify control (R-412), loading and errors.
 */
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  demoFacts,
  FACTS_URL,
  fakeServer,
  HOSTILE_REFERENCES,
  IMPORT_VERSION_ID,
  jsonResponse,
  liveFacts,
  manualFacts,
  problemResponse,
  run,
  RUNS_URL,
} from './test/fixtures';
import { factCard, renderFacts, waitForFacts } from './test/render';

afterEach(cleanup);

function server(facts: unknown = demoFacts(), runs: unknown = { runs: [run()] }) {
  return fakeServer({ [`GET ${FACTS_URL}`]: jsonResponse(facts), [`GET ${RUNS_URL}`]: jsonResponse(runs) });
}

function toneOf(element: HTMLElement): string | null {
  return element.querySelector('[data-tone]')?.getAttribute('data-tone') ?? null;
}

describe('loading and requests', () => {
  it('shows a loading status, then the facts; reads only listFacts and listRuns with GET', async () => {
    const { fetch, calls } = server();
    renderFacts(fetch);

    expect(screen.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Cargando…');
    await waitForFacts();

    expect(calls.map((call) => `${call.method} ${call.url}`).sort()).toEqual([`GET ${RUNS_URL}`, `GET ${FACTS_URL}`]);
    for (const call of calls) {
      expect(call.headers['X-EDR-Client']).toBeUndefined();
    }
    expect(screen.getByTestId('facts-summary').textContent).toBe(
      '8 datos: 4 verificados, 4 sin verificar, 0 aprobados manualmente (atestiguados por el operador).',
    );
    expect(screen.getByText(/Ejecución n\.º 1 \(completa, finalizada\)/)).toBeTruthy();
  });

  it('announces a network failure and loads on retry', async () => {
    const user = userEvent.setup();
    const { fetch } = fakeServer({
      [`GET ${FACTS_URL}`]: [new TypeError('connection refused'), jsonResponse(demoFacts())],
      [`GET ${RUNS_URL}`]: jsonResponse({ runs: [run()] }),
    });
    renderFacts(fetch);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar los datos de la ejecución');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await waitForFacts();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains a refused local request without any login wording', async () => {
    const { fetch } = fakeServer({
      [`GET ${FACTS_URL}`]: problemResponse(403, 'FORBIDDEN_ORIGIN'),
      [`GET ${RUNS_URL}`]: jsonResponse({ runs: [run()] }),
    });
    renderFacts(fetch);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Abra la aplicación desde su dirección local (127.0.0.1)');
    expect(alert.textContent).not.toMatch(/iniciar sesi|log ?in|contraseña|password/i);
    expect(within(alert).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('refuses a response that does not match the contract', async () => {
    const { fetch } = server({ dataMode: 'DEMO_DATA', facts: [{ factId: 'x' }] });
    renderFacts(fetch);

    expect((await screen.findByRole('alert')).textContent).toContain('respuesta inesperada');
  });

  it('shows not found for a missing run', async () => {
    const { fetch } = fakeServer({
      [`GET ${FACTS_URL}`]: problemResponse(404, 'NOT_FOUND'),
      [`GET ${RUNS_URL}`]: jsonResponse({ runs: [] }),
    });
    renderFacts(fetch);

    expect((await screen.findByRole('alert')).textContent).toContain('El elemento solicitado no existe.');
  });

  it('sends no request for an address that is not a project and run', () => {
    const { fetch, calls } = server();
    renderFacts(fetch, '/projects/not-a-uuid/runs/also-not/facts');

    expect(screen.getByText('La dirección no identifica un proyecto y una ejecución válidos.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('shows not found for a deeper address inside the feature', () => {
    const { fetch } = server();
    renderFacts(fetch, `/projects/${run().projectId}/runs/${run().id}/facts/unknown`);

    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
  });
});

describe('statuses, reasons and values', () => {
  it('shows each status and unverified reason', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(factCard('match:m1:score').textContent).toContain('Verificado');
    expect(toneOf(factCard('match:m1:score'))).toBe('positive');
    expect(factCard('match:m1:kickoff').textContent).toContain(
      'Sin verificar(pendiente de verificación independiente)',
    );
    expect(factCard('match:m2:score').textContent).toContain('Sin verificar(en disputa entre fuentes)');
    expect(factCard('match:m3:teams').textContent).toContain('Sin verificar(identidad del equipo sin confirmar)');
    expect(factCard('context:matches_in_selection:0').textContent).toContain('Sin verificar(sin fuente aceptada)');
    for (const key of ['match:m1:kickoff', 'match:m2:score', 'match:m3:teams', 'context:matches_in_selection:0']) {
      expect(toneOf(factCard(key))).toBe('caution');
    }
  });

  it('labels a verified value, a candidate value (unverified) and a disputed fact without value', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(factCard('match:m1:score').querySelector('dt')?.textContent).toBe('Valor');
    expect(within(factCard('match:m1:score')).getByTestId('fact-value').textContent).toBe('2-1');
    expect(factCard('match:m1:kickoff').querySelector('dt')?.textContent).toBe('Valor candidato (sin verificar)');
    expect(factCard('match:m2:score').querySelector('dt')?.textContent).toBe('Sin valor');
    expect(within(factCard('match:m2:score')).getByTestId('fact-value').textContent).toBe(
      'No se muestra ningún valor mientras las fuentes no coincidan.',
    );
  });

  it('shows the reason of every status from its closed codes in Spanish, never the English server reason (OD-63)', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    const reasonOf = (key: string) => within(factCard(key)).getByTestId('fact-reason');
    expect(reasonOf('match:m1:score').textContent).toBe(
      'Verificado: fuentes aceptadas independientes coinciden en el valor.',
    );
    expect(reasonOf('match:m1:kickoff').textContent).toBe(
      'Sin verificar: pendiente de verificación independiente; el valor tiene el respaldo de una sola fuente ' +
        'aceptada independiente.',
    );
    expect(reasonOf('match:m2:score').textContent).toBe(
      'Sin verificar: en disputa; las fuentes aceptadas no coinciden y el dato no se verifica mientras la disputa ' +
        'no se resuelva.',
    );
    expect(reasonOf('match:m3:teams').textContent).toBe(
      'Sin verificar: un equipo de este dato no está identificado en todas las fuentes.',
    );
    expect(reasonOf('context:matches_in_selection:0').textContent).toBe(
      'Sin verificar: ninguna fuente aceptada aporta un valor para este dato.',
    );
    for (const key of ['match:m1:score', 'match:m1:kickoff', 'match:m2:score']) {
      expect(reasonOf(key).getAttribute('lang')).toBe('es');
      expect(reasonOf(key).getAttribute('data-origin')).toBe('code');
      expect(reasonOf(key).previousElementSibling?.textContent).toBe('Motivo');
    }
    expect(screen.queryByText(/Awaiting independent verification|Disputed: accepted sources disagree/)).toBeNull();
  });

  it('shows MANUALLY_APPROVED as operator-attested and never styles or words it as verified', async () => {
    const { fetch } = server(manualFacts());
    renderFacts(fetch);
    await waitForFacts();

    for (const key of ['match:m7:score', 'match:m8:score']) {
      const card = factCard(key);
      expect(card.getAttribute('data-status')).toBe('manually_approved');
      expect(toneOf(card)).toBe('attested');
      const header = card.querySelector('article > div');
      expect(header?.textContent).toContain('Aprobado manualmente(atestiguado por el operador)');
      expect(header?.textContent).not.toMatch(/verific/i);
      expect(card.querySelector('dl')?.textContent).not.toMatch(/verific/i);
      expect(card.querySelector('dt')?.textContent).toBe('Valor aprobado manualmente (atestiguado por el operador)');
      expect(within(card).getByTestId('fact-reason').textContent).toBe(
        'Aprobado manualmente: el operador atestigua el valor importado. No cuenta como fuente aceptada ni como ' +
          'segunda fuente.',
      );
      expect(card.querySelector('[data-tone="positive"]')).toBeNull();
    }
    expect(factCard('match:m8:score').textContent).toContain('Aprobación conservada de la ejecución anterior');
  });
});

describe('evidence and references', () => {
  it('shows source name, data mode, role, acceptance, relation, value, reference, retrieval time and import version', async () => {
    const { fetch } = server(manualFacts());
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m1:kickoff');
    const table = within(card).getByRole('table', { name: 'Evidencia por fuente' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      'Fuente',
      'Modo de datos',
      'Función',
      'Aceptada',
      'Relación con el dato',
      'Valor de la fuente',
      'Referencia',
      'Obtenido',
      'Versión de importación',
    ]);
    const [manualRow, acceptedRow] = within(card).getAllByTestId('evidence-row');
    expect(manualRow?.textContent).toContain('Importación manual');
    expect(manualRow?.textContent).toContain('Datos manuales');
    expect(manualRow?.textContent).toContain('Principal');
    expect(manualRow?.textContent).toContain('No');
    expect(manualRow?.textContent).toContain(`import:${IMPORT_VERSION_ID}/v1`);
    expect(manualRow?.textContent).toContain(IMPORT_VERSION_ID);
    expect(
      within(manualRow as HTMLElement)
        .getByRole('link', { name: 'Ver importaciones manuales' })
        .getAttribute('href'),
    ).toBe('/imports');
    expect(manualRow?.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-25T18:30:00Z');
    expect(acceptedRow?.textContent).toContain('Fuente aceptada B');
    expect(acceptedRow?.textContent).toContain('Datos de demostración');
    expect(acceptedRow?.textContent).toContain('Sí');
    expect(acceptedRow?.textContent).toContain('Respalda el valor');
    expect(acceptedRow?.textContent).toContain('No aplica');
    expect(within(card).getByRole('region', { name: /^Evidencia por fuente: / }).tabIndex).toBe(0);
  });

  it('renders hostile javascript:, data: and https: references as plain text with no anchor', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('team:equipo-a:name');
    const cells = within(card).getAllByTestId('evidence-reference');
    expect(cells.map((cell) => cell.textContent)).toEqual([...HOSTILE_REFERENCES]);
    for (const cell of cells) {
      expect(cell.querySelector('a')).toBeNull();
      expect(cell.querySelector('[href]')).toBeNull();
      expect(cell.querySelector('script')).toBeNull();
    }
    expect(card.querySelector('a')).toBeNull();
    for (const element of document.querySelectorAll('[href]')) {
      expect(element.getAttribute('href') ?? '').not.toMatch(/^(javascript|data|https?):/i);
    }
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows the dispute record: values per source, the official consultation and the outcome', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    const card = factCard('match:m2:score');
    const record = within(card).getByRole('region', { name: 'Registro de disputa' });
    const rows = within(record).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Fuente de demostración A (demo-a)grupo-a2–1',
      'Fuente de demostración B (demo-b)grupo-b3–1',
    ]);
    expect(record.textContent).toContain('Publicación oficial de demostración (demo-oficial) consultada el');
    expect(record.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-25T18:40:00Z');
    expect(record.textContent).toContain(
      'Sin resolver: la publicación oficial no coincide con ninguno de los valores.',
    );
    expect(within(card).getAllByTestId('evidence-row')[2]?.textContent).toContain(
      'Verificación independiente, publicación oficial',
    );
  });
});

describe('standings, left-out matches and the demonstration banner', () => {
  it('notes available standings and lists the standing rows', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    const section = screen.getByRole('region', { name: 'Clasificación' });
    expect(section.textContent).toContain('La clasificación está disponible para esta selección.');
    expect(within(section).getByRole('heading', { name: 'Fila de la clasificación: Equipo A' })).toBeTruthy();
  });

  it.each([
    [manualFacts, 'Clasificación no disponible: Esta fase no tiene clasificación.'],
    [
      liveFacts,
      'Clasificación no disponible: La clasificación no está disponible con la suscripción actual de la fuente.',
    ],
  ])('explains standings that are not available (%#)', async (build, text) => {
    const { fetch } = server(build());
    renderFacts(fetch);
    await waitForFacts();

    const section = screen.getByRole('region', { name: 'Clasificación' });
    expect(section.textContent).toContain(text);
    expect(section.textContent).toContain('No hay filas de clasificación en esta ejecución.');
  });

  it('lists left-out matches with their status and reason', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(screen.getAllByTestId('left-out-match').map((row) => row.textContent)).toEqual([
      'Equipo E - Equipo FAplazadoEl partido no ha finalizado.',
      'Equipo G - Equipo HSuspendidoEl partido no ha finalizado.',
      'Equipo I - Equipo JCanceladoEl partido no ha finalizado.',
      'Equipo K - Equipo LResultado adjudicado por decisión administrativaEl partido no ha finalizado.',
      'Equipo M - Equipo NFinalizadoLos datos del partido no tienen valor verificado ni candidato, o están en disputa.',
      'Equipo O - Equipo PEstado no disponibleExcluido por el operador.',
    ]);
  });

  it('shows the demonstration banner for DEMO_DATA', async () => {
    const { fetch } = server();
    renderFacts(fetch);
    await waitForFacts();

    expect(screen.getByRole('note', { name: 'Contenido de demostración' })).toBeTruthy();
    expect(screen.getByText(/^Modo de datos:/).textContent).toBe('Modo de datos: Datos de demostración');
  });

  it.each([
    ['MANUAL_DATA', manualFacts],
    ['LIVE_DATA', liveFacts],
  ] as const)('shows no demonstration banner for %s', async (_mode, build) => {
    const { fetch } = server(build());
    renderFacts(fetch);
    await waitForFacts();

    expect(screen.queryByTestId('demo-banner')).toBeNull();
  });
});

describe('no control sets a fact to verified (R-412)', () => {
  it.each([
    ['DEMO_DATA', demoFacts],
    ['MANUAL_DATA', manualFacts],
    ['LIVE_DATA', liveFacts],
  ] as const)('has no verify button or link for %s', async (_mode, build) => {
    const { fetch } = server(build());
    renderFacts(fetch);
    await waitForFacts();

    for (const control of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
      expect(`${control.textContent} ${control.getAttribute('aria-label') ?? ''}`).not.toMatch(/verific/i);
    }
  });

  it.each([
    ['DEMO_DATA', demoFacts],
    ['LIVE_DATA', liveFacts],
  ] as const)('offers no manual approval at all for %s', async (_mode, build) => {
    const { fetch } = server(build());
    renderFacts(fetch);
    await waitForFacts();

    expect(screen.queryByRole('button', { name: /Aprobar manualmente|Revocar/ })).toBeNull();
    expect(screen.queryAllByTestId('manual-unavailable')).toHaveLength(0);
    expect(screen.getByTestId('manual-approval-note').textContent).toContain(
      'La aprobación manual solo existe para proyectos con datos manuales',
    );
  });
});
