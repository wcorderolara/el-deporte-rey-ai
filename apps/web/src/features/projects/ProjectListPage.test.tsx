/**
 * Project library (PD-ARCH-01F): a table by default and a card view over the same list, both with the two actions of
 * every project in any state (open its detail, delete it after confirmation), the deletion dialog with cancel,
 * loading, error and the immediate update of the list, and the dashboard's loading error. All data is synthetic.
 */
import type { ApprovalState, ProjectSummary, RunStatus } from '@edr/contracts';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeServer, json, PROJECT_ID, problem, renderApp, summaries } from './test/support';

afterEach(cleanup);

const LIST = 'GET /api/v1/projects';

function deletion(projectId: string): string {
  return `DELETE /api/v1/projects/${projectId}`;
}

function library(): HTMLElement {
  return screen.getByRole('region', { name: 'Tus proyectos' });
}

async function table(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: 'Proyectos e historial' });
}

describe('Project library: views (PD-ARCH-01F)', () => {
  it('opens in the table view with title, content type, sports context, state, date and actions', async () => {
    const server = fakeServer({ [LIST]: () => json({ projects: summaries }) });
    renderApp('/', server);

    const grid = await table();
    const rows = within(grid).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByRole('rowheader').textContent).toBe(summaries[0]!.title);
    expect(first.getByText('Carrusel de resultados')).toBeTruthy();
    expect(first.getByText('Copa Continental Demo · 2025-26 · Fase de liga · Jornada 3')).toBeTruthy();
    expect(first.getByText('Pendiente de revisión')).toBeTruthy();
    expect(first.getByRole('link', { name: `Ver contenido: ${summaries[0]!.title}` }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}`,
    );
    expect(first.getByRole('button', { name: `Eliminar: ${summaries[0]!.title}` })).toBeTruthy();
    const toggle = within(library()).getByRole('group', { name: 'Formato de visualización' });
    expect(within(toggle).getByRole('button', { name: 'Vista de tabla' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('list', { name: 'Proyectos e historial' })).toBeNull();
    expect(server.unexpected).toEqual([]);
  });

  it('switches to the card view with the same projects and the same actions', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [LIST]: () => json({ projects: summaries }) });
    renderApp('/', server);
    await table();

    await user.click(screen.getByRole('button', { name: 'Vista de tarjetas' }));

    expect(screen.queryByRole('table', { name: 'Proyectos e historial' })).toBeNull();
    const cards = within(screen.getByRole('list', { name: 'Proyectos e historial' })).getAllByRole('article');
    expect(cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual(
      summaries.map((summary) => summary.title),
    );
    for (const [index, card] of cards.entries()) {
      const summary = summaries[index]!;
      expect(
        within(card)
          .getByRole('link', { name: `Ver contenido: ${summary.title}` })
          .getAttribute('href'),
      ).toBe(`/projects/${summary.id}`);
      expect(within(card).getByRole('button', { name: `Eliminar: ${summary.title}` })).toBeTruthy();
    }
    expect(server.callsTo('GET', '/api/v1/projects')).toHaveLength(1);
  });

  it.each<[ApprovalState, RunStatus | null, string]>([
    ['no_draft', 'running', 'En generación'],
    ['no_draft', 'pending', 'En generación'],
    ['no_draft', 'failed', 'Generación fallida'],
    ['no_draft', null, 'En preparación'],
    ['in_review', 'completed', 'Pendiente de revisión'],
    ['final_approved', 'completed', 'Listo para descargar'],
    ['exported', 'completed', 'Exportado'],
  ])(
    'offers Ver contenido and Eliminar for a project %s with run %s (%s)',
    async (approvalState, latestRunStatus, label) => {
      const projects: ProjectSummary[] = [{ ...summaries[0]!, approvalState, latestRunStatus }];
      renderApp('/', fakeServer({ [LIST]: () => json({ projects }) }));
      const row = within((await table()).querySelector('tbody tr') as HTMLElement);
      expect(row.getByText(label)).toBeTruthy();
      // Whatever the state, the action opens the project detail, never the review or the exports.
      expect(row.getByRole('link', { name: /Ver contenido/ }).getAttribute('href')).toBe(`/projects/${PROJECT_ID}`);
      expect((row.getByRole('button', { name: /Eliminar/ }) as HTMLButtonElement).disabled).toBe(false);
    },
  );

  it('names the content type and context of a project generated from a local competition', async () => {
    const projects: ProjectSummary[] = [
      {
        ...summaries[0]!,
        sportsContext: {
          batchId: '00000000-0000-4000-8000-000000000071',
          itemId: '00000000-0000-4000-8000-000000000072',
          kind: 'match_result',
          competitionId: '00000000-0000-4000-8000-000000000073',
          competitionName: 'Liga Local',
          seasonId: '00000000-0000-4000-8000-000000000074',
          seasonLabel: '2026/27',
          stageId: null,
          stageName: null,
          roundId: '00000000-0000-4000-8000-000000000075',
          roundName: 'Jornada 12',
          matchIds: ['00000000-0000-4000-8000-000000000076'],
        },
      },
    ];
    renderApp('/', fakeServer({ [LIST]: () => json({ projects }) }));
    const row = within((await table()).querySelector('tbody tr') as HTMLElement);
    expect(row.getByText('Resultado individual')).toBeTruthy();
    expect(row.getByText('Liga Local · 2026/27 · Jornada 12')).toBeTruthy();
  });
});

describe('Project library: deletion (PD-ARCH-01F)', () => {
  it('asks for confirmation and deletes nothing when cancelled', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [LIST]: () => json({ projects: summaries }) });
    renderApp('/', server);
    await table();

    await user.click(screen.getByRole('button', { name: `Eliminar: ${summaries[0]!.title}` }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar proyecto' });
    expect(dialog.textContent).toContain(summaries[0]!.title);
    expect(dialog.textContent).toContain('Las competiciones, temporadas, equipos, partidos, resultados, plantillas');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);
    expect(within(await table()).getAllByRole('row')).toHaveLength(3);
  });

  it('deletes on confirmation, shows the progress and removes the project from the list at once', async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const server = fakeServer({
      [LIST]: () => json({ projects: summaries }),
      [deletion(PROJECT_ID)]: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    renderApp('/', server);
    await table();

    await user.click(screen.getByRole('button', { name: `Eliminar: ${summaries[0]!.title}` }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar proyecto' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar proyecto' }));
    const busy = within(dialog).getByRole('button', { name: /Eliminando proyecto/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    release(new Response(null, { status: 204 }));

    expect(await screen.findByText(`Se eliminó el proyecto «${summaries[0]!.title}».`)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([summaries[1]!.title]);
    const [call] = server.callsTo('DELETE', `/api/v1/projects/${PROJECT_ID}`);
    expect(call?.headers['X-EDR-Client']).toBe('web');
    expect(server.callsTo('GET', '/api/v1/projects')).toHaveLength(1);
  });

  it('warns that an active generation is cancelled and reports a refused deletion without closing', async () => {
    const user = userEvent.setup();
    const projects: ProjectSummary[] = [{ ...summaries[0]!, latestRunStatus: 'running', approvalState: 'no_draft' }];
    const server = fakeServer({
      [LIST]: () => json({ projects }),
      [deletion(PROJECT_ID)]: () => problem({ status: 409, code: 'RUN_IN_PROGRESS', detail: 'synthetic' }),
    });
    renderApp('/', server);
    await table();

    await user.click(screen.getByRole('button', { name: `Eliminar: ${summaries[0]!.title}` }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar proyecto' });
    expect(dialog.textContent).toContain('La generación en curso se cancelará antes de eliminarlo.');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar proyecto' }));

    expect(await within(dialog).findByText('No se pudo eliminar el proyecto')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Eliminar proyecto' })).toBeTruthy();
    expect(within(await table()).getAllByRole('row')).toHaveLength(2);
  });
});

describe('Project library: loading', () => {
  it('shows a safe Spanish connection error and retries the existing request', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const server = fakeServer({
      [LIST]: () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError('fake network failure');
        }
        return json({ projects: summaries });
      },
    });
    renderApp('/', server);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await table()).toBeTruthy();
    expect(attempts).toBe(2);
  });
});
