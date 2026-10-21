import type { CalendarDay, ColumnCategory, ColumnColor, Priority } from '@ordo/domain';
import type { SearchHitRecord, SearchRepository } from '../../application/ports';
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
     WHERE task_fts MATCH ? AND t.board_id = ?
       AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL`,
  );

  /**
   * Best matches first. The index ranks (bm25) the matches alone, then only the best `cap` of them
   * are joined and filtered (deleted, archived): ranking every match is cheap, joining every match
   * of a broad prefix on 10,000 tasks is not. `searchTasks` falls back to the uncapped statement
   * when the capped one found too few rows to fill the limit.
   */
  const rankedSearch = (capped: boolean) =>
    sqlite.prepare<[string, ...number[]], HitRow>(
      `SELECT ${HIT_COLUMNS} FROM (
         SELECT task_id, ${SCORE} AS score FROM task_fts WHERE task_fts MATCH ?
         ${capped ? 'ORDER BY score LIMIT ?' : ''}
       ) m
       JOIN task t ON t.id = m.task_id ${HIT_JOINS}
       WHERE ${SHOWN}
       ORDER BY m.score, t.created_at DESC, t.id
       LIMIT ?`,
    );
  const searchCapped = rankedSearch(true);
  const searchAll = rankedSearch(false);

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

    searchTasks: (ftsQuery, limit) => {
      const query = searched(ftsQuery);
      const capped = searchCapped.all(query, limit * OVERFETCH, limit);
      return withTags(capped.length === limit ? capped : searchAll.all(query, limit));
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
