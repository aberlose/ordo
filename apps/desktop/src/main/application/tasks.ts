import type { CreateTaskInput, Task, UpdateTaskInput } from '@ordo/contracts';
import {
  areDatesOrdered,
  completionAfterMove,
  DEFAULT_PRIORITY,
  nextTaskKey,
  normalizeTitle,
  rankAtEnd,
} from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import type {
  Clock,
  ColumnRepository,
  IdGenerator,
  TaskPatch,
  TaskRecord,
  TaskRepository,
  Transactor,
} from './ports';

export interface TaskUseCasesDeps {
  readonly tasks: TaskRepository;
  readonly columns: ColumnRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export function toTask(record: TaskRecord): Task {
  return {
    id: record.id,
    columnId: record.columnId,
    key: record.key,
    title: record.title,
    priority: record.priority,
    startDate: record.startDate,
    dueDate: record.dueDate,
    rank: record.rank,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function requireTitle(raw: string): string {
  const title = normalizeTitle(raw);
  if (title === '') throw new RuleViolationError('A task needs a title');
  return title;
}

export function makeTaskUseCases({ tasks, columns, tx, clock, ids }: TaskUseCasesDeps) {
  const requireColumn = (id: string) => {
    const column = columns.findById(id);
    if (!column) throw new NotFoundError('column', id);
    return column;
  };
  const requireTask = (id: string) => {
    const task = tasks.findById(id);
    if (!task) throw new NotFoundError('task', id);
    return task;
  };

  return {
    /** Quick add: the new task goes at the bottom of its column, with the default priority. */
    createTask: (input: CreateTaskInput): Task =>
      tx.run(() => {
        const column = requireColumn(input.columnId);
        const now = clock.now();
        const record: TaskRecord = {
          id: ids.next(),
          boardId: column.boardId,
          columnId: column.id,
          parentId: null,
          key: nextTaskKey(tasks.maxKey(column.boardId)),
          title: requireTitle(input.title),
          priority: DEFAULT_PRIORITY,
          startDate: null,
          dueDate: null,
          rank: rankAtEnd(tasks.lastRankInColumn(column.id)),
          completedAt: completionAfterMove(null, column.category === 'done', now),
          createdAt: now,
          updatedAt: now,
        };
        tasks.insert(record);
        return toTask(record);
      }),

    updateTask: (input: UpdateTaskInput): Task =>
      tx.run(() => {
        const current = requireTask(input.id);
        const now = clock.now();
        const patch: { -readonly [K in keyof TaskPatch]: TaskPatch[K] } = { updatedAt: now };

        if (input.title !== undefined) patch.title = requireTitle(input.title);
        if (input.priority !== undefined) patch.priority = input.priority;
        if (input.startDate !== undefined) patch.startDate = input.startDate;
        if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

        if (input.columnId !== undefined && input.columnId !== current.columnId) {
          const target = requireColumn(input.columnId);
          if (target.boardId !== current.boardId) {
            throw new RuleViolationError('A task cannot move to another board');
          }
          patch.columnId = target.id;
          patch.rank = rankAtEnd(tasks.lastRankInColumn(target.id));
          patch.completedAt = completionAfterMove(current.completedAt, target.category === 'done', now);
        }

        const start = patch.startDate !== undefined ? patch.startDate : current.startDate;
        const due = patch.dueDate !== undefined ? patch.dueDate : current.dueDate;
        if (!areDatesOrdered(start, due)) {
          throw new RuleViolationError('The due date cannot be before the start date');
        }

        tasks.update(current.id, patch);
        return toTask({ ...current, ...patch });
      }),

    /** Soft delete; the trash (lot 8) restores or purges it. */
    deleteTask: (id: string): { id: string } =>
      tx.run(() => {
        requireTask(id);
        tasks.softDelete(id, clock.now());
        return { id };
      }),
  };
}

export type TaskUseCases = ReturnType<typeof makeTaskUseCases>;
