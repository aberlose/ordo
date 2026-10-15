import type { Column } from '@ordo/contracts';
import {
  COLUMN_CATEGORIES,
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
import { Trash2 } from 'lucide-react';
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
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { Popover, PopoverClose, PopoverTrigger } from '@renderer/shared/ui/popover';
import { radioGroupKeyDown } from '@renderer/shared/ui/radio-group-keys';
import { useCreateColumn, useDeleteColumn, useUpdateColumn } from '../hooks/queries';
import {
  ColorPicker,
  FieldLabel,
  Hint,
  IconPicker,
  NameField,
  SettingsHeader,
  SettingsPopoverContent,
} from './SettingsPopover';

/** Display limit offered when "No limit" is unticked on a column that had none. */
const DEFAULT_LIMIT = 10;

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
      <SettingsPopoverContent
        align={align}
        titleId={titleId}
        onCloseAutoFocus={(event) => {
          if (deleted.current) event.preventDefault();
        }}
      >
        <ColumnSettingsForm
          {...props}
          titleId={titleId}
          onDeleted={() => (deleted.current = true)}
          onDone={() => setOpen(false)}
        />
      </SettingsPopoverContent>
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
      <SettingsHeader
        titleId={titleId}
        title={t(column ? 'columnSettings.title' : 'columnSettings.newTitle')}
      />

      {/* While the delete confirmation shows, the settings cannot be changed or saved. */}
      <div inert={confirming} className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto p-4">
        <NameField
          label={t('columnSettings.name')}
          icon={icon}
          color={color}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('columnSettings.namePlaceholder')}
          maxLength={COLUMN_NAME_MAX_LENGTH}
        />

        <ColorPicker value={color} onChange={setColor} />

        <IconPicker
          icon={icon}
          color={color}
          query={query}
          onQuery={setQuery}
          onPick={setIcon}
          searchPlaceholder={t('columnSettings.iconSearchPlaceholder')}
        />

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
