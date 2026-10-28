/**
 * Facts and verification feature, mounted by the route table at `/projects/:projectId/runs/:runId/facts/*`
 * (`app/routes.tsx`). Its nested routes are declared here: the index shows the facts of the run; any deeper address
 * is not found.
 */
import { Route, Routes } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { FactsPage } from './FactsPage';

export default function FactsFeature() {
  return (
    <Routes>
      <Route index element={<FactsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
