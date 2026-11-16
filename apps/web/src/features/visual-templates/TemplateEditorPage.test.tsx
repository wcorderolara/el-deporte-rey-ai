/**
 * Editor of a visual template (PD-ARCH-01G-C, with its UX refinement): the toolbar, the layers and resources panel,
 * the canvas with its zoom, the contextual properties, adding layers, locking, saving with the revision, the
 * validation indicator, the Diseño / Vista previa modes with local sports data, publication, and the read-only
 * published version with "Crear nueva versión". A fake fetch answers every request; no network is used.
 */
import { VISUAL_TEMPLATE_FIXTURE_ROW_PARTS, VisualTemplateLayerSchema, type VisualTemplateLayer } from '@edr/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { createBrandApi } from '../brand/brandApi';
import { fakeFetch, IDENTITY, jsonResponse, problemResponse, type Handler } from '../brand/testSupport';
import { createCompetitionsApi } from '../competitions/api';
import { createDesignApi } from '../design/designApi';
import { TemplateEditorPage } from './TemplateEditorPage';
import {
  COMPETITION,
  DECORATION,
  DRAFT_ID,
  KETSI,
  LOGO,
  MATCH,
  PUBLISHED_ID,
  ROUND,
  SEASON,
  STAGE,
  STAGED_ROUND,
  T,
  TEMPLATE_ID,
  detail,
  version,
} from './testSupport';
import { createVisualTemplatesApi } from './visualTemplatesApi';

afterEach(cleanup);

const BASE = `/visual-templates/${TEMPLATE_ID}`;
const DRAFT_PATH = `${BASE}/versions/${DRAFT_ID}`;

function renderEditor(routes: Record<string, Handler | Handler[]> = {}, entry = `/templates/visual/${TEMPLATE_ID}`) {
  const fake = fakeFetch({
    [`GET ${BASE}`]: () => jsonResponse(detail()),
    [`GET ${DRAFT_PATH}`]: () => jsonResponse(version()),
    'GET /brand/assets': () => jsonResponse({ assets: [LOGO, KETSI, DECORATION] }),
    'GET /brand/identity': () => jsonResponse(IDENTITY),
    'GET /competitions': () => jsonResponse({ competitions: [COMPETITION] }),
    [`GET /competitions/${COMPETITION.id}/seasons`]: () => jsonResponse({ seasons: [SEASON] }),
    [`GET /competitions/${COMPETITION.id}/seasons/${SEASON.id}/rounds`]: () => jsonResponse({ rounds: [ROUND] }),
    [`GET /competitions/${COMPETITION.id}/seasons/${SEASON.id}/stages`]: () => jsonResponse({ stages: [STAGE] }),
    [`GET /competitions/${COMPETITION.id}/seasons/${SEASON.id}/stages/${STAGE.id}/rounds`]: () =>
      jsonResponse({ rounds: [STAGED_ROUND] }),
    [`GET /competitions/${COMPETITION.id}/seasons/${SEASON.id}/matches`]: () => jsonResponse({ matches: [MATCH] }),
    ...routes,
  });
  const element = (
    <TemplateEditorPage
      api={createVisualTemplatesApi({ fetch: fake.fetch })}
      brandApi={createBrandApi({ fetch: fake.fetch })}
      designApi={createDesignApi({ fetch: fake.fetch })}
      sportsApi={createCompetitionsApi(createApiClient({ fetch: fake.fetch }))}
    />
  );
  const router = createMemoryRouter(
    [
      { path: '/templates/visual/:templateId', element },
      { path: '/templates', element: <p>Plantillas</p> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return { fake, router };
}

async function editor() {
  await screen.findByRole('heading', { level: 1, name: 'Previa dorada' });
  return screen.getByRole('group', { name: 'Lienzo de la plantilla' });
}

type User = ReturnType<typeof userEvent.setup>;

/** Adds a layer from the «Agregar capa» menu. */
async function addLayer(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: 'Agregar capa' }));
  await user.click(screen.getByRole('menuitem', { name }));
}

/** Opens the validation indicator of the toolbar and returns its list of issues. */
async function openValidation(user: User) {
  await user.click(screen.getByRole('button', { name: /^Validación:/ }));
  return screen.getByRole('region', { name: 'Validación' });
}

/** Switches to the preview mode and returns its panel. */
async function openPreview(user: User) {
  await user.click(screen.getByRole('tab', { name: 'Vista previa' }));
  return screen.getByRole('tabpanel', { name: 'Vista previa' });
}

function lastBody(fake: ReturnType<typeof fakeFetch>, method: string, path: string): unknown {
  const request = [...fake.requests].reverse().find((item) => item.method === method && item.url.endsWith(path));
  return JSON.parse(String(request?.body));
}

describe('TemplateEditorPage: editing the draft', () => {
  it('shows the background, the layers on the canvas and the server validation', async () => {
    renderEditor();
    const canvas = await editor();

    expect(within(canvas).getByRole('img', { name: 'Fondo de la plantilla' }).getAttribute('src')).toBe(
      `/api/v1${DRAFT_PATH}/background?v=${'a'.repeat(64)}`,
    );
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });
    expect(layer.textContent).toBe('{Equipo local}');
    expect(layer.style.left).toBe('5%');
    expect(layer.style.width).toBe('40%');
    expect(
      within(canvas).getByRole('button', { name: 'Capa «Logotipo oficial»' }).querySelector('img')?.getAttribute('src'),
    ).toBe(`/api/v1/brand/assets/${LOGO.id}/file`);

    // The validation is a compact indicator; its panel lists each issue with its layer and the recommended action.
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Validación: 1 error · 1 advertencia' })).toBeTruthy();
    const panel = await openValidation(user);
    const items = within(within(panel).getByRole('list', { name: 'Validación' })).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Error');
    expect(items[0]?.textContent).toContain('Falta una capa con el equipo visitante.');
    expect(items[0]?.textContent).toContain('Agrega una capa de dato deportivo con ese dato.');
    expect(items[1]?.textContent).toContain('Advertencia');
    expect(items[1]?.textContent).toContain('Cambia el color o agrega un efecto de sombra o contorno.');
    const publish = screen.getByRole('button', { name: 'Publicar plantilla' }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect(publish.title).toBe('No se puede publicar: corrige los errores de validación.');
    // One publication action only, and no undo or redo controls (they do not exist).
    expect(screen.getAllByRole('button', { name: /^Publicar/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Deshacer|Rehacer/ })).toBeNull();
  });

  it('shows the toolbar with the full name, the status, the dimensions and the save state', async () => {
    renderEditor();
    await editor();
    const title = screen.getByRole('heading', { level: 1, name: 'Previa dorada' });
    expect(title.getAttribute('title')).toBe('Previa dorada');
    expect(screen.getByRole('link', { name: 'Volver a Plantillas' }).getAttribute('href')).toBe('/templates/create');
    expect(screen.getByRole('button', { name: 'Editar el nombre y los datos de la plantilla' })).toBeTruthy();
    expect(screen.getByText(/^Guardado · /)).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Zoom y guías del lienzo' }).textContent).toContain('1080 × 1350 px');
    expect(screen.getByRole('tab', { name: 'Diseño' }).getAttribute('aria-selected')).toBe('true');
  });

  it('zooms the canvas without changing the stored coordinates, and collapses the side panels', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();
    const zoom = screen.getByRole('toolbar', { name: 'Zoom y guías del lienzo' });

    await user.click(within(zoom).getByRole('button', { name: '100 %' }));
    expect(canvas.style.width).toBe('1080px');
    expect(within(zoom).getByRole('status', { name: 'Zoom' }).textContent).toBe('100 %');
    await user.click(within(zoom).getByRole('button', { name: 'Acercar' }));
    expect(canvas.style.width).toBe('1350px');
    await user.click(within(zoom).getByRole('button', { name: 'Alejar' }));
    await user.click(within(zoom).getByRole('button', { name: 'Alejar' }));
    expect(canvas.style.width).toBe('810px');
    expect(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }).style.left).toBe('5%');
    await user.click(within(zoom).getByRole('button', { name: 'Guías' }));
    expect(within(zoom).getByRole('button', { name: 'Guías' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(zoom).getByRole('button', { name: /Ajustar/ }));
    expect(
      within(zoom)
        .getByRole('button', { name: /Ajustar/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Ocultar capas y recursos' }));
    expect(screen.queryByRole('list', { name: 'Capas' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mostrar capas y recursos' }));
    expect(screen.getByRole('list', { name: 'Capas' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ocultar propiedades' }));
    expect(screen.queryByRole('heading', { name: 'Propiedades' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mostrar propiedades' }));
    expect(screen.getByRole('heading', { name: 'Propiedades' })).toBeTruthy();
  });

  it('selects a layer from the canvas or a validation issue and edits its properties', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();

    // Without a selection, the panel shows the background and the canvas.
    expect(
      screen.getByText('Selecciona una capa en el lienzo o en la lista para editar sus propiedades.'),
    ).toBeTruthy();
    expect(screen.getByText('Propuesta visual aprobada')).toBeTruthy();
    await user.click(within(canvas).getByRole('button', { name: 'Capa «Logotipo oficial»' }));
    expect(screen.getByText(/Se dibuja el archivo original, sin modificar/)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Familia' })).toBeNull();

    await openValidation(user);
    await user.click(screen.getByRole('button', { name: /Equipo local: El contraste/ }));
    expect(screen.getByRole('button', { name: /^Validación:/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Dato vinculado')).toBeTruthy();
    const binding = screen.getByRole('combobox', { name: 'Dato deportivo' }) as HTMLSelectElement;
    expect(binding.value).toBe('match.homeTeam.name');
    expect([...binding.options].map((option) => option.textContent)).not.toContain('Marcador');
    await user.selectOptions(binding, 'match.awayTeam.name');
    expect(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }).textContent).toBe('{Equipo visitante}');
    expect(screen.getByText('match.awayTeam.name')).toBeTruthy();
    expect(screen.getByText('Sin vista previa todavía')).toBeTruthy();

    const x = screen.getByRole('spinbutton', { name: 'X (%)' });
    fireEvent.change(x, { target: { value: '12.5' } });
    expect(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }).style.left).toBe('12.5%');
    expect(
      (screen.getByRole('combobox', { name: 'Familia' }) as HTMLSelectElement).selectedOptions[0]?.textContent,
    ).toBe('Titulares · Montserrat 800');
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Validación: .*\(hay cambios sin guardar\)$/ })).toBeTruthy();

    // A group of properties collapses and opens again without losing its values.
    await user.click(screen.getByRole('button', { name: 'Posición y tamaño' }));
    expect(screen.queryByRole('spinbutton', { name: 'X (%)' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Posición y tamaño' }));
    expect((screen.getByRole('spinbutton', { name: 'X (%)' }) as HTMLInputElement).value).toBe('12.5');
  });

  it('moves a layer with the keyboard, reorders, hides and deletes layers', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });

    layer.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(layer.style.left).toBe('10%');

    // The list shows the front layer first and the background last.
    const list = screen.getByRole('list', { name: 'Capas' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.querySelector('button')?.textContent),
    ).toEqual([
      'Equipo localDato: Equipo local',
      'Logotipo oficialRecurso oficial',
      'FondoPrevia individual · 4:5 · 1/1',
    ]);
    await user.click(within(list).getByRole('button', { name: 'Más acciones de la capa «Equipo local»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Enviar atrás' }));
    expect(
      within(canvas)
        .getAllByRole('button')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Capa «Equipo local»', 'Capa «Logotipo oficial»']);
    await user.click(within(list).getByRole('button', { name: 'Ocultar «Logotipo oficial»' }));
    expect(within(list).getByText(/Oculta/)).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Más acciones de la capa «Logotipo oficial»' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar capa' }));
    expect(within(canvas).queryByRole('button', { name: 'Capa «Logotipo oficial»' })).toBeNull();
  });

  it('locks a layer for the session: it is selected but not moved or edited until unlocked', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();
    const list = screen.getByRole('list', { name: 'Capas' });

    await user.click(within(list).getByRole('button', { name: 'Bloquear «Equipo local»' }));
    expect(within(list).getByRole('button', { name: 'Desbloquear «Equipo local»' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });
    layer.focus();
    await user.keyboard('{ArrowRight}');
    expect(layer.style.left).toBe('5%');
    expect(screen.getByRole('spinbutton', { name: 'X (%)' }).matches(':disabled')).toBe(true);
    expect(screen.queryByText('Cambios sin guardar')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('spinbutton', { name: 'X (%)' }).matches(':disabled')).toBe(false);
  });

  it('places a resource of Mi marca from the Recursos tab', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();

    await user.click(screen.getByRole('tab', { name: 'Recursos' }));
    const resources = screen.getByRole('tabpanel', { name: 'Recursos' });
    expect(within(resources).getByRole('heading', { name: 'Logotipos' })).toBeTruthy();
    expect(within(resources).getByText('No hay otros fondos disponibles.')).toBeTruthy();
    await user.click(within(resources).getByRole('button', { name: 'Agregar: Ketsi oficial' }));
    await user.click(within(resources).getByRole('button', { name: 'Agregar: Trazo dorado' }));
    expect(within(canvas).getByRole('button', { name: 'Capa «Ketsi oficial»' })).toBeTruthy();
    expect(within(canvas).getByRole('button', { name: 'Capa «Trazo dorado»' })).toBeTruthy();
    expect(within(resources).getByText(/Los escudos no son un recurso de Mi marca/)).toBeTruthy();
  });

  it('adds text, sports data, Mi marca image, official logo and Ketsi layers', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();

    for (const name of ['Texto', 'Dato deportivo', 'Imagen de Mi marca', 'Logotipo oficial', 'Ketsi']) {
      await addLayer(user, name);
    }
    const names = within(canvas)
      .getAllByRole('button')
      .map((item) => item.getAttribute('aria-label'));
    expect(names.slice(2)).toEqual([
      'Capa «Texto»',
      'Capa «Dato deportivo»',
      'Capa «Trazo dorado»',
      'Capa «Logotipo oficial»',
      'Capa «Ketsi oficial»',
    ]);
    expect(screen.getByRole('combobox', { name: 'Recurso' })).toBeTruthy();
  });

  it('adds the home and away team badge layers of a match template and saves them (PD-ARCH-01G-D)', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`PUT ${DRAFT_PATH}`]: (request) => {
        const body = JSON.parse(String(request.body)) as { layers: VisualTemplateLayer[] };
        return jsonResponse(version({ revision: 4, layers: body.layers }));
      },
    });
    const canvas = await editor();
    await addLayer(user, 'Escudo local');
    await addLayer(user, 'Escudo visitante');
    const away = within(canvas).getByRole('button', { name: 'Capa «Escudo visitante»' });
    expect(away.textContent).toBe('Escudo visitante');
    await user.click(away);
    const binding = screen.getByRole('combobox', { name: 'Escudo' }) as HTMLSelectElement;
    expect(binding.value).toBe('match.awayTeam.badge');
    expect(screen.getByText(/Se dibuja el escudo del equipo, proporcional/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'PUT')).toBe(true));
    const body = lastBody(fake, 'PUT', DRAFT_PATH) as { layers: VisualTemplateLayer[] };
    expect(
      body.layers
        .filter((layer) => layer.type === 'team_badge')
        .map((layer) => [layer.id, layer.type === 'team_badge' ? layer.binding : '']),
    ).toEqual([
      ['escudo-1', 'match.homeTeam.badge'],
      ['escudo-2', 'match.awayTeam.badge'],
    ]);
  });

  it('applies a text effect of the palette and capital letters to a text layer, and saves them (01G-C-2, PD-29)', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`PUT ${DRAFT_PATH}`]: (request) => {
        const body = JSON.parse(String(request.body)) as { layers: VisualTemplateLayer[] };
        return jsonResponse(version({ revision: 4, layers: body.layers }));
      },
    });
    const canvas = await editor();
    await user.click(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }));
    const effect = screen.getByRole('combobox', { name: 'Efecto' }) as HTMLSelectElement;
    expect([...effect.options].map((option) => option.textContent)).toEqual([
      'Ninguno',
      'Sombra suave',
      'Sombra intensa',
      'Brillo dorado',
      'Brillo morado',
      'Contorno oscuro',
      'Marcador dorado',
    ]);
    await user.selectOptions(effect, 'strong_shadow');
    await user.click(screen.getByRole('checkbox', { name: /Mostrar en mayúsculas/ }));
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });
    const text = layer.querySelector('span') ?? layer;
    expect(`${layer.getAttribute('style') ?? ''}${text.getAttribute('style') ?? ''}`).toMatch(
      /text-transform: uppercase/,
    );
    expect(`${layer.getAttribute('style') ?? ''}${text.getAttribute('style') ?? ''}`).toMatch(
      /text-shadow: 0 0\.1em 0/,
    );
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'PUT')).toBe(true));
    const body = lastBody(fake, 'PUT', DRAFT_PATH) as { layers: VisualTemplateLayer[] };
    const saved = body.layers.find((item) => item.name === 'Equipo local');
    expect(saved?.type === 'sports_data' ? saved.style : null).toMatchObject({
      effect: 'strong_shadow',
      uppercase: true,
    });
  });

  it('saves the draft with its revision and shows the new validation', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`PUT ${DRAFT_PATH}`]: (request) => {
        const body = JSON.parse(String(request.body)) as { layers: VisualTemplateLayer[] };
        return jsonResponse(
          version({ revision: 4, layers: body.layers, validation: { publishable: true, issues: [] } }),
        );
      },
    });
    await editor();
    const save = screen.getByRole('button', { name: 'Guardar borrador' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await addLayer(user, 'Texto');
    await user.click(save);

    expect(await screen.findByRole('button', { name: 'Validación: Sin errores' })).toBeTruthy();
    const body = lastBody(fake, 'PUT', DRAFT_PATH) as {
      revision: number;
      background: unknown;
      layers: { id: string }[];
    };
    expect(body.revision).toBe(3);
    expect(body.background).toEqual({ source: 'design_proposal', id: version().background.id });
    expect(body.layers.map((layer) => layer.id)).toEqual(['marca-1', 'dato-1', 'texto-1']);
    expect(screen.queryByText('Cambios sin guardar')).toBeNull();
    expect((screen.getByRole('button', { name: 'Publicar plantilla' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('explains a revision conflict and offers a reload', async () => {
    const user = userEvent.setup();
    renderEditor({ [`PUT ${DRAFT_PATH}`]: () => problemResponse(409, 'VERSION_CONFLICT') });
    await editor();
    await addLayer(user, 'Texto');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText(/La plantilla cambió en otra pestaña/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy();
  });
});

describe('TemplateEditorPage: preview with local data', () => {
  it('saves first, previews the chosen match and shows the engine image, the values and the issues', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`PUT ${DRAFT_PATH}`]: () => jsonResponse(version({ revision: 4 })),
      [`POST ${DRAFT_PATH}/previews`]: () =>
        jsonResponse({
          values: [
            { binding: 'match.homeTeam.name', value: 'Club Uno' },
            { binding: 'stage.name', value: null },
          ],
          badges: [{ binding: 'match.awayTeam.badge', badgeId: null }],
          issues: [{ code: 'VALUE_MISSING', severity: 'warning', layerId: 'dato-1', message: 'No hay fase.' }],
          imageUrl: `/api/v1${DRAFT_PATH}/preview?competitionId=${COMPETITION.id}&revision=4`,
          width: 1080,
          height: 1350,
        }),
    });
    await editor();
    await addLayer(user, 'Texto');

    const preview = await openPreview(user);
    expect(screen.queryByRole('group', { name: 'Lienzo de la plantilla' })).toBeNull();
    expect(within(preview).getByText('Datos deportivos locales')).toBeTruthy();
    const submit = within(preview).getByRole('button', { name: 'Previsualizar' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.selectOptions(await within(preview).findByRole('combobox', { name: 'Competición' }), COMPETITION.id);
    await user.selectOptions(
      within(preview).getByRole('combobox', { name: 'Temporada' }),
      await screen.findByRole('option', { name: '2026/27' }),
    );
    // The rounds of the stages are listed too (imported calendars put every round in a stage).
    expect(await screen.findByRole('option', { name: 'Jornada 10' })).toBeTruthy();
    await user.selectOptions(
      within(preview).getByRole('combobox', { name: 'Jornada' }),
      await screen.findByRole('option', { name: 'Jornada 9' }),
    );
    await user.selectOptions(
      within(preview).getByRole('combobox', { name: 'Partido' }),
      await screen.findByRole('option', { name: 'Club Uno vs Club Dos · Jornada 9' }),
    );
    expect(within(preview).getByText('Se guardará el borrador antes de previsualizar.')).toBeTruthy();
    await user.click(submit);

    const image = await within(preview).findByRole('img', {
      name: 'Vista previa de la plantilla con los datos seleccionados',
    });
    expect(image.getAttribute('src')).toBe(`/api/v1${DRAFT_PATH}/preview?competitionId=${COMPETITION.id}&revision=4`);
    expect(within(preview).getByText('Club Uno')).toBeTruthy();
    expect(within(preview).getByText('Sin dato')).toBeTruthy();
    expect(within(preview).getByText('No hay fase.')).toBeTruthy();
    expect(within(preview).getByText('Escudo visitante')).toBeTruthy();
    expect(within(preview).getByText('Sin escudo (la capa queda vacía)')).toBeTruthy();
    expect(within(preview).getByRole('link', { name: 'Descargar muestra' }).getAttribute('href')).toBe(
      `/api/v1${DRAFT_PATH}/preview?competitionId=${COMPETITION.id}&revision=4`,
    );

    const methods = fake.requests.filter((request) => request.method !== 'GET').map((request) => request.method);
    expect(methods).toEqual(['PUT', 'POST']);
    expect(lastBody(fake, 'POST', '/previews')).toEqual({
      selection: { competitionId: COMPETITION.id, seasonId: SEASON.id, roundId: ROUND.id, matchId: MATCH.id },
      language: 'es',
    });

    // Back in the design mode, a bound layer shows the value the preview resolved.
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Lienzo de la plantilla' })).getByRole('button', {
        name: 'Capa «Equipo local»',
      }),
    );
    const properties = screen.getByRole('complementary', { name: 'Propiedades' });
    expect(within(properties).getByText('match.homeTeam.name')).toBeTruthy();
    expect(within(properties).getByText('Club Uno')).toBeTruthy();
    expect(within(properties).getByText('Resuelto con datos locales')).toBeTruthy();
  });

  it('keeps unsaved changes when switching between Diseño and Vista previa', async () => {
    const user = userEvent.setup();
    const { fake, router } = renderEditor();
    await editor();
    await addLayer(user, 'Texto');
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy();

    await openPreview(user);
    expect(router.state.location.search).toBe('?panel=preview');
    await user.click(screen.getByRole('tab', { name: 'Diseño' }));
    expect(router.state.location.search).toBe('');
    const canvas = screen.getByRole('group', { name: 'Lienzo de la plantilla' });
    expect(within(canvas).getByRole('button', { name: 'Capa «Texto»' })).toBeTruthy();
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy();
    expect(fake.requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('opens directly in the preview mode from the address', async () => {
    renderEditor({}, `/templates/visual/${TEMPLATE_ID}?panel=preview`);
    await screen.findByRole('heading', { level: 1, name: 'Previa dorada' });
    expect(screen.getByRole('tab', { name: 'Vista previa' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Vista previa' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Lienzo de la plantilla' })).toBeNull();
  });
});

describe('TemplateEditorPage: cover and closing templates (decision 01G-D-3)', () => {
  const previewResult = {
    values: [{ binding: 'competition.name', value: 'Liga Sintética' }],
    badges: [],
    issues: [],
    imageUrl: `/api/v1${DRAFT_PATH}/preview?competitionId=${COMPETITION.id}&revision=3`,
    width: 1080,
    height: 1350,
  };

  async function chooseSeason(preview: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(await within(preview).findByRole('combobox', { name: 'Competición' }), COMPETITION.id);
    await user.selectOptions(
      within(preview).getByRole('combobox', { name: 'Temporada' }),
      await screen.findByRole('option', { name: '2026/27' }),
    );
  }

  it('shows a cover with the engine name, offers no team badges and previews without a match or round', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`GET ${BASE}`]: () => jsonResponse(detail({ contentType: 'cover' })),
      [`POST ${DRAFT_PATH}/previews`]: () => jsonResponse(previewResult),
    });
    await editor();
    expect(screen.getByText(/^Portada · /)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Agregar capa' }));
    expect(screen.getByRole('menuitem', { name: 'Texto' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Escudo local' })).toBeNull();
    await user.keyboard('{Escape}');

    const preview = await openPreview(user);
    await chooseSeason(preview, user);
    expect(within(preview).queryByRole('combobox', { name: 'Partido' })).toBeNull();
    const round = within(preview).getByRole('combobox', { name: 'Jornada' }) as HTMLSelectElement;
    expect(round.value).toBe('');
    expect(within(round).getByRole('option', { name: 'Sin jornada' })).toBeTruthy();
    const submit = within(preview).getByRole('button', { name: 'Previsualizar' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    await user.click(submit);
    await within(preview).findByRole('img', { name: 'Vista previa de la plantilla con los datos seleccionados' });
    expect(lastBody(fake, 'POST', '/previews')).toEqual({
      selection: { competitionId: COMPETITION.id, seasonId: SEASON.id },
      language: 'es',
    });
  });

  it('previews a closing with the competition and season only', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      [`GET ${BASE}`]: () => jsonResponse(detail({ contentType: 'closing' })),
      [`POST ${DRAFT_PATH}/previews`]: () => jsonResponse(previewResult),
    });
    await editor();
    expect(screen.getByText(/^Cierre · /)).toBeTruthy();
    const preview = await openPreview(user);
    await chooseSeason(preview, user);
    expect(within(preview).queryByRole('combobox', { name: 'Jornada' })).toBeNull();
    expect(within(preview).queryByRole('combobox', { name: 'Partido' })).toBeNull();
    await user.click(within(preview).getByRole('button', { name: 'Previsualizar' }));
    await within(preview).findByRole('img', { name: 'Vista previa de la plantilla con los datos seleccionados' });
    expect(lastBody(fake, 'POST', '/previews')).toEqual({
      selection: { competitionId: COMPETITION.id, seasonId: SEASON.id },
      language: 'es',
    });
  });
});

describe('TemplateEditorPage: match list of a round calendar (PD-ARCH-01G-E.2)', () => {
  const roundCalendar = {
    [`GET ${BASE}`]: () => jsonResponse(detail({ contentType: 'round_overview' })),
    [`GET ${DRAFT_PATH}`]: () => jsonResponse(version({ layers: version().layers.slice(0, 1), bindings: [] })),
  };
  /** The top of a row outline, as a percentage of the canvas. */
  const top = (element: Element | undefined) =>
    Number.parseFloat((element as HTMLElement | undefined)?.style.top ?? '');

  it('is not offered to a template of one match', async () => {
    const user = userEvent.setup();
    renderEditor();
    await editor();
    await user.click(screen.getByRole('button', { name: 'Agregar capa' }));
    expect(screen.getByRole('menuitem', { name: 'Escudo local' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Lista de partidos' })).toBeNull();
  });

  it('adds one list to a round calendar and draws its six rows and the parts of the first one', async () => {
    const user = userEvent.setup();
    renderEditor(roundCalendar);
    const canvas = await editor();
    await addLayer(user, 'Lista de partidos');

    const list = within(canvas).getByRole('button', { name: 'Capa «Lista de partidos»' });
    expect(list.style.left).toBe('2.78%');
    expect(list.style.width).toBe('94.44%');
    const rows = [...canvas.querySelectorAll('[data-fixture-row]')];
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBe(list);
    rows.forEach((row, index) => expect(top(row)).toBeCloseTo((0.2415 + index * (0.077 + 0.0074)) * 100, 6));
    // Only the first row is a layer: the other outlines are not selectable.
    expect(rows.slice(1).every((row) => row.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(within(canvas).getAllByRole('button')).toHaveLength(2);
    expect(
      [...list.querySelectorAll('[data-fixture-part]')].map((part) => part.getAttribute('data-fixture-part')),
    ).toEqual([...VISUAL_TEMPLATE_FIXTURE_ROW_PARTS]);
    const layerList = screen.getByRole('list', { name: 'Capas' });
    expect(within(layerList).getAllByRole('listitem')[0]?.querySelector('button')?.textContent).toBe(
      'Lista de partidosLista de partidos',
    );

    // The first row moves like any layer, and the other rows follow it.
    list.focus();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(top(rows[0])).toBeCloseTo(29.15, 6);
    expect(top(canvas.querySelector('[data-fixture-row="6"]') ?? undefined)).toBeCloseTo(
      (0.2915 + 5 * (0.077 + 0.0074)) * 100,
      6,
    );

    // A version holds one list at most.
    await user.click(screen.getByRole('button', { name: 'Agregar capa' }));
    expect(screen.getByRole('menuitem', { name: 'Texto' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Lista de partidos' })).toBeNull();
  });

  it('edits the row gap and the parts of the row, and saves them', async () => {
    const user = userEvent.setup();
    const { fake } = renderEditor({
      ...roundCalendar,
      [`PUT ${DRAFT_PATH}`]: (request) => {
        const body = JSON.parse(String(request.body)) as { layers: VisualTemplateLayer[] };
        return jsonResponse(version({ revision: 4, layers: body.layers }));
      },
    });
    const canvas = await editor();
    await addLayer(user, 'Lista de partidos');
    const properties = screen.getByRole('complementary', { name: 'Propiedades' });
    expect([...properties.querySelectorAll('fieldset fieldset > legend')].map((legend) => legend.textContent)).toEqual([
      'Escudo local',
      'Nombre local',
      'Fecha',
      'Hora',
      'Estado',
      'Nombre visitante',
      'Escudo visitante',
    ]);
    const part = (name: string) => within(properties).getByRole('group', { name });

    // The row gap is a percentage of the canvas height, as the vertical position.
    const gap = within(properties).getByRole('spinbutton', { name: 'Espacio entre filas (%)' }) as HTMLInputElement;
    expect(gap.value).toBe('0.74');
    fireEvent.change(gap, { target: { value: '1.5' } });
    expect(top(canvas.querySelector('[data-fixture-row="2"]') ?? undefined)).toBeCloseTo(
      (0.2415 + 0.077 + 0.015) * 100,
      6,
    );

    // The parts are placed in percentages of the row.
    const date = within(part('Fecha')).getByRole('spinbutton', { name: 'Y (% de la fila)' }) as HTMLInputElement;
    expect(date.value).toBe('6');
    fireEvent.change(date, { target: { value: '10' } });

    // The names are always drawn: they have no Visible control; the other parts do, and badges have no text style.
    for (const name of ['Nombre local', 'Nombre visitante']) {
      expect(within(part(name)).queryByRole('checkbox', { name: 'Visible' })).toBeNull();
      expect(within(part(name)).getByRole('combobox', { name: 'Familia' })).toBeTruthy();
    }
    for (const name of ['Escudo local', 'Fecha', 'Hora', 'Estado', 'Escudo visitante']) {
      expect(within(part(name)).getByRole('checkbox', { name: 'Visible' })).toBeTruthy();
    }
    expect(within(part('Escudo local')).queryByRole('combobox', { name: 'Familia' })).toBeNull();
    await user.click(within(part('Estado')).getByRole('checkbox', { name: 'Visible' }));
    expect(canvas.querySelector('[data-fixture-part="status"]')).toBeNull();

    // A text part edits its style with the same controls as a text layer.
    await user.selectOptions(within(part('Hora')).getByRole('combobox', { name: 'Alineación' }), 'right');
    fireEvent.change(within(part('Hora')).getByRole('spinbutton', { name: 'Tamaño máximo (px)' }), {
      target: { value: '34' },
    });

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(fake.requests.some((request) => request.method === 'PUT')).toBe(true));
    const body = lastBody(fake, 'PUT', DRAFT_PATH) as { layers: VisualTemplateLayer[] };
    const saved = body.layers.find((layer) => layer.type === 'fixture_list');
    expect(VisualTemplateLayerSchema.safeParse(saved).success).toBe(true);
    expect(saved).toMatchObject({
      id: 'partidos-1',
      name: 'Lista de partidos',
      y: 0.2415,
      rowGap: 0.015,
      row: {
        homeName: { visible: true },
        kickoffDate: { y: 0.1, height: 0.3 },
        kickoffTime: { style: { align: 'right', maxFontSize: 34, minFontSize: 18, fontRole: 'numeric' } },
        status: { visible: false },
        awayName: { visible: true },
      },
    });
  });
});

describe('TemplateEditorPage: publication and versions', () => {
  it('publishes a valid saved draft after confirmation and becomes read-only', async () => {
    const user = userEvent.setup();
    const published = version({ status: 'published', publishedAt: T, validation: { publishable: true, issues: [] } });
    const { fake } = renderEditor({
      [`GET ${DRAFT_PATH}`]: () => jsonResponse(version({ validation: { publishable: true, issues: [] } })),
      [`POST ${DRAFT_PATH}/release`]: () => jsonResponse(published),
      [`GET ${BASE}`]: [
        () => jsonResponse(detail()),
        () =>
          jsonResponse(
            detail(
              {
                status: 'published',
                draftVersionId: null,
                publishedVersion: { id: DRAFT_ID, version: 1, publishedAt: T },
              },
              [
                {
                  id: DRAFT_ID,
                  version: 1,
                  status: 'published',
                  layerCount: 2,
                  createdAt: T,
                  updatedAt: T,
                  publishedAt: T,
                },
              ],
            ),
          ),
      ],
    });
    await editor();

    await user.click(screen.getByRole('button', { name: 'Publicar plantilla' }));
    const dialog = screen.getByRole('dialog', { name: 'Publicar plantilla' });
    expect(within(dialog).getByText(/Quedará inmutable/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Publicar plantilla' }));

    expect(await screen.findByText(/Esta versión está publicada y no se puede modificar/)).toBeTruthy();
    expect(lastBody(fake, 'POST', '/release')).toEqual({ revision: 3 });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agregar capa' })).toBeNull();
    expect(screen.getByText('Solo lectura')).toBeTruthy();
  });

  it('opens a published version read-only and creates a new version from it', async () => {
    const user = userEvent.setup();
    const publishedTemplate = {
      status: 'published' as const,
      draftVersionId: null,
      publishedVersion: { id: PUBLISHED_ID, version: 1, publishedAt: T },
    };
    const { fake, router } = renderEditor({
      [`GET ${BASE}`]: () =>
        jsonResponse(
          detail(publishedTemplate, [
            {
              id: PUBLISHED_ID,
              version: 1,
              status: 'published',
              layerCount: 2,
              createdAt: T,
              updatedAt: T,
              publishedAt: T,
            },
          ]),
        ),
      [`GET ${BASE}/versions/${PUBLISHED_ID}`]: () =>
        jsonResponse(version({ id: PUBLISHED_ID, status: 'published', publishedAt: T })),
      [`POST ${BASE}/versions`]: () => jsonResponse(version({ version: 2 }), 201),
    });
    const canvas = await editor();

    expect(screen.getByText(/Esta versión está publicada/)).toBeTruthy();
    await user.click(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }));
    expect(screen.getByRole('textbox', { name: 'Nombre de la capa' }).matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Publicar plantilla' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Crear nueva versión' }));
    await waitFor(() => expect(router.state.location.search).toBe(`?version=${DRAFT_ID}`));
    expect(lastBody(fake, 'POST', '/versions')).toEqual({ fromVersionId: PUBLISHED_ID });
  });

  it('shows a load failure of the template with a retry', async () => {
    renderEditor({ [`GET ${BASE}`]: () => problemResponse(404, 'NOT_FOUND') });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar la plantilla');
  });
});
