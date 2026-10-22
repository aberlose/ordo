/**
 * The list of IPC channel names, without Zod, so the preload bundle stays tiny.
 * Must match the keys of `contract` in ./contract.ts (checked by a test).
 */
export const CHANNELS = [
  'app.info',
  'boards.list',
  'boards.get',
  'boards.create',
  'boards.update',
  'boards.move',
  'boards.duplicate',
  'boards.archive',
  'boards.restore',
  'boards.listArchived',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  'tasks.move',
  'tasks.get',
  'tasks.listSubtasks',
  'tasks.addTag',
  'tasks.removeTag',
  'tasks.getDescription',
  'tasks.updateDescription',
  'attachments.list',
  'attachments.add',
  'attachments.pick',
  'attachments.addData',
  'attachments.open',
  'attachments.reveal',
  'attachments.delete',
  'search.boardTaskIds',
  'search.tasks',
  'recent.list',
  'recent.record',
  'tags.create',
  'tags.update',
  'tags.delete',
  'columns.move',
  'columns.create',
  'columns.update',
  'columns.delete',
] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}
