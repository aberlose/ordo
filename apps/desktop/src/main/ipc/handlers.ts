import type { AppInfo } from '@ordo/contracts';
import type { BoardUseCases } from '../application/boards';
import type { TaskUseCases } from '../application/tasks';
import type { Handlers } from './handle';

export function createHandlers(boards: BoardUseCases, tasks: TaskUseCases, appInfo: () => AppInfo): Handlers {
  return {
    'app.info': () => appInfo(),
    'boards.list': () => boards.listBoards(),
    'boards.get': ({ id }) => boards.getBoard(id),
    'boards.create': (input) => boards.createBoard(input),
    'tasks.create': (input) => tasks.createTask(input),
    'tasks.update': (input) => tasks.updateTask(input),
    'tasks.delete': ({ id }) => tasks.deleteTask(id),
  };
}
