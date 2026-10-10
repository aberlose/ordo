import { describe, expect, it } from 'vitest';
import { isPurgeable } from './trash';

describe('trash retention', () => {
  const day = 86_400_000;
  it('keeps items for 30 days', () => {
    expect(isPurgeable(0, 29 * day)).toBe(false);
    expect(isPurgeable(0, 30 * day)).toBe(true);
  });
});
