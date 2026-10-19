import type { ColumnColor } from '@ordo/domain';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import type { TagRepository, TaskTagLink } from '../../application/ports';
import type { Db } from '../db/client';
import { tag, task, taskTag } from '../db/schema';
import { chunked } from './chunks';

export function tagRepository(db: Db): TagRepository {
  /** Tags with the number of live (not deleted, not archived) tasks and sub-tasks carrying them. */
  const withCount = () =>
    db
      .select({
        id: tag.id,
        boardId: tag.boardId,
        name: tag.name,
        color: tag.color,
        taskCount: count(task.id),
      })
      .from(tag)
      .leftJoin(taskTag, eq(taskTag.tagId, tag.id))
      .leftJoin(task, and(eq(task.id, taskTag.taskId), isNull(task.deletedAt), isNull(task.archivedAt)))
      .groupBy(tag.id);

  /** Tags alone: no join, for the reads that only need names and colours. */
  const plain = () =>
    db.select({ id: tag.id, boardId: tag.boardId, name: tag.name, color: tag.color }).from(tag);

  const toRecord = <T extends { color: string }>(row: T): T & { color: ColumnColor } => ({
    ...row,
    color: row.color as ColumnColor,
  });

  const links = { taskId: taskTag.taskId, tagId: taskTag.tagId };

  return {
    listByBoard: (boardId) => plain().where(eq(tag.boardId, boardId)).all().map(toRecord),

    listWithCountByBoard: (boardId) => withCount().where(eq(tag.boardId, boardId)).all().map(toRecord),

    listByIds: (ids) =>
      chunked([...new Set(ids)]).flatMap((chunk) =>
        plain().where(inArray(tag.id, chunk)).all().map(toRecord),
      ),

    findById: (id) => {
      const row = plain().where(eq(tag.id, id)).get();
      return row ? toRecord(row) : null;
    },

    findWithCountById: (id) => {
      const row = withCount().where(eq(tag.id, id)).get();
      return row ? toRecord(row) : null;
    },

    insert: (record) => {
      db.insert(tag).values(record).run();
    },

    insertMany: (records) => {
      for (const rows of chunked(records)) db.insert(tag).values(rows).run();
    },

    update: (id, patch) => {
      if (Object.keys(patch).length > 0) db.update(tag).set(patch).where(eq(tag.id, id)).run();
    },

    delete: (id) => {
      db.delete(tag).where(eq(tag.id, id)).run();
    },

    linksByBoard: (boardId): TaskTagLink[] =>
      db
        .select(links)
        .from(taskTag)
        .innerJoin(tag, eq(tag.id, taskTag.tagId))
        .where(eq(tag.boardId, boardId))
        .all(),

    linksOfTasks: (taskIds) =>
      chunked(taskIds).flatMap((ids) =>
        db.select(links).from(taskTag).where(inArray(taskTag.taskId, ids)).all(),
      ),

    addLink: (link) => db.insert(taskTag).values(link).onConflictDoNothing().run().changes > 0,

    removeLink: (link) =>
      db
        .delete(taskTag)
        .where(and(eq(taskTag.taskId, link.taskId), eq(taskTag.tagId, link.tagId)))
        .run().changes > 0,

    removeLinksOfTag: (tagId) => {
      db.delete(taskTag).where(eq(taskTag.tagId, tagId)).run();
    },

    // Chunked like the task copies: the caller's transaction keeps the chunks all-or-nothing.
    insertLinks: (records) => {
      for (const rows of chunked(records)) db.insert(taskTag).values(rows).run();
    },
  };
}
