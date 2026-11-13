/**
 * Application shell and route table: the app opens directly on the project list with no login, account or sign-in
 * element (R-235), and every feature route lazily loads its stub.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { contentVariantOf } from './AppShell';
import { RouteErrorPage } from './pages';
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
    const entries = navigation.querySelectorAll(':scope > ul > li > :is(a, button)');
    expect([...entries].map((entry) => [entry.tagName, entry.querySelector('span:nth-child(2)')?.textContent])).toEqual(
      [
        ['A', 'Inicio'],
        ['A', 'Crear contenido'],
        ['A', 'Mis proyectos'],
        ['A', 'Competiciones'],
        ['A', 'Exportaciones'],
        ['BUTTON', 'Mi marca'],
        ['BUTTON', 'Plantillas'],
        ['A', 'Datos'],
      ],
    );
    // The groups start collapsed: their sub-items stay out of the page until the group is opened.
    for (const name of ['Mi marca', 'Plantillas']) {
      expect(within(navigation).getByRole('button', { name }).getAttribute('aria-expanded')).toBe('false');
    }
    for (const name of ['Recursos', 'Identidad visual', 'Crear plantilla', 'Plantillas del motor']) {
      expect(within(navigation).queryByRole('link', { name })).toBeNull();
    }
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

  it('puts the generation result of a batch on the studio surface, like the rest of the projects', () => {
    expect(contentVariantOf('/projects/batches/e078c8d3-ef1f-4e0b-8558-485974ba4f6d')).toBe('studio');
    expect(contentVariantOf('/projects/generate')).toBe('studio');
    expect(contentVariantOf('/projects/p1')).toBe('studio');
    expect(contentVariantOf('/projects/p1/runs/r1/facts')).toBe('legacy');
    // The visual template editor uses the full width of the workspace; the template lists stay on the studio surface.
    expect(contentVariantOf('/templates/visual/e078c8d3-ef1f-4e0b-8558-485974ba4f6d')).toBe('workspace');
    expect(contentVariantOf('/templates/create')).toBe('studio');
    // UX-REVIEW-01: the content review is a full-width workspace that uses the height of the viewport.
    expect(contentVariantOf('/projects/p1/review')).toBe('workspace');
    expect(contentVariantOf('/projects/p1/exports')).toBe('studio');
    expect(contentVariantOf('/projects/p1/exports/e1')).toBe('studio');
    // A11Y-01: the trace of an exported slide is a record in the light panel, like «Datos y verificación».
    expect(contentVariantOf('/projects/p1/exports/e1/slides/2/trace')).toBe('legacy');
  });

  it('opens Mi marca and Plantillas as separate pages on the studio surface (PD-ARCH-01G-A)', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    const brand = within(navigation).getByRole('button', { name: 'Mi marca' });
    const templates = within(navigation).getByRole('button', { name: 'Plantillas' });

    // Opening a group shows its sub-items without leaving the page.
    await user.click(brand);
    expect(brand.getAttribute('aria-expanded')).toBe('true');
    expect(router.state.location.pathname).toBe('/');
    expect(templates.getAttribute('aria-expanded')).toBe('false');
    expect(within(navigation).queryByRole('link', { name: 'Crear plantilla' })).toBeNull();

    await user.click(within(navigation).getByRole('link', { name: 'Recursos' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Recursos' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/brand/resources');
    expect(within(navigation).getByRole('link', { name: 'Recursos' }).getAttribute('aria-current')).toBe('page');
    expect(brand.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Plantillas' })).toBeNull();
    expect(screen.getByRole('main').className).not.toContain('bg-legacy-canvas');

    await user.click(within(navigation).getByRole('link', { name: 'Identidad visual' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Identidad visual' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/brand/identity');
    expect(within(navigation).getByRole('link', { name: 'Identidad visual' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Recursos' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('main').className).not.toContain('bg-legacy-canvas');

    // A second click closes the group; the current page stays where it is.
    await user.click(brand);
    expect(brand.getAttribute('aria-expanded')).toBe('false');
    expect(within(navigation).queryByRole('link', { name: 'Identidad visual' })).toBeNull();
    expect(router.state.location.pathname).toBe('/brand/identity');

    await user.click(templates);
    expect(templates.getAttribute('aria-expanded')).toBe('true');
    await user.click(within(navigation).getByRole('link', { name: 'Crear plantilla' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear plantilla' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/templates/create');
    expect(within(navigation).getByRole('link', { name: 'Crear plantilla' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('main').className).not.toContain('bg-legacy-canvas');

    await user.click(within(navigation).getByRole('link', { name: 'Plantillas del motor' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas del motor' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/templates/engine');
    expect(within(navigation).getByRole('link', { name: 'Plantillas del motor' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Crear plantilla' }).getAttribute('aria-current')).toBeNull();
  });

  it('opens the group of the current page when the page is reached outside the navigation', async () => {
    renderAt('/brand/identity');
    expect(await screen.findByRole('heading', { level: 1, name: 'Identidad visual' })).toBeTruthy();
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });

    expect(within(navigation).getByRole('button', { name: 'Mi marca' }).getAttribute('aria-expanded')).toBe('true');
    expect(within(navigation).getByRole('link', { name: 'Identidad visual' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(navigation).getByRole('button', { name: 'Plantillas' }).getAttribute('aria-expanded')).toBe('false');
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

  it('shows project breadcrumbs under the page title without exposing internal IDs as labels', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    renderAt(`/projects/${id}`);
    const header = await screen.findByRole('banner');
    const crumbs = within(header).getByRole('navigation', { name: 'Ruta de navegación' });
    // The way back to the project list from the project page.
    expect(within(crumbs).getByRole('link', { name: 'Mis proyectos' }).getAttribute('href')).toBe('/projects');
    expect(within(crumbs).getByText('Proyecto').getAttribute('aria-current')).toBe('page');
    const title = within(header).getByText('Proyecto', { selector: 'p' });
    expect(title.compareDocumentPosition(crumbs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(crumbs.textContent).not.toContain(id);
    cleanup();

    renderAt(`/projects/${id}/runs/00000000-0000-4000-8000-000000000002/facts`);
    const sectionCrumbs = within(await screen.findByRole('banner')).getByRole('navigation', {
      name: 'Ruta de navegación',
    });
    expect(within(sectionCrumbs).getByRole('link', { name: 'Proyecto' }).getAttribute('href')).toBe(`/projects/${id}`);
    expect(sectionCrumbs.textContent).not.toContain(id);
  });

  it('leaves the header breadcrumb out on Inicio, on the review and on pages with their own breadcrumb', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' });
    expect(within(screen.getByRole('banner')).queryByRole('navigation', { name: 'Ruta de navegación' })).toBeNull();
    cleanup();

    // The review is a workspace without the page header; its own header links back to the project.
    renderAt('/projects/00000000-0000-4000-8000-000000000001/review');
    await screen.findByRole('heading', { name: 'Revisión del contenido' });
    expect(screen.queryByText('Proyecto actual · Revisión del contenido')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Ruta de navegación' })).toBeNull();
    cleanup();

    renderAt('/competitions/liga-demo');
    const header = await screen.findByRole('banner');
    expect(within(header).queryByRole('navigation', { name: 'Ruta de navegación' })).toBeNull();
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
    [featurePaths.brand, 'Recursos'],
    [featurePaths.brandResources, 'Recursos'],
    [featurePaths.brandIdentity, 'Identidad visual'],
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

describe('Section error page (UI-06.3)', () => {
  function failAt(path: string) {
    const router = createMemoryRouter(
      [
        {
          path: '*',
          ErrorBoundary: RouteErrorPage,
          Component: () => {
            throw new Error('the section failed');
          },
        },
      ],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
  }

  it('gives its link the studio colours and focus ring on a studio route', async () => {
    failAt('/exports');
    const link = await screen.findByRole('link', { name: 'Volver a la lista de proyectos' });
    expect(link.className).toContain('text-text-link');
    expect(link.className).toContain('focus-studio');
    expect(link.getAttribute('href')).toBe('/');
    expect(document.body.textContent).not.toContain('the section failed');
  });

  it('keeps the light panel link on a legacy route', async () => {
    failAt('/imports');
    const link = await screen.findByRole('link', { name: 'Volver a la lista de proyectos' });
    expect(link.className).toBe('');
  });
});
