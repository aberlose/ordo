import type { BoardDetail, SearchHit, Task } from '@ordo/contracts';
import {
  foldTagName,
  foldText,
  matchesFilters,
  type CalendarDay,
  type ColumnColor,
  type DueFilter,
  type Priority,
  type TaskFilters,
} from '@ordo/domain';
import type { TFunction } from 'i18next';

/** At most this many rows per task group (approved mockup search-palette A). */
export const GROUP_MAX_ROWS = 6;

/** A task row of the palette: a card of the board shown, or a search hit (card or sub-task). */
export interface PaletteTask {
  id: string;
  title: string;
  /** Set for a sub-task: shown "Parent › Sous-tâche". */
  parentTitle: string | null;
  priority: Priority;
  boardId: string;
  boardName: string;
  boardColor: ColumnColor | null;
  columnName: string;
  columnIcon: string | null;
  columnColor: ColumnColor;
}

export function fromHit(hit: SearchHit): PaletteTask {
  return {
    id: hit.id,
    title: hit.title,
    parentTitle: hit.parentId ? hit.parentTitle : null,
    priority: hit.priority,
    boardId: hit.boardId,
    boardName: hit.boardName,
    boardColor: hit.boardColor,
    columnName: hit.columnName,
    columnIcon: hit.columnIcon,
    columnColor: hit.columnColor,
  };
}

export function fromCard(task: Task, board: BoardDetail): PaletteTask {
  const column = board.columns.find((c) => c.id === task.columnId);
  return {
    id: task.id,
    title: task.title,
    parentTitle: null,
    priority: task.priority,
    boardId: board.id,
    boardName: board.name,
    boardColor: board.color,
    columnName: column?.name ?? '',
    columnIcon: column?.icon ?? null,
    columnColor: column?.color ?? 'slate',
  };
}

/**
 * Whether a search hit passes the typed priority, tag and due filters. Tags are compared by folded
 * name (`tagKeys`), so `#front` matches the "Front" tag of any board; the free text already matched.
 */
export function hitMatches(
  hit: SearchHit,
  filters: TaskFilters,
  tagKeys: readonly string[],
  today: CalendarDay,
): boolean {
  return matchesFilters(
    {
      id: hit.id,
      priority: hit.priority,
      dueDate: hit.dueDate,
      completed: hit.completedAt !== null,
      tags: hit.tagNames.map(foldTagName),
    },
    { ...filters, tags: tagKeys },
    today,
  );
}

/** Label of the typed priorities as the approved board mockup shows it ("Priorité ≥ Haute"…). */
export function priorityChip(priorities: readonly Priority[], t: TFunction): string | null {
  if (priorities.length === 0) return null;
  const label = (p: Priority) => t(`priority.${p}`);
  const sorted = [...priorities].sort((a, b) => b - a);
  const key = sorted.join(',');
  if (sorted.length === 1) return t('palette.chips.priority', { label: label(sorted[0]!) });
  if (key === '5,4') return t('palette.chips.priorityAtLeast', { label: label(4) });
  if (key === '2,1') return t('palette.chips.priorityAtMost', { label: label(2) });
  return t('palette.chips.priority', { label: sorted.map(label).join(', ') });
}

export const dueChip = (due: DueFilter, t: TFunction): string => t(`palette.due.${due}`);

/** Folded words of the free text, for highlighting ("head" bolds the start of "header"). */
export function highlightWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => foldText(word).replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
}

export interface TitlePart {
  text: string;
  match: boolean;
}

/** The title split into plain and matched parts: each word starting with a typed word has that start bold. */
export function highlight(title: string, words: readonly string[]): TitlePart[] {
  if (words.length === 0) return [{ text: title, match: false }];
  const parts: TitlePart[] = [];
  let last = 0;
  for (const found of title.matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = found[0];
    const folded = foldText(token);
    const length = Math.min(
      token.length,
      words.reduce((best, word) => (folded.startsWith(word) ? Math.max(best, word.length) : best), 0),
    );
    if (length === 0) continue;
    const start = found.index;
    if (start > last) parts.push({ text: title.slice(last, start), match: false });
    parts.push({ text: title.slice(start, start + length), match: true });
    last = start + length;
  }
  if (last < title.length) parts.push({ text: title.slice(last), match: false });
  return parts;
}

/** The word being typed at the end of the query (empty after a space). */
export const lastWord = (query: string): string => query.split(/\s+/).pop() ?? '';

/** Board tags completing an unknown `#prefix` being typed at the end of the query. */
export function tagSuggestions<T extends { name: string }>(query: string, tags: readonly T[]): T[] {
  const last = lastWord(query);
  if (!last.startsWith('#')) return [];
  const prefix = foldTagName(last.slice(1));
  if (tags.some((tag) => foldTagName(tag.name) === prefix)) return [];
  return tags.filter((tag) => foldTagName(tag.name).startsWith(prefix)).slice(0, GROUP_MAX_ROWS);
}

/** The query with its last word replaced by `#name `. */
export function completeTag(query: string, name: string): string {
  return `${query.slice(0, query.length - lastWord(query).length)}#${name} `;
}
