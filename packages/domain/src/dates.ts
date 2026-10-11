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

function fromDayNumber(n: number): CalendarDay {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(day: CalendarDay, days: number): CalendarDay {
  return fromDayNumber(Math.round(toDayNumber(day)) + days);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekday(day: CalendarDay): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The next given weekday strictly after `day` (1 = Monday … 7 = Sunday). */
export function nextWeekday(day: CalendarDay, target: number): CalendarDay {
  const diff = (target - weekday(day) + 7) % 7;
  return addDays(day, diff === 0 ? 7 : diff);
}

export function endOfMonth(day: CalendarDay): CalendarDay {
  const [y, m] = day.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** A due date may not fall before the start date. Missing dates never conflict. */
export function areDatesOrdered(start: CalendarDay | null, due: CalendarDay | null): boolean {
  return start === null || due === null || start <= due;
}

/** Shortcuts offered by the date picker (approved mockup: tasks/DatePicker, variant B). */
export const DATE_SHORTCUTS = ['today', 'tomorrow', 'nextMonday', 'inOneWeek', 'endOfMonth'] as const;
export type DateShortcut = (typeof DATE_SHORTCUTS)[number];

export function resolveShortcut(shortcut: DateShortcut, today: CalendarDay): CalendarDay {
  switch (shortcut) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    case 'nextMonday':
      return nextWeekday(today, 1);
    case 'inOneWeek':
      return addDays(today, 7);
    case 'endOfMonth':
      return endOfMonth(today);
  }
}
