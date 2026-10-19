import type { BoardDetail, Column, Input, SubtaskProgress, Task } from '@ordo/contracts';
import { columnForNewSubtask, completionAfterMove, DEFAULT_PRIORITY, rankAtEnd } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys, taskKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import i18n from '@renderer/i18n';

const isDone = (columns: readonly Column[], columnId: string) =>
  columns.find((c) => c.id === columnId)?.category === 'done';

/** `done/total` of a list of sub-tasks: done counts those in a Done column (same rule as the server). */
export function progressOf(subtasks: readonly Task[], columns: readonly Column[]): SubtaskProgress {
  return { done: subtasks.filter((s) => isDone(columns, s.columnId)).length, total: subtasks.length };
}

/** A task by id: the window of a sub-task (sub-tasks are not in the board query). */
export function useTask(id: string | null, enabled = true) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => call('tasks.get', { id: id! }),
    enabled: enabled && id !== null,
  });
}

/** A parent's live sub-tasks, in their list order. */
export function useSubtasks(parentId: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(parentId),
    queryFn: () => call('tasks.listSubtasks', { parentId }),
  });
}

/** The card ring and the parent's window read `Task.subtasks` from the board: keep it in step. */
function patchParentProgress(
  client: QueryClient,
  boardId: string,
  parentId: string,
  delta: { done: number; total: number },
) {
  if (delta.done === 0 && delta.total === 0) return;
  client.setQueryData<BoardDetail>(boardKeys.detail(boardId), (board) =>
    board
      ? {
          ...board,
          tasks: board.tasks.map((t) =>
            t.id === parentId
              ? {
                  ...t,
                  subtasks: {
                    done: Math.max(0, t.subtasks.done + delta.done),
                    total: Math.max(0, t.subtasks.total + delta.total),
                  },
                }
              : t,
          ),
        }
      : board,
  );
}

const patchList = (client: QueryClient, parentId: string, change: (list: Task[]) => Task[]) =>
  client.setQueryData<Task[]>(taskKeys.subtasks(parentId), (list) => (list ? change(list) : list));

const columnsOf = (client: QueryClient, boardId: string) =>
  client.getQueryData<BoardDetail>(boardKeys.detail(boardId))?.columns ?? [];

async function cancel(client: QueryClient, boardId: string, parentId: string, id?: string) {
  await Promise.all([
    client.cancelQueries({ queryKey: taskKeys.subtasks(parentId) }),
    client.cancelQueries({ queryKey: boardKeys.detail(boardId), exact: true }),
    ...(id ? [client.cancelQueries({ queryKey: taskKeys.detail(id) })] : []),
  ]);
}

/**
 * Several sub-task changes can overlap (quick checks, Enter after Enter): rather than restoring a
 * snapshot that would undo the others, reload from the database. Only the last one settling refreshes,
 * so an earlier refetch does not drop rows still being saved.
 */
function refresh(client: QueryClient, boardId: string, parentId: string, id?: string) {
  if (client.isMutating({ mutationKey: SUBTASK_MUTATION }) > 1) return;
  void client.invalidateQueries({ queryKey: taskKeys.subtasks(parentId) });
  void client.invalidateQueries({ queryKey: boardKeys.detail(boardId), exact: true });
  if (id) void client.invalidateQueries({ queryKey: taskKeys.detail(id) });
}

const SUBTASK_MUTATION = ['subtasks', 'mutation'] as const;

type FailedAction = 'createSubtask' | 'update' | 'deleteSubtask';

function failed(action: FailedAction, retry: () => void) {
  useFeedback.getState().showToast(i18n.t(`feedback.failed.${action}`), retry);
}

/** "Ajouter une sous-tâche", optimistic: the row shows at once with a temporary id, replaced by the saved one. */
export function useCreateSubtask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: SUBTASK_MUTATION,
    mutationFn: (input: { parentId: string; title: string; tempId: string }) =>
      call('tasks.create', { parentId: input.parentId, title: input.title }),
    onMutate: async (input) => {
      await cancel(client, boardId, input.parentId);
      const columns = columnsOf(client, boardId);
      const columnId = columnForNewSubtask(columns) ?? '';
      const done = isDone(columns, columnId);
      const now = Date.now();
      patchList(client, input.parentId, (list) => {
        const temp: Task = {
          id: input.tempId,
          columnId,
          parentId: input.parentId,
          key: 0,
          title: input.title.trim(),
          priority: DEFAULT_PRIORITY,
          startDate: null,
          dueDate: null,
          rank: rankAtEnd(list.at(-1)?.rank ?? null),
          completedAt: completionAfterMove(null, done, now),
          createdAt: now,
          updatedAt: now,
          tagIds: [],
          subtasks: { done: 0, total: 0 },
        };
        return [...list, temp];
      });
      patchParentProgress(client, boardId, input.parentId, { done: done ? 1 : 0, total: 1 });
    },
    onSuccess: (task, input) =>
      patchList(client, input.parentId, (list) =>
        list.some((t) => t.id === input.tempId)
          ? list.map((t) => (t.id === input.tempId ? task : t))
          : list.some((t) => t.id === task.id)
            ? list
            : [...list, task],
      ),
    onError: (_error, input) => {
      patchList(client, input.parentId, (list) => list.filter((t) => t.id !== input.tempId));
      failed('createSubtask', () => mutation.mutate(input));
    },
    onSettled: (_task, _error, input) => refresh(client, boardId, input.parentId),
  });
  return mutation;
}

/**
 * Check box, status menu and every field of the sub-task window. Optimistic in the parent's list,
 * the sub-task's own query and the parent's progress on the board. A new column keeps the list place.
 */
export function useUpdateSubtask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: SUBTASK_MUTATION,
    mutationFn: ({ parentId: _parentId, ...input }: Input<'tasks.update'> & { parentId: string }) =>
      call('tasks.update', input),
    onMutate: async ({ parentId, ...input }) => {
      await cancel(client, boardId, parentId, input.id);
      const columns = columnsOf(client, boardId);
      const current =
        client.getQueryData<Task>(taskKeys.detail(input.id)) ??
        client.getQueryData<Task[]>(taskKeys.subtasks(parentId))?.find((t) => t.id === input.id);
      if (!current) return;
      const target = input.columnId;
      const moved = target !== undefined && target !== current.columnId;
      const before = isDone(columns, current.columnId);
      const after = moved ? isDone(columns, target) : before;
      const defined = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      const apply = (t: Task): Task =>
        t.id !== input.id
          ? t
          : {
              ...t,
              ...defined,
              ...(moved ? { completedAt: completionAfterMove(t.completedAt, after, Date.now()) } : {}),
            };
      patchList(client, parentId, (list) => list.map(apply));
      client.setQueryData<Task>(taskKeys.detail(input.id), (task) => (task ? apply(task) : task));
      patchParentProgress(client, boardId, parentId, { done: Number(after) - Number(before), total: 0 });
    },
    onSuccess: (task) => {
      if (task.parentId)
        patchList(client, task.parentId, (list) => list.map((t) => (t.id === task.id ? task : t)));
      client.setQueryData<Task>(taskKeys.detail(task.id), (current) => (current ? task : current));
    },
    onError: (_error, input) => failed('update', () => mutation.mutate(input)),
    onSettled: (_task, _error, input) => refresh(client, boardId, input.parentId, input.id),
  });
  return mutation;
}

/** "Supprimer" in the ⋯ of a sub-task's window: the row leaves the parent's list at once. */
export function useDeleteSubtask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: SUBTASK_MUTATION,
    mutationFn: (input: { id: string; parentId: string }) => call('tasks.delete', { id: input.id }),
    onMutate: async (input) => {
      await cancel(client, boardId, input.parentId, input.id);
      const columns = columnsOf(client, boardId);
      const task =
        client.getQueryData<Task>(taskKeys.detail(input.id)) ??
        client.getQueryData<Task[]>(taskKeys.subtasks(input.parentId))?.find((t) => t.id === input.id);
      patchList(client, input.parentId, (list) => list.filter((t) => t.id !== input.id));
      patchParentProgress(client, boardId, input.parentId, {
        done: task && isDone(columns, task.columnId) ? -1 : 0,
        total: -1,
      });
    },
    onSuccess: (_result, input) => client.removeQueries({ queryKey: taskKeys.detail(input.id) }),
    onError: (_error, input) => failed('deleteSubtask', () => mutation.mutate(input)),
    onSettled: (_result, _error, input) => refresh(client, boardId, input.parentId),
  });
  return mutation;
}
