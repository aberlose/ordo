import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMNS, visibleCount } from './column';

describe('columns', () => {
  it('starts a board with to do, in progress and done', () => {
    expect(DEFAULT_COLUMNS.map((c) => c.category)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('applies the display limit', () => {
    expect(visibleCount(8, 6)).toEqual({ shown: 6, hidden: 2 });
    expect(visibleCount(3, 6)).toEqual({ shown: 3, hidden: 0 });
    expect(visibleCount(8, null)).toEqual({ shown: 8, hidden: 0 });
  });
});
