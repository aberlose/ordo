import type { BoardDetail, BoardSummary, Input } from '@ordo/contracts';
import { rankBetween } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys, taskKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useColumnDrag } from '../dnd/state';
import i18n from '@renderer/i18n';

export function useBoards() {
  return useQuery({ queryKey: boardKeys.all, queryFn: () => call('boards.list', {}) });
}

export function useBoard(id: string) {
  return useQuery({ queryKey: boardKeys.detail(id), queryFn: () => call('boards.get', { id }) });
}

/**
 * New board with the three default columns, at the end of the sidebar (first launch, or the board
 * popover under "+" with its icon and colour). It appears once saved.
 */
export function useCreateBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'boards.create'>) => call('boards.create', input),
    onSuccess: (board) => {
      client.setQueryData(boardKeys.detail(board.id), board);
      void client.invalidateQueries({ queryKey: boardKeys.all, exact: true });
    },
    onError: (_error, input) => {
      useFeedback.getState().showToast(i18n.t('feedback.failed.createBoard'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Sidebar list (`boardKeys.all`, exact: details and archives live under the same prefix). */
const LIST = { queryKey: boardKeys.all, exact: true } as const;

/** Rename, or change the icon and colour: optimistic in the sidebar and on the open board. */
export function useUpdateBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'boards.update'>) => call('boards.update', input),
    onMutate: async (input) => {
      const detail = boardKeys.detail(input.id);
      await Promise.all([
        client.cancelQueries(LIST),
        client.cancelQueries({ queryKey: detail, exact: true }),
      ]);
      const { id, ...patch } = input;
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      client.setQueryData<BoardSummary[]>(boardKeys.all, (boards) =>
        boards?.map((board) => (board.id === id ? { ...board, ...defined } : board)),
      );
      client.setQueryData<BoardDetail>(detail, (board) => (board ? { ...board, ...defined } : board));
    },
    // Other changes may overlap: reload rather than restoring a snapshot.
    onError: (_error, input) => {
      void client.invalidateQueries(LIST);
      void client.invalidateQueries({ queryKey: boardKeys.detail(input.id), exact: true });
      useFeedback.getState().showToast(i18n.t('feedback.failed.updateBoard'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Sidebar reorder (drag and drop or ⌥/Alt + ↑↓), optimistic: the board moves between its new neighbours. */
export function useMoveBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'boards.move'>) => call('boards.move', input),
    onMutate: async (input) => {
      await client.cancelQueries(LIST);
      client.setQueryData<BoardSummary[]>(boardKeys.all, (boards) => {
        const moving = boards?.find((board) => board.id === input.boardId);
        if (!boards || !moving) return boards;
        const others = boards.filter((board) => board.id !== input.boardId);
        const index = input.beforeId
          ? others.findIndex((board) => board.id === input.beforeId) + 1
          : input.afterId
            ? others.findIndex((board) => board.id === input.afterId)
            : others.length;
        others.splice(Math.max(0, index), 0, moving);
        return others;
      });
    },
    // Moves can overlap: reload the list rather than restoring a snapshot that would undo the others.
    onError: (_error, input) => {
      void client.invalidateQueries(LIST);
      useFeedback.getState().showToast(i18n.t('feedback.failed.moveBoard'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Copy of a board, right after the original once saved (approved mockup boards/BoardMenu A). */
export function useDuplicateBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'boards.duplicate'>) => call('boards.duplicate', input),
    onSuccess: (copy, input) => {
      client.setQueryData<BoardSummary[]>(boardKeys.all, (boards) => {
        if (!boards || boards.some((board) => board.id === copy.id)) return boards;
        const index = boards.findIndex((board) => board.id === input.id);
        return index === -1 ? [...boards, copy] : boards.toSpliced(index + 1, 0, copy);
      });
      void client.invalidateQueries(LIST);
    },
    onError: (_error, input) => {
      useFeedback
        .getState()
        .showToast(i18n.t('feedback.failed.duplicateBoard'), () => mutation.mutate(input));
    },
  });
  return mutation;
}

/** Archive a board (no confirmation, reversible): it leaves the sidebar at once and joins the archives. */
export function useArchiveBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => call('boards.archive', { id }),
    onMutate: async (id) => {
      await client.cancelQueries(LIST);
      client.setQueryData<BoardSummary[]>(boardKeys.all, (boards) =>
        boards?.filter((board) => board.id !== id),
      );
    },
    onError: (_error, id) => {
      void client.invalidateQueries(LIST);
      useFeedback.getState().showToast(i18n.t('feedback.failed.archiveBoard'), () => mutation.mutate(id));
    },
    onSettled: () => void client.invalidateQueries({ queryKey: boardKeys.archived, exact: true }),
  });
  return mutation;
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
    onSettled: () => {
      // Task counts in the sidebar change.
      void client.invalidateQueries({ queryKey: boardKeys.all, exact: true });
      // The sub-tasks in the column and those of its tasks go to the trash too: the board (tag counts,
      // sub-task rings), the sub-task lists and the sub-task windows reload.
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: taskKeys.allSubtasks });
      void client.invalidateQueries({ queryKey: taskKeys.details });
    },
  });
  return mutation;
}
