import { DESCRIPTION_MAX_JSON_LENGTH, TITLE_MAX_LENGTH } from '@ordo/domain';
import { z } from 'zod';
import { CalendarDay, Id, Priority } from './schemas';

/** Progress of a task's live sub-tasks: `done` counts those in a Done column. Zeros for a sub-task. */
export const SubtaskProgress = z.object({
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * A task or a sub-task, as shown on the board and in the detail window. Its status is its column;
 * a sub-task (`parentId` set) is not shown on the board and its `rank` orders it among its siblings.
 */
export const Task = z.object({
  id: Id,
  columnId: Id,
  parentId: Id.nullable(),
  key: z.number().int().positive(),
  title: z.string(),
  priority: Priority,
  startDate: CalendarDay.nullable(),
  dueDate: CalendarDay.nullable(),
  rank: z.string(),
  completedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  /** Board tags on the task, alphabetical. */
  tagIds: z.array(Id),
  subtasks: SubtaskProgress,
  /** Files attached to the task (shown on the card). */
  attachmentCount: z.number().int().nonnegative(),
});

const Title = z.string().trim().min(1).max(TITLE_MAX_LENGTH);

/**
 * A task at the end of `columnId`, or a sub-task at the end of `parentId`'s list, in the board's first
 * To-do column (`columnForNewSubtask`). Exactly one of the two is given; a sub-task cannot be a parent.
 */
export const CreateTaskInput = z
  .object({
    columnId: Id.optional(),
    parentId: Id.optional(),
    title: Title,
  })
  .strict()
  .refine((input) => (input.columnId === undefined) !== (input.parentId === undefined), {
    message: 'Give either columnId or parentId',
  });

/**
 * Partial update: only the given fields change. `null` clears a date. Moving a task to another column
 * appends it at its end; a sub-task keeps its rank (its place in the parent's list).
 */
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

/** Soft delete; a parent's live sub-tasks go to the trash with it. */
export const DeleteTaskInput = z.object({ id: Id }).strict();

export const GetTaskInput = z.object({ id: Id }).strict();

/**
 * The notes: the editor's document as ProseMirror JSON (a `doc` node), `null` for no notes. Bounded so a
 * runaway paste cannot fill the database; images are attachments, never inlined.
 */
export const Description = z
  .looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .refine((doc) => JSON.stringify(doc).length <= DESCRIPTION_MAX_JSON_LENGTH, 'Notes too long');
export const DescriptionOutput = z.object({
  id: Id,
  json: Description.nullable(),
  updatedAt: z.number().int(),
});
/** Autosave of the notes; the plain text for search is derived in the main process. */
export const UpdateDescriptionInput = z.object({ id: Id, json: Description.nullable() }).strict();
/** A task's live sub-tasks, in their list order. */
export const ListSubtasksInput = z.object({ parentId: Id }).strict();

export type Task = z.infer<typeof Task>;
export type SubtaskProgress = z.infer<typeof SubtaskProgress>;
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
