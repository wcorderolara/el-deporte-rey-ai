/**
 * Templates page (PD-ARCH-01G-A; R-031, R-050, R-231; OD-13, PD-06), separate from Mi marca: each template with its
 * version, slide type, badge slots (filled with the badges uploaded in Competiciones since PD-ARCH-01G-E.1), image
 * slots and a preview per language, with no editing control.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../app/routes';
import { createDesignApi } from '../design/designApi';
import { createVisualTemplatesApi } from '../visual-templates/visualTemplatesApi';
import { createBrandApi } from './brandApi';
import { CreateTemplatesPage, EngineTemplatesPage } from './TemplatesPage';
import {
  deferred,
  fakeFetch,
  jsonResponse,
  problemResponse,
  TEMPLATE_COVER,
  TEMPLATE_MATCH,
  type Handler,
} from './testSupport';

afterEach(cleanup);

function renderPage(routes: Record<string, Handler | Handler[]> = {}) {
  const fake = fakeFetch({
    'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER, TEMPLATE_MATCH] }),
    ...routes,
  });
  render(
    <MemoryRouter>
      <EngineTemplatesPage api={createBrandApi({ fetch: fake.fetch })} />
    </MemoryRouter>,
  );
  return fake;
}

function templateList(): Promise<HTMLElement> {
  return screen.findByRole('list', { name: 'Plantillas disponibles' });
}

function card(label: string): HTMLElement {
  return screen.getByRole('article', { name: label });
}

describe('Plantillas del motor: page frame', () => {
  it('shows its own heading, the versioned-code rule and a link to Mi marca, without brand requests', async () => {
    const fake = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeTruthy();
    expect(document.body.textContent).toContain('no se editan desde esta página');
    expect(screen.getByRole('link', { name: 'Mi marca' }).getAttribute('href')).toBe('/brand/resources');
    await templateList();
    expect(fake.requests.map((request) => request.url)).toEqual(['/api/v1/templates']);
  });

  it('shows a loading state until the templates arrive, then an empty state', async () => {
    const templates = deferred<Response>();
    renderPage({ 'GET /templates': () => templates.promise });

    expect(screen.getByText('Cargando las plantillas…').closest('[role="status"]')).toBeTruthy();
    templates.resolve(jsonResponse({ templates: [] }));
    expect(await screen.findByRole('heading', { level: 3, name: 'No hay plantillas disponibles.' })).toBeTruthy();
  });
});

describe('Plantillas del motor: templates (R-231, OD-13)', () => {
  it('lists each template with version, slide type, badge slots and image slots', async () => {
    renderPage();
    await templateList();

    const matchCard = card(TEMPLATE_MATCH.label);
    expect(within(matchCard).getByRole('heading', { level: 3, name: TEMPLATE_MATCH.label })).toBeTruthy();
    expect(matchCard.textContent).toContain('match-result');
    expect(matchCard.textContent).toContain('1.2.0');
    expect(matchCard.textContent).toContain('Resultado de partido');
    expect(matchCard.textContent).toContain(
      '2 espacios con los escudos subidos en Competiciones; un equipo sin escudo deja su espacio vacío.',
    );

    const coverCard = card(TEMPLATE_COVER.label);
    expect(coverCard.textContent).toContain('Portada');
    expect(coverCard.textContent).toContain('Logotipo, Mascota.');
    expect(coverCard.textContent).toContain('Se usan solo cuando hay un recurso activo de ese tipo.');
  });

  it('shows previews in Spanish by default and in English on request', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await templateList();

    expect((screen.getByRole('radio', { name: 'Español' }) as HTMLInputElement).checked).toBe(true);
    const sources = () =>
      within(list)
        .getAllByRole('img')
        .map((image) => image.getAttribute('src'));
    expect(sources()).toEqual([
      '/api/v1/templates/cover/preview?language=es',
      '/api/v1/templates/match-result/preview?language=es',
    ]);
    expect(within(list).getAllByRole('img')[0]?.getAttribute('alt')).toBe(
      `Vista previa de la plantilla «${TEMPLATE_COVER.label}» en español`,
    );

    await user.click(screen.getByRole('radio', { name: 'Inglés' }));

    expect(sources()).toEqual([
      '/api/v1/templates/cover/preview?language=en',
      '/api/v1/templates/match-result/preview?language=en',
    ]);
  });

  it('replaces a failed preview with a fixed message and retries it in another language', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await templateList();

    fireEvent.error(within(list).getAllByRole('img')[0] as HTMLElement);
    expect(within(list).getByText('No se pudo cargar la vista previa de la plantilla.')).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'Inglés' }));
    expect(within(list).getAllByRole('img')).toHaveLength(2);
  });

  it('has no template editing control', async () => {
    renderPage();
    await templateList();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(document.querySelector('form')).toBeNull();
  });

  it('shows a templates load failure with a retry', async () => {
    renderPage({ 'GET /templates': () => problemResponse(500, 'INTERNAL') });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las plantillas');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('TemplatesFeature nested routes', () => {
  it('shows the not-found page for an unknown address under /templates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/templates/no-such-page'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('Crear plantilla and Plantillas del motor: separate views (PD-ARCH-01G-C)', () => {
  it('shows the AI design proposals in «Crear plantilla», never the engine templates, which have their own view', async () => {
    const fake = fakeFetch({
      'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER] }),
      'GET /visual-templates': () => jsonResponse({ templates: [] }),
      'GET /design/capabilities': () =>
        jsonResponse({
          adapter: 'disabled',
          status: 'disabled',
          defaultModel: null,
          models: [],
          contentTypes: ['match_preview', 'round_overview', 'fixture', 'match_result'],
          formats: ['1:1', '4:5', '9:16'],
          policyRoles: [],
          limits: {
            maxImagesPerRequest: 1,
            maxReferences: 0,
            maxImagesPerDay: 1,
            imagesUsedToday: 0,
            monthlySpendLimit: null,
            spentThisMonth: null,
            maxConcurrentRequests: 1,
          },
          promptVersion: 'edr-design-prompt/1',
        }),
      'GET /design/proposals': () => jsonResponse({ proposals: [] }),
    });
    render(
      <MemoryRouter>
        <CreateTemplatesPage
          api={createBrandApi({ fetch: fake.fetch })}
          designApi={createDesignApi({ fetch: fake.fetch })}
          visualApi={createVisualTemplatesApi({ fetch: fake.fetch })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Crear plantilla' })).toBeTruthy();
    // Two tabs: the visual templates first, the AI design proposals in the second.
    const tabs = screen.getByRole('tablist', { name: 'Plantillas y propuestas' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Plantillas visuales', 'Propuestas visuales con IA']);
    expect(await screen.findByRole('region', { name: 'Plantillas visuales' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Propuestas visuales con IA' })).toBeNull();
    await userEvent.setup().click(within(tabs).getByRole('tab', { name: 'Propuestas visuales con IA' }));
    const proposals = await screen.findByRole('region', { name: 'Propuestas visuales con IA' });
    expect(within(proposals).getByText(/no es una plantilla/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Plantillas visuales' })).toBeNull();
    expect(screen.getByRole('tabpanel', { name: 'Propuestas visuales con IA' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plantillas del motor' })).toBeNull();
    expect(screen.getByRole('button', { name: /Crear diseño con IA/ })).toBeTruthy();
    expect(fake.requests.map((request) => request.url)).not.toContain('/api/v1/templates');
  });

  it('keeps the chosen tab of «Crear plantilla» in the address', async () => {
    const user = userEvent.setup();
    const fake = fakeFetch({
      'GET /visual-templates': () => jsonResponse({ templates: [] }),
      'GET /design/capabilities': () => problemResponse(503, 'SERVICE_UNAVAILABLE'),
      'GET /design/proposals': () => jsonResponse({ proposals: [] }),
    });
    const router = createMemoryRouter(
      [
        {
          path: '/templates/create',
          element: (
            <CreateTemplatesPage
              api={createBrandApi({ fetch: fake.fetch })}
              designApi={createDesignApi({ fetch: fake.fetch })}
              visualApi={createVisualTemplatesApi({ fetch: fake.fetch })}
            />
          ),
        },
      ],
      { initialEntries: ['/templates/create?tab=proposals'] },
    );
    render(<RouterProvider router={router} />);
    const tab = screen.getByRole('tab', { name: 'Propuestas visuales con IA' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: 'Plantillas visuales' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('tab', { name: 'Plantillas visuales' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: 'Propuestas visuales con IA' }));
    expect(router.state.location.search).toBe('?tab=proposals');
  });

  it('opens «Crear plantilla» from /templates and keeps the engine templates at /templates/engine', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ templates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/templates'] });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates/create'));
    cleanup();
    const engine = createMemoryRouter(appRoutes, { initialEntries: ['/templates/engine'] });
    render(<RouterProvider router={engine} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeTruthy();
    vi.restoreAllMocks();
  });
});
