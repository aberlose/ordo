import type { BoardDetail, Input } from '@ordo/contracts';
import { rankBetween } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
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
