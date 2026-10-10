import { describe, expect, it } from 'vitest';
import { formatDay, formatTyped, parseTyped, today } from './dates';

describe('renderer date helpers', () => {
  it('formats short days per language', () => {
    expect(formatDay('2026-10-08', 'fr')).toBe('8 oct.');
    expect(formatDay('2026-10-08', 'en')).toBe('Oct 8');
    expect(formatDay('2026-10-08', 'fr', true)).toBe('8 oct. 2026');
  });

  it('parses and formats typed dates in the locale pattern', () => {
    expect(parseTyped('17/10/2026', 'fr')).toBe('2026-10-17');
    expect(parseTyped('1/2/2026', 'fr')).toBe('2026-02-01');
    expect(parseTyped('10/17/2026', 'en')).toBe('2026-10-17');
    expect(parseTyped('31/02/2026', 'fr')).toBeNull();
    expect(parseTyped('demain', 'fr')).toBeNull();
    expect(formatTyped('2026-10-17', 'fr')).toBe('17/10/2026');
    expect(formatTyped('2026-10-17', 'en')).toBe('10/17/2026');
  });

  it('gives today as a local calendar day', () => {
    expect(today(new Date(2026, 9, 10, 23, 30))).toBe('2026-10-10');
  });
});
