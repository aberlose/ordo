import type { AppInfo } from '@ordo/contracts';
import type { AttachmentUseCases } from '../application/attachments';
import type { BoardUseCases } from '../application/boards';
import type { ColumnUseCases } from '../application/columns';
import type { SearchUseCases } from '../application/search';
import type { TagUseCases } from '../application/tags';
import type { TaskUseCases } from '../application/tasks';
import type { Handlers } from './handle';

export function createHandlers(
  boards: BoardUseCases,
  tasks: TaskUseCases,
  columns: ColumnUseCases,
  tags: TagUseCases,
  attachments: AttachmentUseCases,
  search: SearchUseCases,
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
    'tasks.get': ({ id }) => tasks.getTask(id),
    'tasks.listSubtasks': ({ parentId }) => tasks.listSubtasks(parentId),
    'tasks.addTag': (input) => tasks.addTag(input),
    'tasks.removeTag': (input) => tasks.removeTag(input),
    'tasks.getDescription': ({ id }) => tasks.getDescription(id),
    'tasks.updateDescription': (input) => tasks.updateDescription(input),
    'attachments.list': ({ taskId }) => attachments.listAttachments(taskId),
    'attachments.add': (input) => attachments.addAttachments(input),
    'attachments.pick': ({ taskId }) => attachments.pickAttachments(taskId),
    'attachments.addData': (input) => attachments.addAttachmentData(input),
    'attachments.open': ({ id }) => attachments.openAttachment(id),
    'attachments.reveal': ({ id }) => attachments.revealAttachment(id),
    'attachments.delete': ({ id }) => attachments.deleteAttachment(id),
    'tags.create': (input) => tags.createTag(input),
    'tags.update': (input) => tags.updateTag(input),
    'tags.delete': ({ id }) => tags.deleteTag(id),
    'columns.move': (input) => columns.moveColumn(input),
    'columns.create': (input) => columns.createColumn(input),
    'columns.update': (input) => columns.updateColumn(input),
    'columns.delete': ({ id }) => columns.deleteColumn(id),
    'search.boardTaskIds': (input) => search.searchBoardTaskIds(input),
    'search.tasks': (input) => search.searchTasks(input),
    'recent.list': () => search.listRecent(),
    'recent.record': ({ taskId }) => search.recordRecent(taskId),
  };
}
