import type { MoveDirection } from '@ordo/domain';

/** A column as the keyboard sees it: the ids of its cards on screen, top to bottom. */
export interface NavigableColumn {
  readonly id: string;
  readonly taskIds: readonly string[];
}

/**
 * The card plain arrows go to from `taskId` (spec: "arrows to navigate"): ↑/↓ the previous/next card
 * of the column, ←/→ the card at the same position (or the last one) in the nearest column on that side
 * that shows a card. `null` at an edge.
 */
export function cardNavigationTarget(
  columns: readonly NavigableColumn[],
  taskId: string,
  direction: MoveDirection,
): { taskId: string; columnId: string } | null {
  const columnIndex = columns.findIndex((c) => c.taskIds.includes(taskId));
  const column = columns[columnIndex];
  if (!column) return null;
  const index = column.taskIds.indexOf(taskId);
  if (direction === 'up' || direction === 'down') {
    const next = column.taskIds[index + (direction === 'up' ? -1 : 1)];
    return next === undefined ? null : { taskId: next, columnId: column.id };
  }
  const step = direction === 'left' ? -1 : 1;
  for (let i = columnIndex + step; i >= 0 && i < columns.length; i += step) {
    const other = columns[i]!;
    if (other.taskIds.length === 0) continue;
    const target = other.taskIds[Math.min(index, other.taskIds.length - 1)]!;
    return { taskId: target, columnId: other.id };
  }
  return null;
}
