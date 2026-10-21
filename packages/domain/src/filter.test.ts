import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  type FilterableTask,
  hasActiveFilters,
  matchesDue,
  matchesFilters,
  parseFilterQuery,
  pushRecent,
  resolveQueryTags,
  startOfWeek,
  toFtsQuery,
} from './filter';

// Wednesday 2026-10-21.
const TODAY = '2026-10-21';
const task = (over: Partial<FilterableTask & { id: string }> = {}) => ({
  id: 't1',
  priority: 3 as const,
  dueDate: null,
  completed: false,
  tags: [],
  ...over,
});

describe('startOfWeek', () => {
  it('is the Monday of the week, Sunday included', () => {
    expect(startOfWeek('2026-10-21')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });
});

describe('matchesDue', () => {
  it('overdue: due before today and not completed', () => {
    expect(matchesDue(task({ dueDate: '2026-10-20' }), 'overdue', TODAY)).toBe(true);
    expect(matchesDue(task({ dueDate: TODAY }), 'overdue', TODAY)).toBe(false);
    expect(matchesDue(task({ dueDate: '2026-10-20', completed: true }), 'overdue', TODAY)).toBe(false);
    expect(matchesDue(task(), 'overdue', TODAY)).toBe(false);
  });
  it('this week: Monday to Sunday of the current week, past days included', () => {
    expect(matchesDue(task({ dueDate: '2026-10-19' }), 'thisWeek', TODAY)).toBe(true);
    expect(matchesDue(task({ dueDate: '2026-10-25' }), 'thisWeek', TODAY)).toBe(true);
    expect(matchesDue(task({ dueDate: '2026-10-18' }), 'thisWeek', TODAY)).toBe(false);
    expect(matchesDue(task({ dueDate: '2026-10-26' }), 'thisWeek', TODAY)).toBe(false);
    expect(matchesDue(task(), 'thisWeek', TODAY)).toBe(false);
  });
  it('no date', () => {
    expect(matchesDue(task(), 'none', TODAY)).toBe(true);
    expect(matchesDue(task({ dueDate: TODAY }), 'none', TODAY)).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('passes everything without filters', () => {
    expect(matchesFilters(task(), EMPTY_FILTERS, TODAY)).toBe(true);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, text: '  ' })).toBe(false);
  });
  it('ORs values within a kind and ANDs kinds', () => {
    const filters = { ...EMPTY_FILTERS, priorities: [4, 5] as const, tags: ['a', 'b'] };
    expect(matchesFilters(task({ priority: 5, tags: ['b'] }), filters, TODAY)).toBe(true);
    expect(matchesFilters(task({ priority: 3, tags: ['b'] }), filters, TODAY)).toBe(false);
    expect(matchesFilters(task({ priority: 4, tags: ['c'] }), filters, TODAY)).toBe(false);
    const due = { ...EMPTY_FILTERS, due: ['overdue', 'none'] as const };
    expect(matchesFilters(task(), due, TODAY)).toBe(true);
    expect(matchesFilters(task({ dueDate: '2026-10-01' }), due, TODAY)).toBe(true);
    expect(matchesFilters(task({ dueDate: '2026-12-01' }), due, TODAY)).toBe(false);
  });
  it('checks free text against the ids the index returned', () => {
    const filters = { ...EMPTY_FILTERS, text: 'header' };
    expect(matchesFilters(task(), filters, TODAY, new Set(['t1']))).toBe(true);
    expect(matchesFilters(task(), filters, TODAY, new Set(['t2']))).toBe(false);
    expect(matchesFilters(task(), filters, TODAY, null)).toBe(true);
  });
});

describe('parseFilterQuery', () => {
  it('splits tags, priorities, due words and free text', () => {
    expect(parseFilterQuery('haute #front header retard')).toEqual({
      priorities: [4, 5],
      tagNames: ['front'],
      due: ['overdue'],
      text: 'header',
    });
  });
  it('reads two-word keywords first, accents and case ignored', () => {
    expect(parseFilterQuery('Très Haute').priorities).toEqual([5]);
    expect(parseFilterQuery('tres basse').priorities).toEqual([1]);
    expect(parseFilterQuery('en retard').due).toEqual(['overdue']);
    expect(parseFilterQuery('cette semaine').due).toEqual(['thisWeek']);
    expect(parseFilterQuery('sans date').due).toEqual(['none']);
    expect(parseFilterQuery('très').text).toBe('très');
  });
  it('understands English words too', () => {
    expect(parseFilterQuery('high overdue week').priorities).toEqual([4, 5]);
    expect(parseFilterQuery('very low').priorities).toEqual([1]);
    expect(parseFilterQuery('overdue this week').due).toEqual(['overdue', 'thisWeek']);
  });
  it('adds several priority words up and keeps the text spelling', () => {
    expect(parseFilterQuery('haute basse').priorities).toEqual([1, 2, 4, 5]);
    expect(parseFilterQuery('Page  Produit').text).toBe('Page Produit');
  });
  it('dedupes tags ignoring case and accents; a bare # is ignored', () => {
    expect(parseFilterQuery('#Été #ete # #x').tagNames).toEqual(['Été', 'x']);
  });
  it('keeps quoted words as text', () => {
    expect(parseFilterQuery('"semaine" de 4 jours haute')).toEqual({
      priorities: [4, 5],
      tagNames: [],
      due: [],
      text: 'semaine de 4 jours',
    });
    expect(parseFilterQuery('très "haute"').text).toBe('très haute');
    expect(parseFilterQuery('"#front retard').text).toBe('#front retard');
  });
  it('returns nothing for an empty query', () => {
    expect(parseFilterQuery('   ')).toEqual({ priorities: [], tagNames: [], due: [], text: '' });
  });
});

describe('resolveQueryTags', () => {
  it('maps names to the board tag ids and reports unknown names', () => {
    const tags = [
      { id: 'tg1', name: 'Front' },
      { id: 'tg2', name: 'Été' },
    ];
    const { filters, unknownTags } = resolveQueryTags(parseFilterQuery('#front #ete #fr x'), tags);
    expect(filters).toEqual({ priorities: [], tags: ['tg1', 'tg2'], due: [], text: 'x' });
    expect(unknownTags).toEqual(['fr']);
  });
});

describe('toFtsQuery', () => {
  it('quotes each word as a prefix term', () => {
    expect(toFtsQuery('page produit')).toBe('"page"* "produit"*');
  });
  it('neutralises FTS syntax and quotes', () => {
    expect(toFtsQuery('a" OR b* NEAR(')).toBe('"a"* "OR"* "b*"* "NEAR("*');
  });
  it('is null when nothing searchable is left', () => {
    expect(toFtsQuery('')).toBeNull();
    expect(toFtsQuery(' - … " ')).toBeNull();
  });
});

describe('pushRecent', () => {
  it('puts the id first, removes the old place and keeps five', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
    expect(pushRecent([], 'a')).toEqual(['a']);
  });
});
