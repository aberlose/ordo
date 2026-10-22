import { describe, expect, it } from 'vitest';
import { cardNavigationTarget } from './cardNavigation';

const columns = [
  { id: 'a', taskIds: ['a1', 'a2', 'a3'] },
  { id: 'b', taskIds: [] },
  { id: 'c', taskIds: ['c1'] },
];

describe('cardNavigationTarget', () => {
  it('goes up and down within the column, stopping at its ends', () => {
    expect(cardNavigationTarget(columns, 'a2', 'up')).toEqual({ taskId: 'a1', columnId: 'a' });
    expect(cardNavigationTarget(columns, 'a2', 'down')).toEqual({ taskId: 'a3', columnId: 'a' });
    expect(cardNavigationTarget(columns, 'a1', 'up')).toBeNull();
    expect(cardNavigationTarget(columns, 'a3', 'down')).toBeNull();
  });

  it('goes sideways to the same position or the last card, skipping empty columns', () => {
    expect(cardNavigationTarget(columns, 'a3', 'right')).toEqual({ taskId: 'c1', columnId: 'c' });
    expect(cardNavigationTarget(columns, 'c1', 'left')).toEqual({ taskId: 'a1', columnId: 'a' });
    expect(cardNavigationTarget(columns, 'a1', 'left')).toBeNull();
    expect(cardNavigationTarget(columns, 'c1', 'right')).toBeNull();
  });

  it('does nothing for a card that is not shown', () => {
    expect(cardNavigationTarget(columns, 'zz', 'down')).toBeNull();
  });
});
