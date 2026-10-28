/**
 * Manual imports feature (T51), mounted by `app/routes.tsx` at `/imports/*`. Nested routes:
 * - `/imports`: the import forms (file and web form), the result of the last import, the history with the originals
 *   and the versions per selection;
 * - `/imports/:importId`: one applied import (getImport) with its original and selection versions;
 * - `/imports/versions/:versionId`: one version of a MANUAL_DATA selection (getManualVersion);
 * - any other address under `/imports` shows the shared not-found page.
 */
import { Route, Routes } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { ImportDetailPage } from './ImportDetailPage';
import { importsApi } from './importsApi';
import { ImportsPage } from './ImportsPage';
import { VersionPage } from './VersionPage';

export default function ImportsFeature() {
  return (
    <Routes>
      <Route index element={<ImportsPage api={importsApi} />} />
      <Route path="versions/:versionId" element={<VersionPage api={importsApi} />} />
      <Route path=":importId" element={<ImportDetailPage api={importsApi} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
