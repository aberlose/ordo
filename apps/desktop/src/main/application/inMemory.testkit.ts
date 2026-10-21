import type {
  AttachmentRecord,
  AttachmentRepository,
  AttachmentStorage,
  BoardPatch,
  BoardRecord,
  BoardRepository,
  ColumnRecord,
  ColumnRepository,
  DesktopShell,
  SearchHitRecord,
  SearchRepository,
  SettingRepository,
  SubtaskCount,
  TagRecord,
  TagRepository,
  TaskRecord,
  TaskRepository,
  TaskTagLink,
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
  const liveSubtasks = (parentId: string) =>
    liveTasks().filter((t) => t.parentId === parentId && t.archivedAt === null);
  const isDone = (columnId: string) =>
    [...columnRows, ...deletedColumns].find((c) => c.id === columnId)?.category === 'done';
  const progressOf = (parentIds: ReadonlySet<string>): SubtaskCount[] =>
    [...parentIds]
      .map((parentId) => {
        const subs = liveSubtasks(parentId);
        return { parentId, total: subs.length, done: subs.filter((t) => isDone(t.columnId)).length };
      })
      .filter((p) => p.total > 0);
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
    findDescription: (id) => {
      const t = liveTasks().find((x) => x.id === id);
      return t ? { descriptionJson: t.descriptionJson, updatedAt: t.updatedAt } : null;
    },
    lastRankInColumn: (columnId) =>
      taskRows
        .filter((t) => t.columnId === columnId && t.parentId === null)
        .map((t) => t.rank)
        .sort()
        .at(-1) ?? null,
    adjacentRankInColumn: (columnId, rank, side, excludeId) => {
      const ranks = taskRows
        .filter((t) => t.columnId === columnId && t.parentId === null && t.id !== excludeId)
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
      const inColumn = taskRows.filter((t) => t.columnId === columnId && t.deletedAt === null);
      const parents = new Set(inColumn.filter((t) => t.parentId === null).map((t) => t.id));
      const rows = taskRows.filter(
        (t) => t.deletedAt === null && (t.columnId === columnId || parents.has(t.parentId ?? '')),
      );
      for (const row of rows) Object.assign(row, { deletedAt: now, updatedAt: now });
      return rows.length;
    },
    listSubtasks: (parentId) => liveSubtasks(parentId).sort(byRank).map(strip),
    lastSubtaskRank: (parentId) =>
      taskRows
        .filter((t) => t.parentId === parentId)
        .map((t) => t.rank)
        .sort()
        .at(-1) ?? null,
    softDeleteSubtasks: (parentId, now) => {
      const rows = taskRows.filter((t) => t.parentId === parentId && t.deletedAt === null);
      for (const row of rows) Object.assign(row, { deletedAt: now, updatedAt: now });
      return rows.length;
    },
    subtaskProgressByBoard: (boardId) =>
      progressOf(
        new Set(
          liveTasks()
            .filter((t) => t.boardId === boardId && t.parentId !== null)
            .map((t) => t.parentId ?? ''),
        ),
      ),
    subtaskProgressOf: (parentIds) => progressOf(new Set(parentIds)),
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

  const tagRows: TagRecord[] = [];
  let linkRows: TaskTagLink[] = [];
  const sameLink = (a: TaskTagLink) => (b: TaskTagLink) => a.taskId === b.taskId && a.tagId === b.tagId;
  const tagWithCount = (tag: TagRecord) => {
    const carriers = new Set(linkRows.filter((l) => l.tagId === tag.id).map((l) => l.taskId));
    return {
      ...tag,
      taskCount: liveTasks().filter((t) => t.archivedAt === null && carriers.has(t.id)).length,
    };
  };
  const tags: TagRepository = {
    listByBoard: (boardId) => tagRows.filter((t) => t.boardId === boardId).map((t) => ({ ...t })),
    listWithCountByBoard: (boardId) => tagRows.filter((t) => t.boardId === boardId).map(tagWithCount),
    listByIds: (ids) => {
      const wanted = new Set(ids);
      return tagRows.filter((t) => wanted.has(t.id)).map((t) => ({ ...t }));
    },
    findById: (id) => {
      const tag = tagRows.find((t) => t.id === id);
      return tag ? { ...tag } : null;
    },
    findWithCountById: (id) => {
      const tag = tagRows.find((t) => t.id === id);
      return tag ? tagWithCount(tag) : null;
    },
    insert: (tag) => void tagRows.push({ ...tag }),
    insertMany: (ts) => void tagRows.push(...ts.map((t) => ({ ...t }))),
    update: (id, patch) => {
      const i = tagRows.findIndex((t) => t.id === id);
      const row = tagRows[i];
      if (row) tagRows[i] = { ...row, ...patch };
    },
    delete: (id) => {
      const i = tagRows.findIndex((t) => t.id === id);
      if (i >= 0) tagRows.splice(i, 1);
    },
    linksByBoard: (boardId) => {
      const ids = new Set(tagRows.filter((t) => t.boardId === boardId).map((t) => t.id));
      return linkRows.filter((l) => ids.has(l.tagId));
    },
    linksOfTasks: (taskIds) => {
      const ids = new Set(taskIds);
      return linkRows.filter((l) => ids.has(l.taskId));
    },
    addLink: (link) => {
      if (linkRows.some(sameLink(link))) return false;
      linkRows.push({ ...link });
      return true;
    },
    removeLink: (link) => {
      const before = linkRows.length;
      linkRows = linkRows.filter((l) => !sameLink(link)(l));
      return linkRows.length < before;
    },
    removeLinksOfTag: (tagId) => void (linkRows = linkRows.filter((l) => l.tagId !== tagId)),
    insertLinks: (links) => void linkRows.push(...links.map((l) => ({ ...l }))),
  };

  /**
   * Naive full-text search for use-case tests: every quoted term of the FTS query must start a word
   * of the title, notes or tag names (case and accents ignored). Ranking is not simulated.
   */
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const termsOf = (ftsQuery: string) => [...ftsQuery.matchAll(/"([^"]*)"/g)].map((m) => fold(m[1] ?? ''));
  const tagNamesOf = (taskId: string) =>
    linkRows
      .filter((l) => l.taskId === taskId)
      .flatMap((l) => tagRows.find((t) => t.id === l.tagId)?.name ?? [])
      .sort((a, b) => a.localeCompare(b));
  const matches = (task: TaskRow, ftsQuery: string) => {
    const words = fold([task.title, task.descriptionText ?? '', ...tagNamesOf(task.id)].join(' ')).split(
      /[^\p{L}\p{N}]+/u,
    );
    return termsOf(ftsQuery).every((term) => words.some((word) => word.startsWith(term)));
  };
  const hitOf = (task: TaskRow): SearchHitRecord | null => {
    const board = boardRows.find((b) => b.id === task.boardId);
    const column = columnRows.find((c) => c.id === task.columnId);
    const parent = task.parentId === null ? null : taskRows.find((t) => t.id === task.parentId);
    const shown =
      task.deletedAt === null &&
      task.archivedAt === null &&
      board !== undefined &&
      board.archivedAt === null &&
      column !== undefined &&
      (parent === null || (parent !== undefined && parent.deletedAt === null && parent.archivedAt === null));
    if (!shown) return null;
    return {
      id: task.id,
      title: task.title,
      parentId: task.parentId,
      parentTitle: parent?.title ?? null,
      boardId: board.id,
      boardName: board.name,
      boardIcon: board.icon,
      boardColor: board.color,
      columnId: column.id,
      columnName: column.name,
      columnIcon: column.icon,
      columnColor: column.color,
      columnCategory: column.category,
      priority: task.priority,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      tagNames: tagNamesOf(task.id),
    };
  };
  const search: SearchRepository = {
    boardTaskIds: (boardId, ftsQuery) =>
      liveTasks()
        .filter((t) => t.boardId === boardId && t.parentId === null && t.archivedAt === null)
        .filter((t) => matches(t, ftsQuery))
        .map((t) => t.id),
    searchTasks: (ftsQuery, limit) =>
      taskRows
        .filter((t) => matches(t, ftsQuery))
        .flatMap((t) => hitOf(t) ?? [])
        .slice(0, limit),
    hits: (ids) =>
      [...new Set(ids)].flatMap((id) => {
        const task = taskRows.find((t) => t.id === id);
        return (task && hitOf(task)) ?? [];
      }),
  };

  const settingRows = new Map<string, string>();
  const settings: SettingRepository = {
    get: (key) => settingRows.get(key) ?? null,
    set: (key, value) => void settingRows.set(key, value),
  };

  let attachmentRows: AttachmentRecord[] = [];
  const byCreation = (a: AttachmentRecord, b: AttachmentRecord) =>
    a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const countsOf = (rows: readonly AttachmentRecord[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.taskId, (counts.get(row.taskId) ?? 0) + 1);
    return [...counts].map(([taskId, count]) => ({ taskId, count }));
  };
  const attachments: AttachmentRepository = {
    listByTask: (taskId) => attachmentRows.filter((a) => a.taskId === taskId).sort(byCreation),
    listByTasks: (taskIds) => {
      const ids = new Set(taskIds);
      return attachmentRows.filter((a) => ids.has(a.taskId)).sort(byCreation);
    },
    findById: (id) => attachmentRows.find((a) => a.id === id) ?? null,
    insert: (record) => void attachmentRows.push({ ...record }),
    insertMany: (records) => void attachmentRows.push(...records.map((r) => ({ ...r }))),
    delete: (id) => void (attachmentRows = attachmentRows.filter((a) => a.id !== id)),
    countByBoard: (boardId) => {
      const ids = new Set(taskRows.filter((t) => t.boardId === boardId).map((t) => t.id));
      return countsOf(attachmentRows.filter((a) => ids.has(a.taskId)));
    },
    countOf: (taskIds) => {
      const ids = new Set(taskIds);
      return countsOf(attachmentRows.filter((a) => ids.has(a.taskId)));
    },
    listStoredPaths: () => attachmentRows.map((a) => a.storedPath),
  };

  /** Files outside the app (by absolute path; `null` = a folder) and files of the attachments folder. */
  const outsideFiles = new Map<string, Uint8Array | null>();
  const storedFiles = new Map<string, Uint8Array>();
  /** Last modification time of a stored file (Unix ms); `0` when not set by the test. */
  const storedModifiedAt = new Map<string, number>();
  const failures = { import: new Set<string>(), copy: new Set<string>(), remove: new Set<string>() };
  const MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    exe: 'application/x-msdownload',
  };
  const extOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const storage: AttachmentStorage = {
    inspect: async (path) => {
      const file = outsideFiles.get(path);
      if (file === undefined) return { kind: 'missing' };
      return file === null ? { kind: 'not-a-file' } : { kind: 'file', size: file.byteLength };
    },
    importFile: async (path, storedPath) => {
      const file = outsideFiles.get(path);
      if (!file || failures.import.has(path)) throw new Error('EACCES: permission denied');
      storedFiles.set(storedPath, file);
      return file.byteLength;
    },
    writeData: async (storedPath, bytes) => {
      storedFiles.set(storedPath, bytes);
      return bytes.byteLength;
    },
    copyStored: async (from, to) => {
      const file = storedFiles.get(from);
      if (!file || failures.copy.has(from)) throw new Error('ENOENT: no such file');
      storedFiles.set(to, file);
      return file.byteLength;
    },
    remove: async (storedPath) => {
      if (failures.remove.has(storedPath)) throw new Error('EBUSY: resource busy');
      return storedFiles.delete(storedPath);
    },
    absolutePath: (storedPath) => {
      if (storedPath.includes('..') || storedPath.startsWith('/')) throw new Error('Outside the folder');
      return `/data/attachments/${storedPath}`;
    },
    exists: async (storedPath) => storedFiles.has(storedPath),
    mimeTypeOf: (name) => MIME[extOf(name)] ?? null,
    extensionOf: (mime) => Object.entries(MIME).find(([, m]) => m === mime)?.[0] ?? null,
    listStored: async () =>
      [...storedFiles.keys()].map((storedPath) => ({
        storedPath,
        modifiedAt: storedModifiedAt.get(storedPath) ?? 0,
      })),
  };

  const shellCalls = { opened: [] as string[], revealed: [] as string[] };
  const shellState = { picked: [] as string[], openError: '' };
  const shell: DesktopShell = {
    pickFiles: async () => [...shellState.picked],
    openPath: async (path) => {
      shellCalls.opened.push(path);
      return shellState.openError;
    },
    showItemInFolder: (path) => void shellCalls.revealed.push(path),
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
    allLinks: () => [...linkRows],
    taskRow: (id: string) => taskRows.find((t) => t.id === id),
    allAttachments: () => [...attachmentRows],
    outsideFiles,
    storedFiles,
    storedModifiedAt,
    failures,
    shellCalls,
    shellState,
    settingRows,
  };

  return { boards, columns, tasks, tags, attachments, storage, shell, search, settings, testing };
}

export function fixedDeps(now = 1_760_000_000_000) {
  let n = 0;
  let clock = now;
  return {
    tx: { run: <T>(work: () => T) => work() },
    clock: { now: () => clock },
    setNow: (value: number) => void (clock = value),
    ids: { next: () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}` },
    log: { warn: () => undefined },
  };
}
