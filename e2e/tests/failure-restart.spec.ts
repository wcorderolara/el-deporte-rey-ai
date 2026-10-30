/**
 * Simulated source failure, restart and a blocked approval naming the fact (R-203, R-206), on a journey-owned server
 * (e2e/support/scenario-server.ts) restarted on one data directory with committed DEMO_DATA scenarios:
 *
 * 1. `single-source` (demo-b lacks match ld26-1-01 of Liga Demo matchday 1): the project is created.
 * 2. demo-a `provider-unavailable` (every call of the primary source fails): the run fails at "Obtención de datos"
 *    with its reason, the later stages are skipped, and a new run can be started.
 * 3. `single-source` again (the source recovered): the restarted run completes. The facts of match ld26-1-01 are
 *    unverified (awaiting independent verification), so approving the slide that uses them is refused with the facts
 *    named, while a result slide that does not use them can be approved, and the final approval stays unavailable.
 */
import {
  STAGES,
  approveElement,
  createProject,
  elementNames,
  openReview,
  runRegion,
  runToEnd,
  stageStatus,
} from '../support/app.js';
import { expect, test } from '../support/scenario-server.js';

const SINGLE_SOURCE = { 'demo-a': 'single-source', 'demo-b': 'single-source' } as const;
const PRIMARY_UNAVAILABLE = { 'demo-a': 'provider-unavailable', 'demo-b': 'single-source' } as const;

test.describe('Research failure and restart (journey-owned server)', () => {
  test('a simulated source failure, a restart after recovery, and a blocked approval naming the fact', async ({
    page,
    scenarioServer,
  }) => {
    test.setTimeout(240_000);

    await scenarioServer.restart(SINGLE_SOURCE);
    const projectId = await createProject(page, {
      competition: /^Liga Demo/,
      season: '2026/27 (actual)',
      stage: 'Temporada Regular',
      matchday: 'Jornada 1',
    });
    await runToEnd(page, 1);

    // The project was saved while its source was available. A later retry encounters a source outage.
    await page.goto('about:blank');
    await scenarioServer.restart(PRIMARY_UNAVAILABLE);
    await page.goto(`/projects/${projectId}`);
    await runToEnd(page, 2, 'fallida');
    const research = stageStatus(page, 'Obtención de datos');
    await expect(research.getByRole('cell').first()).toHaveText(/Fallida/);
    await expect(research.getByRole('cell').last()).toContainText('La fuente de datos no está disponible.');
    for (const stage of STAGES.slice(1)) {
      await expect(stageStatus(page, stage).getByRole('cell').first()).toHaveText(/Omitida/);
    }
    const run = runRegion(page);
    await expect(run).toContainText('La ejecución falló. Puede iniciar una nueva ejecución completa.');
    await expect(run.getByRole('button', { name: /^(Iniciar|Reiniciar) ejecución completa$/ })).toBeEnabled();

    // The source recovers; research is started again and completes (R-203).
    await page.goto('about:blank');
    await scenarioServer.restart(SINGLE_SOURCE);
    await page.goto(`/projects/${projectId}`);
    await runToEnd(page, 3);
    for (const stage of STAGES) {
      await expect(stageStatus(page, stage).getByRole('cell').first()).toHaveText(/Completada/);
    }

    // The facts of the match missing from demo-b are unverified, awaiting independent verification.
    await page.getByRole('link', { name: 'Datos y verificación (ejecución 3)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datos y verificación' })).toBeVisible();
    await expect(
      page.getByText(/^\d+ datos: \d+ verificados, [1-9]\d* sin verificar, 0 aprobados manualmente/),
    ).toBeVisible();

    // Review: the slide using the unverified score is blocked with the facts named; another can be approved (R-206).
    await openReview(page, projectId);
    const names = await elementNames(page);
    const blockedNames: string[] = [];
    const approvableResults: string[] = [];
    for (const name of names) {
      const blockedPanel = page.getByRole('region', { name: `Datos que bloquean la aprobación: ${name}`, exact: true });
      if ((await blockedPanel.count()) > 0) {
        blockedNames.push(name);
      } else if (name.endsWith(': Resultado')) {
        approvableResults.push(name);
      }
    }
    const blockedResults = blockedNames.filter((name) => name.endsWith(': Resultado'));
    expect(blockedResults).toHaveLength(1);
    expect(approvableResults.length).toBeGreaterThan(0);

    const blockedSlide = blockedResults[0] ?? '';
    const panel = page.getByRole('region', { name: `Datos que bloquean la aprobación: ${blockedSlide}`, exact: true });
    const blockingFacts = panel.getByRole('list', { name: 'Datos que bloquean la aprobación' }).getByRole('listitem');
    await expect(blockingFacts.filter({ hasText: /^Marcador: \d+-\d+/ })).toHaveCount(1);
    for (const fact of await blockingFacts.all()) {
      await expect(fact).toContainText('Motivo del bloqueo: Dato sin verificar');
    }
    const blockedActions = page.getByRole('group', { name: `Acciones: ${blockedSlide}`, exact: true });
    await expect(blockedActions.getByRole('button', { name: 'Aprobar esta versión' })).toBeDisabled();
    await expect(page.getByRole('article', { name: blockedSlide, exact: true })).toContainText(
      'usa datos que no son publicables',
    );

    // Content not using the unverified fact can still be approved.
    await approveElement(page, approvableResults[0] ?? '');

    const finalRegion = page.getByRole('region', { name: 'Aprobación final del carrusel' });
    await expect(finalRegion.getByRole('button', { name: 'Dar la aprobación final' })).toBeDisabled();
    await expect(finalRegion.getByRole('listitem').filter({ hasText: `${blockedSlide}: ` })).toBeVisible();
  });
});
