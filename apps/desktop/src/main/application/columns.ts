import type {
  Column,
  CreateColumnInput,
  DeleteColumnOutput,
  MoveColumnInput,
  UpdateColumnInput,
} from '@ordo/contracts';
import {
  canDeleteColumn,
  completionOnCategoryChange,
  normalizeColumnName,
  rankAtEnd,
  rankBetween,
  type Rank,
} from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import type {
  BoardRepository,
  Clock,
  ColumnRecord,
  ColumnRepository,
  IdGenerator,
  TaskRepository,
  Transactor,
} from './ports';

export interface ColumnUseCasesDeps {
  readonly boards: BoardRepository;
  readonly columns: ColumnRepository;
  readonly tasks: TaskRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export function toColumn(c: ColumnRecord): Column {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    category: c.category,
    displayLimit: c.displayLimit,
    rank: c.rank,
  };
}

export function makeColumnUseCases({ boards, columns, tasks, tx, clock, ids }: ColumnUseCasesDeps) {
  const requireColumn = (id: string) => {
    const column = columns.findById(id);
    if (!column) throw new NotFoundError('column', id);
    return column;
  };

  const requireName = (raw: string) => {
    const name = normalizeColumnName(raw);
    if (name === '') throw new RuleViolationError('A column needs a name');
    return name;
  };

  return {
    /** A column added from the board goes to the right end. */
    createColumn: (input: CreateColumnInput): Column =>
      tx.run(() => {
        if (!boards.findById(input.boardId)) throw new NotFoundError('board', input.boardId);
        const now = clock.now();
        const record: ColumnRecord = {
          id: ids.next(),
          boardId: input.boardId,
          name: requireName(input.name),
          icon: input.icon,
          color: input.color,
          category: input.category,
          displayLimit: input.displayLimit,
          rank: rankAtEnd(columns.lastRankInBoard(input.boardId)),
          createdAt: now,
          updatedAt: now,
        };
        columns.insertMany([record]);
        return toColumn(record);
      }),

    /** Settings popover. A new category updates the completion date of the column's tasks. */
    updateColumn: (input: UpdateColumnInput): Column =>
      tx.run(() => {
        const current = requireColumn(input.id);
        const now = clock.now();
        const patch = {
          ...(input.name !== undefined ? { name: requireName(input.name) } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.displayLimit !== undefined ? { displayLimit: input.displayLimit } : {}),
          updatedAt: now,
        };
        columns.update(current.id, patch);
        const completion =
          input.category === undefined ? null : completionOnCategoryChange(current.category, input.category);
        if (completion === 'complete') tasks.completeAllInColumn(current.id, now);
        if (completion === 'reopen') tasks.reopenAllInColumn(current.id, now);
        return toColumn({ ...current, ...patch });
      }),

    /** The column and its tasks go to the trash together; a board keeps at least one column. */
    deleteColumn: (id: string): DeleteColumnOutput =>
      tx.run(() => {
        const current = requireColumn(id);
        if (!canDeleteColumn(columns.listByBoard(current.boardId).length)) {
          throw new RuleViolationError('A board keeps at least one column');
        }
        const now = clock.now();
        const deletedTasks = tasks.softDeleteByColumn(current.id, now);
        columns.softDelete(current.id, now);
        return { id, deletedTasks };
      }),

    /** Drag and drop or ⌥/Alt + arrows on a header: rank the column between its new neighbours. */
    moveColumn: (input: MoveColumnInput): Column =>
      tx.run(() => {
        const current = requireColumn(input.columnId);
        const neighbour = (id: string | null) => {
          if (id === null) return null;
          if (id === current.id) throw new RuleViolationError('A column cannot be its own neighbour');
          const column = requireColumn(id);
          if (column.boardId !== current.boardId) {
            throw new RuleViolationError('Neighbours must be columns of the same board');
          }
          return column;
        };
        const before = neighbour(input.beforeId);
        const after = neighbour(input.afterId);
        if (before && after && before.rank >= after.rank) {
          throw new RuleViolationError('Neighbours are out of order');
        }
        // Rank against the true neighbours in the database (deleted columns keep their ranks in the
        // gaps): "just after `before`" wins; "just before `after`" when there is no `before`.
        let rank: Rank;
        if (before) {
          rank = rankBetween(
            before.rank,
            columns.adjacentRankInBoard(current.boardId, before.rank, 'after', current.id),
          );
        } else if (after) {
          rank = rankBetween(
            columns.adjacentRankInBoard(current.boardId, after.rank, 'before', current.id),
            after.rank,
          );
        } else throw new RuleViolationError('A move needs at least one neighbour');
        const patch = { rank, updatedAt: clock.now() };
        columns.update(current.id, patch);
        return toColumn({ ...current, ...patch });
      }),
  };
}

export type ColumnUseCases = ReturnType<typeof makeColumnUseCases>;
