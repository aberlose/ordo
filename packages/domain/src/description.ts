/**
 * Task notes: the editor's document as ProseMirror JSON (`description_json`) and its plain text
 * (`description_text`, for search). The plain text is always derived here, never sent by the renderer.
 */

/** A node of the editor document (ProseMirror JSON). */
export interface DocNode {
  readonly type: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly marks?: readonly unknown[];
  readonly content?: readonly DocNode[];
}

/** The image node of the notes: it points to an attachment of the same task. */
export const IMAGE_NODE = 'image';
/** Image width in the note, as a percentage of the note width (resize handles). */
export const IMAGE_WIDTH_MIN = 20;
export const IMAGE_WIDTH_MAX = 100;

/** Text blocks: each one ends its line in the plain text. */
const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock', 'horizontalRule']);
const CELLS = new Set(['tableCell', 'tableHeader']);

function isNode(value: unknown): value is DocNode {
  return typeof value === 'object' && value !== null && typeof (value as DocNode).type === 'string';
}

/**
 * Plain text of a document, for search: one line per text block (paragraph, heading, list item,
 * code…), table cells separated by a tab, one line per table row. `''` for no notes.
 */
export function descriptionText(doc: DocNode | null): string {
  if (!doc) return '';
  let out = '';
  const walk = (node: DocNode) => {
    if (node.type === 'text' && typeof node.text === 'string') out += node.text;
    else if (node.type === 'hardBreak') out += '\n';
    for (const child of node.content ?? []) if (isNode(child)) walk(child);
    if (TEXT_BLOCKS.has(node.type)) out += '\n';
    else if (CELLS.has(node.type)) out = `${out.replace(/\n+$/, '')}\t`;
    else if (node.type === 'tableRow') out = `${out.replace(/\t$/, '')}\n`;
  };
  walk(doc);
  return out
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .join('\n');
}

/** A document with no text and no image counts as "no notes" (stored as `null`). */
export function isEmptyDescription(doc: DocNode | null): boolean {
  return doc === null || (descriptionText(doc) === '' && attachmentIdsInDescription(doc).length === 0);
}

/** Attachment ids referenced by the images of a document, in order, without duplicates. */
export function attachmentIdsInDescription(doc: DocNode | null): string[] {
  const ids: string[] = [];
  const walk = (node: DocNode) => {
    const id = node.type === IMAGE_NODE ? node.attrs?.['attachmentId'] : undefined;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
    for (const child of node.content ?? []) if (isNode(child)) walk(child);
  };
  if (doc) walk(doc);
  return ids;
}

/**
 * The same document with its images pointing to other attachments (board duplication). Images whose
 * attachment is not in `ids` are kept as they are: they show as "image supprimée".
 */
export function remapDescriptionAttachments(doc: DocNode, ids: ReadonlyMap<string, string>): DocNode {
  const id = doc.type === IMAGE_NODE ? doc.attrs?.['attachmentId'] : undefined;
  const mapped = typeof id === 'string' ? ids.get(id) : undefined;
  return {
    ...doc,
    ...(mapped !== undefined ? { attrs: { ...doc.attrs, attachmentId: mapped } } : {}),
    ...(doc.content ? { content: doc.content.map((child) => remapDescriptionAttachments(child, ids)) } : {}),
  };
}

/** Clamp an image width given by the resize handles. */
export function clampImageWidth(percent: number): number {
  if (!Number.isFinite(percent)) return IMAGE_WIDTH_MAX;
  return Math.round(Math.min(IMAGE_WIDTH_MAX, Math.max(IMAGE_WIDTH_MIN, percent)));
}

/** Upper bound of the stored notes (serialised JSON), far above any hand-written note. */
export const DESCRIPTION_MAX_JSON_LENGTH = 2_000_000;
