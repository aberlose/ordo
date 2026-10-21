import type {
  ArchiveBoardOutput,
  ArchivedBoard,
  BoardDetail,
  BoardSummary,
  CreateBoardInput,
  DuplicateBoardInput,
  MoveBoardInput,
  UpdateBoardInput,
} from '@ordo/contracts';
import {
  attachmentStoredPath,
  compareTags,
  DEFAULT_COLUMNS,
  descriptionText,
  remapDescriptionAttachments,
  newBoardDefaults,
  normalizeBoardName,
  rankAtEnd,
  rankBetween,
  ranksAfter,
  type DocNode,
  type Rank,
} from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import { toColumn } from './columns';
import { toTag } from './tags';
import { taskPresenter } from './tasks';
import type {
  AttachmentRecord,
  AttachmentRepository,
  AttachmentStorage,
  BoardPatch,
  BoardRepository,
  BoardWithCount,
  Clock,
  ColumnRecord,
  ColumnRepository,
  IdGenerator,
  Logger,
  TagRepository,
  TagWithCount,
  TaskRepository,
  TaskWithDescription,
  Transactor,
} from './ports';

export interface BoardUseCasesDeps {
  readonly boards: BoardRepository;
  readonly columns: ColumnRepository;
  readonly tasks: TaskRepository;
  readonly tags: TagRepository;
  readonly attachments: AttachmentRepository;
  readonly storage: AttachmentStorage;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly log: Logger;
}

function toSummary(board: BoardWithCount): BoardSummary {
  return { id: board.id, name: board.name, icon: board.icon, color: board.color, taskCount: board.taskCount };
}

function toArchived(board: BoardWithCount): ArchivedBoard {
  return { ...toSummary(board), archivedAt: board.archivedAt ?? board.updatedAt };
}

function toDetail(
  board: BoardWithCount,
  columns: readonly ColumnRecord[],
  tasks: BoardDetail['tasks'],
  tags: readonly TagWithCount[],
): BoardDetail {
  return {
    ...toSummary(board),
    columns: columns.map(toColumn),
    tasks,
    tags: [...tags].sort(compareTags).map(toTag),
  };
}

function requireName(raw: string): string {
  const name = normalizeBoardName(raw);
  if (name === '') throw new RuleViolationError('A board needs a name');
  return name;
}

/**
 * Copies of a board's live tasks for the board `boardId`: new ids, columns and parents remapped.
 * Sub-tasks whose parent is not copied (deleted or archived) are dropped; parents come first.
 * `taskIds` maps each copied task to its copy.
 */
function copyTasks(
  source: readonly TaskWithDescription[],
  boardId: string,
  columnIds: ReadonlyMap<string, string>,
  newId: () => string,
  now: number,
): { tasks: TaskWithDescription[]; taskIds: ReadonlyMap<string, string> } {
  const taskIds = new Map<string, string>();
  const copy = (task: TaskWithDescription, parentId: string | null): TaskWithDescription | null => {
    const columnId = columnIds.get(task.columnId);
    if (columnId === undefined) return null;
    const id = newId();
    taskIds.set(task.id, id);
    return { ...task, id, boardId, columnId, parentId, createdAt: now, updatedAt: now };
  };
  const parents = source.filter((t) => t.parentId === null).map((t) => copy(t, null));
  const children = source
    .filter((t) => t.parentId !== null)
    .map((t) => {
      const parentId = taskIds.get(t.parentId ?? '');
      return parentId === undefined ? null : copy(t, parentId);
    });
  const tasks = [...parents, ...children].filter((t): t is TaskWithDescription => t !== null);
  return { tasks, taskIds };
}

/**
 * A copied task's notes with their images pointing to the copied attachments; the plain text is
 * derived again. Notes that cannot be read are copied as they are.
 */
function remapNotes(
  task: TaskWithDescription,
  attachmentIds: ReadonlyMap<string, string>,
): TaskWithDescription {
  if (task.descriptionJson === null) return task;
  let doc: DocNode;
  try {
    doc = JSON.parse(task.descriptionJson) as DocNode;
  } catch {
    return task;
  }
  if (typeof doc !== 'object' || doc === null || doc.type !== 'doc') return task;
  const copy = remapDescriptionAttachments(doc, attachmentIds);
  return { ...task, descriptionJson: JSON.stringify(copy), descriptionText: descriptionText(copy) };
}

export function makeBoardUseCases({
  boards,
  columns,
  tasks,
  tags,
  attachments,
  storage,
  tx,
  clock,
  ids,
  log,
}: BoardUseCasesDeps) {
  const present = taskPresenter(tasks, tags, attachments);

  const requireBoard = (id: string) => {
    const board = boards.findById(id);
    if (!board) throw new NotFoundError('board', id);
    return board;
  };

  /** A board shown in the sidebar: live and not archived. */
  const requireActiveBoard = (id: string) => {
    const board = requireBoard(id);
    if (board.archivedAt !== null) throw new RuleViolationError(`Board ${id} is archived`);
    return board;
  };

  const getBoard = (id: string): BoardDetail => {
    const board = requireBoard(id);
    const boardTags = tags.listWithCountByBoard(id);
    return toDetail(
      board,
      columns.listByBoard(id),
      present.ofBoard(id, tasks.listTopLevelByBoard(id), boardTags),
      boardTags,
    );
  };

  const summaryOf = (id: string): BoardSummary => toSummary(requireBoard(id));

  const updateBoardRow = (id: string, patch: BoardPatch): BoardSummary => {
    boards.update(id, patch);
    return summaryOf(id);
  };

  return {
    /** The sidebar: live, non-archived boards in rank order. */
    listBoards: (): BoardSummary[] => boards.listActive().map(toSummary),

    /** The archives page: most recently archived first. */
    listArchivedBoards: (): ArchivedBoard[] => boards.listArchived().map(toArchived),

    getBoard,

    /**
     * A board with the three default columns, at the end of the sidebar, in one transaction.
     * Without an icon or colour, `newBoardDefaults` picks them (colour not used by a sidebar board).
     */
    createBoard: (input: CreateBoardInput): BoardDetail => {
      const boardId = ids.next();
      tx.run(() => {
        const now = clock.now();
        const defaults = newBoardDefaults(boards.listActive().map((b) => b.color));
        boards.insert({
          id: boardId,
          name: requireName(input.name),
          icon: input.icon ?? defaults.icon,
          color: input.color ?? defaults.color,
          rank: rankAtEnd(boards.lastRank()),
          createdAt: now,
          updatedAt: now,
        });
        const ranks = ranksAfter(null, DEFAULT_COLUMNS.length);
        columns.insertMany(
          DEFAULT_COLUMNS.map((column, i) => ({
            id: ids.next(),
            boardId,
            name: input.columnNames[i] ?? column.category,
            icon: column.icon,
            color: column.color,
            category: column.category,
            displayLimit: null,
            rank: ranks[i] ?? rankBetween(null, null),
            createdAt: now,
            updatedAt: now,
          })),
        );
      });
      return getBoard(boardId);
    },

    /** Rename, or change the icon and colour (archived boards included). */
    updateBoard: (input: UpdateBoardInput): BoardSummary =>
      tx.run(() => {
        const current = requireBoard(input.id);
        return updateBoardRow(current.id, {
          ...(input.name !== undefined ? { name: requireName(input.name) } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          updatedAt: clock.now(),
        });
      }),

    /**
     * Drag and drop or ⌥/Alt + arrows in the sidebar: rank the board between its new neighbours
     * (one row written). The board and its neighbours must be sidebar boards, in order.
     */
    moveBoard: (input: MoveBoardInput): BoardSummary =>
      tx.run(() => {
        const current = requireActiveBoard(input.boardId);
        const neighbour = (id: string | null) => {
          if (id === null) return null;
          if (id === current.id) throw new RuleViolationError('A board cannot be its own neighbour');
          return requireActiveBoard(id);
        };
        const before = neighbour(input.beforeId);
        const after = neighbour(input.afterId);
        if (before && after && before.rank >= after.rank) {
          throw new RuleViolationError('Neighbours are out of order');
        }
        // Rank against the true neighbours in the database (archived and deleted boards keep their
        // ranks in the gaps): "just after `before`" wins; "just before `after`" when there is no `before`.
        let rank: Rank;
        if (before) rank = rankBetween(before.rank, boards.adjacentRank(before.rank, 'after', current.id));
        else if (after) rank = rankBetween(boards.adjacentRank(after.rank, 'before', current.id), after.rank);
        else throw new RuleViolationError('A move needs at least one neighbour');
        return updateBoardRow(current.id, { rank, updatedAt: clock.now() });
      }),

    /**
     * Copies a sidebar board (archived ones cannot be) right after the original: icon, colour, live
     * columns with their settings and tags always; with `includeTasks`, the live tasks and their
     * live sub-tasks (keys kept: they are unique per board) with their tags, attachments and notes.
     *
     * Order: (1) read a snapshot of the original in one transaction; (2) copy the attachment files
     * outside any transaction (asynchronous, possibly long); (3) write every row in one transaction,
     * after checking the board is still a sidebar board. The database thus never points to a file that
     * is not there; if step 3 fails, the copied files are removed. A file that cannot be copied is
     * skipped: its images in the copied notes point to an id without a row and show as deleted.
     */
    duplicateBoard: async (input: DuplicateBoardInput): Promise<BoardSummary> => {
      const name = requireName(input.name);
      const now = clock.now();
      const boardId = ids.next();
      const snapshot = tx.run(() => {
        const original = requireActiveBoard(input.id);
        const columnIds = new Map<string, string>();
        const columnCopies = columns.listByBoard(original.id).map((column) => {
          const id = ids.next();
          columnIds.set(column.id, id);
          return { ...column, id, boardId, createdAt: now, updatedAt: now };
        });
        const tagIds = new Map<string, string>();
        const tagCopies = tags.listByBoard(original.id).map((tag) => {
          const id = ids.next();
          tagIds.set(tag.id, id);
          return { id, boardId, name: tag.name, color: tag.color };
        });
        if (!input.includeTasks) {
          return { original, columnCopies, tagCopies, taskCopies: [], links: [], files: [] };
        }
        const copied = copyTasks(
          tasks.listLiveWithDescriptionByBoard(original.id),
          boardId,
          columnIds,
          () => ids.next(),
          now,
        );
        const links = tags.linksByBoard(original.id).flatMap((link) => {
          const taskId = copied.taskIds.get(link.taskId);
          const tagId = tagIds.get(link.tagId);
          return taskId === undefined || tagId === undefined ? [] : [{ taskId, tagId }];
        });
        const files = attachments.listByTasks([...copied.taskIds.keys()]).map((source) => ({
          source,
          taskId: copied.taskIds.get(source.taskId) ?? source.taskId,
          id: ids.next(),
        }));
        return { original, columnCopies, tagCopies, taskCopies: copied.tasks, links, files };
      });

      // Every image of a copied note points to a new id: the copy, or an id without a row when the
      // file could not be copied (never back to the original board's file).
      const attachmentIds = new Map<string, string>();
      const attachmentCopies: AttachmentRecord[] = [];
      for (const { source, taskId, id } of snapshot.files) {
        attachmentIds.set(source.id, id);
        const storedPath = attachmentStoredPath(id, source.fileName);
        try {
          const sizeBytes = await storage.copyStored(source.storedPath, storedPath);
          // The original's date keeps the copies in the same order (oldest first).
          attachmentCopies.push({ ...source, id, taskId, storedPath, sizeBytes });
        } catch (error) {
          log.warn(`[boards] could not copy the file of attachment ${source.id}`, error);
        }
      }

      try {
        tx.run(() => {
          const original = requireActiveBoard(snapshot.original.id);
          boards.insert({
            id: boardId,
            name,
            icon: original.icon,
            color: original.color,
            rank: rankBetween(original.rank, boards.adjacentRank(original.rank, 'after', original.id)),
            createdAt: now,
            updatedAt: now,
          });
          columns.insertMany(snapshot.columnCopies);
          tags.insertMany(snapshot.tagCopies);
          tasks.insertMany(snapshot.taskCopies.map((task) => remapNotes(task, attachmentIds)));
          tags.insertLinks(snapshot.links);
          attachments.insertMany(attachmentCopies);
        });
      } catch (error) {
        await Promise.all(
          attachmentCopies.map((copy) =>
            storage.remove(copy.storedPath).catch((cleanup: unknown) => {
              log.warn(`[boards] could not remove ${copy.storedPath}`, cleanup);
            }),
          ),
        );
        throw error;
      }
      return summaryOf(boardId);
    },

    /** Reversible, no confirmation: the board leaves the sidebar. Archiving twice keeps the first date. */
    archiveBoard: (id: string): ArchiveBoardOutput =>
      tx.run(() => {
        const current = requireBoard(id);
        if (current.archivedAt !== null) return { id, archivedAt: current.archivedAt };
        const now = clock.now();
        boards.update(id, { archivedAt: now, updatedAt: now });
        return { id, archivedAt: now };
      }),

    /** A restored board goes back to the end of the sidebar. Restoring a sidebar board changes nothing. */
    restoreBoard: (id: string): BoardSummary =>
      tx.run(() => {
        const current = requireBoard(id);
        if (current.archivedAt === null) return toSummary(current);
        return updateBoardRow(id, {
          archivedAt: null,
          rank: rankAtEnd(boards.lastRank()),
          updatedAt: clock.now(),
        });
      }),
  };
}

export type BoardUseCases = ReturnType<typeof makeBoardUseCases>;
