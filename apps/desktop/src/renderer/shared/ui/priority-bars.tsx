import type { Priority } from '@ordo/domain';
import { cn } from '../lib/cn';

/** Bar heights (px) from the approved card mockup: five bars rising in height. */
const HEIGHTS = [3.6, 5.2, 6.8, 8.4, 10] as const;

export const priorityColorVar = (priority: Priority): string => `var(--priority-${priority})`;

export interface PriorityBarsProps {
  priority: Priority;
  /** Accessible label, e.g. "Priorité : Haute". Omit when the bars are decorative. */
  label?: string;
  className?: string;
}

/** Five bars, filled in the priority colour up to the level (docs/design/mockups/board). */
export function PriorityBars({ priority, label, className }: PriorityBarsProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      className={cn('flex h-2.5 items-end gap-[1.5px]', className)}
    >
      {HEIGHTS.map((height, i) => (
        <span
          key={height}
          className="w-[2.5px] rounded-[1px]"
          style={{
            height,
            background: i < priority ? priorityColorVar(priority) : 'var(--border-strong)',
          }}
        />
      ))}
    </span>
  );
}

/** One bar of the given level, used by the priority picker buttons. */
export function PriorityBar({ level, filled }: { level: Priority; filled: Priority | null }) {
  return (
    <span
      aria-hidden
      className="w-1 rounded-[1.5px]"
      style={{
        height: (HEIGHTS[level - 1] ?? HEIGHTS[4]) + 4,
        background: filled !== null && level <= filled ? priorityColorVar(filled) : 'var(--border-strong)',
      }}
    />
  );
}
