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

export interface CompetitionAdministrationPort {
  listSeasons(competitionId: string): LocalSeason[];
  createSeason(input: NewManagedSeason): LocalSeason;
  updateSeason(competitionId: string, seasonId: string, label: string, normalizedLabel: string): LocalSeason;
  getSeason(competitionId: string, seasonId: string): LocalSeason;
  listTeams(): LocalTeam[];
  createTeam(input: NewManagedTeam): LocalTeam;
  updateTeam(
    teamId: string,
    input: Pick<NewManagedTeam, 'name' | 'normalizedName' | 'region' | 'normalizedRegion' | 'updatedAt'>,
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
