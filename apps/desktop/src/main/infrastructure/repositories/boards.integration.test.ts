import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from '../../application/boards';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { uuidv7Generator } from '../ids';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';

const migrations = resolve(__dirname, '../db/migrations');
let opened: OpenedDatabase | undefined;

afterEach(() => opened?.close());

function useCases() {
  opened = openDatabase(':memory:', migrations);
  return makeBoardUseCases({
    boards: boardRepository(opened.db),
    columns: columnRepository(opened.db),
    tx: sqliteTransactor(opened.sqlite),
    clock: { now: () => Date.now() },
    ids: uuidv7Generator(),
  });
}

describe('boards on SQLite', () => {
  it('migrates, creates and reads back a board with its columns', () => {
    const boards = useCases();
    const created = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
    const read = boards.getBoard(created.id);
    expect(read.columns.map((c) => c.category)).toEqual(['todo', 'in_progress', 'done']);
    expect(boards.listBoards()).toEqual([
      { id: created.id, name: 'Perso', icon: null, color: null, taskCount: 0 },
    ]);
  });

  it('rolls back the board when a column insert fails', () => {
    const boards = useCases();
    const db = opened!;
    db.sqlite.exec(
      `create trigger fail_columns before insert on board_column begin select raise(abort, 'boom'); end`,
    );
    expect(() => boards.createBoard({ name: 'X', columnNames: ['a', 'b', 'c'] })).toThrow();
    expect(boards.listBoards()).toEqual([]);
  });
});
