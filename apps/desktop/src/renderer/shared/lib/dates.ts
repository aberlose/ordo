import type { CalendarDay } from '@ordo/domain';
import { format, isValid, parse, type Locale } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';

/** date-fns locale for the UI language (French by default). */
export function dateLocale(language: string | undefined): Locale {
  return language?.startsWith('en') ? enUS : fr;
}

/** Today as a calendar day in the user's time zone. */
export function today(now: Date = new Date()): CalendarDay {
  return format(now, 'yyyy-MM-dd');
}

/** A calendar day as a local Date at midnight (for the calendar widget). */
export function dayToDate(day: CalendarDay): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function dateToDay(date: Date): CalendarDay {
  return format(date, 'yyyy-MM-dd');
}

/** Short day for cards: "8 oct." / "Oct 8"; with the year in the detail window. */
export function formatDay(day: CalendarDay, language: string | undefined, withYear = false): string {
  return new Intl.DateTimeFormat(language ?? 'fr', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(dayToDate(day));
}

/** Short weekday or day for the date-picker shortcuts. */
export function formatHint(day: CalendarDay, todayDay: CalendarDay, language: string | undefined): string {
  const date = dayToDate(day);
  const diff = Math.round((date.getTime() - dayToDate(todayDay).getTime()) / 86_400_000);
  return diff >= 0 && diff < 7
    ? new Intl.DateTimeFormat(language ?? 'fr', { weekday: 'short' }).format(date)
    : formatDay(day, language);
}

/** The locale's numeric date pattern, e.g. "dd/MM/yyyy" in French, "MM/dd/yyyy" in English. */
export function typedDatePattern(language: string | undefined): string {
  return language?.startsWith('en') ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
}

export function formatTyped(day: CalendarDay, language: string | undefined): string {
  return format(dayToDate(day), typedDatePattern(language));
}

/** Parses a typed date in the locale's pattern; `null` when it is not a real date. */
export function parseTyped(text: string, language: string | undefined): CalendarDay | null {
  const value = text.trim();
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return null;
  const date = parse(value, typedDatePattern(language).replace('dd', 'd').replace('MM', 'M'), new Date());
  return isValid(date) ? dateToDay(date) : null;
}

/** "il y a 2 h" / "2 hr. ago"; falls back to a date after a week. */
export function formatRelative(at: number, now: number, language: string | undefined): string {
  const lng = language ?? 'fr';
  const seconds = Math.round((at - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day');
  return formatDay(dateToDay(new Date(at)), lng, true);
}
