import { COLUMN_COLORS, TAG_NAME_MAX_LENGTH } from '@ordo/domain';
import { z } from 'zod';
import { Id } from './schemas';

/** A tag of a board (unique name per board, case and accents ignored), with its live task count. */
export const Tag = z.object({
  id: Id,
  name: z.string(),
  color: z.enum(COLUMN_COLORS),
  /** Live tasks and sub-tasks carrying the tag. */
  taskCount: z.number().int().nonnegative(),
});

/** Normalised (spaces collapsed) before the bounds are checked, so the length is the stored one. */
const TagName = z
  .string()
  .transform((name) => name.replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(TAG_NAME_MAX_LENGTH));

/**
 * Create a tag on a board, and put it on `taskId` in the same transaction (picker "Créer « … »").
 * Without a colour, the main process applies `newTagColor`. A name already used on the board is a conflict.
 */
export const CreateTagInput = z
  .object({
    boardId: Id,
    name: TagName,
    color: z.enum(COLUMN_COLORS).optional(),
    taskId: Id.optional(),
  })
  .strict();

/** Rename or recolour a tag: applies to every task of the board. */
export const UpdateTagInput = z
  .object({
    id: Id,
    name: TagName.optional(),
    color: z.enum(COLUMN_COLORS).optional(),
  })
  .strict()
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== 'id' && value !== undefined),
    'Nothing to update',
  );

/** Deleting a tag is permanent: the tag and its links go (after a confirmation in the picker). */
export const DeleteTagInput = z.object({ id: Id }).strict();
export const DeleteTagOutput = z.object({
  id: Id,
  /** Live tasks and sub-tasks the tag was removed from. */
  removedFrom: z.number().int().nonnegative(),
});

/** Put a board tag on a task, or take it off (idempotent). */
export const TaskTagInput = z.object({ taskId: Id, tagId: Id }).strict();

export type Tag = z.infer<typeof Tag>;
export type CreateTagInput = z.infer<typeof CreateTagInput>;
export type UpdateTagInput = z.infer<typeof UpdateTagInput>;
export type DeleteTagOutput = z.infer<typeof DeleteTagOutput>;
export type TaskTagInput = z.infer<typeof TaskTagInput>;
