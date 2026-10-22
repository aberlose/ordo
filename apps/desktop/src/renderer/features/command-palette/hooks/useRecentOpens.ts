import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTaskUi } from '@renderer/features/tasks';
import { call } from '@renderer/shared/api/client';
import { searchKeys } from '@renderer/shared/api/keys';

/**
 * Records every task opened in the detail window, whatever opened it (card, palette, sub-task row,
 * parent link), for the palette's "Récemment ouvertes". Mounted once in the layout.
 */
export function useRecordRecentOpens(): void {
  const client = useQueryClient();
  useEffect(
    () =>
      useTaskUi.subscribe((state, previous) => {
        const taskId = state.openTaskId;
        if (!taskId || taskId === previous.openTaskId) return;
        call('recent.record', { taskId }).then(
          () => client.invalidateQueries({ queryKey: searchKeys.recent }),
          // Not worth a toast: the list is a convenience.
          () => undefined,
        );
      }),
    [client],
  );
}

/** The recently opened tasks, refetched each time the palette opens (its content mounts). */
export function useRecentTasks() {
  return useQuery({
    queryKey: searchKeys.recent,
    queryFn: () => call('recent.list', {}),
    staleTime: 0,
  });
}
