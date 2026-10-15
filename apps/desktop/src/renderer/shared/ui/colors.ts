import type { ColumnColor } from '@ordo/domain';

/** CSS variable for a user-pickable colour (tokens.css). */
export const columnColorVar = (color: ColumnColor): string => `var(--col-${color})`;

/** A colour as small text (rail initials): the per-mode `--col-<name>-text` variant that keeps AA. */
export const columnTextColorVar = (color: ColumnColor): string => `var(--col-${color}-text)`;
