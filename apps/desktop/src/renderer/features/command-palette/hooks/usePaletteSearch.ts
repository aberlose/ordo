import type { BoardDetail, SearchHit, Tag } from '@ordo/contracts';
import { SEARCH_LIMIT_MAX } from '@ordo/contracts';
import {
  foldTagName,
  parseFilterQuery,
  resolveQueryTags,
  SEARCH_TEXT_MAX_LENGTH,
  type CalendarDay,
  type ParsedQuery,
  type TaskFilters,
} from '@ordo/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { filterTasks, TEXT_DEBOUNCE_MS, useDebouncedValue } from '@renderer/features/search';
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
  /** Tasks of the board shown: search hits (cards and sub-tasks) with free text, else matching cards. */
  thisBoard: readonly PaletteTask[];
  /** Hits on the other non-archived boards (free text only). */
  otherBoards: readonly PaletteTask[];
  /** Cards of the board shown passing the filters, and its card count ("N tâches sur M sur ce board"). */
  boardCount: { shown: number; total: number } | null;
  /** Free text typed but its results not known yet (no "no result" flash while typing). */
  loading: boolean;
}

const trimText = (text: string) => text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).trim();

/**
 * Everything the palette shows for a typed query (approved mockups: board "Filtres reconnus",
 * search-palette A). Free text goes to the full-text index, debounced; priority, tag and due words
 * filter locally with the domain rules.
 */
export function usePaletteSearch(
  query: string,
  board: BoardDetail | undefined,
  boardUpdatedAt: number,
  today: CalendarDay,
): PaletteSearch {
  const parsed = useMemo(() => parseFilterQuery(query), [query]);
  const boardTags = board?.tags;
  const { filters, tags } = useMemo(() => {
    if (!boardTags) {
      const none: TaskFilters = {
        priorities: parsed.priorities,
        tags: [],
        due: parsed.due,
        text: parsed.text,
      };
      return { filters: none, tags: [] as Tag[] };
    }
    const resolved = resolveQueryTags(parsed, boardTags).filters;
    const byId = new Map(boardTags.map((tag) => [tag.id, tag]));
    return { filters: resolved, tags: resolved.tags.flatMap((id) => byId.get(id) ?? []) };
  }, [parsed, boardTags]);

  const text = trimText(parsed.text);
  const debounced = useDebouncedValue(text, TEXT_DEBOUNCE_MS);
  const hits = useQuery({
    queryKey: searchKeys.tasks(debounced),
    queryFn: () => call('search.tasks', { text: debounced, limit: SEARCH_LIMIT_MAX }),
    enabled: debounced !== '',
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
  // Same key as the board filters (features/search), so both share one result.
  const boardIds = useQuery({
    queryKey: searchKeys.board(board?.id ?? '', debounced, boardUpdatedAt),
    queryFn: () => call('search.boardTaskIds', { boardId: board!.id, text: debounced }),
    enabled: board !== undefined && debounced !== '',
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

  const hitList: readonly SearchHit[] | undefined = text !== '' && debounced !== '' ? hits.data : undefined;
  const textIds = useMemo(
    () => (text !== '' && boardIds.data ? new Set(boardIds.data.taskIds) : null),
    [text, boardIds.data],
  );

  return useMemo(() => {
    const boardTagKeys = tags.map((tag) => foldTagName(tag.name));
    const typedTagKeys = parsed.tagNames.map(foldTagName);
    let thisBoard: PaletteTask[] = [];
    let otherBoards: PaletteTask[] = [];
    if (text !== '') {
      for (const hit of hitList ?? []) {
        if (board && hit.boardId === board.id) {
          if (hitMatches(hit, filters, boardTagKeys, today)) thisBoard.push(fromHit(hit));
        } else if (hitMatches(hit, filters, typedTagKeys, today)) otherBoards.push(fromHit(hit));
      }
    } else if (board) {
      thisBoard = filterTasks(board.tasks, filters, today, null).map((task) => fromCard(task, board));
      otherBoards = [];
    }
    const boardCount = board
      ? { shown: filterTasks(board.tasks, filters, today, textIds).length, total: board.tasks.length }
      : null;
    return {
      parsed,
      filters,
      tags,
      suggestions: board ? tagSuggestions(query, board.tags) : [],
      thisBoard,
      otherBoards,
      boardCount,
      loading: text !== '' && hitList === undefined,
    };
  }, [parsed, filters, tags, text, hitList, board, today, textIds, query]);
}

/** The board shown behind the palette, if any (same cache entry as the board page). */
export function usePaletteBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(boardId ?? ''),
    queryFn: () => call('boards.get', { id: boardId! }),
    enabled: boardId !== undefined,
  });
}
