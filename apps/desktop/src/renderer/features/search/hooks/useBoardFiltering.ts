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
  /**
   * The text's first result for this board is on its way: no card is shown yet, and the columns do
   * not say that nothing matches.
   */
  pending: boolean;
  /** The board's cards passing the filters (`board.tasks` itself when nothing filters). */
  visibleTasks: readonly Task[];
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * The cards of a board to show under its filters. `keptIds` are cards shown whatever the filters
 * (created by quick add under the current filters: the caller drops them when the filters change).
 */
export function useBoardFiltering(
  board: BoardDetail,
  today: CalendarDay,
  keptIds: ReadonlySet<string> = NO_IDS,
): BoardFiltering {
  const tagIds = useMemo(() => new Set(board.tags.map((tag) => tag.id)), [board.tags]);
  const shown = useShownFilters(board.id);
  const previewing = useIsPreviewing(board.id);
  const filters = useMemo(() => effectiveFilters(shown, tagIds), [shown, tagIds]);
  const { matches, pending } = useTextMatches(board.id, filters.text);
  const visibleTasks = useMemo(() => {
    const passing = filterTasks(board.tasks, filters, today, matches);
    if (keptIds.size === 0 || passing === board.tasks) return passing;
    const passingIds = new Set(passing.map((task) => task.id));
    return board.tasks.filter((task) => passingIds.has(task.id) || keptIds.has(task.id));
  }, [board.tasks, filters, today, matches, keptIds]);
  return { filters, filtered: previewing || hasActiveFilters(filters), pending, visibleTasks };
}
