import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
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

    // One grouped query over the board's attachments (joined to their task by primary key): the
    // attachment table is scanned once, whatever the number of tasks.
    countByBoard: (boardId) =>
      db
        .select({ taskId: attachment.taskId, count: count(attachment.id) })
        .from(attachment)
        .innerJoin(task, and(eq(task.id, attachment.taskId), eq(task.boardId, boardId)))
        .groupBy(attachment.taskId)
        .all(),

    countOf: (taskIds) => chunked(taskIds).flatMap((ids) => countsWhere(inArray(attachment.taskId, ids))),
  };
}
