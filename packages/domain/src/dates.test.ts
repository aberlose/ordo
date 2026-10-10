import { describe, expect, it } from 'vitest';
import { daysOverdue, isCalendarDay, isDueWithin } from './dates';

describe('calendar days', () => {
  it('validates YYYY-MM-DD', () => {
    expect(isCalendarDay('2026-10-08')).toBe(true);
    expect(isCalendarDay('2026-02-30')).toBe(false);
    expect(isCalendarDay('8/10/2026')).toBe(false);
  });

  it('counts overdue days', () => {
    expect(daysOverdue('2026-10-08', '2026-10-10')).toBe(2);
    expect(daysOverdue('2026-10-12', '2026-10-10')).toBe(0);
    expect(daysOverdue(null, '2026-10-10')).toBe(0);
  });

  it('crosses daylight-saving changes without drifting', () => {
    expect(daysOverdue('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('detects due dates within a window', () => {
    expect(isDueWithin('2026-10-14', '2026-10-10', 7)).toBe(true);
    expect(isDueWithin('2026-10-09', '2026-10-10', 7)).toBe(false);
    expect(isDueWithin(null, '2026-10-10', 7)).toBe(false);
  });
});
