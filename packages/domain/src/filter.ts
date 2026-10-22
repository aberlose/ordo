/**
 * Board filters and the palette's typed filters (approved mockups: board filter bar, palette
 * "Filtres reconnus"). Priority, tag and due filters are pure predicates; free text is matched by the
 * full-text index in the main process and comes back as a set of task ids.
 */
import { addDays, type CalendarDay, weekday } from './dates';
import type { Priority } from './priority';
import { foldTagName } from './tag';

/** Due-date filters: overdue (as the red date on a card), due this week (Monday–Sunday), no due date. */
export const DUE_FILTERS = ['overdue', 'thisWeek', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/**
 * Active filters of a board. Within a kind, values combine with OR; kinds combine with AND.
 * `tags` holds tag keys: tag ids on a board, folded tag names across boards.
 */
export interface TaskFilters {
  readonly priorities: readonly Priority[];
  readonly tags: readonly string[];
  readonly due: readonly DueFilter[];
  readonly text: string;
}

export const EMPTY_FILTERS: TaskFilters = { priorities: [], tags: [], due: [], text: '' };

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.due.length > 0 ||
    filters.text.trim() !== ''
  );
}

/** What a filter looks at on a task. */
export interface FilterableTask {
  readonly priority: Priority;
  readonly dueDate: CalendarDay | null;
  /** Completed tasks (in a Done column) are never overdue. */
  readonly completed: boolean;
  /** Tag keys, the same kind as `TaskFilters.tags`. */
  readonly tags: readonly string[];
}

/** Monday of the week of `day`. */
export function startOfWeek(day: CalendarDay): CalendarDay {
  return addDays(day, 1 - weekday(day));
}

export function matchesDue(task: FilterableTask, due: DueFilter, today: CalendarDay): boolean {
  switch (due) {
    case 'overdue':
      return !task.completed && task.dueDate !== null && task.dueDate < today;
    case 'thisWeek': {
      if (task.dueDate === null) return false;
      const monday = startOfWeek(today);
      return task.dueDate >= monday && task.dueDate <= addDays(monday, 6);
    }
    case 'none':
      return task.dueDate === null;
  }
}

/**
 * Whether a task passes the priority, tag and due filters. Free text is not checked here:
 * `textMatches` is the set of ids the full-text index returned, or `null` when no text is typed.
 */
export function matchesFilters(
  task: FilterableTask & { readonly id: string },
  filters: TaskFilters,
  today: CalendarDay,
  textMatches: ReadonlySet<string> | null = null,
): boolean {
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
  if (filters.tags.length > 0 && !task.tags.some((tag) => filters.tags.includes(tag))) return false;
  if (filters.due.length > 0 && !filters.due.some((due) => matchesDue(task, due, today))) return false;
  if (textMatches !== null && !textMatches.has(task.id)) return false;
  return true;
}

// ------------------------------------------------------------------ typed filters

/** Typed priority words (French and English are always both understood), folded. */
const PRIORITY_WORDS: ReadonlyArray<readonly [string, readonly Priority[]]> = [
  ['tres haute', [5]],
  ['very high', [5]],
  ['highest', [5]],
  ['tres basse', [1]],
  ['very low', [1]],
  ['lowest', [1]],
  ['haute', [4, 5]],
  ['high', [4, 5]],
  ['moyenne', [3]],
  ['medium', [3]],
  ['basse', [1, 2]],
  ['low', [1, 2]],
];

const DUE_WORDS: ReadonlyArray<readonly [string, DueFilter]> = [
  ['en retard', 'overdue'],
  ['retard', 'overdue'],
  ['overdue', 'overdue'],
  ['late', 'overdue'],
  ['cette semaine', 'thisWeek'],
  ['semaine', 'thisWeek'],
  ['this week', 'thisWeek'],
  ['week', 'thisWeek'],
  ['sans date', 'none'],
  ['no date', 'none'],
];

/** Lower case, accents removed: how typed words are compared. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** A typed query split into recognised filters and free text. */
export interface ParsedQuery {
  readonly priorities: readonly Priority[];
  /** `#name` tokens, as typed (without `#`), in order, without duplicates (folded). */
  readonly tagNames: readonly string[];
  readonly due: readonly DueFilter[];
  /** Words left over, in their original spelling, joined by single spaces. */
  readonly text: string;
}

function union<T>(into: T[], values: readonly T[]): void {
  for (const value of values) if (!into.includes(value)) into.push(value);
}

/** A word of the query; quoted words are always free text. */
interface QueryWord {
  readonly word: string;
  readonly quoted: boolean;
}

/** Split a query into words; `"…"` keeps its words as text (an unclosed quote runs to the end). */
function queryWords(query: string): QueryWord[] {
  const out: QueryWord[] = [];
  query.split('"').forEach((part, index) => {
    const quoted = index % 2 === 1;
    for (const word of part.split(/\s+/)) if (word !== '') out.push({ word, quoted });
  });
  return out;
}

/**
 * Parse the palette's query: `#tag`, priority words (`haute`, `très basse`, `high`…), due words
 * (`retard`, `semaine`, `sans date`…), the rest is free text. Two-word keywords win over one-word
 * ones. Several priority words add up (`haute basse` = everything but medium). Words in double
 * quotes are always text (`"semaine" de 4 jours`).
 */
export function parseFilterQuery(query: string): ParsedQuery {
  const words = queryWords(query);
  const folded = words.map(({ word }) => foldText(word));
  const priorities: Priority[] = [];
  const tagNames: string[] = [];
  const due: DueFilter[] = [];
  const text: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const { word, quoted } = words[i]!;
    if (quoted) {
      text.push(word);
      continue;
    }
    if (word.startsWith('#')) {
      const name = word.slice(1);
      if (name !== '' && !tagNames.some((t) => foldTagName(t) === foldTagName(name))) tagNames.push(name);
      continue;
    }
    const pair = i + 1 < words.length && !words[i + 1]!.quoted ? `${folded[i]} ${folded[i + 1]}` : null;
    const single = folded[i]!;
    const prio = PRIORITY_WORDS.find(([w]) => w === pair) ?? PRIORITY_WORDS.find(([w]) => w === single);
    if (prio) {
      union(priorities, prio[1]);
      if (prio[0] === pair) i++;
      continue;
    }
    const dueWord = DUE_WORDS.find(([w]) => w === pair) ?? DUE_WORDS.find(([w]) => w === single);
    if (dueWord) {
      union(due, [dueWord[1]]);
      if (dueWord[0] === pair) i++;
      continue;
    }
    text.push(word);
  }
  return { priorities: priorities.sort((a, b) => a - b), tagNames, due, text: text.join(' ') };
}

/**
 * Turn a parsed query into board filters: `#name` tokens become the ids of the board's tags with that
 * name (case and accents ignored); names no tag has are returned apart (still being typed).
 */
export function resolveQueryTags(
  parsed: ParsedQuery,
  tags: readonly { readonly id: string; readonly name: string }[],
): { filters: TaskFilters; unknownTags: string[] } {
  const ids: string[] = [];
  const unknownTags: string[] = [];
  for (const name of parsed.tagNames) {
    const tag = tags.find((t) => foldTagName(t.name) === foldTagName(name));
    if (tag) union(ids, [tag.id]);
    else unknownTags.push(name);
  }
  return {
    filters: { priorities: parsed.priorities, tags: ids, due: parsed.due, text: parsed.text },
    unknownTags,
  };
}

// ------------------------------------------------------------------ full-text query

/** Longest free text sent to the index. */
export const SEARCH_TEXT_MAX_LENGTH = 200;

/**
 * The FTS5 query for typed free text: every word must match, as a prefix ("head" finds "header"),
 * accents ignored by the index. Words are quoted, so FTS5 operators typed by the user are plain text.
 * `null` when there is nothing to search.
 */
export function toFtsQuery(text: string): string | null {
  const terms = text
    .slice(0, SEARCH_TEXT_MAX_LENGTH)
    .split(/[\s"]+/)
    // Punctuation-only words index to nothing: drop them rather than match everything or nothing.
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .map((word) => `"${word}"*`);
  return terms.length === 0 ? null : terms.join(' ');
}

// ------------------------------------------------------------------ recently opened

export const RECENT_TASKS_MAX = 5;

/** The recently opened list after opening `id`: most recent first, no duplicates, bounded. */
export function pushRecent(ids: readonly string[], id: string, max = RECENT_TASKS_MAX): string[] {
  return [id, ...ids.filter((other) => other !== id)].slice(0, max);
}
