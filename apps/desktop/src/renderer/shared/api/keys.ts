/** TanStack Query keys shared by features (a feature cannot import another feature's internals). */
export const boardKeys = {
  all: ['boards'] as const,
  detail: (id: string) => ['boards', id] as const,
  /**
   * Archived boards. Under `all` (`['boards']`), so a non-exact invalidation of the boards (create,
   * archive, …) refreshes this list too, while `{ exact: true }` refreshes the sidebar list only.
   */
  archived: ['boards', 'archived'] as const,
};

/** A single task (`tasks.get`, the window of a sub-task, which is not in the board query) and a parent's sub-tasks. */
export const taskKeys = {
  /** Every single-task query (windows of sub-tasks). */
  details: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
  /** Every parent's sub-task list. */
  allSubtasks: ['subtasks'] as const,
  /** Not under `detail(parentId)`: invalidating the parent's own task leaves its list alone. */
  subtasks: (parentId: string) => ['subtasks', parentId] as const,
};
