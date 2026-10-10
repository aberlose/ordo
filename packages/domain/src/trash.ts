export const TRASH_RETENTION_DAYS = 30;

/** `deletedAt` and `now` are Unix epoch milliseconds. */
export function isPurgeable(deletedAt: number, now: number, retentionDays = TRASH_RETENTION_DAYS): boolean {
  return now - deletedAt >= retentionDays * 86_400_000;
}
