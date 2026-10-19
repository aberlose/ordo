import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachmentStorage } from './attachmentStorage';
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
