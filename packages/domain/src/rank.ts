/**
 * Fractional ranking (ADR 0005).
 *
 * A rank is a string of base-62 digits compared with plain string comparison.
 * `rankBetween(a, b)` returns a key strictly between `a` and `b`, so moving an
 * item only rewrites that item's rank. Adapted from the fractional-indexing
 * algorithm (Evan Wallace / Rocicorp), fractional part only.
 */
export type Rank = string;

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS.charAt(0);

function digitAt(key: string, index: number): string {
  return key.charAt(index) || ZERO;
}

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new RangeError(`rank ${a} must sort before ${b}`);
  }
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new RangeError('a rank never ends with the zero digit');
  }
  if (b !== null) {
    let n = 0;
    while (digitAt(a, n) === b.charAt(n)) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a.charAt(0)) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length;
  if (digitB - digitA > 1) {
    return DIGITS.charAt(Math.round((digitA + digitB) / 2));
  }
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS.charAt(digitA) + midpoint(a.slice(1), null);
}

/** A rank strictly between `before` and `after`; `null` means "no neighbour on that side". */
export function rankBetween(before: Rank | null, after: Rank | null): Rank {
  return midpoint(before ?? '', after);
}

/** `count` increasing ranks placed after `after` (or from the start). */
export function ranksAfter(after: Rank | null, count: number): Rank[] {
  const ranks: Rank[] = [];
  let previous = after;
  for (let i = 0; i < count; i += 1) {
    previous = rankBetween(previous, null);
    ranks.push(previous);
  }
  return ranks;
}

/** Rank for an item appended after the current last one (`null` for an empty list). */
export function rankAtEnd(last: Rank | null): Rank {
  return rankBetween(last, null);
}
