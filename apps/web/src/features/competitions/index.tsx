import { Route, Routes } from 'react-router';
import { CompetitionDetailPage } from './pages/CompetitionDetailPage';
import { CompetitionListPage } from './pages/CompetitionListPage';
import { CompetitionTeamsPage } from './pages/CompetitionTeamsPage';
import { SeasonDetailPage } from './pages/SeasonDetailPage';
import { ImportPreviewPage } from './pages/ImportPreviewPage';

export default function CompetitionsFeature() {
  return (
    <Routes>
      <Route index element={<CompetitionListPage />} />
      <Route path=":competitionId" element={<CompetitionDetailPage />} />
      <Route path=":competitionId/import" element={<ImportPreviewPage />} />
      <Route path=":competitionId/teams" element={<CompetitionTeamsPage />} />
      <Route path=":competitionId/seasons/:seasonId" element={<SeasonDetailPage />} />
      <Route path=":competitionId/seasons/:seasonId/participants" element={<SeasonDetailPage />} />
      <Route path=":competitionId/seasons/:seasonId/calendar" element={<SeasonDetailPage />} />
      <Route path=":competitionId/seasons/:seasonId/calendar/stages/:stageId" element={<SeasonDetailPage />} />
      <Route
        path=":competitionId/seasons/:seasonId/calendar/stages/:stageId/rounds/:roundId"
        element={<SeasonDetailPage />}
      />
      <Route path=":competitionId/seasons/:seasonId/calendar/rounds/:roundId" element={<SeasonDetailPage />} />
      <Route path=":competitionId/seasons/:seasonId/calendar/unassigned" element={<SeasonDetailPage />} />
    </Routes>
  );
}
