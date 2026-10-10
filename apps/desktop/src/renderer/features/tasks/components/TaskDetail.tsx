import type { BoardDetail } from '@ordo/contracts';
import { lazy, Suspense, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppearance, useResolvedMode } from '@renderer/shared/appearance/store';
import { useNow } from '@renderer/shared/lib/useNow';
import { useDeleteTask, useUpdateTask } from '../hooks/mutations';
import { useTaskUi } from '../store';

// Loaded on first open (Radix dialog, menus, calendar), then kept: not part of the board's first render.
const TaskDetailView = lazy(() => import('./TaskDetailView').then((m) => ({ default: m.TaskDetailView })));

/** Detail window of the open task, wired to the board cache and the task mutations. */
export function TaskDetail({ board, today }: { board: BoardDetail; today: string }) {
  const { openTaskId, expanded, closeTask, toggleExpanded } = useTaskUi(
    useShallow((s) => ({
      openTaskId: s.openTaskId,
      expanded: s.expanded,
      closeTask: s.closeTask,
      toggleExpanded: s.toggleExpanded,
    })),
  );
  const update = useUpdateTask(board.id);
  const remove = useDeleteTask(board.id);
  const dark = useResolvedMode() === 'dark';
  const setMode = useAppearance((state) => state.setMode);
  const task = board.tasks.find((t) => t.id === openTaskId);
  const now = useNow();

  useEffect(() => {
    if (openTaskId && !task) closeTask();
  }, [openTaskId, task, closeTask]);

  if (!task) return null;
  return (
    <Suspense fallback={null}>
      <TaskDetailView
        task={task}
        boardName={board.name}
        columns={board.columns}
        today={today}
        now={now}
        expanded={expanded}
        dark={dark}
        onChange={(change) => update.mutate({ id: task.id, ...change })}
        onDelete={() => {
          remove.mutate(task.id);
          closeTask();
        }}
        onClose={closeTask}
        onToggleExpanded={toggleExpanded}
        onToggleTheme={() => setMode(dark ? 'light' : 'dark')}
      />
    </Suspense>
  );
}
