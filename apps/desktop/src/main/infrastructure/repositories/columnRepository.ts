import type { ColumnColor } from '@ordo/domain';
import { and, asc, desc, eq, gt, isNull, lt, ne } from 'drizzle-orm';
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

    adjacentRankInBoard: (boardId, rank, side, excludeId) =>
      db
        .select({ rank: boardColumn.rank })
        .from(boardColumn)
        .where(
          and(
            eq(boardColumn.boardId, boardId),
            ne(boardColumn.id, excludeId),
            side === 'after' ? gt(boardColumn.rank, rank) : lt(boardColumn.rank, rank),
          ),
        )
        .orderBy(side === 'after' ? asc(boardColumn.rank) : desc(boardColumn.rank))
        .limit(1)
        .get()?.rank ?? null,

    update: (id, patch) => {
      db.update(boardColumn).set(patch).where(eq(boardColumn.id, id)).run();
    },

    lastRankInBoard: (boardId) =>
      db
        .select({ rank: boardColumn.rank })
        .from(boardColumn)
        .where(eq(boardColumn.boardId, boardId))
        .orderBy(desc(boardColumn.rank))
        .limit(1)
        .get()?.rank ?? null,

    softDelete: (id, now) => {
      db.update(boardColumn).set({ deletedAt: now, updatedAt: now }).where(eq(boardColumn.id, id)).run();
    },

    insertMany: (columns) => {
      if (columns.length > 0)
        db.insert(boardColumn)
          .values([...columns])
          .run();
    },
  };
}
