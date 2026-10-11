/**
 * Where a moved card or column lands. Everything works on ordered lists of ids; the
 * caller turns the resulting neighbours into a rank (`rankBetween`) so a move writes one row.
 */

export interface Neighbours {
  /** Id of the item that will sit just before the moved one, `null` at the start. */
  readonly beforeId: string | null;
  /** Id of the item that will sit just after the moved one, `null` at the end. */
  readonly afterId: string | null;
}

export interface Placement extends Neighbours {
  /** Position of the moved item in its destination list, once moved. */
  readonly index: number;
}

/** Neighbours of `movingId` once inserted at `index` in `ids` (`movingId` is ignored if present). */
export function placeAt(ids: readonly string[], movingId: string, index: number): Placement {
  const others = ids.filter((id) => id !== movingId);
  const at = Math.max(0, Math.min(index, others.length));
  return { index: at, beforeId: others[at - 1] ?? null, afterId: others[at] ?? null };
}

/** Index in `ids` (without `movingId`) for a drop on the `edge` of `targetId`. */
export function dropIndex(
  ids: readonly string[],
  movingId: string,
  targetId: string,
  edge: 'top' | 'bottom' | 'left' | 'right',
): number {
  const others = ids.filter((id) => id !== movingId);
  const target = others.indexOf(targetId);
  if (target === -1) return others.length;
  return edge === 'bottom' || edge === 'right' ? target + 1 : target;
}

/** True when placing `movingId` at `index` (in the list without it) would not change anything. */
export function isSamePlace(ids: readonly string[], movingId: string, index: number): boolean {
  return ids.indexOf(movingId) === index;
}

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface ColumnLayout {
  readonly id: string;
  readonly taskIds: readonly string[];
}

export interface TaskMove extends Placement {
  readonly toColumnId: string;
}

/**
 * Keyboard move of a card (⌥/Alt + arrows): up/down swaps with the neighbour, left/right goes to
 * the adjacent column at the same position (or its end). `null` when the card cannot go further.
 */
export function keyboardTaskMove(
  columns: readonly ColumnLayout[],
  taskId: string,
  direction: MoveDirection,
): TaskMove | null {
  const from = columns.findIndex((c) => c.taskIds.includes(taskId));
  const column = columns[from];
  if (!column) return null;
  const index = column.taskIds.indexOf(taskId);

  if (direction === 'up' || direction === 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= column.taskIds.length) return null;
    return { toColumnId: column.id, ...placeAt(column.taskIds, taskId, target) };
  }
  const to = columns[direction === 'left' ? from - 1 : from + 1];
  if (!to) return null;
  return { toColumnId: to.id, ...placeAt(to.taskIds, taskId, index) };
}

/** Keyboard move of a column (⌥/Alt + left/right). `null` at either end. */
export function keyboardColumnMove(
  columnIds: readonly string[],
  columnId: string,
  direction: 'left' | 'right',
): Placement | null {
  const index = columnIds.indexOf(columnId);
  const target = direction === 'left' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= columnIds.length) return null;
  return placeAt(columnIds, columnId, target);
}
