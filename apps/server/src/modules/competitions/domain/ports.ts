import type { LocalSeason, LocalTeam, SeasonParticipant } from './models.js';

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
  getSeason(competitionId: string, seasonId: string): LocalSeason;
  listTeams(): LocalTeam[];
  createTeam(input: NewManagedTeam): LocalTeam;
  getTeam(teamId: string): LocalTeam;
  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[];
  addParticipant(competitionId: string, seasonId: string, teamId: string, joinedAt: string): SeasonParticipant;
  removeParticipant(competitionId: string, seasonId: string, teamId: string): void;
}
