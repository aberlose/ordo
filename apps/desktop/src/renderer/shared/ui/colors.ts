import type { ColumnColor } from '@ordo/domain';

/** CSS variable for a user-pickable colour (tokens.css). */
export const columnColorVar = (color: ColumnColor): string => `var(--col-${color})`;
