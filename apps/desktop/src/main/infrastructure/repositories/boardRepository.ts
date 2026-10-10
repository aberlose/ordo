import type { ColumnColor } from '@ordo/domain';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { BoardRepository, BoardWithCount } from '../../application/ports';
import type { Db } from '../db/client';
import { board, task } from '../db/schema';

export function boardRepository(db: Db): BoardRepository {
  const withCount = () =>
    db
      .select({
        id: board.id,
        name: board.name,
        icon: board.icon,
        color: board.color,
        rank: board.rank,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        taskCount: count(task.id),
      })
      .from(board)
      .leftJoin(task, and(eq(task.boardId, board.id), isNull(task.deletedAt), isNull(task.parentId)))
      .groupBy(board.id);

  const toRecord = (
    row: Awaited<ReturnType<ReturnType<typeof withCount>['all']>>[number],
  ): BoardWithCount => ({
    ...row,
    color: row.color as ColumnColor | null,
  });

  return {
    listActive: () =>
      withCount()
        .where(and(isNull(board.deletedAt), isNull(board.archivedAt)))
        .orderBy(asc(board.rank))
        .all()
        .map(toRecord),

    findById: (id) => {
      const row = withCount()
        .where(and(eq(board.id, id), isNull(board.deletedAt)))
        .get();
      return row ? toRecord(row) : null;
    },

    lastRank: () =>
      db.select({ rank: board.rank }).from(board).orderBy(desc(board.rank)).limit(1).get()?.rank ?? null,

    insert: (record) => {
      db.insert(board).values(record).run();
    },
  };
}
