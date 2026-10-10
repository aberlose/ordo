import { describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { NotFoundError } from './errors';
import type { BoardRecord, BoardRepository, ColumnRecord, ColumnRepository } from './ports';

function inMemory() {
  const boardRows: BoardRecord[] = [];
  const columnRows: ColumnRecord[] = [];
  const boards: BoardRepository = {
    listActive: () =>
      [...boardRows].sort((a, b) => (a.rank < b.rank ? -1 : 1)).map((b) => ({ ...b, taskCount: 0 })),
    findById: (id) => {
      const b = boardRows.find((x) => x.id === id);
      return b ? { ...b, taskCount: 0 } : null;
    },
    lastRank: () =>
      boardRows
        .map((b) => b.rank)
        .sort()
        .at(-1) ?? null,
    insert: (b) => void boardRows.push(b),
  };
  const columns: ColumnRepository = {
    listByBoard: (id) =>
      columnRows.filter((c) => c.boardId === id).sort((a, b) => (a.rank < b.rank ? -1 : 1)),
    insertMany: (cs) => void columnRows.push(...cs),
  };
  let n = 0;
  return makeBoardUseCases({
    boards,
    columns,
    tx: { run: (work) => work() },
    clock: { now: () => 1_760_000_000_000 },
    ids: { next: () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}` },
  });
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
