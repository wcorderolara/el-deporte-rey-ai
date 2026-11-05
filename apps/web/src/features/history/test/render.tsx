/** Renders the history feature at its route with an API client built on a fake fetch (no network). */
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createApiClient, type FetchFunction } from '../../../api/client';
import { HistoryApiContext } from '../api';
import HistoryFeature from '../index';
import { EXPORT_ID, PROJECT_ID } from './fixtures';

export const EXPORTS_PATH = `/projects/${PROJECT_ID}/exports`;
/** Export history of the project: the history section of its detail (PD-ARCH-01F). */
export const PROJECT_HISTORY_PATH = `/projects/${PROJECT_ID}#project-exports`;
export const GLOBAL_EXPORTS_PATH = '/exports';
export const DETAIL_PATH = `${EXPORTS_PATH}/${EXPORT_ID}`;
export const tracePathFor = (position: number | string): string => `${DETAIL_PATH}/slides/${position}/trace`;

export function renderHistory(fetch: FetchFunction, path: string = EXPORTS_PATH) {
  const client = createApiClient({ fetch });
  const router = createMemoryRouter(
    [
      {
        path: 'exports/*',
        element: (
          <HistoryApiContext value={client}>
            <HistoryFeature />
          </HistoryApiContext>
        ),
      },
      {
        path: 'projects/:projectId/exports/*',
        element: (
          <HistoryApiContext value={client}>
            <HistoryFeature />
          </HistoryApiContext>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return { ...render(<RouterProvider router={router} />), router };
}
