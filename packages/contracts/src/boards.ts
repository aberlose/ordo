import { COLUMN_CATEGORIES, COLUMN_COLORS } from '@ordo/domain';
import { z } from 'zod';
import { Id } from './schemas';
import { Task } from './tasks';

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
  /** Top-level tasks, ordered by rank within each column. */
  tasks: z.array(Task),
});

const Name = z.string().trim().min(1).max(120);

export const CreateBoardInput = z.object({
  name: Name,
  /** Localised names of the three default columns, in order (to do, in progress, done). */
  columnNames: z.tuple([Name, Name, Name]),
});

export type BoardSummary = z.infer<typeof BoardSummary>;
export type Column = z.infer<typeof Column>;
export type BoardDetail = z.infer<typeof BoardDetail>;
export type CreateBoardInput = z.infer<typeof CreateBoardInput>;
