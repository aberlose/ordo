import type { Priority } from '@ordo/domain';
import { and, asc, desc, eq, gt, isNotNull, isNull, lt, max, ne } from 'drizzle-orm';
import type { TaskRecord, TaskRepository, TaskWithDescription } from '../../application/ports';
import type { Db } from '../db/client';
import { task } from '../db/schema';
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

    // Deleted tasks count too: a task restored from the trash must never share a rank.
    lastRankInColumn: (columnId) =>
      db
        .select({ rank: task.rank })
        .from(task)
        .where(eq(task.columnId, columnId))
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
      const topLevel = db
        .select({ id: task.id })
        .from(task)
        .where(and(eq(task.columnId, columnId), live, isNull(task.parentId)))
        .all().length;
      db.update(task)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(task.columnId, columnId), live))
        .run();
      return topLevel;
    },

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
