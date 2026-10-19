import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachmentStorage, copyDownloadMark, type DownloadMarkIo } from './attachmentStorage';
import { extensionOf, mimeTypeOf } from './mimeTypes';

let dir: string;
let folder: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ordo-storage-'));
  folder = join(dir, 'userData', 'attachments');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('attachment storage', () => {
  it('inspects sources: files, folders, missing and relative paths', async () => {
    const storage = attachmentStorage(folder);
    writeFileSync(join(dir, 'a.pdf'), 'abc');
    mkdirSync(join(dir, 'Dossier'));
    expect(await storage.inspect(join(dir, 'a.pdf'))).toEqual({ kind: 'file', size: 3 });
    expect(await storage.inspect(join(dir, 'Dossier'))).toEqual({ kind: 'not-a-file' });
    expect(await storage.inspect(join(dir, 'absent'))).toEqual({ kind: 'missing' });
    expect(await storage.inspect('a.pdf')).toEqual({ kind: 'missing' });
  });

  it('creates the folder, imports (streamed), writes, copies and removes files', async () => {
    const storage = attachmentStorage(folder);
    const big = Buffer.alloc(3 * 1024 * 1024 + 7, 1);
    writeFileSync(join(dir, 'big.bin'), big);
    expect(await storage.importFile(join(dir, 'big.bin'), 'id-1.bin')).toBe(big.length);
    expect(readFileSync(join(folder, 'id-1.bin')).equals(big)).toBe(true);
    expect(await storage.writeData('id-2.png', new Uint8Array([1, 2]))).toBe(2);
    expect(await storage.copyStored('id-2.png', 'id-3.png')).toBe(2);
    expect(readFileSync(join(folder, 'id-3.png'))).toEqual(Buffer.from([1, 2]));
    expect(await storage.exists('id-3.png')).toBe(true);
    expect(await storage.remove('id-3.png')).toBe(true);
    expect(await storage.remove('id-3.png')).toBe(false);
    expect(await storage.exists('id-3.png')).toBe(false);
    expect(storage.absolutePath('id-2.png')).toBe(join(folder, 'id-2.png'));
  });

  it('never overwrites a stored file and leaves no partial file behind', async () => {
    const storage = attachmentStorage(folder);
    await storage.writeData('id-1.png', new Uint8Array([1]));
    await expect(storage.writeData('id-1.png', new Uint8Array([2]))).rejects.toThrow(/EEXIST/);
    expect(readFileSync(join(folder, 'id-1.png'))).toEqual(Buffer.from([1]));
    await expect(storage.importFile(join(dir, 'absent'), 'id-2.pdf')).rejects.toThrow(/ENOENT/);
    await expect(storage.copyStored('nope.png', 'id-3.png')).rejects.toThrow(/ENOENT/);
    expect(readdirSync(folder)).toEqual(['id-1.png']);
  });

  it('refuses paths that leave the folder', async () => {
    const storage = attachmentStorage(folder);
    for (const path of ['', '.', '../ordo.db', '../../x', '/etc/passwd', 'sub/x.png', join(folder, 'x')]) {
      expect(() => storage.absolutePath(path), path).toThrow(/outside/);
    }
    await expect(storage.writeData('../escape.png', new Uint8Array([1]))).rejects.toThrow(/outside/);
    expect(existsSync(join(dir, 'userData', 'escape.png'))).toBe(false);
    expect(await storage.exists('../ordo.db')).toBe(false);
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a FIFO without hanging, even when it replaced the file after the first look',
    async () => {
      const storage = attachmentStorage(folder);
      const fifo = join(dir, 'pipe.pdf');
      execFileSync('mkfifo', [fifo]);
      // `importFile` checks the handle it opened itself: no writer ever comes, and it must not wait.
      await expect(storage.importFile(fifo, 'id-1.pdf')).rejects.toThrow('Not a file');
      await expect(storage.importFile(dir, 'id-2.pdf')).rejects.toThrow('Not a file');
      await expect(storage.importFile('relative.pdf', 'id-3.pdf')).rejects.toThrow('File not found');
      expect(existsSync(folder) ? readdirSync(folder) : []).toEqual([]);
    },
    5_000,
  );

  it('lists the stored files with their modification time, skipping hidden files and folders', async () => {
    const storage = attachmentStorage(folder);
    expect(await storage.listStored()).toEqual([]);
    await storage.writeData('id-1.png', new Uint8Array([1]));
    utimesSync(join(folder, 'id-1.png'), 1_000, 1_000);
    writeFileSync(join(folder, '.DS_Store'), 'x');
    mkdirSync(join(folder, 'sub'));
    expect(await storage.listStored()).toEqual([{ storedPath: 'id-1.png', modifiedAt: 1_000_000 }]);
  });
});

describe('download mark', () => {
  function fakeIo(marks: Record<string, string>) {
    const written: Record<string, string> = {};
    const io: DownloadMarkIo = {
      read: async (path) => {
        const mark = marks[path];
        if (mark === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return Buffer.from(mark);
      },
      write: async (path, data) => {
        written[path] = Buffer.from(data).toString();
      },
    };
    return { io, written };
  }
  const zone = '[ZoneTransfer]\r\nZoneId=3\r\n';

  it('carries the Zone.Identifier stream on Windows only, and only when there is one', async () => {
    const { io, written } = fakeIo({ 'C:\\Dl\\a.pdf:Zone.Identifier': zone });
    expect(await copyDownloadMark('C:\\Dl\\a.pdf', 'D:\\att\\id.pdf', 'win32', io)).toBe(true);
    expect(written).toEqual({ 'D:\\att\\id.pdf:Zone.Identifier': zone });
    expect(await copyDownloadMark('C:\\Dl\\b.pdf', 'D:\\att\\id2.pdf', 'win32', io)).toBe(false);
    for (const platform of ['darwin', 'linux'] as const) {
      expect(await copyDownloadMark('C:\\Dl\\a.pdf', 'x', platform, io)).toBe(false);
    }
    expect(Object.keys(written)).toHaveLength(1);
  });

  it('never fails the copy: a refused write or an oversized stream is skipped', async () => {
    const io: DownloadMarkIo = {
      read: async () => Buffer.from(zone),
      write: async () => {
        throw new Error('EINVAL: streams not supported on this volume');
      },
    };
    expect(await copyDownloadMark('a', 'b', 'win32', io)).toBe(false);
    const big = fakeIo({ 'a:Zone.Identifier': 'x'.repeat(65 * 1024) });
    expect(await copyDownloadMark('a', 'b', 'win32', big.io)).toBe(false);
    expect(big.written).toEqual({});
  });

  it('is applied by imports and stored copies (forced to Windows on any system)', async () => {
    writeFileSync(join(dir, 'a.pdf'), 'abc');
    const { io, written } = fakeIo({ [`${join(dir, 'a.pdf')}:Zone.Identifier`]: zone });
    const storage = attachmentStorage(folder, { platform: 'win32', markIo: io });
    expect(await storage.importFile(join(dir, 'a.pdf'), 'id-1.pdf')).toBe(3);
    expect(written).toEqual({ [`${join(folder, 'id-1.pdf')}:Zone.Identifier`]: zone });
    // On the real system the stored file has no stream here: the copy still succeeds.
    expect(await storage.copyStored('id-1.pdf', 'id-2.pdf')).toBe(3);
    const failing = attachmentStorage(folder, {
      platform: 'win32',
      markIo: { read: async () => Buffer.from(zone), write: () => Promise.reject(new Error('EPERM')) },
    });
    expect(await failing.importFile(join(dir, 'a.pdf'), 'id-3.pdf')).toBe(3);
    expect(readdirSync(folder).sort()).toEqual(['id-1.pdf', 'id-2.pdf', 'id-3.pdf']);
  });
});

describe('mime types', () => {
  it('maps common extensions and types both ways', () => {
    expect(mimeTypeOf('Photo.JPG')).toBe('image/jpeg');
    expect(mimeTypeOf('report.pdf')).toBe('application/pdf');
    expect(mimeTypeOf('noext')).toBeNull();
    expect(mimeTypeOf('a.unknownext')).toBeNull();
    expect(extensionOf('image/jpeg')).toBe('jpg');
    expect(extensionOf('IMAGE/PNG')).toBe('png');
    expect(extensionOf('image/tiff')).toBe('tif');
    expect(extensionOf('application/x-nope')).toBeNull();
  });
});
