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
> & { readonly updatedAt: number };

export interface TaskRepository {
  /** Top-level, not deleted, not archived tasks of a board, ordered by rank. */
  listTopLevelByBoard(boardId: string): TaskRecord[];
  /** A task that is not deleted. */
  findById(id: string): TaskRecord | null;
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
