import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('translations', () => {
  it('have the same keys in French and English', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});
