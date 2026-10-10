import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTaskUseCases } from './tasks';

let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;

beforeEach(() => {
  const repos = inMemoryRepositories();
  deps = fixedDeps();
  boards = makeBoardUseCases({ ...repos, ...deps });
  tasks = makeTaskUseCases({ ...repos, ...deps });
});

const newBoard = () => boards.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });

describe('task use cases', () => {
  it('quick-adds tasks at the bottom of a column with default priority and increasing keys', () => {
    const board = newBoard();
    const todo = board.columns[0]!.id;
    const a = tasks.createTask({ columnId: todo, title: '  Relire   le contrat ' });
    const b = tasks.createTask({ columnId: todo, title: 'Préparer la démo' });
    expect(a).toMatchObject({ title: 'Relire le contrat', priority: 3, key: 1, completedAt: null });
    expect(b.key).toBe(2);
    expect(b.rank > a.rank).toBe(true);
    expect(boards.getBoard(board.id).tasks.map((t) => t.title)).toEqual([
      'Relire le contrat',
      'Préparer la démo',
    ]);
    expect(boards.getBoard(board.id).taskCount).toBe(2);
  });

  it('marks a task created in a done column as completed', () => {
    const board = newBoard();
    expect(tasks.createTask({ columnId: board.columns[2]!.id, title: 'Déjà fait' }).completedAt).toBe(
      1_760_000_000_000,
    );
  });

  it('updates only the given fields', () => {
    const board = newBoard();
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    deps.setNow(1_760_000_100_000);
    const updated = tasks.updateTask({ id: task.id, priority: 5, dueDate: '2026-10-17' });
    expect(updated).toMatchObject({ title: 'Relire', priority: 5, dueDate: '2026-10-17', startDate: null });
    expect(updated.updatedAt).toBe(1_760_000_100_000);
    expect(tasks.updateTask({ id: task.id, dueDate: null }).dueDate).toBeNull();
  });

  it('moves a task to the end of another column and tracks completion', () => {
    const board = newBoard();
    const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
    const existing = tasks.createTask({ columnId: doing, title: 'Déjà là' });
    const task = tasks.createTask({ columnId: todo, title: 'Relire' });

    const moved = tasks.updateTask({ id: task.id, columnId: doing });
    expect(moved.columnId).toBe(doing);
    expect(moved.rank > existing.rank).toBe(true);

    deps.setNow(1_760_000_500_000);
    expect(tasks.updateTask({ id: task.id, columnId: done }).completedAt).toBe(1_760_000_500_000);
    expect(tasks.updateTask({ id: task.id, columnId: todo }).completedAt).toBeNull();
  });

  it('refuses a due date before the start date, whichever is set last', () => {
    const board = newBoard();
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    tasks.updateTask({ id: task.id, startDate: '2026-10-10' });
    expect(() => tasks.updateTask({ id: task.id, dueDate: '2026-10-09' })).toThrow(RuleViolationError);
    tasks.updateTask({ id: task.id, dueDate: '2026-10-17' });
    expect(() => tasks.updateTask({ id: task.id, startDate: '2026-10-18' })).toThrow(RuleViolationError);
  });

  it('refuses an empty title after normalisation', () => {
    const board = newBoard();
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    expect(() => tasks.updateTask({ id: task.id, title: '\n\t' })).toThrow(RuleViolationError);
  });

  it('soft-deletes a task and never reuses its key', () => {
    const board = newBoard();
    const todo = board.columns[0]!.id;
    const task = tasks.createTask({ columnId: todo, title: 'Relire' });
    expect(tasks.deleteTask(task.id)).toEqual({ id: task.id });
    expect(boards.getBoard(board.id).tasks).toEqual([]);
    expect(() => tasks.updateTask({ id: task.id, priority: 1 })).toThrow(NotFoundError);
    expect(tasks.createTask({ columnId: todo, title: 'Suivante' }).key).toBe(2);
  });

  it('fails on unknown columns and tasks', () => {
    expect(() => tasks.createTask({ columnId: 'nope', title: 'x' })).toThrow(NotFoundError);
    expect(() => tasks.deleteTask('nope')).toThrow(NotFoundError);
  });

  it('keeps tasks on their board', () => {
    const a = newBoard();
    const b = newBoard();
    const task = tasks.createTask({ columnId: a.columns[0]!.id, title: 'Relire' });
    expect(() => tasks.updateTask({ id: task.id, columnId: b.columns[0]!.id })).toThrow(RuleViolationError);
  });

  it('never gives a new task the rank of a deleted one', () => {
    const board = newBoard();
    const todo = board.columns[0]!.id;
    const deleted = tasks.createTask({ columnId: todo, title: 'Supprimée' });
    tasks.deleteTask(deleted.id);
    expect(tasks.createTask({ columnId: todo, title: 'Nouvelle' }).rank > deleted.rank).toBe(true);
  });
});
