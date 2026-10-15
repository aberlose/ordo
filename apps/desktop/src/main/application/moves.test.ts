import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { makeColumnUseCases } from './columns';
import { NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import type { TaskRepository } from './ports';
import { makeTaskUseCases } from './tasks';

let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let columns: ReturnType<typeof makeColumnUseCases>;
let writes: string[];
let repos: ReturnType<typeof inMemoryRepositories>;

beforeEach(() => {
  repos = inMemoryRepositories();
  writes = [];
  const spied: TaskRepository = {
    ...repos.tasks,
    update: (id, patch) => {
      writes.push(id);
      repos.tasks.update(id, patch);
    },
  };
  const deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, tasks: spied, ...deps });
  tasks = makeTaskUseCases({ ...repos, tasks: spied, ...deps });
  columns = makeColumnUseCases({ ...repos, ...deps });
});

function setup() {
  const board = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
  const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
  const [a, b, c] = ['A', 'B', 'C'].map((title) => tasks.createTask({ columnId: todo, title }));
  const d = tasks.createTask({ columnId: doing, title: 'D' });
  return { board, todo, doing, done, a: a!, b: b!, c: c!, d };
}

const titles = (boardId: string, columnId: string) =>
  boards
    .getBoard(boardId)
    .tasks.filter((t) => t.columnId === columnId)
    .sort((x, y) => (x.rank < y.rank ? -1 : 1))
    .map((t) => t.title);

describe('moveTask', () => {
  it('reorders within a column by writing one row', () => {
    const { board, todo, a, b, c } = setup();
    writes = [];
    tasks.moveTask({ taskId: c.id, toColumnId: todo, beforeId: a.id, afterId: b.id });
    expect(titles(board.id, todo)).toEqual(['A', 'C', 'B']);
    expect(writes).toEqual([c.id]);
  });

  it('moves to the top, the end, another column and an empty column', () => {
    const { board, todo, doing, done, a, b, c, d } = setup();
    tasks.moveTask({ taskId: c.id, toColumnId: todo, beforeId: null, afterId: a.id });
    expect(titles(board.id, todo)).toEqual(['C', 'A', 'B']);
    tasks.moveTask({ taskId: c.id, toColumnId: todo, beforeId: b.id, afterId: null });
    expect(titles(board.id, todo)).toEqual(['A', 'B', 'C']);
    const moved = tasks.moveTask({ taskId: a.id, toColumnId: doing, beforeId: d.id, afterId: null });
    expect(titles(board.id, doing)).toEqual(['D', 'A']);
    expect(moved.completedAt).toBeNull();
    const finished = tasks.moveTask({ taskId: b.id, toColumnId: done, beforeId: null, afterId: null });
    expect(titles(board.id, done)).toEqual(['B']);
    expect(finished.completedAt).not.toBeNull();
  });

  it('refuses stale or foreign neighbours', () => {
    const { todo, doing, a, b, c, d } = setup();
    expect(() => tasks.moveTask({ taskId: c.id, toColumnId: todo, beforeId: b.id, afterId: a.id })).toThrow(
      RuleViolationError,
    );
    expect(() => tasks.moveTask({ taskId: a.id, toColumnId: doing, beforeId: b.id, afterId: null })).toThrow(
      RuleViolationError,
    );
    expect(() => tasks.moveTask({ taskId: a.id, toColumnId: todo, beforeId: a.id, afterId: null })).toThrow(
      RuleViolationError,
    );
    expect(() => tasks.moveTask({ taskId: d.id, toColumnId: 'nope', beforeId: null, afterId: null })).toThrow(
      NotFoundError,
    );
  });
});

describe('moveColumn', () => {
  it('reorders columns between neighbours', () => {
    const { board, todo, doing, done } = setup();
    columns.moveColumn({ columnId: done, beforeId: null, afterId: todo });
    expect(boards.getBoard(board.id).columns.map((c) => c.id)).toEqual([done, todo, doing]);
    columns.moveColumn({ columnId: done, beforeId: doing, afterId: null });
    expect(boards.getBoard(board.id).columns.map((c) => c.id)).toEqual([todo, doing, done]);
  });

  it('refuses columns of another board and out-of-order neighbours', () => {
    const { todo, doing, done } = setup();
    const other = boards.createBoard({ name: 'Autre', columnNames: ['1', '2', '3'] });
    expect(() =>
      columns.moveColumn({ columnId: todo, beforeId: other.columns[0]!.id, afterId: null }),
    ).toThrow(RuleViolationError);
    expect(() => columns.moveColumn({ columnId: todo, beforeId: done, afterId: doing })).toThrow(
      RuleViolationError,
    );
  });

  it('ranks against the true neighbours when the client is stale', () => {
    const { board, todo, a, b, c } = setup();
    // The client believes A is last; B and C actually follow it.
    const moved = tasks.moveTask({ taskId: c.id, toColumnId: todo, beforeId: a.id, afterId: null });
    expect(moved.rank).not.toBe(b.rank);
    expect(titles(board.id, todo)).toEqual(['A', 'C', 'B']);
    // Still movable between its neighbours afterwards.
    tasks.moveTask({ taskId: b.id, toColumnId: todo, beforeId: a.id, afterId: c.id });
    expect(titles(board.id, todo)).toEqual(['A', 'B', 'C']);
  });

  it('refuses to move a sub-task on the board', () => {
    const { todo, a } = setup();
    const sub = {
      ...repos.tasks.findById(a.id)!,
      id: '00000000-0000-7000-8000-0000000000ff',
      parentId: a.id,
      key: 99,
    };
    repos.tasks.insert(sub);
    expect(() => tasks.moveTask({ taskId: sub.id, toColumnId: todo, beforeId: null, afterId: null })).toThrow(
      RuleViolationError,
    );
  });

  it('ranks around a deleted column sitting between the neighbours', () => {
    const { board, todo, doing, done } = setup();
    const gone = columns.createColumn({
      boardId: board.id,
      name: 'Jetée',
      icon: 'inbox',
      color: 'slate',
      category: 'todo',
      displayLimit: null,
    });
    columns.moveColumn({ columnId: gone.id, beforeId: todo, afterId: doing });
    const goneRank = repos.columns.findById(gone.id)!.rank;
    columns.deleteColumn(gone.id);

    const afterTodo = columns.moveColumn({ columnId: done, beforeId: todo, afterId: doing });
    expect(afterTodo.rank).not.toBe(goneRank);
    expect(boards.getBoard(board.id).columns.map((c) => c.id)).toEqual([todo, done, doing]);

    const beforeDoing = columns.moveColumn({ columnId: done, beforeId: null, afterId: doing });
    expect(beforeDoing.rank).not.toBe(goneRank);
    expect(beforeDoing.rank > goneRank && beforeDoing.rank < repos.columns.findById(doing)!.rank).toBe(true);
    expect(boards.getBoard(board.id).columns.map((c) => c.id)).toEqual([todo, done, doing]);
  });

  it('refuses a column move with no neighbour', () => {
    const { todo } = setup();
    expect(() => columns.moveColumn({ columnId: todo, beforeId: null, afterId: null })).toThrow(
      RuleViolationError,
    );
  });
});
