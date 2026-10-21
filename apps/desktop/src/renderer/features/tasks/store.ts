import { create } from 'zustand';

interface TaskUiState {
  /** Task shown in the detail window, if any. */
  openTaskId: string | null;
  /** Detail window expanded to full screen. */
  expanded: boolean;
  /** Column whose quick-add field is open. */
  quickAddColumnId: string | null;
  /** Bumped on every open request, so an already open field takes the focus again. */
  quickAddRequest: number;
  /** Task just created by quick add, briefly highlighted. */
  highlightedTaskId: string | null;
  /** Columns showing every task past their display limit ("Voir N de plus"); not remembered across restarts. */
  expandedColumnIds: ReadonlySet<string>;
  /**
   * Cards created by quick add while board filters were active: shown even if they do not match,
   * until the filters change (the board view clears them).
   */
  keptTaskIds: ReadonlySet<string>;
  openTask: (id: string) => void;
  closeTask: () => void;
  toggleExpanded: () => void;
  openQuickAdd: (columnId: string) => void;
  closeQuickAdd: () => void;
  highlight: (id: string | null) => void;
  setColumnExpanded: (columnId: string, expanded: boolean) => void;
  keepTask: (id: string) => void;
  /** The saved task replaces its temporary id. */
  replaceKeptTask: (tempId: string, id: string) => void;
  clearKeptTasks: () => void;
}

const NO_IDS: ReadonlySet<string> = new Set();

/** Ephemeral UI state for tasks (never persisted). */
export const useTaskUi = create<TaskUiState>((set) => ({
  openTaskId: null,
  expanded: false,
  quickAddColumnId: null,
  quickAddRequest: 0,
  highlightedTaskId: null,
  expandedColumnIds: new Set(),
  keptTaskIds: NO_IDS,
  openTask: (id) => set({ openTaskId: id }),
  closeTask: () => set({ openTaskId: null, expanded: false }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  openQuickAdd: (columnId) =>
    set((state) => ({ quickAddColumnId: columnId, quickAddRequest: state.quickAddRequest + 1 })),
  closeQuickAdd: () => set({ quickAddColumnId: null }),
  highlight: (id) => set({ highlightedTaskId: id }),
  setColumnExpanded: (columnId, expanded) =>
    set((state) => {
      if (state.expandedColumnIds.has(columnId) === expanded) return state;
      const next = new Set(state.expandedColumnIds);
      if (expanded) next.add(columnId);
      else next.delete(columnId);
      return { expandedColumnIds: next };
    }),
  keepTask: (id) => set((state) => ({ keptTaskIds: new Set([...state.keptTaskIds, id]) })),
  replaceKeptTask: (tempId, id) =>
    set((state) => {
      if (!state.keptTaskIds.has(tempId)) return state;
      const next = new Set(state.keptTaskIds);
      next.delete(tempId);
      next.add(id);
      return { keptTaskIds: next };
    }),
  clearKeptTasks: () => set((state) => (state.keptTaskIds.size === 0 ? state : { keptTaskIds: NO_IDS })),
}));
