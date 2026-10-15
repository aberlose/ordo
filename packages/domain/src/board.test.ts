import { describe, expect, it } from 'vitest';
import {
  BOARD_NAME_MAX_LENGTH,
  boardAfterRemoval,
  keyboardBoardMove,
  newBoardDefaults,
  normalizeBoardName,
} from './board';

describe('board rules', () => {
  it('normalises names', () => {
    expect(normalizeBoardName('  Projet   perso ')).toBe('Projet perso');
    expect(normalizeBoardName('x'.repeat(200))).toHaveLength(BOARD_NAME_MAX_LENGTH);
  });

  it('defaults to the board icon and the first unused colour', () => {
    expect(newBoardDefaults([])).toEqual({ icon: 'kanban', color: 'blue' });
    expect(newBoardDefaults(['slate', null, 'blue'])).toEqual({ icon: 'kanban', color: 'cyan' });
    expect(
      newBoardDefaults(['blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet']),
    ).toEqual({
      icon: 'kanban',
      color: 'slate',
    });
  });

  it('falls back to blue when every colour is used', () => {
    const all = [
      'slate',
      'blue',
      'cyan',
      'teal',
      'green',
      'amber',
      'orange',
      'red',
      'pink',
      'violet',
    ] as const;
    expect(newBoardDefaults(all).color).toBe('blue');
  });
});

describe('keyboard board move', () => {
  const ids = ['a', 'b', 'c'];

  it('swaps with the neighbour', () => {
    expect(keyboardBoardMove(ids, 'b', 'up')).toEqual({ index: 0, beforeId: null, afterId: 'a' });
    expect(keyboardBoardMove(ids, 'b', 'down')).toEqual({ index: 2, beforeId: 'c', afterId: null });
  });

  it('stops at the ends and ignores unknown boards', () => {
    expect(keyboardBoardMove(ids, 'a', 'up')).toBeNull();
    expect(keyboardBoardMove(ids, 'c', 'down')).toBeNull();
    expect(keyboardBoardMove(ids, 'z', 'up')).toBeNull();
  });
});

describe('board after removal', () => {
  it('opens the next board, else the previous one', () => {
    expect(boardAfterRemoval(['a', 'b', 'c'], 'b')).toBe('c');
    expect(boardAfterRemoval(['a', 'b', 'c'], 'c')).toBe('b');
  });

  it('returns null for the only board or an unknown one', () => {
    expect(boardAfterRemoval(['a'], 'a')).toBeNull();
    expect(boardAfterRemoval(['a'], 'z')).toBeNull();
  });
});
