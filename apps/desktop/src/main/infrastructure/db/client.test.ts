import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './client';

const migrations = resolve(__dirname, 'migrations');

describe('openDatabase', () => {
  it('creates the schema and does not back up when nothing is pending', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ordo-db-'));
    const file = join(dir, 'ordo.db');
    openDatabase(file, migrations).close();
    openDatabase(file, migrations).close();
    expect(existsSync(file)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith('.bak'))).toEqual([]);
  });
});
