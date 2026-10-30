import type { ManagedCompetition } from '@edr/contracts';
import type { Db } from '../../platform/db/db.js';

interface CompetitionRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
function toDomain(row: CompetitionRow): ManagedCompetition {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class CompetitionRepository {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  create(item: ManagedCompetition): void {
    this.#db
      .prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run([item.id, item.name, item.createdAt, item.updatedAt]);
  }
  list(): ManagedCompetition[] {
    return this.#db
      .prepare<CompetitionRow>(
        'SELECT id, name, created_at, updated_at FROM competitions ORDER BY created_at DESC, id DESC',
      )
      .all()
      .map(toDomain);
  }
  get(id: string): ManagedCompetition | null {
    const row = this.#db
      .prepare<CompetitionRow>('SELECT id, name, created_at, updated_at FROM competitions WHERE id = ?')
      .get([id]);
    return row === undefined ? null : toDomain(row);
  }
}
