import { DATE_SHORTCUTS, resolveShortcut, type CalendarDay, type DateShortcut } from '@ordo/domain';
import { format } from 'date-fns';
import { useId, useState, type ReactNode } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { enUS, fr } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import {
  dateLocale,
  dateToDay,
  dayToDate,
  formatDay,
  formatHint,
  formatTyped,
  parseTyped,
} from '@renderer/shared/lib/dates';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/shared/ui/popover';

export interface DatePickerProps {
  /** Accessible name of the popover, e.g. "Choisir l'échéance". */
  label: string;
  value: CalendarDay | null;
  today: CalendarDay;
  onChange: (day: CalendarDay | null) => void;
  /** Days that cannot be picked (a due date before the start date, a start date after the due date). */
  notBefore?: CalendarDay | null;
  notAfter?: CalendarDay | null;
  /** Start → due period tinted in the calendar. */
  period?: { start: CalendarDay | null; due: CalendarDay | null };
  /** The trigger button. */
  children: ReactNode;
}

const SHORTCUT_KEYS: Record<DateShortcut, string> = {
  today: 'date.today',
  tomorrow: 'date.tomorrow',
  nextMonday: 'date.nextMonday',
  inOneWeek: 'date.inOneWeek',
  endOfMonth: 'date.endOfMonth',
};

/**
 * Approved mockup: tasks/DatePicker variant B — shortcuts on the left, a typed field above
 * a one-month calendar, the start → due period tinted.
 */
export function DatePicker({
  label,
  value,
  today,
  onChange,
  notBefore,
  notAfter,
  period,
  children,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  /** Why the typed date was refused, if it was. */
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const [month, setMonth] = useState(() => dayToDate(value ?? today));

  const allowed = (day: CalendarDay) => (!notBefore || day >= notBefore) && (!notAfter || day <= notAfter);

  const refusal = (day: CalendarDay): string | null => {
    if (notBefore && day < notBefore)
      return t('date.notBefore', { date: formatDay(notBefore, language, true) });
    if (notAfter && day > notAfter) return t('date.notAfter', { date: formatDay(notAfter, language, true) });
    return null;
  };

  const pick = (day: CalendarDay | null) => {
    const refused = day === null ? null : refusal(day);
    if (refused) {
      setError(refused);
      return;
    }
    onChange(day);
    setOpen(false);
  };

  const disabled: Matcher[] = [];
  if (notBefore) disabled.push({ before: dayToDate(notBefore) });
  if (notAfter) disabled.push({ after: dayToDate(notAfter) });

  const start = period?.start ?? null;
  const due = period?.due ?? null;
  const inPeriod = start && due ? { from: dayToDate(start), to: dayToDate(due) } : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setTyped(value ? formatTyped(value, language) : '');
          setError(null);
          setMonth(dayToDate(value ?? today));
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent aria-label={label} className="flex">
        <div className="flex w-42 flex-col gap-px border-r border-border bg-canvas px-1.5 py-2">
          {DATE_SHORTCUTS.map((shortcut) => {
            const day = resolveShortcut(shortcut, today);
            return (
              <button
                key={shortcut}
                type="button"
                disabled={!allowed(day)}
                onClick={() => pick(day)}
                className="flex h-7.5 items-center gap-2 rounded-md px-2.5 text-left text-meta whitespace-nowrap hover:bg-rail disabled:opacity-40"
              >
                <span className="flex-1">{t(SHORTCUT_KEYS[shortcut])}</span>
                <span className="text-caption text-text-3">{formatHint(day, today, language)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex h-7.5 items-center rounded-md px-2.5 text-left text-meta text-text-3 hover:bg-rail"
          >
            {t('date.none')}
          </button>
        </div>

        <div className="flex w-67 flex-col gap-2 px-3 pt-2.5 pb-3">
          <label
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg border px-2.5',
              error
                ? 'border-danger'
                : 'border-border-strong focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft',
            )}
          >
            <input
              value={typed}
              aria-label={label}
              aria-invalid={error !== null || undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setTyped(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (typed.trim() === '') return pick(null);
                const day = parseTyped(typed, language);
                if (day) pick(day);
                else setError(t('date.unreadable', { pattern: t('date.pattern') }));
              }}
              className="min-w-0 flex-1 bg-transparent text-body tabular-nums outline-none"
            />
            <span className="text-caption text-text-3">{t('date.pattern')}</span>
          </label>
          <span id={errorId} aria-live="polite" className="text-small text-danger empty:hidden">
            {error}
          </span>

          <DayPicker
            mode="single"
            locale={language?.startsWith('en') ? enUS : fr}
            formatters={{
              // One-letter weekdays, as in the approved mockup (L M M J V S D / M T W T F S S).
              formatWeekdayName: (date) =>
                format(date, 'EEEEE', { locale: dateLocale(language) }).toUpperCase(),
            }}
            selected={value ? dayToDate(value) : undefined}
            onSelect={(date) => date && pick(dateToDay(date))}
            month={month}
            onMonthChange={setMonth}
            showOutsideDays
            navLayout="around"
            disabled={disabled}
            today={dayToDate(today)}
            modifiers={{
              period: inPeriod ?? [],
              periodStart: start ? dayToDate(start) : [],
              weekend: { dayOfWeek: [0, 6] },
              periodEnd: due ? dayToDate(due) : [],
            }}
            classNames={{
              root: 'text-body',
              months: 'flex',
              month: 'grid w-full grid-cols-[auto_1fr_auto] items-center gap-y-2',
              month_caption: 'col-start-2 row-start-1 flex h-7 items-center justify-center',
              caption_label: 'text-body font-semibold',
              button_previous:
                'col-start-1 row-start-1 flex size-7 items-center justify-center rounded-md text-text-2 hover:bg-rail disabled:opacity-40',
              button_next:
                'col-start-3 row-start-1 flex size-7 items-center justify-center rounded-md text-text-2 hover:bg-rail disabled:opacity-40',
              chevron: 'size-3.5 fill-current',
              month_grid: 'col-span-3 w-full border-collapse',
              weekday: 'h-6.5 text-caption font-medium text-text-3',
              week: 'mt-0.5',
              day: 'p-0 text-center',
              day_button:
                'mx-auto flex size-8 items-center justify-center rounded-lg text-meta tabular-nums hover:bg-rail disabled:cursor-not-allowed',
              outside: 'text-text-3',
              disabled: 'opacity-40',
            }}
            modifiersClassNames={{
              period: 'bg-accent-soft',
              periodStart:
                'rounded-l-lg [&>button]:ring-[1.5px] [&>button]:ring-accent/45 [&>button]:ring-inset',
              weekend: 'text-text-2',
              periodEnd: 'rounded-r-lg',
              today:
                '[&>button]:font-semibold [&>button]:ring-[1.5px] [&>button]:ring-accent [&>button]:ring-inset',
              selected:
                '[&>button]:bg-accent [&>button]:font-semibold [&>button]:text-accent-fg [&>button]:hover:bg-accent',
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
