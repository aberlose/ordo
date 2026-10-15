import { BOARD_NAME_MAX_LENGTH, COLUMN_CATEGORIES, COLUMN_COLORS, COLUMN_ICON_NAMES } from '@ordo/domain';
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

const Name = z.string().trim().min(1).max(BOARD_NAME_MAX_LENGTH);
/** A Lucide icon name from the app's catalogue (same catalogue as columns). */
const BoardIcon = z.enum(COLUMN_ICON_NAMES);
const BoardColor = z.enum(COLUMN_COLORS);

/**
 * A board with the three default columns, at the end of the sidebar. Without an icon or colour,
 * the main process applies `newBoardDefaults` (board icon, first colour not used yet).
 */
export const CreateBoardInput = z
  .object({
    name: Name,
    /** Localised names of the three default columns, in order (to do, in progress, done). */
    columnNames: z.tuple([Name, Name, Name]),
    icon: BoardIcon.optional(),
    color: BoardColor.optional(),
  })
  .strict();

/** Rename, or change the icon and colour. */
export const UpdateBoardInput = z
  .object({
    id: Id,
    name: Name.optional(),
    icon: BoardIcon.optional(),
    color: BoardColor.optional(),
  })
  .strict()
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== 'id' && value !== undefined),
    'Nothing to update',
  );

/** Reorder a board in the sidebar between its new neighbours (one row written). */
export const MoveBoardInput = z
  .object({
    boardId: Id,
    beforeId: Id.nullable(),
    afterId: Id.nullable(),
  })
  .strict();

/**
 * Copy a board right after the original: name, icon, colour, columns and their settings always;
 * the live tasks (with their sub-tasks) only with `includeTasks`.
 */
export const DuplicateBoardInput = z
  .object({
    id: Id,
    name: Name,
    includeTasks: z.boolean(),
  })
  .strict();

/** Archiving is reversible and needs no confirmation; the board leaves the sidebar and search. */
export const ArchiveBoardInput = z.object({ id: Id }).strict();
export const ArchiveBoardOutput = z.object({ id: Id, archivedAt: z.number().int() });

/** A restored board goes back to the end of the sidebar. */
export const RestoreBoardInput = z.object({ id: Id }).strict();

/** An archived board, newest archive first in `boards.listArchived`. */
export const ArchivedBoard = BoardSummary.extend({ archivedAt: z.number().int() });

export type BoardSummary = z.infer<typeof BoardSummary>;
export type Column = z.infer<typeof Column>;
export type BoardDetail = z.infer<typeof BoardDetail>;
export type CreateBoardInput = z.infer<typeof CreateBoardInput>;
export type UpdateBoardInput = z.infer<typeof UpdateBoardInput>;
export type MoveBoardInput = z.infer<typeof MoveBoardInput>;
export type DuplicateBoardInput = z.infer<typeof DuplicateBoardInput>;
export type ArchiveBoardOutput = z.infer<typeof ArchiveBoardOutput>;
export type ArchivedBoard = z.infer<typeof ArchivedBoard>;
