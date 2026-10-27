/**
 * Unit tests of the `node:sqlite` adapter on private in-memory databases: statements with bound parameters, the
 * synchronous `BEGIN IMMEDIATE` transaction helper (T10-F15), nested savepoints and constraint classification.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { constraintKind, DbError } from './errors.js';
import { MEMORY_LOCATION, openDatabase, type SqliteDatabase } from './sqlite.js';

interface ItemRow {
  id: string;
  n: number;
}

let db: SqliteDatabase;

function count(): number {
  return db.prepare<{ n: number }>('SELECT count(*) AS n FROM items').get()?.n ?? -1;
}

function insert(id: string, n = 1): void {
  db.prepare('INSERT INTO items (id, n) VALUES (?, ?)').run([id, n]);
}

beforeEach(() => {
  db = openDatabase({ location: MEMORY_LOCATION });
  db.execScript(
    'CREATE TABLE parents (id TEXT PRIMARY KEY) STRICT;' +
      'CREATE TABLE items (id TEXT PRIMARY KEY, n INTEGER NOT NULL CHECK (n >= 0), ' +
      'parent_id TEXT NULL REFERENCES parents, tag TEXT NULL UNIQUE) STRICT;',
  );
});

afterEach(() => {
  db.close();
});

describe('openDatabase', () => {
  it('enables foreign keys on every connection', () => {
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
  });

  it('refuses an invalid busy timeout without opening a database', () => {
    expect(() => openDatabase({ location: MEMORY_LOCATION, busyTimeoutMs: -1 })).toThrow(DbError);
  });

  it('refuses double-quoted string literals', () => {
    expect(() => db.prepare('SELECT "not a column"').get()).toThrow();
  });
});

describe('statements', () => {
  it('binds positional and named parameters and returns rows', () => {
    insert('a', 1);
    db.prepare('INSERT INTO items (id, n) VALUES (:id, :n)').run({ id: 'b', n: 2 });
    db.prepare('INSERT INTO items (id, n) VALUES ($id, $n)').run({ $id: 'c', $n: 3 });

    expect(db.prepare<ItemRow>('SELECT id, n FROM items WHERE id = ?').get(['b'])).toEqual({ id: 'b', n: 2 });
    expect(db.prepare<ItemRow>('SELECT id, n FROM items ORDER BY id').all()).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]);
    expect(db.prepare<ItemRow>('SELECT id, n FROM items WHERE id = ?').get(['zzz'])).toBeUndefined();
  });

  it('reports changes of a data-changing statement', () => {
    insert('a');
    insert('b');
    expect(db.prepare('UPDATE items SET n = n + 1').run()).toMatchObject({ changes: 2 });
  });

  it('treats a bound value as data, never as SQL', () => {
    const hostile = "x'); DROP TABLE items; --";
    insert(hostile);
    expect(db.prepare<ItemRow>('SELECT id, n FROM items').all()).toEqual([{ id: hostile, n: 1 }]);
  });

  it('reuses a cached statement for the same SQL text', () => {
    const sql = 'SELECT count(*) AS n FROM items';
    insert('a');
    expect(db.prepare<{ n: number }>(sql).get()).toEqual({ n: 1 });
    insert('b');
    expect(db.prepare<{ n: number }>(sql).get()).toEqual({ n: 2 });
  });

  it('cannot be used after close', () => {
    const other = openDatabase({ location: MEMORY_LOCATION });
    other.close();
    expect(() => other.prepare('SELECT 1')).toThrow();
  });
});

describe('transaction', () => {
  it('commits the work and returns its result', () => {
    const result = db.transaction(() => {
      expect(db.inTransaction).toBe(true);
      insert('a');
      insert('b');
      return 'done';
    });
    expect(result).toBe('done');
    expect(db.inTransaction).toBe(false);
    expect(count()).toBe(2);
  });

  it('rolls back every write when the work throws and rethrows the same error', () => {
    const failure = new Error('guard refused');
    expect(() =>
      db.transaction(() => {
        insert('a');
        throw failure;
      }),
    ).toThrow(failure);
    expect(db.inTransaction).toBe(false);
    expect(count()).toBe(0);
  });

  it('rolls back when a write inside the work violates a constraint', () => {
    expect(() =>
      db.transaction(() => {
        insert('a');
        insert('b', -1);
      }),
    ).toThrow();
    expect(count()).toBe(0);
  });

  it('refuses asynchronous work and rolls back the writes made before its first await (T10-F15)', async () => {
    let settled: Promise<unknown> = Promise.resolve();
    const asyncWork = async (): Promise<void> => {
      insert('before-await');
      await Promise.resolve();
    };
    let caught: unknown;
    try {
      db.transaction(() => {
        settled = asyncWork();
        return settled as never;
      });
    } catch (error) {
      caught = error;
    }
    await settled;
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe('transaction_async_work');
    expect(db.inTransaction).toBe(false);
    expect(count()).toBe(0);
  });

  it('rejects asynchronous work at compile time', () => {
    const typeCheckOnly = (): void => {
      // @ts-expect-error -- TransactionWork does not accept a function that returns a promise.
      db.transaction(async () => 1);
    };
    expect(typeof typeCheckOnly).toBe('function');
  });

  it('refuses any thenable result', () => {
    expect(() => db.transaction(() => ({ then: () => undefined }) as never)).toThrow(DbError);
    expect(db.inTransaction).toBe(false);
  });

  it('commits a nested transaction with the outer one', () => {
    db.transaction(() => {
      insert('outer');
      db.transaction(() => insert('inner'));
    });
    expect(count()).toBe(2);
  });

  it('rolls back only the nested savepoint when nested work fails and the outer work recovers', () => {
    db.transaction(() => {
      insert('outer');
      expect(() =>
        db.transaction(() => {
          insert('inner');
          throw new Error('inner failure');
        }),
      ).toThrow('inner failure');
      expect(db.inTransaction).toBe(true);
      insert('after');
    });
    expect(db.prepare<{ id: string }>('SELECT id FROM items ORDER BY id').all()).toEqual([
      { id: 'after' },
      { id: 'outer' },
    ]);
  });

  it('rolls back everything when the outer work fails after a nested success', () => {
    expect(() =>
      db.transaction(() => {
        db.transaction(() => insert('inner'));
        throw new Error('outer failure');
      }),
    ).toThrow('outer failure');
    expect(count()).toBe(0);
  });
});

describe('constraintKind', () => {
  function errorOf(action: () => void): unknown {
    try {
      action();
    } catch (error) {
      return error;
    }
    throw new Error('expected the action to throw');
  }

  it('classifies SQLite constraint failures', () => {
    insert('a');
    db.prepare("UPDATE items SET tag = 't' WHERE id = 'a'").run();
    expect(constraintKind(errorOf(() => insert('b', -1)))).toBe('check');
    expect(constraintKind(errorOf(() => db.prepare('INSERT INTO items (id) VALUES (?)').run(['c'])))).toBe('not_null');
    expect(constraintKind(errorOf(() => insert('a')))).toBe('primary_key');
    expect(constraintKind(errorOf(() => db.prepare("INSERT INTO items (id, n, tag) VALUES ('d', 1, 't')").run()))).toBe(
      'unique',
    );
    expect(
      constraintKind(errorOf(() => db.prepare("INSERT INTO items (id, n, parent_id) VALUES ('e', 1, 'none')").run())),
    ).toBe('foreign_key');
    expect(constraintKind(errorOf(() => db.prepare("INSERT INTO items (id, n) VALUES ('f', 'many')").run()))).toBe(
      'datatype',
    );
  });

  it('returns null for other errors', () => {
    expect(constraintKind(errorOf(() => db.prepare('SELECT * FROM missing_table').get()))).toBeNull();
    expect(constraintKind(new Error('plain'))).toBeNull();
    expect(constraintKind(null)).toBeNull();
    expect(constraintKind('text')).toBeNull();
  });
});
