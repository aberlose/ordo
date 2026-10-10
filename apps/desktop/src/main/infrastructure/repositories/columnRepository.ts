import type { ColumnColor } from '@ordo/domain';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ColumnRecord, ColumnRepository } from '../../application/ports';
import type { Db } from '../db/client';
import { boardColumn } from '../db/schema';

const toRecord = ({ deletedAt: _deletedAt, ...row }: typeof boardColumn.$inferSelect): ColumnRecord => ({
  ...row,
  color: row.color as ColumnColor,
});

export function columnRepository(db: Db): ColumnRepository {
  return {
    listByBoard: (boardId) =>
      db
        .select()
        .from(boardColumn)
        .where(and(eq(boardColumn.boardId, boardId), isNull(boardColumn.deletedAt)))
        .orderBy(asc(boardColumn.rank))
        .all()
        .map(toRecord),

    findById: (id) => {
      const row = db
        .select()
        .from(boardColumn)
        .where(and(eq(boardColumn.id, id), isNull(boardColumn.deletedAt)))
        .get();
      return row ? toRecord(row) : null;
    },

    insertMany: (columns) => {
      if (columns.length > 0)
        db.insert(boardColumn)
          .values([...columns])
          .run();
    },
  };
}
