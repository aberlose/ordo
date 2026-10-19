import { attachmentUrl, type AddAttachmentsOutput, type Attachment, type Input } from '@ordo/contracts';
import { attachmentStoredPath, fileExtension, normalizeAttachmentName } from '@ordo/domain';
import { NotFoundError, RuleViolationError } from './errors';
import type {
  AttachmentRecord,
  AttachmentRepository,
  AttachmentStorage,
  BoardRepository,
  Clock,
  DesktopShell,
  IdGenerator,
  Logger,
  TaskRepository,
  Transactor,
} from './ports';

export interface AttachmentUseCasesDeps {
  readonly boards: BoardRepository;
  readonly tasks: TaskRepository;
  readonly attachments: AttachmentRepository;
  readonly storage: AttachmentStorage;
  readonly shell: DesktopShell;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly log: Logger;
}

/** Display name of a file that has none left after normalisation. */
const FALLBACK_NAME = 'file';
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export function toAttachment(record: AttachmentRecord): Attachment {
  return {
    id: record.id,
    taskId: record.taskId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes ?? 0,
    createdAt: record.createdAt,
    url: attachmentUrl(record.id),
  };
}

/** Why one file of a drop could not be added (shown on the red tile). */
function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return 'Could not copy the file';
}

/** The file to serve for `ordo-file://attachment/<id>`. */
export interface ServedFile {
  readonly absolutePath: string;
  readonly mimeType: string | null;
}

export function makeAttachmentUseCases({
  boards,
  tasks,
  attachments,
  storage,
  shell,
  tx,
  clock,
  ids,
  log,
}: AttachmentUseCasesDeps) {
  const requireTask = (id: string) => {
    const task = tasks.findById(id);
    if (!task) throw new NotFoundError('task', id);
    return task;
  };
  /** Adding files follows task creation: a live task on a sidebar board (not archived). */
  const requireWritableTask = (id: string) => {
    const task = requireTask(id);
    const board = boards.findById(task.boardId);
    if (!board) throw new NotFoundError('board', task.boardId);
    if (board.archivedAt !== null) throw new RuleViolationError(`Board ${board.id} is archived`);
    return task;
  };
  const requireAttachment = (id: string) => {
    const record = attachments.findById(id);
    if (!record) throw new NotFoundError('attachment', id);
    return record;
  };
  /** The stored file of an attachment, which must still be on disk. */
  const requireFile = async (id: string) => {
    const record = requireAttachment(id);
    if (!(await storage.exists(record.storedPath))) throw new NotFoundError('attachment file', id);
    return { record, absolutePath: storage.absolutePath(record.storedPath) };
  };

  const removeQuietly = async (storedPath: string) => {
    try {
      await storage.remove(storedPath);
    } catch (error) {
      log.warn(`[attachments] could not remove ${storedPath}`, error);
    }
  };

  /**
   * The file is written first (outside the transaction: it is asynchronous), then the row is inserted
   * after checking the task again. If the row cannot be written, the copied file is removed.
   */
  const store = async (
    taskId: string,
    fileName: string,
    mimeType: string | null,
    write: (storedPath: string) => Promise<number>,
  ): Promise<AttachmentRecord> => {
    const id = ids.next();
    const storedPath = attachmentStoredPath(id, fileName);
    const sizeBytes = await write(storedPath);
    try {
      return tx.run(() => {
        requireWritableTask(taskId);
        const record: AttachmentRecord = {
          id,
          taskId,
          fileName,
          storedPath,
          mimeType,
          sizeBytes,
          createdAt: clock.now(),
        };
        attachments.insert(record);
        return record;
      });
    } catch (error) {
      await removeQuietly(storedPath);
      throw error;
    }
  };

  /** One file per path, in order; a file that cannot be added is reported, the others still go. */
  const addPaths = async (taskId: string, paths: readonly string[]): Promise<AddAttachmentsOutput> => {
    requireWritableTask(taskId);
    const output: AddAttachmentsOutput = { attachments: [], failures: [] };
    for (const path of paths) {
      const fileName = normalizeAttachmentName(path, FALLBACK_NAME);
      try {
        const source = await storage.inspect(path);
        if (source.kind === 'missing') throw new Error('File not found');
        if (source.kind === 'not-a-file') throw new Error('Not a file');
        const record = await store(taskId, fileName, storage.mimeTypeOf(fileName), (storedPath) =>
          storage.importFile(path, storedPath),
        );
        output.attachments.push(toAttachment(record));
      } catch (error) {
        // The task went away (or its board was archived) while copying: the whole call fails.
        if (error instanceof NotFoundError || error instanceof RuleViolationError) throw error;
        log.warn(`[attachments] could not add ${path}`, error);
        output.failures.push({ path, fileName, message: failureMessage(error) });
      }
    }
    return output;
  };

  return {
    /** A live task's files, oldest first. */
    listAttachments: (taskId: string): Attachment[] => {
      requireTask(taskId);
      return attachments.listByTask(taskId).map(toAttachment);
    },

    /** Files dropped on the window, by absolute path. */
    addAttachments: (input: { taskId: string; paths: readonly string[] }): Promise<AddAttachmentsOutput> =>
      addPaths(input.taskId, input.paths),

    /** The native file dialog, then the same as a drop; nothing happens when it is cancelled. */
    pickAttachments: async (taskId: string): Promise<AddAttachmentsOutput> => {
      requireWritableTask(taskId);
      const paths = await shell.pickFiles();
      if (paths.length === 0) return { attachments: [], failures: [] };
      return addPaths(taskId, paths);
    },

    /**
     * A pasted image (bytes, no file on disk). Without a usable name it is called `image.<ext>` (or
     * `file.<ext>`) after its mime type; the extension is added when the name has none.
     */
    addAttachmentData: async (input: Input<'attachments.addData'>): Promise<Attachment> => {
      requireWritableTask(input.taskId);
      const declared = input.mimeType.trim().toLowerCase();
      const validDeclared = MIME_TYPE.test(declared) ? declared : null;
      const ext = validDeclared === null ? null : storage.extensionOf(validDeclared);
      const fallback =
        ext === null
          ? FALLBACK_NAME
          : `${validDeclared?.startsWith('image/') ? 'image' : FALLBACK_NAME}.${ext}`;
      let fileName = normalizeAttachmentName(input.fileName, fallback);
      if (fileExtension(fileName) === '' && ext !== null) {
        fileName = normalizeAttachmentName(`${fileName}.${ext}`, fallback);
      }
      const record = await store(
        input.taskId,
        fileName,
        storage.mimeTypeOf(fileName) ?? validDeclared,
        (storedPath) => storage.writeData(storedPath, input.bytes),
      );
      return toAttachment(record);
    },

    /** Opens the file with its default application; the system's error is reported as a conflict. */
    openAttachment: async (id: string): Promise<Record<string, never>> => {
      const { record, absolutePath } = await requireFile(id);
      const error = await shell.openPath(absolutePath);
      if (error !== '') throw new RuleViolationError(`Could not open ${record.fileName}: ${error}`);
      return {};
    },

    /** Shows the file in the Finder / Explorer. */
    revealAttachment: async (id: string): Promise<Record<string, never>> => {
      const { absolutePath } = await requireFile(id);
      shell.showItemInFolder(absolutePath);
      return {};
    },

    /**
     * Permanent: the row goes in a transaction, then the file is removed after the commit (a file
     * already gone is only logged). A trashed task keeps its files: only this removes them.
     */
    deleteAttachment: async (id: string): Promise<{ id: string }> => {
      const record = tx.run(() => {
        const current = requireAttachment(id);
        attachments.delete(id);
        return current;
      });
      try {
        if (!(await storage.remove(record.storedPath))) {
          log.warn(`[attachments] file of ${id} was already gone`);
        }
      } catch (error) {
        log.warn(`[attachments] could not remove the file of ${id}`, error);
      }
      return { id };
    },

    /**
     * The file behind `ordo-file://attachment/<id>`: only the database's stored path, resolved inside
     * the attachments folder; `null` for an unknown attachment or a path that would escape.
     */
    servedFile: (id: string): ServedFile | null => {
      const record = attachments.findById(id);
      if (!record) return null;
      try {
        return { absolutePath: storage.absolutePath(record.storedPath), mimeType: record.mimeType };
      } catch {
        return null;
      }
    },
  };
}

export type AttachmentUseCases = ReturnType<typeof makeAttachmentUseCases>;
