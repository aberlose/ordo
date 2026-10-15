import type { ArchivedBoard, BoardSummary } from '@ordo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import i18n from '@renderer/i18n';

/** Archived boards, newest archive first (`boardKeys.archived`). */
export function useArchivedBoards() {
  return useQuery({ queryKey: boardKeys.archived, queryFn: () => call('boards.listArchived', {}) });
}

/**
 * Restore an archived board (approved mockup boards/BoardArchives A), optimistic: the row leaves
 * the archives and the board goes to the end of the sidebar. Both lists reload once it settles.
 */
export function useRestoreBoard() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => call('boards.restore', { id }),
    onMutate: async (id) => {
      await Promise.all([
        client.cancelQueries({ queryKey: boardKeys.archived, exact: true }),
        client.cancelQueries({ queryKey: boardKeys.all, exact: true }),
      ]);
      const archived = client.getQueryData<ArchivedBoard[]>(boardKeys.archived);
      const restored = archived?.find((board) => board.id === id);
      if (!archived || !restored) return;
      client.setQueryData<ArchivedBoard[]>(
        boardKeys.archived,
        archived.filter((board) => board.id !== id),
      );
      const summary: BoardSummary = {
        id: restored.id,
        name: restored.name,
        icon: restored.icon,
        color: restored.color,
        taskCount: restored.taskCount,
      };
      client.setQueryData<BoardSummary[]>(boardKeys.all, (boards) =>
        boards && !boards.some((board) => board.id === id) ? [...boards, summary] : boards,
      );
    },
    // Other restores may overlap: reload both lists rather than restoring a snapshot.
    onError: (_error, id) => {
      useFeedback.getState().showToast(i18n.t('feedback.failed.restoreBoard'), () => mutation.mutate(id));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: boardKeys.archived, exact: true });
      void client.invalidateQueries({ queryKey: boardKeys.all, exact: true });
    },
  });
  return mutation;
}
