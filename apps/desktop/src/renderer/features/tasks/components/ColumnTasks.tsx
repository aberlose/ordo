import type { Column, Task } from '@ordo/contracts';
import { memo, useEffect } from 'react';
import { useCreateTask } from '../hooks/mutations';
import { useTaskUi } from '../store';
import { QuickAdd } from './QuickAdd';
import { TaskCard, TEMP_ID_PREFIX } from './TaskCard';

let tempCounter = 0;
const HIGHLIGHT_MS = 1600;

export interface ColumnTasksProps {
  boardId: string;
  column: Column;
  tasks: readonly Task[];
  today: string;
  /** Hide the "Add" link (the empty board shows its own call to action). */
  hideAddLink?: boolean;
}

/** The cards of one column followed by quick add. */
export const ColumnTasks = memo(function ColumnTasks({
  boardId,
  column,
  tasks,
  today,
  hideAddLink = false,
}: ColumnTasksProps) {
  const open = useTaskUi((state) => state.quickAddColumnId === column.id);
  const focusRequest = useTaskUi((state) =>
    state.quickAddColumnId === column.id ? state.quickAddRequest : 0,
  );
  // Only the column holding the highlighted card re-renders when the highlight changes.
  const highlightedTaskId = useTaskUi((state) =>
    state.highlightedTaskId !== null && tasks.some((t) => t.id === state.highlightedTaskId)
      ? state.highlightedTaskId
      : null,
  );
  const { openQuickAdd, closeQuickAdd, openTask, highlight } = useTaskUi.getState();
  const create = useCreateTask(boardId);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const timer = setTimeout(() => highlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedTaskId, highlight]);

  return (
    <>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          today={today}
          highlighted={task.id === highlightedTaskId}
          onOpen={openTask}
        />
      ))}
      {(open || !hideAddLink) && (
        <QuickAdd
          open={open}
          focusRequest={focusRequest}
          onOpen={() => openQuickAdd(column.id)}
          onClose={closeQuickAdd}
          onSubmit={(title) => {
            const tempId = `${TEMP_ID_PREFIX}${++tempCounter}`;
            highlight(tempId);
            create.mutate(
              { columnId: column.id, title, tempId },
              {
                onSuccess: (task) => useTaskUi.getState().highlightedTaskId === tempId && highlight(task.id),
              },
            );
          }}
        />
      )}
    </>
  );
});
