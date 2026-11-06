/**
 * Templates feature (PD-ARCH-01G-A), mounted by `app/routes.tsx` at `/templates/*`, separate from Mi marca. The page
 * and its API client live with the brand feature, which owns the template and brand-asset endpoints; any other
 * address under `/templates` shows the shared not-found page.
 */
import { Route, Routes } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { brandApi } from '../brand/brandApi';
import { TemplatesPage } from '../brand/TemplatesPage';

export default function TemplatesFeature() {
  return (
    <Routes>
      <Route index element={<TemplatesPage api={brandApi} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
