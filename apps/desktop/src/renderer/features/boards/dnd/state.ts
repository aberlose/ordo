import { create } from 'zustand';

/** Kinds of drag data and drop targets for columns (Pragmatic drag and drop `data.type`). */
export const COLUMN_DRAG = {
  column: 'ordo/column',
  columnTarget: 'ordo/column-target',
  slot: 'ordo/column-slot',
  area: 'ordo/column-area',
} as const;

export const isColumnDrag = (data: Record<string | symbol, unknown>): boolean =>
  data['type'] === COLUMN_DRAG.column;

interface ColumnDragState {
  /** Column being dragged; it leaves its place while dragged (mockup drag-and-drop/ColumnDrag B). */
  draggingId: string | null;
  /** Index of the slot among the other columns. */
  targetIndex: number | null;
  /** Header to focus once rendered (after a keyboard move). */
  focusId: string | null;
  set: (state: Partial<Pick<ColumnDragState, 'draggingId' | 'targetIndex' | 'focusId'>>) => void;
}

export const useColumnDrag = create<ColumnDragState>((set) => ({
  draggingId: null,
  targetIndex: null,
  focusId: null,
  set: (state) => set(state),
}));
