import type { BoardDetail, Task } from '@ordo/contracts';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {
  dropIndex,
  isPastDisplayLimit,
  isSamePlace,
  keyboardTaskMove,
  placeAt,
  type MoveDirection,
} from '@ordo/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useMoveTask } from '../hooks/mutations';
import { useTaskUi } from '../store';
import { DRAG, isTaskDrag, useTaskDrag } from './state';

const FLASH_MS = 1200;

/**
 * Card moves for a board: the drag-and-drop monitor (mockup drag-and-drop/CardDrag B) and
 * ⌥/Alt + arrows (KeyboardMove B). Both end in one `tasks.move` call and a polite announcement.
 */
export function useTaskMoves(board: BoardDetail, tasksByColumn: ReadonlyMap<string, readonly Task[]>) {
  const { t } = useTranslation();
  // `mutate` is stable across renders (the mutation object is not).
  const { mutate } = useMoveTask(board.id);
  const latest = useRef({ board, tasksByColumn });
  useEffect(() => {
    latest.current = { board, tasksByColumn };
  });

  const idsOf = (columnId: string) =>
    (latest.current.tasksByColumn.get(columnId) ?? []).map((task) => task.id);

  const commit = useCallback(
    (taskId: string, toColumnId: string, index: number, focus: boolean) => {
      const ids = idsOf(toColumnId);
      const placement = placeAt(ids, taskId, index);
      mutate({ taskId, toColumnId, beforeId: placement.beforeId, afterId: placement.afterId });
      const column = latest.current.board.columns.find((c) => c.id === toColumnId);
      const total = ids.includes(taskId) ? ids.length : ids.length + 1;
      useFeedback
        .getState()
        .announce(t('dnd.taskMoved', { column: column?.name ?? '', position: placement.index + 1, total }));
      useTaskUi.getState().highlight(null);
      // A card landing past the display limit stays visible: the column expands.
      if (column && isPastDisplayLimit(placement.index, column.displayLimit)) {
        useTaskUi.getState().setColumnExpanded(toColumnId, true);
      }
      useTaskDrag.getState().moved(taskId, focus ? toColumnId : null);
    },
    // idsOf reads the latest board through a ref.
    [mutate, t],
  );

  // Mouse drag: one monitor for the board computes where the slot opens and commits on drop.
  useEffect(() => {
    /** Where the slot opens for the drop targets under the pointer (innermost first). */
    const follow = (
      data: Record<string | symbol, unknown>,
      dropTargets: readonly { data: Record<string | symbol, unknown> }[],
    ) => {
      if (!isTaskDrag(data)) return;
      const taskId = data.taskId;
      const [inner] = dropTargets;
      const state = useTaskDrag.getState();
      if (!inner) return state.setTarget(null);
      const type = inner.data['type'];
      const columnId = inner.data['columnId'] as string;
      // Over the slot itself or between columns: keep the slot where it is.
      if (type === DRAG.slot || type === DRAG.board) return;
      if (type === DRAG.taskTarget) {
        const edge = extractClosestEdge(inner.data);
        const index = dropIndex(
          idsOf(columnId),
          taskId,
          inner.data['taskId'] as string,
          edge === 'bottom' ? 'bottom' : 'top',
        );
        return state.setTarget({ columnId, index });
      }
      if (type === DRAG.columnBody && state.target?.columnId !== columnId) {
        // Over the column but not over a card: below the last card, unless the slot is already there.
        state.setTarget({ columnId, index: idsOf(columnId).filter((id) => id !== taskId).length });
      }
    };
    return monitorForElements({
      canMonitor: ({ source }) => isTaskDrag(source.data),
      onDragStart: ({ source }) => {
        if (!isTaskDrag(source.data)) return;
        const { taskId, columnId, height } = source.data;
        useTaskDrag.getState().start({ taskId, columnId, height });
      },
      // onDrag is throttled to animation frames; onDropTargetChange fires on every target change.
      onDrag: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDropTargetChange: ({ source, location }) => follow(source.data, location.current.dropTargets),
      onDrop: ({ source, location }) => {
        follow(source.data, location.current.dropTargets);
        const { target } = useTaskDrag.getState();
        useTaskDrag.getState().end();
        if (!isTaskDrag(source.data) || !target) return;
        const { taskId, columnId } = source.data;
        if (columnId === target.columnId && isSamePlace(idsOf(columnId), taskId, target.index)) return;
        commit(taskId, target.columnId, target.index, false);
      },
    });
  }, [commit]);

  // The moved card is tinted briefly.
  const flashTaskId = useTaskDrag((state) => state.flashTaskId);
  useEffect(() => {
    if (!flashTaskId) return;
    const timer = setTimeout(() => useTaskDrag.getState().clearFlash(), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashTaskId]);

  /** ⌥/Alt + arrows on a focused card. Returns false when the card cannot go further. */
  const moveWithKeyboard = useCallback(
    (taskId: string, direction: MoveDirection): boolean => {
      const layout = latest.current.board.columns.map((c) => ({ id: c.id, taskIds: idsOf(c.id) }));
      const target = keyboardTaskMove(layout, taskId, direction);
      if (!target) {
        useFeedback.getState().announce(t('dnd.edge'));
        return false;
      }
      commit(taskId, target.toColumnId, target.index, true);
      return true;
    },
    // idsOf reads the latest board through a ref.
    [commit, t],
  );

  return { moveWithKeyboard };
}
