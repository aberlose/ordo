import type { BoardSummary } from '@ordo/contracts';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { dropIndex, isSamePlace, keyboardBoardMove, placeAt } from '@ordo/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useMoveBoard } from '../hooks/queries';

/** Kinds of drag data and drop targets for sidebar boards (Pragmatic drag and drop `data.type`). */
export const BOARD_DRAG = {
  board: 'ordo/board',
  boardTarget: 'ordo/board-target',
  slot: 'ordo/board-slot',
  list: 'ordo/board-list',
} as const;

export const isBoardDrag = (data: Record<string | symbol, unknown>): boolean =>
  data['type'] === BOARD_DRAG.board;

interface BoardDragState {
  /** Board being dragged; it leaves its place while dragged (mockup boards/BoardReorder A). */
  draggingId: string | null;
  /** Index of the slot among the other boards. */
  targetIndex: number | null;
  /** Row or tile to focus once rendered (after a keyboard move or an archive). */
  focusId: string | null;
  set: (state: Partial<Pick<BoardDragState, 'draggingId' | 'targetIndex' | 'focusId'>>) => void;
}

export const useBoardDrag = create<BoardDragState>((set) => ({
  draggingId: null,
  targetIndex: null,
  focusId: null,
  set: (state) => set(state),
}));

/** Board reorder in the sidebar: the drag-and-drop monitor and ⌥/Alt + ↑↓ on a focused row or tile. */
export function useBoardMoves(boards: readonly BoardSummary[]) {
  const { t } = useTranslation();
  // `mutate` is stable across renders (the mutation object is not).
  const { mutate } = useMoveBoard();
  const latest = useRef(boards);
  useEffect(() => {
    latest.current = boards;
  });
  const ids = () => latest.current.map((board) => board.id);

  const commit = useCallback(
    (boardId: string, index: number, focus: boolean) => {
      const placement = placeAt(ids(), boardId, index);
      mutate({ boardId, beforeId: placement.beforeId, afterId: placement.afterId });
      const board = latest.current.find((b) => b.id === boardId);
      useFeedback.getState().announce(
        t('sidebar.boardMoved', {
          board: board?.name ?? '',
          position: placement.index + 1,
          total: ids().length,
        }),
      );
      if (focus) useBoardDrag.getState().set({ focusId: boardId });
    },
    // ids() reads the latest boards through a ref.
    [mutate, t],
  );

  useEffect(() => {
    /** Where the slot opens for the drop targets under the pointer (innermost first). */
    const follow = (
      data: Record<string | symbol, unknown>,
      dropTargets: readonly { data: Record<string | symbol, unknown> }[],
    ) => {
      const boardId = data['boardId'] as string;
      const [inner] = dropTargets;
      const state = useBoardDrag.getState();
      if (!inner) return;
      const type = inner.data['type'];
      let index = state.targetIndex;
      if (type === BOARD_DRAG.boardTarget) {
        const edge = extractClosestEdge(inner.data);
        index = dropIndex(
          ids(),
          boardId,
          inner.data['boardId'] as string,
          edge === 'bottom' ? 'bottom' : 'top',
        );
      } else if (type === BOARD_DRAG.list && state.targetIndex === null) {
        index = ids().length - 1;
      }
      // Over the slot itself: it stays where it is.
      if (index !== state.targetIndex) state.set({ targetIndex: index });
    };
    return monitorForElements({
      canMonitor: ({ source }) => isBoardDrag(source.data),
      onDragStart: ({ source }) =>
        useBoardDrag.getState().set({ draggingId: source.data['boardId'] as string, targetIndex: null }),
      // onDrag is throttled to animation frames (edge changes on one row); onDropTargetChange and
      // onDrop catch every change of target.
      onDrag: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDropTargetChange: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDrop: ({ source, location }) => {
        follow(source.data, location.current.dropTargets);
        const { targetIndex } = useBoardDrag.getState();
        useBoardDrag.getState().set({ draggingId: null, targetIndex: null });
        const boardId = source.data['boardId'] as string;
        // Dropped outside the list: nothing moves.
        if (location.current.dropTargets.length === 0) return;
        if (targetIndex === null || isSamePlace(ids(), boardId, targetIndex)) return;
        commit(boardId, targetIndex, false);
      },
    });
  }, [commit]);

  const moveWithKeyboard = useCallback(
    (boardId: string, direction: 'up' | 'down'): boolean => {
      const target = keyboardBoardMove(ids(), boardId, direction);
      if (!target) {
        useFeedback.getState().announce(t('dnd.edge'));
        return false;
      }
      commit(boardId, target.index, true);
      return true;
    },
    // ids() reads the latest boards through a ref.
    [commit, t],
  );

  return { moveWithKeyboard };
}
