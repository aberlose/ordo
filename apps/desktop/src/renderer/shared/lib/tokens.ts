/**
 * A size token set in pixels on `:root` (styles/index.css), read at run time by code that places
 * floating parts itself. `fallback` (the token's value) when it cannot be read (tests, no styles).
 */
export function tokenPx(name: `--${string}`, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}
