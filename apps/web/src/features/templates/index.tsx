/**
 * Templates feature (PD-ARCH-01G-A; AI design proposals since PD-ARCH-01G-B; structured visual templates and their
 * editor since PD-ARCH-01G-C), mounted by `app/routes.tsx` at `/templates/*`, separate from Mi marca. Two views under
 * the parent `/templates`, which opens the first:
 * - `create` («Crear plantilla»): the visual templates and the AI design proposals they start from;
 * - `engine` («Plantillas del motor»): the built-in templates of the slide engine.
 * The editor of a visual template is `visual/:templateId`. The pages and their API clients live with the brand, design
 * and visual-templates features; any other address under `/templates` shows the shared not-found page.
 */
import { Navigate, Route, Routes } from 'react-router';

import { NotFoundPage } from '../../app/pages';
import { brandApi } from '../brand/brandApi';
import { CreateTemplatesPage, EngineTemplatesPage } from '../brand/TemplatesPage';
import { defaultCompetitionsApi } from '../competitions/api';
import { designApi } from '../design/designApi';
import { TemplateEditorPage } from '../visual-templates/TemplateEditorPage';
import { visualTemplatesApi } from '../visual-templates/visualTemplatesApi';

export default function TemplatesFeature() {
  return (
    <Routes>
      <Route index element={<Navigate to="create" replace />} />
      <Route
        path="create"
        element={<CreateTemplatesPage api={brandApi} designApi={designApi} visualApi={visualTemplatesApi} />}
      />
      <Route path="engine" element={<EngineTemplatesPage api={brandApi} />} />
      <Route
        path="visual/:templateId"
        element={
          <TemplateEditorPage
            api={visualTemplatesApi}
            brandApi={brandApi}
            designApi={designApi}
            sportsApi={defaultCompetitionsApi}
          />
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
