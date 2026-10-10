import { describe, expect, it } from 'vitest';
import { canBeParent, normalizeTitle, subTaskProgress } from './task';

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
