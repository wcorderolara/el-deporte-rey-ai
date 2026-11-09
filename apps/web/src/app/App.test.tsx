/**
 * Application shell and route table: the app opens directly on the project list with no login, account or sign-in
 * element (R-235), and every feature route lazily loads its stub.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { appRoutes, featurePaths } from './routes';

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const LOGIN_WORDING =
  /(iniciar|inicio de) sesi[oó]n|cerrar sesi[oó]n|log ?in|log ?out|sign ?(in|up|out)|contrase[nñ]a|password|registr|cuenta|account|usuario|\buser/i;

describe('App shell (R-235)', () => {
  it('opens directly on the project list', async () => {
    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('has no login, account or sign-in element', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });

    expect(document.body.textContent).not.toMatch(LOGIN_WORDING);
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    for (const element of [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')]) {
      expect(element.textContent).not.toMatch(LOGIN_WORDING);
      expect(element.getAttribute('aria-label') ?? '').not.toMatch(LOGIN_WORDING);
      expect(element.getAttribute('href') ?? '').not.toMatch(LOGIN_WORDING);
    }
  });

  it('provides landmarks, a skip link and a labelled main navigation', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('main-content');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' }).getAttribute('href')).toBe(
      '#main-content',
    );
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    const links = navigation.querySelectorAll('a');
    expect([...links].map((link) => link.querySelector('span:last-child')?.textContent)).toEqual([
      'Inicio',
      'Crear contenido',
      'Mis proyectos',
      'Competiciones',
      'Exportaciones',
      'Mi marca',
      'Plantillas',
      'Crear plantilla',
      'Plantillas del motor',
      'Datos',
    ]);
    expect(within(navigation).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page');
    expect(within(navigation).queryByRole('link', { name: /Configuración/ })).toBeNull();
    expect(within(navigation).getByText('No disponible')).toBeTruthy();
  });

  it('navigates with the main navigation, marks the current page and moves focus to the main content', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });

    await user.click(screen.getByRole('link', { name: 'Datos' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Datos' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Mis proyectos' }).getAttribute('aria-current')).toBeNull();
    // Focus moves to the main content in an effect after the new page renders (OD-58).
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('main'));
    });
  });

  it('opens export history from the main navigation and marks it active', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });

    await user.click(screen.getByRole('link', { name: 'Exportaciones' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exportaciones' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/exports');
    expect(screen.getByRole('link', { name: 'Exportaciones' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens Mi marca and Plantillas as separate pages on the studio surface (PD-ARCH-01G-A)', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });

    await user.click(within(navigation).getByRole('link', { name: 'Mi marca' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi marca' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/brand');
    expect(within(navigation).getByRole('link', { name: 'Mi marca' }).getAttribute('aria-current')).toBe('page');
    expect(within(navigation).getByRole('link', { name: 'Plantillas' }).getAttribute('aria-current')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Plantillas' })).toBeNull();
    expect(screen.getByRole('main').className).not.toContain('bg-legacy-canvas');

    // Plantillas opens its first view, «Crear plantilla»; the sub-item is the current page.
    await user.click(within(navigation).getByRole('link', { name: 'Plantillas' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear plantilla' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/templates/create');
    expect(within(navigation).getByRole('link', { name: 'Crear plantilla' }).getAttribute('aria-current')).toBe('page');
    expect(within(navigation).getByRole('link', { name: 'Plantillas' }).getAttribute('aria-current')).toBeNull();
    expect(within(navigation).getByRole('link', { name: 'Mi marca' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('main').className).not.toContain('bg-legacy-canvas');

    await user.click(within(navigation).getByRole('link', { name: 'Plantillas del motor' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/templates/engine');
    expect(within(navigation).getByRole('link', { name: 'Plantillas del motor' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Crear plantilla' }).getAttribute('aria-current')).toBeNull();
  });

  it('sends the former templates anchor of the brand page to the engine templates', async () => {
    const router = renderAt('/brand#brand-templates-title');

    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/templates/engine');
  });

  it('opens the sports content wizard from the shell action, the navigation and the hero (PD-ARCH-01F)', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await screen.findByRole('heading', { name: 'Tu próximo contenido empieza aquí' });
    const links = screen.getAllByRole('link', { name: /Crear contenido/ });
    // Shell primary action, main navigation entry and hero call to action.
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/projects/generate');
    }
    await user.click(links[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear contenido' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/projects/generate');
    expect(router.state.location.search).toBe('');
  });

  it('redirects the retired catalogue creation address /projects/new to the wizard', async () => {
    const router = renderAt('/projects/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear contenido' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/projects/generate');
  });

  it('shows project breadcrumbs without exposing internal IDs as labels', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    renderAt(`/projects/${id}/review`);
    await screen.findByRole('heading', { name: 'Revisión del contenido' });
    const crumbs = screen.getByRole('navigation', { name: 'Ruta de navegación' });
    expect(within(crumbs).getByRole('link', { name: 'Proyecto' }).getAttribute('href')).toBe(`/projects/${id}`);
    expect(crumbs.textContent).not.toContain(id);
    expect(within(screen.getByRole('banner')).queryByText('Proyecto actual · Revisión del contenido')).toBeNull();
  });

  it('closes disclosure with Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByRole('heading', { name: 'Tu próximo contenido empieza aquí' });
    const menu = screen.getByRole('button', { name: 'Menú' });
    await user.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    within(screen.getByRole('navigation', { name: 'Navegación principal' }))
      .getByRole('link', { name: 'Datos' })
      .focus();
    await user.keyboard('{Escape}');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });
});

describe('Route table: lazy feature stubs', () => {
  it.each([
    [featurePaths.projectList, 'Tu próximo contenido empieza aquí'],
    [featurePaths.projects, 'Tu próximo contenido empieza aquí'],
    [`${featurePaths.projects}/00000000-0000-4000-8000-000000000001`, 'Proyectos'],
    [
      featurePaths.facts('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
      'Datos y verificación',
    ],
    [featurePaths.review('00000000-0000-4000-8000-000000000001'), 'Revisión del contenido'],
    // The former exports page redirects to the project detail (PD-ARCH-01F).
    [featurePaths.history('00000000-0000-4000-8000-000000000001'), 'Proyectos'],
    [featurePaths.brand, 'Mi marca'],
    [featurePaths.templates, 'Crear plantilla'],
    [featurePaths.templatesCreate, 'Crear plantilla'],
    [featurePaths.templatesEngine, 'Plantillas del motor'],
    [`${featurePaths.imports}/00000000-0000-4000-8000-000000000003`, 'Importaciones manuales'],
  ])('renders %s with the %s feature', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('shows a not-found page inside the shell for an unknown address', async () => {
    renderAt('/no-such-page');

    expect(await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a la lista de proyectos' }).getAttribute('href')).toBe('/');
  });
});
