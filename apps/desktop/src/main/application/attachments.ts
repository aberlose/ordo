import {
  attachmentUrl,
  type AddAttachmentsOutput,
  type Attachment,
  type Input,
  type OpenAttachmentOutput,
} from '@ordo/contracts';
import {
  attachmentStoredPath,
  fileExtension,
  isExecutableAttachment,
  normalizeAttachmentName,
} from '@ordo/domain';
import { InvalidInputError, NotFoundError, RuleViolationError } from './errors';
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

/**
 * What can be pasted as bytes: raster images the notes can show. SVG is excluded (it can carry
 * scripts and links); anything else must be dropped or picked as a file.
 */
const PASTABLE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
]);

/** Files of the attachments folder without a row are removed at startup once they are this old. */
export const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Why a source path given by the renderer is refused, `null` when it may be read. Device namespaces
 * (`\\?\`, `\\.\`) are never read (pipes, raw devices); network shares (`\\server\share`,
 * `//server/share`) only when the user picked them in the native dialog.
 */
export function sourcePathProblem(path: string, allowNetwork: boolean): string | null {
  const windowsStyle = path.replace(/\//g, '\\');
  if (/^\\\\[?.](\\|$)/.test(windowsStyle) || windowsStyle.startsWith('\\??\\')) {
    return 'Device paths are not supported';
  }
  if (windowsStyle.startsWith('\\\\') && !allowNetwork) return 'Network paths are not supported';
  return null;
}

/** `name` with its extension replaced by (or extended with) `ext`. */
function withExtension(name: string, ext: string, fallback: string): string {
  const current = fileExtension(name);
  const base = current === '' ? name : name.slice(0, name.length - current.length - 1);
  return normalizeAttachmentName(`${base}.${ext}`, fallback);
}

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
    /** The name the stored extension comes from (the display name unless told otherwise). */
    storedExtensionFrom: string = fileName,
  ): Promise<AttachmentRecord> => {
    const id = ids.next();
    const storedPath = attachmentStoredPath(id, storedExtensionFrom);
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

  /**
   * One file per path, in order; a file that cannot be added is reported, the others still go.
   * `allowNetwork`: network shares are read only when the user picked them in the native dialog.
   */
  const addPaths = async (
    taskId: string,
    paths: readonly string[],
    allowNetwork: boolean,
  ): Promise<AddAttachmentsOutput> => {
    requireWritableTask(taskId);
    const output: AddAttachmentsOutput = { attachments: [], failures: [] };
    for (const path of paths) {
      const fileName = normalizeAttachmentName(path, FALLBACK_NAME);
      try {
        const problem = sourcePathProblem(path, allowNetwork);
        if (problem !== null) throw new Error(problem);
        // A cheap first look for a clear message; `importFile` checks the opened handle again.
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
      addPaths(input.taskId, input.paths, false),

    /** The native file dialog, then the same as a drop; nothing happens when it is cancelled. */
    pickAttachments: async (taskId: string): Promise<AddAttachmentsOutput> => {
      requireWritableTask(taskId);
      const paths = await shell.pickFiles();
      if (paths.length === 0) return { attachments: [], failures: [] };
      return addPaths(taskId, paths, true);
    },

    /**
     * A pasted image (bytes, no file on disk): PNG, JPEG, GIF, WebP, AVIF or BMP only. The stored
     * extension always comes from the mime type; the given name is for display only, and gets the
     * type's extension when its own does not match (`image.<ext>` without a usable name).
     */
    addAttachmentData: async (input: Input<'attachments.addData'>): Promise<Attachment> => {
      const mimeType = input.mimeType.trim().toLowerCase();
      const ext = PASTABLE_IMAGE_TYPES.has(mimeType) ? storage.extensionOf(mimeType) : null;
      if (ext === null) {
        throw new InvalidInputError('Only PNG, JPEG, GIF, WebP, AVIF or BMP images can be pasted');
      }
      requireWritableTask(input.taskId);
      const fallback = `image.${ext}`;
      let fileName = normalizeAttachmentName(input.fileName, fallback);
      if (storage.mimeTypeOf(fileName) !== mimeType) fileName = withExtension(fileName, ext, fallback);
      const record = await store(
        input.taskId,
        fileName,
        mimeType,
        (storedPath) => storage.writeData(storedPath, input.bytes),
        `${FALLBACK_NAME}.${ext}`,
      );
      return toAttachment(record);
    },

    /**
     * Opens the file with its default application; the system's error is reported as a conflict.
     * Programs and scripts (by display name or stored extension) are never run: they are shown in
     * the Finder / Explorer instead, and `opened` is `false`.
     */
    openAttachment: async (id: string): Promise<OpenAttachmentOutput> => {
      const { record, absolutePath } = await requireFile(id);
      if (isExecutableAttachment(record.fileName) || isExecutableAttachment(record.storedPath)) {
        shell.showItemInFolder(absolutePath);
        return { opened: false };
      }
      const error = await shell.openPath(absolutePath);
      if (error !== '') throw new RuleViolationError(`Could not open ${record.fileName}: ${error}`);
      return { opened: true };
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
     * Startup housekeeping: removes the files of the attachments folder that no row points to (a
     * crash between copying a file and inserting its row, a removal that failed) once they are older
     * than `ORPHAN_MIN_AGE_MS`, so a copy in progress is never touched. Returns how many went.
     */
    sweepOrphanFiles: async (): Promise<number> => {
      const now = clock.now();
      const old = (await storage.listStored()).filter((f) => now - f.modifiedAt >= ORPHAN_MIN_AGE_MS);
      if (old.length === 0) return 0;
      const known = new Set(attachments.listStoredPaths());
      let removed = 0;
      for (const file of old) {
        if (known.has(file.storedPath)) continue;
        try {
          if (await storage.remove(file.storedPath)) removed += 1;
        } catch (error) {
          log.warn(`[attachments] could not remove the orphan file ${file.storedPath}`, error);
        }
      }
      return removed;
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
