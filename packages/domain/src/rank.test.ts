import { describe, expect, it } from 'vitest';
import { rankBetween, ranksAfter } from './rank';

describe('rankBetween', () => {
  it('creates a first rank', () => {
    expect(rankBetween(null, null)).toBe('V');
  });

  it('places a rank before, after and between neighbours', () => {
    const a = rankBetween(null, null);
    const before = rankBetween(null, a);
    const after = rankBetween(a, null);
    const middle = rankBetween(before, a);
    expect(before < a && a < after).toBe(true);
    expect(before < middle && middle < a).toBe(true);
  });

  it('keeps ordering after many inserts at the same spot', () => {
    let low = rankBetween(null, null);
    const high = rankBetween(low, null);
    for (let i = 0; i < 200; i += 1) {
      const next = rankBetween(low, high);
      expect(low < next && next < high).toBe(true);
      low = next;
    }
  });

  it('keeps ordering when always inserting at the top', () => {
    let top = rankBetween(null, null);
    for (let i = 0; i < 200; i += 1) {
      const next = rankBetween(null, top);
      expect(next < top).toBe(true);
      top = next;
    }
  });

  it('rejects neighbours in the wrong order', () => {
    expect(() => rankBetween('b', 'a')).toThrow(RangeError);
  });
});

describe('ranksAfter', () => {
  it('returns increasing ranks', () => {
    const ranks = ranksAfter(null, 3);
    expect(ranks).toHaveLength(3);
    expect([...ranks].sort()).toEqual(ranks);
  });
});
