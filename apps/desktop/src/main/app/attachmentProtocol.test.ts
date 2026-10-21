import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachmentIdOf, serveAttachment } from './attachmentProtocol';
import { isExternalUrl } from './externalLinks';

const id = '0192f0a0-0000-7000-8000-000000000001';
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ordo-protocol-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ordo-file protocol', () => {
  it('reads only an attachment id from the URL', () => {
    expect(attachmentIdOf(`ordo-file://attachment/${id}`)).toBe(id);
    expect(attachmentIdOf(`ordo-file://attachment/${id}?v=2`)).toBe(id);
    expect(attachmentIdOf(`ordo-file://attachment/../${id}`)).toBe(id);
    expect(attachmentIdOf(`ordo-file://attachment/${id}/x`)).toBeNull();
    expect(attachmentIdOf('ordo-file://attachment/..%2F..%2Fordo.db')).toBeNull();
    expect(attachmentIdOf(`ordo-file://other/${id}`)).toBeNull();
    expect(attachmentIdOf(`file:///attachment/${id}`)).toBeNull();
    expect(attachmentIdOf('not a url')).toBeNull();
  });

  it('serves the stored file with its type, 404 otherwise', async () => {
    const path = join(dir, `${id}.png`);
    writeFileSync(path, Buffer.from([137, 80, 78, 71]));
    const lookup = (wanted: string) => (wanted === id ? { absolutePath: path, mimeType: 'image/png' } : null);
    const ok = await serveAttachment(new Request(`ordo-file://attachment/${id}`), lookup);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/png');
    expect(ok.headers.get('content-length')).toBe('4');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));

    const other = '0192f0a0-0000-7000-8000-000000000002';
    expect((await serveAttachment(new Request(`ordo-file://attachment/${other}`), lookup)).status).toBe(404);
    expect((await serveAttachment(new Request('ordo-file://attachment/nope'), lookup)).status).toBe(404);
    const post = new Request(`ordo-file://attachment/${id}`, { method: 'POST' });
    expect((await serveAttachment(post, lookup)).status).toBe(405);
    rmSync(path);
    expect((await serveAttachment(new Request(`ordo-file://attachment/${id}`), lookup)).status).toBe(404);
  });

  it('serves an unknown type as bytes', async () => {
    const path = join(dir, id);
    writeFileSync(path, 'x');
    const res = await serveAttachment(new Request(`ordo-file://attachment/${id}`), () => ({
      absolutePath: path,
      mimeType: null,
    }));
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
  });
});

describe('external links', () => {
  it('opens http, https and mailto links only', () => {
    expect(isExternalUrl('https://example.com/a')).toBe(true);
    expect(isExternalUrl('http://example.com')).toBe(true);
    expect(isExternalUrl('mailto:alice@example.com')).toBe(true);
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'ordo-file://attachment/x',
      'smb://x',
      'nope',
    ]) {
      expect(isExternalUrl(url), url).toBe(false);
    }
  });
});
