import { COLUMN_COLORS, type ColumnColor } from './column';

export const TAG_NAME_MAX_LENGTH = 40;

export function normalizeTagName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, TAG_NAME_MAX_LENGTH);
}

/** Folded form of a tag name: case, accents and ligatures ignored (search and uniqueness). */
export function foldTagName(name: string): string {
  return normalizeTagName(name)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

/** Tag names are unique per board, whatever their case or accents ("Urgent" = "urgent"). */
export function isSameTagName(a: string, b: string): boolean {
  return foldTagName(a) === foldTagName(b);
}

/** Tags in the picker and on cards: alphabetical, case and accents ignored. */
export function compareTags(a: { readonly name: string }, b: { readonly name: string }): number {
  const folded = foldTagName(a.name).localeCompare(foldTagName(b.name));
  return folded !== 0 ? folded : a.name.localeCompare(b.name);
}

/**
 * Colour of a new tag: the first colour no tag of the board uses, from blue with slate (grey) last;
 * once all are used, the least used one in that order.
 */
export function newTagColor(usedColors: readonly ColumnColor[]): ColumnColor {
  const order: readonly ColumnColor[] = [...COLUMN_COLORS.filter((c) => c !== 'slate'), 'slate'];
  const uses = (color: ColumnColor) => usedColors.filter((c) => c === color).length;
  let best = order[0] ?? 'blue';
  for (const color of order) if (uses(color) < uses(best)) best = color;
  return best;
}

/** Tags that match the picker's query (folded "contains"), alphabetical. */
export function matchTags<T extends { readonly name: string }>(tags: readonly T[], query: string): T[] {
  const q = foldTagName(query);
  return tags.filter((tag) => q === '' || foldTagName(tag.name).includes(q)).sort(compareTags);
}

/** The picker offers "Create « query »" when the query is not empty and no tag has that name. */
export function canCreateTag(tags: readonly { readonly name: string }[], query: string): boolean {
  const name = normalizeTagName(query);
  return name !== '' && !tags.some((tag) => isSameTagName(tag.name, name));
}
