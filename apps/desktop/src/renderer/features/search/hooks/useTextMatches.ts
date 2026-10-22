import { SEARCH_TEXT_MAX_LENGTH } from '@ordo/domain';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { call } from '@renderer/shared/api/client';
import { searchKeys } from '@renderer/shared/api/keys';

/** Input debounce of the free text (performance budget: 150 ms). */
export const TEXT_DEBOUNCE_MS = 150;

/** How long an unused search result stays cached (results are cheap to recompute). */
export const SEARCH_GC_MS = 30_000;

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const toSet = (output: { taskIds: string[] }): ReadonlySet<string> => new Set(output.taskIds);
const NONE: ReadonlySet<string> = new Set();

function sameMatches(a: ReadonlySet<string> | null, b: ReadonlySet<string> | null): boolean {
  if (a === b) return true;
  if (a === null || b === null || a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** What the board's free text matches. */
export interface TextMatches {
  /** Ids of the matching cards, or `null` when the text does not filter (no text). */
  matches: ReadonlySet<string> | null;
  /**
   * The first result for this board is not known yet: `matches` is empty (no card shown, so none
   * flashes in then out), and the board does not say that nothing matches.
   */
  pending: boolean;
}

/** The text, debounced while typing; a board change takes the new board's text at once. */
function useBoardText(boardId: string, text: string): string {
  const [state, setState] = useState({ boardId, debounced: text });
  // Derived state (React's "storing information from previous renders"): no stale frame on a board change.
  if (state.boardId !== boardId) setState({ boardId, debounced: text });
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.boardId !== boardId || current.debounced === text ? current : { boardId, debounced: text },
        ),
      TEXT_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [boardId, text]);
  return state.boardId === boardId ? state.debounced : text;
}

/**
 * The board's cards matching the free text (full-text index in the main process). The text is
 * debounced; while a result is on its way, the board keeps showing what it showed last for this
 * board (the previous text's matches, or every card when there was no text), and on a failed search
 * it keeps that too. Only when nothing was shown for this board yet (board just opened with a text
 * filter) are the cards hidden until the result arrives (`pending`).
 */
export function useTextMatches(boardId: string, text: string): TextMatches {
  const trimmed = text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).trim();
  const debounced = useBoardText(boardId, trimmed);
  const { data, isError } = useQuery({
    queryKey: searchKeys.board(boardId, debounced),
    queryFn: () => call('search.boardTaskIds', { boardId, text: debounced }),
    enabled: debounced !== '',
    select: toSet,
    staleTime: Infinity,
    gcTime: SEARCH_GC_MS,
  });
  const current: ReadonlySet<string> | null | undefined =
    trimmed === '' ? null : debounced === '' ? undefined : data;

  // The last result shown for a board (`null`: no text), kept while the next one is on its way.
  // Compared by content, not identity: before its first commit a query result's `select` output is
  // recomputed on every render, so an identity check would update the state on every render (loop).
  const [last, setLast] = useState<{ boardId: string; matches: ReadonlySet<string> | null } | null>(null);
  if (current !== undefined && (last?.boardId !== boardId || !sameMatches(last.matches, current))) {
    setLast({ boardId, matches: current });
  }
  if (current !== undefined) return { matches: current, pending: false };
  if (last?.boardId === boardId) return { matches: last.matches, pending: false };
  // Nothing shown for this board yet: hide the cards until the result, unless the search failed.
  return isError ? { matches: null, pending: false } : { matches: NONE, pending: true };
}
