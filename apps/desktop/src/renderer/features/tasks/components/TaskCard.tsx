import type { SubtaskProgress, Task } from '@ordo/contracts';
import { compareTags, daysOverdue, type ColumnColor } from '@ordo/domain';
import { Paperclip } from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { formatDay } from '@renderer/shared/lib/dates';
import { keyboardTargetHandlers } from '@renderer/shared/keyboard/focus';
import { PriorityBars } from '@renderer/shared/ui/priority-bars';
import type { TagLook } from '../hooks/tags';
import { SubtaskRing } from './subtasks/SubtaskRing';
import { CardTags } from './tags/CardTags';

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
  /** The board's tags by id (stable between renders: see useTagLooks). */
  tags?: ReadonlyMap<string, TagLook>;
  /** Colour of the task's column, for the sub-task ring. */
  color?: ColumnColor;
  /** Stories: the bubble of the hidden tags ("+N") shown. */
  tagsBubbleOpen?: boolean;
}

const NO_TAGS: ReadonlyMap<string, TagLook> = new Map();
/** Sub-task progress: the ring in the column colour and `done/total` (mockups board, tags-subtasks/CardTags A). */
function SubtaskProgressLabel({ progress, color }: { progress: SubtaskProgress; color: ColumnColor }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.25 tabular-nums">
      <SubtaskRing progress={progress} color={color} />
      <span aria-hidden>
        {progress.done}/{progress.total}
      </span>
      <span className="sr-only">{t('tags.card.subtasks', progress)}</span>
    </span>
  );
}

const cardFocus = keyboardTargetHandlers('card');

/**
 * Approved mockups: board (card content) and tasks/CardStates variant A
 * (hover: stronger border, lifted shadow, 1 px up; focus: 2 px accent ring), tags-subtasks/CardTags A
 * (tags on one line then "+N"; sub-task ring on the bottom line).
 */
export const TaskCard = memo(function TaskCard({
  task,
  today,
  highlighted = false,
  flash = false,
  onOpen,
  onKeyDown,
  tags = NO_TAGS,
  color = 'slate',
  tagsBubbleOpen = false,
}: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const pending = task.id.startsWith(TEMP_ID_PREFIX);
  const overdue = task.completedAt === null && daysOverdue(task.dueDate, today) > 0;
  const priority = t(`priority.${task.priority}`);
  // Alphabetical, also right after a rename (the task's tag ids keep the order of the old names).
  const looks = task.tagIds.flatMap((id) => tags.get(id) ?? []).sort(compareTags);

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
        'group/card relative flex w-full flex-col gap-2.25 rounded-card border border-border bg-surface px-3.5 pt-3 pb-2.75 text-left shadow-card transition-[transform,box-shadow,border-color,background-color] duration-150',
        // Raised while hovered or focused: the "+N" tag bubble overlaps the next card.
        'cursor-pointer hover:z-10 hover:-translate-y-px hover:border-border-strong hover:shadow-lift focus-visible:z-10 focus-visible:translate-y-0',
        (highlighted || flash) && 'border-accent/35 bg-accent-soft/70',
        pending && 'cursor-progress',
      )}
    >
      <span className="text-sm leading-snug font-medium text-text">{task.title}</span>
      {/* No tag line without tags: such cards keep their height. */}
      {looks.length > 0 && <CardTags tags={looks} bubbleOpen={tagsBubbleOpen} />}
      <span className="flex items-center gap-3 text-meta text-text-3">
        <PriorityBars priority={task.priority} label={t('task.priorityLabel', { priority })} />
        {/* Approved board mockup: the paperclip and the count, before the sub-task ring. */}
        {task.attachmentCount > 0 && (
          <span className="flex items-center gap-0.75 tabular-nums">
            <Paperclip size={13} aria-hidden />
            <span aria-hidden>{task.attachmentCount}</span>
            <span className="sr-only">{t('attachments.card', { count: task.attachmentCount })}</span>
          </span>
        )}
        {task.subtasks.total > 0 && <SubtaskProgressLabel progress={task.subtasks} color={color} />}
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
