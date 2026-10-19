import type { Column, Task } from '@ordo/contracts';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { columnTextColorVar } from '@renderer/shared/ui/colors';
import { TEMP_ID_PREFIX } from '../TaskCard';
import { SubtaskStatusMenu } from './SubtaskStatusMenu';

export interface SubtaskRowProps {
  task: Task;
  columns: readonly Column[];
  /** Stories: the status menu shown open. */
  menuOpen?: boolean;
  onToggle: (task: Task, done: boolean) => void;
  onMove: (task: Task, columnId: string) => void;
  onOpen: (task: Task) => void;
}

/**
 * Approved mockup: tags-subtasks/SubtaskRows variant A — check box, title (opens the sub-task, struck
 * when done), status. On hover or focus the row is tinted and the title underlined.
 */
export const SubtaskRow = memo(function SubtaskRow({
  task,
  columns,
  menuOpen = false,
  onToggle,
  onMove,
  onOpen,
}: SubtaskRowProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(menuOpen);
  const column = columns.find((c) => c.id === task.columnId);
  const done = column?.category === 'done';
  const saving = task.id.startsWith(TEMP_ID_PREFIX);
  // The AA text variant of the column colour: the check mark in the surface colour on it keeps 4.5:1.
  const color = column ? columnTextColorVar(column.color) : undefined;

  return (
    <li
      data-subtask-id={task.id}
      data-menu={menu ? 'open' : undefined}
      className="group -mx-2 flex h-9 items-center gap-2.5 rounded-lg px-2 hover:bg-rail focus-within:bg-rail data-[menu=open]:bg-rail"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t('subtasks.checkLabel', { title: task.title })}
        aria-disabled={saving || undefined}
        onClick={() => !saving && onToggle(task, !done)}
        className={cn(
          'flex size-4.5 shrink-0 items-center justify-center rounded-sm border-strong',
          !done && 'border-border-strong hover:border-text-3',
        )}
        style={done && color ? { backgroundColor: color, borderColor: color } : undefined}
      >
        {done && <Check size={12} strokeWidth={3.2} className="text-surface" aria-hidden />}
      </button>
      <button
        type="button"
        data-subtask-open={task.id}
        aria-disabled={saving || undefined}
        onClick={() => !saving && onOpen(task)}
        className={cn(
          'min-w-0 flex-1 truncate rounded-sm text-left text-input underline-offset-3 focus-visible:outline-offset-1',
          done
            ? 'text-text-3 line-through group-focus-within:[text-decoration-line:underline_line-through] group-hover:[text-decoration-line:underline_line-through]'
            : 'text-text group-focus-within:underline group-hover:underline',
        )}
      >
        {task.title}
      </button>
      <SubtaskStatusMenu
        title={task.title}
        columnId={task.columnId}
        columns={columns}
        disabled={saving}
        defaultOpen={menuOpen}
        onOpenChange={setMenu}
        onChange={(columnId) => onMove(task, columnId)}
      />
    </li>
  );
});
