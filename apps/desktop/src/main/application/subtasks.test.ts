import { rankAtEnd } from '@ordo/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { makeColumnUseCases } from './columns';
import { NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTagUseCases } from './tags';
import { makeTaskUseCases } from './tasks';

let repos: ReturnType<typeof inMemoryRepositories>;
let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let columns: ReturnType<typeof makeColumnUseCases>;
let tags: ReturnType<typeof makeTagUseCases>;

beforeEach(() => {
  repos = inMemoryRepositories();
  deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, ...deps });
  tasks = makeTaskUseCases({ ...repos, ...deps });
  columns = makeColumnUseCases({ ...repos, ...deps });
  tags = makeTagUseCases({ ...repos, ...deps });
});

function setup() {
  const board = boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
  const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
  const parent = tasks.createTask({ columnId: doing, title: 'Parent' });
  return { board, todo, doing, done, parent };
}

describe('sub-tasks', () => {
  it('creates sub-tasks in the first To-do column, at the end of the list, with new keys', () => {
    const { board, todo, done, parent } = setup();
    columns.moveColumn({ columnId: done, beforeId: null, afterId: todo });
    const a = tasks.createTask({ parentId: parent.id, title: ' Première ' });
    const b = tasks.createTask({ parentId: parent.id, title: 'Seconde' });
    expect(a).toMatchObject({
      parentId: parent.id,
      columnId: todo,
      key: 2,
      title: 'Première',
      completedAt: null,
    });
    expect(b.key).toBe(3);
    expect(b.rank > a.rank).toBe(true);
    expect(tasks.listSubtasks(parent.id).map((t) => t.title)).toEqual(['Première', 'Seconde']);
    // Not on the board, not in the board count.
    const read = boards.getBoard(board.id);
    expect(read.tasks.map((t) => t.id)).toEqual([parent.id]);
    expect(read.taskCount).toBe(1);
  });

  it('falls back to the first column and marks it completed when that column is Done', () => {
    const { todo, done, parent } = setup();
    columns.updateColumn({ id: todo, category: 'in_progress' });
    columns.moveColumn({ columnId: done, beforeId: null, afterId: todo });
    const sub = tasks.createTask({ parentId: parent.id, title: 'Sub' });
    expect(sub).toMatchObject({ columnId: done, completedAt: deps.clock.now() });
  });

  it('refuses a sub-task of a sub-task and an unknown or deleted parent', () => {
    const { parent } = setup();
    const sub = tasks.createTask({ parentId: parent.id, title: 'Sub' });
    expect(() => tasks.createTask({ parentId: sub.id, title: 'Deep' })).toThrow(RuleViolationError);
    expect(() => tasks.createTask({ parentId: 'nope', title: 'X' })).toThrow(NotFoundError);
    tasks.deleteTask(parent.id);
    expect(() => tasks.createTask({ parentId: parent.id, title: 'X' })).toThrow(NotFoundError);
  });

  it('reports live sub-task progress on the parent, zeros on a sub-task', () => {
    const { board, done, parent } = setup();
    const a = tasks.createTask({ parentId: parent.id, title: 'A' });
    const b = tasks.createTask({ parentId: parent.id, title: 'B' });
    const c = tasks.createTask({ parentId: parent.id, title: 'C' });
    tasks.updateTask({ id: a.id, columnId: done });
    tasks.deleteTask(c.id);
    expect(boards.getBoard(board.id).tasks[0]?.subtasks).toEqual({ done: 1, total: 2 });
    expect(tasks.getTask(parent.id).subtasks).toEqual({ done: 1, total: 2 });
    repos.testing.archiveTask(b.id, 1);
    expect(tasks.getTask(parent.id).subtasks).toEqual({ done: 1, total: 1 });
    expect(tasks.getTask(a.id).subtasks).toEqual({ done: 0, total: 0 });
    expect(tasks.listSubtasks(parent.id).map((t) => t.id)).toEqual([a.id]);
  });

  it('changes a sub-task status without changing its place in the list', () => {
    const { todo, done, parent } = setup();
    const a = tasks.createTask({ parentId: parent.id, title: 'A' });
    tasks.createTask({ parentId: parent.id, title: 'B' });
    deps.setNow(1_760_000_100_000);
    const checked = tasks.updateTask({ id: a.id, columnId: done });
    expect(checked).toMatchObject({ columnId: done, rank: a.rank, completedAt: 1_760_000_100_000 });
    const unchecked = tasks.updateTask({ id: a.id, columnId: todo });
    expect(unchecked).toMatchObject({ columnId: todo, rank: a.rank, completedAt: null });
    expect(tasks.listSubtasks(parent.id).map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('refuses a sub-task status from another board, and a board move', () => {
    const { todo, parent } = setup();
    const other = boards.createBoard({ name: 'Other', columnNames: ['a', 'b', 'c'] });
    const sub = tasks.createTask({ parentId: parent.id, title: 'Sub' });
    expect(() => tasks.updateTask({ id: sub.id, columnId: other.columns[0]!.id })).toThrow(
      RuleViolationError,
    );
    expect(() => tasks.moveTask({ taskId: sub.id, toColumnId: todo, beforeId: null, afterId: null })).toThrow(
      RuleViolationError,
    );
  });

  it('sends the live sub-tasks to the trash with their parent, at the same time', () => {
    const { board, parent } = setup();
    tasks.createTask({ parentId: parent.id, title: 'A' });
    tasks.createTask({ parentId: parent.id, title: 'B' });
    deps.setNow(1_760_000_200_000);
    tasks.deleteTask(parent.id);
    expect(repos.testing.allTasks(board.id)).toEqual([]);
    expect(() => tasks.getTask(parent.id)).toThrow(NotFoundError);
    expect(() => tasks.listSubtasks(parent.id)).toThrow(NotFoundError);
  });

  it('deletes a sub-task alone', () => {
    const { parent } = setup();
    const a = tasks.createTask({ parentId: parent.id, title: 'A' });
    tasks.createTask({ parentId: parent.id, title: 'B' });
    tasks.deleteTask(a.id);
    expect(tasks.listSubtasks(parent.id).map((t) => t.title)).toEqual(['B']);
    expect(tasks.getTask(parent.id).subtasks.total).toBe(1);
  });

  it('deletes a column with its sub-tasks and the sub-tasks of its tasks, and counts them all', () => {
    const { board, doing, done, parent } = setup();
    const keeper = tasks.createTask({ columnId: done, title: 'Keeper' });
    tasks.createTask({ parentId: parent.id, title: 'Sub of a deleted parent (todo)' });
    const inDoing = tasks.createTask({ parentId: keeper.id, title: 'Sub in the deleted column' });
    tasks.updateTask({ id: inDoing.id, columnId: doing });
    const stays = tasks.createTask({ parentId: keeper.id, title: 'Stays' });

    expect(columns.deleteColumn(doing)).toEqual({ id: doing, deletedTasks: 3 });
    expect(
      repos.testing
        .allTasks(board.id)
        .map((t) => t.title)
        .sort(),
    ).toEqual(['Keeper', 'Stays']);
    expect(tasks.getTask(keeper.id).subtasks).toEqual({ done: 0, total: 1 });
    expect(tasks.listSubtasks(keeper.id).map((t) => t.id)).toEqual([stays.id]);
  });
});

describe('tags on tasks', () => {
  it('adds and removes tags idempotently, alphabetical, touching updatedAt only on change', () => {
    const { board, parent } = setup();
    const zeta = tags.createTag({ boardId: board.id, name: 'zeta' });
    const ete = tags.createTag({ boardId: board.id, name: 'Été' });
    const alpha = tags.createTag({ boardId: board.id, name: 'alpha' });

    deps.setNow(1_760_000_100_000);
    tasks.addTag({ taskId: parent.id, tagId: zeta.id });
    tasks.addTag({ taskId: parent.id, tagId: alpha.id });
    const added = tasks.addTag({ taskId: parent.id, tagId: ete.id });
    expect(added.tagIds).toEqual([alpha.id, ete.id, zeta.id]);
    expect(added.updatedAt).toBe(1_760_000_100_000);

    deps.setNow(1_760_000_200_000);
    expect(tasks.addTag({ taskId: parent.id, tagId: ete.id }).updatedAt).toBe(1_760_000_100_000);
    const removed = tasks.removeTag({ taskId: parent.id, tagId: ete.id });
    expect(removed).toMatchObject({ tagIds: [alpha.id, zeta.id], updatedAt: 1_760_000_200_000 });
    deps.setNow(1_760_000_300_000);
    expect(tasks.removeTag({ taskId: parent.id, tagId: ete.id }).updatedAt).toBe(1_760_000_200_000);
    expect(boards.getBoard(board.id).tasks[0]?.tagIds).toEqual([alpha.id, zeta.id]);
  });

  it('tags sub-tasks too and shows them in the sub-task list', () => {
    const { board, parent } = setup();
    const tag = tags.createTag({ boardId: board.id, name: 'design' });
    const sub = tasks.createTask({ parentId: parent.id, title: 'Sub' });
    tasks.addTag({ taskId: sub.id, tagId: tag.id });
    expect(tasks.listSubtasks(parent.id)[0]?.tagIds).toEqual([tag.id]);
    expect(boards.getBoard(board.id).tags).toEqual([{ ...tag, taskCount: 1 }]);
  });

  it('refuses a tag of another board and unknown ids', () => {
    const { parent } = setup();
    const other = boards.createBoard({ name: 'Other', columnNames: ['a', 'b', 'c'] });
    const foreign = tags.createTag({ boardId: other.id, name: 'x' });
    expect(() => tasks.addTag({ taskId: parent.id, tagId: foreign.id })).toThrow(RuleViolationError);
    expect(() => tasks.removeTag({ taskId: parent.id, tagId: foreign.id })).toThrow(RuleViolationError);
    expect(() => tasks.addTag({ taskId: parent.id, tagId: 'nope' })).toThrow(NotFoundError);
    expect(() => tasks.addTag({ taskId: 'nope', tagId: foreign.id })).toThrow(NotFoundError);
  });

  it('returns every task with empty tags and progress by default', () => {
    const { parent } = setup();
    expect(parent).toMatchObject({ parentId: null, tagIds: [], subtasks: { done: 0, total: 0 } });
  });
});

describe('creation on an archived board', () => {
  it('refuses new tasks, sub-tasks and tags, but keeps updates and tag changes', () => {
    const { board, todo, parent } = setup();
    const child = tasks.createTask({ parentId: parent.id, title: 'Child' });
    const tag = tags.createTag({ boardId: board.id, name: 'urgent' });
    boards.archiveBoard(board.id);

    expect(() => tasks.createTask({ columnId: todo, title: 'New' })).toThrow(RuleViolationError);
    expect(() => tasks.createTask({ parentId: parent.id, title: 'New' })).toThrow(RuleViolationError);
    expect(() => tags.createTag({ boardId: board.id, name: 'other' })).toThrow(RuleViolationError);

    expect(tasks.updateTask({ id: child.id, title: 'Renamed' }).title).toBe('Renamed');
    expect(tasks.addTag({ taskId: parent.id, tagId: tag.id }).tagIds).toEqual([tag.id]);
    expect(tasks.removeTag({ taskId: parent.id, tagId: tag.id }).tagIds).toEqual([]);
    expect(tags.updateTag({ id: tag.id, name: 'later' }).name).toBe('later');
  });
});

describe('column ranks ignore sub-tasks', () => {
  it('ranks a new top-level task against the top-level tasks of the column only', () => {
    const { todo, parent } = setup();
    // The sub-tasks land in the To-do column, with ranks from their parent's list.
    tasks.createTask({ parentId: parent.id, title: 'A' });
    tasks.createTask({ parentId: parent.id, title: 'B' });
    expect(tasks.createTask({ columnId: todo, title: 'Top' }).rank).toBe(rankAtEnd(null));
  });
});
