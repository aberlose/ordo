import { COLUMN_COLORS, type ColumnColor, type ColumnIconName } from '@ordo/domain';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@renderer/i18n';
import { cn } from '@renderer/shared/lib/cn';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { COLUMN_ICON_NAMES, COLUMN_ICONS, ColumnIcon, foldText } from '@renderer/shared/ui/column-icon';
import { PopoverClose, PopoverContent } from '@renderer/shared/ui/popover';
import { radioGroupKeyDown } from '@renderer/shared/ui/radio-group-keys';

/**
 * Building blocks of the 340 px settings popover shared by columns (column-settings/ColumnSettings)
 * and boards (boards/BoardCreate A): the panel, its header, the name field prefixed with the icon,
 * the 10 colours and the searchable icon grid.
 */

const ICONS_PER_ROW = 8;

/** The floating panel: labelled by its title, the first field takes the focus. */
export function SettingsPopoverContent({
  titleId,
  className,
  ...props
}: ComponentProps<typeof PopoverContent> & { titleId: string }) {
  return (
    <PopoverContent
      aria-labelledby={titleId}
      // The name field takes the focus, not the close button.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('input')?.focus();
      }}
      // Escape in a filled icon search clears it rather than closing the popover.
      onEscapeKeyDown={(event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.type === 'search' && target.value) {
          event.preventDefault();
        }
      }}
      className={cn(
        'flex max-h-(--radix-popover-content-available-height) w-popover flex-col rounded-popover',
        className,
      )}
      {...props}
    />
  );
}

/** Title and close button of a settings popover. */
export function SettingsHeader({ titleId, title }: { titleId: string; title: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 border-b border-border pt-3.5 pr-3 pb-3 pl-4">
      <h2 id={titleId} className="m-0 flex-1 text-title font-semibold">
        {title}
      </h2>
      <PopoverClose
        aria-label={t('columnSettings.close')}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-3 hover:bg-rail hover:text-text-2"
      >
        <X size={15} aria-hidden />
      </PopoverClose>
    </div>
  );
}

/** Name input prefixed with the chosen icon in the chosen colour. */
export function NameField({
  label,
  icon,
  color,
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'color'> & { label: string; icon: ColumnIconName; color: ColumnColor }) {
  return (
    <label className={cn('block', className)}>
      <FieldLabel>{label}</FieldLabel>
      <span className="flex h-9.5 items-center gap-2 rounded-lg border-strong border-border-strong bg-surface px-2.5 focus-within:border-accent">
        <ColumnIcon
          icon={icon}
          size={15}
          strokeWidth={2.2}
          style={{ color: columnColorVar(color) }}
          aria-hidden
        />
        <input
          required
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-text-3"
          {...input}
        />
      </span>
    </label>
  );
}

/** The 10 user-pickable colours, a radio group with arrow keys. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: ColumnColor;
  onChange: (color: ColumnColor) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <FieldLabel id={id}>{t('columnSettings.color')}</FieldLabel>
      <div
        role="radiogroup"
        aria-labelledby={id}
        onKeyDown={(event) => radioGroupKeyDown(event)}
        className="flex flex-wrap gap-1.5"
      >
        {COLUMN_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={t(`colors.${c}`)}
            title={t(`colors.${c}`)}
            tabIndex={c === value ? 0 : -1}
            onClick={() => onChange(c)}
            // Selected: a ring in the colour; keyboard focus: the accent outline around it.
            className="size-6 cursor-pointer rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
            style={{
              background: columnColorVar(c),
              boxShadow: c === value ? `0 0 0 2px var(--surface), 0 0 0 4px ${columnColorVar(c)}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface IconEntry {
  name: ColumnIconName;
  label: string;
  haystack: string;
}

/**
 * Searchable grid of the icon catalogue, 8 per row (accent-insensitive, current language + English).
 * The selected icon is scrolled into view when the popover opens.
 */
export function IconPicker({
  icon,
  color,
  query,
  onQuery,
  onPick,
  searchPlaceholder,
  order = COLUMN_ICON_NAMES,
}: {
  /** Display order of the catalogue (boards put board-like icons first); defaults to the catalogue's. */
  order?: readonly ColumnIconName[];
  icon: ColumnIconName;
  color: ColumnColor;
  query: string;
  onQuery: (query: string) => void;
  onPick: (icon: ColumnIconName) => void;
  searchPlaceholder: string;
}) {
  const { t, i18n: instance } = useTranslation();
  const ids = useId();
  const colorVar = columnColorVar(color);
  const gridRef = useRef<HTMLDivElement>(null);
  // Mounted when the popover opens: bring the selected icon into the 148 px grid once.
  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, []);
  const language = instance.language;
  const entries = useMemo<IconEntry[]>(() => {
    const english = i18n.getFixedT('en');
    const local = i18n.getFixedT(language);
    return order.map((name) => {
      const words = local(`icons.${name}`);
      return {
        name,
        label: words.split(',')[0]?.trim() ?? name,
        haystack: foldText(`${words} ${english(`icons.${name}`)} ${name}`),
      };
    });
  }, [language, order]);
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  const shown = entries.filter((entry) => terms.every((term) => entry.haystack.includes(term)));
  const tabbable = shown.some((entry) => entry.name === icon) ? icon : shown[0]?.name;

  return (
    <div>
      <FieldLabel id={`${ids}-label`} className="flex justify-between">
        {t('columnSettings.icon')}
        <span className="font-normal text-text-3">
          {t('columnSettings.iconCount', { count: shown.length })}
        </span>
      </FieldLabel>
      <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 focus-within:border-accent">
        <Search size={14} className="text-text-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter searches; it must not submit the settings. Escape clears a filled search.
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              onQuery('');
            }
          }}
          aria-label={t('columnSettings.iconSearch')}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-meta outline-none placeholder:text-text-3"
        />
      </label>
      {shown.length > 0 ? (
        <div
          ref={gridRef}
          role="radiogroup"
          aria-labelledby={`${ids}-label`}
          onKeyDown={(event) => radioGroupKeyDown(event, ICONS_PER_ROW)}
          className="grid max-h-icon-grid grid-cols-8 gap-1 overflow-y-auto p-1"
        >
          {shown.map((entry) => {
            const Icon = COLUMN_ICONS[entry.name];
            const selected = entry.name === icon;
            return (
              <button
                key={entry.name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={entry.label}
                title={entry.label}
                tabIndex={entry.name === tabbable ? 0 : -1}
                onClick={() => onPick(entry.name)}
                className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-text-2 hover:bg-rail"
                style={
                  selected
                    ? {
                        borderColor: colorVar,
                        color: colorVar,
                        background: `color-mix(in srgb, ${colorVar} 12%, var(--surface))`,
                      }
                    : undefined
                }
              >
                {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
              </button>
            );
          })}
        </div>
      ) : (
        <Hint>{t('columnSettings.noIcon')}</Hint>
      )}
    </div>
  );
}

export function FieldLabel({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span id={id} className={cn('mb-1.5 block text-small font-semibold text-text-2', className)}>
      {children}
    </span>
  );
}

export function Hint({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={cn('mt-1.5 text-small leading-snug text-text-3', className)}>
      {children}
    </div>
  );
}
