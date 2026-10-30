import { Route, Routes } from 'react-router';
import { CompetitionDetailPage } from './pages/CompetitionDetailPage';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { SeasonDetailPage } from './pages/SeasonDetailPage';

export default function CompetitionsFeature() {
  return (
    <Routes>
      <Route index element={<CompetitionListPage />} />
      <Route path=":competitionId" element={<CompetitionDetailPage />} />
      <Route path=":competitionId/seasons/:seasonId" element={<SeasonDetailPage />} />
    </Routes>
  );
}
