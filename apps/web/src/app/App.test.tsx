/**
 * Application shell and route table: the app opens directly on the project list with no login, account or sign-in
 * element (R-235), and every feature route lazily loads its stub.
 */
import { cleanup, render, screen } from '@testing-library/react';
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

    expect(await screen.findByRole('heading', { level: 1, name: 'Proyectos' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('has no login, account or sign-in element', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Proyectos' });

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
    await screen.findByRole('heading', { level: 1, name: 'Proyectos' });

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('main-content');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' }).getAttribute('href')).toBe(
      '#main-content',
    );
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    const links = navigation.querySelectorAll('a');
    expect([...links].map((link) => link.textContent)).toEqual([
      'Proyectos',
      'Importaciones manuales',
      'Marca y plantillas',
    ]);
    expect(screen.getByRole('link', { name: 'Proyectos' }).getAttribute('aria-current')).toBe('page');
  });

  it('navigates with the main navigation, marks the current page and moves focus to the main content', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Proyectos' });

    await user.click(screen.getByRole('link', { name: 'Importaciones manuales' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Importaciones manuales' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Importaciones manuales' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Proyectos' }).getAttribute('aria-current')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});

describe('Route table: lazy feature stubs', () => {
  it.each([
    [featurePaths.projectList, 'Proyectos'],
    [featurePaths.projects, 'Proyectos'],
    [`${featurePaths.projects}/00000000-0000-4000-8000-000000000001`, 'Proyectos'],
    [
      featurePaths.facts('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
      'Datos y verificación',
    ],
    [featurePaths.review('00000000-0000-4000-8000-000000000001'), 'Revisión y aprobación'],
    [featurePaths.history('00000000-0000-4000-8000-000000000001'), 'Exportaciones e historial'],
    [featurePaths.brand, 'Marca y plantillas'],
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
