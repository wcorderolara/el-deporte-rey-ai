/**
 * Route table of the web app (`architecture.md` section 3: `app/` shell and routes, `features/*`).
 *
 * Feature contract: each `features/<name>/index.tsx` default-exports its root component and is loaded lazily. Every
 * feature is mounted under a path ending in a splat (`/*`), so the feature declares its own nested routes with
 * `<Routes>` inside its directory without changing this table. The project list is the index route: the app opens
 * directly on it, with no login (R-235).
 */
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

import { AppShell } from './AppShell';
import { NotFoundPage, RootErrorPage, RouteErrorPage, RouteLoading } from './pages';

interface FeatureModule {
  default: ComponentType;
}

function lazyFeature(load: () => Promise<FeatureModule>): RouteObject['lazy'] {
  return async () => ({ Component: (await load()).default });
}

const projects = lazyFeature(() => import('../features/projects'));
const facts = lazyFeature(() => import('../features/facts'));
const review = lazyFeature(() => import('../features/review'));
const history = lazyFeature(() => import('../features/history'));
const brand = lazyFeature(() => import('../features/brand'));
const imports = lazyFeature(() => import('../features/imports'));

/** Paths of the feature mount points (without the splat). */
export const featurePaths = {
  projectList: '/',
  projects: '/projects',
  facts: (projectId: string, runId: string): string =>
    `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/facts`,
  review: (projectId: string): string => `/projects/${encodeURIComponent(projectId)}/review`,
  history: (projectId: string): string => `/projects/${encodeURIComponent(projectId)}/exports`,
  brand: '/brand',
  imports: '/imports',
} as const;

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: RootErrorPage,
    HydrateFallback: RouteLoading,
    children: [
      {
        ErrorBoundary: RouteErrorPage,
        children: [
          { index: true, lazy: projects },
          { path: 'projects/*', lazy: projects },
          { path: 'projects/:projectId/runs/:runId/facts/*', lazy: facts },
          { path: 'projects/:projectId/review/*', lazy: review },
          { path: 'projects/:projectId/exports/*', lazy: history },
          { path: 'brand/*', lazy: brand },
          { path: 'imports/*', lazy: imports },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
