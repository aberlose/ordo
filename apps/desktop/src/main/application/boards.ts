import type { BoardDetail, BoardSummary, CreateBoardInput } from '@ordo/contracts';
import { DEFAULT_COLUMNS, rankBetween, ranksAfter } from '@ordo/domain';
import { NotFoundError } from './errors';
import { toColumn } from './columns';
import { toTask } from './tasks';
import type {
  BoardRepository,
  BoardWithCount,
  Clock,
  ColumnRecord,
  ColumnRepository,
  IdGenerator,
  TaskRecord,
  TaskRepository,
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

export function makeBoardUseCases({ boards, columns, tasks, tx, clock, ids }: BoardUseCasesDeps) {
  const getBoard = (id: string): BoardDetail => {
    const board = boards.findById(id);
    if (!board) throw new NotFoundError('board', id);
    return toDetail(board, columns.listByBoard(id), tasks.listTopLevelByBoard(id));
  };

  return {
    listBoards: (): BoardSummary[] => boards.listActive().map(toSummary),

    getBoard,

    /** Creates a board with the three default columns, in one transaction. */
    createBoard: (input: CreateBoardInput): BoardDetail => {
      const now = clock.now();
      const boardId = ids.next();
      tx.run(() => {
        boards.insert({
          id: boardId,
          name: input.name,
          icon: null,
          color: null,
          rank: rankBetween(boards.lastRank(), null),
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
  };
}

export type BoardUseCases = ReturnType<typeof makeBoardUseCases>;
