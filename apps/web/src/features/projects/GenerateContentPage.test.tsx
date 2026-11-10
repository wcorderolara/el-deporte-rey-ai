/**
 * Content generation from a local competition (PD-ARCH-01E-A, PD-ARCH-01E-B): context selection limited to valid
 * options, content types of played and unplayed matches, single and multiple match selection, the server's plan with compatible templates and skip reasons, explicit
 * confirmation with one request key (double click and retry), loading and error states, the batch result with its
 * polling, and the sports context on the project page. All data is synthetic.
 */
import type {
  CompetitionMatch,
  ContentBatch,
  ContentBatchPreview,
  VisualTemplate,
  VisualTemplateUsage,
} from '@edr/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { fakeServer, json, problem, project, PROJECT_ID, renderApp, type Handler } from './test/support';

afterEach(cleanup);

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T = '2026-10-20T18:00:00.000Z';
const COMPETITION = uuid(1);
const SEASON = uuid(2);
const STAGE = uuid(3);
const ROUND = uuid(4);
const EMPTY_ROUND = uuid(5);
const BATCH = uuid(9);
const BASE = `/api/v1/competitions/${COMPETITION}/seasons/${SEASON}`;

function team(n: number, name: string) {
  return { id: uuid(100 + n), name, region: null, badge: null, createdAt: T, updatedAt: T };
}

function match(n: number, home: string, away: string, values: Partial<CompetitionMatch> = {}): CompetitionMatch {
  return {
    id: uuid(10 + n),
    seasonId: SEASON,
    stage: null,
    round: { id: ROUND, name: 'Jornada 12' },
    homeTeam: team(2 * n, home),
    awayTeam: team(2 * n + 1, away),
    kickoffAt: T,
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
    createdAt: T,
    updatedAt: T,
    ...values,
  };
}

const MATCHES = [
  match(1, 'Club Alfa', 'Club Beta'),
  match(2, 'Club Gamma', 'Club Delta', { status: 'scheduled', homeScore: null, awayScore: null }),
  match(3, 'Club Epsilon', 'Club Zeta', { homeScore: null, awayScore: null }),
];

const CONTEXT = {
  competitionId: COMPETITION,
  competitionName: 'Liga Local',
  seasonId: SEASON,
  seasonLabel: '2026/27',
  stageId: null,
  stageName: null,
  roundId: ROUND,
  roundName: 'Jornada 12',
};

function preview(matchIds: string[]): ContentBatchPreview {
  return {
    context: CONTEXT,
    selectionLabel: 'Jornada 12',
    language: 'es',
    matches: [],
    templates: [
      { id: 'cover', version: '1.0.0', slideType: 'cover', label: 'Portada', badgeSlots: 0, imageSlots: [] },
      {
        id: 'match-result',
        version: '1.0.0',
        slideType: 'match_result',
        label: 'Resultado',
        badgeSlots: 0,
        imageSlots: [],
      },
    ],
    pieces: [
      {
        position: 1,
        kind: 'round_results',
        title: 'Resultados · Jornada 12',
        matchIds: [uuid(11)],
        status: 'ready',
        skipReason: null,
      },
      ...matchIds.slice(1).map((matchId, index) => ({
        position: index + 2,
        kind: 'match_result' as const,
        title: 'Pieza omitida',
        matchIds: [matchId],
        status: 'skipped' as const,
        skipReason: 'score_missing' as const,
      })),
    ],
    totals: { requested: matchIds.length, ready: 1, skipped: matchIds.length - 1 },
    visualTemplates: [],
  };
}

function batch(state: ContentBatch['state'], status: ContentBatch['items'][number]['status']): ContentBatch {
  return {
    id: BATCH,
    requestKey: uuid(50),
    createdAt: T,
    context: CONTEXT,
    language: 'es',
    state,
    totals: {
      requested: 2,
      generated: status === 'completed' ? 1 : 0,
      failed: 0,
      skipped: 1,
      pending: status === 'completed' ? 0 : 1,
      deleted: 0,
    },
    items: [
      {
        id: uuid(60),
        position: 1,
        kind: 'round_results',
        title: 'Resultados · Jornada 12',
        matchIds: [uuid(11)],
        status,
        skipReason: null,
        failure: null,
        projectId: PROJECT_ID,
        runId: uuid(61),
      },
      {
        id: uuid(62),
        position: 2,
        kind: 'match_result',
        title: 'Club Epsilon - Club Zeta',
        matchIds: [uuid(13)],
        status: 'skipped',
        skipReason: 'score_missing',
        failure: null,
        projectId: null,
        runId: null,
      },
    ],
  };
}

function localServer(extra: Record<string, Handler> = {}) {
  return fakeServer({
    'GET /api/v1/competitions': () =>
      json({ competitions: [{ id: COMPETITION, name: 'Liga Local', createdAt: T, updatedAt: T }] }),
    [`GET /api/v1/competitions/${COMPETITION}/seasons`]: () =>
      json({ seasons: [{ id: SEASON, competitionId: COMPETITION, label: '2026/27', createdAt: T }] }),
    [`GET ${BASE}/stages`]: () =>
      json({ stages: [{ id: STAGE, seasonId: SEASON, name: 'Fase final', displayOrder: 0, createdAt: T }] }),
    [`GET ${BASE}/stages/${STAGE}/rounds`]: () => json({ rounds: [] }),
    [`GET ${BASE}/rounds`]: () =>
      json({
        rounds: [
          { id: ROUND, seasonId: SEASON, stageId: null, name: 'Jornada 12', displayOrder: 12, createdAt: T },
          { id: EMPTY_ROUND, seasonId: SEASON, stageId: null, name: 'Jornada 13', displayOrder: 13, createdAt: T },
        ],
      }),
    [`GET ${BASE}/matches`]: () => json({ matches: MATCHES }),
    'GET /api/v1/visual-templates': () => json({ templates: [] }),
    ...extra,
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function chooseContext(user: User) {
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Competición' }), COMPETITION);
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Temporada' }), SEASON);
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Jornada' }), ROUND);
}

function continueButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Continuar' });
}

describe('content generation wizard (PD-ARCH-01E-A)', () => {
  it('offers only valid options at each level and generates nothing on selection', async () => {
    const user = userEvent.setup();
    const server = localServer();
    renderApp('/projects/generate', server);

    expect(await screen.findByRole('heading', { level: 1, name: 'Crear contenido' })).toBeTruthy();
    const steps = screen.getByRole('list', { name: 'Pasos de la generación' });
    expect(
      within(steps)
        .getByText(/1\. Contexto deportivo/)
        .getAttribute('aria-current'),
    ).toBe('step');
    expect(screen.queryByRole('combobox', { name: 'Temporada' })).toBeNull();
    expect(continueButton().disabled).toBe(true);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Competición' }), COMPETITION);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Temporada' }), SEASON);
    const round = await screen.findByRole('combobox', { name: 'Jornada' });
    const empty = within(round).getByRole('option', { name: /Jornada 13 \(sin partidos\)/ }) as HTMLOptionElement;
    expect(empty.disabled).toBe(true);
    expect(within(round).getByRole('option', { name: /Jornada 12 \(3 partidos\)/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Fase/ })).toBeTruthy();
    await user.selectOptions(round, ROUND);
    expect(continueButton().disabled).toBe(false);
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('opens with the round chosen from the competition calendar', async () => {
    renderApp(`/projects/generate?competitionId=${COMPETITION}&seasonId=${SEASON}&roundId=${ROUND}`, localServer());
    const round = (await screen.findByRole('combobox', { name: 'Jornada' })) as HTMLSelectElement;
    expect(round.value).toBe(ROUND);
    // Continuing waits until the context of the address has been validated.
    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  it('selects one, several or all matches, keeps choices when going back and shows the server plan', async () => {
    const user = userEvent.setup();
    const previews: unknown[] = [];
    const server = localServer({
      'POST /api/v1/content-batches/previews': (call) => {
        previews.push(call.body);
        return json(preview((call.body as { matchIds: string[] }).matchIds));
      },
    });
    renderApp('/projects/generate', server);
    await chooseContext(user);
    await user.click(continueButton());

    // Step 2: content types.
    const roundResults = screen.getByRole('checkbox', { name: /Resultados de jornada/ }) as HTMLInputElement;
    expect(roundResults.checked).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /Resultado individual/ }));
    await user.click(continueButton());

    // Step 3: matches.
    expect(continueButton().disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }));
    expect(screen.getByText('1 de 3 partidos seleccionados.')).toBeTruthy();
    expect(screen.getAllByText(/Finalizado · Sin marcador/)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    expect(screen.getByText('3 de 3 partidos seleccionados.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect((screen.getByRole('checkbox', { name: /Resultado individual/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(continueButton());
    expect(screen.getByText('3 de 3 partidos seleccionados.')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /Club Gamma – Club Delta/ }));
    await user.click(continueButton());
    // Step 4: the template (the engine templates by default).
    await user.click(continueButton());

    // Step 5: the plan computed by the server.
    expect(await screen.findByTestId('preview-totals')).toHaveProperty(
      'textContent',
      'Se prepararán 1 de 2 piezas solicitadas · 1 omitidas.',
    );
    expect(previews).toEqual([
      {
        competitionId: COMPETITION,
        seasonId: SEASON,
        stageId: null,
        roundId: ROUND,
        matchIds: [uuid(11), uuid(13)],
        kinds: ['round_results', 'match_result'],
      },
    ]);
    expect(screen.getByText('Portada · v1.0.0')).toBeTruthy();
    expect(screen.getByText(/El marcador es desconocido; no se representa como 0-0/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar y generar 1 pieza' })).toBeTruthy();
    expect(server.calls.filter((call) => call.path === '/api/v1/content-batches')).toHaveLength(0);
  });

  it('confirms explicitly with one request key, reused after a failure, and opens the result', async () => {
    const user = userEvent.setup();
    const creations: { requestKey: string }[] = [];
    let fail = true;
    const server = localServer({
      'POST /api/v1/content-batches/previews': () => json(preview([uuid(11)])),
      'POST /api/v1/content-batches': (call) => {
        creations.push(call.body as { requestKey: string });
        if (fail) {
          fail = false;
          return problem({ status: 409, code: 'CONTENT_BATCH_NOT_GENERATABLE', detail: 'synthetic' });
        }
        return json(batch('completed', 'completed'), 202);
      },
      [`GET /api/v1/content-batches/${BATCH}`]: () => json(batch('completed', 'completed')),
    });
    renderApp('/projects/generate', server);
    await chooseContext(user);
    await user.click(continueButton());
    await user.click(continueButton());
    await user.click(screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }));
    await user.click(continueButton());
    // Step 4: the template (the engine templates by default).
    await user.click(continueButton());

    const confirm = await screen.findByRole('button', { name: 'Confirmar y generar 1 pieza' });
    await user.click(confirm);
    expect(await screen.findByText(/Ninguna pieza de la selección se puede generar/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Confirmar y generar 1 pieza' }));

    expect(await screen.findByRole('heading', { name: 'Resultado de la generación' })).toBeTruthy();
    expect(creations).toHaveLength(2);
    expect(creations[0]?.requestKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(creations[1]?.requestKey).toBe(creations[0]?.requestKey);
  });
});

describe('content of matches not played yet (PD-ARCH-01E-B)', () => {
  const UNPLAYED = [
    ...MATCHES,
    match(4, 'Club Eta', 'Club Theta', { status: 'postponed', homeScore: null, awayScore: null }),
    match(5, 'Club Iota', 'Club Kappa', { status: 'in_progress', homeScore: 0, awayScore: 0 }),
  ];

  function unplayedServer(extra: Record<string, Handler> = {}) {
    return localServer({ [`GET ${BASE}/matches`]: () => json({ matches: UNPLAYED }), ...extra });
  }

  function marksOf(name: RegExp): string[] {
    const row = screen.getByRole('checkbox', { name }).closest('label');
    return Array.from(row?.querySelectorAll('span.flex > *') ?? []).map((badge) => badge.textContent ?? '');
  }

  it('offers the five content types in two families and adapts the match marks to the chosen types', async () => {
    const user = userEvent.setup();
    const server = unplayedServer();
    renderApp('/projects/generate', server);
    await chooseContext(user);
    await user.click(continueButton());

    const played = screen.getByRole('group', { name: 'Partidos jugados' });
    const unplayed = screen.getByRole('group', { name: 'Partidos por jugar' });
    expect(within(played).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(unplayed).getAllByRole('checkbox')).toHaveLength(3);
    expect(within(unplayed).getByRole('checkbox', { name: /Calendario de jornada/ })).toBeTruthy();
    expect(within(unplayed).getByRole('checkbox', { name: /Próximos partidos/ })).toBeTruthy();
    expect(within(unplayed).getByRole('checkbox', { name: /Previa individual/ })).toBeTruthy();

    // Calendar and upcoming matches instead of the results.
    await user.click(screen.getByRole('checkbox', { name: /Resultados de jornada/ }));
    await user.click(screen.getByRole('checkbox', { name: /Calendario de jornada/ }));
    await user.click(screen.getByRole('checkbox', { name: /Próximos partidos/ }));
    await user.click(continueButton());

    expect(screen.getByText(/se eligen por su estado local, nunca por la fecha/)).toBeTruthy();
    expect(marksOf(/Club Alfa – Club Beta/)).toEqual(['Fuera del calendario', 'No está por jugar']);
    expect(marksOf(/Club Gamma – Club Delta/)).toEqual(['Apto para calendario', 'Por jugar']);
    expect(marksOf(/Club Eta – Club Theta/)).toEqual(['Apto para calendario', 'Por jugar']);
    // A match in play belongs to the round calendar but is not an upcoming match.
    expect(marksOf(/Club Iota – Club Kappa/)).toEqual(['Apto para calendario', 'No está por jugar']);
    expect(screen.queryByText('Resultado final')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Seleccionar compatibles' }));
    expect(screen.getByText('3 de 5 partidos seleccionados.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }) as HTMLInputElement).checked).toBe(false);
    expect(server.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('prepares one preview per chosen match and shows why a finished match is left out', async () => {
    const user = userEvent.setup();
    const previews: unknown[] = [];
    const server = unplayedServer({
      'POST /api/v1/content-batches/previews': (call) => {
        previews.push(call.body);
        return json({
          ...preview([uuid(12)]),
          templates: [
            { id: 'cover', version: '1.0.0', slideType: 'cover', label: 'Portada', badgeSlots: 0, imageSlots: [] },
            {
              id: 'match-preview',
              version: '1.0.0',
              slideType: 'match_preview',
              label: 'Previa',
              badgeSlots: 2,
              imageSlots: [],
            },
          ],
          pieces: [
            {
              position: 1,
              kind: 'match_preview',
              title: 'Previa · Club Gamma - Club Delta',
              matchIds: [uuid(12)],
              status: 'ready',
              skipReason: null,
            },
            {
              position: 2,
              kind: 'match_preview',
              title: 'Previa · Club Alfa - Club Beta',
              matchIds: [uuid(11)],
              status: 'skipped',
              skipReason: 'already_finished',
            },
          ],
          totals: { requested: 2, ready: 1, skipped: 1 },
        } satisfies ContentBatchPreview);
      },
    });
    renderApp('/projects/generate', server);
    await chooseContext(user);
    await user.click(continueButton());
    await user.click(screen.getByRole('checkbox', { name: /Resultados de jornada/ }));
    await user.click(screen.getByRole('checkbox', { name: /Previa individual/ }));
    await user.click(continueButton());

    expect(screen.getByText(/Elige el partido o los partidos de la previa/)).toBeTruthy();
    expect(marksOf(/Club Gamma – Club Delta/)).toEqual(['Por jugar']);
    await user.click(screen.getByRole('checkbox', { name: /Club Gamma – Club Delta/ }));
    await user.click(screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }));
    await user.click(continueButton());
    // Step 4: the template (the engine templates by default).
    await user.click(continueButton());

    expect(await screen.findByTestId('preview-totals')).toHaveProperty(
      'textContent',
      'Se prepararán 1 de 2 piezas solicitadas · 1 omitidas.',
    );
    expect(previews).toEqual([
      {
        competitionId: COMPETITION,
        seasonId: SEASON,
        stageId: null,
        roundId: ROUND,
        matchIds: [uuid(11), uuid(12)],
        kinds: ['match_preview'],
      },
    ]);
    expect(screen.getByText('Previa · v1.0.0')).toBeTruthy();
    expect(screen.getAllByText(/Previa individual · 1 partido/)).toHaveLength(2);
    expect(screen.getByText('El partido ya finalizó; no es un partido por jugar.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar y generar 1 pieza' })).toBeTruthy();
  });
});

describe('wizard entry and address context (PD-ARCH-01F)', () => {
  const OTHER_COMPETITION = uuid(6);
  const OTHER_SEASON = uuid(7);
  const STAGED_ROUND = uuid(8);

  function contextServer(extra: Record<string, Handler> = {}) {
    return localServer({
      'GET /api/v1/competitions': () =>
        json({
          competitions: [
            { id: COMPETITION, name: 'Liga Local', createdAt: T, updatedAt: T },
            { id: OTHER_COMPETITION, name: 'Copa Local', createdAt: T, updatedAt: T },
          ],
        }),
      [`GET /api/v1/competitions/${OTHER_COMPETITION}/seasons`]: () =>
        json({ seasons: [{ id: OTHER_SEASON, competitionId: OTHER_COMPETITION, label: '2027', createdAt: T }] }),
      [`GET ${BASE}/stages/${STAGE}/rounds`]: () =>
        json({
          rounds: [
            { id: STAGED_ROUND, seasonId: SEASON, stageId: STAGE, name: 'Final', displayOrder: 1, createdAt: T },
          ],
        }),
      ...extra,
    });
  }

  function value(name: string): string {
    return (screen.getByRole('combobox', { name }) as HTMLSelectElement).value;
  }

  it('starts without any sports choice when opened without context', async () => {
    const server = contextServer();
    renderApp('/projects/generate', server);
    await screen.findByRole('combobox', { name: 'Competición' });
    expect(value('Competición')).toBe('');
    expect(screen.queryByRole('combobox', { name: 'Temporada' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(server.calls.some((call) => call.path.includes('/seasons'))).toBe(false);
    // The retired catalogue flow is not offered.
    expect(screen.queryByRole('link', { name: /catálogo/ })).toBeNull();
  });

  it('preloads the competition, season, round and its stage from a round link', async () => {
    renderApp(
      `/projects/generate?competitionId=${COMPETITION}&seasonId=${SEASON}&roundId=${STAGED_ROUND}`,
      contextServer({
        [`GET ${BASE}/matches`]: () =>
          json({ matches: [match(1, 'Club Alfa', 'Club Beta', { round: { id: STAGED_ROUND, name: 'Final' } })] }),
      }),
    );
    await waitFor(() => expect(value('Jornada')).toBe(STAGED_ROUND));
    // The stage is resolved from the round once the context of the address is validated.
    await waitFor(() => expect(value('Fase')).toBe(STAGE));
    expect(value('Competición')).toBe(COMPETITION);
    expect(value('Temporada')).toBe(SEASON);
    await waitFor(() => expect(continueButton().disabled).toBe(false));
  });

  it.each([
    ['malformed identifiers', '?competitionId=not-a-uuid&seasonId=x&roundId=y', /no contiene una competición/],
    ['a round without its season', `?competitionId=${COMPETITION}&roundId=${ROUND}`, /no contiene una competición/],
    [
      'an unknown competition',
      `?competitionId=${uuid(99)}&seasonId=${SEASON}&roundId=${ROUND}`,
      /competición del enlace no existe/,
    ],
    [
      'a season of another competition',
      `?competitionId=${OTHER_COMPETITION}&seasonId=${SEASON}&roundId=${ROUND}`,
      /temporada del enlace no pertenece/,
    ],
    [
      'a round of another season',
      `?competitionId=${COMPETITION}&seasonId=${SEASON}&roundId=${uuid(98)}`,
      /jornada del enlace no pertenece/,
    ],
  ])('explains %s and keeps only the valid part of the context', async (_case, query, message) => {
    const server = contextServer();
    renderApp(`/projects/generate${query}`, server);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(message);
    expect(continueButton().disabled).toBe(true);
    // An identifier is never used with a competition or season it does not belong to.
    expect(
      server.calls.some((call) => call.path === `/api/v1/competitions/${OTHER_COMPETITION}/seasons/${SEASON}/matches`),
    ).toBe(false);
    expect(server.calls.some((call) => call.path.includes(uuid(99)))).toBe(false);
  });

  it('lets the operator change the competition and the season after a preload', async () => {
    const user = userEvent.setup();
    renderApp(`/projects/generate?competitionId=${COMPETITION}&seasonId=${SEASON}&roundId=${ROUND}`, contextServer());
    await waitFor(() => expect(value('Jornada')).toBe(ROUND));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Competición' }), OTHER_COMPETITION);
    expect(screen.queryByRole('combobox', { name: 'Jornada' })).toBeNull();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Temporada' }), OTHER_SEASON);
    expect(value('Temporada')).toBe(OTHER_SEASON);
    expect(continueButton().disabled).toBe(true);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Competición' }), COMPETITION);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Temporada' }), SEASON);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Jornada' }), ROUND);
    expect(continueButton().disabled).toBe(false);
  });
});

describe('double submission (PD-ARCH-01E-A)', () => {
  it('sends one creation while the confirmation is in progress, however often it is clicked', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const server = localServer({
      'POST /api/v1/content-batches/previews': () => json(preview([uuid(11)])),
      'POST /api/v1/content-batches': () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
      [`GET /api/v1/content-batches/${BATCH}`]: () => json(batch('completed', 'completed')),
    });
    renderApp('/projects/generate', server);
    await chooseContext(user);
    await user.click(continueButton());
    await user.click(continueButton());
    await user.click(screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }));
    await user.click(continueButton());
    // Step 4: the template (the engine templates by default).
    await user.click(continueButton());
    const confirm = await screen.findByRole('button', { name: 'Confirmar y generar 1 pieza' });
    await user.click(confirm);
    await user.dblClick(screen.getByRole('button', { name: /Preparando contenidos|Confirmar/ }));
    expect(server.callsTo('POST', '/api/v1/content-batches')).toHaveLength(1);
    release(json(batch('completed', 'completed'), 202));
    expect(await screen.findByRole('heading', { name: 'Resultado de la generación' })).toBeTruthy();
    expect(server.callsTo('POST', '/api/v1/content-batches')).toHaveLength(1);
  });
});

describe('content batch result (PD-ARCH-01E-A)', () => {
  it('polls while pieces are pending and reports the real result of every piece', async () => {
    let calls = 0;
    const server = fakeServer({
      [`GET /api/v1/content-batches/${BATCH}`]: () => {
        calls += 1;
        return json(calls === 1 ? batch('in_progress', 'running') : batch('completed', 'completed'));
      },
    });
    renderApp(`/projects/batches/${BATCH}`, server);

    expect(await screen.findByText('En curso')).toBeTruthy();
    expect(screen.getByText('Generando')).toBeTruthy();
    expect(await screen.findByText('Completada')).toBeTruthy();
    const items = screen.getByRole('heading', { name: 'Piezas' }).closest('section') as HTMLElement;
    expect(within(items).getByText('Generada')).toBeTruthy();
    expect(within(items).getByText('Omitida')).toBeTruthy();
    expect(within(items).getByText(/El marcador es desconocido/)).toBeTruthy();
    expect(within(items).getAllByRole('link', { name: 'Abrir proyecto' })).toHaveLength(1);
    expect(within(items).getByText(uuid(60))).toBeTruthy();
    const totals = screen.getByText('Solicitadas').closest('dl') as HTMLElement;
    expect(within(totals).getByText('Generadas').nextSibling?.textContent).toBe('1');
    expect(within(totals).getByText('Omitidas').nextSibling?.textContent).toBe('1');
    expect(within(totals).getByText('Pendientes').nextSibling?.textContent).toBe('0');
  });

  it('shows a loading error with a retry', async () => {
    const server = fakeServer({
      [`GET /api/v1/content-batches/${BATCH}`]: () => problem({ status: 404, code: 'NOT_FOUND' }),
    });
    renderApp(`/projects/batches/${BATCH}`, server);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

describe('project sports context (PD-ARCH-01E-A)', () => {
  it('shows the local competition, season, round and batch of a generated project', async () => {
    const server = fakeServer({
      [`GET /api/v1/projects/${PROJECT_ID}`]: () =>
        json(
          project({
            sportsContext: {
              batchId: BATCH,
              itemId: uuid(60),
              kind: 'match_result',
              ...CONTEXT,
              matchIds: [uuid(11)],
            },
          }),
        ),
    });
    renderApp(`/projects/${PROJECT_ID}`, server);
    const section = (await screen.findByRole('heading', { name: 'Contexto deportivo' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(section).getByRole('link', { name: 'Liga Local' }).getAttribute('href')).toBe(
      `/competitions/${COMPETITION}`,
    );
    expect(within(section).getByText('Jornada 12')).toBeTruthy();
    expect(within(section).getByText(/Resultado individual · 1 partido/)).toBeTruthy();
    expect(within(section).getByRole('link', { name: 'Ver generación' }).getAttribute('href')).toBe(
      `/projects/batches/${BATCH}`,
    );
    expect(within(section).getByText('Plantillas del motor')).toBeTruthy();
  });

  it('shows the visual template version of each slide type a project uses (PD-ARCH-01G-D, 01G-D-3)', async () => {
    const server = fakeServer({
      [`GET /api/v1/projects/${PROJECT_ID}`]: () =>
        json(
          project({
            sportsContext: { batchId: BATCH, itemId: uuid(60), kind: 'match_result', ...CONTEXT, matchIds: [uuid(11)] },
            visualTemplates: [
              { templateId: uuid(72), versionId: uuid(73), version: 1, name: 'Portada dorada', contentType: 'cover' },
              {
                templateId: uuid(70),
                versionId: uuid(71),
                version: 3,
                name: 'Resultado dorado',
                contentType: 'match_result',
              },
            ],
          }),
        ),
    });
    renderApp(`/projects/${PROJECT_ID}`, server);
    const section = (await screen.findByRole('heading', { name: 'Contexto deportivo' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(section).getByText('Plantillas visuales')).toBeTruthy();
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Portada: Portada dorada · versión 1', 'Resultado de partido: Resultado dorado · versión 3']);
    expect(within(section).queryByText('Plantillas del motor')).toBeNull();
  });
});

describe('template step and review with visual templates per slide type (PD-ARCH-01G-D, 01G-D-3)', () => {
  const RESULT_TEMPLATE = uuid(70);
  const RESULT_VERSION = uuid(71);
  const PREVIEW_TEMPLATE = uuid(72);
  const PREVIEW_VERSION = uuid(73);
  const COVER_TEMPLATE = uuid(90);
  const COVER_VERSION = uuid(91);
  const CLOSING_TEMPLATE = uuid(92);
  const CLOSING_VERSION = uuid(93);
  const BADGE = {
    id: uuid(80),
    origin: 'manual' as const,
    source: 'Sitio oficial',
    mime: 'image/png' as const,
    width: 64,
    height: 64,
    sha256: 'ab'.repeat(32),
    uploadedAt: T,
  };

  function template(
    id: string,
    name: string,
    values: Partial<VisualTemplate> & { contentType: VisualTemplate['contentType'] },
    versionId: string | null = null,
  ): VisualTemplate {
    return {
      id,
      name,
      description: null,
      category: null,
      format: '4:5',
      status: 'published',
      sourceProposalId: null,
      publishedVersion: versionId === null ? null : { id: versionId, version: 2, publishedAt: T },
      draftVersionId: null,
      versionCount: 2,
      createdAt: T,
      updatedAt: T,
      archivedAt: null,
      ...values,
    };
  }

  const TEMPLATES: VisualTemplate[] = [
    template(COVER_TEMPLATE, 'Portada dorada', { contentType: 'cover' }, COVER_VERSION),
    template(RESULT_TEMPLATE, 'Resultado dorado', { contentType: 'match_result' }, RESULT_VERSION),
    template(PREVIEW_TEMPLATE, 'Previa nocturna', { contentType: 'match_preview' }, PREVIEW_VERSION),
    template(CLOSING_TEMPLATE, 'Cierre dorado', { contentType: 'closing' }, CLOSING_VERSION),
    template(uuid(74), 'Borrador sin publicar', { contentType: 'match_result', status: 'draft' }),
    template(uuid(75), 'Vertical', { contentType: 'match_result', format: '9:16' }, uuid(76)),
    template(uuid(77), 'Archivada', { contentType: 'match_result', status: 'archived' }, uuid(78)),
    template(uuid(79), 'Portada vertical', { contentType: 'cover', format: '9:16' }, uuid(81)),
  ];

  /** The usage the server reports for each published version (checked; version 2 of each template). */
  const USAGES: Record<string, VisualTemplateUsage> = Object.fromEntries(
    TEMPLATES.filter((item) => item.publishedVersion !== null).map((item) => [
      item.publishedVersion?.id ?? '',
      {
        templateId: item.id,
        versionId: item.publishedVersion?.id ?? '',
        version: 2,
        name: item.name,
        contentType: item.contentType,
      },
    ]),
  );

  const BADGED = [
    { ...MATCHES[0], homeTeam: { ...(MATCHES[0] as CompetitionMatch).homeTeam, badge: BADGE } } as CompetitionMatch,
    ...MATCHES.slice(1),
  ];

  function templatePreview(templateId: string, versionId: string): Handler {
    return () =>
      json({
        values: [{ binding: 'match.homeTeam.name', value: 'Club Alfa' }],
        badges: [
          { binding: 'match.homeTeam.badge', badgeId: BADGE.id },
          { binding: 'match.awayTeam.badge', badgeId: null },
        ],
        issues:
          versionId === RESULT_VERSION
            ? [
                {
                  code: 'VALUE_MISSING',
                  severity: 'warning',
                  layerId: 'away-badge',
                  message: 'Los datos elegidos no tienen este valor. (sin escudo)',
                },
              ]
            : [],
        imageUrl: `/api/v1/visual-templates/${templateId}/versions/${versionId}/preview?competitionId=${COMPETITION}`,
        width: 1080,
        height: 1350,
      });
  }

  function templateServer(extra: Record<string, Handler> = {}) {
    return localServer({
      [`GET ${BASE}/matches`]: () => json({ matches: BADGED }),
      'GET /api/v1/visual-templates': () => json({ templates: TEMPLATES }),
      'POST /api/v1/content-batches/previews': (call) => {
        const body = call.body as { matchIds: string[]; visualTemplateVersionIds?: string[] };
        return json({
          ...preview(body.matchIds),
          visualTemplates: (body.visualTemplateVersionIds ?? []).flatMap((id) => USAGES[id] ?? []),
        } satisfies ContentBatchPreview);
      },
      [`POST /api/v1/visual-templates/${RESULT_TEMPLATE}/versions/${RESULT_VERSION}/previews`]: templatePreview(
        RESULT_TEMPLATE,
        RESULT_VERSION,
      ),
      [`POST /api/v1/visual-templates/${COVER_TEMPLATE}/versions/${COVER_VERSION}/previews`]: templatePreview(
        COVER_TEMPLATE,
        COVER_VERSION,
      ),
      ...extra,
    });
  }

  function choice(type: string): HTMLElement {
    return screen.getByTestId(`template-choice-${type}`);
  }

  async function toTemplateStep(user: User) {
    await chooseContext(user);
    await user.click(continueButton());
    await user.click(continueButton());
    await user.click(screen.getByRole('checkbox', { name: /Club Alfa – Club Beta/ }));
    await user.click(continueButton());
    await screen.findByRole('list', { name: 'Plantillas visuales de Resultado de partido' });
  }

  it('offers, for each slide type of the carousel, only published active 4:5 templates of that type, with the engine by default', async () => {
    const user = userEvent.setup();
    const server = templateServer();
    renderApp('/projects/generate', server);
    await toTemplateStep(user);

    // Round results: a cover, the match slides and a closing, in carousel order.
    expect(
      screen.getAllByTestId(/^template-choice-/).map((fieldset) => fieldset.querySelector('legend')?.textContent),
    ).toEqual(['Portada', 'Resultado de partido', 'Cierre']);
    const names = (type: string) =>
      within(choice(type))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.querySelector('strong')?.textContent);
    expect(names('cover')).toEqual(['Plantilla del motor', 'Portada dorada']);
    expect(names('match_result')).toEqual(['Plantilla del motor', 'Resultado dorado']);
    expect(names('closing')).toEqual(['Plantilla del motor', 'Cierre dorado']);
    for (const type of ['cover', 'match_result', 'closing']) {
      expect(
        (within(choice(type)).getByRole('radio', { name: /Plantilla del motor/ }) as HTMLInputElement).checked,
      ).toBe(true);
    }
    await user.click(continueButton());

    expect(await screen.findByTestId('preview-totals')).toBeTruthy();
    expect(server.callsTo('POST', '/api/v1/content-batches/previews')[0]?.body).not.toHaveProperty(
      'visualTemplateVersionIds',
    );
    expect(screen.getByText('Sin plantillas visuales: se usan las plantillas del motor.')).toBeTruthy();
    expect(server.calls.some((call) => call.path.includes('/visual-templates/') && call.method === 'POST')).toBe(false);
  });

  it('sends one version per chosen slide type, lists them in the review with their previews, and generates with them', async () => {
    const user = userEvent.setup();
    const server = templateServer({
      'POST /api/v1/content-batches': () => json(batch('completed', 'completed'), 202),
      [`GET /api/v1/content-batches/${BATCH}`]: () => json(batch('completed', 'completed')),
    });
    renderApp('/projects/generate', server);
    await toTemplateStep(user);
    await user.click(within(choice('match_result')).getByRole('radio', { name: /Resultado dorado/ }));
    await user.click(within(choice('cover')).getByRole('radio', { name: /Portada dorada/ }));
    await user.click(continueButton());

    expect(await screen.findByTestId('preview-totals')).toBeTruthy();
    expect(server.callsTo('POST', '/api/v1/content-batches/previews')[0]?.body).toMatchObject({
      visualTemplateVersionIds: [COVER_VERSION, RESULT_VERSION],
    });
    const chosen = screen.getByRole('list', { name: 'Plantilla de cada diapositiva' });
    expect(
      within(chosen)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Portada: Portada dorada · versión 2',
      'Resultado de partido: Resultado dorado · versión 2',
      'Cierre: Plantilla del motor',
    ]);
    const image = await screen.findByRole('img', {
      name: 'Vista previa de «Resultado dorado» (Resultado de partido) con los datos seleccionados',
    });
    expect(image.getAttribute('src')).toContain(
      `/visual-templates/${RESULT_TEMPLATE}/versions/${RESULT_VERSION}/preview`,
    );
    expect(
      await screen.findByRole('img', {
        name: 'Vista previa de «Portada dorada» (Portada) con los datos seleccionados',
      }),
    ).toBeTruthy();
    expect(screen.getByText(/\(sin escudo\)$/, { selector: 'li' })).toBeTruthy();
    // A match slide is previewed with the first compatible match; a cover with the round only.
    expect(
      server.callsTo('POST', `/api/v1/visual-templates/${RESULT_TEMPLATE}/versions/${RESULT_VERSION}/previews`)[0]
        ?.body,
    ).toEqual({ selection: { competitionId: COMPETITION, seasonId: SEASON, roundId: ROUND, matchId: uuid(11) } });
    expect(
      server.callsTo('POST', `/api/v1/visual-templates/${COVER_TEMPLATE}/versions/${COVER_VERSION}/previews`)[0]?.body,
    ).toEqual({ selection: { competitionId: COMPETITION, seasonId: SEASON, roundId: ROUND } });
    const badges = screen.getByRole('heading', { name: 'Escudos' }).closest('section') as HTMLElement;
    expect(
      within(badges)
        .getAllByTestId('team-badge')
        .map((badge) => badge.getAttribute('data-badge')),
    ).toEqual(['image', 'none']);
    expect(within(badges).getByText('(sin escudo)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Confirmar y generar 1 pieza' }));
    await screen.findByRole('heading', { name: 'Resultado de la generación' });
    expect(server.callsTo('POST', '/api/v1/content-batches')[0]?.body).toMatchObject({
      selection: { visualTemplateVersionIds: [COVER_VERSION, RESULT_VERSION] },
    });
  });

  it('drops the choice of a slide type the new content types no longer draw and keeps the others', async () => {
    const user = userEvent.setup();
    renderApp('/projects/generate', templateServer());
    await toTemplateStep(user);
    await user.click(within(choice('match_result')).getByRole('radio', { name: /Resultado dorado/ }));
    await user.click(within(choice('cover')).getByRole('radio', { name: /Portada dorada/ }));

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.click(screen.getByRole('checkbox', { name: /Resultados de jornada/ }));
    await user.click(screen.getByRole('checkbox', { name: /Previa individual/ }));
    await user.click(continueButton());
    await user.click(screen.getByRole('checkbox', { name: /Club Gamma – Club Delta/ }));
    await user.click(continueButton());

    await screen.findByRole('list', { name: 'Plantillas visuales de Previa de partido' });
    expect(screen.queryByTestId('template-choice-match_result')).toBeNull();
    expect(within(choice('match_preview')).getByRole('radio', { name: /Previa nocturna/ })).toBeTruthy();
    expect(
      (within(choice('match_preview')).getByRole('radio', { name: /Plantilla del motor/ }) as HTMLInputElement).checked,
    ).toBe(true);
    // The cover is drawn by every carousel: its choice stays.
    expect((within(choice('cover')).getByRole('radio', { name: /Portada dorada/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
