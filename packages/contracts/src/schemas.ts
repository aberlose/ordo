import { COLUMN_CATEGORIES, COLUMN_COLORS } from '@ordo/domain';
import { z } from 'zod';

export const Id = z.string().uuid();

export const AppInfo = z.object({
  version: z.string(),
  platform: z.enum(['darwin', 'win32', 'linux']),
  dataPath: z.string(),
});

export const BoardSummary = z.object({
  id: Id,
  name: z.string(),
  icon: z.string().nullable(),
  color: z.enum(COLUMN_COLORS).nullable(),
  taskCount: z.number().int().nonnegative(),
});

export const Column = z.object({
  id: Id,
  name: z.string(),
  icon: z.string().nullable(),
  color: z.enum(COLUMN_COLORS),
  category: z.enum(COLUMN_CATEGORIES),
  displayLimit: z.number().int().positive().nullable(),
  rank: z.string(),
});

export const BoardDetail = BoardSummary.extend({
  columns: z.array(Column),
});

const Name = z.string().trim().min(1).max(120);

export const CreateBoardInput = z.object({
  name: Name,
  /** Localised names of the three default columns, in order (to do, in progress, done). */
  columnNames: z.tuple([Name, Name, Name]),
});

export const Empty = z.object({}).strict();

export type AppInfo = z.infer<typeof AppInfo>;
export type BoardSummary = z.infer<typeof BoardSummary>;
export type Column = z.infer<typeof Column>;
export type BoardDetail = z.infer<typeof BoardDetail>;
export type CreateBoardInput = z.infer<typeof CreateBoardInput>;
