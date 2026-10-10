import { describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { NotFoundError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';

function inMemory() {
  const repos = inMemoryRepositories();
  return makeBoardUseCases({ ...repos, ...fixedDeps() });
}

describe('board use cases', () => {
  it('creates a board with the three default columns in order', () => {
    const useCases = inMemory();
    const board = useCases.createBoard({ name: 'Perso', columnNames: ['À faire', 'En cours', 'Terminé'] });
    expect(board.name).toBe('Perso');
    expect(board.columns.map((c) => [c.name, c.category])).toEqual([
      ['À faire', 'todo'],
      ['En cours', 'in_progress'],
      ['Terminé', 'done'],
    ]);
  });

  it('lists boards in creation order', () => {
    const useCases = inMemory();
    useCases.createBoard({ name: 'A', columnNames: ['1', '2', '3'] });
    useCases.createBoard({ name: 'B', columnNames: ['1', '2', '3'] });
    expect(useCases.listBoards().map((b) => b.name)).toEqual(['A', 'B']);
  });

  it('fails on an unknown board', () => {
    expect(() => inMemory().getBoard('nope')).toThrow(NotFoundError);
  });
});
