import type { SubtaskProgress } from '@ordo/contracts';
import type { ColumnColor } from '@ordo/domain';
import { columnColorVar } from '@renderer/shared/ui/colors';

const RADIUS = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Sub-task progress as a small ring (approved mockup: tags-subtasks/SubtaskDetail B, the parent button). */
export function SubtaskRing({
  progress,
  color,
  size = 14,
}: {
  progress: SubtaskProgress;
  color: ColumnColor;
  size?: number;
}) {
  const filled = progress.total === 0 ? 0 : (progress.done / progress.total) * CIRCUMFERENCE;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden className="shrink-0">
      <circle cx="18" cy="18" r={RADIUS} fill="none" strokeWidth="5" className="stroke-border" />
      <circle
        cx="18"
        cy="18"
        r={RADIUS}
        fill="none"
        strokeWidth="5"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform="rotate(-90 18 18)"
        style={{ stroke: columnColorVar(color) }}
      />
    </svg>
  );
}
