/**
 * Templates page (PD-ARCH-01G-A; R-031, R-050, R-231; OD-13, PD-06), separate from Mi marca: each template with its
 * version, slide type, empty badge slots, image slots and a preview per language, with no editing control.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../app/routes';
import { createDesignApi } from '../design/designApi';
import { createBrandApi } from './brandApi';
import { TemplatesPage } from './TemplatesPage';
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
      <TemplatesPage api={createBrandApi({ fetch: fake.fetch })} />
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

describe('TemplatesPage: page frame', () => {
  it('shows its own heading, the versioned-code rule and a link to Mi marca, without brand requests', async () => {
    const fake = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Plantillas' })).toBeTruthy();
    expect(document.body.textContent).toContain('no se editan desde esta página');
    expect(screen.getByRole('link', { name: 'Mi marca' }).getAttribute('href')).toBe('/brand');
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

describe('TemplatesPage: templates (R-231, OD-13)', () => {
  it('lists each template with version, slide type, empty badge slots and image slots', async () => {
    renderPage();
    await templateList();

    const matchCard = card(TEMPLATE_MATCH.label);
    expect(within(matchCard).getByRole('heading', { level: 3, name: TEMPLATE_MATCH.label })).toBeTruthy();
    expect(matchCard.textContent).toContain('match-result');
    expect(matchCard.textContent).toContain('1.2.0');
    expect(matchCard.textContent).toContain('Resultado de partido');
    expect(matchCard.textContent).toContain('2 espacios reservados; quedan vacíos porque no hay escudos autorizados.');

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

describe('TemplatesPage: AI design proposals (PD-ARCH-01G-B)', () => {
  it('shows the proposals apart from the engine templates, never as templates', async () => {
    const fake = fakeFetch({
      'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER] }),
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
        <TemplatesPage api={createBrandApi({ fetch: fake.fetch })} designApi={createDesignApi({ fetch: fake.fetch })} />
      </MemoryRouter>,
    );
    const proposals = await screen.findByRole('region', { name: 'Propuestas visuales con IA' });
    expect(within(proposals).getByText(/no es una plantilla/)).toBeTruthy();
    const engine = screen.getByRole('region', { name: 'Plantillas del motor' });
    expect(await within(engine).findByRole('heading', { level: 3, name: TEMPLATE_COVER.label })).toBeTruthy();
    expect(within(engine).queryByText(/Propuesta/)).toBeNull();
    expect(screen.getByRole('button', { name: /Crear diseño con IA/ })).toBeTruthy();
  });
});
