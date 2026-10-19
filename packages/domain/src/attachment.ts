/** Attachments: files copied into the app's data folder (`userData/attachments/`). */

export const ATTACHMENT_NAME_MAX_LENGTH = 255;

/** Extension of a file name, lower case, without the dot; `''` when there is none. */
export function fileExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : '';
}

/** The badge of a tile: the extension in capitals, four letters at most (`FILE` without one). */
export function attachmentBadge(fileName: string): string {
  const ext = fileExtension(fileName);
  return ext === '' ? 'FILE' : ext.slice(0, 4).toUpperCase();
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg']);

/** Images get a thumbnail on their tile and can be shown in the notes. */
export function isImageAttachment(fileName: string, mimeType: string | null): boolean {
  if (mimeType !== null && mimeType.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(fileName));
}

/**
 * A safe display name for a file: path parts and control characters removed, length bounded,
 * `fallback` when nothing is left (a pasted image has no name).
 */
export function normalizeAttachmentName(raw: string, fallback: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (base === '' || base === '.' || base === '..') return fallback;
  if (base.length <= ATTACHMENT_NAME_MAX_LENGTH) return base;
  const ext = fileExtension(base);
  const keep = ext === '' ? '' : `.${ext}`;
  return base.slice(0, ATTACHMENT_NAME_MAX_LENGTH - keep.length) + keep;
}

/**
 * Where a file is stored, relative to the attachments folder: the attachment id plus the original
 * extension, so two files with the same name never collide and no user text reaches the path.
 */
export function attachmentStoredPath(id: string, fileName: string): string {
  const ext = fileExtension(fileName)
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  return ext === '' ? id : `${id}.${ext}`;
}
