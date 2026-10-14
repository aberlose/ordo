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

export const COLUMN_NAME_MAX_LENGTH = 60;
export const DISPLAY_LIMIT_MIN = 1;
export const DISPLAY_LIMIT_MAX = 99;

export function normalizeColumnName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, COLUMN_NAME_MAX_LENGTH);
}

export function isDisplayLimit(value: number | null): value is DisplayLimit {
  return (
    value === null || (Number.isInteger(value) && value >= DISPLAY_LIMIT_MIN && value <= DISPLAY_LIMIT_MAX)
  );
}

/**
 * Defaults of a column added from the board (approved popover mockup): "in progress", no limit,
 * the first colour not used yet by the board, a neutral icon.
 */
export function newColumnDefaults(
  usedColors: readonly ColumnColor[],
): DefaultColumn & { displayLimit: DisplayLimit } {
  const color = COLUMN_COLORS.find((c) => !usedColors.includes(c)) ?? 'slate';
  return { category: 'in_progress', color, icon: 'circle-dashed', displayLimit: null };
}

/** A board keeps at least one column. */
export function canDeleteColumn(liveColumnCount: number): boolean {
  return liveColumnCount > 1;
}

/** Whether a task at this position is hidden by the display limit until the column is expanded. */
export function isPastDisplayLimit(index: number, limit: DisplayLimit): boolean {
  return limit !== null && index >= limit;
}

/**
 * Icons a column can take (Lucide names, kebab-case). The renderer maps each to its component, and
 * the IPC contract only accepts these.
 */
export const COLUMN_ICON_NAMES = [
  'inbox',
  'circle-dashed',
  'circle',
  'circle-dot',
  'play',
  'pause',
  'circle-pause',
  'circle-stop',
  'circle-check',
  'check',
  'list-checks',
  'list-todo',
  'clipboard-list',
  'eye',
  'search',
  'ban',
  'circle-x',
  'circle-alert',
  'triangle-alert',
  'circle-help',
  'clock',
  'timer',
  'hourglass',
  'alarm-clock',
  'calendar',
  'calendar-check',
  'calendar-clock',
  'flag',
  'milestone',
  'signpost',
  'route',
  'star',
  'heart',
  'sparkles',
  'lightbulb',
  'rocket',
  'zap',
  'flame',
  'target',
  'trophy',
  'thumbs-up',
  'smile',
  'bug',
  'code',
  'terminal',
  'git-branch',
  'git-pull-request',
  'server',
  'database',
  'cloud',
  'cpu',
  'monitor',
  'smartphone',
  'construction',
  'hammer',
  'wrench',
  'settings',
  'sliders-horizontal',
  'flask-conical',
  'test-tube',
  'microscope',
  'shield',
  'lock',
  'pencil',
  'pen-tool',
  'palette',
  'brush',
  'image',
  'camera',
  'video',
  'mic',
  'music',
  'file-text',
  'book-open',
  'bookmark',
  'folder',
  'archive',
  'trash-2',
  'paperclip',
  'link',
  'tag',
  'layers',
  'layout-grid',
  'kanban',
  'chart-column',
  'puzzle',
  'message-square',
  'mail',
  'send',
  'phone',
  'bell',
  'megaphone',
  'users',
  'user',
  'baby',
  'dog',
  'house',
  'building-2',
  'store',
  'briefcase',
  'landmark',
  'graduation-cap',
  'shopping-cart',
  'package',
  'truck',
  'gift',
  'receipt',
  'wallet',
  'piggy-bank',
  'dollar-sign',
  'scale',
  'heart-pulse',
  'stethoscope',
  'pill',
  'dumbbell',
  'utensils',
  'coffee',
  'plane',
  'car',
  'map-pin',
  'globe',
  'compass',
  'mountain',
  'anchor',
  'leaf',
  'sun',
  'moon',
  'snowflake',
  'droplet',
  'gamepad-2',
  'hand',
  'refresh-cw',
  'repeat',
] as const;
export type ColumnIconName = (typeof COLUMN_ICON_NAMES)[number];

export const isColumnIconName = (name: string | null): name is ColumnIconName =>
  name !== null && (COLUMN_ICON_NAMES as readonly string[]).includes(name);

/**
 * What a category change does to the column's tasks, as moving them would (`completionAfterMove`):
 * becoming "done" completes the tasks not completed yet; leaving "done" reopens them.
 */
export function completionOnCategoryChange(
  from: ColumnCategory,
  to: ColumnCategory,
): 'complete' | 'reopen' | null {
  if (from === to) return null;
  if (to === 'done') return 'complete';
  if (from === 'done') return 'reopen';
  return null;
}
