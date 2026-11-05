/**
 * Projects feature (T28): the project list is the home page (R-235), mounted at "/" and at "/projects/*" by
 * `app/routes.tsx`. Under "/projects/*" the feature declares its own routes: the list, the create form ("new") and
 * the project detail (":projectId"), and the content generation from a local competition ("generate") with its
 * batch result ("batches/:batchId", PD-ARCH-01E-A). The default export is the feature's root component.
 */
import { Route, Routes, useParams } from 'react-router';

import { ContentBatchPage } from './ContentBatchPage';
import { CreateProjectPage } from './CreateProjectPage';
import { GenerateContentPage } from './GenerateContentPage';
import { ProjectDetailPage, ProjectNotFound } from './ProjectDetailPage';
import { ProjectListPage } from './ProjectListPage';

export default function ProjectsFeature() {
  const splat = useParams()['*'];
  // At "/" (the index route) there is no splat and no nested route to resolve.
  if (splat === undefined) {
    return <ProjectListPage />;
  }
  return (
    <Routes>
      <Route index element={<ProjectListPage />} />
      <Route path="new" element={<CreateProjectPage />} />
      <Route path="generate" element={<GenerateContentPage />} />
      <Route path="batches/:batchId" element={<ContentBatchPage />} />
      <Route path=":projectId" element={<ProjectDetailPage />} />
      <Route path="*" element={<ProjectNotFound />} />
    </Routes>
  );
}
