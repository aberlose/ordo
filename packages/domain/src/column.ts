export const COLUMN_CATEGORIES = ['todo', 'in_progress', 'done'] as const;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

/** The ten user-pickable column and tag colours (docs/design/tokens.md). */
export const COLUMN_COLORS = [
  'slate',
  'blue',
  'cyan',
  'teal',
  'green',
  'amber',
  'orange',
  'red',
  'pink',
  'violet',
] as const;
export type ColumnColor = (typeof COLUMN_COLORS)[number];

export interface DefaultColumn {
  readonly category: ColumnCategory;
  readonly color: ColumnColor;
  /** Lucide icon name. */
  readonly icon: string;
}

/** The three columns of a new board, in order. Names are localised by the caller. */
export const DEFAULT_COLUMNS: readonly DefaultColumn[] = [
  { category: 'todo', color: 'slate', icon: 'inbox' },
  { category: 'in_progress', color: 'blue', icon: 'play' },
  { category: 'done', color: 'green', icon: 'circle-check' },
];

/** `null` means "no limit": every task of the column is shown. */
export type DisplayLimit = number | null;

export function visibleCount(total: number, limit: DisplayLimit): { shown: number; hidden: number } {
  const shown = limit === null ? total : Math.min(total, limit);
  return { shown, hidden: total - shown };
}
