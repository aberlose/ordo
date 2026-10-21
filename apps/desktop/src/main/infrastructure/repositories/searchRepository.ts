import {
  addDays,
  type CalendarDay,
  type ColumnCategory,
  type ColumnColor,
  foldTagName,
  type Priority,
  startOfWeek,
} from '@ordo/domain';
import type { SearchHitRecord, SearchRepository, SearchTaskFilters } from '../../application/ports';
import type { Db } from '../db/client';
import { chunked } from './chunks';

/**
 * Full-text search over `task_fts` (migration 0003, kept in sync by triggers). Raw SQL: Drizzle has
 * no FTS5 support. Every value is a bound parameter; the MATCH string comes from `toFtsQuery`.
 */

/** User queries look at these columns only (`task_id` is indexed for the triggers' lookups). */
const searched = (ftsQuery: string) => `{title description_text tags} : (${ftsQuery})`;

/** bm25 weights per column: task_id (never searched), title, notes text, tags. Lower is better. */
const SCORE = 'bm25(task_fts, 0, 10, 1, 5)';

/** Ranked matches joined per wanted hit; the rest are hidden tasks (deleted, archived) skipped. */
const OVERFETCH = 4;

/** A task that is shown: live, on a live board, in a live column, and a sub-task only under a live parent. */
const SHOWN = `
  t.deleted_at IS NULL AND t.archived_at IS NULL
  AND b.deleted_at IS NULL AND b.archived_at IS NULL
  AND c.deleted_at IS NULL
  AND (t.parent_id IS NULL OR (p.id IS NOT NULL AND p.deleted_at IS NULL AND p.archived_at IS NULL))`;

const HIT_COLUMNS = `
  t.id AS id, t.title AS title, t.parent_id AS parentId, p.title AS parentTitle,
  b.id AS boardId, b.name AS boardName, b.icon AS boardIcon, b.color AS boardColor,
  c.id AS columnId, c.name AS columnName, c.icon AS columnIcon, c.color AS columnColor,
  c.category AS columnCategory, t.priority AS priority, t.due_date AS dueDate,
  t.completed_at AS completedAt`;

const HIT_JOINS = `
  JOIN board b ON b.id = t.board_id
  JOIN board_column c ON c.id = t.column_id
  LEFT JOIN task p ON p.id = t.parent_id`;

/** SQL conditions on `t` for the typed filters, with their bound parameters in order. */
interface FilterSql {
  readonly where: string;
  readonly params: readonly (string | number)[];
  /** Statement cache key: the shape of the conditions, not their values. */
  readonly shape: string;
}

/**
 * The typed filters as SQL. `tagIds` are the ids of the tags whose folded name is wanted (folding
 * is done in JS: SQLite has no accent folding), bound as one JSON array.
 */
function filterSql(filters: SearchTaskFilters, tagIds: readonly string[] | null): FilterSql {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  const shape: string[] = [];
  const priorities = filters.priorities ?? [];
  if (priorities.length > 0) {
    clauses.push(`t.priority IN (${priorities.map(() => '?').join(', ')})`);
    params.push(...priorities);
    shape.push(`p${priorities.length}`);
  }
  const due = filters.due;
  if (due && due.options.length > 0) {
    const options = [...new Set(due.options)].sort();
    const ors = options.map((option) => {
      switch (option) {
        case 'overdue':
          params.push(due.today);
          return '(t.due_date < ? AND t.completed_at IS NULL)';
        case 'thisWeek': {
          const monday = startOfWeek(due.today);
          params.push(monday, addDays(monday, 6));
          return '(t.due_date BETWEEN ? AND ?)';
        }
        case 'none':
          return 't.due_date IS NULL';
      }
    });
    clauses.push(`(${ors.join(' OR ')})`);
    shape.push(`d${options.join(',')}`);
  }
  if (tagIds !== null) {
    clauses.push(
      'EXISTS (SELECT 1 FROM task_tag tt WHERE tt.task_id = t.id AND tt.tag_id IN (SELECT value FROM json_each(?)))',
    );
    params.push(JSON.stringify(tagIds));
    shape.push('t');
  }
  return { where: clauses.map((c) => `AND ${c}`).join(' '), params, shape: shape.join('|') };
}

interface HitRow {
  id: string;
  title: string;
  parentId: string | null;
  parentTitle: string | null;
  boardId: string;
  boardName: string;
  boardIcon: string | null;
  boardColor: string | null;
  columnId: string;
  columnName: string;
  columnIcon: string | null;
  columnColor: string;
  columnCategory: string;
  priority: number;
  dueDate: string | null;
  completedAt: number | null;
}

export function searchRepository(db: Db): SearchRepository {
  const sqlite = db.$client;

  const boardTaskIds = sqlite.prepare<[string, string], { id: string }>(
    `SELECT t.id AS id FROM task_fts f JOIN task t ON t.id = f.task_id
       JOIN board_column c ON c.id = t.column_id
     WHERE task_fts MATCH ? AND t.board_id = ?
       AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL
       AND c.deleted_at IS NULL`,
  );

  /**
   * Best matches first. The index ranks (bm25) the matches alone, then only the best `cap` of them
   * are joined and filtered (hidden tasks, typed filters): ranking every match is cheap, joining
   * every match of a broad prefix on 10,000 tasks is not. `searchTasks` falls back to the uncapped
   * statement when the capped one found too few rows to fill the limit, so the filters always apply
   * before the limit. Statements are prepared once per shape of filters.
   */
  const statements = new Map<string, ReturnType<typeof sqlite.prepare<(string | number)[], HitRow>>>();
  const rankedSearch = (capped: boolean, filters: FilterSql) => {
    const key = `${capped ? 'capped' : 'all'}:${filters.shape}`;
    let statement = statements.get(key);
    if (!statement) {
      statement = sqlite.prepare<(string | number)[], HitRow>(
        `SELECT ${HIT_COLUMNS} FROM (
           SELECT task_id, ${SCORE} AS score FROM task_fts WHERE task_fts MATCH ?
           ${capped ? 'ORDER BY score LIMIT ?' : ''}
         ) m
         JOIN task t ON t.id = m.task_id ${HIT_JOINS}
         WHERE ${SHOWN} ${filters.where}
         ORDER BY m.score, t.created_at DESC, t.id
         LIMIT ?`,
      );
      statements.set(key, statement);
    }
    return statement;
  };

  const allTags = sqlite.prepare<[], { id: string; name: string }>('SELECT id, name FROM tag');
  /** Ids of the tags whose folded name is one of `folded`. */
  const tagIdsNamed = (folded: readonly string[]): string[] => {
    const wanted = new Set(folded);
    return allTags
      .all()
      .filter((tag) => wanted.has(foldTagName(tag.name)))
      .map((tag) => tag.id);
  };

  /** Tag names of a few tasks (at most one chunk of ids). */
  const tagNamesOf = (ids: readonly string[]): Map<string, string[]> => {
    const names = new Map<string, string[]>();
    if (ids.length === 0) return names;
    const rows = sqlite
      .prepare<string[], { taskId: string; name: string }>(
        `SELECT tt.task_id AS taskId, tg.name AS name FROM task_tag tt JOIN tag tg ON tg.id = tt.tag_id
         WHERE tt.task_id IN (${ids.map(() => '?').join(', ')})
         ORDER BY tg.name COLLATE NOCASE, tg.name`,
      )
      .all(...ids);
    for (const row of rows) {
      const list = names.get(row.taskId);
      if (list) list.push(row.name);
      else names.set(row.taskId, [row.name]);
    }
    return names;
  };

  const withTags = (rows: readonly HitRow[]): SearchHitRecord[] => {
    const names = new Map(chunked(rows.map((r) => r.id)).flatMap((chunk) => [...tagNamesOf(chunk)]));
    return rows.map((row) => ({
      ...row,
      boardColor: row.boardColor as ColumnColor | null,
      columnColor: row.columnColor as ColumnColor,
      columnCategory: row.columnCategory as ColumnCategory,
      priority: row.priority as Priority,
      dueDate: row.dueDate as CalendarDay | null,
      tagNames: names.get(row.id) ?? [],
    }));
  };

  const hitsOf = (ids: readonly string[]): HitRow[] =>
    ids.length === 0
      ? []
      : sqlite
          .prepare<string[], HitRow>(
            `SELECT ${HIT_COLUMNS} FROM task t ${HIT_JOINS}
             WHERE t.id IN (${ids.map(() => '?').join(', ')}) AND ${SHOWN}`,
          )
          .all(...ids);

  return {
    boardTaskIds: (boardId, ftsQuery) => boardTaskIds.all(searched(ftsQuery), boardId).map((row) => row.id),

    searchTasks: (ftsQuery, limit, filters = {}) => {
      let tagIds: string[] | null = null;
      if (filters.foldedTagNames !== undefined && filters.foldedTagNames.length > 0) {
        tagIds = tagIdsNamed(filters.foldedTagNames);
        if (tagIds.length === 0) return [];
      }
      const where = filterSql(filters, tagIds);
      const query = searched(ftsQuery);
      const capped = rankedSearch(true, where).all(query, limit * OVERFETCH, ...where.params, limit);
      return withTags(
        capped.length === limit ? capped : rankedSearch(false, where).all(query, ...where.params, limit),
      );
    },

    hits: (ids) => {
      const unique = [...new Set(ids)];
      const rows = new Map(
        chunked(unique)
          .flatMap(hitsOf)
          .map((row) => [row.id, row]),
      );
      return withTags(unique.flatMap((id) => rows.get(id) ?? []));
    },
  };
}
