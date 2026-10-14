import type { Task } from '@ordo/contracts';
import { daysOverdue } from '@ordo/domain';
import { memo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { formatDay } from '@renderer/shared/lib/dates';
import { keyboardTargetHandlers } from '@renderer/shared/keyboard/focus';
import { PriorityBars } from '@renderer/shared/ui/priority-bars';

export const TEMP_ID_PREFIX = 'temp-';
/** Id of the hidden text describing ⌥/Alt + arrows, rendered once by the board. */
export const CARD_MOVE_HINT_ID = 'ordo-card-move-hint';

export interface TaskCardProps {
  task: Task;
  /** Today as YYYY-MM-DD, to flag overdue tasks. */
  today: string;
  highlighted?: boolean;
  /** Just moved: briefly tinted (mockup drag-and-drop/KeyboardMove). */
  flash?: boolean;
  onOpen: (id: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const cardFocus = keyboardTargetHandlers('card');

/**
 * Approved mockups: board (card content) and tasks/CardStates variant A
 * (hover: stronger border, lifted shadow, 1 px up; focus: 2 px accent ring).
 */
export const TaskCard = memo(function TaskCard({
  task,
  today,
  highlighted = false,
  flash = false,
  onOpen,
  onKeyDown,
}: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const pending = task.id.startsWith(TEMP_ID_PREFIX);
  const overdue = task.completedAt === null && daysOverdue(task.dueDate, today) > 0;
  const priority = t(`priority.${task.priority}`);

  return (
    <button
      type="button"
      data-task-id={task.id}
      aria-disabled={pending || undefined}
      onClick={() => !pending && onOpen(task.id)}
      onKeyDown={onKeyDown}
      aria-describedby={CARD_MOVE_HINT_ID}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
      {...cardFocus}
      className={cn(
        'flex w-full flex-col gap-2.25 rounded-card border border-border bg-surface px-3.5 pt-3 pb-2.75 text-left shadow-card transition-[transform,box-shadow,border-color,background-color] duration-150',
        'cursor-pointer hover:-translate-y-px hover:border-border-strong hover:shadow-lift focus-visible:translate-y-0',
        (highlighted || flash) && 'border-accent/35 bg-accent-soft/70',
        pending && 'cursor-progress',
      )}
    >
      <span className="text-sm leading-snug font-medium text-text">{task.title}</span>
      <span className="flex items-center gap-3 text-meta text-text-3">
        <PriorityBars priority={task.priority} label={t('task.priorityLabel', { priority })} />
        <span className="flex-1" />
        {highlighted && <span className="font-medium text-accent">{t('task.added')}</span>}
        {task.dueDate && (
          <span className={cn(overdue && 'font-semibold text-danger')}>
            <span className="sr-only">{t(overdue ? 'task.overdueOn' : 'task.dueOn')} </span>
            {formatDay(task.dueDate, i18n.resolvedLanguage)}
          </span>
        )}
      </span>
    </button>
  );
});
