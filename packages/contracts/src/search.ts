import {
  COLUMN_CATEGORIES,
  COLUMN_COLORS,
  DUE_FILTERS,
  SEARCH_TEXT_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
} from '@ordo/domain';
import { z } from 'zod';
import { CalendarDay, Id, Priority } from './schemas';

/** Free text typed in the filter bar or the palette (filter words already taken out). */
const SearchText = z.string().trim().min(1).max(SEARCH_TEXT_MAX_LENGTH);

/**
 * Full-text search on one board's cards (top-level tasks, not deleted): title, notes and tag names,
 * every word as a prefix, accents ignored. Used by the board filters; no limit.
 */
export const BoardTaskIdsInput = z.object({ boardId: Id, text: SearchText }).strict();
export const BoardTaskIdsOutput = z.object({ taskIds: z.array(Id) });

export const SEARCH_LIMIT_MAX = 50;

/**
 * Full-text search across the non-archived boards, cards and sub-tasks, best matches first. The
 * palette's typed filters apply before the limit: priorities, due options (OR, against `today`, the
 * renderer's calendar day) and tag names (case and accents ignored, any of them).
 */
export const SearchTasksInput = z
  .object({
    text: SearchText,
    limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
    priorities: z.array(Priority).max(5).optional(),
    due: z.array(z.enum(DUE_FILTERS)).max(DUE_FILTERS.length).optional(),
    tagNames: z.array(z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH)).max(20).optional(),
    today: CalendarDay.optional(),
  })
  .strict()
  .refine((input) => !input.due?.length || input.today !== undefined, {
    message: 'Give today with due filters',
  });

/** A task found by the palette (or recently opened), with where it lives. */
export const SearchHit = z.object({
  id: Id,
  title: z.string(),
  /** Set for a sub-task, with its parent's title ("Parent › Sous-tâche"). */
  parentId: Id.nullable(),
  parentTitle: z.string().nullable(),
  boardId: Id,
  boardName: z.string(),
  boardIcon: z.string().nullable(),
  boardColor: z.enum(COLUMN_COLORS).nullable(),
  columnId: Id,
  columnName: z.string(),
  columnIcon: z.string().nullable(),
  columnColor: z.enum(COLUMN_COLORS),
  columnCategory: z.enum(COLUMN_CATEGORIES),
  priority: Priority,
  dueDate: CalendarDay.nullable(),
  completedAt: z.number().int().nullable(),
  /** Names of the task's tags (typed `#tag` filters match them by name on other boards). */
  tagNames: z.array(z.string()),
});

/** Record that a task was opened (detail window), for the palette's "Récemment ouvertes". */
export const RecordRecentInput = z.object({ taskId: Id }).strict();

export type SearchHit = z.infer<typeof SearchHit>;
