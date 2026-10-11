import type { Column, MoveColumnInput } from '@ordo/contracts';
import { rankBetween } from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import type { Clock, ColumnRecord, ColumnRepository, Transactor } from './ports';

export interface ColumnUseCasesDeps {
  readonly columns: ColumnRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
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

export function makeColumnUseCases({ columns, tx, clock }: ColumnUseCasesDeps) {
  const requireColumn = (id: string) => {
    const column = columns.findById(id);
    if (!column) throw new NotFoundError('column', id);
    return column;
  };

  return {
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
        if (!before && !after) throw new RuleViolationError('A move needs at least one neighbour');
        const patch = {
          rank: rankBetween(before?.rank ?? null, after?.rank ?? null),
          updatedAt: clock.now(),
        };
        columns.update(current.id, patch);
        return toColumn({ ...current, ...patch });
      }),
  };
}

export type ColumnUseCases = ReturnType<typeof makeColumnUseCases>;
