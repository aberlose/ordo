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

export interface BoardWithCount extends BoardRecord {
  readonly taskCount: number;
}

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
  listActive(): BoardWithCount[];
  findById(id: string): BoardWithCount | null;
  lastRank(): Rank | null;
  insert(board: BoardRecord): void;
}

export interface ColumnRepository {
  listByBoard(boardId: string): ColumnRecord[];
  findById(id: string): ColumnRecord | null;
  insertMany(columns: readonly ColumnRecord[]): void;
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
  /** Highest key ever given on the board, deleted tasks included (keys are never reused). */
  maxKey(boardId: string): number | null;
  insert(task: TaskRecord): void;
  update(id: string, patch: TaskPatch): void;
  softDelete(id: string, now: number): void;
}
