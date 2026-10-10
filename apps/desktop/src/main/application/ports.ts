import type { ColumnCategory, ColumnColor, DisplayLimit, Rank } from '@ordo/domain';

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
  insertMany(columns: readonly ColumnRecord[]): void;
}
