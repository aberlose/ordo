import type { Input, SearchHit } from '@ordo/contracts';
import { pushRecent, RECENT_TASKS_MAX, toFtsQuery } from '@ordo/domain';
import { NotFoundError } from './errors';
import type {
  SearchHitRecord,
  SearchRepository,
  SettingRepository,
  TaskRepository,
  Transactor,
} from './ports';

export interface SearchUseCasesDeps {
  readonly search: SearchRepository;
  readonly settings: SettingRepository;
  readonly tasks: TaskRepository;
  readonly tx: Transactor;
}

/** Palette results when no limit is asked. */
export const DEFAULT_SEARCH_LIMIT = 50;

/** Setting holding the recently opened task ids (JSON array, most recent first). */
export const RECENT_TASKS_SETTING = 'recentTasks';

function toSearchHit(hit: SearchHitRecord): SearchHit {
  return { ...hit, tagNames: [...hit.tagNames] };
}

export function makeSearchUseCases({ search, settings, tasks, tx }: SearchUseCasesDeps) {
  /** The stored list; a missing or corrupt value reads as empty. */
  const readRecent = (): string[] => {
    const raw = settings.get(RECENT_TASKS_SETTING);
    if (raw === null) return [];
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string').slice(0, RECENT_TASKS_MAX)
        : [];
    } catch {
      return [];
    }
  };

  return {
    /** Ids of the board's cards matching the free text (board filters). */
    searchBoardTaskIds: (input: Input<'search.boardTaskIds'>): { taskIds: string[] } => {
      const query = toFtsQuery(input.text);
      return { taskIds: query === null ? [] : search.boardTaskIds(input.boardId, query) };
    },

    /** Cards and sub-tasks of the non-archived boards matching the free text, best first. */
    searchTasks: (input: Input<'search.tasks'>): SearchHit[] => {
      const query = toFtsQuery(input.text);
      if (query === null) return [];
      return search.searchTasks(query, input.limit ?? DEFAULT_SEARCH_LIMIT).map(toSearchHit);
    },

    /** Recently opened tasks, most recent first; deleted tasks and archived boards are left out. */
    listRecent: (): SearchHit[] => search.hits(readRecent()).map(toSearchHit),

    /**
     * Puts a task at the head of the recently opened list. Entries no longer shown (deleted task,
     * archived board) are dropped so that they do not take one of the slots.
     */
    recordRecent: (taskId: string): Record<string, never> =>
      tx.run(() => {
        if (!tasks.findById(taskId)) throw new NotFoundError('task', taskId);
        const shown = search.hits(readRecent()).map((hit) => hit.id);
        settings.set(RECENT_TASKS_SETTING, JSON.stringify(pushRecent(shown, taskId)));
        return {};
      }),
  };
}

export type SearchUseCases = ReturnType<typeof makeSearchUseCases>;
