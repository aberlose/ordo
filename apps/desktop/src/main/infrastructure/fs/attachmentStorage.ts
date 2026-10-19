import { createReadStream } from 'node:fs';
import { mkdir, open, stat, unlink, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { AttachmentStorage } from '../../application/ports';
import { extensionOf, mimeTypeOf } from './mimeTypes';

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
const isMissing = (error: unknown) => codeOf(error) === 'ENOENT';

/**
 * Attachment files in `folder` (`<userData>/attachments/`), created on first write. Stored paths are
 * flat names built from the attachment id (`attachmentStoredPath`): anything that would resolve
 * outside the folder is refused. New files are created exclusively (`wx`): never overwrite one.
 */
export function attachmentStorage(folder: string): AttachmentStorage {
  const root = resolve(folder);
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
   * Streams a file into a new stored file: big files are never read whole into memory. The write
   * stream closes the handle itself (closing it again is harmless).
   */
  const streamInto = (from: string, storedPath: string) =>
    createStored(storedPath, (handle) => pipeline(createReadStream(from), handle.createWriteStream()));

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

    importFile: (sourcePath, storedPath) => streamInto(sourcePath, storedPath),

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
  };
}
