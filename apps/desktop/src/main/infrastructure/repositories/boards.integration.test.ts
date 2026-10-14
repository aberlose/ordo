import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from '../../application/boards';
import { makeColumnUseCases } from '../../application/columns';
import { makeTaskUseCases } from '../../application/tasks';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { uuidv7Generator } from '../ids';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';
import { taskRepository } from './taskRepository';

const migrations = resolve(__dirname, '../db/migrations');
let opened: OpenedDatabase | undefined;

afterEach(() => opened?.close());

function useCases() {
  opened = openDatabase(':memory:', migrations);
  return makeBoardUseCases({
    boards: boardRepository(opened.db),
    columns: columnRepository(opened.db),
    tasks: taskRepository(opened.db),
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

describe('tasks on SQLite', () => {
  it('creates, updates, moves and soft-deletes tasks', () => {
    opened = openDatabase(':memory:', migrations);
    const ports = {
      columns: columnRepository(opened.db),
      tasks: taskRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases(ports);
    const board = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
    const [todo, , done] = board.columns.map((c) => c.id) as [string, string, string];

    const a = tasks.createTask({ columnId: todo, title: 'Relire' });
    const b = tasks.createTask({ columnId: todo, title: 'Démo' });
    tasks.updateTask({ id: a.id, priority: 5, startDate: '2026-10-02', dueDate: '2026-10-17' });
    const moved = tasks.updateTask({ id: b.id, columnId: done });

    const read = boards.getBoard(board.id);
    expect(read.taskCount).toBe(2);
    expect(read.tasks.find((t) => t.id === a.id)).toMatchObject({
      priority: 5,
      startDate: '2026-10-02',
      dueDate: '2026-10-17',
    });
    expect(moved.completedAt).not.toBeNull();

    tasks.deleteTask(a.id);
    expect(boards.getBoard(board.id).tasks.map((t) => t.id)).toEqual([b.id]);
    expect(tasks.createTask({ columnId: todo, title: 'Encore' }).key).toBe(3);
  });
});

describe('moves on SQLite', () => {
  it('reorders tasks and columns', () => {
    opened = openDatabase(':memory:', migrations);
    const ports = {
      columns: columnRepository(opened.db),
      tasks: taskRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases(ports);
    const columns = makeColumnUseCases({ ...ports, boards: boardRepository(opened.db) });
    const board = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
    const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    const b = tasks.createTask({ columnId: todo, title: 'B' });

    tasks.moveTask({ taskId: b.id, toColumnId: todo, beforeId: null, afterId: a.id });
    tasks.moveTask({ taskId: a.id, toColumnId: doing, beforeId: null, afterId: null });
    columns.moveColumn({ columnId: done, beforeId: null, afterId: todo });

    const read = boards.getBoard(board.id);
    expect(read.columns.map((c) => c.id)).toEqual([done, todo, doing]);
    expect(read.tasks.map((t) => [t.title, t.columnId])).toEqual(
      expect.arrayContaining([
        ['B', todo],
        ['A', doing],
      ]),
    );
  });
});

describe('column settings on SQLite', () => {
  it('creates, updates (completing tasks) and deletes a column with its tasks', () => {
    opened = openDatabase(':memory:', migrations);
    const ports = {
      columns: columnRepository(opened.db),
      tasks: taskRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases(ports);
    const columns = makeColumnUseCases({ ...ports, boards: boardRepository(opened.db) });
    const board = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
    const review = columns.createColumn({
      boardId: board.id,
      name: 'En revue',
      icon: 'eye',
      color: 'violet',
      category: 'in_progress',
      displayLimit: 5,
    });
    const task = tasks.createTask({ columnId: review.id, title: 'Relire' });
    columns.updateColumn({ id: review.id, category: 'done' });
    expect(boards.getBoard(board.id).tasks.find((t) => t.id === task.id)?.completedAt).not.toBeNull();
    expect(boards.getBoard(board.id).columns.at(-1)).toMatchObject({ name: 'En revue', displayLimit: 5 });

    expect(columns.deleteColumn(review.id).deletedTasks).toBe(1);
    const read = boards.getBoard(board.id);
    expect(read.columns).toHaveLength(3);
    expect(read.taskCount).toBe(0);
  });
});
