import { resolve } from 'node:path';
import { ranksAfter } from '@ordo/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from '../../application/boards';
import { makeColumnUseCases } from '../../application/columns';
import { NotFoundError, RuleViolationError } from '../../application/errors';
import { makeTaskUseCases } from '../../application/tasks';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { uuidv7Generator } from '../ids';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';
import { tagRepository } from './tagRepository';
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
    tags: tagRepository(opened.db),
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
      { id: created.id, name: 'Perso', icon: 'kanban', color: 'blue', taskCount: 0 },
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
      tags: tagRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases({ ...ports, boards: boardRepository(opened.db) });
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
      tags: tagRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases({ ...ports, boards: boardRepository(opened.db) });
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
      tags: tagRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => Date.now() },
      ids: uuidv7Generator(),
    };
    const boards = makeBoardUseCases({ ...ports, boards: boardRepository(opened.db) });
    const tasks = makeTaskUseCases({ ...ports, boards: boardRepository(opened.db) });
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

describe('board management on SQLite', () => {
  function setup() {
    opened = openDatabase(':memory:', migrations);
    let now = 1_000;
    const ports = {
      columns: columnRepository(opened.db),
      tasks: taskRepository(opened.db),
      tags: tagRepository(opened.db),
      tx: sqliteTransactor(opened.sqlite),
      clock: { now: () => (now += 1) },
      ids: uuidv7Generator(),
    };
    const boardRepo = boardRepository(opened.db);
    const sqlite = opened.sqlite;
    return {
      boards: makeBoardUseCases({ ...ports, boards: boardRepo }),
      tasks: makeTaskUseCases({ ...ports, boards: boardRepo }),
      columns: makeColumnUseCases({ ...ports, boards: boardRepo }),
      taskRepo: ports.tasks,
      tx: ports.tx,
      sql: <T>(query: string, ...params: unknown[]) => sqlite.prepare(query).all(...params) as T[],
      run: (query: string, ...params: unknown[]) => void sqlite.prepare(query).run(...params),
    };
  }
  const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];

  it('creates with defaults that skip used colours, updates and moves (one row written)', () => {
    const { boards, sql } = setup();
    const a = boards.createBoard({ name: 'A', columnNames: COLUMN_NAMES, icon: 'rocket', color: 'blue' });
    const b = boards.createBoard({ name: 'B', columnNames: COLUMN_NAMES });
    const c = boards.createBoard({ name: 'C', columnNames: COLUMN_NAMES });
    expect([a.color, b.color, c.color]).toEqual(['blue', 'cyan', 'teal']);
    expect(boards.updateBoard({ id: b.id, name: 'Bis', color: 'red' })).toMatchObject({
      name: 'Bis',
      icon: 'kanban',
      color: 'red',
    });

    const before = sql<{ id: string; updated_at: number }>('select id, updated_at from board order by id');
    boards.moveBoard({ boardId: c.id, beforeId: null, afterId: a.id });
    const after = sql<{ id: string; updated_at: number }>('select id, updated_at from board order by id');
    expect(after.filter((row, i) => row.updated_at !== before[i]?.updated_at).map((r) => r.id)).toEqual([
      c.id,
    ]);
    expect(boards.listBoards().map((x) => x.name)).toEqual(['C', 'A', 'Bis']);
    expect(() => boards.updateBoard({ id: 'nope', name: 'X' })).toThrow(NotFoundError);
  });

  it('duplicates a board with its columns, live tasks and remapped sub-tasks', () => {
    const { boards, tasks, columns, taskRepo, sql, run } = setup();
    const source = boards.createBoard({
      name: 'Source',
      columnNames: COLUMN_NAMES,
      icon: 'eye',
      color: 'pink',
    });
    const next = boards.createBoard({ name: 'Next', columnNames: COLUMN_NAMES });
    const [todo, , done] = source.columns.map((col) => col.id) as [string, string, string];
    columns.updateColumn({ id: todo, displayLimit: 7, icon: 'star' });
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    const b = tasks.createTask({ columnId: done, title: 'B' });
    const gone = tasks.createTask({ columnId: todo, title: 'Gone' });
    tasks.deleteTask(gone.id);
    const archived = tasks.createTask({ columnId: todo, title: 'Archived' });
    run('update task set archived_at = 5 where id = ?', archived.id);
    run(`update task set description_json = '{"type":"doc"}', description_text = 'Notes' where id = ?`, a.id);
    const parent = taskRepo.findById(a.id)!;
    taskRepo.insert({ ...parent, id: 'sub-1', parentId: a.id, key: 50, title: 'Sub' });
    taskRepo.insert({ ...parent, id: 'sub-2', parentId: archived.id, key: 51, title: 'Orphan' });
    taskRepo.insert({ ...parent, id: 'sub-3', parentId: gone.id, key: 52, title: 'Orphan of deleted' });
    const originalRows = sql('select * from task order by id');

    const bare = boards.duplicateBoard({ id: source.id, name: 'Bare', includeTasks: false });
    const full = boards.duplicateBoard({ id: source.id, name: 'Full', includeTasks: true });
    expect(boards.listBoards().map((x) => x.name)).toEqual(['Source', 'Full', 'Bare', 'Next']);
    expect(bare).toMatchObject({ icon: 'eye', color: 'pink', taskCount: 0 });
    expect(full.taskCount).toBe(2);
    expect(boards.getBoard(next.id).name).toBe('Next');

    const strip = ({ id: _id, ...col }: { id: string }) => col;
    const sourceColumns = boards.getBoard(source.id).columns;
    expect(boards.getBoard(bare.id).columns.map(strip)).toEqual(sourceColumns.map(strip));
    const fullColumns = boards.getBoard(full.id).columns;
    expect(fullColumns.map(strip)).toEqual(sourceColumns.map(strip));
    expect(sql('select id from task where board_id = ?', bare.id)).toEqual([]);

    type Row = { id: string; column_id: string; parent_id: string | null; key: number; title: string };
    const copied = sql<Row & { description_text: string | null; completed_at: number | null }>(
      'select * from task where board_id = ? order by key',
      full.id,
    );
    expect(copied.map((t) => [t.title, t.key])).toEqual([
      ['A', a.key],
      ['B', b.key],
      ['Sub', 50],
    ]);
    const [copyA, copyB, copySub] = copied;
    expect(copyA).toMatchObject({ column_id: fullColumns[0]!.id, description_text: 'Notes' });
    expect(copyB).toMatchObject({ column_id: fullColumns[2]!.id, completed_at: b.completedAt });
    expect(copySub?.parent_id).toBe(copyA?.id);
    expect(copied.some((t) => [a.id, b.id, 'sub-1'].includes(t.id))).toBe(false);
    expect(sql('select * from task where board_id = ? order by id', source.id)).toEqual(
      originalRows.filter((r) => (r as { board_id: string }).board_id === source.id),
    );
  });

  it('duplicates a board of thousands of tasks (inserted in chunks)', () => {
    const { boards, taskRepo, sql, tx } = setup();
    const source = boards.createBoard({ name: 'Big', columnNames: COLUMN_NAMES });
    const columnId = source.columns[0]!.id;
    const ranks = ranksAfter(null, 3_000);
    tx.run(() =>
      taskRepo.insertMany(
        ranks.map((rank, i) => ({
          id: `big-${i}`,
          boardId: source.id,
          columnId,
          parentId: i % 10 === 9 ? `big-${i - 1}` : null,
          key: i + 1,
          title: `Task ${i}`,
          priority: 3,
          startDate: null,
          dueDate: null,
          rank,
          completedAt: null,
          createdAt: 1,
          updatedAt: 1,
          descriptionJson: null,
          descriptionText: null,
        })),
      ),
    );

    const copy = boards.duplicateBoard({ id: source.id, name: 'Big copy', includeTasks: true });
    expect(copy.taskCount).toBe(2_700);
    const counted = sql<{ n: number; subs: number }>(
      'select count(*) as n, count(parent_id) as subs from task where board_id = ?',
      copy.id,
    );
    expect(counted).toEqual([{ n: 3_000, subs: 300 }]);
    const orphans = sql(
      `select c.id from task c left join task p on p.id = c.parent_id
       where c.board_id = ? and c.parent_id is not null and (p.id is null or p.board_id <> c.board_id)`,
      copy.id,
    );
    expect(orphans).toEqual([]);
  });

  it('moves around an archived board and a deleted column sitting between the neighbours', () => {
    const { boards, columns, sql } = setup();
    const a = boards.createBoard({ name: 'A', columnNames: COLUMN_NAMES });
    const hidden = boards.createBoard({ name: 'Hidden', columnNames: COLUMN_NAMES });
    const b = boards.createBoard({ name: 'B', columnNames: COLUMN_NAMES });
    const c = boards.createBoard({ name: 'C', columnNames: COLUMN_NAMES });
    boards.archiveBoard(hidden.id);
    boards.moveBoard({ boardId: c.id, beforeId: a.id, afterId: b.id });
    expect(boards.listBoards().map((x) => x.name)).toEqual(['A', 'C', 'B']);
    const boardRanks = sql<{ rank: string }>('select rank from board').map((r) => r.rank);
    expect(new Set(boardRanks).size).toBe(4);

    const [todo, doing, done] = a.columns.map((col) => col.id) as [string, string, string];
    const gone = columns.createColumn({
      boardId: a.id,
      name: 'Jetée',
      icon: 'inbox',
      color: 'slate',
      category: 'todo',
      displayLimit: null,
    });
    columns.moveColumn({ columnId: gone.id, beforeId: todo, afterId: doing });
    columns.deleteColumn(gone.id);
    columns.moveColumn({ columnId: done, beforeId: todo, afterId: doing });
    expect(boards.getBoard(a.id).columns.map((col) => col.id)).toEqual([todo, done, doing]);
    const columnRanks = sql<{ rank: string }>('select rank from board_column where board_id = ?', a.id);
    expect(new Set(columnRanks.map((r) => r.rank)).size).toBe(4);
  });

  it('refuses to duplicate an archived board', () => {
    const { boards } = setup();
    const source = boards.createBoard({ name: 'Source', columnNames: COLUMN_NAMES });
    boards.archiveBoard(source.id);
    expect(() => boards.duplicateBoard({ id: source.id, name: 'Copy', includeTasks: false })).toThrow(
      RuleViolationError,
    );
    expect(boards.listBoards()).toEqual([]);
  });

  it('rolls back a duplication that fails half-way', () => {
    const { boards, tasks, run } = setup();
    const source = boards.createBoard({ name: 'Source', columnNames: COLUMN_NAMES });
    tasks.createTask({ columnId: source.columns[0]!.id, title: 'A' });
    run(`create trigger fail_tasks before insert on task begin select raise(abort, 'boom'); end`);
    expect(() => boards.duplicateBoard({ id: source.id, name: 'Copy', includeTasks: true })).toThrow();
    expect(boards.listBoards().map((x) => x.name)).toEqual(['Source']);
  });

  it('archives, lists archives newest first and restores at the end of the sidebar', () => {
    const { boards, tasks } = setup();
    const a = boards.createBoard({ name: 'A', columnNames: COLUMN_NAMES });
    const b = boards.createBoard({ name: 'B', columnNames: COLUMN_NAMES });
    boards.createBoard({ name: 'C', columnNames: COLUMN_NAMES });
    tasks.createTask({ columnId: a.columns[0]!.id, title: 'T' });

    const archivedA = boards.archiveBoard(a.id);
    const archivedB = boards.archiveBoard(b.id);
    expect(archivedB.archivedAt).toBeGreaterThan(archivedA.archivedAt);
    expect(boards.listBoards().map((x) => x.name)).toEqual(['C']);
    expect(boards.listArchivedBoards()).toEqual([
      { id: b.id, name: 'B', icon: 'kanban', color: b.color, taskCount: 0, archivedAt: archivedB.archivedAt },
      { id: a.id, name: 'A', icon: 'kanban', color: a.color, taskCount: 1, archivedAt: archivedA.archivedAt },
    ]);

    expect(boards.restoreBoard(a.id)).toMatchObject({ id: a.id, taskCount: 1 });
    expect(boards.listBoards().map((x) => x.name)).toEqual(['C', 'A']);
    expect(boards.listArchivedBoards().map((x) => x.name)).toEqual(['B']);
    expect(() => boards.archiveBoard('nope')).toThrow(NotFoundError);
    expect(() => boards.restoreBoard('nope')).toThrow(NotFoundError);
  });
});
