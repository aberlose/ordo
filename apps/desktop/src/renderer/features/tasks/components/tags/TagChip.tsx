import type { ColumnColor } from '@ordo/domain';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@renderer/shared/lib/cn';
import { columnColorVar } from '@renderer/shared/ui/colors';

/** Background of a tag: its colour at 10 % over the surface (board mockup, tag style G "soft"). */
export const tagTint = (color: ColumnColor): CSSProperties => ({
  background: `color-mix(in srgb, ${columnColorVar(color)} 10%, var(--surface))`,
});

export interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  color: ColumnColor;
  /** Shrinks with an ellipsis instead of overflowing (card line). */
  truncate?: boolean;
  /** After the name (the × of the detail row). */
  children?: ReactNode;
}

/**
 * A tag, style G "soft" (approved mockup board, tag style): tinted background, a small vertical bar
 * in the tag colour, secondary text.
 */
export function TagChip({
  name,
  color,
  truncate = false,
  className,
  style,
  children,
  ...rest
}: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded pr-2 pl-1.5 text-small font-medium whitespace-nowrap text-text-2',
        truncate && 'min-w-0 shrink',
        className,
      )}
      style={{ ...tagTint(color), ...style }}
      {...rest}
    >
      <span
        aria-hidden
        className="h-2.75 w-0.75 shrink-0 rounded-xs"
        style={{ background: columnColorVar(color) }}
      />
      <span className={cn(truncate && 'min-w-0 truncate')}>{name}</span>
      {children}
    </span>
  );
}
