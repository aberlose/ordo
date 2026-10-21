import { clampImageWidth } from '@ordo/domain';

/** Pure helpers of the notes editor (links, "/" menu, image width): tested without the editor. */

/** The only link schemes of the notes: the main process opens them in the default browser / mail app. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/;
/** `scheme:` at the start, not `host:port`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):(?!\d)/i;

/** A link address the notes accept as it is: http, https or mailto, well formed. */
export function isAllowedLink(href: string): boolean {
  try {
    const url = new URL(href);
    if (!ALLOWED_SCHEMES.has(url.protocol)) return false;
    return url.protocol === 'mailto:' ? url.pathname.length > 0 : url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * The address typed in the link popover, normalised: `exemple.fr/x` → `https://exemple.fr/x`,
 * `nom@exemple.fr` → `mailto:nom@exemple.fr`. `null` when it is not an http, https or mailto address.
 */
export function normalizeLink(input: string): string | null {
  const raw = input.trim();
  if (raw === '' || /\s/.test(raw)) return null;
  let href: string;
  if (SCHEME.test(raw)) href = raw;
  else if (EMAIL.test(raw)) href = `mailto:${raw}`;
  else if (raw.startsWith('//')) href = `https:${raw}`;
  else href = `https://${raw}`;
  if (!isAllowedLink(href)) return null;
  // A bare word ("https://notes") is a typo, not an address: ask for a dot (or localhost).
  if (!href.startsWith('mailto:')) {
    const { hostname } = new URL(href);
    if (!hostname.includes('.') && hostname !== 'localhost' && !hostname.startsWith('[')) return null;
  }
  return href;
}

/** The address shown in the link bubble: without the scheme and the trailing slash. */
export function linkLabel(href: string): string {
  return href.replace(/^(https?:\/\/|mailto:)/i, '').replace(/\/$/, '');
}

/** A drag carrying at least one image file (types are readable during dragover): the notes take it. */
export function dragHasImage(data: DataTransfer | null | undefined): boolean {
  if (!data) return false;
  return Array.from(data.items ?? []).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

/** Blocks of the "/" menu, in their order (approved mockup: task-detail/FullScreen). */
export const BLOCKS = [
  // One "Titre" (level 2, as the toolbar); the # ## ### shortcuts still give the three levels.
  { id: 'heading', markdown: '##', keywords: ['h2', 'title', 'heading', 'titre'] },
  { id: 'taskList', markdown: '[ ]', keywords: ['todo', 'checklist', 'checkbox', 'tache', 'cocher'] },
  { id: 'bulletList', markdown: '-', keywords: ['list', 'bullet', 'liste', 'puces'] },
  { id: 'codeBlock', markdown: '```', keywords: ['code', 'pre'] },
  { id: 'blockquote', markdown: '>', keywords: ['quote', 'citation'] },
  { id: 'table', markdown: '', keywords: ['table', 'tableau', 'grid'] },
  { id: 'image', markdown: '', keywords: ['image', 'img', 'picture', 'photo'] },
] as const;

export type BlockId = (typeof BLOCKS)[number]['id'];
export type Block = (typeof BLOCKS)[number];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * The blocks matching what was typed after "/": a word of their label in the current language starts
 * with it (accents ignored), or a keyword in French or English does. Every block for an empty query.
 */
export function filterBlocks(query: string, label: (id: BlockId) => string): Block[] {
  const q = fold(query);
  if (q === '') return [...BLOCKS];
  return BLOCKS.filter(
    (block) =>
      fold(label(block.id))
        .split(/[\s'’-]+/)
        .some((word) => word.startsWith(q)) ||
      fold(label(block.id)).startsWith(q) ||
      block.keywords.some((keyword) => keyword.startsWith(q)) ||
      (block.markdown !== '' && block.markdown === q),
  );
}

/** Keyboard resize of a selected image: ⌥/Alt + ← / → by 5 % of the note width, within the bounds. */
export const IMAGE_WIDTH_STEP = 5;
export function stepImageWidth(width: unknown, direction: -1 | 1): number {
  const current = typeof width === 'number' ? width : Number(width);
  return clampImageWidth((Number.isFinite(current) ? current : 100) + direction * IMAGE_WIDTH_STEP);
}

/** Width given by a resize handle being dragged, from the pointer's travel. */
export function dragImageWidth(
  startWidth: number,
  deltaX: number,
  containerWidth: number,
  side: 'left' | 'right',
): number {
  if (containerWidth <= 0) return clampImageWidth(startWidth);
  const sign = side === 'right' ? 1 : -1;
  return clampImageWidth(startWidth + (sign * deltaX * 100) / containerWidth);
}
