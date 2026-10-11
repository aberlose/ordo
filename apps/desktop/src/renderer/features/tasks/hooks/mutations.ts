import type { BoardDetail, Input, Task } from '@ordo/contracts';
import { completionAfterMove, DEFAULT_PRIORITY, rankAtEnd, rankBetween } from '@ordo/domain';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import i18n from '@renderer/i18n';

type Snapshot = { previous: BoardDetail | undefined };

function patchBoard(
  client: QueryClient,
  boardId: string,
  change: (board: BoardDetail) => BoardDetail,
): Snapshot {
  const key = boardKeys.detail(boardId);
  const previous = client.getQueryData<BoardDetail>(key);
  if (previous) client.setQueryData<BoardDetail>(key, change(previous));
  return { previous };
}

function rollback(client: QueryClient, boardId: string, snapshot: Snapshot | undefined) {
  if (snapshot?.previous) client.setQueryData(boardKeys.detail(boardId), snapshot.previous);
}

type FailedAction = 'create' | 'update' | 'delete' | 'move';

/** Rolls the cache back and tells the user, with a way to try again (mockup drag-and-drop/Toast A). */
function failed(action: FailedAction, retry: () => void) {
  useFeedback.getState().showToast(i18n.t(`feedback.failed.${action}`), retry);
}

const isDoneColumn = (board: BoardDetail, columnId: string) =>
  board.columns.find((c) => c.id === columnId)?.category === 'done';

const lastRank = (board: BoardDetail, columnId: string) =>
  board.tasks
    .filter((t) => t.columnId === columnId)
    .map((t) => t.rank)
    .sort()
    .at(-1) ?? null;

/** Quick add, optimistic: the card shows at once with a temporary id, replaced by the saved task. */
export function useCreateTask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'tasks.create'> & { tempId: string }) =>
      call('tasks.create', { columnId: input.columnId, title: input.title }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const now = Date.now();
      return patchBoard(client, boardId, (board) => {
        const temp: Task = {
          id: input.tempId,
          columnId: input.columnId,
          key: 0,
          title: input.title.trim(),
          priority: DEFAULT_PRIORITY,
          startDate: null,
          dueDate: null,
          rank: rankAtEnd(lastRank(board, input.columnId)),
          completedAt: completionAfterMove(null, isDoneColumn(board, input.columnId), now),
          createdAt: now,
          updatedAt: now,
        };
        return { ...board, taskCount: board.taskCount + 1, tasks: [...board.tasks, temp] };
      });
    },
    onSuccess: (task, input) =>
      patchBoard(client, boardId, (board) => ({
        ...board,
        tasks: board.tasks.map((t) => (t.id === input.tempId ? task : t)),
      })),
    onError: (_error, input, snapshot) => {
      rollback(client, boardId, snapshot);
      failed('create', () => mutation.mutate(input));
    },
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.all, exact: true }),
  });
  return mutation;
}

/** Field edits from the detail window, optimistic with rollback. */
export function useUpdateTask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'tasks.update'>) => call('tasks.update', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      return patchBoard(client, boardId, (board) => ({
        ...board,
        tasks: board.tasks.map((t) => {
          if (t.id !== input.id) return t;
          const target = input.columnId;
          const moved = target !== undefined && target !== t.columnId;
          const move = moved
            ? {
                rank: rankAtEnd(lastRank(board, target)),
                completedAt: completionAfterMove(t.completedAt, isDoneColumn(board, target), Date.now()),
              }
            : {};
          return { ...t, ...input, ...move } as Task;
        }),
      }));
    },
    onSuccess: (task) =>
      patchBoard(client, boardId, (board) => ({
        ...board,
        tasks: board.tasks.map((t) => (t.id === task.id ? task : t)),
      })),
    onError: (_error, input, snapshot) => {
      rollback(client, boardId, snapshot);
      failed('update', () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Soft delete (the trash comes with lot 8). */
export function useDeleteTask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => call('tasks.delete', { id }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      return patchBoard(client, boardId, (board) => ({
        ...board,
        taskCount: Math.max(0, board.taskCount - 1),
        tasks: board.tasks.filter((t) => t.id !== id),
      }));
    },
    onError: (_error, id, snapshot) => {
      rollback(client, boardId, snapshot);
      failed('delete', () => mutation.mutate(id));
    },
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.all, exact: true }),
  });
  return mutation;
}

/**
 * Drag and drop or ⌥/Alt + arrows, optimistic: the card takes its new column and a rank between
 * its neighbours at once; the server writes one row.
 */
export function useMoveTask(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'tasks.move'>) => call('tasks.move', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      return patchBoard(client, boardId, (board) => {
        const rankOf = (id: string | null) =>
          id ? (board.tasks.find((t) => t.id === id)?.rank ?? null) : null;
        const rank =
          input.beforeId === null && input.afterId === null
            ? rankAtEnd(lastRank(board, input.toColumnId))
            : rankBetween(rankOf(input.beforeId), rankOf(input.afterId));
        return {
          ...board,
          tasks: board.tasks.map((t) =>
            t.id !== input.taskId
              ? t
              : {
                  ...t,
                  columnId: input.toColumnId,
                  rank,
                  completedAt:
                    t.columnId === input.toColumnId
                      ? t.completedAt
                      : completionAfterMove(t.completedAt, isDoneColumn(board, input.toColumnId), Date.now()),
                },
          ),
        };
      });
    },
    onSuccess: (task) =>
      patchBoard(client, boardId, (board) => ({
        ...board,
        tasks: board.tasks.map((t) => (t.id === task.id ? task : t)),
      })),
    // Moves can overlap (several quick ⌥ + arrows): restoring a snapshot would undo the others,
    // so a failed move reloads the board from the database instead.
    onError: (_error, input) => {
      void client.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      failed('move', () => mutation.mutate(input));
    },
  });
  return mutation;
}
