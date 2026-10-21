import type { BoardDetail, SearchHit, Tag } from '@ordo/contracts';
import { SEARCH_LIMIT_MAX } from '@ordo/contracts';
import {
  foldTagName,
  parseFilterQuery,
  resolveQueryTags,
  SEARCH_TEXT_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  type CalendarDay,
  type DueFilter,
  type ParsedQuery,
  type Priority,
  type TaskFilters,
} from '@ordo/domain';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { filterTasks, SEARCH_GC_MS, TEXT_DEBOUNCE_MS, useDebouncedValue } from '@renderer/features/search';
import { call } from '@renderer/shared/api/client';
import { boardKeys, searchKeys } from '@renderer/shared/api/keys';
import { fromCard, fromHit, hitMatches, tagSuggestions, type PaletteTask } from '../model';

export interface PaletteSearch {
  parsed: ParsedQuery;
  /** The typed filters on the board shown (tags as its tag ids); `text` is the free text. */
  filters: TaskFilters;
  /** Board tags recognised in the query, in typed order (chips). */
  tags: readonly Tag[];
  /** Board tags completing a `#prefix` being typed. */
  suggestions: readonly Tag[];
  /**
   * Tasks of the board shown: its cards passing the filters (the full-text ids of the whole board,
   * no limit), then its sub-tasks found by the search; best matches first. Complete for the cards.
   */
  thisBoard: readonly PaletteTask[];
  /** Hits elsewhere: on the other non-archived boards, or on every board when none is shown (free text only). */
  otherBoards: readonly PaletteTask[];
  /** The search hit its limit: `otherBoards.length` is a lower bound. */
  otherTruncated: boolean;
  /** Cards of the board shown passing the filters, and its card count ("N tâches sur M sur ce board"). */
  boardCount: { shown: number; total: number } | null;
  /** Priority, tag or due words typed while no board is shown: they are ignored (approved state). */
  filtersIgnored: boolean;
  /** Free text typed but its results not known yet (no "no result" flash while typing). */
  loading: boolean;
  /** The search failed (and nothing is known yet for this query). */
  error: boolean;
  retry: () => void;
}

const trimText = (text: string) => text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).trim();

/** What the palette asks `search.tasks` beyond the text: the typed filters, when a board is shown. */
export interface PaletteSearchFilters {
  priorities: readonly Priority[];
  due: readonly DueFilter[];
  tagNames: readonly string[];
  /** Only with due filters (the key then follows the calendar day). */
  today?: CalendarDay;
}

const NO_SEARCH_FILTERS: PaletteSearchFilters = { priorities: [], due: [], tagNames: [] };

/** Query key of the palette's `search.tasks` call (stories seed it). */
export const paletteTasksKey = (text: string, filters: PaletteSearchFilters = NO_SEARCH_FILTERS) =>
  [...searchKeys.tasks(text), filters] as const;

function searchFiltersOf(parsed: ParsedQuery, today: CalendarDay): PaletteSearchFilters {
  return {
    priorities: parsed.priorities,
    due: parsed.due,
    // The contract caps the list; "any of" the first 20 names is close enough for a typed query.
    tagNames: parsed.tagNames.slice(0, 20),
    ...(parsed.due.length > 0 ? { today } : {}),
  };
}

async function searchTasks(text: string, filters: PaletteSearchFilters): Promise<SearchHit[]> {
  // No tag can have a longer name: nothing matches (and the contract would refuse it).
  if (filters.tagNames.some((name) => name.trim().length > TAG_NAME_MAX_LENGTH)) return [];
  return call('search.tasks', {
    text,
    limit: SEARCH_LIMIT_MAX,
    ...(filters.priorities.length > 0 ? { priorities: [...filters.priorities] } : {}),
    ...(filters.due.length > 0 ? { due: [...filters.due], today: filters.today! } : {}),
    ...(filters.tagNames.length > 0 ? { tagNames: [...filters.tagNames] } : {}),
  });
}

/**
 * Everything the palette shows for a typed query (approved mockups: board "Filtres reconnus",
 * search-palette A, and the states approved with the lot 7 review). The query is debounced; free text
 * goes to the full-text index: `search.boardTaskIds` for the board shown (every card, no limit),
 * `search.tasks` with the typed filters for its sub-tasks and the other boards (filters before the
 * limit). Priority, tag and due words filter the board's cards locally with the domain rules.
 */
export function usePaletteSearch(
  query: string,
  board: BoardDetail | undefined,
  today: CalendarDay,
  /** A board is shown (its detail may still be loading). */
  boardShown: boolean = board !== undefined,
): PaletteSearch {
  const parsed = useMemo(() => parseFilterQuery(query), [query]);
  const boardTags = board?.tags;
  const { filters, tags } = useMemo(() => {
    if (!boardTags) {
      const none: TaskFilters = { priorities: [], tags: [], due: [], text: parsed.text };
      return { filters: none, tags: [] as Tag[] };
    }
    const resolved = resolveQueryTags(parsed, boardTags).filters;
    const byId = new Map(boardTags.map((tag) => [tag.id, tag]));
    return { filters: resolved, tags: resolved.tags.flatMap((id) => byId.get(id) ?? []) };
  }, [parsed, boardTags]);

  const text = trimText(parsed.text);
  // One debounce for the whole request (text and filters).
  const debouncedQuery = useDebouncedValue(query, TEXT_DEBOUNCE_MS);
  const debouncedParsed = useMemo(() => parseFilterQuery(debouncedQuery), [debouncedQuery]);
  const debounced = trimText(debouncedParsed.text);
  const hasBoard = board !== undefined;
  const searchFilters = useMemo(
    () => (hasBoard ? searchFiltersOf(debouncedParsed, today) : NO_SEARCH_FILTERS),
    [hasBoard, debouncedParsed, today],
  );
  const boardId = board?.id ?? '';

  const hits = useQuery({
    queryKey: paletteTasksKey(debounced, searchFilters),
    queryFn: () => searchTasks(debounced, searchFilters),
    enabled: debounced !== '',
    // Keep the previous hits while typing (no flash of "no result").
    placeholderData: (previous) => previous,
    staleTime: 0,
  });
  // Same key as the board filters (features/search), so both share one result.
  const boardIds = useQuery({
    queryKey: searchKeys.board(boardId, debounced),
    queryFn: () => call('search.boardTaskIds', { boardId, text: debounced }),
    enabled: hasBoard && debounced !== '',
    gcTime: SEARCH_GC_MS,
    // The previous ids only while typing on the same board, never another board's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === boardId ? previous : undefined,
    staleTime: Infinity,
  });

  const searching = text !== '' && debounced !== '';
  const hitList: readonly SearchHit[] | undefined = searching ? hits.data : undefined;
  const textIds = useMemo(
    () => (searching && boardIds.data ? new Set(boardIds.data.taskIds) : null),
    [searching, boardIds.data],
  );
  const failed =
    searching && ((hits.isError && !hits.data) || (hasBoard && boardIds.isError && !boardIds.data));
  const { refetch: refetchHits } = hits;
  const { refetch: refetchIds } = boardIds;

  return useMemo(() => {
    const boardTagKeys = tags.map((tag) => foldTagName(tag.name));
    const typedTagKeys = parsed.tagNames.map(foldTagName);
    let thisBoard: PaletteTask[] = [];
    const otherBoards: PaletteTask[] = [];
    let shownCards: number | null = null;
    if (board && (text === '' || textIds)) {
      const cards = filterTasks(board.tasks, filters, today, textIds);
      shownCards = cards.length;
      thisBoard = cards.map((task) => fromCard(task, board));
    }
    if (text !== '' && hitList) {
      const subtasks: PaletteTask[] = [];
      for (const hit of hitList) {
        if (board && hit.boardId === board.id) {
          if (hit.parentId && hitMatches(hit, filters, boardTagKeys, today)) subtasks.push(fromHit(hit));
        } else if (!board || hitMatches(hit, filters, typedTagKeys, today)) otherBoards.push(fromHit(hit));
      }
      // Best matches first: the order of the hits, then the cards beyond the search limit (board order).
      const rank = new Map(hitList.map((hit, index) => [hit.id, index]));
      const at = (task: PaletteTask) => rank.get(task.id) ?? hitList.length;
      thisBoard = [...thisBoard, ...subtasks]
        .map((task, index) => ({ task, index }))
        .sort((a, b) => at(a.task) - at(b.task) || a.index - b.index)
        .map(({ task }) => task);
    }
    const filtersIgnored =
      !boardShown && (parsed.priorities.length > 0 || parsed.due.length > 0 || parsed.tagNames.length > 0);
    return {
      parsed,
      filters,
      tags,
      suggestions: board ? tagSuggestions(query, board.tags) : [],
      thisBoard,
      otherBoards,
      otherTruncated: hitList !== undefined && hitList.length >= SEARCH_LIMIT_MAX,
      boardCount: board
        ? {
            shown: shownCards ?? filterTasks(board.tasks, filters, today, null).length,
            total: board.tasks.length,
          }
        : null,
      filtersIgnored,
      loading: !failed && text !== '' && (hitList === undefined || (board !== undefined && textIds === null)),
      error: failed,
      retry: () => {
        void refetchHits();
        if (board) void refetchIds();
      },
    };
  }, [
    parsed,
    filters,
    tags,
    text,
    hitList,
    board,
    boardShown,
    today,
    textIds,
    query,
    failed,
    refetchHits,
    refetchIds,
  ]);
}

/** The board shown behind the palette, if any (same cache entry as the board page). */
export function usePaletteBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(boardId ?? ''),
    queryFn: () => call('boards.get', { id: boardId! }),
    enabled: boardId !== undefined,
  });
}
