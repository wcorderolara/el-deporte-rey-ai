/**
 * Brand feature, Mi marca (T36, PD-ARCH-01G-A), mounted by `app/routes.tsx` at `/brand/*`. The page is the index of
 * the feature's nested routes; any other address under `/brand` shows the shared not-found page. The templates moved
 * to `/templates`: the former `/brand#brand-templates-title` link (the engine templates) is sent to
 * `/templates/engine`.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { brandApi } from './brandApi';
import { BrandPage } from './BrandPage';

/** Fragment of the former templates section of this page. */
const FORMER_TEMPLATES_HASH = '#brand-templates-title';

function BrandIndex() {
  const { hash } = useLocation();
  return hash === FORMER_TEMPLATES_HASH ? <Navigate to="/templates/engine" replace /> : <BrandPage api={brandApi} />;
}

export default function BrandFeature() {
  return (
    <Routes>
      <Route index element={<BrandIndex />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
