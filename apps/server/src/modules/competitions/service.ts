import { randomUUID } from 'node:crypto';
import { ManagedCompetitionCreateSchema, type ManagedCompetition, type ManagedCompetitionCreate } from '@edr/contracts';
import { HttpProblem } from '../../platform/http/problem.js';
import type { AppContainer } from '../../container.js';
import { CompetitionRepository } from './repository.js';

export interface CompetitionServiceOptions {
  readonly newId?: () => string;
  readonly now?: () => Date;
}

export class CompetitionService {
  readonly #repository: CompetitionRepository;
  readonly #newId: () => string;
  readonly #now: () => Date;
  constructor(container: AppContainer, options: CompetitionServiceOptions = {}) {
    this.#repository = new CompetitionRepository(container.db);
    this.#newId = options.newId ?? randomUUID;
    this.#now = options.now ?? (() => container.clock.now());
  }
  list(): ManagedCompetition[] {
    return this.#repository.list();
  }
  get(id: string): ManagedCompetition {
    const item = this.#repository.get(id);
    if (item === null) throw new HttpProblem(404, 'NOT_FOUND', 'The competition does not exist.');
    return item;
  }
  create(input: ManagedCompetitionCreate): ManagedCompetition {
    const name = ManagedCompetitionCreateSchema.parse(input).name.trim();
    const normalizedName = ManagedCompetitionCreateSchema.parse({ name }).name;
    const at = this.#now().toISOString();
    const item: ManagedCompetition = { id: this.#newId(), name: normalizedName, createdAt: at, updatedAt: at };
    this.#repository.create(item);
    return item;
  }
}
