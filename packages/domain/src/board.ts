import { COLUMN_COLORS, type ColumnColor, type ColumnIconName } from './column';
import { placeAt, type Placement } from './move';

export const BOARD_NAME_MAX_LENGTH = 120;

export function normalizeBoardName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, BOARD_NAME_MAX_LENGTH);
}

/**
 * Icon and colour of a new board when none is picked (first launch, or the board popover's
 * initial values): the board icon and the first colour no live board uses yet.
 */
export function newBoardDefaults(usedColors: readonly (ColumnColor | null)[]): {
  icon: ColumnIconName;
  color: ColumnColor;
} {
  const color = COLUMN_COLORS.find((c) => !usedColors.includes(c)) ?? 'slate';
  return { icon: 'kanban', color };
}

/** Keyboard reorder of a board in the sidebar (⌥/Alt + ↑↓). `null` at either end. */
export function keyboardBoardMove(
  boardIds: readonly string[],
  boardId: string,
  direction: 'up' | 'down',
): Placement | null {
  const index = boardIds.indexOf(boardId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= boardIds.length) return null;
  return placeAt(boardIds, boardId, target);
}

/**
 * The board to open once `boardId` leaves the sidebar (archived): the next one, else the previous
 * one, else none.
 */
export function boardAfterRemoval(boardIds: readonly string[], boardId: string): string | null {
  const index = boardIds.indexOf(boardId);
  if (index === -1) return null;
  return boardIds[index + 1] ?? boardIds[index - 1] ?? null;
}
