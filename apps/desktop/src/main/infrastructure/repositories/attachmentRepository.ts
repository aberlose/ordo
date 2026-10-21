import { asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import type { AttachmentCount, AttachmentRecord, AttachmentRepository } from '../../application/ports';
import type { Db } from '../db/client';
import { attachment, task } from '../db/schema';
import { chunked } from './chunks';

const columns = {
  id: attachment.id,
  taskId: attachment.taskId,
  fileName: attachment.fileName,
  storedPath: attachment.storedPath,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  createdAt: attachment.createdAt,
};

const oldestFirst = [asc(attachment.createdAt), asc(attachment.id)];

export function attachmentRepository(db: Db): AttachmentRepository {
  const countsWhere = (where: SQL): AttachmentCount[] =>
    db
      .select({ taskId: attachment.taskId, count: count(attachment.id) })
      .from(attachment)
      .where(where)
      .groupBy(attachment.taskId)
      .all();

  return {
    listByTask: (taskId) =>
      db
        .select(columns)
        .from(attachment)
        .where(eq(attachment.taskId, taskId))
        .orderBy(...oldestFirst)
        .all(),

    listByTasks: (taskIds) =>
      chunked(taskIds)
        .flatMap((ids) => db.select(columns).from(attachment).where(inArray(attachment.taskId, ids)).all())
        .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),

    findById: (id) => db.select(columns).from(attachment).where(eq(attachment.id, id)).get() ?? null,

    insert: (record) => {
      db.insert(attachment).values(record).run();
    },

    // Chunked like the other bulk inserts; the caller's transaction keeps them all-or-nothing.
    insertMany: (records: readonly AttachmentRecord[]) => {
      for (const rows of chunked(records)) db.insert(attachment).values(rows).run();
    },

    delete: (id) => {
      db.delete(attachment).where(eq(attachment.id, id)).run();
    },

    // One grouped query starting from the board's tasks (`task_due` index on board_id), each looked
    // up in `attachment_task`: the cost follows the board's size, not the whole attachment table.
    countByBoard: (boardId) =>
      db
        .select({ taskId: task.id, count: count(attachment.id) })
        .from(task)
        .innerJoin(attachment, eq(attachment.taskId, task.id))
        .where(eq(task.boardId, boardId))
        .groupBy(task.id)
        .all(),

    countOf: (taskIds) => chunked(taskIds).flatMap((ids) => countsWhere(inArray(attachment.taskId, ids))),

    listStoredPaths: () =>
      db
        .select({ storedPath: attachment.storedPath })
        .from(attachment)
        .all()
        .map((row) => row.storedPath),
  };
}
