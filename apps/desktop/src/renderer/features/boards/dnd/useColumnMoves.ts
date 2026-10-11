import type { BoardDetail } from '@ordo/contracts';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { dropIndex, isSamePlace, keyboardColumnMove, placeAt } from '@ordo/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useMoveColumn } from '../hooks/queries';

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

/** Column reorder for a board: the drag-and-drop monitor and ⌥/Alt + ←→ on a focused header. */
export function useColumnMoves(board: BoardDetail) {
  const { t } = useTranslation();
  // `mutate` is stable across renders (the mutation object is not).
  const { mutate } = useMoveColumn(board.id);
  const latest = useRef(board);
  useEffect(() => {
    latest.current = board;
  });
  const ids = () => latest.current.columns.map((c) => c.id);

  const commit = useCallback(
    (columnId: string, index: number, focus: boolean) => {
      const placement = placeAt(ids(), columnId, index);
      mutate({ columnId, beforeId: placement.beforeId, afterId: placement.afterId });
      const column = latest.current.columns.find((c) => c.id === columnId);
      useFeedback.getState().announce(
        t('dnd.columnMoved', {
          column: column?.name ?? '',
          position: placement.index + 1,
          total: ids().length,
        }),
      );
      if (focus) useColumnDrag.getState().set({ focusId: columnId });
    },
    // ids() reads the latest board through a ref.
    [mutate, t],
  );

  useEffect(() => {
    /** Where the slot opens for the drop targets under the pointer (innermost first). */
    const follow = (
      data: Record<string | symbol, unknown>,
      dropTargets: readonly { data: Record<string | symbol, unknown> }[],
    ) => {
      const columnId = data['columnId'] as string;
      const [inner] = dropTargets;
      const state = useColumnDrag.getState();
      if (!inner) return;
      const type = inner.data['type'];
      let index = state.targetIndex;
      if (type === COLUMN_DRAG.columnTarget) {
        const edge = extractClosestEdge(inner.data);
        index = dropIndex(
          ids(),
          columnId,
          inner.data['columnId'] as string,
          edge === 'right' ? 'right' : 'left',
        );
      } else if (type === COLUMN_DRAG.area && state.targetIndex === null) {
        index = ids().length - 1;
      }
      if (index !== state.targetIndex) state.set({ targetIndex: index });
    };
    return monitorForElements({
      canMonitor: ({ source }) => isColumnDrag(source.data),
      onDragStart: ({ source }) =>
        useColumnDrag.getState().set({ draggingId: source.data['columnId'] as string, targetIndex: null }),
      // onDrag is throttled to animation frames; onDropTargetChange fires on every target change.
      onDrag: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDropTargetChange: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDrop: ({ source, location }) => {
        follow(source.data, location.current.dropTargets);
        const { targetIndex } = useColumnDrag.getState();
        useColumnDrag.getState().set({ draggingId: null, targetIndex: null });
        const columnId = source.data['columnId'] as string;
        if (targetIndex === null || isSamePlace(ids(), columnId, targetIndex)) return;
        commit(columnId, targetIndex, false);
      },
    });
  }, [commit]);

  const moveWithKeyboard = useCallback(
    (columnId: string, direction: 'left' | 'right'): boolean => {
      const target = keyboardColumnMove(ids(), columnId, direction);
      if (!target) {
        useFeedback.getState().announce(t('dnd.edge'));
        return false;
      }
      commit(columnId, target.index, true);
      return true;
    },
    // ids() reads the latest board through a ref.
    [commit, t],
  );

  return { moveWithKeyboard };
}
