import {
  COLUMN_CATEGORIES,
  COLUMN_COLORS,
  COLUMN_ICON_NAMES,
  COLUMN_NAME_MAX_LENGTH,
  DISPLAY_LIMIT_MAX,
  DISPLAY_LIMIT_MIN,
} from '@ordo/domain';
import { z } from 'zod';
import { Id } from './schemas';

/** Reorder a column between its new neighbours (one row written). */
export const MoveColumnInput = z
  .object({
    columnId: Id,
    beforeId: Id.nullable(),
    afterId: Id.nullable(),
  })
  .strict();

const ColumnName = z.string().trim().min(1).max(COLUMN_NAME_MAX_LENGTH);
/** A Lucide icon name from the app's catalogue (kebab-case). */
const ColumnIconName = z.enum(COLUMN_ICON_NAMES);
const DisplayLimit = z.number().int().min(DISPLAY_LIMIT_MIN).max(DISPLAY_LIMIT_MAX).nullable();

/** A column added from the board; it goes to the right end. */
export const CreateColumnInput = z
  .object({
    boardId: Id,
    name: ColumnName,
    icon: ColumnIconName,
    color: z.enum(COLUMN_COLORS),
    category: z.enum(COLUMN_CATEGORIES),
    displayLimit: DisplayLimit,
  })
  .strict();

/** Partial update of the column settings. Changing the category updates its tasks' completion. */
export const UpdateColumnInput = z
  .object({
    id: Id,
    name: ColumnName.optional(),
    icon: ColumnIconName.optional(),
    color: z.enum(COLUMN_COLORS).optional(),
    category: z.enum(COLUMN_CATEGORIES).optional(),
    displayLimit: DisplayLimit.optional(),
  })
  .strict()
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== 'id' && value !== undefined),
    'Nothing to update',
  );

/** The column and its tasks go to the trash together. The last column of a board cannot be deleted. */
export const DeleteColumnInput = z.object({ id: Id }).strict();
export const DeleteColumnOutput = z.object({ id: Id, deletedTasks: z.number().int().nonnegative() });

export type MoveColumnInput = z.infer<typeof MoveColumnInput>;
export type CreateColumnInput = z.infer<typeof CreateColumnInput>;
export type UpdateColumnInput = z.infer<typeof UpdateColumnInput>;
export type DeleteColumnOutput = z.infer<typeof DeleteColumnOutput>;
