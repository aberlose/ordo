import type { BoardDetail, Input, Task } from '@ordo/contracts';
import { completionAfterMove, DEFAULT_PRIORITY, rankAtEnd } from '@ordo/domain';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';

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
  return useMutation({
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
    onError: (_error, _input, snapshot) => rollback(client, boardId, snapshot),
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.all, exact: true }),
  });
}

/** Field edits from the detail window, optimistic with rollback. */
export function useUpdateTask(boardId: string) {
  const client = useQueryClient();
  return useMutation({
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
    onError: (_error, _input, snapshot) => rollback(client, boardId, snapshot),
  });
}

/** Soft delete (the trash comes with lot 8). */
export function useDeleteTask(boardId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call('tasks.delete', { id }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      return patchBoard(client, boardId, (board) => ({
        ...board,
        taskCount: Math.max(0, board.taskCount - 1),
        tasks: board.tasks.filter((t) => t.id !== id),
      }));
    },
    onError: (_error, _id, snapshot) => rollback(client, boardId, snapshot),
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.all, exact: true }),
  });
}
