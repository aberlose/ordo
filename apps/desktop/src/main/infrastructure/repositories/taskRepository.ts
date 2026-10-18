import type { Priority } from '@ordo/domain';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
  ne,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { SubtaskCount, TaskRecord, TaskRepository, TaskWithDescription } from '../../application/ports';
import type { Db } from '../db/client';
import { boardColumn, task } from '../db/schema';
import { chunked } from './chunks';

const columnsOfRecord = {
  id: task.id,
  boardId: task.boardId,
  columnId: task.columnId,
  parentId: task.parentId,
  key: task.key,
  title: task.title,
  priority: task.priority,
  startDate: task.startDate,
  dueDate: task.dueDate,
  rank: task.rank,
  completedAt: task.completedAt,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
};

type Row = { [K in keyof typeof columnsOfRecord]: (typeof columnsOfRecord)[K]['_']['data'] | null };

const toRecord = (row: Row): TaskRecord => ({ ...(row as TaskRecord), priority: row.priority as Priority });

const columnsWithDescription = {
  ...columnsOfRecord,
  descriptionJson: task.descriptionJson,
  descriptionText: task.descriptionText,
};

export function taskRepository(db: Db): TaskRepository {
  const live = isNull(task.deletedAt);
  const parent = alias(task, 'parent');
  const doneColumn = alias(boardColumn, 'done_column');

  /** Live sub-tasks grouped by parent; `done` = those whose column is a Done one (one query). */
  const progressWhere = (scope: SQL | undefined): SubtaskCount[] =>
    db
      .select({ parentId: task.parentId, total: count(task.id), done: count(doneColumn.id) })
      .from(task)
      .leftJoin(doneColumn, and(eq(doneColumn.id, task.columnId), eq(doneColumn.category, 'done')))
      .where(and(scope, isNotNull(task.parentId), live, isNull(task.archivedAt)))
      .groupBy(task.parentId)
      .all()
      .map((row) => ({ parentId: row.parentId ?? '', total: row.total, done: row.done }));

  return {
    listTopLevelByBoard: (boardId) =>
      db
        .select(columnsOfRecord)
        .from(task)
        .where(and(eq(task.boardId, boardId), live, isNull(task.parentId), isNull(task.archivedAt)))
        .orderBy(asc(task.columnId), asc(task.rank))
        .all()
        .map(toRecord),

    listLiveWithDescriptionByBoard: (boardId) =>
      db
        .select(columnsWithDescription)
        .from(task)
        .where(and(eq(task.boardId, boardId), live, isNull(task.archivedAt)))
        .orderBy(asc(task.rank))
        .all()
        .map((row): TaskWithDescription => ({ ...row, priority: row.priority as Priority })),

    findById: (id) => {
      const row = db
        .select(columnsOfRecord)
        .from(task)
        .where(and(eq(task.id, id), live))
        .get();
      return row ? toRecord(row) : null;
    },

    // Deleted tasks count too: a task restored from the trash must never share a rank. Sub-tasks do
    // not: their rank is their place in the parent's list.
    lastRankInColumn: (columnId) =>
      db
        .select({ rank: task.rank })
        .from(task)
        .where(and(eq(task.columnId, columnId), isNull(task.parentId)))
        .orderBy(desc(task.rank))
        .limit(1)
        .get()?.rank ?? null,

    adjacentRankInColumn: (columnId, rank, side, excludeId) =>
      db
        .select({ rank: task.rank })
        .from(task)
        .where(
          and(
            eq(task.columnId, columnId),
            isNull(task.parentId),
            ne(task.id, excludeId),
            side === 'after' ? gt(task.rank, rank) : lt(task.rank, rank),
          ),
        )
        .orderBy(side === 'after' ? asc(task.rank) : desc(task.rank))
        .limit(1)
        .get()?.rank ?? null,

    maxKey: (boardId) =>
      db
        .select({ key: max(task.key) })
        .from(task)
        .where(eq(task.boardId, boardId))
        .get()?.key ?? null,

    insert: (record) => {
      db.insert(task).values(record).run();
    },

    // Chunked: one multi-row INSERT would exceed SQLite's bound-variable cap on large boards.
    // The caller's transaction keeps the chunks all-or-nothing.
    insertMany: (records) => {
      for (const rows of chunked(records)) db.insert(task).values(rows).run();
    },

    update: (id, patch) => {
      db.update(task).set(patch).where(eq(task.id, id)).run();
    },

    softDeleteByColumn: (columnId, now) => {
      // Sub-tasks elsewhere of the column's top-level tasks first, while those are still live.
      const parentsInColumn = db
        .select({ id: parent.id })
        .from(parent)
        .where(and(eq(parent.columnId, columnId), isNull(parent.deletedAt), isNull(parent.parentId)));
      const children = db
        .update(task)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(live, inArray(task.parentId, parentsInColumn)))
        .run().changes;
      const inColumn = db
        .update(task)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(task.columnId, columnId), live))
        .run().changes;
      return children + inColumn;
    },

    listSubtasks: (parentId) =>
      db
        .select(columnsOfRecord)
        .from(task)
        .where(and(eq(task.parentId, parentId), live, isNull(task.archivedAt)))
        .orderBy(asc(task.rank))
        .all()
        .map(toRecord),

    lastSubtaskRank: (parentId) =>
      db
        .select({ rank: task.rank })
        .from(task)
        .where(eq(task.parentId, parentId))
        .orderBy(desc(task.rank))
        .limit(1)
        .get()?.rank ?? null,

    softDeleteSubtasks: (parentId, now) =>
      db
        .update(task)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(task.parentId, parentId), live))
        .run().changes,

    subtaskProgressByBoard: (boardId) => progressWhere(eq(task.boardId, boardId)),

    subtaskProgressOf: (parentIds) =>
      chunked(parentIds).flatMap((ids) => progressWhere(inArray(task.parentId, ids))),

    completeAllInColumn: (columnId, now) => {
      db.update(task)
        .set({ completedAt: now, updatedAt: now })
        .where(and(eq(task.columnId, columnId), live, isNull(task.completedAt)))
        .run();
    },

    reopenAllInColumn: (columnId, now) => {
      db.update(task)
        .set({ completedAt: null, updatedAt: now })
        .where(and(eq(task.columnId, columnId), live, isNotNull(task.completedAt)))
        .run();
    },

    softDelete: (id, now) => {
      db.update(task).set({ deletedAt: now, updatedAt: now }).where(eq(task.id, id)).run();
    },
  };
}
