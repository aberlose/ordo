import { useSearchStore, type SearchState } from './store';

export { FilterBar, type FilterBarProps } from './components/FilterBar';
export { effectiveFilters, filterTasks, filterable, optionCounts } from './filtering';
export { useBoardFiltering, type BoardFiltering } from './hooks/useBoardFiltering';
export {
  SEARCH_GC_MS,
  TEXT_DEBOUNCE_MS,
  useDebouncedValue,
  useTextMatches,
  type TextMatches,
} from './hooks/useTextMatches';
export {
  useBoardFilters,
  useIsPreviewing,
  useSearchStore,
  useShownFilters,
  type FilterKind,
  type SearchState,
} from './store';

/**
 * Filter actions for other features (command palette): `apply(boardId, filters)` replaces a board's
 * filters, `setPreview(boardId, filters)` / `clearPreview()` drive the live preview while the palette
 * is open, `toggle`, `clearKind`, `clearText`, `clearAll` edit one board's filters.
 */
export const searchActions = (): SearchState => useSearchStore.getState();
