import type { Input } from '@ordo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { boardKeys } from '@renderer/shared/api/keys';

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
