import type { AppInfo } from '@ordo/contracts';
import type { BoardUseCases } from '../application/boards';
import type { ColumnUseCases } from '../application/columns';
import type { TaskUseCases } from '../application/tasks';
import type { Handlers } from './handle';

export function createHandlers(
  boards: BoardUseCases,
  tasks: TaskUseCases,
  columns: ColumnUseCases,
  appInfo: () => AppInfo,
): Handlers {
  return {
    'app.info': () => appInfo(),
    'boards.list': () => boards.listBoards(),
    'boards.get': ({ id }) => boards.getBoard(id),
    'boards.create': (input) => boards.createBoard(input),
    'boards.update': (input) => boards.updateBoard(input),
    'boards.move': (input) => boards.moveBoard(input),
    'boards.duplicate': (input) => boards.duplicateBoard(input),
    'boards.archive': ({ id }) => boards.archiveBoard(id),
    'boards.restore': ({ id }) => boards.restoreBoard(id),
    'boards.listArchived': () => boards.listArchivedBoards(),
    'tasks.create': (input) => tasks.createTask(input),
    'tasks.update': (input) => tasks.updateTask(input),
    'tasks.delete': ({ id }) => tasks.deleteTask(id),
    'tasks.move': (input) => tasks.moveTask(input),
    'columns.move': (input) => columns.moveColumn(input),
    'columns.create': (input) => columns.createColumn(input),
    'columns.update': (input) => columns.updateColumn(input),
    'columns.delete': ({ id }) => columns.deleteColumn(id),
  };
}
