/**
 * The list of IPC channel names, without Zod, so the preload bundle stays tiny.
 * Must match the keys of `contract` in ./contract.ts (checked by a test).
 */
export const CHANNELS = [
  'app.info',
  'boards.list',
  'boards.get',
  'boards.create',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  'tasks.move',
  'columns.move',
  'columns.create',
  'columns.update',
  'columns.delete',
] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}
