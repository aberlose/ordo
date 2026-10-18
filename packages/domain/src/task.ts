import type { ColumnCategory } from './column';
import type { CalendarDay } from './dates';
import type { Priority } from './priority';
import type { Rank } from './rank';

export interface TaskRef {
  readonly id: string;
  readonly parentId: string | null;
}

export interface Task extends TaskRef {
  readonly boardId: string;
  readonly columnId: string;
  readonly key: number;
  readonly title: string;
  readonly priority: Priority;
  readonly startDate: CalendarDay | null;
  readonly dueDate: CalendarDay | null;
  readonly rank: Rank;
}

export const TITLE_MAX_LENGTH = 500;

/** Sub-tasks have one level only: a sub-task cannot have sub-tasks. */
export function canBeParent(task: TaskRef): boolean {
  return task.parentId === null;
}

export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX_LENGTH);
}

export interface SubTaskProgress {
  readonly done: number;
  readonly total: number;
}

export function subTaskProgress(subTasksDone: readonly boolean[]): SubTaskProgress {
  return { done: subTasksDone.filter(Boolean).length, total: subTasksDone.length };
}

/** Keys are numbered per board from 1 and never reused. */
export function nextTaskKey(maxKey: number | null): number {
  return (maxKey ?? 0) + 1;
}

/**
 * `completed_at` follows the column category: set when a task enters a "done"
 * column, kept while it stays in one, cleared when it leaves.
 */
export function completionAfterMove(
  completedAt: number | null,
  targetIsDone: boolean,
  now: number,
): number | null {
  if (!targetIsDone) return null;
  return completedAt ?? now;
}

export interface ColumnRef {
  readonly id: string;
  readonly category: ColumnCategory;
}

/**
 * Column of a new sub-task: the board's first To-do column, else its first column.
 * `columns` are the live columns in board order.
 */
export function columnForNewSubtask(columns: readonly ColumnRef[]): string | null {
  return (columns.find((c) => c.category === 'todo') ?? columns[0])?.id ?? null;
}

/**
 * Column after checking (`done`) or unchecking a sub-task's box: the first Done column, or the first
 * To-do column (else the first column that is not Done). `null` when there is none: nothing moves.
 */
export function columnForSubtaskCheck(columns: readonly ColumnRef[], done: boolean): string | null {
  const target = done
    ? columns.find((c) => c.category === 'done')
    : (columns.find((c) => c.category === 'todo') ?? columns.find((c) => c.category !== 'done'));
  return target?.id ?? null;
}
