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
