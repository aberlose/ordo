import type {
  BoardRecord,
  BoardRepository,
  ColumnRecord,
  ColumnRepository,
  TaskRecord,
  TaskRepository,
} from './ports';

/** In-memory repositories for use-case tests. Not used at runtime. */
export function inMemoryRepositories() {
  const boardRows: BoardRecord[] = [];
  const columnRows: ColumnRecord[] = [];
  const taskRows: (TaskRecord & { deletedAt: number | null })[] = [];
  const byRank = <T extends { rank: string }>(a: T, b: T) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);
  const liveTasks = () => taskRows.filter((t) => t.deletedAt === null);
  const countFor = (boardId: string) =>
    liveTasks().filter((t) => t.boardId === boardId && t.parentId === null).length;

  const boards: BoardRepository = {
    listActive: () => [...boardRows].sort(byRank).map((b) => ({ ...b, taskCount: countFor(b.id) })),
    findById: (id) => {
      const b = boardRows.find((x) => x.id === id);
      return b ? { ...b, taskCount: countFor(b.id) } : null;
    },
    lastRank: () =>
      boardRows
        .map((b) => b.rank)
        .sort()
        .at(-1) ?? null,
    insert: (b) => void boardRows.push(b),
  };

  const columns: ColumnRepository = {
    listByBoard: (id) => columnRows.filter((c) => c.boardId === id).sort(byRank),
    findById: (id) => columnRows.find((c) => c.id === id) ?? null,
    insertMany: (cs) => void columnRows.push(...cs),
  };

  const strip = ({ deletedAt: _deletedAt, ...t }: TaskRecord & { deletedAt: number | null }): TaskRecord => t;
  const tasks: TaskRepository = {
    listTopLevelByBoard: (boardId) =>
      liveTasks()
        .filter((t) => t.boardId === boardId && t.parentId === null)
        .sort(byRank)
        .map(strip),
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
    maxKey: (boardId) => {
      const keys = taskRows.filter((t) => t.boardId === boardId).map((t) => t.key);
      return keys.length ? Math.max(...keys) : null;
    },
    insert: (t) => void taskRows.push({ ...t, deletedAt: null }),
    update: (id, patch) => {
      const i = taskRows.findIndex((t) => t.id === id);
      const row = taskRows[i];
      if (row) taskRows[i] = { ...row, ...patch };
    },
    softDelete: (id, now) => {
      const row = taskRows.find((t) => t.id === id);
      if (row) {
        row.deletedAt = now;
        tasks.update(id, { updatedAt: now });
      }
    },
  };

  return { boards, columns, tasks };
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
