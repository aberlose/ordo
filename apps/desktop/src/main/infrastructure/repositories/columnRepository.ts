import type { ColumnColor } from '@ordo/domain';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ColumnRepository } from '../../application/ports';
import type { Db } from '../db/client';
import { boardColumn } from '../db/schema';

export function columnRepository(db: Db): ColumnRepository {
  return {
    listByBoard: (boardId) =>
      db
        .select()
        .from(boardColumn)
        .where(and(eq(boardColumn.boardId, boardId), isNull(boardColumn.deletedAt)))
        .orderBy(asc(boardColumn.rank))
        .all()
        .map(({ deletedAt: _deletedAt, ...row }) => ({ ...row, color: row.color as ColumnColor })),

    insertMany: (columns) => {
      if (columns.length > 0)
        db.insert(boardColumn)
          .values([...columns])
          .run();
    },
  };
}
