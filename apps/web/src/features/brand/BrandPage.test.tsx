/**
 * Mi marca (PD-ARCH-01G-A; R-228, R-231; PD-03, OD-07, OD-13, PD-06), in two views: «Identidad visual», with the
 * renderer's palette and fonts and editable notes, and «Recursos», the brand library (table by default, cards, search, category filter, upload
 * with preview and usage policy, detail with editing, activation, primary mark and safe deletion). The templates
 * have their own page (`TemplatesPage.test.tsx`).
 */
import type { BrandAsset } from '@edr/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../app/routes';
import { createBrandApi } from './brandApi';
import { BrandIdentityPage, BrandResourcesPage } from './BrandPage';
import {
  asset,
  ASSET_LOGO,
  ASSET_MASCOT,
  ASSET_REFERENCE,
  deferred,
  fakeFetch,
  IDENTITY,
  imageFile,
  jsonResponse,
  problemResponse,
  type Handler,
} from './testSupport';

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no object URLs; the upload preview only needs a stable value.
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
});

const ASSETS = [ASSET_LOGO, ASSET_MASCOT, ASSET_REFERENCE];

function renderPage(routes: Record<string, Handler | Handler[]> = {}, view: 'resources' | 'identity' = 'resources') {
  const fake = fakeFetch({
    'GET /brand/assets': () => jsonResponse({ assets: ASSETS }),
    'GET /brand/identity': () => jsonResponse(IDENTITY),
    ...routes,
  });
  const api = createBrandApi({ fetch: fake.fetch });
  render(view === 'resources' ? <BrandResourcesPage api={api} /> : <BrandIdentityPage api={api} />);
  return fake;
}

function librarySection(): HTMLElement {
  return screen.getByRole('region', { name: 'Recursos' });
}

function identitySection(): HTMLElement {
  return screen.getByRole('region', { name: 'Identidad visual' });
}

function detail(value: BrandAsset, usage = { renderedVersions: 0, projects: 0, exports: 0, templates: 0 }): Handler {
  return () => jsonResponse({ asset: value, usage });
}

async function libraryTable(): Promise<HTMLElement> {
  return within(librarySection()).findByRole('table', { name: 'Recursos de la biblioteca de marca' });
}

describe('BrandPage: page frame', () => {
  it('shows Recursos with its heading, the authorized-only rule and the provisional-values note, without the identity', async () => {
    const fake = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Recursos' })).toBeTruthy();
    expect(screen.getByText('Mi marca')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plantillas' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Identidad visual' })).toBeNull();
    // O-1: team badges are managed in Competiciones (PD-28, PD-32); Mi marca keeps the studio's own resources.
    expect(document.body.textContent).toContain(
      'Los escudos de los equipos se gestionan desde Competiciones, donde puedes cargar los archivos y registrar su procedencia y autorización de uso.',
    );
    expect(document.body.textContent).toContain('Mi marca administra los recursos visuales propios de El Deporte Rey.');
    expect(document.body.textContent).not.toContain('aparecen como texto');
    expect(document.body.textContent).toContain('sin logotipo ni mascota');
    expect(within(librarySection()).getAllByRole('button', { name: 'Subir recurso' }).length).toBeGreaterThan(0);
    await libraryTable();
    expect(fake.requests.map((request) => request.url)).toEqual(['/api/v1/brand/assets']);
  });

  it('shows Identidad visual with its own heading, without the library', async () => {
    const fake = renderPage({}, 'identity');
    expect(screen.getByRole('heading', { level: 1, name: 'Identidad visual' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Recursos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subir recurso' })).toBeNull();
    expect(await within(identitySection()).findByText('El Deporte Rey GT')).toBeTruthy();
    expect(fake.requests.map((request) => request.url)).toEqual(['/api/v1/brand/identity']);
  });

  it('shows loading states until each resource arrives', async () => {
    const assets = deferred<Response>();
    const fake = renderPage({ 'GET /brand/assets': () => assets.promise });
    expect(within(librarySection()).getByText('Cargando la biblioteca…')).toBeTruthy();
    assets.resolve(jsonResponse({ assets: [] }));
    expect(await within(librarySection()).findByText('Todavía no hay recursos en la biblioteca.')).toBeTruthy();
    expect(fake.requests.some((request) => request.url.includes('/templates'))).toBe(false);
  });
});

describe('BrandPage: visual identity (PD-ARCH-01G-A)', () => {
  it('shows the renderer palette and fonts read only, with their usage notes', async () => {
    renderPage({}, 'identity');
    const section = identitySection();
    expect(await within(section).findByText('El Deporte Rey GT')).toBeTruthy();
    expect(within(section).getByText('Valores provisionales')).toBeTruthy();
    const palette = within(section).getByRole('region', { name: 'Paleta oficial' });
    expect(within(palette).getAllByRole('listitem')).toHaveLength(5);
    expect(palette.textContent).toContain('#D4AF37');
    expect(palette.textContent).toContain('Acentos y datos destacados.');
    const fonts = within(section).getByRole('region', { name: 'Tipografía' });
    expect(fonts.textContent).toContain('Montserrat · Peso 800');
    expect(fonts.textContent).toContain('Inter · Peso 400');
    // Values are not editable: no colour or font input exists.
    expect(section.querySelector('input[type="color"]')).toBeNull();
    expect(within(section).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('edits the description, preferences and usage notes, sending null for cleared notes', async () => {
    const user = userEvent.setup();
    const updates: unknown[] = [];
    renderPage(
      {
        'PATCH /brand/identity': (request) => {
          updates.push(JSON.parse(String(request.body)));
          return jsonResponse({ ...IDENTITY, description: 'Fútbol con identidad.', updatedAt: '2026-11-05T12:00:00Z' });
        },
      },
      'identity',
    );
    const section = identitySection();
    await user.click(await within(section).findByRole('button', { name: 'Editar descripción y usos' }));
    await user.type(within(section).getByRole('textbox', { name: 'Descripción de la marca' }), 'Fútbol con identidad.');
    const accent = within(section).getAllByRole('textbox', { name: 'Uso recomendado' })[2] as HTMLInputElement;
    await user.clear(accent);
    await user.click(within(section).getByRole('button', { name: 'Guardar identidad' }));
    expect(await within(section).findByText('Fútbol con identidad.')).toBeTruthy();
    expect(updates).toEqual([
      {
        description: 'Fútbol con identidad.',
        graphicPreferences: null,
        colorUsage: { primary: null, primaryDark: null, accent: null, secondary: null, light: null },
        typographyUsage: { heading: null, body: null, numeric: null },
      },
    ]);
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      'Identidad de la marca guardada.',
    );
  });
});

describe('BrandPage: library views (PD-ARCH-01G-A)', () => {
  it('shows the table by default with previews from the API, category, policy and state', async () => {
    renderPage();
    const table = await libraryTable();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const logo = rows[0] as HTMLElement;
    expect(logo.textContent).toContain('Logotipo sintético');
    expect(logo.textContent).toContain('Principal');
    expect(logo.textContent).toContain('Logotipo');
    expect(logo.textContent).toContain('Protegido');
    expect(logo.textContent).toContain('Oficial');
    expect(logo.textContent).toContain('PNG · 512 × 256 px');
    expect(within(logo).getByRole('img').getAttribute('src')).toBe(`/api/v1/brand/assets/${ASSET_LOGO.id}/file`);
    expect((rows[1] as HTMLElement).textContent).toContain('Inactivo');
    expect((rows[2] as HTMLElement).textContent).toContain('Referencia gráfica');
    expect((rows[2] as HTMLElement).textContent).toContain('Solo referencia');
    expect(within(librarySection()).getByRole('button', { name: 'Vista de tabla' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('switches to cards over the same list, with larger previews', async () => {
    const user = userEvent.setup();
    renderPage();
    await libraryTable();
    await user.click(within(librarySection()).getByRole('button', { name: 'Vista de tarjetas' }));
    expect(within(librarySection()).queryByRole('table')).toBeNull();
    const cards = within(librarySection()).getAllByRole('article');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(ASSETS.map((item) => item.label));
    expect(
      within(cards[0] as HTMLElement).getByRole('button', { name: `Ver detalle: ${ASSET_LOGO.label}` }),
    ).toBeTruthy();
  });

  it('filters by category and searches by name or variant, ignoring accents and case', async () => {
    const user = userEvent.setup();
    renderPage();
    await libraryTable();
    await user.selectOptions(within(librarySection()).getByRole('combobox', { name: 'Categoría' }), 'mascot');
    expect(within(await libraryTable()).getAllByRole('row')).toHaveLength(2);
    expect(within(librarySection()).getByText('1 de 3 recursos')).toBeTruthy();
    await user.selectOptions(within(librarySection()).getByRole('combobox', { name: 'Categoría' }), '');
    await user.type(within(librarySection()).getByRole('searchbox', { name: 'Buscar por nombre' }), 'PORTADA');
    expect(within(await libraryTable()).getAllByRole('row')[1]?.textContent).toContain('Portada de referencia');
    await user.clear(within(librarySection()).getByRole('searchbox', { name: 'Buscar por nombre' }));
    await user.type(within(librarySection()).getByRole('searchbox', { name: 'Buscar por nombre' }), 'nada así');
    expect(within(librarySection()).getByText('Ningún recurso coincide con la búsqueda o el filtro.')).toBeTruthy();
  });

  it('renders a hostile label as text and replaces a failed preview with a fixed message', async () => {
    const hostile = asset({
      id: '00000000-0000-4000-8000-0000000000b1',
      kind: 'decoration',
      label: '<img src=x onerror=alert(1)>',
    });
    renderPage({ 'GET /brand/assets': () => jsonResponse({ assets: [hostile] }) });
    const table = await libraryTable();
    expect(table.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(table.querySelectorAll('img')).toHaveLength(1);
    fireEvent.error(within(table).getByRole('img'));
    expect(within(table).getByText('No se pudo mostrar la vista previa.')).toBeTruthy();
  });

  it('shows a load failure with a retry that loads the library again', async () => {
    const user = userEvent.setup();
    renderPage({
      'GET /brand/assets': [() => problemResponse(500, 'INTERNAL'), () => jsonResponse({ assets: ASSETS })],
    });
    const alert = await within(librarySection()).findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar la biblioteca');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await libraryTable();
  });
});

describe('BrandPage: upload (PD-ARCH-01G-A)', () => {
  it('shows the preview, size, format and the policy before saving, and saves with the chosen metadata', async () => {
    const user = userEvent.setup();
    const saved = asset({
      id: '00000000-0000-4000-8000-0000000000c1',
      kind: 'mascot',
      label: 'Ketsi celebrando',
      pose: 'Celebración',
    });
    const fake = renderPage({ 'POST /brand/assets': () => jsonResponse(saved, 201) });
    await libraryTable();
    await user.click(within(librarySection()).getByRole('button', { name: /Subir recurso/ }));
    const dialog = screen.getByRole('dialog', { name: 'Subir un recurso de marca' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Categoría' }), 'mascot');
    // The policy is visible and proposed by category; transformable is never preselected.
    expect((within(dialog).getByRole('radio', { name: /Protegido/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(dialog).getByRole('radio', { name: /Transformable con IA/ }) as HTMLInputElement).checked).toBe(
      false,
    );
    await user.upload(within(dialog).getByLabelText(/^Archivo/), imageFile('ketsi.png', 'image/png', 2048));
    expect(within(dialog).getByRole('img').getAttribute('src')).toBe('blob:preview');
    expect(dialog.textContent).toContain('PNG');
    expect(dialog.textContent).toContain('2.0 KB');
    expect((within(dialog).getByRole('textbox', { name: /^Nombre/ }) as HTMLInputElement).value).toBe('ketsi');
    await user.clear(within(dialog).getByRole('textbox', { name: /^Nombre/ }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Nombre/ }), 'Ketsi celebrando');
    await user.type(within(dialog).getByRole('textbox', { name: /^Pose/ }), 'Celebración');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Recurso oficial de la marca' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const post = fake.requests.find((request) => request.method === 'POST');
    const query = new URL(post?.url ?? '', 'http://local').searchParams;
    expect(Object.fromEntries(query)).toEqual({
      kind: 'mascot',
      label: 'Ketsi celebrando',
      usagePolicy: 'protected',
      pose: 'Celebración',
      official: 'true',
    });
    expect(post?.headers['Content-Type']).toBe('image/png');
    expect(within(await libraryTable()).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      'Recurso «Ketsi celebrando» guardado en la biblioteca.',
    );
  });

  it('fixes style references to reference only and accepts WebP for them only', async () => {
    const user = userEvent.setup();
    renderPage();
    await libraryTable();
    await user.click(within(librarySection()).getByRole('button', { name: /Subir recurso/ }));
    const dialog = screen.getByRole('dialog', { name: 'Subir un recurso de marca' });
    expect(
      within(dialog)
        .getByLabelText(/^Archivo/)
        .getAttribute('accept'),
    ).not.toContain('webp');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Categoría' }), 'style_reference');
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['reference_only']);
    expect(
      within(dialog)
        .getByLabelText(/^Archivo/)
        .getAttribute('accept'),
    ).toContain('image/webp');
    expect(dialog.textContent).toContain('Una referencia gráfica siempre es «Solo referencia».');
  });

  it('refuses SVG, oversize and missing files before sending, with linked errors', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fake = renderPage();
    await libraryTable();
    await user.click(within(librarySection()).getByRole('button', { name: /Subir recurso/ }));
    const dialog = screen.getByRole('dialog', { name: 'Subir un recurso de marca' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }));
    expect(dialog.textContent).toContain('Selecciona un archivo.');
    expect(dialog.textContent).toContain('Escribe un nombre.');
    await user.upload(within(dialog).getByLabelText(/^Archivo/), imageFile('logo.svg', 'image/svg+xml'));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }));
    expect(dialog.textContent).toContain('Solo se aceptan archivos PNG o JPEG');
    await user.upload(
      within(dialog).getByLabelText(/^Archivo/),
      imageFile('huge.png', 'image/png', 5 * 1024 * 1024 + 1),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }));
    expect(dialog.textContent).toContain('El archivo supera el tamaño máximo de 5 MB.');
    expect(
      within(dialog)
        .getByLabelText(/^Archivo/)
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(fake.requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('shows a server refusal in the dialog and keeps the form', async () => {
    const user = userEvent.setup();
    renderPage({ 'POST /brand/assets': () => problemResponse(409, 'DUPLICATE_ASSET', { detail: 'duplicate' }) });
    await libraryTable();
    await user.click(within(librarySection()).getByRole('button', { name: /Subir recurso/ }));
    const dialog = screen.getByRole('dialog', { name: 'Subir un recurso de marca' });
    await user.upload(within(dialog).getByLabelText(/^Archivo/), imageFile('logo.png', 'image/png'));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar recurso' }));
    expect(await within(dialog).findByText('No se pudo guardar el recurso')).toBeTruthy();
    expect((within(dialog).getByRole('textbox', { name: /^Nombre/ }) as HTMLInputElement).value).toBe('logo');
  });
});

describe('BrandPage: asset detail (PD-ARCH-01G-A)', () => {
  it('shows the metadata and usage and edits the properties without changing the file', async () => {
    const user = userEvent.setup();
    const edits: unknown[] = [];
    renderPage({
      'GET /brand/assets/00000000-0000-4000-8000-0000000000a1': detail(ASSET_LOGO, {
        renderedVersions: 3,
        projects: 1,
        exports: 2,
        templates: 0,
      }),
      'PATCH /brand/assets/00000000-0000-4000-8000-0000000000a1': (request) => {
        edits.push(JSON.parse(String(request.body)));
        return jsonResponse({ ...ASSET_LOGO, label: 'Logo horizontal', usagePolicy: 'reusable' });
      },
    });
    const table = await libraryTable();
    await user.click(within(table).getByRole('button', { name: `Ver detalle: ${ASSET_LOGO.label}` }));
    const dialog = screen.getByRole('dialog', { name: `Recurso: ${ASSET_LOGO.label}` });
    expect(
      await within(dialog).findByText(/Aparece en 3 diapositivas generadas de 1 proyecto y en 2 exportaciones/),
    ).toBeTruthy();
    expect(dialog.textContent).toContain('20.0 KB');
    expect(dialog.textContent).toContain('Es el recurso principal de su categoría.');
    // In use: the deletion is not offered.
    expect((within(dialog).getByRole('button', { name: 'Eliminar recurso' }) as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.textContent).toContain('no se puede eliminar sin romper ese contenido');

    const name = within(dialog).getByRole('textbox', { name: /^Nombre/ });
    await user.clear(name);
    await user.type(name, 'Logo horizontal');
    await user.click(within(dialog).getByRole('radio', { name: /Reutilizable/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(dialog).findByText('Cambios guardados.')).toBeTruthy();
    expect(edits).toEqual([
      { label: 'Logo horizontal', description: null, usagePolicy: 'reusable', official: true, variant: 'Principal' },
    ]);
    expect(within(table).getAllByRole('row')[1]?.textContent).toContain('Logo horizontal');
  });

  it('marks a logo as primary, moving the mark, and deactivates an asset', async () => {
    const user = userEvent.setup();
    const second = asset({ id: '00000000-0000-4000-8000-0000000000d1', kind: 'brand_logo', label: 'Logo monocromo' });
    renderPage({
      'GET /brand/assets': () => jsonResponse({ assets: [ASSET_LOGO, second] }),
      'GET /brand/assets/00000000-0000-4000-8000-0000000000d1': detail(second),
      'PATCH /brand/assets/00000000-0000-4000-8000-0000000000d1': [
        () => jsonResponse({ ...second, primary: true }),
        () => jsonResponse({ ...second, active: false, primary: false }),
      ],
    });
    const table = await libraryTable();
    await user.click(within(table).getByRole('button', { name: 'Ver detalle: Logo monocromo' }));
    const dialog = screen.getByRole('dialog', { name: 'Recurso: Logo monocromo' });
    await within(dialog).findByText('No aparece en ninguna diapositiva generada.');
    await user.click(within(dialog).getByRole('button', { name: 'Usar como principal' }));
    expect(await within(dialog).findByText('Es el recurso principal de su categoría.')).toBeTruthy();
    const rows = within(table).getAllByRole('row');
    expect(rows[1]?.textContent).not.toContain('Principal Oficial');
    expect(within(rows[1] as HTMLElement).queryByText('Principal', { selector: 'span' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(await within(dialog).findByRole('button', { name: 'Activar' })).toBeTruthy();
  });

  it('deletes an unused asset after confirmation and announces it', async () => {
    const user = userEvent.setup();
    const fake = renderPage({
      'GET /brand/assets/00000000-0000-4000-8000-0000000000a3': detail(ASSET_REFERENCE),
      'DELETE /brand/assets/00000000-0000-4000-8000-0000000000a3': () => new Response(null, { status: 204 }),
    });
    const table = await libraryTable();
    await user.click(within(table).getByRole('button', { name: `Ver detalle: ${ASSET_REFERENCE.label}` }));
    const dialog = screen.getByRole('dialog', { name: `Recurso: ${ASSET_REFERENCE.label}` });
    await within(dialog).findByText('No aparece en ninguna diapositiva generada.');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar recurso' }));
    expect(fake.requests.some((request) => request.method === 'DELETE')).toBe(false);
    expect(within(dialog).getByRole('alert').textContent).toContain('El archivo se conserva');
    await user.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(await libraryTable()).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('status', { name: 'Avisos de la página de marca' }).textContent).toBe(
      `Recurso «${ASSET_REFERENCE.label}» eliminado de la biblioteca.`,
    );
  });

  it('explains a refused deletion of an asset in use', async () => {
    const user = userEvent.setup();
    renderPage({
      'GET /brand/assets/00000000-0000-4000-8000-0000000000a3': detail(ASSET_REFERENCE),
      'DELETE /brand/assets/00000000-0000-4000-8000-0000000000a3': () =>
        problemResponse(409, 'ASSET_IN_USE', { detail: 'in use' }),
    });
    const table = await libraryTable();
    await user.click(within(table).getByRole('button', { name: `Ver detalle: ${ASSET_REFERENCE.label}` }));
    const dialog = screen.getByRole('dialog', { name: `Recurso: ${ASSET_REFERENCE.label}` });
    await within(dialog).findByText('No aparece en ninguna diapositiva generada.');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar recurso' }));
    await user.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));
    expect(await within(dialog).findByText('No se pudo eliminar el recurso')).toBeTruthy();
    expect(dialog.textContent).toContain('Puedes desactivarlo');
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
