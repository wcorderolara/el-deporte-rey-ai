/**
 * Review feature (T39), mounted at "/projects/:projectId/review/*" by `app/routes.tsx`. The feature declares its own
 * nested routes: the review of the project's active draft at the index, and a not-found page for any other address.
 * The default export is the feature's root component.
 */
import { Route, Routes } from 'react-router';

import { ReviewNotFound, ReviewPage } from './ReviewPage';

export default function ReviewFeature() {
  return (
    <Routes>
      <Route index element={<ReviewPage />} />
      <Route path="*" element={<ReviewNotFound />} />
    </Routes>
  );
}
