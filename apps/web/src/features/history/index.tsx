/**
 * Export, history and traceability feature, mounted by the route table at `/projects/:projectId/exports/*`
 * (`app/routes.tsx`). Its nested routes are declared here:
 * - index: export action for a final-approved carousel and the project's export history (R-218, R-220, R-269);
 * - `:exportId`: an export reopened with the exact exported slides and caption (R-220);
 * - `:exportId/slides/:position/trace`: trace of one exported slide (R-221, R-287);
 * - any other address is not found.
 * There is no publication action anywhere (R-219) and no deletion (OD-08).
 */
import { Route, Routes, useParams } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { ExportDetailPage } from './ExportDetailPage';
import { ExportsPage } from './ExportsPage';
import { GlobalExportHistoryPage } from './GlobalExportHistoryPage';
import { TracePage } from './TracePage';

export default function HistoryFeature() {
  const { projectId } = useParams();
  if (projectId === undefined) {
    return <GlobalExportHistoryPage />;
  }
  return (
    <Routes>
      <Route index element={<ExportsPage />} />
      <Route path=":exportId" element={<ExportDetailPage />} />
      <Route path=":exportId/slides/:position/trace" element={<TracePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
