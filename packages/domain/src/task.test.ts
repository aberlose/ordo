import { describe, expect, it } from 'vitest';
import {
  canBeParent,
  columnForNewSubtask,
  columnForSubtaskCheck,
  completionAfterMove,
  nextTaskKey,
  normalizeTitle,
  subTaskProgress,
} from './task';

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

describe('sub-task columns', () => {
  const columns = [
    { id: 'todo', category: 'todo' },
    { id: 'doing', category: 'in_progress' },
    { id: 'review', category: 'in_progress' },
    { id: 'done', category: 'done' },
    { id: 'shipped', category: 'done' },
  ] as const;

  it('creates in the first To-do column, else the first column', () => {
    expect(columnForNewSubtask(columns)).toBe('todo');
    expect(columnForNewSubtask(columns.slice(1))).toBe('doing');
    expect(columnForNewSubtask([])).toBeNull();
  });

  it('checks into the first Done column and unchecks into the first To-do column', () => {
    expect(columnForSubtaskCheck(columns, true)).toBe('done');
    expect(columnForSubtaskCheck(columns, false)).toBe('todo');
  });

  it('falls back when a category is missing', () => {
    expect(columnForSubtaskCheck(columns.slice(1), false)).toBe('doing');
    expect(columnForSubtaskCheck(columns.slice(0, 3), true)).toBeNull();
    expect(columnForSubtaskCheck(columns.slice(3), false)).toBeNull();
  });
});
