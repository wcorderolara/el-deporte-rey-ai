/**
 * Editor of a visual template (PD-ARCH-01G-C): the canvas and layers, the properties, adding layers, saving with the
 * revision, the server validation, the preview with local sports data, publication, and the read-only published
 * version with "Crear nueva versión". A fake fetch answers every request; no network is used.
 */
import type { VisualTemplateLayer } from '@edr/contracts';
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

function lastBody(fake: ReturnType<typeof fakeFetch>, method: string, path: string): unknown {
  const request = [...fake.requests].reverse().find((item) => item.method === method && item.url.endsWith(path));
  return JSON.parse(String(request?.body));
}

describe('TemplateEditorPage: editing the draft', () => {
  it('shows the background, the layers on the canvas and the server validation', async () => {
    renderEditor();
    const canvas = await editor();

    expect(within(canvas).getByRole('img', { name: 'Fondo de la plantilla' }).getAttribute('src')).toBe(
      `/api/v1${DRAFT_PATH}/background`,
    );
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });
    expect(layer.textContent).toBe('{Equipo local}');
    expect(layer.style.left).toBe('5%');
    expect(layer.style.width).toBe('40%');
    expect(
      within(canvas).getByRole('button', { name: 'Capa «Logotipo oficial»' }).querySelector('img')?.getAttribute('src'),
    ).toBe(`/api/v1/brand/assets/${LOGO.id}/file`);

    const validation = screen.getByRole('list', { name: 'Validación' });
    const items = within(validation).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Error');
    expect(items[0]?.textContent).toContain('Falta una capa con el equipo visitante.');
    expect(items[1]?.textContent).toContain('Advertencia');
    expect((screen.getByRole('button', { name: 'Publicar versión' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No se puede publicar: corrige los errores de validación.')).toBeTruthy();
  });

  it('selects a layer from the canvas or a validation issue and edits its properties', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();

    expect(screen.getByText('Selecciona una capa para editar sus propiedades.')).toBeTruthy();
    await user.click(within(canvas).getByRole('button', { name: 'Capa «Logotipo oficial»' }));
    expect(screen.getByText(/Se dibuja el archivo original, sin modificar/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Equipo local: El contraste/ }));
    const binding = screen.getByRole('combobox', { name: 'Dato deportivo' }) as HTMLSelectElement;
    expect(binding.value).toBe('match.homeTeam.name');
    expect([...binding.options].map((option) => option.textContent)).not.toContain('Marcador');
    await user.selectOptions(binding, 'match.awayTeam.name');
    expect(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }).textContent).toBe('{Equipo visitante}');

    const x = screen.getByRole('spinbutton', { name: 'X (%)' });
    fireEvent.change(x, { target: { value: '12.5' } });
    expect(within(canvas).getByRole('button', { name: 'Capa «Equipo local»' }).style.left).toBe('12.5%');
    expect(
      (screen.getByRole('combobox', { name: 'Tipografía' }) as HTMLSelectElement).selectedOptions[0]?.textContent,
    ).toBe('Titulares · Montserrat 800');
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy();
    expect(screen.getByText('Hay cambios sin guardar: guarda para actualizar la validación.')).toBeTruthy();
  });

  it('moves a layer with the keyboard, reorders, hides and deletes layers', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();
    const layer = within(canvas).getByRole('button', { name: 'Capa «Equipo local»' });

    layer.focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(layer.style.left).toBe('10%');

    const list = screen.getByRole('list', { name: 'Capas' });
    await user.click(within(list).getByRole('button', { name: 'Bajar «Equipo local»' }));
    expect(
      within(canvas)
        .getAllByRole('button')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Capa «Equipo local»', 'Capa «Logotipo oficial»']);
    await user.click(within(list).getByRole('button', { name: 'Ocultar «Logotipo oficial»' }));
    expect(within(list).getByText(/Oculta/)).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Eliminar la capa «Logotipo oficial»' }));
    expect(within(canvas).queryByRole('button', { name: 'Capa «Logotipo oficial»' })).toBeNull();
  });

  it('adds text, sports data, Mi marca image, official logo and Ketsi layers', async () => {
    const user = userEvent.setup();
    renderEditor();
    const canvas = await editor();
    const add = screen.getByRole('group', { name: 'Agregar capa' });

    for (const name of ['Texto', 'Dato deportivo', 'Imagen de Mi marca', 'Logotipo oficial', 'Ketsi']) {
      await user.click(within(add).getByRole('button', { name: new RegExp(`^＋ ${name}$`) }));
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

    await user.click(
      within(screen.getByRole('group', { name: 'Agregar capa' })).getByRole('button', { name: '＋ Texto' }),
    );
    await user.click(save);

    expect(await screen.findByText('Sin errores ni advertencias.')).toBeTruthy();
    const body = lastBody(fake, 'PUT', DRAFT_PATH) as {
      revision: number;
      background: unknown;
      layers: { id: string }[];
    };
    expect(body.revision).toBe(3);
    expect(body.background).toEqual({ source: 'design_proposal', id: version().background.id });
    expect(body.layers.map((layer) => layer.id)).toEqual(['marca-1', 'dato-1', 'texto-1']);
    expect(screen.queryByText('Cambios sin guardar')).toBeNull();
    expect((screen.getByRole('button', { name: 'Publicar versión' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('explains a revision conflict and offers a reload', async () => {
    const user = userEvent.setup();
    renderEditor({ [`PUT ${DRAFT_PATH}`]: () => problemResponse(409, 'VERSION_CONFLICT') });
    await editor();
    await user.click(
      within(screen.getByRole('group', { name: 'Agregar capa' })).getByRole('button', { name: '＋ Texto' }),
    );
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
          issues: [{ code: 'VALUE_MISSING', severity: 'warning', layerId: 'dato-1', message: 'No hay fase.' }],
          imageUrl: `/api/v1${DRAFT_PATH}/preview?competitionId=${COMPETITION.id}&revision=4`,
          width: 1080,
          height: 1350,
        }),
    });
    await editor();
    await user.click(
      within(screen.getByRole('group', { name: 'Agregar capa' })).getByRole('button', { name: '＋ Texto' }),
    );

    const preview = screen.getByRole('region', { name: 'Vista previa con datos locales' });
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

    const methods = fake.requests.filter((request) => request.method !== 'GET').map((request) => request.method);
    expect(methods).toEqual(['PUT', 'POST']);
    expect(lastBody(fake, 'POST', '/previews')).toEqual({
      selection: { competitionId: COMPETITION.id, seasonId: SEASON.id, roundId: ROUND.id, matchId: MATCH.id },
      language: 'es',
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

    await user.click(screen.getByRole('button', { name: 'Publicar versión' }));
    const dialog = screen.getByRole('dialog', { name: 'Publicar versión' });
    expect(within(dialog).getByText(/Quedará inmutable/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Publicar versión' }));

    expect(await screen.findByText(/Esta versión está publicada y no se puede modificar/)).toBeTruthy();
    expect(lastBody(fake, 'POST', '/release')).toEqual({ revision: 3 });
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Agregar capa' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Publicar versión' })).toBeNull();

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
