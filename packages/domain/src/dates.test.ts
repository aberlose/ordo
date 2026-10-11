import { describe, expect, it } from 'vitest';
import { addDays, areDatesOrdered, daysOverdue, isCalendarDay, isDueWithin, resolveShortcut } from './dates';

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

describe('date arithmetic', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('resolves picker shortcuts from a given today', () => {
    // 2026-10-10 is a Saturday
    expect(resolveShortcut('today', '2026-10-10')).toBe('2026-10-10');
    expect(resolveShortcut('tomorrow', '2026-10-10')).toBe('2026-10-11');
    expect(resolveShortcut('nextMonday', '2026-10-10')).toBe('2026-10-12');
    expect(resolveShortcut('nextMonday', '2026-10-12')).toBe('2026-10-19');
    expect(resolveShortcut('inOneWeek', '2026-10-10')).toBe('2026-10-17');
    expect(resolveShortcut('endOfMonth', '2026-02-10')).toBe('2026-02-28');
    expect(resolveShortcut('endOfMonth', '2028-02-10')).toBe('2028-02-29');
  });

  it('requires the due date not to precede the start date', () => {
    expect(areDatesOrdered('2026-10-02', '2026-10-17')).toBe(true);
    expect(areDatesOrdered('2026-10-17', '2026-10-17')).toBe(true);
    expect(areDatesOrdered('2026-10-18', '2026-10-17')).toBe(false);
    expect(areDatesOrdered(null, '2026-10-17')).toBe(true);
    expect(areDatesOrdered('2026-10-18', null)).toBe(true);
  });
});
