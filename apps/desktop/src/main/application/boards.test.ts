import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { makeColumnUseCases } from './columns';
import { NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTaskUseCases } from './tasks';

let repos: ReturnType<typeof inMemoryRepositories>;
let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let columns: ReturnType<typeof makeColumnUseCases>;

beforeEach(() => {
  repos = inMemoryRepositories();
  deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, ...deps });
  tasks = makeTaskUseCases({ ...repos, ...deps });
  columns = makeColumnUseCases({ ...repos, ...deps });
});

const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];
const newBoard = (name = 'Perso') => boards.createBoard({ name, columnNames: COLUMN_NAMES });
const names = () => boards.listBoards().map((b) => b.name);

describe('board use cases', () => {
  it('creates a board with the three default columns in order', () => {
    const board = newBoard();
    expect(board.name).toBe('Perso');
    expect(board.columns.map((c) => [c.name, c.category])).toEqual([
      ['À faire', 'todo'],
      ['En cours', 'in_progress'],
      ['Terminé', 'done'],
    ]);
  });

  it('lists boards in creation order', () => {
    newBoard('A');
    newBoard('B');
    expect(names()).toEqual(['A', 'B']);
  });

  it('fails on an unknown board', () => {
    expect(() => boards.getBoard('nope')).toThrow(NotFoundError);
  });
});

describe('create a board', () => {
  it('keeps the picked icon and colour and normalises the name', () => {
    const board = boards.createBoard({
      name: '  Projet   Ordo ',
      columnNames: COLUMN_NAMES,
      icon: 'rocket',
      color: 'violet',
    });
    expect(board).toMatchObject({ name: 'Projet Ordo', icon: 'rocket', color: 'violet' });
  });

  it('defaults to the board icon and the first colour no sidebar board uses', () => {
    boards.createBoard({ name: 'A', columnNames: COLUMN_NAMES, color: 'slate' });
    const first = newBoard('B');
    expect(first).toMatchObject({ icon: 'kanban', color: 'blue' });
    expect(newBoard('C').color).toBe('cyan');
  });

  it('ignores archived boards when picking the default colour', () => {
    const a = newBoard('A');
    boards.archiveBoard(a.id);
    expect(newBoard('B').color).toBe(a.color);
  });

  it('refuses a name that is empty once normalised', () => {
    expect(() => boards.createBoard({ name: '   ', columnNames: COLUMN_NAMES })).toThrow(RuleViolationError);
  });
});

describe('update a board', () => {
  it('renames and changes the icon and colour', () => {
    const board = newBoard();
    expect(boards.updateBoard({ id: board.id, name: ' Maison ' })).toMatchObject({ name: 'Maison' });
    const updated = boards.updateBoard({ id: board.id, icon: 'house', color: 'green' });
    expect(updated).toEqual({ id: board.id, name: 'Maison', icon: 'house', color: 'green', taskCount: 0 });
    expect(boards.listBoards()[0]).toEqual(updated);
  });

  it('fails on an unknown board', () => {
    expect(() => boards.updateBoard({ id: 'nope', name: 'X' })).toThrow(NotFoundError);
  });
});

describe('move a board', () => {
  it('ranks the board between its new neighbours', () => {
    const a = newBoard('A');
    const b = newBoard('B');
    const c = newBoard('C');
    boards.moveBoard({ boardId: c.id, beforeId: null, afterId: a.id });
    expect(names()).toEqual(['C', 'A', 'B']);
    boards.moveBoard({ boardId: c.id, beforeId: a.id, afterId: b.id });
    expect(names()).toEqual(['A', 'C', 'B']);
    expect(boards.moveBoard({ boardId: a.id, beforeId: b.id, afterId: null }).name).toBe('A');
    expect(names()).toEqual(['C', 'B', 'A']);
  });

  it('ranks around an archived board sitting between the neighbours', () => {
    const a = newBoard('A');
    const hidden = newBoard('Hidden');
    const b = newBoard('B');
    const c = newBoard('C');
    boards.archiveBoard(hidden.id);
    const hiddenRank = repos.boards.findById(hidden.id)!.rank;

    const between = boards.moveBoard({ boardId: c.id, beforeId: a.id, afterId: b.id });
    expect(repos.boards.findById(between.id)!.rank).not.toBe(hiddenRank);
    expect(names()).toEqual(['A', 'C', 'B']);

    // Only `after` given: ranked between the true previous board (the archived one) and B.
    boards.moveBoard({ boardId: a.id, beforeId: null, afterId: c.id });
    boards.moveBoard({ boardId: c.id, beforeId: null, afterId: b.id });
    const cRank = repos.boards.findById(c.id)!.rank;
    expect(cRank).not.toBe(hiddenRank);
    expect(cRank > hiddenRank && cRank < repos.boards.findById(b.id)!.rank).toBe(true);
    expect(names()).toEqual(['A', 'C', 'B']);
    expect(new Set(boards.listBoards().map((x) => repos.boards.findById(x.id)!.rank)).size).toBe(3);
  });

  it('rejects bad neighbours', () => {
    const a = newBoard('A');
    const b = newBoard('B');
    const c = newBoard('C');
    expect(() => boards.moveBoard({ boardId: a.id, beforeId: 'nope', afterId: null })).toThrow(NotFoundError);
    expect(() => boards.moveBoard({ boardId: a.id, beforeId: a.id, afterId: null })).toThrow(
      RuleViolationError,
    );
    expect(() => boards.moveBoard({ boardId: a.id, beforeId: c.id, afterId: b.id })).toThrow(
      RuleViolationError,
    );
    expect(() => boards.moveBoard({ boardId: a.id, beforeId: null, afterId: null })).toThrow(
      RuleViolationError,
    );
    boards.archiveBoard(c.id);
    expect(() => boards.moveBoard({ boardId: a.id, beforeId: c.id, afterId: null })).toThrow(
      RuleViolationError,
    );
    expect(() => boards.moveBoard({ boardId: c.id, beforeId: null, afterId: a.id })).toThrow(
      RuleViolationError,
    );
  });
});

describe('duplicate a board', () => {
  /** A board with a custom column, top-level tasks, a sub-task, a deleted and an archived task. */
  function seeded() {
    const board = newBoard('Source');
    boards.updateBoard({ id: board.id, icon: 'rocket', color: 'violet' });
    const [todo, , done] = board.columns.map((c) => c.id) as [string, string, string];
    const review = columns.createColumn({
      boardId: board.id,
      name: 'En revue',
      icon: 'eye',
      color: 'pink',
      category: 'in_progress',
      displayLimit: 5,
    });
    const deletedColumn = columns.createColumn({
      boardId: board.id,
      name: 'Jetée',
      icon: 'inbox',
      color: 'slate',
      category: 'todo',
      displayLimit: null,
    });
    columns.deleteColumn(deletedColumn.id);
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    tasks.updateTask({ id: a.id, priority: 5, startDate: '2026-10-01', dueDate: '2026-10-20' });
    repos.testing.describeTask(a.id, '{"type":"doc"}', 'Notes');
    const b = tasks.createTask({ columnId: done, title: 'B' });
    const gone = tasks.createTask({ columnId: review.id, title: 'Deleted' });
    tasks.deleteTask(gone.id);
    const archived = tasks.createTask({ columnId: review.id, title: 'Archived' });
    repos.testing.archiveTask(archived.id, deps.clock.now());
    const record = repos.tasks.findById(a.id)!;
    repos.tasks.insert({ ...record, id: 'sub-a', parentId: a.id, key: 10, title: 'Sub A', rank: 'a' });
    repos.tasks.insert({ ...record, id: 'sub-of-archived', parentId: archived.id, key: 11, title: 'Orphan' });
    repos.tasks.insert({
      ...record,
      id: 'sub-of-deleted',
      parentId: gone.id,
      key: 12,
      title: 'Orphan of deleted',
    });
    return { board: boards.getBoard(board.id), a, b };
  }

  it('copies the board right after the original, with its columns and settings', () => {
    newBoard('First');
    const { board } = seeded();
    newBoard('Last');
    const copy = boards.duplicateBoard({ id: board.id, name: ' Copie ', includeTasks: false });
    expect(copy).toMatchObject({ name: 'Copie', icon: 'rocket', color: 'violet', taskCount: 0 });
    expect(names()).toEqual(['First', 'Source', 'Copie', 'Last']);
    const read = boards.getBoard(copy.id);
    const strip = ({ id: _id, ...c }: { id: string }) => c;
    expect(read.columns.map(strip)).toEqual(board.columns.map(strip));
    expect(read.columns.map((c) => c.name)).toEqual(['À faire', 'En cours', 'Terminé', 'En revue']);
    expect(read.columns.some((c) => board.columns.some((o) => o.id === c.id))).toBe(false);
    expect(read.tasks).toEqual([]);
  });

  it('copies the live tasks and sub-tasks into the matching columns', () => {
    const { board, a } = seeded();
    const copy = boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    expect(copy.taskCount).toBe(2);
    const copied = repos.testing.allTasks(copy.id);
    expect(copied.map((t) => t.title).sort()).toEqual(['A', 'B', 'Sub A']);
    const copyA = copied.find((t) => t.title === 'A')!;
    expect(copyA).toMatchObject({
      key: a.key,
      priority: 5,
      startDate: '2026-10-01',
      dueDate: '2026-10-20',
      rank: a.rank,
      descriptionJson: '{"type":"doc"}',
      descriptionText: 'Notes',
    });
    expect(copyA.id).not.toBe(a.id);
    const copyColumns = boards.getBoard(copy.id).columns;
    expect(copyA.columnId).toBe(copyColumns[0]!.id);
    expect(copied.find((t) => t.title === 'B')).toMatchObject({
      columnId: copyColumns[2]!.id,
      completedAt: deps.clock.now(),
    });
    expect(copied.find((t) => t.title === 'Sub A')!.parentId).toBe(copyA.id);
  });

  it('leaves the original untouched', () => {
    const { board } = seeded();
    const before = repos.testing.allTasks(board.id);
    boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    expect(boards.getBoard(board.id)).toEqual(board);
    expect(repos.testing.allTasks(board.id)).toEqual(before);
  });

  it('drops a live sub-task whose parent is deleted', () => {
    const { board } = seeded();
    // The orphan is live on the source board, so it is a candidate for the copy.
    expect(repos.testing.allTasks(board.id).some((t) => t.id === 'sub-of-deleted')).toBe(true);
    const copy = boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    const copied = repos.testing.allTasks(copy.id);
    expect(copied.some((t) => t.title === 'Orphan of deleted' || t.key === 12)).toBe(false);
    expect(copied.every((t) => t.parentId === null || copied.some((p) => p.id === t.parentId))).toBe(true);
  });

  it('refuses to duplicate an archived board', () => {
    const { board } = seeded();
    boards.archiveBoard(board.id);
    expect(() => boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true })).toThrow(
      RuleViolationError,
    );
    expect(names()).toEqual([]);
  });

  it('fails on an unknown board', () => {
    expect(() => boards.duplicateBoard({ id: 'nope', name: 'X', includeTasks: true })).toThrow(NotFoundError);
  });
});

describe('archive and restore a board', () => {
  it('removes an archived board from the sidebar and lists the newest archive first', () => {
    const a = newBoard('A');
    const b = newBoard('B');
    newBoard('C');
    tasks.createTask({ columnId: a.columns[0]!.id, title: 'T' });
    deps.setNow(1_000);
    expect(boards.archiveBoard(a.id)).toEqual({ id: a.id, archivedAt: 1_000 });
    deps.setNow(2_000);
    boards.archiveBoard(b.id);
    expect(names()).toEqual(['C']);
    expect(boards.listArchivedBoards()).toEqual([
      expect.objectContaining({ name: 'B', archivedAt: 2_000, taskCount: 0 }),
      expect.objectContaining({ name: 'A', archivedAt: 1_000, taskCount: 1 }),
    ]);
  });

  it('keeps the first archive date when archiving twice', () => {
    const a = newBoard('A');
    deps.setNow(1_000);
    boards.archiveBoard(a.id);
    deps.setNow(2_000);
    expect(boards.archiveBoard(a.id).archivedAt).toBe(1_000);
  });

  it('restores a board at the end of the sidebar', () => {
    const a = newBoard('A');
    newBoard('B');
    boards.archiveBoard(a.id);
    newBoard('C');
    expect(boards.restoreBoard(a.id)).toMatchObject({ id: a.id, name: 'A' });
    expect(names()).toEqual(['B', 'C', 'A']);
    expect(boards.listArchivedBoards()).toEqual([]);
  });

  it('leaves a sidebar board in place when restoring it', () => {
    const a = newBoard('A');
    newBoard('B');
    boards.restoreBoard(a.id);
    expect(names()).toEqual(['A', 'B']);
  });

  it('fails on unknown boards', () => {
    expect(() => boards.archiveBoard('nope')).toThrow(NotFoundError);
    expect(() => boards.restoreBoard('nope')).toThrow(NotFoundError);
  });
});
