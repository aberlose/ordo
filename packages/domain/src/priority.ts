export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Medium, the default for a new task. */
export const DEFAULT_PRIORITY: Priority = 3;

export function isPriority(value: number): value is Priority {
  return (PRIORITIES as readonly number[]).includes(value);
}
