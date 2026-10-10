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
