/**
 * Manual import page with a mocked API (no network): file channel (exact bytes, NFC name, size checked before any
 * request; T11H-F01, T11H-F20, NV-11), form channel, the rejection view with every error (R-274), the applied import
 * with the project link (R-276), a reimport creating a new version (R-278), the history with originals (T11H-F11) and
 * failures with retry.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createImportsApi } from './importsApi';
import { ImportsPage } from './ImportsPage';
import { MAX_IMPORT_BYTES } from './fileImport';
import {
  bodyOf,
  bytesFile,
  decodeBase64,
  deferred,
  fakeFetch,
  FORM_IMPORT,
  HISTORY_V1,
  HISTORY_V2,
  IMPORT_ID_1,
  IMPORT_V1,
  IMPORT_V2,
  importErrors,
  jsonResponse,
  problemResponse,
  type Handler,
} from './testSupport';

afterEach(cleanup);

const CSV_BYTES = [...new TextEncoder().encode('competition_id,competition_name\r\nliga-sintetica,Liga Sintética\r\n')];

interface Routes {
  imports?: Handler | Handler[];
  selections?: Handler | Handler[];
  post?: Handler | Handler[];
}

function renderPage(routes: Routes = {}) {
  const fake = fakeFetch({
    'GET /imports': routes.imports ?? (() => jsonResponse({ imports: [IMPORT_V1] })),
    'GET /manual-data/selections': routes.selections ?? (() => jsonResponse(HISTORY_V1)),
    'POST /imports': routes.post ?? (() => jsonResponse(IMPORT_V1, 201)),
  });
  render(
    <MemoryRouter initialEntries={['/imports']}>
      <ImportsPage api={createImportsApi({ fetch: fake.fetch })} />
    </MemoryRouter>,
  );
  const posts = () => fake.requests.filter((request) => request.method === 'POST');
  const gets = (path: string) =>
    fake.requests.filter((request) => request.method === 'GET' && request.url.split('?')[0] === `/api/v1${path}`);
  return { ...fake, posts, gets };
}

function fileForm(): HTMLElement {
  return screen.getByRole('form', { name: 'Importar un archivo' });
}

async function uploadAndSubmit(file: File, declaredSource = '') {
  const user = userEvent.setup({ applyAccept: false });
  const form = fileForm();
  await user.upload(within(form).getByLabelText('Archivo'), file);
  if (declaredSource !== '') {
    await user.type(within(form).getByLabelText('Fuente declarada (opcional)'), declaredSource);
  }
  await user.click(within(form).getByRole('button', { name: 'Importar archivo' }));
  return user;
}

describe('ImportsPage: history and originals', () => {
  it('lists each import with channel, file name as text, declared source, time, hash and a download link', async () => {
    renderPage({ imports: () => jsonResponse({ imports: [IMPORT_V1, FORM_IMPORT] }) });

    const table = await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    const first = rows[1] as HTMLElement;
    expect(
      within(first)
        .getByRole('link', { name: /^Importación del / })
        .getAttribute('href'),
    ).toBe(`/imports/${IMPORT_ID_1}`);
    expect(within(first).getByText('Archivo CSV')).toBeTruthy();
    const fileName = within(first).getByText('jornada-1.csv');
    expect(fileName.closest('a')).toBeNull();
    expect(within(first).getByText('Acta sintética de la liga')).toBeTruthy();
    expect(within(first).getByText('1'.repeat(64))).toBeTruthy();
    expect(within(first).getByText(/Liga Sintética/)).toBeTruthy();
    const download = within(first).getByRole('link', { name: /Descargar original \(jornada-1\.csv, / });
    expect(download.getAttribute('href')).toBe(`/api/v1/imports/${IMPORT_ID_1}/original`);
    expect(download.hasAttribute('download')).toBe(true);
    expect(within(first).getByRole('link', { name: 'Apertura, jornada 1' }).getAttribute('href')).toBe(
      '/imports/versions/00000000-0000-4000-8000-0000000000c1',
    );

    const second = rows[2] as HTMLElement;
    expect(within(second).getByText('Formulario')).toBeTruthy();
    expect(within(second).getByText('Sin archivo (formulario)')).toBeTruthy();
    expect(within(second).getByText('No indicada')).toBeTruthy();

    expect(screen.getByText(/Abra los originales descargados como texto/)).toBeTruthy();
  });

  it('shows the versions of a selection and a link to create a project for the competition (R-276, R-278)', async () => {
    const { gets } = renderPage();
    const table = await screen.findByRole('table', { name: 'Versiones de Apertura, jornada 1' });
    expect(within(table).getByRole('rowheader', { name: 'Versión 1' })).toBeTruthy();
    expect(within(table).getByText('Actual')).toBeTruthy();
    expect(gets('/manual-data/selections')[0]?.url).toBe(
      '/api/v1/manual-data/selections?competitionId=liga-sintetica&seasonId=temporada-2026',
    );
    expect(screen.getByRole('link', { name: 'Crear un proyecto con «Liga Sintética»' }).getAttribute('href')).toBe(
      '/projects/new',
    );
  });

  it('says so when nothing was imported, and offers a retry when the history fails to load', async () => {
    const user = userEvent.setup();
    renderPage({ imports: [() => problemResponse(500, 'INTERNAL'), () => jsonResponse({ imports: [] })] });
    expect(await screen.findByText('No se pudo cargar el historial de importaciones')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/Todavía no hay importaciones aplicadas/)).toBeTruthy();
    expect(screen.getByText('No hay selecciones importadas.')).toBeTruthy();
  });
});

describe('ImportsPage: file channel', () => {
  it('sends the exact bytes of a file with a BOM, CRLF and an invalid UTF-8 byte (NV-11)', async () => {
    const text = vi.spyOn(Blob.prototype, 'text');
    const bytes = [0xef, 0xbb, 0xbf, ...CSV_BYTES, 0xc3, 0x28, 0xff, 0x0d, 0x0a];
    const { posts } = renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });

    await uploadAndSubmit(bytesFile('jornada-1.csv', bytes, 'text/csv'), 'Acta sintética');

    await screen.findByRole('heading', { name: /Importación aplicada/ });
    expect(posts()).toHaveLength(1);
    const body = bodyOf(posts()[0]);
    expect(body).toMatchObject({ channel: 'csv_file', fileName: 'jornada-1.csv', declaredSource: 'Acta sintética' });
    expect(Object.keys(body).sort()).toEqual(['channel', 'contentBase64', 'declaredSource', 'fileName']);
    expect(decodeBase64(String(body.contentBase64))).toEqual(bytes);
    expect(posts()[0]?.headers['X-EDR-Client']).toBe('web');
    expect(text).not.toHaveBeenCalled();
    text.mockRestore();
  });

  it('sends an NFD file name as NFC (T11H-F20)', async () => {
    const { posts } = renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const nfd = 'Jornada Sintética.json';

    await uploadAndSubmit(bytesFile(nfd, CSV_BYTES));

    await screen.findByRole('heading', { name: /Importación aplicada/ });
    const fileName = String(bodyOf(posts()[0]).fileName);
    expect(fileName).toBe('Jornada Sintética.json');
    expect(fileName).toBe(nfd.normalize('NFC'));
    expect(fileName).not.toBe(nfd);
    expect(bodyOf(posts()[0]).channel).toBe('json_file');
  });

  it('refuses an oversize file before any request, with a linked error and focus on the file field', async () => {
    const read = vi.spyOn(Blob.prototype, 'arrayBuffer');
    const { posts } = renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });

    await uploadAndSubmit(bytesFile('grande.csv', new Uint8Array(MAX_IMPORT_BYTES + 1)));

    const input = within(fileForm()).getByLabelText('Archivo');
    expect(await within(fileForm()).findByText(/supera el tamaño máximo de 512 KiB/)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toMatch(/file-error/);
    expect(document.activeElement).toBe(input);
    expect(posts()).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('applies an import: result focused and announced, project link, history and versions reloaded', async () => {
    const { gets } = renderPage({
      imports: [() => jsonResponse({ imports: [] }), () => jsonResponse({ imports: [IMPORT_V1] })],
    });
    await screen.findByText(/Todavía no hay importaciones aplicadas/);

    await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));

    const heading = await screen.findByRole('heading', { name: /Importación aplicada/ });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole('status', { name: 'Avisos de la página de importaciones' }).textContent).toBe(
      'Importación aplicada: «Liga Sintética», temporada «Temporada 2026».',
    );
    const result = heading.closest('section') as HTMLElement;
    expect(within(result).getByText('versión 1 (primera versión)', { exact: false })).toBeTruthy();
    expect(within(result).getByText(/no cuentan como verificación independiente/)).toBeTruthy();
    expect(
      within(result).getByRole('link', { name: 'Crear un proyecto con «Liga Sintética»' }).getAttribute('href'),
    ).toBe('/projects/new');
    await screen.findByRole('table', { name: 'Versiones de Apertura, jornada 1' });
    expect(gets('/imports')).toHaveLength(2);
    expect((within(fileForm()).getByLabelText('Archivo') as HTMLInputElement).files?.length ?? 0).toBe(0);
  });

  it('a reimport creates a new version; the earlier one stays listed (R-278)', async () => {
    renderPage({
      imports: [() => jsonResponse({ imports: [IMPORT_V1] }), () => jsonResponse({ imports: [IMPORT_V2, IMPORT_V1] })],
      selections: [() => jsonResponse(HISTORY_V1), () => jsonResponse(HISTORY_V2)],
      post: () => jsonResponse(IMPORT_V2, 201),
    });
    await screen.findByRole('table', { name: 'Versiones de Apertura, jornada 1' });

    await uploadAndSubmit(bytesFile('jornada-1-corregida.json', CSV_BYTES));

    const heading = await screen.findByRole('heading', { name: /Importación aplicada/ });
    const result = heading.closest('section') as HTMLElement;
    expect(within(result).getByText(/versión 2 \(nueva versión; las anteriores se conservan\)/)).toBeTruthy();

    await vi.waitFor(() => {
      const table = screen.getByRole('table', { name: 'Versiones de Apertura, jornada 1' });
      expect(within(table).getAllByRole('row')).toHaveLength(3);
    });
    const table = screen.getByRole('table', { name: 'Versiones de Apertura, jornada 1' });
    const [, newest, earlier] = within(table).getAllByRole('row') as HTMLElement[];
    expect(within(newest as HTMLElement).getByRole('rowheader').textContent).toBe('Versión 2');
    expect(within(newest as HTMLElement).getByText('Actual')).toBeTruthy();
    expect(within(earlier as HTMLElement).getByRole('rowheader').textContent).toBe('Versión 1');
    expect(within(earlier as HTMLElement).getByText('Anterior')).toBeTruthy();
    expect(
      within(earlier as HTMLElement)
        .getByRole('link', { name: 'Ver la versión 1 de Apertura, jornada 1' })
        .getAttribute('href'),
    ).toBe('/imports/versions/00000000-0000-4000-8000-0000000000c1');

    const history = screen.getByRole('table', { name: /Importaciones aplicadas/ });
    expect(within(history).getAllByRole('row')).toHaveLength(3);
  });

  it('shows a rejected import with every error by file, record, field and problem, and stores nothing (R-274)', async () => {
    const errors = importErrors(150);
    const { gets } = renderPage({
      post: () => problemResponse(400, 'IMPORT_REJECTED', { importErrors: errors }),
    });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });

    await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));

    const heading = await screen.findByRole('heading', { name: 'Importación rechazada' });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    const result = heading.closest('section') as HTMLElement;
    expect(
      within(result).getByText(/El archivo «jornada-1\.csv» fue rechazado completo; no se guardó ningún dato/),
    ).toBeTruthy();
    expect(within(result).getByRole('alert')).toBeTruthy();
    const table = within(result).getByRole('table', { name: '150 errores en la importación' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(151);
    const firstError = rows[1] as HTMLElement;
    const firstCells = within(firstError)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(firstCells).toEqual([
      'Fila 2',
      'home_score',
      'Partido finalizado sin marcador',
      'Un partido finalizado necesita su marcador (home_score); no se completa automáticamente.',
    ]);
    // The server's English message is never shown: the detail comes from the closed problem code (OD-63 F-2).
    expect(within(table).queryByText(/A finished match needs a score|Value has an invalid type/)).toBeNull();
    expect(
      within(rows[2] as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Fila 3',
      'status',
      'Tipo de valor no válido',
      'El valor de «status» no tiene el tipo o el formato esperado.',
    ]);
    expect(within(rows[150] as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe('Fila 151');
    expect(within(result).queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(within(result).queryByText(/como máximo 500 errores/)).toBeNull();
    expect(screen.getByRole('status', { name: 'Avisos de la página de importaciones' }).textContent).toBe(
      'Importación rechazada; no se guardó ningún dato.',
    );
    // Nothing was stored: the history is not loaded again.
    expect(gets('/imports')).toHaveLength(1);
  });

  it('notes the server cap when 500 errors are reported', async () => {
    renderPage({ post: () => problemResponse(400, 'IMPORT_REJECTED', { importErrors: importErrors(500) }) });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));
    expect(await screen.findByText(/como máximo 500 errores; puede haber más/)).toBeTruthy();
    expect(screen.getByRole('table', { name: '500 errores en la importación' })).toBeTruthy();
  });

  it('shows person-level fields refused by the server naming the field (R-119, SC-07)', async () => {
    renderPage({
      post: () =>
        problemResponse(400, 'IMPORT_REJECTED', {
          importErrors: [
            {
              location: 'file',
              record: 'file',
              field: 'scorer',
              problem: 'person_field',
              message: 'Person-level column refused',
            },
          ],
        }),
    });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));
    const table = await screen.findByRole('table', { name: '1 error en la importación' });
    expect(within(table).getByText('Archivo completo')).toBeTruthy();
    expect(within(table).getByText('scorer')).toBeTruthy();
    expect(within(table).getByText('Campo con datos de personas (no permitido)')).toBeTruthy();
    expect(
      within(table).getByText(
        '«scorer» contiene datos de personas, que no se aceptan: solo datos de equipos y de competición.',
      ),
    ).toBeTruthy();
    expect(within(table).queryByText('Person-level column refused')).toBeNull();
  });

  it('disables sending while the request runs, and offers a retry of the same body after a network failure', async () => {
    const pending = deferred<Response>();
    const { posts } = renderPage({
      post: [
        () => pending.promise,
        () => {
          throw new TypeError('network down');
        },
        () => jsonResponse(IMPORT_V1, 201),
      ],
    });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const user = await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));

    const busy = within(fileForm()).getByRole('button', { name: 'Importando…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    pending.resolve(problemResponse(500, 'INTERNAL'));
    expect(await screen.findByRole('heading', { name: 'No se pudo completar la importación' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/No se pudo conectar con el servidor local/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: /Importación aplicada/ });
    expect(posts()).toHaveLength(3);
    expect(bodyOf(posts()[2])).toEqual(bodyOf(posts()[0]));
  });

  it('explains a refused local request without suggesting a login', async () => {
    renderPage({ post: () => problemResponse(403, 'FORBIDDEN_ORIGIN') });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    await uploadAndSubmit(bytesFile('jornada-1.csv', CSV_BYTES));
    expect(await screen.findByText(/La aplicación no usa inicio de sesión/)).toBeTruthy();
  });
});

describe('ImportsPage: form channel', () => {
  async function chooseForm() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Formulario' }));
    return { user, form: screen.getByRole('form', { name: 'Introducir datos con el formulario' }) };
  }

  it('keeps the file form hidden while the form channel is chosen, and back', async () => {
    renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    await chooseForm();
    expect(screen.queryByRole('form', { name: 'Importar un archivo' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Archivo JSON o CSV' }));
    expect(screen.getByRole('form', { name: 'Importar un archivo' })).toBeTruthy();
  });

  it('lists the hints in a focused summary whose links move focus to the field, and sends nothing', async () => {
    const { posts } = renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const { user, form } = await chooseForm();

    await user.click(within(form).getByRole('button', { name: 'Importar datos del formulario' }));

    const title = within(form).getByRole('heading', { name: /errores en el formulario/ });
    const summary = title.parentElement as HTMLElement;
    expect(document.activeElement).toBe(summary);
    const link = within(summary).getByRole('link', {
      name: 'Identificador de la competición: Este campo es obligatorio.',
    });
    await user.click(link);
    const field = within(form).getByLabelText('Identificador de la competición');
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(posts()).toHaveLength(0);
  });

  it('builds and sends a ManualImportDocument from the entries (R-319)', async () => {
    const { posts } = renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const { user, form } = await chooseForm();
    const field = (label: string) => within(form).getByLabelText(label);

    await user.type(field('Identificador de la competición'), 'liga-sintetica');
    await user.type(field('Nombre de la competición'), 'Liga Sintética');
    await user.type(field('Identificador de la temporada'), 'temporada-2026');
    await user.type(field('Nombre de la temporada'), 'Temporada 2026');
    await user.type(field('Identificador de la fase'), 'apertura');
    await user.type(field('Nombre de la fase'), 'Apertura');
    await user.type(field('Número de jornada'), '1');
    await user.type(field('Nombre del equipo 1'), 'Equipo Norte');
    await user.type(field('Nombre del equipo 2'), 'Équipo Sur');
    expect(within(form).getByText('equipo-sur')).toBeTruthy();
    await user.selectOptions(field('Equipo local'), 'Equipo Norte');
    await user.selectOptions(field('Equipo visitante'), 'Équipo Sur');
    fireEvent.change(field('Fecha y hora de inicio'), { target: { value: '2026-09-30T18:00' } });
    await user.selectOptions(field('Estado'), 'Finalizado');
    await user.type(field('Goles del local'), '2');
    await user.type(field('Goles del visitante'), '1');
    await user.click(within(form).getByRole('button', { name: 'Importar datos del formulario' }));

    await screen.findByRole('heading', { name: /Importación aplicada/ });
    const body = bodyOf(posts()[0]);
    expect(body.channel).toBe('form');
    expect(body.declaredSource).toBeNull();
    expect(body.document).toMatchObject({
      format: 'edr-manual-import/1',
      competition: { id: 'liga-sintetica', name: 'Liga Sintética', areaName: null },
      selections: [
        {
          stage: { id: 'apertura', name: 'Apertura', order: 1 },
          matchday: 1,
          teams: [
            { key: 'equipo-norte', name: 'Equipo Norte' },
            { key: 'equipo-sur', name: 'Équipo Sur' },
          ],
          matches: [{ home: 'equipo-norte', away: 'equipo-sur', status: 'finished', score: { home: 2, away: 1 } }],
          standings: null,
        },
      ],
    });
    // The entries are kept for a corrected reimport.
    expect((field('Nombre del equipo 1') as HTMLInputElement).value).toBe('Equipo Norte');
  });

  it('shows a rejection of form data as form errors', async () => {
    renderPage({
      post: () =>
        problemResponse(400, 'IMPORT_REJECTED', {
          importErrors: [
            {
              location: 'form',
              record: '/selections/0/matches/0',
              field: 'score',
              problem: 'finished_without_score',
              message: 'A finished match needs a score',
            },
          ],
        }),
    });
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const { user, form } = await chooseForm();
    const field = (label: string) => within(form).getByLabelText(label);
    await user.type(field('Identificador de la competición'), 'liga-sintetica');
    await user.type(field('Nombre de la competición'), 'Liga Sintética');
    await user.type(field('Identificador de la temporada'), 'temporada-2026');
    await user.type(field('Nombre de la temporada'), 'Temporada 2026');
    await user.type(field('Identificador de la fase'), 'apertura');
    await user.type(field('Nombre de la fase'), 'Apertura');
    await user.click(within(form).getByRole('radio', { name: 'La fase completa (sin jornadas)' }));
    await user.type(field('Nombre del equipo 1'), 'Equipo Norte');
    await user.type(field('Nombre del equipo 2'), 'Equipo Sur');
    await user.selectOptions(field('Equipo local'), 'Equipo Norte');
    await user.selectOptions(field('Equipo visitante'), 'Equipo Sur');
    fireEvent.change(field('Fecha y hora de inicio'), { target: { value: '2026-10-05T18:00' } });
    await user.selectOptions(field('Estado'), 'Programado');
    await user.click(within(form).getByRole('button', { name: 'Importar datos del formulario' }));

    expect(await screen.findByText(/Los datos del formulario fueron rechazados completos/)).toBeTruthy();
    const table = screen.getByRole('table', { name: '1 error en la importación' });
    const cells = within(table).getAllByRole('cell');
    expect(cells[0]?.textContent).toBe('Entrada del formulario /selections/0/matches/0');
    expect(cells[0]?.querySelector('code')?.getAttribute('translate')).toBe('no');
    expect(cells[3]?.textContent).toBe(
      'Un partido finalizado necesita su marcador (score); no se completa automáticamente.',
    );
  });

  it('adds and removes rows with focus on the new field or the add button', async () => {
    renderPage();
    await screen.findByRole('table', { name: /Importaciones aplicadas/ });
    const { user, form } = await chooseForm();

    await user.click(within(form).getByRole('button', { name: 'Añadir equipo' }));
    expect(document.activeElement).toBe(within(form).getByLabelText('Nombre del equipo 3'));
    await user.click(within(form).getByRole('button', { name: 'Quitar el equipo 3' }));
    expect(within(form).queryByLabelText('Nombre del equipo 3')).toBeNull();
    expect(document.activeElement).toBe(within(form).getByRole('button', { name: 'Añadir equipo' }));
    expect((within(form).getByRole('button', { name: 'Quitar el equipo 2' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(within(form).getByRole('checkbox', { name: 'Incluir la clasificación de esta selección' }));
    await user.click(within(form).getByRole('button', { name: 'Añadir fila' }));
    expect(within(form).getByRole('group', { name: 'Fila 2 de la clasificación' })).toBeTruthy();
    expect(document.activeElement).toBe(
      within(within(form).getByRole('group', { name: 'Fila 2 de la clasificación' })).getByLabelText('Posición'),
    );
  });
});
