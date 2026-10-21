import type { BoardDetail } from '@ordo/contracts';
import {
  DUE_FILTERS,
  hasActiveFilters,
  PRIORITIES,
  type CalendarDay,
  type DueFilter,
  type Priority,
  type TaskFilters,
} from '@ordo/domain';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { cn } from '@renderer/shared/lib/cn';
import { modKey } from '@renderer/shared/lib/platform';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@renderer/shared/ui/dropdown-menu';
import { Kbd } from '@renderer/shared/ui/kbd';
import { PriorityBars } from '@renderer/shared/ui/priority-bars';
import { effectiveFilters, optionCounts } from '../filtering';
import { useBoardFilters, useSearchStore, type FilterKind } from '../store';

/** Priorities as the menu lists them: highest first (approved board mockup). */
const PRIORITIES_DESC: readonly Priority[] = [...PRIORITIES].reverse();

export interface FilterBarProps {
  board: BoardDetail;
  today: CalendarDay;
  /** Cards shown under the current filters. */
  shownCount: number;
  /** Whether cards may be hidden (active filters or the palette's preview): "N sur M tâches". */
  filtered: boolean;
  /** Stories: a menu open from the start. */
  defaultOpenMenu?: FilterKind;
}

interface Option {
  key: string;
  label: string;
  count: number;
  checked: boolean;
  toggle: () => void;
  mark?: ReactNode;
}

/** A filter button: label with its values when active, its checkbox menu, and a clear ×. */
function FilterButton({
  name,
  title,
  values,
  options,
  disabled,
  defaultOpen,
  onClear,
}: {
  name: string;
  title: string;
  values: readonly string[];
  options: readonly Option[];
  disabled: boolean;
  defaultOpen: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const active = values.length > 0;
  return (
    <div
      className={cn(
        'flex h-7.5 items-center rounded-lg border',
        active ? 'border-accent bg-accent-soft text-text' : 'border-border bg-surface text-text-2',
      )}
    >
      <DropdownMenu modal={false} defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg pr-2 pl-3 text-meta disabled:cursor-default"
          >
            {active ? t('filters.active', { name, values: values.join(', ') }) : name}
            <ChevronDown size={14} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-menu min-w-0">
          <Menu.Label className="px-2 py-1.5 text-caption font-medium text-text-3">{title}</Menu.Label>
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-meta text-text-3">{t('filters.noTags')}</div>
          )}
          {options.map((option) => (
            <Menu.CheckboxItem
              key={option.key}
              checked={option.checked}
              // The menu stays open while toggling (several values at once).
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={option.toggle}
              aria-label={t('filters.option', { label: option.label, count: option.count })}
              className="group flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-meta outline-none select-none data-[highlighted]:bg-rail data-[state=checked]:bg-accent-soft"
            >
              <span
                aria-hidden
                className="flex size-3.5 shrink-0 items-center justify-center rounded-xs border border-border-strong bg-surface text-accent-fg group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent"
              >
                <Menu.ItemIndicator>
                  <Check size={11} strokeWidth={3} />
                </Menu.ItemIndicator>
              </span>
              {option.mark}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span aria-hidden className="text-small text-text-3 tabular-nums">
                {option.count}
              </span>
            </Menu.CheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          type="button"
          aria-label={t('filters.clear', { name })}
          onClick={onClear}
          className="flex size-7 cursor-pointer items-center justify-center border-l border-accent"
        >
          <X size={12} strokeWidth={2.4} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * The board's filter bar (approved board mockup): Priority, Tags and Due date checkbox menus with
 * per-option counts over every card, the text filter chip, "ou tapez un filtre ⌘K", the result count
 * and "Effacer les filtres". Disabled while the board has no task.
 */
export function FilterBar({ board, today, shownCount, filtered, defaultOpenMenu }: FilterBarProps) {
  const { t } = useTranslation();
  const boardId = board.id;
  const total = board.tasks.length;
  const disabled = total === 0;
  const tagIds = useMemo(() => new Set(board.tags.map((tag) => tag.id)), [board.tags]);
  const stored = useBoardFilters(boardId);
  const filters: TaskFilters = useMemo(() => effectiveFilters(stored, tagIds), [stored, tagIds]);
  const counts = useMemo(() => optionCounts(board.tasks, today), [board.tasks, today]);
  const { toggle, clearKind, clearText, clearAll } = useSearchStore.getState();

  const priorityLabel = (p: Priority) => t(`priority.${p}`);
  const dueLabel = (due: DueFilter) => t(`filters.due.${due}`);
  const tagName = (id: string) => board.tags.find((tag) => tag.id === id)?.name ?? '';

  const priorityOptions: Option[] = PRIORITIES_DESC.map((p) => ({
    key: String(p),
    label: priorityLabel(p),
    count: counts.priorities.get(p) ?? 0,
    checked: filters.priorities.includes(p),
    toggle: () => toggle(boardId, 'priorities', p),
    mark: <PriorityBars priority={p} />,
  }));
  const tagOptions: Option[] = board.tags.map((tag) => ({
    key: tag.id,
    label: tag.name,
    count: counts.tags.get(tag.id) ?? 0,
    checked: filters.tags.includes(tag.id),
    toggle: () => toggle(boardId, 'tags', tag.id),
    mark: (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: columnColorVar(tag.color) }}
      />
    ),
  }));
  const dueOptions: Option[] = DUE_FILTERS.map((due) => ({
    key: due,
    label: dueLabel(due),
    count: counts.due.get(due) ?? 0,
    checked: filters.due.includes(due),
    toggle: () => toggle(boardId, 'due', due),
  }));

  const buttons = [
    {
      kind: 'priorities' as const,
      name: t('board.priority'),
      title: t('filters.byPriority'),
      // Values in the menu's order, highest first.
      values: PRIORITIES_DESC.filter((p) => filters.priorities.includes(p)).map(priorityLabel),
      options: priorityOptions,
    },
    {
      kind: 'tags' as const,
      name: t('board.tags'),
      title: t('filters.byTag'),
      values: filters.tags.map((id) => `#${tagName(id)}`),
      options: tagOptions,
    },
    {
      kind: 'due' as const,
      name: t('board.due'),
      title: t('filters.byDue'),
      values: DUE_FILTERS.filter((due) => filters.due.includes(due)).map(dueLabel),
      options: dueOptions,
    },
  ];
  const text = filters.text.trim();

  return (
    <div
      role="group"
      aria-label={t('filters.group')}
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border px-6 py-3',
        disabled && 'opacity-50',
      )}
    >
      {buttons.map((button) => (
        <FilterButton
          key={button.kind}
          name={button.name}
          title={button.title}
          values={button.values}
          options={button.options}
          disabled={disabled}
          defaultOpen={defaultOpenMenu === button.kind}
          onClear={() => clearKind(boardId, button.kind)}
        />
      ))}
      {text !== '' && (
        <span className="flex h-7.5 items-center rounded-lg border border-accent bg-accent-soft text-meta text-text">
          <span className="pr-1.5 pl-3">{t('filters.text', { text })}</span>
          <button
            type="button"
            aria-label={t('filters.clearText')}
            onClick={() => clearText(boardId)}
            className="flex size-7 cursor-pointer items-center justify-center border-l border-accent"
          >
            <X size={12} strokeWidth={2.4} aria-hidden />
          </button>
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => usePalette.getState().openPalette()}
        className="flex h-7.5 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-meta text-text-3 hover:bg-rail disabled:cursor-default disabled:hover:bg-transparent"
      >
        {t('filters.typeFilter')}
        <Kbd className="bg-transparent text-text-3">{`${modKey()}K`}</Kbd>
      </button>
      <div className="flex-1" />
      <span className="text-meta text-text-3" aria-live="polite">
        {filtered
          ? t('filters.result', { shown: shownCount, count: total })
          : t('board.taskCount', { count: total })}
      </span>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => clearAll(boardId)}
          className="flex h-7 cursor-pointer items-center rounded-lg px-2.5 text-meta font-medium text-accent hover:bg-rail"
        >
          {t('filters.clearAll')}
        </button>
      )}
    </div>
  );
}
