/**
 * Visual templates in Plantillas (PD-ARCH-01G-C): the list (table by default, cards, search and filters, actions),
 * "Crear plantilla" from an approved proposal (with the own-prompt acknowledgement) and the action in the proposal
 * detail. A fake fetch answers every request; no network is used.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrandApi } from '../brand/brandApi';
import { CreateTemplatesPage } from '../brand/TemplatesPage';
import { fakeFetch, jsonResponse, problemResponse, TEMPLATE_COVER, type Handler } from '../brand/testSupport';
import { createDesignApi } from '../design/designApi';
import { DRAFT_ID, PUBLISHED_ID, T, TEMPLATE_ID, detail, proposal, template, uuid, version } from './testSupport';
import { createVisualTemplatesApi } from './visualTemplatesApi';

afterEach(cleanup);

const CAPABILITIES = {
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
  promptVersion: 'edr-design-prompt/3',
};

const PUBLISHED = template({
  id: uuid(0x200),
  name: 'Resultado clásico',
  category: 'Resultados',
  contentType: 'match_result',
  format: '1:1',
  status: 'published',
  draftVersionId: null,
  publishedVersion: { id: PUBLISHED_ID, version: 2, publishedAt: T },
  versionCount: 2,
});
const DRAFT = template();
const OWN = proposal(5, { mode: 'own_prompt', name: 'Inspiración libre' });
const GUIDED = proposal(1);

function renderPage(routes: Record<string, Handler | Handler[]> = {}) {
  const fake = fakeFetch({
    'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER] }),
    'GET /design/capabilities': () => jsonResponse(CAPABILITIES),
    'GET /design/proposals': () => jsonResponse({ proposals: [GUIDED, OWN, proposal(6, { status: 'rejected' })] }),
    'GET /visual-templates': () => jsonResponse({ templates: [DRAFT, PUBLISHED] }),
    ...routes,
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
      { path: '/templates/visual/:templateId', element: <p>Editor abierto</p> },
    ],
    { initialEntries: ['/templates/create'] },
  );
  render(<RouterProvider router={router} />);
  return { fake, router };
}

async function section(): Promise<HTMLElement> {
  const region = await screen.findByRole('region', { name: 'Plantillas visuales' });
  await within(region).findByRole('table', { name: 'Plantillas visuales' });
  return region;
}

describe('Plantillas visuales: list', () => {
  it('comes first on the page and shows a table by default with status, versions and thumbnails', async () => {
    renderPage();
    const region = await section();

    // The templates are the first tab; the proposals are in the second one.
    const tabs = screen.getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]);
    expect(tabs).toEqual([
      ['Plantillas visuales', 'true'],
      ['Propuestas visuales con IA', 'false'],
    ]);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Plantillas visuales']);
    const rows = within(region).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Previa dorada');
    expect(rows[0]?.textContent).toContain('Borrador');
    expect(rows[0]?.textContent).toContain('En edición');
    expect(rows[1]?.textContent).toContain('Publicada');
    expect(rows[1]?.textContent).toContain('Versión 2');
    expect(
      within(rows[1] as HTMLElement)
        .getByRole('img')
        .getAttribute('src'),
    ).toBe(
      `/api/v1/visual-templates/${PUBLISHED.id}/versions/${PUBLISHED_ID}/background?v=${encodeURIComponent(PUBLISHED.updatedAt)}`,
    );
    expect(
      within(rows[0] as HTMLElement)
        .getByRole('img')
        .getAttribute('src'),
    ).toBe(
      `/api/v1/visual-templates/${TEMPLATE_ID}/versions/${DRAFT_ID}/background?v=${encodeURIComponent(DRAFT.updatedAt)}`,
    );
  });

  it('switches to cards and filters by search, status, content type and format', async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await section();

    await user.click(within(region).getByRole('button', { name: 'Vista de tarjetas' }));
    const cards = within(region).getByRole('list', { name: 'Plantillas visuales' });
    expect(within(cards).getAllByRole('article')).toHaveLength(2);

    await user.type(within(region).getByRole('searchbox', { name: 'Buscar por nombre o categoría' }), 'resultados');
    expect(
      within(cards)
        .getAllByRole('article')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['Resultado clásico']);
    await user.clear(within(region).getByRole('searchbox'));

    await user.selectOptions(within(region).getByRole('combobox', { name: 'Estado' }), 'draft');
    expect(within(region).getByText('1 de 2 plantillas')).toBeTruthy();
    await user.selectOptions(within(region).getByRole('combobox', { name: 'Formato' }), '1:1');
    expect(within(region).getByText('Ninguna plantilla coincide con la búsqueda o los filtros.')).toBeTruthy();
    await user.selectOptions(within(region).getByRole('combobox', { name: 'Estado' }), '');
    await user.selectOptions(within(region).getByRole('combobox', { name: 'Tipo de contenido' }), 'match_result');
    expect(within(region).getByText('1 de 2 plantillas')).toBeTruthy();
  });

  it('offers a view or edit icon and the other actions of each state in a menu (delete when never published or archived)', async () => {
    const user = userEvent.setup();
    const { fake, router } = renderPage({
      [`POST /visual-templates/${PUBLISHED.id}/archive`]: () =>
        jsonResponse({ ...PUBLISHED, status: 'archived', archivedAt: T }),
    });
    const region = await section();
    const [draftRow, publishedRow] = within(region).getAllByRole('row').slice(1) as [HTMLElement, HTMLElement];
    const menuOf = async (row: HTMLElement, name: string) => {
      await user.click(within(row).getByRole('button', { name: `Más acciones de «${name}»` }));
      return screen.getByRole('menu', { name: `Más acciones de «${name}»` });
    };
    const labels = (menu: HTMLElement) =>
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);

    expect(within(draftRow).getByRole('button', { name: 'Editar «Previa dorada»' })).toBeTruthy();
    expect(within(publishedRow).getByRole('button', { name: 'Ver «Resultado clásico»' })).toBeTruthy();
    // Only the icon and the menu button stay in the row.
    expect(within(draftRow).queryByRole('button', { name: 'Publicar' })).toBeNull();

    const draftMenu = await menuOf(draftRow, 'Previa dorada');
    expect(labels(draftMenu)).toEqual(['Previsualizar', 'Publicar', 'Eliminar']);
    expect(document.activeElement).toBe(within(draftMenu).getAllByRole('menuitem')[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      within(draftRow).getByRole('button', { name: 'Más acciones de «Previa dorada»' }),
    );

    const publishedMenu = await menuOf(publishedRow, 'Resultado clásico');
    expect(labels(publishedMenu)).toEqual(['Previsualizar', 'Crear nueva versión', 'Archivar']);
    await user.click(within(publishedMenu).getByRole('menuitem', { name: 'Archivar' }));
    expect(await within(publishedRow).findByText('Archivada')).toBeTruthy();
    expect(fake.requests.at(-1)?.headers['X-EDR-Client']).toBe('web');
    // An archived template can be restored or deleted (decision 01G-D-4); no new version.
    expect(labels(await menuOf(publishedRow, 'Resultado clásico'))).toEqual(['Previsualizar', 'Restaurar', 'Eliminar']);
    await user.keyboard('{Escape}');

    await user.click(within(draftRow).getByRole('button', { name: 'Editar «Previa dorada»' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/templates/visual/${TEMPLATE_ID}`));
  });

  it('moves through the menu with the arrows and opens the preview panel', async () => {
    const user = userEvent.setup();
    const { router } = renderPage();
    const region = await section();
    const draftRow = within(region).getAllByRole('row')[1] as HTMLElement;
    await user.click(within(draftRow).getByRole('button', { name: 'Más acciones de «Previa dorada»' }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toBe('?panel=preview'));
  });

  it('creates a new version of a published template and opens it', async () => {
    const user = userEvent.setup();
    const { fake, router } = renderPage({
      [`POST /visual-templates/${PUBLISHED.id}/versions`]: () =>
        jsonResponse(version({ id: uuid(0x300), templateId: PUBLISHED.id, version: 3 }), 201),
    });
    const region = await section();
    const publishedRow = within(region).getAllByRole('row')[2] as HTMLElement;

    await user.click(within(publishedRow).getByRole('button', { name: 'Más acciones de «Resultado clásico»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Crear nueva versión' }));
    await waitFor(() => expect(router.state.location.search).toBe(`?version=${uuid(0x300)}`));
    expect(JSON.parse(String(fake.requests.at(-1)?.body))).toEqual({});
  });

  it('confirms a deletion and shows the refusal of a template in use', async () => {
    const user = userEvent.setup();
    renderPage({ [`DELETE /visual-templates/${TEMPLATE_ID}`]: () => problemResponse(409, 'TEMPLATE_IN_USE') });
    const region = await section();

    await user.click(within(region).getByRole('button', { name: 'Más acciones de «Previa dorada»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar plantilla' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await within(dialog).findByText(/no se puede eliminar\. Puedes archivarla/)).toBeTruthy();
  });

  it('shows the empty state and a load failure with a retry', async () => {
    renderPage({
      'GET /visual-templates': [() => problemResponse(500, 'INTERNAL'), () => jsonResponse({ templates: [] })],
    });
    const region = await screen.findByRole('region', { name: 'Plantillas visuales' });
    const alert = await within(region).findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las plantillas visuales');

    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await within(region).findByRole('heading', { name: 'Todavía no hay plantillas visuales.' })).toBeTruthy();
  });
});

describe('Crear plantilla', () => {
  it('lists only approved proposals and creates a draft from a guided one, then opens the editor', async () => {
    const user = userEvent.setup();
    const { fake, router } = renderPage({
      'POST /visual-templates': () => jsonResponse(detail({ id: uuid(0x400) }), 201),
    });
    const region = await section();
    await user.click(within(region).getByRole('button', { name: /Crear plantilla/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear plantilla desde una propuesta aprobada' });

    expect(await within(dialog).findAllByRole('radio')).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    expect(within(dialog).getByText('Elige una propuesta aprobada.')).toBeTruthy();

    await user.click(within(dialog).getByRole('radio', { name: /Previa individual · 4:5 · 1\/1/ }));
    expect(within(dialog).getByText(/El modelo pudo no dejar vacías todas las zonas/)).toBeTruthy();
    const name = within(dialog).getByRole('textbox', { name: /Nombre de la plantilla/ });
    await user.clear(name);
    await user.type(name, 'Previa dorada');
    await user.type(within(dialog).getByRole('textbox', { name: /Categoría/ }), 'Previas');
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/templates/visual/${uuid(0x400)}`));
    const create = fake.requests.find(
      (request) => request.method === 'POST' && request.url.endsWith('/visual-templates'),
    );
    expect(JSON.parse(String(create?.body))).toEqual({
      sourceProposalId: GUIDED.id,
      name: 'Previa dorada',
      contentType: GUIDED.contentType,
      category: 'Previas',
    });
  });

  it('creates a template of another content type from the same proposal, with a note about the background (01G-C-1)', async () => {
    const user = userEvent.setup();
    const { fake } = renderPage({ 'POST /visual-templates': () => jsonResponse(detail(), 201) });
    const region = await section();
    await user.click(within(region).getByRole('button', { name: /Crear plantilla/ }));
    const dialog = await screen.findByRole('dialog');
    const type = within(dialog).getByRole('combobox', { name: /Tipo de contenido de la plantilla/ });
    expect((type as HTMLSelectElement).disabled).toBe(true);

    await user.click(await within(dialog).findByRole('radio', { name: /Previa individual · 4:5 · 1\/1/ }));
    expect((type as HTMLSelectElement).value).toBe(GUIDED.contentType);
    await user.selectOptions(type, 'match_result');
    expect(within(dialog).getByText(/La propuesta se diseñó como «Previa individual»/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'POST')).toBe(true));
    const body = JSON.parse(String(fake.requests.find((request) => request.method === 'POST')?.body)) as object;
    expect(body).toMatchObject({ sourceProposalId: GUIDED.id, contentType: 'match_result' });
  });

  it('offers the six slide types of the engine templates, a cover and a closing included (01G-D-3)', async () => {
    const user = userEvent.setup();
    const { fake } = renderPage({ 'POST /visual-templates': () => jsonResponse(detail(), 201) });
    const region = await section();
    await user.click(within(region).getByRole('button', { name: /Crear plantilla/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('radio', { name: /Previa individual · 4:5 · 1\/1/ }));
    const type = within(dialog).getByRole('combobox', { name: /Tipo de contenido de la plantilla/ });
    expect(
      within(type)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Portada',
      'Resultado de partido',
      'Calendario de jornada',
      'Partido programado',
      'Previa de partido',
      'Cierre',
    ]);
    expect((type as HTMLSelectElement).value).toBe('match_preview');
    await user.selectOptions(type, 'cover');
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'POST')).toBe(true));
    const body = JSON.parse(String(fake.requests.find((request) => request.method === 'POST')?.body)) as object;
    expect(body).toMatchObject({ sourceProposalId: GUIDED.id, contentType: 'cover' });
  });

  it('requires the acknowledgement for an own-prompt proposal and sends it', async () => {
    const user = userEvent.setup();
    const { fake } = renderPage({ 'POST /visual-templates': () => jsonResponse(detail(), 201) });
    const region = await section();
    await user.click(within(region).getByRole('button', { name: /Crear plantilla/ }));
    const dialog = await screen.findByRole('dialog');

    await user.click(await within(dialog).findByRole('radio', { name: /Inspiración libre/ }));
    expect(within(dialog).getByText(/una Ketsi generados por la IA/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    expect(within(dialog).getByText('Confirma que revisarás el fondo para continuar.')).toBeTruthy();
    expect(fake.requests.some((request) => request.method === 'POST')).toBe(false);

    await user.click(within(dialog).getByRole('checkbox', { name: /Entiendo que el fondo/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'POST')).toBe(true));
    const body = JSON.parse(String(fake.requests.find((request) => request.method === 'POST')?.body)) as object;
    expect(body).toMatchObject({ sourceProposalId: OWN.id, acknowledgeWarnings: true });
  });

  it('shows an empty state when no proposal is approved', async () => {
    const user = userEvent.setup();
    renderPage({
      'GET /design/proposals': () => jsonResponse({ proposals: [proposal(9, { status: 'pending_review' })] }),
    });
    const region = await section();
    await user.click(within(region).getByRole('button', { name: /Crear plantilla/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('heading', { name: 'No hay propuestas aprobadas.' })).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Crear borrador' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens from the detail of an approved proposal with that proposal selected', async () => {
    const user = userEvent.setup();
    renderPage({
      [`GET /design/proposals/${GUIDED.id}`]: () =>
        jsonResponse({
          proposal: GUIDED,
          generation: {
            id: uuid(70),
            style: null,
            mode: 'guided',
            instructions: null,
            inheritedInstructions: null,
            requestSize: '1024x1280',
            adaptation: 'none',
            prompt: 'Prompt',
            promptVersion: 'edr-design-prompt/3',
            estimate: {
              status: 'unavailable',
              currency: null,
              perImage: null,
              total: null,
              basis: 'none',
              pricingSource: null,
              pricingCheckedOn: null,
            },
            requestedCount: 1,
            createdAt: T,
          },
          usage: null,
          cost: null,
          decisions: [],
          variantIds: [],
          layers: [],
          hasBackground: true,
        }),
    });
    await user.click(await screen.findByRole('tab', { name: 'Propuestas visuales con IA' }));
    const proposals = await screen.findByRole('region', { name: 'Propuestas visuales con IA' });
    const rows = await within(proposals).findAllByRole('row');
    const row = rows.find((item) => item.textContent?.includes(GUIDED.name)) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /Ver|Abrir/ }));
    const detailDialog = await screen.findByRole('dialog');
    await user.click(await within(detailDialog).findByRole('button', { name: 'Crear plantilla' }));

    const dialog = await screen.findByRole('dialog', { name: 'Crear plantilla desde una propuesta aprobada' });
    const radio = (await within(dialog).findByRole('radio', { name: new RegExp(GUIDED.name) })) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });
});
