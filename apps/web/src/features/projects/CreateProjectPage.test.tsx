/**
 * Create form (R-243, R-077, R-283, R-284, R-286, R-291, R-236, OD-16): catalogue competitions with their sources,
 * source preselection, seasons and stages loaded on choice, stage-based competitions, stages without standings,
 * unavailable competitions and seasons, the exhausted request budget, and the request sent.
 */
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  catalogue,
  cupSeasons,
  cupStages,
  fakeServer,
  json,
  leagueSeasonsUnavailable,
  problem,
  project,
  PROJECT_ID,
  renderApp,
  STALE_LISTING,
  type Handler,
} from './test/support';

afterEach(cleanup);

const CATALOGUE = 'GET /api/v1/catalog/competitions';
const CUP_SEASONS = 'GET /api/v1/catalog/competitions/demo-copa-continental/sources/demo-cup/seasons';
const CUP_STAGES = 'GET /api/v1/catalog/competitions/demo-copa-continental/sources/demo-cup/seasons/2025-26/stages';
const LEAGUE_SEASONS = 'GET /api/v1/catalog/competitions/demo-liga-uno/sources/demo-fixtures/seasons';

function cupServer(extra: Record<string, Handler> = {}) {
  return fakeServer({
    [CATALOGUE]: () => json(catalogue),
    [CUP_SEASONS]: () => json(cupSeasons),
    [CUP_STAGES]: () => json(cupStages),
    ...extra,
  });
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Crear proyecto/ });
}

async function chooseCupSeason(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('radio', { name: /Copa Continental Demo/ }));
  const season = await screen.findByRole('combobox', { name: 'Temporada' });
  await user.selectOptions(season, '2025-26');
  return screen.findByRole('group', { name: 'Fase' });
}

describe('Create form: catalogue (R-243, R-282, R-286, R-291)', () => {
  it('lists reference competitions first, each with its sources and their availability', async () => {
    renderApp('/projects/new', cupServer());

    const competitions = await screen.findByRole('group', { name: 'Competición' });
    const radios = within(competitions).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'demo-copa-continental',
      'demo-liga-uno',
      'live-liga-restringida',
      'manual-liga-nacional',
    ]);

    const cup = within(competitions).getByRole('radio', { name: /Copa Continental Demo/ });
    expect(cup.closest('li')?.textContent).toContain('Referencia');
    const cupDescription = document.getElementById(cup.getAttribute('aria-describedby') ?? '');
    expect(cupDescription?.textContent).toContain('Fixtures de copa');
    expect(cupDescription?.textContent).toContain('Verificación de demostración');
    expect(cupDescription?.textContent).toContain('no elegible para proyectos');
    expect(cupDescription?.textContent).toContain('Datos de demostración');
  });

  it('shows an unavailable competition disabled with its reason, and other competitions stay usable (R-286)', async () => {
    renderApp('/projects/new', cupServer());

    const restricted = await screen.findByRole('radio', { name: /Liga Restringida/ });
    expect((restricted as HTMLInputElement).disabled).toBe(true);
    expect(restricted.closest('li')?.textContent).toContain('No disponible');
    const description = document.getElementById(restricted.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('No disponible con la suscripción actual de la fuente.');

    expect((screen.getByRole('radio', { name: /Copa Continental Demo/ }) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole('radio', { name: /Liga Uno Demo/ }) as HTMLInputElement).disabled).toBe(false);
  });

  it('shows each source listing with retrieval time, cache use, staleness and the wait (R-141, R-291)', async () => {
    renderApp('/projects/new', cupServer());

    const panel = await screen.findByRole('region', { name: 'Fuentes de datos del catálogo' });
    expect(panel.textContent).toContain('Fixtures de demostración');
    expect(panel.textContent).toContain('consulta directa a la fuente');
    expect(panel.textContent).toContain('Proveedor en vivo');
    expect(panel.textContent).toContain('desde la caché');
    expect(panel.textContent).toContain('posiblemente desactualizados');
    expect(panel.textContent).toContain(`Nueva consulta posible en ${STALE_LISTING.retryAfterSeconds} segundos.`);
    expect(panel.querySelector(`time[datetime="${STALE_LISTING.retrievedAt}"]`)).not.toBeNull();
  });

  it('offers a retry when the catalogue cannot be loaded', async () => {
    let attempts = 0;
    const server = fakeServer({
      [CATALOGUE]: () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError('connection refused');
        }
        return json(catalogue);
      },
    });
    renderApp('/projects/new', server);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el catálogo de competiciones');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('group', { name: 'Competición' })).toBeTruthy();
  });
});

describe('Create form: source, season and stage (OD-16, R-283, R-284)', () => {
  it('offers only selectable sources and preselects the first available one', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALOGUE]: () => json(catalogue),
      'GET /api/v1/catalog/competitions/manual-liga-nacional/sources/manual/seasons': () =>
        json({ ...cupSeasons, competitionId: 'manual-liga-nacional', sourceId: 'manual' }),
    });
    renderApp('/projects/new', server);

    await user.click(await screen.findByRole('radio', { name: /Liga Nacional Manual/ }));

    const sources = screen.getByRole('group', { name: 'Fuente de datos' });
    const radios = within(sources).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(['live-api', 'manual']);
    expect(radios[0]?.disabled).toBe(true);
    expect(radios[0]?.closest('li')?.textContent).toContain('La fuente no lo encuentra.');
    expect(radios[1]?.checked).toBe(true);
    expect(radios[1]?.closest('li')?.textContent).toContain('Datos manuales');

    expect(await screen.findByRole('combobox', { name: 'Temporada' })).toBeTruthy();
    expect(server.unexpected).toEqual([]);
  });

  it('does not offer a non-selectable verification source', async () => {
    const user = userEvent.setup();
    renderApp('/projects/new', cupServer());

    await user.click(await screen.findByRole('radio', { name: /Copa Continental Demo/ }));

    const sources = screen.getByRole('group', { name: 'Fuente de datos' });
    expect(
      within(sources)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['demo-cup']);
    expect((within(sources).getByRole('radio') as HTMLInputElement).checked).toBe(true);
  });

  it('loads seasons only on source choice and stages only on season choice', async () => {
    const user = userEvent.setup();
    const server = cupServer();
    renderApp('/projects/new', server);

    await screen.findByRole('group', { name: 'Competición' });
    expect(server.calls.map((call) => call.path)).toEqual(['/api/v1/catalog/competitions']);

    await user.click(screen.getByRole('radio', { name: /Copa Continental Demo/ }));
    const season = await screen.findByRole('combobox', { name: 'Temporada' });
    expect(server.callsTo('GET', CUP_SEASONS.slice(4))).toHaveLength(1);
    expect(server.callsTo('GET', CUP_STAGES.slice(4))).toHaveLength(0);
    expect(
      within(season)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Elija una temporada', '2025-26 (actual)', '2024-25']);
    expect(season.parentElement?.textContent).toContain('desde la caché');

    await user.selectOptions(season, '2025-26');
    expect(await screen.findByRole('group', { name: 'Fase' })).toBeTruthy();
    expect(server.callsTo('GET', CUP_STAGES.slice(4))).toHaveLength(1);
    expect(server.unexpected).toEqual([]);
  });

  it('lists the stages of a stage-based competition by the source names and order, with matchdays and standings notes', async () => {
    const user = userEvent.setup();
    renderApp('/projects/new', cupServer());

    const stages = await chooseCupSeason(user);
    const radios = within(stages).getAllByRole('radio');
    expect(radios.map((radio) => radio.closest('li')?.querySelector('label')?.textContent)).toEqual([
      'Fase de liga',
      'Eliminatoria de playoff',
      'Octavos de final',
      'Final ✕No disponible',
    ]);

    const league = within(stages).getByRole('radio', { name: 'Fase de liga' });
    const leagueText = document.getElementById(league.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
    expect(leagueText).toContain('Jornadas 1, 2, 3, 4, 5, 6, 7, 8');
    expect(leagueText).toContain('Solo por jornada');
    expect(leagueText).toContain('Con clasificación');

    const playoff = within(stages).getByRole('radio', { name: 'Eliminatoria de playoff' });
    const playoffText = document.getElementById(playoff.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
    expect(playoffText).toContain('Sin jornadas numeradas');
    expect(playoffText).toContain('Se puede elegir completa');
    expect(playoffText).toContain('Sin clasificación');

    const knockout = within(stages).getByRole('radio', { name: 'Octavos de final' });
    expect(document.getElementById(knockout.getAttribute('aria-describedby') ?? '')?.textContent).toContain(
      'Jornadas 1, 2',
    );

    const final = within(stages).getByRole('radio', { name: /Final/ }) as HTMLInputElement;
    expect(final.disabled).toBe(true);
    const finalText = document.getElementById(final.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
    expect(finalText).toContain('La fuente no ofrece este dato.');
    expect(finalText).toContain('La fuente no indica si esta fase tiene clasificación.');
  });

  it('shows unavailable seasons with their reason and keeps submit disabled (R-286)', async () => {
    const user = userEvent.setup();
    renderApp(
      '/projects/new',
      fakeServer({ [CATALOGUE]: () => json(catalogue), [LEAGUE_SEASONS]: () => json(leagueSeasonsUnavailable) }),
    );

    await user.click(await screen.findByRole('radio', { name: /Liga Uno Demo/ }));

    const title = await screen.findByText('Temporadas no disponibles en esta fuente');
    expect(title.parentElement?.textContent).toContain('No disponible con la suscripción actual de la fuente.');
    expect(screen.queryByRole('combobox', { name: 'Temporada' })).toBeNull();
    expect(submitButton().disabled).toBe(true);
  });

  it('shows a season that the source refuses when its stages are listed (R-286)', async () => {
    const user = userEvent.setup();
    renderApp(
      '/projects/new',
      cupServer({
        [CUP_STAGES]: () =>
          json({ ...cupStages, availability: { available: false, reason: 'subscription_restricted' }, stages: [] }),
      }),
    );

    await user.click(await screen.findByRole('radio', { name: /Copa Continental Demo/ }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Temporada' }), '2025-26');

    const title = await screen.findByText('Temporada no disponible en esta fuente');
    expect(title.parentElement?.textContent).toContain('No disponible con la suscripción actual de la fuente.');
    expect(screen.queryByRole('group', { name: 'Fase' })).toBeNull();
    expect(submitButton().disabled).toBe(true);
  });
});

describe('Create form: exhausted request budget (R-291)', () => {
  it('shows the wait before a new request and retries the season listing', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const server = cupServer({
      [CUP_SEASONS]: () => {
        attempts += 1;
        return attempts === 1
          ? problem({ status: 503, code: 'PROVIDER_RATE_LIMITED', retryAfterSeconds: 42 })
          : json({ ...cupSeasons, listing: STALE_LISTING });
      },
    });
    renderApp('/projects/new', server);

    await user.click(await screen.findByRole('radio', { name: /Copa Continental Demo/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las temporadas');
    expect(alert.textContent).toContain('Se alcanzó el límite de solicitudes de la fuente de datos.');
    expect(alert.textContent).toContain('Puede reintentar en 42 segundos.');
    expect(submitButton().disabled).toBe(true);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    const season = await screen.findByRole('combobox', { name: 'Temporada' });
    const provenance = season.parentElement?.textContent ?? '';
    expect(provenance).toContain('desde la caché');
    expect(provenance).toContain('posiblemente desactualizados');
    expect(provenance).toContain('Nueva consulta posible en 30 segundos.');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Create form: submit (R-243, R-236)', () => {
  it('keeps submit disabled until competition, source, season, stage and matchday are chosen, then creates the project', async () => {
    const user = userEvent.setup();
    const server = cupServer({
      'POST /api/v1/projects': () => json(project(), 201),
      [`GET /api/v1/projects/${PROJECT_ID}`]: () => json(project()),
    });
    renderApp('/projects/new', server);

    await screen.findByRole('group', { name: 'Competición' });
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/falta elegir: competición, fuente de datos, temporada, fase\./)).toBeTruthy();

    const stages = await chooseCupSeason(user);
    expect(submitButton().disabled).toBe(true);

    await user.click(within(stages).getByRole('radio', { name: 'Fase de liga' }));
    const matchday = screen.getByRole('combobox', { name: 'Jornada' });
    expect(within(matchday).getAllByRole('option')[0]?.textContent).toBe('Elija una jornada');
    expect(within(matchday).queryByRole('option', { name: 'Fase completa' })).toBeNull();
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/falta elegir: jornada\./)).toBeTruthy();

    await user.selectOptions(matchday, '3');
    expect(submitButton().disabled).toBe(false);
    expect(screen.getByText('La selección está completa.')).toBeTruthy();

    const language = screen.getByRole('combobox', { name: 'Idioma del contenido' }) as HTMLSelectElement;
    expect(language.value).toBe('es');

    await user.click(submitButton());

    expect(await screen.findByRole('heading', { level: 1, name: project().title })).toBeTruthy();
    const [post] = server.callsTo('POST', '/api/v1/projects');
    expect(post?.body).toEqual({
      competitionId: 'demo-copa-continental',
      sourceId: 'demo-cup',
      seasonId: '2025-26',
      stageId: 'fase-liga',
      matchday: 3,
      language: 'es',
    });
    expect(post?.headers['X-EDR-Client']).toBe('web');
    expect(server.unexpected).toEqual([]);
  });

  it('creates a project for a whole stage without standings, in English', async () => {
    const user = userEvent.setup();
    const server = cupServer({
      'POST /api/v1/projects': () => json(project({ stageId: 'playoff', matchday: null, language: 'en' }), 201),
      [`GET /api/v1/projects/${PROJECT_ID}`]: () => json(project({ stageId: 'playoff', matchday: null })),
    });
    renderApp('/projects/new', server);

    const stages = await chooseCupSeason(user);
    await user.click(within(stages).getByRole('radio', { name: 'Eliminatoria de playoff' }));
    const matchday = screen.getByRole('combobox', { name: 'Jornada o fase completa' }) as HTMLSelectElement;
    expect(matchday.value).toBe('whole');
    expect(
      within(matchday)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Fase completa']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma del contenido' }), 'en');
    expect(submitButton().disabled).toBe(false);

    await user.click(submitButton());

    await screen.findByRole('heading', { level: 1, name: project().title });
    expect(server.callsTo('POST', '/api/v1/projects')[0]?.body).toEqual({
      competitionId: 'demo-copa-continental',
      sourceId: 'demo-cup',
      seasonId: '2025-26',
      stageId: 'playoff',
      matchday: null,
      language: 'en',
    });
  });

  it('offers the whole stage or one of its matchdays when both are allowed', async () => {
    const user = userEvent.setup();
    renderApp('/projects/new', cupServer());

    const stages = await chooseCupSeason(user);
    await user.click(within(stages).getByRole('radio', { name: 'Octavos de final' }));

    const matchday = screen.getByRole('combobox', { name: 'Jornada o fase completa' });
    expect(
      within(matchday)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Fase completa', 'Jornada 1', 'Jornada 2']);
    expect(submitButton().disabled).toBe(false);
  });

  it('resets the later choices when an earlier one changes', async () => {
    const user = userEvent.setup();
    renderApp('/projects/new', cupServer({ [LEAGUE_SEASONS]: () => json(leagueSeasonsUnavailable) }));

    const stages = await chooseCupSeason(user);
    await user.click(within(stages).getByRole('radio', { name: 'Octavos de final' }));
    expect(submitButton().disabled).toBe(false);

    await user.click(screen.getByRole('radio', { name: /Liga Uno Demo/ }));

    expect(screen.queryByRole('group', { name: 'Fase' })).toBeNull();
    expect(submitButton().disabled).toBe(true);
  });

  it('shows a refused selection with its reason and stays on the form', async () => {
    const user = userEvent.setup();
    renderApp(
      '/projects/new',
      cupServer({
        'POST /api/v1/projects': () =>
          problem({ status: 409, code: 'SELECTION_UNAVAILABLE', refusalReason: 'stage_unavailable' }),
      }),
    );

    const stages = await chooseCupSeason(user);
    await user.click(within(stages).getByRole('radio', { name: 'Octavos de final' }));
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo crear el proyecto');
    expect(alert.textContent).toContain('La selección no está disponible en la fuente elegida.');
    expect(alert.textContent).toContain('La fase no está disponible.');
    expect(screen.getByRole('heading', { level: 1, name: 'Nuevo proyecto' })).toBeTruthy();
    expect(submitButton().disabled).toBe(false);
  });

  it('can be completed with the keyboard only', async () => {
    const user = userEvent.setup();
    const server = cupServer({
      'POST /api/v1/projects': () => json(project(), 201),
      [`GET /api/v1/projects/${PROJECT_ID}`]: () => json(project()),
    });
    renderApp('/projects/new', server);

    const cup = await screen.findByRole('radio', { name: /Copa Continental Demo/ });
    cup.focus();
    await user.keyboard(' ');
    expect((cup as HTMLInputElement).checked).toBe(true);

    const season = await screen.findByRole('combobox', { name: 'Temporada' });
    await user.selectOptions(season, '2025-26');
    const playoff = within(await screen.findByRole('group', { name: 'Fase' })).getByRole('radio', {
      name: 'Eliminatoria de playoff',
    });
    playoff.focus();
    await user.keyboard(' ');
    submitButton().focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: project().title })).toBeTruthy();
  });
});
