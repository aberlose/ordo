import type { Task } from '@ordo/contracts';
import {
  DUE_FILTERS,
  hasActiveFilters,
  matchesDue,
  matchesFilters,
  type CalendarDay,
  type DueFilter,
  type FilterableTask,
  type Priority,
  type TaskFilters,
} from '@ordo/domain';

/** What the filters look at on a card. */
export const filterable = (task: Task): FilterableTask & { id: string } => ({
  id: task.id,
  priority: task.priority,
  dueDate: task.dueDate,
  completed: task.completedAt !== null,
  tags: task.tagIds,
});

/**
 * The filters without the tags the board no longer has (a deleted tag must not hide every card nor
 * stay shown as active). Returns the same object when nothing is dropped.
 */
export function effectiveFilters(filters: TaskFilters, boardTagIds: ReadonlySet<string>): TaskFilters {
  if (filters.tags.every((id) => boardTagIds.has(id))) return filters;
  return { ...filters, tags: filters.tags.filter((id) => boardTagIds.has(id)) };
}

/**
 * The cards passing the filters, in their order. `textMatches` is what the full-text index returned for
 * the filters' text (`null`: no text, or not known yet). The same array when no filter is active.
 */
export function filterTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
  today: CalendarDay,
  textMatches: ReadonlySet<string> | null,
): readonly Task[] {
  if (!hasActiveFilters(filters)) return tasks;
  const text = filters.text.trim() === '' ? null : textMatches;
  return tasks.filter((task) => matchesFilters(filterable(task), filters, today, text));
}

/** Per-option counts of the filter menus, over every card of the board (approved board mockup). */
export interface OptionCounts {
  priorities: ReadonlyMap<Priority, number>;
  tags: ReadonlyMap<string, number>;
  due: ReadonlyMap<DueFilter, number>;
}

const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);

export function optionCounts(tasks: readonly Task[], today: CalendarDay): OptionCounts {
  const priorities = new Map<Priority, number>();
  const tags = new Map<string, number>();
  const due = new Map<DueFilter, number>();
  for (const task of tasks) {
    bump(priorities, task.priority);
    for (const id of task.tagIds) bump(tags, id);
    const item = filterable(task);
    for (const kind of DUE_FILTERS) {
      if (matchesDue(item, kind, today)) bump(due, kind);
    }
  }
  return { priorities, tags, due };
}
