import type Database from 'better-sqlite3';
import type { Transactor } from '../../application/ports';

export function sqliteTransactor(sqlite: Database.Database): Transactor {
  return { run: (work) => sqlite.transaction(work)() };
}
