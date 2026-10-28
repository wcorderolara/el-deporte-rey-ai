/**
 * Brand and templates page (R-228, R-231; PD-03, OD-07, OD-13, PD-06): assets list with previews from the API and
 * activation, templates with version, badge slots and a preview per language, loading and error states.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../app/routes';
import { createBrandApi } from './brandApi';
import { BrandPage } from './BrandPage';
import {
  ASSET_LOGO,
  ASSET_MASCOT,
  deferred,
  fakeFetch,
  jsonResponse,
  problemResponse,
  TEMPLATE_COVER,
  TEMPLATE_MATCH,
  type Handler,
} from './testSupport';

afterEach(cleanup);

function renderPage(routes: Record<string, Handler | Handler[]>) {
  const fake = fakeFetch({
    'GET /brand/assets': () => jsonResponse({ assets: [ASSET_LOGO, ASSET_MASCOT] }),
    'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER, TEMPLATE_MATCH] }),
    ...routes,
  });
  render(<BrandPage api={createBrandApi({ fetch: fake.fetch })} />);
  return fake;
}

function assetsSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Recursos registrados' });
}

function templatesSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Plantillas' });
}

describe('BrandPage: page frame', () => {
  it('shows the heading, the authorized-only rule and the provisional-values note', async () => {
    renderPage({});
    expect(screen.getByRole('heading', { level: 1, name: 'Marca y plantillas' })).toBeTruthy();
    expect(document.body.textContent).toContain('No se registran escudos de clubes, marcas de competiciones');
    expect(document.body.textContent).toContain('sin logotipo ni mascota');
    await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label });
  });

  it('shows loading states until each list arrives', async () => {
    const assets = deferred<Response>();
    const templates = deferred<Response>();
    renderPage({ 'GET /brand/assets': () => assets.promise, 'GET /templates': () => templates.promise });

    expect(screen.getByText('Cargando los recursos de marca…').getAttribute('role')).toBe('status');
    expect(screen.getByText('Cargando las plantillas…').getAttribute('role')).toBe('status');

    assets.resolve(jsonResponse({ assets: [] }));
    templates.resolve(jsonResponse({ templates: [] }));
    expect(await screen.findByText('No hay recursos de marca registrados.')).toBeTruthy();
    expect(await screen.findByText('No hay plantillas disponibles.')).toBeTruthy();
    expect(screen.queryByText('Cargando los recursos de marca…')).toBeNull();
  });
});

describe('BrandPage: brand assets (R-228)', () => {
  it('lists every asset with an image preview from the API and its details', async () => {
    renderPage({});
    await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label });

    const images = within(assetsSection()).getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      `/api/v1/brand/assets/${ASSET_LOGO.id}/file`,
      `/api/v1/brand/assets/${ASSET_MASCOT.id}/file`,
    ]);
    expect(images[0]?.getAttribute('alt')).toBe(`Vista previa del recurso «${ASSET_LOGO.label}»`);

    const logoCard = screen.getByRole('heading', { level: 3, name: ASSET_LOGO.label }).closest('li') as HTMLElement;
    expect(logoCard.textContent).toContain('Logotipo de la marca');
    expect(logoCard.textContent).toContain('PNG');
    expect(logoCard.textContent).toContain('512 × 256 px');
    expect(logoCard.textContent).toContain('Activo');
    expect(logoCard.querySelector('time')?.getAttribute('dateTime')).toBe(ASSET_LOGO.registeredAt);

    const mascotCard = screen.getByRole('heading', { level: 3, name: ASSET_MASCOT.label }).closest('li') as HTMLElement;
    expect(mascotCard.textContent).toContain('JPEG');
    expect(mascotCard.textContent).toContain('Inactivo');
  });

  it('renders a hostile label as text only, never as markup', async () => {
    const hostile = { ...ASSET_LOGO, label: '<img src=x onerror=alert(1)>' };
    renderPage({ 'GET /brand/assets': () => jsonResponse({ assets: [hostile] }) });

    expect(await screen.findByRole('heading', { level: 3, name: hostile.label })).toBeTruthy();
    const images = within(assetsSection()).getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('src')).toBe(`/api/v1/brand/assets/${ASSET_LOGO.id}/file`);
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('replaces a preview that cannot be loaded with a fixed message', async () => {
    renderPage({});
    await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label });

    fireEvent.error(within(assetsSection()).getAllByRole('img')[0] as HTMLElement);

    expect(within(assetsSection()).getByText('No se pudo mostrar la vista previa de la imagen.')).toBeTruthy();
  });

  it('deactivates and activates an asset, updates its state and announces the change', async () => {
    const user = userEvent.setup();
    const { requests } = renderPage({
      [`PATCH /brand/assets/${ASSET_LOGO.id}`]: () => jsonResponse({ ...ASSET_LOGO, active: false }),
      [`PATCH /brand/assets/${ASSET_MASCOT.id}`]: () => jsonResponse({ ...ASSET_MASCOT, active: true }),
    });
    await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label });

    await user.click(screen.getByRole('button', { name: `Desactivar ${ASSET_LOGO.label}` }));

    expect(await screen.findByRole('button', { name: `Activar ${ASSET_LOGO.label}` })).toBeTruthy();
    const patch = requests.find((request) => request.method === 'PATCH');
    expect(JSON.parse(String(patch?.body))).toEqual({ active: false });
    expect(patch?.headers['X-EDR-Client']).toBe('web');
    const logoCard = screen.getByRole('heading', { level: 3, name: ASSET_LOGO.label }).closest('li') as HTMLElement;
    expect(logoCard.textContent).toContain('Inactivo');
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      `Recurso «${ASSET_LOGO.label}» desactivado.`,
    );

    await user.click(screen.getByRole('button', { name: `Activar ${ASSET_MASCOT.label}` }));
    expect(await screen.findByRole('button', { name: `Desactivar ${ASSET_MASCOT.label}` })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      `Recurso «${ASSET_MASCOT.label}» activado.`,
    );
  });

  it('shows a failed state change in the asset card and keeps the state', async () => {
    const user = userEvent.setup();
    renderPage({ [`PATCH /brand/assets/${ASSET_LOGO.id}`]: () => problemResponse(404, 'NOT_FOUND') });
    await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label });

    await user.click(screen.getByRole('button', { name: `Desactivar ${ASSET_LOGO.label}` }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cambiar el estado del recurso');
    expect(alert.textContent).toContain('El elemento solicitado no existe.');
    expect(alert.closest('li')?.textContent).toContain(ASSET_LOGO.label);
    expect(screen.getByRole('button', { name: `Desactivar ${ASSET_LOGO.label}` })).toBeTruthy();
  });

  it('adds a newly registered asset to the list and announces it', async () => {
    const user = userEvent.setup();
    const registered = { ...ASSET_LOGO, id: '00000000-0000-4000-8000-0000000000a3', label: 'Adorno sintético' };
    renderPage({
      'GET /brand/assets': () => jsonResponse({ assets: [] }),
      'POST /brand/assets': () => jsonResponse({ ...registered, kind: 'decoration' }, 201),
    });
    await screen.findByText('No hay recursos de marca registrados.');

    await user.click(screen.getByRole('radio', { name: /Decoración/ }));
    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), registered.label);
    await user.upload(
      screen.getByLabelText('Archivo de imagen'),
      new File([new Uint8Array(8)], 'a.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    expect(await screen.findByRole('heading', { level: 3, name: registered.label })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      `Recurso «${registered.label}» registrado.`,
    );
  });

  it('shows a load failure with a retry that loads the list again', async () => {
    const user = userEvent.setup();
    const { fetch } = renderPage({
      'GET /brand/assets': [
        () => {
          throw new TypeError('connection refused');
        },
        () => jsonResponse({ assets: [ASSET_LOGO] }),
      ],
    });

    const alert = await within(assetsSection()).findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar los recursos de marca');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 3, name: ASSET_LOGO.label })).toBeTruthy();
    expect(fetch.mock.calls.filter(([url]) => url === '/api/v1/brand/assets')).toHaveLength(2);
  });

  it('explains a refused local request without suggesting a login (PD-05)', async () => {
    renderPage({ 'GET /brand/assets': () => problemResponse(403, 'FORBIDDEN_ORIGIN') });

    const alert = await within(assetsSection()).findByRole('alert');
    expect(alert.textContent).toContain('La aplicación no usa inicio de sesión.');
  });
});

describe('BrandPage: templates (R-231, OD-13)', () => {
  it('lists each template with version, slide type, empty badge slots and image slots', async () => {
    renderPage({});
    const match = await within(templatesSection()).findByRole('heading', { level: 3, name: TEMPLATE_MATCH.label });
    const matchCard = match.closest('li') as HTMLElement;
    expect(matchCard.textContent).toContain('match-result');
    expect(matchCard.textContent).toContain('1.2.0');
    expect(matchCard.textContent).toContain('Resultado de partido');
    expect(matchCard.textContent).toContain('2 espacios reservados; quedan vacíos porque no hay escudos autorizados.');

    const coverCard = within(templatesSection())
      .getByRole('heading', { level: 3, name: TEMPLATE_COVER.label })
      .closest('li') as HTMLElement;
    expect(coverCard.textContent).toContain('Portada');
    expect(coverCard.textContent).toContain('Logotipo de la marca, Mascota.');
    expect(coverCard.textContent).toContain('Se usan solo cuando hay un recurso activo de ese tipo.');
  });

  it('shows previews in Spanish by default and in English on request', async () => {
    const user = userEvent.setup();
    renderPage({});
    await within(templatesSection()).findByRole('heading', { level: 3, name: TEMPLATE_COVER.label });

    expect((screen.getByRole('radio', { name: 'Español' }) as HTMLInputElement).checked).toBe(true);
    const sources = () =>
      within(templatesSection())
        .getAllByRole('img')
        .map((image) => image.getAttribute('src'));
    expect(sources()).toEqual([
      '/api/v1/templates/cover/preview?language=es',
      '/api/v1/templates/match-result/preview?language=es',
    ]);
    expect(within(templatesSection()).getAllByRole('img')[0]?.getAttribute('alt')).toBe(
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
    renderPage({});
    await within(templatesSection()).findByRole('heading', { level: 3, name: TEMPLATE_COVER.label });

    fireEvent.error(within(templatesSection()).getAllByRole('img')[0] as HTMLElement);
    expect(within(templatesSection()).getByText('No se pudo cargar la vista previa de la plantilla.')).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'Inglés' }));
    expect(within(templatesSection()).getAllByRole('img')).toHaveLength(2);
  });

  it('has no template editing control', async () => {
    renderPage({});
    await within(templatesSection()).findByRole('heading', { level: 3, name: TEMPLATE_COVER.label });

    expect(within(templatesSection()).queryAllByRole('button')).toHaveLength(0);
    expect(within(templatesSection()).queryAllByRole('textbox')).toHaveLength(0);
    expect(templatesSection().querySelector('form')).toBeNull();
    expect(templatesSection().textContent).toContain('no se editan desde esta página');
  });

  it('shows a templates load failure with a retry', async () => {
    renderPage({ 'GET /templates': () => problemResponse(500, 'INTERNAL') });

    const alert = await within(templatesSection()).findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las plantillas');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('BrandFeature nested routes', () => {
  it('shows the not-found page for an unknown address under /brand', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/brand/no-such-page'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
