import { create } from 'zustand';

/** Kinds of drag data and drop targets for cards (Pragmatic drag and drop `data.type`). */
export const DRAG = {
  task: 'ordo/task',
  taskTarget: 'ordo/task-target',
  slot: 'ordo/task-slot',
  columnBody: 'ordo/column-body',
  board: 'ordo/task-board',
} as const;

export interface TaskDragData {
  readonly type: typeof DRAG.task;
  readonly taskId: string;
  readonly columnId: string;
  readonly height: number;
  [key: string | symbol]: unknown;
}

export const isTaskDrag = (data: Record<string | symbol, unknown>): data is TaskDragData =>
  data['type'] === DRAG.task;

interface TaskDragState {
  /** Card being dragged with the mouse; it leaves its column while dragged (mockup CardDrag B). */
  dragging: { taskId: string; columnId: string; height: number } | null;
  /** Where the slot opens: column and index in that column without the dragged card. */
  target: { columnId: string; index: number } | null;
  /** Card to focus once rendered in its new column (after a keyboard move). */
  focus: { taskId: string; columnId: string } | null;
  /** Card that just moved, briefly tinted accent-soft. */
  flashTaskId: string | null;
  start: (dragging: NonNullable<TaskDragState['dragging']>) => void;
  setTarget: (target: TaskDragState['target']) => void;
  end: () => void;
  moved: (taskId: string, focusInColumn: string | null) => void;
  focused: () => void;
  clearFlash: () => void;
}

export const useTaskDrag = create<TaskDragState>((set, get) => ({
  dragging: null,
  target: null,
  focus: null,
  flashTaskId: null,
  start: (dragging) => set({ dragging, target: null }),
  setTarget: (target) => {
    const current = get().target;
    if (current?.columnId === target?.columnId && current?.index === target?.index) return;
    set({ target });
  },
  end: () => set({ dragging: null, target: null }),
  moved: (taskId, focusInColumn) =>
    set({ flashTaskId: taskId, focus: focusInColumn ? { taskId, columnId: focusInColumn } : null }),
  focused: () => set({ focus: null }),
  clearFlash: () => set({ flashTaskId: null }),
}));

/**
 * Drop data for a whole column (header and empty space included) receiving a dragged card: the card
 * goes below the last one, unless the slot is already open there. Less precision needed. The column
 * element is also a column drop target, so the board merges both into one registration.
 */
export const cardDropDataForColumn = (columnId: string) => ({ type: DRAG.columnBody, columnId });

/** Drop data for the board area: gaps between columns keep the slot where it is. */
export const cardDropDataForBoard = () => ({ type: DRAG.board });
