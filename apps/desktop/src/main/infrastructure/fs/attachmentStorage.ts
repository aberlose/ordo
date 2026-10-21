import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
  type FileHandle,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { AttachmentStorage, StoredFileInfo } from '../../application/ports';
import { extensionOf, mimeTypeOf } from './mimeTypes';

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
const isMissing = (error: unknown) => codeOf(error) === 'ENOENT';

/**
 * Opening a FIFO for reading blocks until a writer shows up: `O_NONBLOCK` makes `open` return at once
 * so the handle can be checked (it has no effect on regular files). Not defined on Windows, where
 * device and pipe paths are refused before reaching the storage.
 */
const OPEN_SOURCE_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);

/** Windows' "downloaded from the internet" mark (Mark of the Web) is an alternate data stream. */
export const ZONE_IDENTIFIER_STREAM = ':Zone.Identifier';
/** A Zone.Identifier is a few lines of text; anything bigger is not one and is not carried over. */
const ZONE_IDENTIFIER_MAX_BYTES = 64 * 1024;

/** File reads and writes used to carry the download mark (replaced in tests). */
export interface DownloadMarkIo {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array): Promise<void>;
}

const nodeMarkIo: DownloadMarkIo = {
  read: (path) => readFile(path),
  write: (path, data) => writeFile(path, data, { flag: 'wx' }),
};

/**
 * Best effort: copies the system's "downloaded from the internet" mark of `from` onto `to`, so a
 * file attached from the Downloads folder keeps its warnings when opened later. Never throws.
 *
 * - Windows: the `:Zone.Identifier` alternate data stream, read and written with plain fs calls
 *   (NTFS only; on FAT/exFAT or network volumes without streams there is nothing to carry).
 * - macOS: the `com.apple.quarantine` extended attribute cannot be carried: Node has no xattr API,
 *   and its `fs.copyFile` / `fs.cp` (libuv) copy data, mode and times only, never xattrs.
 * - Linux: no such mark.
 *
 * Returns whether a mark was written.
 */
export async function copyDownloadMark(
  from: string,
  to: string,
  platform: NodeJS.Platform,
  io: DownloadMarkIo = nodeMarkIo,
): Promise<boolean> {
  if (platform !== 'win32') return false;
  try {
    const mark = await io.read(`${from}${ZONE_IDENTIFIER_STREAM}`);
    if (mark.byteLength === 0 || mark.byteLength > ZONE_IDENTIFIER_MAX_BYTES) return false;
    await io.write(`${to}${ZONE_IDENTIFIER_STREAM}`, mark);
    return true;
  } catch {
    // No mark (the usual case), no stream support on the volume, or a write refused: not an error.
    return false;
  }
}

export interface AttachmentStorageOptions {
  /** Which download mark to carry over (tests force `win32` on Linux). */
  readonly platform?: NodeJS.Platform;
  readonly markIo?: DownloadMarkIo;
}

/**
 * Attachment files in `folder` (`<userData>/attachments/`), created on first write. Stored paths are
 * flat names built from the attachment id (`attachmentStoredPath`): anything that would resolve
 * outside the folder is refused. New files are created exclusively (`wx`): never overwrite one.
 */
export function attachmentStorage(folder: string, options: AttachmentStorageOptions = {}): AttachmentStorage {
  const root = resolve(folder);
  const platform = options.platform ?? process.platform;
  const markIo = options.markIo ?? nodeMarkIo;
  // Cheap and idempotent: the folder may have been removed by hand since the last write.
  const ensureFolder = () => mkdir(root, { recursive: true });

  const absolutePath = (storedPath: string): string => {
    const target = resolve(root, storedPath);
    const rel = relative(root, target);
    if (
      storedPath === '' ||
      isAbsolute(storedPath) ||
      rel === '' ||
      rel.startsWith('..') ||
      isAbsolute(rel) ||
      rel.includes(sep)
    ) {
      throw new Error(`Stored path outside the attachments folder: ${storedPath}`);
    }
    return target;
  };

  /**
   * Creates a new stored file exclusively (`wx`: an existing file is never touched) and fills it;
   * if filling fails, the partial file is removed. Returns the stored size.
   */
  const createStored = async (storedPath: string, fill: (handle: FileHandle) => Promise<void>) => {
    await ensureFolder();
    const target = absolutePath(storedPath);
    const handle = await open(target, 'wx');
    try {
      await fill(handle);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await unlink(target).catch(() => undefined);
      throw error;
    }
    await handle.close().catch(() => undefined);
    return (await stat(target)).size;
  };

  /**
   * Opens `from`, checks the opened handle is a regular file (no stat-then-open race: a path swapped
   * for a FIFO or a device is refused, not read), then streams it into a new stored file (big files
   * are never read whole into memory) and carries its download mark over.
   */
  const streamInto = async (from: string, storedPath: string) => {
    const source = await open(from, OPEN_SOURCE_FLAGS);
    let size: number;
    try {
      if (!(await source.stat()).isFile()) throw new Error('Not a file');
      size = await createStored(storedPath, (target) =>
        pipeline(source.createReadStream({ autoClose: false }), target.createWriteStream()),
      );
    } finally {
      await source.close().catch(() => undefined);
    }
    await copyDownloadMark(from, absolutePath(storedPath), platform, markIo);
    return size;
  };

  return {
    inspect: async (sourcePath) => {
      if (!isAbsolute(sourcePath)) return { kind: 'missing' };
      try {
        const info = await stat(sourcePath);
        return info.isFile() ? { kind: 'file', size: info.size } : { kind: 'not-a-file' };
      } catch (error) {
        if (isMissing(error)) return { kind: 'missing' };
        throw error;
      }
    },

    importFile: (sourcePath, storedPath) => {
      if (!isAbsolute(sourcePath)) return Promise.reject(new Error('File not found'));
      return streamInto(sourcePath, storedPath);
    },

    writeData: (storedPath, bytes) => createStored(storedPath, (handle) => handle.writeFile(bytes)),

    copyStored: (fromStoredPath, toStoredPath) => streamInto(absolutePath(fromStoredPath), toStoredPath),

    remove: async (storedPath) => {
      try {
        await unlink(absolutePath(storedPath));
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },

    absolutePath,

    exists: async (storedPath) => {
      try {
        return (await stat(absolutePath(storedPath))).isFile();
      } catch {
        return false;
      }
    },

    mimeTypeOf,
    extensionOf,

    listStored: async () => {
      let entries;
      try {
        entries = await readdir(root, { withFileTypes: true });
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      const files: StoredFileInfo[] = [];
      for (const entry of entries) {
        // Hidden files (`.DS_Store`…) and anything that is not a plain file are not ours to judge.
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        try {
          const info = await lstat(join(root, entry.name));
          if (info.isFile()) files.push({ storedPath: entry.name, modifiedAt: info.mtimeMs });
        } catch {
          // Gone since the listing.
        }
      }
      return files;
    },
  };
}
