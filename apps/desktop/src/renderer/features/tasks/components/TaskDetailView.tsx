import type { Column, Task, UpdateTaskInput } from '@ordo/contracts';
import { daysOverdue, PRIORITIES, type CalendarDay, type Priority } from '@ordo/domain';
import type { TFunction } from 'i18next';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  SquareKanban,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { dateToDay, formatDay, formatRelative } from '@renderer/shared/lib/dates';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@renderer/shared/ui/dropdown-menu';
import { PriorityBar } from '@renderer/shared/ui/priority-bars';
import { Feedback } from '@renderer/shared/ui/toast';
import { DatePicker } from './DatePicker';

export type TaskChange = Omit<UpdateTaskInput, 'id'>;

export interface TaskDetailViewProps {
  task: Task;
  boardName: string;
  columns: readonly Column[];
  today: CalendarDay;
  now: number;
  expanded: boolean;
  dark: boolean;
  onChange: (change: TaskChange) => void;
  onDelete: () => void;
  onClose: () => void;
  onToggleExpanded: () => void;
  onToggleTheme: () => void;
}

const iconButton =
  'flex size-8 items-center justify-center rounded-lg text-text-2 hover:bg-rail data-[state=open]:bg-rail';
const propButton =
  'flex h-8 items-center gap-2 rounded-md px-2 -ml-2 text-left text-body hover:bg-rail data-[state=open]:bg-rail';

function Property({ label, children, top = false }: { label: string; children: ReactNode; top?: boolean }) {
  return (
    <div className={cn('flex', top ? 'items-start' : 'items-center')}>
      <span className={cn('w-prop-label shrink-0 text-meta text-text-3', top && 'pt-1.75')}>{label}</span>
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </div>
  );
}

/** Title edited in place: Enter or leaving the field saves, Escape restores. Remounted (key) when the saved title changes. */
function TitleField({
  value,
  large,
  onSave,
}: {
  value: string;
  large: boolean;
  onSave: (title: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const title = draft.replace(/\s+/g, ' ').trim();
    if (title === '') setDraft(value);
    else if (title !== value) onSave(title);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(value);
      requestAnimationFrame(() => (event.target as HTMLTextAreaElement).blur());
    }
  };

  return (
    <textarea
      data-escape-local
      aria-label={t('task.title')}
      value={draft}
      rows={1}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        'w-full resize-none rounded-lg bg-transparent leading-tight font-semibold tracking-tight [field-sizing:content] focus-visible:outline-offset-4',
        large ? 'text-heading-lg' : 'text-heading',
      )}
    />
  );
}

/** Five buttons, one click (approved mockup: tasks/Menus, priority variant B). Keys 1–5 and arrows. */
function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const { t } = useTranslation();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(event.key);
    let next: number | null = null;
    if (digit >= 1 && digit <= 5) next = digit;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, value + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, value - 1);
    if (next === null) return;
    event.preventDefault();
    onChange(next as Priority);
    const target = event.currentTarget.querySelector<HTMLButtonElement>(`[data-priority="${next}"]`);
    target?.focus();
  };
  return (
    <div className="flex flex-col gap-1 py-1">
      <div role="radiogroup" aria-label={t('task.priority')} className="flex gap-0.75" onKeyDown={onKeyDown}>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            data-priority={p}
            aria-checked={p === value}
            aria-label={t(`priority.${p}`)}
            title={t(`priority.${p}`)}
            tabIndex={p === value ? 0 : -1}
            onClick={() => onChange(p)}
            className={cn(
              'flex h-6.5 w-7.5 items-end justify-center rounded-md border pb-1.5',
              p === value
                ? 'border-accent bg-accent-soft'
                : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <PriorityBar level={p} filled={value} />
          </button>
        ))}
      </div>
      <span className="text-small text-text-2">
        {t('task.priorityHint', { priority: t(`priority.${value}`) })}
      </span>
    </div>
  );
}

function modifiedLabel(at: number, now: number, language: string | undefined, t: TFunction): string {
  return now - at < 7 * 86_400_000
    ? t('task.modified', { when: formatRelative(at, now, language) })
    : t('task.modifiedOn', { date: formatDay(dateToDay(new Date(at)), language, true) });
}

function DateValue({
  day,
  empty,
  danger = false,
}: {
  day: CalendarDay | null;
  empty: string;
  danger?: boolean;
}) {
  const { i18n } = useTranslation();
  return (
    <>
      <CalendarDays size={14} className={danger ? 'text-danger' : 'text-text-3'} aria-hidden />
      {day ? (
        <span className={cn(danger && 'font-semibold text-danger')}>
          {formatDay(day, i18n.resolvedLanguage, true)}
        </span>
      ) : (
        <span className="text-text-3">{empty}</span>
      )}
    </>
  );
}

/**
 * Approved mockups: task-detail (centred window, expandable to full screen) and tasks/Menus,
 * tasks/DatePicker. Lot 1 shows the title and properties; notes, sub-tasks and attachments
 * arrive with their lots.
 */
export function TaskDetailView({
  task,
  boardName,
  columns,
  today,
  now,
  expanded,
  dark,
  onChange,
  onDelete,
  onClose,
  onToggleExpanded,
  onToggleTheme,
}: TaskDetailViewProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const column = columns.find((c) => c.id === task.columnId);
  const overdueBy = task.completedAt === null ? daysOverdue(task.dueDate, today) : 0;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if ((event.target as HTMLElement | null)?.closest('[data-escape-local]')) event.preventDefault();
          }}
          // Give the focus back to the task's card, visibly, however the window was closed (Escape,
          // ×, click outside): ⌥/Alt + arrows then work right away. The card may have changed column.
          onCloseAutoFocus={(event) => {
            const card = document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
            if (!card) return;
            event.preventDefault();
            card.focus({ focusVisible: true } as FocusOptions);
          }}
          className={cn(
            'fixed z-40 flex flex-col overflow-hidden bg-surface text-text outline-none',
            expanded
              ? 'inset-0'
              : 'inset-y-10 left-1/2 w-detail max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-window border border-border shadow-pop',
          )}
        >
          <div className="flex h-13 shrink-0 items-center gap-1.5 border-b border-border pr-3 pl-5">
            <SquareKanban size={14} className="text-accent" aria-hidden />
            <span className="text-meta text-text-2">{boardName}</span>
            <ChevronRight size={14} className="text-text-3" aria-hidden />
            {column && (
              <span className="flex items-center gap-1.5 text-meta text-text-2">
                <ColumnIcon
                  icon={column.icon}
                  size={13}
                  strokeWidth={2.2}
                  style={{ color: columnColorVar(column.color) }}
                />
                {column.name}
              </span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              className={iconButton}
              aria-label={t('board.toggleTheme')}
              onClick={onToggleTheme}
            >
              {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={t(expanded ? 'task.collapse' : 'task.expand')}
              title={t(expanded ? 'task.collapse' : 'task.expand')}
              onClick={onToggleExpanded}
            >
              {expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className={iconButton} aria-label={t('task.moreActions')}>
                <MoreHorizontal size={16} aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onSelect={onDelete} className="text-danger">
                  <Trash2 size={14} aria-hidden />
                  {t('task.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog.Close className={iconButton} aria-label={t('task.close')}>
              <X size={16} aria-hidden />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                'mx-auto grid grid-cols-[minmax(0,1fr)_var(--spacing-detail-props)] items-start gap-x-10 gap-y-6.5',
                expanded ? 'max-w-detail-full px-12 pt-10 pb-16' : 'px-9 pt-8 pb-12',
              )}
            >
              <Dialog.Title asChild>
                <div>
                  <TitleField
                    key={task.title}
                    value={task.title}
                    large={expanded}
                    onSave={(title) => onChange({ title })}
                  />
                </div>
              </Dialog.Title>

              <div className="row-span-2 flex flex-col gap-0.5 rounded-xl border border-border bg-canvas px-4 py-3.5">
                <Property label={t('task.status')}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={propButton}
                      aria-label={t('task.propertyValue', {
                        label: t('task.status'),
                        value: column?.name ?? '',
                      })}
                    >
                      {column && (
                        <ColumnIcon
                          icon={column.icon}
                          size={14}
                          strokeWidth={2.2}
                          style={{ color: columnColorVar(column.color) }}
                        />
                      )}
                      {column?.name}
                      <ChevronDown size={14} className="text-text-3" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent aria-label={t('task.status')}>
                      <DropdownMenuRadioGroup
                        value={task.columnId}
                        onValueChange={(columnId) => columnId !== task.columnId && onChange({ columnId })}
                      >
                        {columns.map((c) => (
                          <DropdownMenuRadioItem key={c.id} value={c.id}>
                            <ColumnIcon
                              icon={c.icon}
                              size={14}
                              strokeWidth={2.2}
                              style={{ color: columnColorVar(c.color) }}
                            />
                            {c.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Property>

                <Property label={t('task.priority')}>
                  <PriorityPicker value={task.priority} onChange={(priority) => onChange({ priority })} />
                </Property>

                <Property label={t('task.start')}>
                  <DatePicker
                    label={t('date.pickStart')}
                    value={task.startDate}
                    today={today}
                    notAfter={task.dueDate}
                    period={{ start: task.startDate, due: task.dueDate }}
                    onChange={(startDate) => onChange({ startDate })}
                  >
                    <button
                      type="button"
                      className={propButton}
                      aria-label={t('task.propertyValue', {
                        label: t('task.start'),
                        value: task.startDate ? formatDay(task.startDate, language, true) : t('date.none'),
                      })}
                    >
                      <DateValue day={task.startDate} empty={t('date.none')} />
                    </button>
                  </DatePicker>
                </Property>

                <Property label={t('task.due')} top={overdueBy > 0}>
                  <DatePicker
                    label={t('date.pickDue')}
                    value={task.dueDate}
                    today={today}
                    notBefore={task.startDate}
                    period={{ start: task.startDate, due: task.dueDate }}
                    onChange={(dueDate) => onChange({ dueDate })}
                  >
                    <button
                      type="button"
                      className={propButton}
                      aria-label={t('task.propertyValue', {
                        label: t('task.due'),
                        value: task.dueDate ? formatDay(task.dueDate, language, true) : t('date.none'),
                      })}
                    >
                      <DateValue day={task.dueDate} empty={t('date.none')} danger={overdueBy > 0} />
                    </button>
                  </DatePicker>
                  {overdueBy > 0 && (
                    <span className="mb-1 inline-flex h-5 items-center self-start rounded-full bg-danger/12 px-2 text-caption font-medium text-danger">
                      {t('task.overdueBy', { count: overdueBy })}
                    </span>
                  )}
                </Property>

                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-small text-text-3">
                  <span>
                    {t('task.createdOn', {
                      date: formatDay(dateToDay(new Date(task.createdAt)), language, true),
                    })}
                  </span>
                  <span>{modifiedLabel(task.updatedAt, now, language, t)}</span>
                </div>
              </div>
            </div>
          </div>
          {/* The rest of the app is inert while the window is open: errors show here. */}
          <Feedback scope="modal" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
