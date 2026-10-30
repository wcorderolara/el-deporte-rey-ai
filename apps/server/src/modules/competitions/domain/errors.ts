export type CompetitionAdministrationErrorCode =
  | 'competition_not_found'
  | 'season_not_found'
  | 'team_not_found'
  | 'participant_not_found'
  | 'duplicate_season'
  | 'duplicate_team'
  | 'duplicate_participant'
  | 'invalid_season_label'
  | 'invalid_team_name'
  | 'invalid_team_region';

/** Application-facing domain failure; the HTTP adapter maps this to the public problem contract. */
export class CompetitionAdministrationError extends Error {
  constructor(readonly code: CompetitionAdministrationErrorCode) {
    super(code);
    this.name = 'CompetitionAdministrationError';
  }
}
