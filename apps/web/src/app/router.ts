import { createBrowserRouter } from 'react-router';

import { appRoutes } from './routes';

/** Browser router of the application (history API, same origin). */
export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
