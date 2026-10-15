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
  DEFAULT_COLUMNS,
  newBoardDefaults,
  normalizeBoardName,
  rankAtEnd,
  rankBetween,
  ranksAfter,
  type Rank,
} from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import { toColumn } from './columns';
import { toTask } from './tasks';
import type {
  BoardPatch,
  BoardRepository,
  BoardWithCount,
  Clock,
  ColumnRecord,
  ColumnRepository,
  IdGenerator,
  TaskRecord,
  TaskRepository,
  TaskWithDescription,
  Transactor,
} from './ports';

export interface BoardUseCasesDeps {
  readonly boards: BoardRepository;
  readonly columns: ColumnRepository;
  readonly tasks: TaskRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
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
  tasks: readonly TaskRecord[],
): BoardDetail {
  return {
    ...toSummary(board),
    columns: columns.map(toColumn),
    tasks: tasks.map(toTask),
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
 */
function copyTasks(
  source: readonly TaskWithDescription[],
  boardId: string,
  columnIds: ReadonlyMap<string, string>,
  newId: () => string,
  now: number,
): TaskWithDescription[] {
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
  return [...parents, ...children].filter((t): t is TaskWithDescription => t !== null);
}

export function makeBoardUseCases({ boards, columns, tasks, tx, clock, ids }: BoardUseCasesDeps) {
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

  const getBoard = (id: string): BoardDetail =>
    toDetail(requireBoard(id), columns.listByBoard(id), tasks.listTopLevelByBoard(id));

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
     * Copies a sidebar board (archived ones cannot be) right after the original: icon, colour and live columns with their settings
     * always; with `includeTasks`, the live tasks and their live sub-tasks (keys kept: they are
     * unique per board). Everything in one transaction.
     */
    duplicateBoard: (input: DuplicateBoardInput): BoardSummary =>
      tx.run(() => {
        const original = requireActiveBoard(input.id);
        const now = clock.now();
        const boardId = ids.next();
        boards.insert({
          id: boardId,
          name: requireName(input.name),
          icon: original.icon,
          color: original.color,
          rank: rankBetween(original.rank, boards.adjacentRank(original.rank, 'after', original.id)),
          createdAt: now,
          updatedAt: now,
        });
        const columnIds = new Map<string, string>();
        columns.insertMany(
          columns.listByBoard(original.id).map((column) => {
            const id = ids.next();
            columnIds.set(column.id, id);
            return { ...column, id, boardId, createdAt: now, updatedAt: now };
          }),
        );
        if (input.includeTasks) {
          // Tags and attachments are not in use yet (lots 5–6): copy them here once they are.
          const source = tasks.listLiveWithDescriptionByBoard(original.id);
          tasks.insertMany(copyTasks(source, boardId, columnIds, () => ids.next(), now));
        }
        return summaryOf(boardId);
      }),

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
