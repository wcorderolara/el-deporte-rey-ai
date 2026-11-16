/**
 * Projects module (architecture.md sections 4, 6 and 15.2; contracts/provider-ports.md section 3): settings and
 * catalogue routes, projects and runs routes, and the workflow runner of the container.
 *
 * - `onStartup` (registry order, after migrations, before listen) upserts the configured sources into `sources` and
 *   fails runs left `pending` or `running` by a stopped process with `interrupted` (AD-10).
 * - The runner reads the stages registered by the modules (`ServerModule.stages`) when a run executes, so stage
 *   modules are picked up without changes here. The registry is imported lazily to avoid an import cycle
 *   (`registry.ts` imports this module).
 * - Content generation batches (PD-ARCH-01E-A) create projects and start runs through the same runner.
 * - One runner per container; it is shut down (active runs cancelled and failed with `interrupted`) when the
 *   Fastify instance closes.
 */
import type { AppContainer } from '../../container.js';
import { type StageProvider, WorkflowRunner, failInterruptedRuns } from '../../workflow/index.js';
import type { ServerModule } from '../module-kit.js';

import { registerCatalogRoutes } from './catalog.js';
import { registerContentBatchRoutes } from './content-batches/routes.js';
import { ContentBatchService } from './content-batches/service.js';
import { registerProjectRoutes } from './routes.js';
import { ProjectsService } from './service.js';

export { MAX_TITLE_LENGTH, ProjectsService, projectTitle } from './service.js';
export { type ProjectRecord, ProjectRepository } from './repository.js';

/** The stages of every registered module, read from the static registry. */
export const registeredStages: StageProvider = async () => {
  const { serverModules } = await import('../registry.js');
  return serverModules.flatMap((serverModule) => serverModule.stages ?? []);
};

export interface ProjectsModuleOptions {
  /** Stage provider; default the stages of the static module registry. Tests pass fake stages. */
  readonly stages?: StageProvider;
  /** ID generator for projects, runs and stage runs; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

export interface ProjectsModule extends ServerModule {
  /** The workflow runner of a container (created on first use). */
  runnerFor(container: AppContainer): WorkflowRunner;
}

export function createProjectsModule(options: ProjectsModuleOptions = {}): ProjectsModule {
  const runners = new WeakMap<AppContainer, WorkflowRunner>();

  const runnerFor = (container: AppContainer): WorkflowRunner => {
    let runner = runners.get(container);
    if (runner === undefined) {
      runner = new WorkflowRunner({
        container,
        stages: options.stages ?? registeredStages,
        ...(options.newId === undefined ? {} : { newId: options.newId }),
      });
      runners.set(container, runner);
    }
    return runner;
  };

  const serviceFor = (container: AppContainer): ProjectsService =>
    new ProjectsService({
      container,
      runner: runnerFor(container),
      ...(options.newId === undefined ? {} : { newId: options.newId }),
    });

  return {
    name: 'projects',
    runnerFor,
    onStartup: async (container) => {
      serviceFor(container).syncSources();
      const interrupted = failInterruptedRuns(container);
      if (interrupted > 0) {
        container.logger.warn({ runs: interrupted }, 'interrupted workflow runs marked failed');
      }
      await Promise.resolve();
    },
    routes: async (app, container) => {
      const service = serviceFor(container);
      registerCatalogRoutes(app, container);
      registerProjectRoutes(app, service);
      registerContentBatchRoutes(
        app,
        new ContentBatchService({
          container,
          runner: runnerFor(container),
          ...(options.newId === undefined ? {} : { newId: options.newId }),
        }),
      );
      app.addHook('onClose', async () => {
        const runner = runners.get(container);
        runners.delete(container);
        await runner?.shutdown();
      });
      await Promise.resolve();
    },
  };
}

/** The projects module of the static registry. */
export const serverModule: ServerModule = createProjectsModule();
