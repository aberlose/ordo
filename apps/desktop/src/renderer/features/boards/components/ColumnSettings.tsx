import type { Column } from '@ordo/contracts';
import {
  COLUMN_CATEGORIES,
  COLUMN_COLORS,
  COLUMN_NAME_MAX_LENGTH,
  DISPLAY_LIMIT_MAX,
  DISPLAY_LIMIT_MIN,
  newColumnDefaults,
  normalizeColumnName,
  type ColumnCategory,
  type ColumnColor,
  type ColumnIconName,
  isColumnIconName,
} from '@ordo/domain';
import { Search, Trash2, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@renderer/i18n';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { COLUMN_ICON_NAMES, COLUMN_ICONS, ColumnIcon, foldText } from '@renderer/shared/ui/column-icon';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@renderer/shared/ui/popover';
import { radioGroupKeyDown } from '@renderer/shared/ui/radio-group-keys';
import { useCreateColumn, useDeleteColumn, useUpdateColumn } from '../hooks/queries';

/** Display limit offered when "No limit" is unticked on a column that had none. */
const DEFAULT_LIMIT = 10;
const ICONS_PER_ROW = 8;

const CATEGORY_LABEL: Record<ColumnCategory, string> = {
  todo: 'column.todo',
  in_progress: 'column.inProgress',
  done: 'column.done',
};

export interface ColumnSettingsProps {
  boardId: string;
  /** The column to edit, or `null` to add one at the right end of the board. */
  column: Column | null;
  /** Colours already used on the board: a new column takes the first free one. */
  usedColors: readonly ColumnColor[];
  /** Tasks of the column, named in the delete confirmation. */
  taskCount: number;
  /** A board keeps at least one column. */
  canDelete: boolean;
  /** The button the popover hangs from (⋯ in the header, or "+ Nouvelle colonne"); highlighted while open. */
  trigger: ReactElement;
  align?: 'start' | 'end';
  /** Opened on first render (stories). */
  defaultOpen?: boolean;
}

/**
 * Column settings in a 340 px popover under the column's ⋯ button, or under "+ Nouvelle colonne" to
 * add one. Approved mockups: column-settings/ColumnSettings (popover) and ColumnStates A (delete).
 */
export function ColumnSettings({
  trigger,
  align = 'end',
  defaultOpen = false,
  ...props
}: ColumnSettingsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const titleId = useId();
  /** After a delete the trigger is gone: the next column's header takes the focus instead (see useDeleteColumn). */
  const deleted = useRef(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        aria-labelledby={titleId}
        // The name field takes the focus, not the close button.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('input')?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (deleted.current) event.preventDefault();
        }}
        // Escape in a filled icon search clears it rather than closing the settings.
        onEscapeKeyDown={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && target.type === 'search' && target.value) {
            event.preventDefault();
          }
        }}
        className="flex max-h-(--radix-popover-content-available-height) w-popover flex-col rounded-popover"
      >
        <ColumnSettingsForm
          {...props}
          titleId={titleId}
          onDeleted={() => (deleted.current = true)}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface FormProps extends Omit<ColumnSettingsProps, 'trigger' | 'align' | 'defaultOpen'> {
  titleId: string;
  onDeleted: () => void;
  onDone: () => void;
}

/** Mounted each time the popover opens, so it starts from the saved column. */
function ColumnSettingsForm({
  boardId,
  column,
  usedColors,
  taskCount,
  canDelete,
  titleId,
  onDeleted,
  onDone,
}: FormProps) {
  const { t } = useTranslation();
  const ids = useId();
  const initial = useMemo(() => column ?? newColumnDefaults(usedColors), [column, usedColors]);
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState<ColumnColor>(initial.color);
  const [icon, setIcon] = useState<ColumnIconName>(
    isColumnIconName(initial.icon) ? initial.icon : 'circle-dashed',
  );
  const [category, setCategory] = useState<ColumnCategory>(initial.category);
  const [limit, setLimit] = useState(initial.displayLimit ?? DEFAULT_LIMIT);
  const [noLimit, setNoLimit] = useState(initial.displayLimit === null);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  /** Set when the confirmation is cancelled: the focus goes back to "Supprimer". */
  const refocusDelete = useRef(false);
  useEffect(() => {
    if (confirming || !refocusDelete.current) return;
    refocusDelete.current = false;
    deleteRef.current?.focus();
  }, [confirming]);
  const create = useCreateColumn(boardId);
  const update = useUpdateColumn(boardId);
  const remove = useDeleteColumn(boardId);

  const normalized = normalizeColumnName(name);
  const displayLimit = noLimit ? null : limit;
  const colorVar = columnColorVar(color);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!normalized) return;
    if (!column) {
      create.mutate({ boardId, name: normalized, icon, color, category, displayLimit });
      onDone();
      return;
    }
    const patch = {
      ...(normalized !== column.name ? { name: normalized } : {}),
      ...(icon !== column.icon ? { icon } : {}),
      ...(color !== column.color ? { color } : {}),
      ...(category !== column.category ? { category } : {}),
      ...(displayLimit !== column.displayLimit ? { displayLimit } : {}),
    };
    if (Object.keys(patch).length > 0) update.mutate({ id: column.id, ...patch });
    onDone();
  };

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border pt-3.5 pr-3 pb-3 pl-4">
        <h2 id={titleId} className="m-0 flex-1 text-title font-semibold">
          {t(column ? 'columnSettings.title' : 'columnSettings.newTitle')}
        </h2>
        <PopoverClose
          aria-label={t('columnSettings.close')}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-3 hover:bg-rail hover:text-text-2"
        >
          <X size={15} aria-hidden />
        </PopoverClose>
      </div>

      {/* While the delete confirmation shows, the settings cannot be changed or saved. */}
      <div inert={confirming} className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto p-4">
        <label className="block">
          <FieldLabel>{t('columnSettings.name')}</FieldLabel>
          <span className="flex h-9.5 items-center gap-2 rounded-lg border-[1.5px] border-border-strong bg-surface px-2.5 focus-within:border-accent">
            <ColumnIcon icon={icon} size={15} strokeWidth={2.2} style={{ color: colorVar }} aria-hidden />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('columnSettings.namePlaceholder')}
              maxLength={COLUMN_NAME_MAX_LENGTH}
              required
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-text-3"
            />
          </span>
        </label>

        <div>
          <FieldLabel id={`${ids}-color`}>{t('columnSettings.color')}</FieldLabel>
          <div
            role="radiogroup"
            aria-labelledby={`${ids}-color`}
            onKeyDown={(event) => radioGroupKeyDown(event)}
            className="flex flex-wrap gap-1.5"
          >
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={t(`colors.${c}`)}
                title={t(`colors.${c}`)}
                tabIndex={c === color ? 0 : -1}
                onClick={() => setColor(c)}
                // Selected: a ring in the colour; keyboard focus: the accent outline around it.
                className="size-6 cursor-pointer rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
                style={{
                  background: columnColorVar(c),
                  boxShadow:
                    c === color ? `0 0 0 2px var(--surface), 0 0 0 4px ${columnColorVar(c)}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <IconPicker icon={icon} colorVar={colorVar} query={query} onQuery={setQuery} onPick={setIcon} />

        <div>
          <FieldLabel id={`${ids}-category`}>{t('columnSettings.category')}</FieldLabel>
          <div
            role="radiogroup"
            aria-labelledby={`${ids}-category`}
            aria-describedby={`${ids}-category-hint`}
            onKeyDown={(event) => radioGroupKeyDown(event)}
            className="flex gap-0.5 rounded-tile bg-rail p-0.75"
          >
            {COLUMN_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === category}
                tabIndex={c === category ? 0 : -1}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-7.5 flex-1 cursor-pointer rounded-md text-meta text-text-2',
                  c === category && 'bg-surface font-semibold text-text shadow-card',
                )}
              >
                {t(CATEGORY_LABEL[c])}
              </button>
            ))}
          </div>
          <Hint id={`${ids}-category-hint`}>{t(`columnSettings.categoryHint.${categoryKey(category)}`)}</Hint>
        </div>

        <div>
          <FieldLabel id={`${ids}-limit`}>{t('columnSettings.limit')}</FieldLabel>
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-labelledby={`${ids}-limit`}
              aria-describedby={`${ids}-limit-hint`}
              className={cn(
                'flex h-8.5 items-center rounded-lg border border-border',
                noLimit && 'opacity-45',
              )}
            >
              <StepButton
                label={t('columnSettings.fewer')}
                atBound={!noLimit && limit <= DISPLAY_LIMIT_MIN}
                onClick={() => {
                  setLimit(noLimit ? limit : limit - 1);
                  setNoLimit(false);
                }}
              >
                −
              </StepButton>
              <span aria-live="polite" className="w-9 text-center font-semibold tabular-nums">
                {noLimit ? '∞' : limit}
              </span>
              <StepButton
                label={t('columnSettings.more')}
                atBound={!noLimit && limit >= DISPLAY_LIMIT_MAX}
                onClick={() => {
                  setLimit(noLimit ? limit : limit + 1);
                  setNoLimit(false);
                }}
              >
                +
              </StepButton>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={noLimit}
                onChange={(event) => setNoLimit(event.target.checked)}
                className="m-0 accent-accent"
              />
              {t('columnSettings.noLimit')}
            </label>
          </div>
          <Hint id={`${ids}-limit-hint`}>
            {noLimit ? t('columnSettings.limitHintNone') : t('columnSettings.limitHint', { count: limit })}
          </Hint>
        </div>
      </div>

      {confirming && column ? (
        <div
          role="alertdialog"
          aria-labelledby={`${ids}-confirm`}
          aria-describedby={`${ids}-confirm-hint`}
          className="flex flex-col gap-2.5 border-t border-danger-line bg-danger-soft px-4 py-3"
        >
          <span id={`${ids}-confirm`} className="text-meta font-semibold text-danger">
            {t('columnSettings.deleteConfirm', { name: column.name, count: taskCount })}
          </span>
          <span id={`${ids}-confirm-hint`} className="text-small text-text-2">
            {t('columnSettings.deleteHint', { count: taskCount })}
          </span>
          <div className="flex justify-end gap-2">
            {/* The safe choice takes the focus. */}
            <Button
              autoFocus
              onClick={() => {
                refocusDelete.current = true;
                setConfirming(false);
              }}
            >
              {t('columnSettings.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDeleted();
                remove.mutate(column.id);
                onDone();
              }}
            >
              {t('columnSettings.delete')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            {column && (
              // The last column stays: the button keeps the focus and says why (decided 2026-10-14).
              <Button
                ref={deleteRef}
                variant="ghost"
                aria-disabled={!canDelete}
                aria-describedby={canDelete ? undefined : `${ids}-last`}
                onClick={() => canDelete && setConfirming(true)}
                className={cn(
                  'px-2 text-danger hover:bg-danger-soft',
                  !canDelete && 'cursor-default opacity-45 hover:bg-transparent',
                )}
              >
                <Trash2 size={14} aria-hidden />
                {t('columnSettings.delete')}
              </Button>
            )}
            <div className="flex-1" />
            <PopoverClose asChild>
              <Button>{t('columnSettings.cancel')}</Button>
            </PopoverClose>
            <Button type="submit" variant="primary" disabled={!normalized} className="px-3.5">
              {t(column ? 'columnSettings.save' : 'columnSettings.add')}
            </Button>
          </div>
          {column && !canDelete && (
            <span id={`${ids}-last`} className="text-small text-text-3">
              {t('columnSettings.lastColumn')}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

/** i18n key segment of a category (`in_progress` → `inProgress`). */
const categoryKey = (category: ColumnCategory) => (category === 'in_progress' ? 'inProgress' : category);

interface IconEntry {
  name: ColumnIconName;
  label: string;
  haystack: string;
}

/** Searchable grid of the icon catalogue, 8 per row (accent-insensitive, current language + English). */
function IconPicker({
  icon,
  colorVar,
  query,
  onQuery,
  onPick,
}: {
  icon: ColumnIconName;
  colorVar: string;
  query: string;
  onQuery: (query: string) => void;
  onPick: (icon: ColumnIconName) => void;
}) {
  const { t, i18n: instance } = useTranslation();
  const ids = useId();
  const language = instance.language;
  const entries = useMemo<IconEntry[]>(() => {
    const english = i18n.getFixedT('en');
    const local = i18n.getFixedT(language);
    return COLUMN_ICON_NAMES.map((name) => {
      const words = local(`icons.${name}`);
      return {
        name,
        label: words.split(',')[0]?.trim() ?? name,
        haystack: foldText(`${words} ${english(`icons.${name}`)} ${name}`),
      };
    });
  }, [language]);
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
          placeholder={t('columnSettings.iconSearchPlaceholder')}
          className="min-w-0 flex-1 border-0 bg-transparent text-meta outline-none placeholder:text-text-3"
        />
      </label>
      {shown.length > 0 ? (
        <div
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

function FieldLabel({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <span id={id} className={cn('mb-1.5 block text-small font-semibold text-text-2', className)}>
      {children}
    </span>
  );
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="mt-1.5 text-small leading-snug text-text-3">
      {children}
    </div>
  );
}

/** − / + of the display limit; at 1 or 99 it stays focusable (aria-disabled) so the focus is not lost. */
function StepButton({
  label,
  atBound,
  onClick,
  children,
}: {
  label: string;
  atBound: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={atBound}
      onClick={() => !atBound && onClick()}
      className="h-8 w-8.5 cursor-pointer border-0 bg-transparent text-base text-text-2 aria-disabled:cursor-default aria-disabled:opacity-45"
    >
      {children}
    </button>
  );
}
