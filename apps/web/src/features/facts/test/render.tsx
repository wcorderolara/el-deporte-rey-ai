/** Renders the facts feature at its route with an API client built on a fake fetch (no network). */
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createApiClient, type FetchFunction } from '../../../api/client';
import { FactsApiContext } from '../api';
import FactsFeature from '../index';
import { PROJECT_ID, RUN_ID } from './fixtures';

export const FACTS_PATH = `/projects/${PROJECT_ID}/runs/${RUN_ID}/facts`;

export function renderFacts(fetch: FetchFunction, path: string = FACTS_PATH) {
  const client = createApiClient({ fetch });
  const router = createMemoryRouter(
    [
      {
        path: 'projects/:projectId/runs/:runId/facts/*',
        element: (
          <FactsApiContext value={client}>
            <FactsFeature />
          </FactsApiContext>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

/** Waits until the facts are shown (the summary line appears). */
export async function waitForFacts(): Promise<void> {
  await screen.findByTestId('facts-summary');
}

/** The card of a fact, by fact key. */
export function factCard(factKey: string): HTMLElement {
  const card = document.querySelector<HTMLElement>(`[data-testid="fact"][data-fact-key="${factKey}"]`);
  if (card === null) {
    throw new Error(`no card for ${factKey}`);
  }
  return card;
}
