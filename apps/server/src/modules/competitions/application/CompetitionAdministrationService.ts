import { displayValue, identityKey } from '../domain/identity.js';
import { CompetitionAdministrationError } from '../domain/errors.js';
import type { LocalSeason, LocalTeam, SeasonParticipant } from '../domain/models.js';
import type { CompetitionAdministrationPort } from '../domain/ports.js';

export interface CompetitionAdministrationOptions {
  readonly newId: () => string;
  readonly now: () => Date;
  readonly transaction?: <T>(action: () => T) => T;
  readonly onManualMutation?: (mutation: {
    competitionId: string | null;
    entityType: 'season' | 'team';
    entityId: string;
    fields: Readonly<Record<string, string | null>>;
  }) => void;
}

/** Use cases for local seasons, reusable teams and their season-scoped membership. */
export class CompetitionAdministrationService {
  readonly #repository: CompetitionAdministrationPort;
  readonly #newId: () => string;
  readonly #now: () => Date;
  readonly #transaction: <T>(action: () => T) => T;
  readonly #onManualMutation?: CompetitionAdministrationOptions['onManualMutation'];

  constructor(repository: CompetitionAdministrationPort, options: CompetitionAdministrationOptions) {
    this.#repository = repository;
    this.#newId = options.newId;
    this.#now = options.now;
    this.#transaction = options.transaction ?? ((action) => action());
    this.#onManualMutation = options.onManualMutation;
  }

  listSeasons(competitionId: string): LocalSeason[] {
    return this.#repository.listSeasons(competitionId);
  }
  getSeason(competitionId: string, seasonId: string): LocalSeason {
    return this.#repository.getSeason(competitionId, seasonId);
  }
  createSeason(competitionId: string, rawLabel: string): LocalSeason {
    const label = displayValue(rawLabel);
    if (label.length === 0) throw new CompetitionAdministrationError('invalid_season_label');
    const normalizedLabel = identityKey(label);
    const at = this.#now().toISOString();
    return this.#repository.createSeason({
      id: this.#newId(),
      competitionId,
      label,
      normalizedLabel,
      createdAt: at,
    });
  }
  updateSeason(competitionId: string, seasonId: string, rawLabel: string): LocalSeason {
    const label = displayValue(rawLabel);
    if (!label) throw new CompetitionAdministrationError('invalid_season_label');
    return this.#transaction(() => {
      const updated = this.#repository.updateSeason(competitionId, seasonId, label, identityKey(label));
      this.#onManualMutation?.({ competitionId, entityType: 'season', entityId: seasonId, fields: { label } });
      return updated;
    });
  }

  listTeams(): LocalTeam[] {
    return this.#repository.listTeams();
  }
  getTeam(teamId: string): LocalTeam {
    return this.#repository.getTeam(teamId);
  }
  listCompetitionTeams(competitionId: string) {
    return this.#repository.listCompetitionTeams(competitionId);
  }
  addCompetitionTeam(competitionId: string, teamId: string) {
    return this.#repository.addCompetitionTeam(competitionId, teamId, this.#now().toISOString());
  }
  removeCompetitionTeam(competitionId: string, teamId: string): void {
    this.#repository.removeCompetitionTeam(competitionId, teamId);
  }
  createAndAssociateCompetitionTeam(competitionId: string, rawName: string, rawRegion: string | null) {
    const name = displayValue(rawName);
    const region = rawRegion === null ? null : displayValue(rawRegion);
    if (!name) throw new CompetitionAdministrationError('invalid_team_name');
    if (region !== null && !region) throw new CompetitionAdministrationError('invalid_team_region');
    const at = this.#now().toISOString();
    return this.#repository.createAndAssociateCompetitionTeam(competitionId, {
      id: this.#newId(),
      name,
      normalizedName: identityKey(name),
      region,
      normalizedRegion: region === null ? '' : identityKey(region),
      createdAt: at,
      updatedAt: at,
    });
  }
  createTeam(rawName: string, rawRegion: string | null): LocalTeam {
    const name = displayValue(rawName);
    const region = rawRegion === null ? null : displayValue(rawRegion);
    if (name.length === 0) throw new CompetitionAdministrationError('invalid_team_name');
    if (region !== null && region.length === 0) throw new CompetitionAdministrationError('invalid_team_region');
    const at = this.#now().toISOString();
    return this.#repository.createTeam({
      id: this.#newId(),
      name,
      normalizedName: identityKey(name),
      region,
      normalizedRegion: region === null ? '' : identityKey(region),
      createdAt: at,
      updatedAt: at,
    });
  }

  updateTeam(teamId: string, rawName: string, rawRegion: string | null): LocalTeam {
    const name = displayValue(rawName);
    const region = rawRegion === null ? null : displayValue(rawRegion);
    if (!name) throw new CompetitionAdministrationError('invalid_team_name');
    if (region !== null && !region) throw new CompetitionAdministrationError('invalid_team_region');
    return this.#transaction(() => {
      const updated = this.#repository.updateTeam(teamId, {
        name,
        normalizedName: identityKey(name),
        region,
        normalizedRegion: region === null ? '' : identityKey(region),
        updatedAt: this.#now().toISOString(),
      });
      this.#onManualMutation?.({ competitionId: null, entityType: 'team', entityId: teamId, fields: { name, region } });
      return updated;
    });
  }

  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[] {
    return this.#repository.listParticipants(competitionId, seasonId);
  }
  addParticipant(competitionId: string, seasonId: string, teamId: string): SeasonParticipant {
    return this.#repository.addParticipant(competitionId, seasonId, teamId, this.#now().toISOString());
  }
  addParticipants(competitionId: string, seasonId: string, teamIds: string[]): SeasonParticipant[] {
    return this.#repository.addParticipants(competitionId, seasonId, teamIds, this.#now().toISOString());
  }
  removeParticipant(competitionId: string, seasonId: string, teamId: string): void {
    this.#repository.removeParticipant(competitionId, seasonId, teamId);
  }
}
