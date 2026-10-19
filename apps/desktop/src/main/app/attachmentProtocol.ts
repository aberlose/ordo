import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { ATTACHMENT_PROTOCOL } from '@ordo/contracts';
import type { ServedFile } from '../application/attachments';

/** Privileges of `ordo-file:` (registered before the app is ready). */
export const ATTACHMENT_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  stream: true,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The attachment id of `ordo-file://attachment/<id>`, `null` for any other URL. */
export function attachmentIdOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${ATTACHMENT_PROTOCOL}:` || parsed.hostname !== 'attachment') return null;
  const id = parsed.pathname.replace(/^\//, '');
  return UUID.test(id) ? id : null;
}

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves one attachment file. The URL only names an id: the file is the database's stored path,
 * resolved (and checked) inside the attachments folder by `lookup`; nothing else is ever read.
 */
export async function serveAttachment(
  request: Request,
  lookup: (id: string) => ServedFile | null,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  const id = attachmentIdOf(request.url);
  const file = id === null ? null : lookup(id);
  if (!file) return notFound();
  let size: number;
  try {
    const info = await stat(file.absolutePath);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    return notFound();
  }
  const headers = {
    'Content-Type': file.mimeType ?? 'application/octet-stream',
    'Content-Length': String(size),
    'X-Content-Type-Options': 'nosniff',
    // A file opened as a document (never by the app) could not run anything.
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'no-cache',
  };
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  const body = Readable.toWeb(createReadStream(file.absolutePath)) as NodeReadableStream<Uint8Array>;
  return new Response(body as unknown as ReadableStream<Uint8Array>, { status: 200, headers });
}
