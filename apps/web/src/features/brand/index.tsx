/**
 * Brand and templates feature (T36), mounted by `app/routes.tsx` at `/brand/*`. The page is the index of the
 * feature's nested routes; any other address under `/brand` shows the shared not-found page.
 */
import { Route, Routes } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { brandApi } from './brandApi';
import { BrandPage } from './BrandPage';

export default function BrandFeature() {
  return (
    <Routes>
      <Route index element={<BrandPage api={brandApi} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
