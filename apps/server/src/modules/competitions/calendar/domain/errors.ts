export type CalendarErrorCode =
  | 'competition_not_found'
  | 'season_not_found'
  | 'stage_not_found'
  | 'round_not_found'
  | 'match_not_found'
  | 'team_not_found'
  | 'team_not_participant'
  | 'duplicate_stage'
  | 'duplicate_round'
  | 'duplicate_match'
  | 'invalid_calendar_name'
  | 'calendar_changed'
  | 'invalid_team_pair'
  | 'invalid_stage_round'
  | 'invalid_match_status'
  | 'invalid_match_scores'
  | 'round_in_use';

export class CalendarError extends Error {
  constructor(readonly code: CalendarErrorCode) {
    super(code);
    this.name = 'CalendarError';
  }
}
