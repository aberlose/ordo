import { describe, expect, it } from 'vitest';
import { dropIndex, isSamePlace, keyboardColumnMove, keyboardTaskMove, placeAt } from './move';

const columns = [
  { id: 'todo', taskIds: ['a', 'b', 'c'] },
  { id: 'doing', taskIds: ['d'] },
  { id: 'done', taskIds: [] },
];

describe('placeAt', () => {
  it('gives the neighbours at an index, ignoring the moving item', () => {
    expect(placeAt(['a', 'b', 'c'], 'x', 0)).toEqual({ index: 0, beforeId: null, afterId: 'a' });
    expect(placeAt(['a', 'b', 'c'], 'x', 3)).toEqual({ index: 3, beforeId: 'c', afterId: null });
    expect(placeAt(['a', 'b', 'c'], 'a', 1)).toEqual({ index: 1, beforeId: 'b', afterId: 'c' });
    expect(placeAt([], 'x', 5)).toEqual({ index: 0, beforeId: null, afterId: null });
  });
});

describe('dropIndex', () => {
  it('drops before or after the target card', () => {
    expect(dropIndex(['a', 'b', 'c'], 'x', 'b', 'top')).toBe(1);
    expect(dropIndex(['a', 'b', 'c'], 'x', 'b', 'bottom')).toBe(2);
    expect(dropIndex(['a', 'b', 'c'], 'a', 'c', 'bottom')).toBe(2);
    expect(dropIndex(['a', 'b'], 'x', 'missing', 'top')).toBe(2);
  });

  it('detects a drop back in the same place', () => {
    expect(isSamePlace(['a', 'b', 'c'], 'b', 1)).toBe(true);
    expect(isSamePlace(['a', 'b', 'c'], 'b', 0)).toBe(false);
    expect(isSamePlace(['a', 'b'], 'x', 0)).toBe(false);
  });
});

describe('keyboard moves', () => {
  it('moves a card up and down within its column, and stops at the ends', () => {
    expect(keyboardTaskMove(columns, 'b', 'up')).toEqual({
      toColumnId: 'todo',
      index: 0,
      beforeId: null,
      afterId: 'a',
    });
    expect(keyboardTaskMove(columns, 'b', 'down')).toEqual({
      toColumnId: 'todo',
      index: 2,
      beforeId: 'c',
      afterId: null,
    });
    expect(keyboardTaskMove(columns, 'a', 'up')).toBeNull();
    expect(keyboardTaskMove(columns, 'c', 'down')).toBeNull();
  });

  it('moves a card to the adjacent column at the same position or its end', () => {
    expect(keyboardTaskMove(columns, 'a', 'right')).toEqual({
      toColumnId: 'doing',
      index: 0,
      beforeId: null,
      afterId: 'd',
    });
    expect(keyboardTaskMove(columns, 'c', 'right')).toEqual({
      toColumnId: 'doing',
      index: 1,
      beforeId: 'd',
      afterId: null,
    });
    expect(keyboardTaskMove(columns, 'd', 'right')).toEqual({
      toColumnId: 'done',
      index: 0,
      beforeId: null,
      afterId: null,
    });
    expect(keyboardTaskMove(columns, 'a', 'left')).toBeNull();
    expect(keyboardTaskMove(columns, 'nope', 'left')).toBeNull();
  });

  it('moves a column left and right', () => {
    const ids = ['todo', 'doing', 'done'];
    expect(keyboardColumnMove(ids, 'doing', 'left')).toEqual({ index: 0, beforeId: null, afterId: 'todo' });
    expect(keyboardColumnMove(ids, 'doing', 'right')).toEqual({ index: 2, beforeId: 'done', afterId: null });
    expect(keyboardColumnMove(ids, 'todo', 'left')).toBeNull();
    expect(keyboardColumnMove(ids, 'done', 'right')).toBeNull();
  });
});
