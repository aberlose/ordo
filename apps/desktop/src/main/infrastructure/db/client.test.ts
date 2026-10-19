import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './client';

const migrations = resolve(__dirname, 'migrations');

const indexesOf = (opened: ReturnType<typeof openDatabase>, table: string) =>
  (opened.sqlite.pragma(`index_list('${table}')`) as { name: string }[]).map((i) => i.name);

/** A migrations folder holding only the first `count` migrations of the real one. */
function firstMigrations(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'ordo-migrations-'));
  mkdirSync(join(dir, 'meta'));
  const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  journal.entries = journal.entries.slice(0, count);
  for (const entry of journal.entries)
    copyFileSync(join(migrations, `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`));
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal));
  return dir;
}

describe('openDatabase', () => {
  it('creates the schema and does not back up when nothing is pending', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ordo-db-'));
    const file = join(dir, 'ordo.db');
    openDatabase(file, migrations).close();
    openDatabase(file, migrations).close();
    expect(existsSync(file)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith('.bak'))).toEqual([]);
  });

  it('adds the task_tag index to a database made by the first migration, after a backup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ordo-db-'));
    const file = join(dir, 'ordo.db');
    const old = openDatabase(file, firstMigrations(1));
    expect(indexesOf(old, 'task_tag')).not.toContain('task_tag_tag');
    old.close();

    const upgraded = openDatabase(file, migrations, () => 42);
    expect(indexesOf(upgraded, 'task_tag')).toContain('task_tag_tag');
    upgraded.close();
    expect(readdirSync(dir).filter((f) => f.endsWith('.bak'))).toEqual(['ordo.db.before-migration-42.bak']);
  });

  it('adds the attachment index to a database made by the first two migrations, keeping its rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ordo-db-'));
    const file = join(dir, 'ordo.db');
    const old = openDatabase(file, firstMigrations(2));
    expect(indexesOf(old, 'attachment')).not.toContain('attachment_task');
    old.sqlite.exec(`
      insert into board (id, name, rank, created_at, updated_at) values ('b', 'B', 'a', 1, 1);
      insert into board_column (id, board_id, name, color, category, rank, created_at, updated_at)
        values ('c', 'b', 'C', 'blue', 'todo', 'a', 1, 1);
      insert into task (id, board_id, column_id, key, title, rank, created_at, updated_at)
        values ('t', 'b', 'c', 1, 'T', 'a', 1, 1);
      insert into attachment (id, task_id, file_name, stored_path, created_at)
        values ('a', 't', 'a.pdf', 'a.pdf', 1);
    `);
    old.close();

    const upgraded = openDatabase(file, migrations, () => 43);
    expect(indexesOf(upgraded, 'attachment')).toContain('attachment_task');
    expect(upgraded.sqlite.prepare('select id from attachment').all()).toEqual([{ id: 'a' }]);
    upgraded.close();
    expect(readdirSync(dir).filter((f) => f.endsWith('.bak'))).toEqual(['ordo.db.before-migration-43.bak']);
  });
});
