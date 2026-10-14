import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { makeColumnUseCases } from './columns';
import { NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTaskUseCases } from './tasks';

let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let columns: ReturnType<typeof makeColumnUseCases>;

beforeEach(() => {
  const repos = inMemoryRepositories();
  deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, ...deps });
  tasks = makeTaskUseCases({ ...repos, ...deps });
  columns = makeColumnUseCases({ ...repos, ...deps });
});

const newBoard = () => boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
const review = (boardId: string) =>
  columns.createColumn({
    boardId,
    name: '  En   revue ',
    icon: 'eye',
    color: 'violet',
    category: 'in_progress',
    displayLimit: null,
  });

describe('column use cases', () => {
  it('adds a column at the right end', () => {
    const board = newBoard();
    const created = review(board.id);
    expect(created.name).toBe('En revue');
    expect(boards.getBoard(board.id).columns.map((c) => c.name)).toEqual([
      'À faire',
      'En cours',
      'Terminé',
      'En revue',
    ]);
  });

  it('refuses an unknown board and an empty name', () => {
    expect(() => review('nope')).toThrow(NotFoundError);
    const board = newBoard();
    expect(() => columns.updateColumn({ id: board.columns[0]!.id, name: ' \n ' })).toThrow(
      RuleViolationError,
    );
  });

  it('updates the settings', () => {
    const board = newBoard();
    const updated = columns.updateColumn({
      id: board.columns[0]!.id,
      name: 'Backlog',
      icon: 'inbox',
      displayLimit: 8,
    });
    expect(updated).toMatchObject({ name: 'Backlog', displayLimit: 8, category: 'todo' });
    expect(columns.updateColumn({ id: updated.id, displayLimit: null }).displayLimit).toBeNull();
  });

  it('completes or reopens the tasks when the category changes', () => {
    const board = newBoard();
    const doing = board.columns[1]!.id;
    const task = tasks.createTask({ columnId: doing, title: 'Relire' });
    deps.setNow(1_760_000_900_000);
    columns.updateColumn({ id: doing, category: 'done' });
    expect(boards.getBoard(board.id).tasks.find((t) => t.id === task.id)?.completedAt).toBe(
      1_760_000_900_000,
    );
    columns.updateColumn({ id: doing, category: 'todo' });
    expect(boards.getBoard(board.id).tasks.find((t) => t.id === task.id)?.completedAt).toBeNull();
  });

  it('sends the column and its tasks to the trash, and keeps at least one column', () => {
    const board = newBoard();
    const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
    tasks.createTask({ columnId: doing, title: 'A' });
    tasks.createTask({ columnId: doing, title: 'B' });
    tasks.createTask({ columnId: todo, title: 'C' });
    expect(columns.deleteColumn(doing)).toEqual({ id: doing, deletedTasks: 2 });
    const read = boards.getBoard(board.id);
    expect(read.columns.map((c) => c.id)).toEqual([todo, done]);
    expect(read.tasks.map((t) => t.title)).toEqual(['C']);
    expect(read.taskCount).toBe(1);
    columns.deleteColumn(done);
    expect(() => columns.deleteColumn(todo)).toThrow(RuleViolationError);
  });
});
