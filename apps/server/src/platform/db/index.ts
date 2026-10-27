/**
 * Persistence platform (AD-05; data-model.md): the `Db` port, its `node:sqlite` adapter, the migration runner and the
 * repository helpers. Modules import from this file only.
 */
export type {
  Db,
  RunResult,
  SqlNamedParams,
  SqlOutputValue,
  SqlParams,
  SqlRow,
  SqlValue,
  Statement,
  TransactionWork,
} from './db.js';
export { constraintKind, DB_ERROR_CODES, DbError, type ConstraintKind, type DbErrorCode } from './errors.js';
export {
  appliedMigrations,
  defaultMigrationsDirectory,
  MIGRATION_FILE_PATTERN,
  openMigratedDatabase,
  readMigrations,
  runMigrations,
  SCHEMA_MIGRATIONS_DDL,
  type AppliedMigration,
  type MigrationFile,
  type MigrationReport,
  type RunMigrationsOptions,
} from './migrations.js';
export {
  DATABASE_FILE_NAME,
  DEFAULT_BUSY_TIMEOUT_MS,
  MEMORY_LOCATION,
  openDatabase,
  type OpenDatabaseOptions,
  type SqliteDatabase,
} from './sqlite.js';
export {
  fromSqlBoolean,
  MAX_PLACEHOLDERS,
  pickIdentifier,
  placeholders,
  readJsonColumn,
  readNullableJsonColumn,
  toSqlBoolean,
  writeJsonColumn,
} from './sql.js';
