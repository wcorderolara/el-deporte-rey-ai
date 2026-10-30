import type { ApprovalState } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeServer, json, PROJECT_ID, renderApp, summaries } from './test/support';

afterEach(cleanup);

describe('Creator dashboard', () => {
  it('keeps dashboard cards focused on format, title, status and the primary action', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => json({ projects: summaries }) });
    renderApp('/', server);
    const library = await screen.findByRole('list', { name: 'Proyectos e historial' });
    const cards = within(library).getAllByRole('article');
    expect(cards).toHaveLength(2);
    const demo = within(cards[0]!);
    expect(demo.getByRole('heading', { level: 3 }).textContent).toBe(summaries[0]!.title);
    expect(demo.getByText('Carrusel de Instagram · 4:5')).toBeTruthy();
    expect(demo.getByText('Pendiente de revisión')).toBeTruthy();
    expect(demo.getByRole('link', { name: `Revisar contenido: ${summaries[0]!.title}` }).getAttribute('href')).toBe(
      `/projects/${summaries[0]!.id}/review`,
    );
    expect(demo.queryByText('Demostración')).toBeNull();
    expect(demo.queryByText('Fase de liga · Jornada 3')).toBeNull();
    expect(demo.queryByText('Detalles del proyecto')).toBeNull();
    expect(within(cards[1]!).getByText('Carrusel de Instagram · 4:5')).toBeTruthy();
    expect(within(cards[1]!).getByText('Exportado')).toBeTruthy();
    expect(within(cards[1]!).queryByText('Demostración')).toBeNull();
    expect(server.unexpected).toEqual([]);
    expect(server.callsTo('GET', '/api/v1/projects')).toHaveLength(1);
  });

  it.each<[ApprovalState, string, string, string]>([
    ['no_draft', 'En preparación', 'Continuar', ''],
    ['in_review', 'Pendiente de revisión', 'Revisar contenido', '/review'],
    ['final_approved', 'Listo para descargar', 'Descargar contenido', '/exports'],
    ['exported', 'Exportado', 'Ver contenido', '/exports'],
  ])('maps %s to a supported action without new requests', async (approvalState, label, action, suffix) => {
    const server = fakeServer({
      'GET /api/v1/projects': () => json({ projects: [{ ...summaries[0], approvalState }] }),
    });
    renderApp('/projects', server);
    const card = await screen.findByRole('article');
    expect(within(card).getAllByText(label).length).toBeGreaterThan(0);
    expect(
      within(card)
        .getByRole('link', { name: `${action}: ${summaries[0]!.title}` })
        .getAttribute('href'),
    ).toBe(`/projects/${PROJECT_ID}${suffix}`);
    expect(card.textContent).not.toMatch(/Generando contenido|Necesita atención|Reintentar/);
    expect(server.unexpected).toEqual([]);
  });

  it('never promotes an old export timestamp to current approval readiness', async () => {
    const server = fakeServer({
      'GET /api/v1/projects': () => json({ projects: [{ ...summaries[1], approvalState: 'no_draft' }] }),
    });
    renderApp('/', server);
    const card = await screen.findByRole('article');
    expect(within(card).getByText('En preparación')).toBeTruthy();
    expect(within(card).queryByText('Listo para descargar')).toBeNull();
    expect(
      within(card)
        .getByRole('link', { name: /^Continuar:/ })
        .getAttribute('href'),
    ).toBe(`/projects/${summaries[1]!.id}`);
  });

  it('provides honest empty state and links to the existing creation flow', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => json({ projects: [] }) });
    renderApp('/', server);
    expect(await screen.findByRole('heading', { name: 'Todavía no has creado contenido' })).toBeTruthy();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { level: 1 }).textContent).toBe('Tu próximo contenido empieza aquí');
    for (const link of main.getAllByRole('link', { name: 'Crear contenido' }))
      expect(link.getAttribute('href')).toBe('/projects/new');
    expect(screen.queryByRole('article')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
  });

  it('keeps loading visible without fake cards or readiness', async () => {
    const server = fakeServer({ 'GET /api/v1/projects': () => new Promise<Response>(() => {}) });
    renderApp('/', server);
    expect(await screen.findByText('Cargando proyectos…')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText('Listo para descargar')).toBeNull();
  });

  it('shows a safe Spanish connection error and retries the existing request', async () => {
    let attempts = 0;
    const server = fakeServer({
      'GET /api/v1/projects': () => {
        if (++attempts === 1) throw new TypeError('private diagnostic must not leak');
        return json({ projects: summaries });
      },
    });
    renderApp('/', server);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
    expect(alert.textContent).not.toContain('private diagnostic');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Proyectos e historial' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(server.callsTo('GET', '/api/v1/projects')).toHaveLength(2);
  });
});
