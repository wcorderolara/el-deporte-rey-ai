/**
 * Brand feature, Mi marca (T36, PD-ARCH-01G-A), mounted by `app/routes.tsx` at `/brand/*`. Two views under the parent
 * `/brand`, which opens the first:
 * - `resources` («Recursos»): the brand library;
 * - `identity` («Identidad visual»): palette, typography and the descriptive notes of the brand.
 * Any other address under `/brand` shows the shared not-found page. The templates moved to `/templates`: the former
 * `/brand#brand-templates-title` link (the engine templates) is sent to `/templates/engine`.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { brandApi } from './brandApi';
import { BrandIdentityPage, BrandResourcesPage } from './BrandPage';

/** Fragment of the former templates section of this page. */
const FORMER_TEMPLATES_HASH = '#brand-templates-title';

function BrandIndex() {
  const { hash } = useLocation();
  return <Navigate to={hash === FORMER_TEMPLATES_HASH ? '/templates/engine' : 'resources'} replace />;
}

export default function BrandFeature() {
  return (
    <Routes>
      <Route index element={<BrandIndex />} />
      <Route path="resources" element={<BrandResourcesPage api={brandApi} />} />
      <Route path="identity" element={<BrandIdentityPage api={brandApi} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
