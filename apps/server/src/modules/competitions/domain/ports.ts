import type { CompetitionTeam, LocalSeason, LocalTeam, SeasonParticipant } from './models.js';

export interface NewManagedSeason {
  id: string;
  competitionId: string;
  label: string;
  normalizedLabel: string;
  createdAt: string;
}

export interface NewManagedTeam {
  id: string;
  name: string;
  normalizedName: string;
  region: string | null;
  normalizedRegion: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * How an update treats the presentation name (TEAM-DISPLAY-01): `keep` leaves it as stored (imports and requests that
 * omit it), `clear` removes it and `set` stores the given, already normalized value.
 */
export type TeamDisplayNameChange =
  { readonly kind: 'keep' } | { readonly kind: 'clear' } | { readonly kind: 'set'; readonly value: string };

export interface CompetitionAdministrationPort {
  listSeasons(competitionId: string): LocalSeason[];
  createSeason(input: NewManagedSeason): LocalSeason;
  updateSeason(competitionId: string, seasonId: string, label: string, normalizedLabel: string): LocalSeason;
  getSeason(competitionId: string, seasonId: string): LocalSeason;
  listTeams(): LocalTeam[];
  /** Creates a team; `displayName` is the normalized presentation name or null (TEAM-DISPLAY-01). */
  createTeam(input: NewManagedTeam, displayName?: string | null): LocalTeam;
  updateTeam(
    teamId: string,
    input: Pick<NewManagedTeam, 'name' | 'normalizedName' | 'region' | 'normalizedRegion' | 'updatedAt'>,
    displayName?: TeamDisplayNameChange,
  ): LocalTeam;
  getTeam(teamId: string): LocalTeam;
  listCompetitionTeams(competitionId: string): CompetitionTeam[];
  addCompetitionTeam(competitionId: string, teamId: string, associatedAt: string): CompetitionTeam;
  createAndAssociateCompetitionTeam(competitionId: string, input: NewManagedTeam): CompetitionTeam;
  removeCompetitionTeam(competitionId: string, teamId: string): void;
  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[];
  addParticipant(competitionId: string, seasonId: string, teamId: string, joinedAt: string): SeasonParticipant;
  addParticipants(competitionId: string, seasonId: string, teamIds: string[], joinedAt: string): SeasonParticipant[];
  removeParticipant(competitionId: string, seasonId: string, teamId: string): void;
}
