import type { AppInfo } from '@ordo/contracts';
import type { BoardUseCases } from '../application/boards';
import type { Handlers } from './handle';

export function createHandlers(boards: BoardUseCases, appInfo: () => AppInfo): Handlers {
  return {
    'app.info': () => appInfo(),
    'boards.list': () => boards.listBoards(),
    'boards.get': ({ id }) => boards.getBoard(id),
    'boards.create': (input) => boards.createBoard(input),
  };
}
