import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchKeys } from '@renderer/shared/api/keys';
import { board, tasks } from '@renderer/test/fixtures';
import { useCreateTask, useDeleteTask, useMoveTask, useUpdateTask } from './mutations';
import { useSaveDescription } from './notes';

const task = tasks[0]!;
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['boards', board.id], board);
  client.setQueryData(searchKeys.board(board.id, 'pdf'), { taskIds: [] });
  vi.stubGlobal('api', {
    invoke: (channel: string) =>
      Promise.resolve({
        ok: true,
        data: channel === 'tasks.updateDescription' ? { id: task.id, json: null, updatedAt: 1 } : task,
      }),
    getPathForFile: () => '',
  });
});
afterEach(() => vi.unstubAllGlobals());

const invalidated = () => client.getQueryState(searchKeys.board(board.id, 'pdf'))?.isInvalidated;

describe('search results after task mutations', () => {
  it('are invalidated by an edit, a creation, a deletion and a notes save', async () => {
    const { result } = renderHook(
      () => ({
        update: useUpdateTask(board.id),
        create: useCreateTask(board.id),
        remove: useDeleteTask(board.id),
        notes: useSaveDescription(task.id),
      }),
      { wrapper },
    );
    const runs = [
      () => result.current.update.mutateAsync({ id: task.id, title: 'Nouveau titre' }),
      () =>
        result.current.create.mutateAsync({ columnId: task.columnId, title: 'Une tâche', tempId: 'temp-1' }),
      () => result.current.remove.mutateAsync(task.id),
      () => result.current.notes.mutateAsync(null),
    ];
    for (const run of runs) {
      client.setQueryData(searchKeys.board(board.id, 'pdf'), { taskIds: [] });
      expect(invalidated()).toBe(false);
      await act(run);
      expect(invalidated()).toBe(true);
    }
  });

  it('are kept by a move (the text does not change)', async () => {
    const move = renderHook(() => useMoveTask(board.id), { wrapper }).result;
    await act(() =>
      move.current.mutateAsync({ taskId: task.id, toColumnId: task.columnId, beforeId: null, afterId: null }),
    );
    expect(invalidated()).toBe(false);
  });
});
