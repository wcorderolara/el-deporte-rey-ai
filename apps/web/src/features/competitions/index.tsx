import { Route, Routes } from 'react-router';
import { CompetitionDetailPage } from './pages/CompetitionDetailPage';
import { CompetitionListPage } from './pages/CompetitionListPage';

export default function CompetitionsFeature() {
  return (
    <Routes>
      <Route index element={<CompetitionListPage />} />
      <Route path=":competitionId" element={<CompetitionDetailPage />} />
    </Routes>
  );
}
