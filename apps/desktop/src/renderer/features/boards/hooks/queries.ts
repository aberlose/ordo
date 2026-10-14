import type { BoardDetail, Input } from '@ordo/contracts';
import { rankBetween } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useColumnDrag } from '../dnd/state';
import i18n from '@renderer/i18n';

export function useBoards() {
  return useQuery({ queryKey: boardKeys.all, queryFn: () => call('boards.list', {}) });
}

export function useBoard(id: string) {
  return useQuery({ queryKey: boardKeys.detail(id), queryFn: () => call('boards.get', { id }) });
}

export function useCreateBoard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Input<'boards.create'>) => call('boards.create', input),
    onSuccess: (board) => {
      client.setQueryData(boardKeys.detail(board.id), board);
      void client.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

/** Column reorder (drag and drop or ⌥/Alt + arrows on a header), optimistic with rollback. */
export function useMoveColumn(boardId: string) {
  const client = useQueryClient();
  const key = boardKeys.detail(boardId);
  const mutation = useMutation({
    mutationFn: (input: Input<'columns.move'>) => call('columns.move', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<BoardDetail>(key);
      if (previous) {
        const rankOf = (id: string | null) =>
          id ? (previous.columns.find((c) => c.id === id)?.rank ?? null) : null;
        const rank = rankBetween(rankOf(input.beforeId), rankOf(input.afterId));
        const columns = previous.columns
          .map((c) => (c.id === input.columnId ? { ...c, rank } : c))
          .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
        client.setQueryData<BoardDetail>(key, { ...previous, columns });
      }
      return { previous };
    },
    // Moves can overlap: reload the board rather than restoring a snapshot that would undo the others.
    onError: (_error, input) => {
      void client.invalidateQueries({ queryKey: key });
      useFeedback.getState().showToast(i18n.t('feedback.failed.moveColumn'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** New column at the right end of the board (approved popover mockup); it appears once saved. */
export function useCreateColumn(boardId: string) {
  const client = useQueryClient();
  const key = boardKeys.detail(boardId);
  const mutation = useMutation({
    mutationFn: (input: Input<'columns.create'>) => call('columns.create', input),
    onSuccess: (column) => {
      const board = client.getQueryData<BoardDetail>(key);
      if (board) client.setQueryData<BoardDetail>(key, { ...board, columns: [...board.columns, column] });
    },
    onError: (_error, input) => {
      void client.invalidateQueries({ queryKey: key });
      useFeedback.getState().showToast(i18n.t('feedback.failed.createColumn'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Column settings, optimistic; a category change also completes or reopens its tasks, so the board reloads. */
export function useUpdateColumn(boardId: string) {
  const client = useQueryClient();
  const key = boardKeys.detail(boardId);
  const mutation = useMutation({
    mutationFn: (input: Input<'columns.update'>) => call('columns.update', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<BoardDetail>(key);
      if (previous) {
        const { id, ...patch } = input;
        const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
        client.setQueryData<BoardDetail>(key, {
          ...previous,
          columns: previous.columns.map((c) => (c.id === id ? { ...c, ...defined } : c)),
        });
      }
      return { previous };
    },
    // Other changes may overlap: reload the board rather than restoring a snapshot.
    onError: (_error, input) => {
      void client.invalidateQueries({ queryKey: key });
      useFeedback.getState().showToast(i18n.t('feedback.failed.updateColumn'), () => mutation.mutate(input));
    },
    onSuccess: (_column, input) => {
      if (input.category !== undefined) void client.invalidateQueries({ queryKey: key });
    },
  });
  return mutation;
}

/** The column and its tasks go to the trash (mockup column-settings/ColumnStates A), optimistic. */
export function useDeleteColumn(boardId: string) {
  const client = useQueryClient();
  const key = boardKeys.detail(boardId);
  const mutation = useMutation({
    mutationFn: (id: string) => call('columns.delete', { id }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<BoardDetail>(key);
      if (previous) {
        // The focus goes to the next column's header (or the previous one), as the column disappears.
        const index = previous.columns.findIndex((c) => c.id === id);
        const neighbour = previous.columns[index + 1] ?? previous.columns[index - 1];
        client.setQueryData<BoardDetail>(key, {
          ...previous,
          columns: previous.columns.filter((c) => c.id !== id),
          tasks: previous.tasks.filter((t) => t.columnId !== id),
        });
        if (neighbour) useColumnDrag.getState().set({ focusId: neighbour.id });
      }
    },
    onError: (_error, id) => {
      void client.invalidateQueries({ queryKey: key });
      useFeedback.getState().showToast(i18n.t('feedback.failed.deleteColumn'), () => mutation.mutate(id));
    },
    // Task counts in the sidebar change.
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.all, exact: true }),
  });
  return mutation;
}
