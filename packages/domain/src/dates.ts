/** A calendar day, `YYYY-MM-DD`, with no time and no time zone. */
export type CalendarDay = string;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDay(value: string): value is CalendarDay {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function toDayNumber(day: CalendarDay): number {
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  return Math.round(toDayNumber(to) - toDayNumber(from));
}

/** Days a due date is overdue on `today`; 0 when not overdue or when there is no due date. */
export function daysOverdue(due: CalendarDay | null, today: CalendarDay): number {
  if (due === null) return 0;
  return Math.max(0, daysBetween(due, today));
}

export function isDueWithin(due: CalendarDay | null, today: CalendarDay, days: number): boolean {
  if (due === null) return false;
  const diff = daysBetween(today, due);
  return diff >= 0 && diff <= days;
}
