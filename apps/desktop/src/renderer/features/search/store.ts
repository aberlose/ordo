import { EMPTY_FILTERS, type DueFilter, type Priority, type TaskFilters } from '@ordo/domain';
import { create } from 'zustand';

/** A list kind of filter (the free text is a string). */
export type FilterKind = 'priorities' | 'tags' | 'due';
type FilterValue<K extends FilterKind> = K extends 'priorities'
  ? Priority
  : K extends 'tags'
    ? string
    : DueFilter;

export interface SearchState {
  /** Applied filters of each board (tags are tag ids). In memory: reset at restart (user decision). */
  byBoard: Readonly<Record<string, TaskFilters>>;
  /** Filters typed in the open palette: the board shows them live until the palette closes or applies them. */
  preview: { readonly boardId: string; readonly filters: TaskFilters } | null;
  toggle: <K extends FilterKind>(boardId: string, kind: K, value: FilterValue<K>) => void;
  clearKind: (boardId: string, kind: FilterKind) => void;
  clearText: (boardId: string) => void;
  clearAll: (boardId: string) => void;
  /** Replace the board's filters (palette: Enter). */
  apply: (boardId: string, filters: TaskFilters) => void;
  setPreview: (boardId: string, filters: TaskFilters) => void;
  clearPreview: () => void;
}

const filtersOf = (state: SearchState, boardId: string): TaskFilters =>
  state.byBoard[boardId] ?? EMPTY_FILTERS;

function update(state: SearchState, boardId: string, change: (filters: TaskFilters) => TaskFilters) {
  return { byBoard: { ...state.byBoard, [boardId]: change(filtersOf(state, boardId)) } };
}

/** Board filters (ephemeral UI state, never persisted). */
export const useSearchStore = create<SearchState>((set) => ({
  byBoard: {},
  preview: null,
  toggle: (boardId, kind, value) =>
    set((state) =>
      update(state, boardId, (filters) => {
        const list = filters[kind] as readonly FilterValue<typeof kind>[];
        const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
        return { ...filters, [kind]: next };
      }),
    ),
  clearKind: (boardId, kind) =>
    set((state) => update(state, boardId, (filters) => ({ ...filters, [kind]: [] }))),
  clearText: (boardId) => set((state) => update(state, boardId, (filters) => ({ ...filters, text: '' }))),
  clearAll: (boardId) => set((state) => update(state, boardId, () => EMPTY_FILTERS)),
  apply: (boardId, filters) => set((state) => update(state, boardId, () => filters)),
  setPreview: (boardId, filters) => set({ preview: { boardId, filters } }),
  clearPreview: () => set({ preview: null }),
}));

/** The filters applied to a board (what the filter bar shows). */
export function useBoardFilters(boardId: string): TaskFilters {
  return useSearchStore((state) => filtersOf(state, boardId));
}

/** The filters the board's cards are matched against: the palette's live preview, else the applied ones. */
export function useShownFilters(boardId: string): TaskFilters {
  return useSearchStore((state) =>
    state.preview?.boardId === boardId ? state.preview.filters : filtersOf(state, boardId),
  );
}

/** Whether the palette is previewing filters on this board. */
export function useIsPreviewing(boardId: string): boolean {
  return useSearchStore((state) => state.preview?.boardId === boardId);
}
