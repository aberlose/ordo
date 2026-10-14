import { describe, expect, it } from 'vitest';
import {
  COLUMN_ICON_NAMES,
  isColumnIconName,
  completionOnCategoryChange,
  isPastDisplayLimit,
  canDeleteColumn,
  COLUMN_COLORS,
  DEFAULT_COLUMNS,
  isDisplayLimit,
  newColumnDefaults,
  normalizeColumnName,
  visibleCount,
} from './column';

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

describe('column rules', () => {
  it('normalises names', () => {
    expect(normalizeColumnName('  En   revue ')).toBe('En revue');
    expect(normalizeColumnName('x'.repeat(80))).toHaveLength(60);
  });

  it('accepts a display limit from 1 to 99, or none', () => {
    expect(isDisplayLimit(null)).toBe(true);
    expect(isDisplayLimit(1)).toBe(true);
    expect(isDisplayLimit(99)).toBe(true);
    expect(isDisplayLimit(0)).toBe(false);
    expect(isDisplayLimit(100)).toBe(false);
    expect(isDisplayLimit(2.5)).toBe(false);
  });

  it('gives a new column the first unused colour, in progress, no limit', () => {
    expect(newColumnDefaults(['slate', 'blue'])).toMatchObject({
      color: 'cyan',
      category: 'in_progress',
      displayLimit: null,
    });
    expect(newColumnDefaults([...COLUMN_COLORS]).color).toBe('slate');
  });

  it('keeps at least one column', () => {
    expect(canDeleteColumn(2)).toBe(true);
    expect(canDeleteColumn(1)).toBe(false);
  });
});

describe('display limit', () => {
  it('hides positions from the limit on', () => {
    expect(isPastDisplayLimit(4, 5)).toBe(false);
    expect(isPastDisplayLimit(5, 5)).toBe(true);
    expect(isPastDisplayLimit(500, null)).toBe(false);
  });
});

describe('category change', () => {
  it('completes the tasks when the column becomes done, reopens them when it stops being done', () => {
    expect(completionOnCategoryChange('in_progress', 'done')).toBe('complete');
    expect(completionOnCategoryChange('done', 'todo')).toBe('reopen');
    expect(completionOnCategoryChange('todo', 'in_progress')).toBeNull();
    expect(completionOnCategoryChange('done', 'done')).toBeNull();
  });
});

describe('column icons', () => {
  it('lists unique kebab-case names, including the default columns and the new-column icon', () => {
    expect(new Set(COLUMN_ICON_NAMES).size).toBe(COLUMN_ICON_NAMES.length);
    for (const name of COLUMN_ICON_NAMES) expect(name).toMatch(/^[a-z0-9-]+$/);
    for (const column of DEFAULT_COLUMNS) expect(isColumnIconName(column.icon)).toBe(true);
    expect(isColumnIconName(newColumnDefaults([]).icon)).toBe(true);
    expect(isColumnIconName('not-an-icon')).toBe(false);
    expect(isColumnIconName(null)).toBe(false);
  });
});
