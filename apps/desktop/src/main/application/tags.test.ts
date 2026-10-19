import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { ConflictError, NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTagUseCases } from './tags';
import { makeTaskUseCases } from './tasks';

let repos: ReturnType<typeof inMemoryRepositories>;
let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let tags: ReturnType<typeof makeTagUseCases>;

beforeEach(() => {
  repos = inMemoryRepositories();
  deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, ...deps });
  tasks = makeTaskUseCases({ ...repos, ...deps });
  tags = makeTagUseCases({ ...repos, ...deps });
});

const newBoard = (name = 'Perso') =>
  boards.createBoard({ name, columnNames: ['À faire', 'En cours', 'Terminé'] });

describe('tag use cases', () => {
  it('creates tags with a normalised name and the first free colour, listed alphabetically', () => {
    const board = newBoard();
    const b = tags.createTag({ boardId: board.id, name: '  zone   rouge ' });
    const a = tags.createTag({ boardId: board.id, name: 'Écrit', color: 'red' });
    const c = tags.createTag({ boardId: board.id, name: 'design' });
    expect(b).toMatchObject({ name: 'zone rouge', color: 'blue', taskCount: 0 });
    expect(a.color).toBe('red');
    expect(c.color).toBe('cyan');
    expect(boards.getBoard(board.id).tags.map((t) => t.name)).toEqual(['design', 'Écrit', 'zone rouge']);
  });

  it('refuses a name already used on the board, whatever its case or accents', () => {
    const board = newBoard();
    tags.createTag({ boardId: board.id, name: 'Écrit' });
    expect(() => tags.createTag({ boardId: board.id, name: 'ecrit' })).toThrow(ConflictError);
    expect(() => tags.createTag({ boardId: board.id, name: ' ÉCRIT ' })).toThrow(ConflictError);
    // Another board is fine.
    expect(tags.createTag({ boardId: newBoard('B').id, name: 'ecrit' }).name).toBe('ecrit');
  });

  it('refuses an unknown or archived board', () => {
    const board = newBoard();
    expect(() => tags.createTag({ boardId: 'nope', name: 'x' })).toThrow(NotFoundError);
    boards.archiveBoard(board.id);
    expect(() => tags.createTag({ boardId: board.id, name: 'x' })).toThrow(RuleViolationError);
  });

  it('creates a tag on a task in the same transaction', () => {
    const board = newBoard();
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'T' });
    deps.setNow(1_760_000_100_000);
    const tag = tags.createTag({ boardId: board.id, name: 'urgent', taskId: task.id });
    expect(tag.taskCount).toBe(1);
    expect(tasks.getTask(task.id)).toMatchObject({ tagIds: [tag.id], updatedAt: 1_760_000_100_000 });
  });

  it('refuses a task of another board and leaves nothing behind', () => {
    const board = newBoard();
    const other = newBoard('Other');
    const task = tasks.createTask({ columnId: other.columns[0]!.id, title: 'T' });
    expect(() => tags.createTag({ boardId: board.id, name: 'x', taskId: task.id })).toThrow(
      RuleViolationError,
    );
    expect(() => tags.createTag({ boardId: board.id, name: 'x', taskId: 'nope' })).toThrow(NotFoundError);
    expect(boards.getBoard(board.id).tags).toEqual([]);
  });

  it('renames and recolours, keeping uniqueness but allowing its own name', () => {
    const board = newBoard();
    const a = tags.createTag({ boardId: board.id, name: 'design' });
    tags.createTag({ boardId: board.id, name: 'urgent' });
    expect(tags.updateTag({ id: a.id, name: 'Design', color: 'green' })).toMatchObject({
      name: 'Design',
      color: 'green',
    });
    expect(() => tags.updateTag({ id: a.id, name: 'URGENT' })).toThrow(ConflictError);
    expect(tags.updateTag({ id: a.id, color: 'pink' })).toMatchObject({ name: 'Design', color: 'pink' });
    expect(() => tags.updateTag({ id: 'nope', color: 'pink' })).toThrow(NotFoundError);
  });

  it('counts live tasks and sub-tasks only', () => {
    const board = newBoard();
    const tag = tags.createTag({ boardId: board.id, name: 'design' });
    const todo = board.columns[0]!.id;
    const [a, b, c] = ['A', 'B', 'C'].map((title) => tasks.createTask({ columnId: todo, title }));
    const sub = tasks.createTask({ parentId: a!.id, title: 'Sub' });
    for (const t of [a!, b!, c!, sub]) tasks.addTag({ taskId: t.id, tagId: tag.id });
    tasks.deleteTask(b!.id);
    repos.testing.archiveTask(c!.id, 1);
    expect(boards.getBoard(board.id).tags[0]?.taskCount).toBe(2);
  });

  it('deletes a tag permanently with its links and reports the live tasks it left', () => {
    const board = newBoard();
    const tag = tags.createTag({ boardId: board.id, name: 'design' });
    const keep = tags.createTag({ boardId: board.id, name: 'keep' });
    const todo = board.columns[0]!.id;
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    const gone = tasks.createTask({ columnId: todo, title: 'Gone' });
    tasks.addTag({ taskId: a.id, tagId: tag.id });
    tasks.addTag({ taskId: a.id, tagId: keep.id });
    tasks.addTag({ taskId: gone.id, tagId: tag.id });
    tasks.deleteTask(gone.id);

    expect(tags.deleteTag(tag.id)).toEqual({ id: tag.id, removedFrom: 1 });
    expect(repos.testing.allLinks()).toEqual([{ taskId: a.id, tagId: keep.id }]);
    expect(boards.getBoard(board.id).tags.map((t) => t.name)).toEqual(['keep']);
    expect(tasks.getTask(a.id).tagIds).toEqual([keep.id]);
    expect(() => tags.deleteTag(tag.id)).toThrow(NotFoundError);
    // The name is free again.
    expect(tags.createTag({ boardId: board.id, name: 'Design' }).name).toBe('Design');
  });
});
