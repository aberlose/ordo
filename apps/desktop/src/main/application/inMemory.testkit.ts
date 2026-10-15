import type {
  BoardPatch,
  BoardRecord,
  BoardRepository,
  ColumnRecord,
  ColumnRepository,
  TaskRecord,
  TaskRepository,
  TaskWithDescription,
} from './ports';

/** In-memory repositories for use-case tests. Not used at runtime. */
export function inMemoryRepositories() {
  const boardRows: (BoardRecord & { archivedAt: number | null })[] = [];
  const columnRows: ColumnRecord[] = [];
  const deletedColumns: ColumnRecord[] = [];
  type TaskRow = TaskWithDescription & { deletedAt: number | null; archivedAt: number | null };
  const taskRows: TaskRow[] = [];
  const byRank = <T extends { rank: string }>(a: T, b: T) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);
  const liveTasks = () => taskRows.filter((t) => t.deletedAt === null);
  const countFor = (boardId: string) =>
    liveTasks().filter((t) => t.boardId === boardId && t.parentId === null && t.archivedAt === null).length;
  const withCount = (b: BoardRecord & { archivedAt: number | null }) => ({ ...b, taskCount: countFor(b.id) });

  const boards: BoardRepository = {
    listActive: () =>
      boardRows
        .filter((b) => b.archivedAt === null)
        .sort(byRank)
        .map(withCount),
    listArchived: () =>
      boardRows
        .filter((b) => b.archivedAt !== null)
        .sort(byRank)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
        .map(withCount),
    findById: (id) => {
      const b = boardRows.find((x) => x.id === id);
      return b ? withCount(b) : null;
    },
    lastRank: () =>
      boardRows
        .map((b) => b.rank)
        .sort()
        .at(-1) ?? null,
    adjacentRank: (rank, side, excludeId) => {
      const ranks = boardRows
        .filter((b) => b.id !== excludeId)
        .map((b) => b.rank)
        .filter((r) => (side === 'after' ? r > rank : r < rank))
        .sort();
      return (side === 'after' ? ranks[0] : ranks.at(-1)) ?? null;
    },
    insert: (b) => void boardRows.push({ ...b, archivedAt: null }),
    update: (id, patch: BoardPatch) => {
      const i = boardRows.findIndex((b) => b.id === id);
      const row = boardRows[i];
      if (row) boardRows[i] = { ...row, ...patch };
    },
  };

  const columns: ColumnRepository = {
    listByBoard: (id) => columnRows.filter((c) => c.boardId === id).sort(byRank),
    findById: (id) => columnRows.find((c) => c.id === id) ?? null,
    adjacentRankInBoard: (boardId, rank, side, excludeId) => {
      const ranks = [...columnRows, ...deletedColumns]
        .filter((c) => c.boardId === boardId && c.id !== excludeId)
        .map((c) => c.rank)
        .filter((r) => (side === 'after' ? r > rank : r < rank))
        .sort();
      return (side === 'after' ? ranks[0] : ranks.at(-1)) ?? null;
    },
    insertMany: (cs) => void columnRows.push(...cs),
    lastRankInBoard: (boardId) =>
      [...columnRows, ...deletedColumns]
        .filter((c) => c.boardId === boardId)
        .map((c) => c.rank)
        .sort()
        .at(-1) ?? null,
    softDelete: (id) => {
      const i = columnRows.findIndex((c) => c.id === id);
      const [removed] = columnRows.splice(i, 1);
      if (removed) deletedColumns.push(removed);
    },
    update: (id, patch) => {
      const i = columnRows.findIndex((c) => c.id === id);
      const row = columnRows[i];
      if (row) columnRows[i] = { ...row, ...patch };
    },
  };

  const strip = ({
    deletedAt: _deletedAt,
    archivedAt: _archivedAt,
    descriptionJson: _descriptionJson,
    descriptionText: _descriptionText,
    ...t
  }: TaskRow): TaskRecord => t;
  const withDescription = ({
    deletedAt: _deletedAt,
    archivedAt: _archivedAt,
    ...t
  }: TaskRow): TaskWithDescription => t;
  const toRow = (t: TaskRecord): TaskRow => ({
    descriptionJson: null,
    descriptionText: null,
    ...t,
    deletedAt: null,
    archivedAt: null,
  });
  const tasks: TaskRepository = {
    listTopLevelByBoard: (boardId) =>
      liveTasks()
        .filter((t) => t.boardId === boardId && t.parentId === null && t.archivedAt === null)
        .sort(byRank)
        .map(strip),
    listLiveWithDescriptionByBoard: (boardId) =>
      liveTasks()
        .filter((t) => t.boardId === boardId && t.archivedAt === null)
        .sort(byRank)
        .map(withDescription),
    findById: (id) => {
      const t = liveTasks().find((x) => x.id === id);
      return t ? strip(t) : null;
    },
    lastRankInColumn: (columnId) =>
      taskRows
        .filter((t) => t.columnId === columnId)
        .map((t) => t.rank)
        .sort()
        .at(-1) ?? null,
    adjacentRankInColumn: (columnId, rank, side, excludeId) => {
      const ranks = taskRows
        .filter((t) => t.columnId === columnId && t.id !== excludeId)
        .map((t) => t.rank)
        .filter((r) => (side === 'after' ? r > rank : r < rank))
        .sort();
      return (side === 'after' ? ranks[0] : ranks.at(-1)) ?? null;
    },
    maxKey: (boardId) => {
      const keys = taskRows.filter((t) => t.boardId === boardId).map((t) => t.key);
      return keys.length ? Math.max(...keys) : null;
    },
    insert: (t) => void taskRows.push(toRow(t)),
    insertMany: (ts) => void taskRows.push(...ts.map(toRow)),
    update: (id, patch) => {
      const i = taskRows.findIndex((t) => t.id === id);
      const row = taskRows[i];
      if (row) taskRows[i] = { ...row, ...patch };
    },
    softDeleteByColumn: (columnId, now) => {
      const rows = taskRows.filter((t) => t.columnId === columnId && t.deletedAt === null);
      for (const row of rows) row.deletedAt = now;
      return rows.filter((t) => t.parentId === null).length;
    },
    completeAllInColumn: (columnId, now) => {
      for (const row of taskRows)
        if (row.columnId === columnId && row.deletedAt === null && row.completedAt === null) {
          Object.assign(row, { completedAt: now, updatedAt: now });
        }
    },
    reopenAllInColumn: (columnId, now) => {
      for (const row of taskRows)
        if (row.columnId === columnId && row.deletedAt === null && row.completedAt !== null) {
          Object.assign(row, { completedAt: null, updatedAt: now });
        }
    },
    softDelete: (id, now) => {
      const row = taskRows.find((t) => t.id === id);
      if (row) {
        row.deletedAt = now;
        tasks.update(id, { updatedAt: now });
      }
    },
  };

  /**
   * Test-only hooks for states no use case produces yet (archived tasks: lot 8; descriptions: the
   * detail window's editor).
   */
  const testing = {
    archiveTask: (id: string, now: number) => {
      const row = taskRows.find((t) => t.id === id);
      if (row) row.archivedAt = now;
    },
    describeTask: (id: string, descriptionJson: string, descriptionText: string) => {
      const row = taskRows.find((t) => t.id === id);
      if (row) Object.assign(row, { descriptionJson, descriptionText });
    },
    allTasks: (boardId: string) => liveTasks().filter((t) => t.boardId === boardId),
  };

  return { boards, columns, tasks, testing };
}

export function fixedDeps(now = 1_760_000_000_000) {
  let n = 0;
  let clock = now;
  return {
    tx: { run: <T>(work: () => T) => work() },
    clock: { now: () => clock },
    setNow: (value: number) => void (clock = value),
    ids: { next: () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}` },
  };
}
