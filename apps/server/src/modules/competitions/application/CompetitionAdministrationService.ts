import { displayValue, identityKey } from '../domain/identity.js';
import { CompetitionAdministrationError } from '../domain/errors.js';
import type { LocalSeason, LocalTeam, SeasonParticipant } from '../domain/models.js';
import type { CompetitionAdministrationPort } from '../domain/ports.js';

export interface CompetitionAdministrationOptions {
  readonly newId: () => string;
  readonly now: () => Date;
}

/** Use cases for local seasons, reusable teams and their season-scoped membership. */
export class CompetitionAdministrationService {
  readonly #repository: CompetitionAdministrationPort;
  readonly #newId: () => string;
  readonly #now: () => Date;

  constructor(repository: CompetitionAdministrationPort, options: CompetitionAdministrationOptions) {
    this.#repository = repository;
    this.#newId = options.newId;
    this.#now = options.now;
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

  listTeams(): LocalTeam[] {
    return this.#repository.listTeams();
  }
  getTeam(teamId: string): LocalTeam {
    return this.#repository.getTeam(teamId);
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

  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[] {
    return this.#repository.listParticipants(competitionId, seasonId);
  }
  addParticipant(competitionId: string, seasonId: string, teamId: string): SeasonParticipant {
    return this.#repository.addParticipant(competitionId, seasonId, teamId, this.#now().toISOString());
  }
  removeParticipant(competitionId: string, seasonId: string, teamId: string): void {
    this.#repository.removeParticipant(competitionId, seasonId, teamId);
  }
}
