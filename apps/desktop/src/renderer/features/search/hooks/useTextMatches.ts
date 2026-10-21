import { SEARCH_TEXT_MAX_LENGTH } from '@ordo/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { call } from '@renderer/shared/api/client';
import { boardKeys, searchKeys } from '@renderer/shared/api/keys';

/** Input debounce of the free text (performance budget: 150 ms). */
export const TEXT_DEBOUNCE_MS = 150;

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const toSet = (output: { taskIds: string[] }): ReadonlySet<string> => new Set(output.taskIds);

/**
 * Ids of the board's cards matching the free text (full-text index in the main process), or `null`
 * when there is no text. The text is debounced and the previous result kept while typing; the key
 * carries the board query's `dataUpdatedAt`, so editing a task refreshes the result. Until the first
 * result arrives, or if the search fails, `null` (the text does not filter).
 */
export function useTextMatches(boardId: string, text: string): ReadonlySet<string> | null {
  const trimmed = text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).trim();
  const debounced = useDebouncedValue(trimmed, TEXT_DEBOUNCE_MS);
  // Only the update time of the board query: no re-render on other changes of its state.
  const { dataUpdatedAt } = useQuery({
    queryKey: boardKeys.detail(boardId),
    queryFn: () => call('boards.get', { id: boardId }),
    notifyOnChangeProps: ['dataUpdatedAt'],
  });
  const { data } = useQuery({
    queryKey: searchKeys.board(boardId, debounced, dataUpdatedAt),
    queryFn: () => call('search.boardTaskIds', { boardId, text: debounced }),
    enabled: debounced !== '',
    placeholderData: keepPreviousData,
    select: toSet,
    staleTime: Infinity,
  });
  if (trimmed === '' || debounced === '') return null;
  return data ?? null;
}
