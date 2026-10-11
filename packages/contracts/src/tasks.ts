import { TITLE_MAX_LENGTH } from '@ordo/domain';
import { z } from 'zod';
import { CalendarDay, Id, Priority } from './schemas';

/** A top-level task as shown on the board and in the detail window (sub-tasks come with their own lot). */
export const Task = z.object({
  id: Id,
  columnId: Id,
  key: z.number().int().positive(),
  title: z.string(),
  priority: Priority,
  startDate: CalendarDay.nullable(),
  dueDate: CalendarDay.nullable(),
  rank: z.string(),
  completedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const Title = z.string().trim().min(1).max(TITLE_MAX_LENGTH);

export const CreateTaskInput = z
  .object({
    columnId: Id,
    title: Title,
  })
  .strict();

/** Partial update: only the given fields change. `null` clears a date. Moving to another column appends the task at its end. */
export const UpdateTaskInput = z
  .object({
    id: Id,
    title: Title.optional(),
    columnId: Id.optional(),
    priority: Priority.optional(),
    startDate: CalendarDay.nullable().optional(),
    dueDate: CalendarDay.nullable().optional(),
  })
  .strict()
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== 'id' && value !== undefined),
    'Nothing to update',
  );

export const DeleteTaskInput = z.object({ id: Id }).strict();

export type Task = z.infer<typeof Task>;
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

/** Drag and drop or ⌥/Alt + arrows: the server ranks the task between its new neighbours (one row written). */
export const MoveTaskInput = z
  .object({
    taskId: Id,
    toColumnId: Id,
    beforeId: Id.nullable(),
    afterId: Id.nullable(),
  })
  .strict();

export type MoveTaskInput = z.infer<typeof MoveTaskInput>;
