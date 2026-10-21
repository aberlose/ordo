import type { CalendarDay, ColumnCategory, ColumnColor, DisplayLimit, Priority, Rank } from '@ordo/domain';

/** Ports implemented by the infrastructure layer. Use cases depend only on these. */

export interface Clock {
  now(): number;
}

export interface IdGenerator {
  next(): string;
}

/** Runs `work` inside one database transaction (better-sqlite3 transactions are synchronous). */
export interface Transactor {
  run<T>(work: () => T): T;
}

export interface BoardRecord {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly color: ColumnColor | null;
  readonly rank: Rank;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A board as read back: its live top-level task count and, when archived, the archive date. */
export interface BoardWithCount extends BoardRecord {
  readonly taskCount: number;
  readonly archivedAt: number | null;
}

export type BoardPatch = Partial<Pick<BoardRecord, 'name' | 'icon' | 'color' | 'rank'>> & {
  readonly archivedAt?: number | null;
  readonly updatedAt: number;
};

export interface ColumnRecord {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly icon: string | null;
  readonly color: ColumnColor;
  readonly category: ColumnCategory;
  readonly displayLimit: DisplayLimit;
  readonly rank: Rank;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface BoardRepository {
  /** Live boards that are not archived, ordered by rank (the sidebar). */
  listActive(): BoardWithCount[];
  /** Archived boards that are not deleted, most recently archived first. */
  listArchived(): BoardWithCount[];
  /** A board that is not deleted (archived or not). */
  findById(id: string): BoardWithCount | null;
  /** Highest rank among all boards, archived and deleted ones included. */
  lastRank(): Rank | null;
  /**
   * The rank right after (`'after'`) or right before (`'before'`) `rank` among all boards, archived
   * and deleted ones included and `excludeId` ignored: the true neighbour, whatever the client believed.
   */
  adjacentRank(rank: Rank, side: 'after' | 'before', excludeId: string): Rank | null;
  insert(board: BoardRecord): void;
  update(id: string, patch: BoardPatch): void;
}

export interface ColumnRepository {
  listByBoard(boardId: string): ColumnRecord[];
  findById(id: string): ColumnRecord | null;
  insertMany(columns: readonly ColumnRecord[]): void;
  update(
    id: string,
    patch: Partial<Pick<ColumnRecord, 'rank' | 'name' | 'icon' | 'color' | 'category' | 'displayLimit'>> & {
      readonly updatedAt: number;
    },
  ): void;
  /** Highest rank among the board's columns, deleted ones included. */
  lastRankInBoard(boardId: string): Rank | null;
  softDelete(id: string, now: number): void;
  /**
   * The rank right after or right before `rank` among the board's columns, deleted ones included and
   * `excludeId` ignored.
   */
  adjacentRankInBoard(boardId: string, rank: Rank, side: 'after' | 'before', excludeId: string): Rank | null;
}

export interface TaskRecord {
  readonly id: string;
  readonly boardId: string;
  readonly columnId: string;
  readonly parentId: string | null;
  readonly key: number;
  readonly title: string;
  readonly priority: Priority;
  readonly startDate: CalendarDay | null;
  readonly dueDate: CalendarDay | null;
  readonly rank: Rank;
  readonly completedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A task with its description: what a board duplication reads and writes. */
export interface TaskWithDescription extends TaskRecord {
  readonly descriptionJson: string | null;
  readonly descriptionText: string | null;
}

export type TaskPatch = Partial<
  Pick<TaskRecord, 'title' | 'columnId' | 'priority' | 'startDate' | 'dueDate' | 'rank' | 'completedAt'>
> &
  Partial<Pick<TaskWithDescription, 'descriptionJson' | 'descriptionText'>> & { readonly updatedAt: number };

/** The stored notes of a task: serialised ProseMirror JSON, `null` for no notes. */
export interface StoredDescription {
  readonly descriptionJson: string | null;
  readonly updatedAt: number;
}

export interface TaskRepository {
  /** Top-level, not deleted, not archived tasks of a board, ordered by rank. */
  listTopLevelByBoard(boardId: string): TaskRecord[];
  /** A task that is not deleted. */
  findById(id: string): TaskRecord | null;
  /** The notes of a task that is not deleted. */
  findDescription(id: string): StoredDescription | null;
  /** Highest rank in the column, deleted tasks included (a restored task must not collide). */
  lastRankInColumn(columnId: string): Rank | null;
  /**
   * The rank right after (`'after'`) or right before (`'before'`) `rank` in the column, deleted tasks
   * included and `excludeId` ignored: the true neighbour, whatever the client believed.
   */
  adjacentRankInColumn(
    columnId: string,
    rank: Rank,
    side: 'after' | 'before',
    excludeId: string,
  ): Rank | null;
  /**
   * Live (not deleted, not archived) tasks of a board, sub-tasks included, with their description.
   * Ordered by rank.
   */
  listLiveWithDescriptionByBoard(boardId: string): TaskWithDescription[];
  /** Highest key ever given on the board, deleted tasks included (keys are never reused). */
  maxKey(boardId: string): number | null;
  insert(task: TaskRecord): void;
  /** Bulk insert (board duplication); parents must come before their sub-tasks. */
  insertMany(tasks: readonly TaskWithDescription[]): void;
  update(id: string, patch: TaskPatch): void;
  softDelete(id: string, now: number): void;
  /**
   * Soft-deletes the live tasks and sub-tasks of a column, plus the live sub-tasks (wherever they
   * sit) of the top-level tasks it held; returns how many rows went.
   */
  softDeleteByColumn(columnId: string, now: number): number;
  /** Live (not deleted, not archived) sub-tasks of a task, ordered by rank. */
  listSubtasks(parentId: string): TaskRecord[];
  /** Highest rank among the task's sub-tasks, deleted ones included (a restored one must not collide). */
  lastSubtaskRank(parentId: string): Rank | null;
  /** Soft-deletes the live sub-tasks of a task; returns how many went. */
  softDeleteSubtasks(parentId: string, now: number): number;
  /** Progress of every task of the board that has live sub-tasks (one grouped query). */
  subtaskProgressByBoard(boardId: string): SubtaskCount[];
  /** Progress of the given tasks that have live sub-tasks. */
  subtaskProgressOf(parentIds: readonly string[]): SubtaskCount[];
  /** Column moved to a "done" category: its live tasks without a completion date get `now`. */
  completeAllInColumn(columnId: string, now: number): void;
  /** Column left the "done" category: its live tasks lose their completion date. */
  reopenAllInColumn(columnId: string, now: number): void;
}

/** Live sub-tasks of `parentId`: `done` are those in a column whose category is "done". */
export interface SubtaskCount {
  readonly parentId: string;
  readonly done: number;
  readonly total: number;
}

export interface TagRecord {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly color: ColumnColor;
}

/** A tag with the number of live (not deleted, not archived) tasks and sub-tasks carrying it. */
export interface TagWithCount extends TagRecord {
  readonly taskCount: number;
}

export interface TaskTagLink {
  readonly taskId: string;
  readonly tagId: string;
}

export interface TagRepository {
  /** The board's tags, without counts, in no particular order (sort them with `compareTags`). */
  listByBoard(boardId: string): TagRecord[];
  /** The board's tags with their live task counts (joins every link of the board: only where shown). */
  listWithCountByBoard(boardId: string): TagWithCount[];
  /** The given tags, without counts, whatever their board. */
  listByIds(ids: readonly string[]): TagRecord[];
  findById(id: string): TagRecord | null;
  /** A tag with its live task count. */
  findWithCountById(id: string): TagWithCount | null;
  insert(tag: TagRecord): void;
  /** Bulk insert (board duplication). */
  insertMany(tags: readonly TagRecord[]): void;
  update(id: string, patch: Partial<Pick<TagRecord, 'name' | 'color'>>): void;
  /** Permanent: the tag row only (remove its links first). */
  delete(id: string): void;
  /** Links of the board's tags, whatever the state of the tasks. */
  linksByBoard(boardId: string): TaskTagLink[];
  /** Links of the given tasks. */
  linksOfTasks(taskIds: readonly string[]): TaskTagLink[];
  /** Adds the link; `false` when it already existed. */
  addLink(link: TaskTagLink): boolean;
  /** Removes the link; `false` when there was none. */
  removeLink(link: TaskTagLink): boolean;
  /** Permanent: every link of the tag. */
  removeLinksOfTag(tagId: string): void;
  /** Bulk insert (board duplication). */
  insertLinks(links: readonly TaskTagLink[]): void;
}

/** A task found by full-text search (or recently opened), with where it lives. */
export interface SearchHitRecord {
  readonly id: string;
  readonly title: string;
  readonly parentId: string | null;
  readonly parentTitle: string | null;
  readonly boardId: string;
  readonly boardName: string;
  readonly boardIcon: string | null;
  readonly boardColor: ColumnColor | null;
  readonly columnId: string;
  readonly columnName: string;
  readonly columnIcon: string | null;
  readonly columnColor: ColumnColor;
  readonly columnCategory: ColumnCategory;
  readonly priority: Priority;
  readonly dueDate: CalendarDay | null;
  readonly completedAt: number | null;
  /** Tag names, sorted alphabetically (case ignored). */
  readonly tagNames: readonly string[];
}

/**
 * The full-text index (title, notes text, tag names). `ftsQuery` is built by the domain's
 * `toFtsQuery`, never raw user text. Only live tasks (not deleted, not archived) of live boards are
 * returned, and a sub-task only while its parent is live.
 */
export interface SearchRepository {
  /** Ids of the matching top-level tasks of a board (archived or not), no limit, in no particular order. */
  boardTaskIds(boardId: string, ftsQuery: string): string[];
  /** Matching tasks and sub-tasks of the non-archived boards, best first (title > tags > notes). */
  searchTasks(ftsQuery: string, limit: number): SearchHitRecord[];
  /** The given tasks that are still shown (live, non-archived board), in the given order. */
  hits(ids: readonly string[]): SearchHitRecord[];
}

/** Key–value app settings (table `setting`). */
export interface SettingRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface AttachmentRecord {
  readonly id: string;
  readonly taskId: string;
  /** Original (normalised) file name, shown on the tile. */
  readonly fileName: string;
  /** Relative to the attachments folder (`attachmentStoredPath`). */
  readonly storedPath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly createdAt: number;
}

/** Number of attachments of a task (only tasks that have some). */
export interface AttachmentCount {
  readonly taskId: string;
  readonly count: number;
}

export interface AttachmentRepository {
  /** A task's attachments, oldest first. */
  listByTask(taskId: string): AttachmentRecord[];
  /** Attachments of the given tasks, oldest first (board duplication). */
  listByTasks(taskIds: readonly string[]): AttachmentRecord[];
  findById(id: string): AttachmentRecord | null;
  insert(record: AttachmentRecord): void;
  /** Bulk insert (board duplication). */
  insertMany(records: readonly AttachmentRecord[]): void;
  /** Permanent: the row only (the file is removed by the use case after the commit). */
  delete(id: string): void;
  /** Counts of every task of the board that has attachments (one grouped query). */
  countByBoard(boardId: string): AttachmentCount[];
  /** Counts of the given tasks that have attachments. */
  countOf(taskIds: readonly string[]): AttachmentCount[];
  /** Stored path of every attachment row, trashed tasks included (orphan file sweep). */
  listStoredPaths(): string[];
}

/** What a source path given by the renderer points to. */
export type SourceFile =
  { readonly kind: 'file'; readonly size: number } | { readonly kind: 'missing' | 'not-a-file' };

/**
 * The attachments folder (`<userData>/attachments/`). Stored paths are relative to it; the storage
 * refuses any path that would resolve outside of it.
 */
export interface AttachmentStorage {
  /** Looks at a file the user dropped or picked, without reading it. */
  inspect(sourcePath: string): Promise<SourceFile>;
  /**
   * Copies an outside file into the folder (streamed from the handle it opened and checked to be a
   * regular file; `Error('Not a file')` otherwise); returns the stored size in bytes. The system's
   * "downloaded from the internet" mark is carried over where Node can read it (best effort).
   */
  importFile(sourcePath: string, storedPath: string): Promise<number>;
  /** Writes bytes (a pasted image) into the folder; returns the stored size in bytes. */
  writeData(storedPath: string, bytes: Uint8Array): Promise<number>;
  /** Copies a stored file to another stored path (board duplication); returns the size in bytes. */
  copyStored(fromStoredPath: string, toStoredPath: string): Promise<number>;
  /** Removes a stored file; `false` when it was already gone. */
  remove(storedPath: string): Promise<boolean>;
  /** Absolute path of a stored file, checked to stay inside the folder. */
  absolutePath(storedPath: string): string;
  /** Whether a stored file is still on disk. */
  exists(storedPath: string): Promise<boolean>;
  /** Mime type from the file name's extension, `null` when unknown. */
  mimeTypeOf(fileName: string): string | null;
  /** Usual extension of a mime type (without the dot), `null` when unknown. */
  extensionOf(mimeType: string): string | null;
  /** Regular, non-hidden files of the folder with their last modification time (orphan sweep). */
  listStored(): Promise<StoredFileInfo[]>;
}

export interface StoredFileInfo {
  readonly storedPath: string;
  /** Unix ms. */
  readonly modifiedAt: number;
}

/** The operating system's side of attachments (Electron's `shell` and `dialog`). */
export interface DesktopShell {
  /** Native "open files" dialog (several files); `[]` when cancelled. */
  pickFiles(): Promise<string[]>;
  /** Opens a file with its default application; `''` on success, else the system's error message. */
  openPath(absolutePath: string): Promise<string>;
  /** Shows the file in the Finder / Explorer. */
  showItemInFolder(absolutePath: string): void;
}

export interface Logger {
  warn(message: string, error?: unknown): void;
}
