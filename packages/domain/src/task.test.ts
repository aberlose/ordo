import { describe, expect, it } from 'vitest';
import { canBeParent, completionAfterMove, nextTaskKey, normalizeTitle, subTaskProgress } from './task';

describe('tasks', () => {
  it('allows one level of sub-tasks only', () => {
    expect(canBeParent({ id: 'a', parentId: null })).toBe(true);
    expect(canBeParent({ id: 'b', parentId: 'a' })).toBe(false);
  });

  it('normalises titles', () => {
    expect(normalizeTitle('  Intégrer   le header \n')).toBe('Intégrer le header');
  });

  it('computes sub-task progress', () => {
    expect(subTaskProgress([true, false, true])).toEqual({ done: 2, total: 3 });
  });
});

describe('task keys and completion', () => {
  it('numbers keys per board from 1', () => {
    expect(nextTaskKey(null)).toBe(1);
    expect(nextTaskKey(41)).toBe(42);
  });

  it('sets, keeps and clears completion with the column category', () => {
    expect(completionAfterMove(null, true, 1000)).toBe(1000);
    expect(completionAfterMove(500, true, 1000)).toBe(500);
    expect(completionAfterMove(500, false, 1000)).toBeNull();
    expect(completionAfterMove(null, false, 1000)).toBeNull();
  });
});
