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
  openTask: (id: string) => void;
  closeTask: () => void;
  toggleExpanded: () => void;
  openQuickAdd: (columnId: string) => void;
  closeQuickAdd: () => void;
  highlight: (id: string | null) => void;
}

/** Ephemeral UI state for tasks (never persisted). */
export const useTaskUi = create<TaskUiState>((set) => ({
  openTaskId: null,
  expanded: false,
  quickAddColumnId: null,
  quickAddRequest: 0,
  highlightedTaskId: null,
  openTask: (id) => set({ openTaskId: id }),
  closeTask: () => set({ openTaskId: null, expanded: false }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  openQuickAdd: (columnId) =>
    set((state) => ({ quickAddColumnId: columnId, quickAddRequest: state.quickAddRequest + 1 })),
  closeQuickAdd: () => set({ quickAddColumnId: null }),
  highlight: (id) => set({ highlightedTaskId: id }),
}));
