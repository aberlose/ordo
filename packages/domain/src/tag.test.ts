import { describe, expect, it } from 'vitest';
import {
  TAG_NAME_MAX_LENGTH,
  canCreateTag,
  compareTags,
  foldTagName,
  isSameTagName,
  matchTags,
  newTagColor,
  normalizeTagName,
} from './tag';

describe('tag names', () => {
  it('normalises spaces and length', () => {
    expect(normalizeTagName('  à   revoir ')).toBe('à revoir');
    expect(normalizeTagName('x'.repeat(80))).toHaveLength(TAG_NAME_MAX_LENGTH);
  });

  it('folds case, accents and ligatures', () => {
    expect(foldTagName(' Accessibilité ')).toBe('accessibilite');
    expect(foldTagName('Œuvre')).toBe('oeuvre');
    expect(isSameTagName('Urgent', 'urgent ')).toBe(true);
    expect(isSameTagName('écran', 'Ecran')).toBe(true);
    expect(isSameTagName('front', 'back')).toBe(false);
  });

  it('sorts alphabetically, ignoring case and accents', () => {
    const names = ['urgent', 'Écran', 'design', 'accessibilité', 'Back'];
    expect(
      names
        .map((name) => ({ name }))
        .sort(compareTags)
        .map((t) => t.name),
    ).toEqual(['accessibilité', 'Back', 'design', 'Écran', 'urgent']);
  });
});

describe('tag picker', () => {
  const tags = [{ name: 'front' }, { name: 'design' }, { name: 'Accessibilité' }];

  it('matches on a folded substring, alphabetical', () => {
    expect(matchTags(tags, '').map((t) => t.name)).toEqual(['Accessibilité', 'design', 'front']);
    expect(matchTags(tags, 'ACCES').map((t) => t.name)).toEqual(['Accessibilité']);
    expect(matchTags(tags, 'n').map((t) => t.name)).toEqual(['design', 'front']);
  });

  it('offers creation only for a new, non-empty name', () => {
    expect(canCreateTag(tags, 'relecture')).toBe(true);
    expect(canCreateTag(tags, '  ')).toBe(false);
    expect(canCreateTag(tags, 'Design')).toBe(false);
    expect(canCreateTag(tags, 'accessibilite')).toBe(false);
  });
});

describe('new tag colour', () => {
  it('takes the first free colour from blue, slate last', () => {
    expect(newTagColor([])).toBe('blue');
    expect(newTagColor(['blue', 'cyan'])).toBe('teal');
    expect(newTagColor(['blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet'])).toBe(
      'slate',
    );
  });

  it('takes the least used colour once all are used', () => {
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
    expect(newTagColor(all)).toBe('blue');
    expect(newTagColor([...all, 'blue', 'cyan'])).toBe('teal');
  });
});
