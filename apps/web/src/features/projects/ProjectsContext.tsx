import { createContext, useContext, type ReactNode } from 'react';

import { defaultProjectsApi, type ProjectsApi } from './api';

/** Interval between two polls of an active run. */
export const DEFAULT_RUN_POLL_INTERVAL_MS = 2000;

export interface ProjectsDependencies {
  api: ProjectsApi;
  /** Interval between two polls of an active run, in milliseconds. */
  runPollIntervalMs: number;
}

const ProjectsContext = createContext<ProjectsDependencies>({
  api: defaultProjectsApi,
  runPollIntervalMs: DEFAULT_RUN_POLL_INTERVAL_MS,
});

/** Overrides the API and the poll interval of the feature (component tests inject a client with a fake fetch). */
export function ProjectsProvider({ value, children }: { value: ProjectsDependencies; children: ReactNode }) {
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjectsDependencies(): ProjectsDependencies {
  return useContext(ProjectsContext);
}
