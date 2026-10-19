import type {
  CreateTaskInput,
  Input,
  MoveTaskInput,
  Output,
  SubtaskProgress,
  Task,
  TaskTagInput,
  UpdateTaskInput,
} from '@ordo/contracts';

type DescriptionOutput = Output<'tasks.getDescription'>;
type UpdateDescriptionInput = Input<'tasks.updateDescription'>;
import {
  areDatesOrdered,
  canBeParent,
  columnForNewSubtask,
  compareTags,
  completionAfterMove,
  DEFAULT_PRIORITY,
  descriptionText,
  isEmptyDescription,
  type DocNode,
  nextTaskKey,
  normalizeTitle,
  rankAtEnd,
  rankBetween,
} from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import type {
  AttachmentCount,
  AttachmentRepository,
  BoardRepository,
  Clock,
  ColumnRecord,
  ColumnRepository,
  IdGenerator,
  SubtaskCount,
  TagRecord,
  TagRepository,
  TaskPatch,
  TaskRecord,
  TaskRepository,
  TaskTagLink,
  Transactor,
} from './ports';

export interface TaskUseCasesDeps {
  readonly boards: BoardRepository;
  readonly tasks: TaskRepository;
  readonly columns: ColumnRepository;
  readonly tags: TagRepository;
  readonly attachments: AttachmentRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const NO_SUBTASKS: SubtaskProgress = { done: 0, total: 0 };

export function toTask(
  record: TaskRecord,
  tagIds: readonly string[] = [],
  subtasks: SubtaskProgress = NO_SUBTASKS,
  attachmentCount = 0,
): Task {
  return {
    id: record.id,
    columnId: record.columnId,
    parentId: record.parentId,
    key: record.key,
    title: record.title,
    priority: record.priority,
    startDate: record.startDate,
    dueDate: record.dueDate,
    rank: record.rank,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tagIds: [...tagIds],
    subtasks: { done: subtasks.done, total: subtasks.total },
    attachmentCount,
  };
}

/**
 * Joins records with their tags (alphabetical), sub-task progress and attachment counts, from a few
 * set-based reads.
 * `knownTags` must hold every tag the links point to; links to other tags are dropped.
 */
function assemble(
  records: readonly TaskRecord[],
  knownTags: readonly TagRecord[],
  progress: readonly SubtaskCount[],
  links: readonly TaskTagLink[],
  attachmentCounts: readonly AttachmentCount[],
): Task[] {
  const countOf = new Map(attachmentCounts.map((c) => [c.taskId, c.count]));
  const order = new Map([...knownTags].sort(compareTags).map((tag, i) => [tag.id, i]));
  const progressOf = new Map(progress.map((p) => [p.parentId, p]));
  const tagIdsOf = new Map<string, string[]>();
  for (const link of links) {
    if (!order.has(link.tagId)) continue;
    const ids = tagIdsOf.get(link.taskId);
    if (ids) ids.push(link.tagId);
    else tagIdsOf.set(link.taskId, [link.tagId]);
  }
  const rankOf = (id: string) => order.get(id) ?? 0;
  return records.map((record) =>
    toTask(
      record,
      (tagIdsOf.get(record.id) ?? []).sort((a, b) => rankOf(a) - rankOf(b)),
      record.parentId === null ? (progressOf.get(record.id) ?? NO_SUBTASKS) : NO_SUBTASKS,
      countOf.get(record.id) ?? 0,
    ),
  );
}

/**
 * Builds the `Task` outputs: tag ids, sub-task progress and attachment counts come from grouped
 * queries, never per task.
 */
export function taskPresenter(tasks: TaskRepository, tags: TagRepository, attachments: AttachmentRepository) {
  return {
    /** The top-level tasks of a board detail, given the board's tags already read. */
    ofBoard: (boardId: string, records: readonly TaskRecord[], boardTags: readonly TagRecord[]): Task[] =>
      assemble(
        records,
        boardTags,
        tasks.subtaskProgressByBoard(boardId),
        tags.linksByBoard(boardId),
        attachments.countByBoard(boardId),
      ),

    /** Any tasks: only the tags their links point to are read, without counts. */
    many: (records: readonly TaskRecord[]): Task[] => {
      if (records.length === 0) return [];
      const ids = records.map((r) => r.id);
      const links = tags.linksOfTasks(ids);
      return assemble(
        records,
        tags.listByIds(links.map((link) => link.tagId)),
        tasks.subtaskProgressOf(records.filter((r) => r.parentId === null).map((r) => r.id)),
        links,
        attachments.countOf(ids),
      );
    },
  };
}

function requireTitle(raw: string): string {
  const title = normalizeTitle(raw);
  if (title === '') throw new RuleViolationError('A task needs a title');
  return title;
}

/** Stored notes back to a document; unreadable JSON (never written by Ordo) reads as no notes. */
function parseDescription(json: string | null): DocNode | null {
  if (json === null) return null;
  try {
    const doc = JSON.parse(json) as unknown;
    return typeof doc === 'object' && doc !== null && (doc as DocNode).type === 'doc'
      ? (doc as DocNode)
      : null;
  } catch {
    return null;
  }
}

const toDescriptionOutput = (id: string, doc: DocNode | null, updatedAt: number): DescriptionOutput => ({
  id,
  json: doc as DescriptionOutput['json'],
  updatedAt,
});

export function makeTaskUseCases({
  boards,
  tasks,
  columns,
  tags,
  attachments,
  tx,
  clock,
  ids,
}: TaskUseCasesDeps) {
  const present = taskPresenter(tasks, tags, attachments);
  const one = (record: TaskRecord): Task => present.many([record])[0] ?? toTask(record);

  const requireColumn = (id: string) => {
    const column = columns.findById(id);
    if (!column) throw new NotFoundError('column', id);
    return column;
  };
  /** Creation needs a sidebar board: not deleted (not found) and not archived. */
  const requireActiveBoard = (id: string) => {
    const board = boards.findById(id);
    if (!board) throw new NotFoundError('board', id);
    if (board.archivedAt !== null) throw new RuleViolationError(`Board ${id} is archived`);
    return board;
  };
  const requireTask = (id: string) => {
    const task = tasks.findById(id);
    if (!task) throw new NotFoundError('task', id);
    return task;
  };
  const requireTag = (id: string) => {
    const tag = tags.findById(id);
    if (!tag) throw new NotFoundError('tag', id);
    return tag;
  };

  const newRecord = (
    column: ColumnRecord,
    parentId: string | null,
    rank: string,
    title: string,
    now: number,
  ): TaskRecord => ({
    id: ids.next(),
    boardId: column.boardId,
    columnId: column.id,
    parentId,
    key: nextTaskKey(tasks.maxKey(column.boardId)),
    title: requireTitle(title),
    priority: DEFAULT_PRIORITY,
    startDate: null,
    dueDate: null,
    rank,
    completedAt: completionAfterMove(null, column.category === 'done', now),
    createdAt: now,
    updatedAt: now,
  });

  /** Puts a tag on a task or takes it off; `updatedAt` moves only when a link changed. */
  const changeTag = (input: TaskTagInput, change: (link: TaskTagLink) => boolean): Task =>
    tx.run(() => {
      const task = requireTask(input.taskId);
      const tag = requireTag(input.tagId);
      if (tag.boardId !== task.boardId) throw new RuleViolationError('The tag belongs to another board');
      if (!change({ taskId: task.id, tagId: tag.id })) return one(task);
      const patch = { updatedAt: clock.now() };
      tasks.update(task.id, patch);
      return one({ ...task, ...patch });
    });

  return {
    /**
     * Quick add: a task goes at the bottom of its column; a sub-task at the end of its parent's list,
     * in the board's first To-do column. Both with the default priority and a new board key.
     */
    createTask: (input: CreateTaskInput): Task =>
      tx.run(() => {
        const now = clock.now();
        if (input.parentId !== undefined) {
          const parent = requireTask(input.parentId);
          if (!canBeParent(parent)) throw new RuleViolationError('A sub-task cannot have sub-tasks');
          requireActiveBoard(parent.boardId);
          const columnId = columnForNewSubtask(columns.listByBoard(parent.boardId));
          if (columnId === null) throw new RuleViolationError('The board has no column');
          const record = newRecord(
            requireColumn(columnId),
            parent.id,
            rankAtEnd(tasks.lastSubtaskRank(parent.id)),
            input.title,
            now,
          );
          tasks.insert(record);
          return one(record);
        }
        if (input.columnId === undefined) throw new RuleViolationError('Give either columnId or parentId');
        const column = requireColumn(input.columnId);
        requireActiveBoard(column.boardId);
        const record = newRecord(
          column,
          null,
          rankAtEnd(tasks.lastRankInColumn(column.id)),
          input.title,
          now,
        );
        tasks.insert(record);
        return one(record);
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
          // A sub-task's rank is its place in the parent's list: a new status does not change it.
          if (current.parentId === null) patch.rank = rankAtEnd(tasks.lastRankInColumn(target.id));
          patch.completedAt = completionAfterMove(current.completedAt, target.category === 'done', now);
        }

        const start = patch.startDate !== undefined ? patch.startDate : current.startDate;
        const due = patch.dueDate !== undefined ? patch.dueDate : current.dueDate;
        if (!areDatesOrdered(start, due)) {
          throw new RuleViolationError('The due date cannot be before the start date');
        }

        tasks.update(current.id, patch);
        return one({ ...current, ...patch });
      }),

    /**
     * Drag and drop or ⌥/Alt + arrows: rank the task between its new neighbours in the target
     * column (one row written). Neighbours must be live top-level tasks of that column, in order.
     */
    moveTask: (input: MoveTaskInput): Task =>
      tx.run(() => {
        const current = requireTask(input.taskId);
        if (current.parentId !== null) throw new RuleViolationError('Sub-tasks are not moved on the board');
        const target = requireColumn(input.toColumnId);
        if (target.boardId !== current.boardId) {
          throw new RuleViolationError('A task cannot move to another board');
        }
        const neighbour = (id: string | null) => {
          if (id === null) return null;
          if (id === current.id) throw new RuleViolationError('A task cannot be its own neighbour');
          const task = requireTask(id);
          if (task.columnId !== target.id || task.parentId !== null) {
            throw new RuleViolationError('Neighbours must be tasks of the target column');
          }
          return task;
        };
        const before = neighbour(input.beforeId);
        const after = neighbour(input.afterId);
        if (before && after && before.rank >= after.rank) {
          throw new RuleViolationError('Neighbours are out of order');
        }
        // Rank against the true neighbours in the database: a stale client can never produce a
        // duplicate rank. "Just after `before`" wins; "just before `after`" when there is no `before`.
        const rank = before
          ? rankBetween(before.rank, tasks.adjacentRankInColumn(target.id, before.rank, 'after', current.id))
          : after
            ? rankBetween(tasks.adjacentRankInColumn(target.id, after.rank, 'before', current.id), after.rank)
            : rankAtEnd(tasks.lastRankInColumn(target.id));
        const now = clock.now();
        const patch = {
          columnId: target.id,
          rank,
          completedAt:
            target.id === current.columnId
              ? current.completedAt
              : completionAfterMove(current.completedAt, target.category === 'done', now),
          updatedAt: now,
        };
        tasks.update(current.id, patch);
        return one({ ...current, ...patch });
      }),

    /** Soft delete, with the parent's live sub-tasks; the trash (lot 8) restores or purges them. */
    deleteTask: (id: string): { id: string } =>
      tx.run(() => {
        const current = requireTask(id);
        const now = clock.now();
        if (current.parentId === null) tasks.softDeleteSubtasks(id, now);
        tasks.softDelete(id, now);
        return { id };
      }),

    /** A live task or sub-task (the detail window). */
    getTask: (id: string): Task => one(requireTask(id)),

    /** A task's live sub-tasks, in their list order. */
    listSubtasks: (parentId: string): Task[] => {
      requireTask(parentId);
      return present.many(tasks.listSubtasks(parentId));
    },

    /** Idempotent: a tag already on the task changes nothing. */
    addTag: (input: TaskTagInput): Task => changeTag(input, (link) => tags.addLink(link)),

    /** Idempotent: a tag not on the task changes nothing. */
    removeTag: (input: TaskTagInput): Task => changeTag(input, (link) => tags.removeLink(link)),

    /** The notes of a live task or sub-task (the detail window's editor). */
    getDescription: (id: string): DescriptionOutput => {
      const stored = tasks.findDescription(id);
      if (!stored) throw new NotFoundError('task', id);
      return toDescriptionOutput(id, parseDescription(stored.descriptionJson), stored.updatedAt);
    },

    /**
     * Autosave of the notes. An empty document is stored as no notes (`null`); the plain text for
     * search is always derived here from the document, never taken from the renderer.
     */
    updateDescription: (input: UpdateDescriptionInput): DescriptionOutput =>
      tx.run(() => {
        const current = requireTask(input.id);
        const doc = input.json as DocNode | null;
        const empty = isEmptyDescription(doc);
        const updatedAt = clock.now();
        tasks.update(current.id, {
          descriptionJson: empty ? null : JSON.stringify(doc),
          descriptionText: empty ? null : descriptionText(doc),
          updatedAt,
        });
        return toDescriptionOutput(current.id, empty ? null : doc, updatedAt);
      }),
  };
}

export type TaskUseCases = ReturnType<typeof makeTaskUseCases>;
