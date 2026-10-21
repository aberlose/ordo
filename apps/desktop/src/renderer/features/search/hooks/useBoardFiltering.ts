import type { BoardDetail, Task } from '@ordo/contracts';
import { hasActiveFilters, type CalendarDay, type TaskFilters } from '@ordo/domain';
import { useMemo } from 'react';
import { effectiveFilters, filterTasks } from '../filtering';
import { useIsPreviewing, useShownFilters } from '../store';
import { useTextMatches } from './useTextMatches';

export interface BoardFiltering {
  /** Filters the cards are matched against (palette preview, else applied), without deleted tags. */
  filters: TaskFilters;
  /** Whether cards may be hidden: a filter is active or the palette previews its query. */
  filtered: boolean;
  /** The board's cards passing the filters (`board.tasks` itself when nothing filters). */
  visibleTasks: readonly Task[];
}

/** The cards of a board to show under its filters. */
export function useBoardFiltering(board: BoardDetail, today: CalendarDay): BoardFiltering {
  const tagIds = useMemo(() => new Set(board.tags.map((tag) => tag.id)), [board.tags]);
  const shown = useShownFilters(board.id);
  const previewing = useIsPreviewing(board.id);
  const filters = useMemo(() => effectiveFilters(shown, tagIds), [shown, tagIds]);
  const textMatches = useTextMatches(board.id, filters.text);
  const visibleTasks = useMemo(
    () => filterTasks(board.tasks, filters, today, textMatches),
    [board.tasks, filters, today, textMatches],
  );
  return { filters, filtered: previewing || hasActiveFilters(filters), visibleTasks };
}
