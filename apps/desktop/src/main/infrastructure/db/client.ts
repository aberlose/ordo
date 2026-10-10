import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface OpenedDatabase {
  readonly sqlite: Database.Database;
  readonly db: Db;
  close(): void;
}

function pendingMigrations(sqlite: Database.Database, migrationsFolder: string): number {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
    entries: unknown[];
  };
  const table = sqlite
    .prepare("select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();
  const applied = table
    ? (sqlite.prepare('select count(*) as n from __drizzle_migrations').get() as { n: number }).n
    : 0;
  return journal.entries.length - applied;
}

/**
 * Opens (or creates) the SQLite file, applies pragmas and pending migrations.
 * Before migrating an existing database, a consistent snapshot is written next to it
 * (`VACUUM INTO`, includes the WAL), named after the time so it is never overwritten.
 */
export function openDatabase(
  file: string,
  migrationsFolder: string,
  now: () => number = Date.now,
): OpenedDatabase {
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');

  const hasTables =
    sqlite.prepare("select 1 from sqlite_master where type = 'table' limit 1").get() !== undefined;
  if (file !== ':memory:' && hasTables && pendingMigrations(sqlite, migrationsFolder) > 0) {
    sqlite.prepare('vacuum into ?').run(`${file}.before-migration-${now()}.bak`);
  }

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { sqlite, db, close: () => sqlite.close() };
}
