import type { BoardDetail, Task } from '@ordo/contracts';
import { canBeParent } from '@ordo/domain';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { taskKeys } from '@renderer/shared/api/keys';
import { useAppearance, useResolvedMode } from '@renderer/shared/appearance/store';
import { useNow } from '@renderer/shared/lib/useNow';
import { useDeleteTask, useUpdateTask } from '../hooks/mutations';
import { useDeleteSubtask, useTask, useUpdateSubtask } from '../hooks/subtasks';
import { useTaskUi } from '../store';

// Loaded on first open (Radix dialog, menus, calendar), then kept: not part of the board's first render.
const TaskDetailView = lazy(() => import('./TaskDetailView').then((m) => ({ default: m.TaskDetailView })));
const SubtaskSection = lazy(() =>
  import('./subtasks/SubtaskSection').then((m) => ({ default: m.SubtaskSection })),
);
const TaskTags = lazy(() => import('./tags/TaskTags').then((m) => ({ default: m.TaskTags })));
// The editor (Tiptap) is the heaviest part of the window: its own chunk, loaded on first open.
const NotesEditor = lazy(() => import('./notes/NotesEditor'));
const AttachmentSection = lazy(() =>
  import('./attachments/AttachmentSection').then((m) => ({ default: m.AttachmentSection })),
);
const AttachmentDropTarget = lazy(() =>
  import('./attachments/AttachmentDropTarget').then((m) => ({ default: m.AttachmentDropTarget })),
);

/** Focuses the first element found among `selectors`, waiting a few frames for it to render. */
function focusSoon(selectors: readonly string[], frames = 10) {
  const found = selectors.map((s) => document.querySelector<HTMLElement>(s)).find(Boolean);
  if (found) found.focus({ focusVisible: true } as FocusOptions);
  else if (frames > 0) requestAnimationFrame(() => focusSoon(selectors, frames - 1));
}

/**
 * Detail window of the open task, wired to the board cache and the task mutations. A sub-task is not
 * in the board query: it comes from `tasks.get` (seeded with its row when opened from the parent) and
 * opens in the same window, without the Sub-tasks section (approved mockup: tags-subtasks/SubtaskDetail B).
 */
export function TaskDetail({ board, today }: { board: BoardDetail; today: string }) {
  const { openTaskId, expanded, openTask, closeTask, toggleExpanded } = useTaskUi(
    useShallow((s) => ({
      openTaskId: s.openTaskId,
      expanded: s.expanded,
      openTask: s.openTask,
      closeTask: s.closeTask,
      toggleExpanded: s.toggleExpanded,
    })),
  );
  const client = useQueryClient();
  const update = useUpdateTask(board.id);
  const remove = useDeleteTask(board.id);
  const updateSubtask = useUpdateSubtask(board.id);
  const removeSubtask = useDeleteSubtask(board.id);
  const dark = useResolvedMode() === 'dark';
  const setMode = useAppearance((state) => state.setMode);
  const boardTask = board.tasks.find((t) => t.id === openTaskId);
  const fetched = useTask(openTaskId, !boardTask);
  const task = boardTask ?? (fetched.data?.id === openTaskId ? fetched.data : undefined);
  const parent = task?.parentId ? board.tasks.find((t) => t.id === task.parentId) : undefined;
  const now = useNow();

  // Gone (deleted, or its parent was): close. A sub-task still loading keeps the window as it is.
  const gone =
    openTaskId !== null &&
    !boardTask &&
    (fetched.isError || (task !== undefined && task.parentId !== null && !parent));
  useEffect(() => {
    if (gone) closeTask();
  }, [gone, closeTask]);

  // Switching between a parent and one of its sub-tasks keeps the window open: move the focus to
  // the "Sous-tâche de" button, or back to the row of the sub-task we came from.
  const previousId = useRef<string | null>(null);
  const taskId = task?.id ?? null;
  const isSubtask = Boolean(task?.parentId);
  useEffect(() => {
    const previous = previousId.current;
    previousId.current = taskId;
    if (!taskId || !previous || previous === taskId) return;
    focusSoon(
      isSubtask ? ['[data-parent-link]'] : [`[data-subtask-open="${previous}"]`, '[data-subtask-add]'],
    );
  }, [taskId, isSubtask]);

  if (!task || gone) return null;

  const openSubtask = (subtask: Task) => {
    client.setQueryData(taskKeys.detail(subtask.id), subtask);
    openTask(subtask.id);
  };
  const parentColor = board.columns.find((c) => c.id === parent?.columnId)?.color ?? 'slate';

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
        onChange={(change) =>
          task.parentId
            ? updateSubtask.mutate({ id: task.id, parentId: task.parentId, ...change })
            : update.mutate({ id: task.id, ...change })
        }
        onDelete={() => {
          if (task.parentId) {
            removeSubtask.mutate({ id: task.id, parentId: task.parentId });
            openTask(task.parentId);
            return;
          }
          // Its sub-tasks go to the trash with it (server side).
          remove.mutate(task.id);
          client.removeQueries({ queryKey: taskKeys.subtasks(task.id) });
          closeTask();
        }}
        onClose={closeTask}
        onToggleExpanded={toggleExpanded}
        onToggleTheme={() => setMode(dark ? 'light' : 'dark')}
        {...(parent
          ? {
              parent: { title: parent.title, progress: parent.subtasks, color: parentColor },
              onOpenParent: () => openTask(parent.id),
            }
          : {})}
        {...(canBeParent(task)
          ? {
              subtasks: (
                <Suspense fallback={null}>
                  <SubtaskSection parent={task} board={board} onOpen={openSubtask} />
                </Suspense>
              ),
            }
          : {})}
        notes={
          <Suspense fallback={<div className="min-h-24 w-full" />}>
            <NotesEditor key={task.id} boardId={board.id} taskId={task.id} />
          </Suspense>
        }
        tags={
          <Suspense fallback={null}>
            <TaskTags boardId={board.id} task={task} />
          </Suspense>
        }
        attachments={
          <Suspense fallback={null}>
            <AttachmentSection key={task.id} boardId={board.id} taskId={task.id} />
          </Suspense>
        }
        dropTarget={
          <Suspense fallback={null}>
            <AttachmentDropTarget key={task.id} boardId={board.id} taskId={task.id} />
          </Suspense>
        }
      />
    </Suspense>
  );
}
