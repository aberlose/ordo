/** TanStack Query keys shared by features (a feature cannot import another feature's internals). */
export const boardKeys = {
  all: ['boards'] as const,
  detail: (id: string) => ['boards', id] as const,
};
