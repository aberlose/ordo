import type { ColumnColor } from '@ordo/domain';
import { Command } from 'cmdk';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { columnColorVar, columnTextColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { Kbd } from '@renderer/shared/ui/kbd';
import { PriorityBars } from '@renderer/shared/ui/priority-bars';
import { highlight, type PaletteTask } from '../model';

/** Group heading and items (approved mockups command-palette, search-palette A: 11.5 / 600, text-3). */
export const GROUP =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-3';

/** A 38 px row; the selection (mouse or ↑↓) is the accent-soft background. */
const ROW =
  'group flex h-9.5 cursor-pointer items-center rounded-lg px-2.5 text-input text-text data-[selected=true]:bg-accent-soft';

/** Explanation line under a group ("Aucune tâche ailleurs."). */
export function GroupNote({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-2.5 text-meta leading-normal text-text-3">{children}</div>;
}

/** Colour of a board's icon and initials; boards created before lot 4 have none (as the sidebar). */
const boardColor = (color: ColumnColor | null) => (color ? columnColorVar(color) : 'var(--accent)');
const boardTint = (color: ColumnColor | null): CSSProperties => ({
  background: `color-mix(in srgb, ${boardColor(color)} 14%, var(--surface))`,
});

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** Board square of a task found on another board: initials in the board's colour (as the rail). */
export function BoardSquare({ name, color }: { name: string; color: ColumnColor | null }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-micro font-bold"
      style={{ ...boardTint(color), color: color ? columnTextColorVar(color) : 'var(--accent)' }}
    >
      {initials(name)}
    </span>
  );
}

/** 26 px icon box of a command, an action or a board. */
function IconBox({
  children,
  accent = false,
  tint,
}: {
  children: ReactNode;
  accent?: boolean | undefined;
  tint?: ColumnColor | null | undefined;
}) {
  if (tint !== undefined) {
    return (
      <span
        aria-hidden
        className="flex size-6.5 shrink-0 items-center justify-center rounded-md"
        style={{ ...boardTint(tint), color: boardColor(tint) }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6.5 shrink-0 items-center justify-center rounded-md bg-rail text-text-2 group-data-[selected=true]:bg-surface group-data-[selected=true]:text-accent',
        accent && 'text-accent',
      )}
    >
      {children}
    </span>
  );
}

export interface CommandRowProps {
  value: string;
  icon: ReactNode;
  label: ReactNode;
  meta?: string | undefined;
  keys?: readonly string[];
  accent?: boolean | undefined;
  /** Board colour: the icon box is tinted with it ("Aller au board"). */
  tint?: ColumnColor | null | undefined;
  onSelect: () => void;
}

/** A command, an action, a recent task or a board (approved mockup command-palette). */
export function CommandRow({ value, icon, label, meta, keys = [], accent, tint, onSelect }: CommandRowProps) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={cn(ROW, 'gap-3')}>
      <IconBox accent={accent} tint={tint}>
        {icon}
      </IconBox>
      {typeof label === 'string' ? <span className="min-w-0 flex-1 truncate">{label}</span> : label}
      {meta && <span className="shrink-0 text-small text-text-3">{meta}</span>}
      {keys.length > 0 && (
        <span className="flex shrink-0 gap-0.75">
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}

/** "Parent › " in grey before a sub-task's title, then the title with the typed words bold. */
export function TaskTitle({
  task,
  words,
}: {
  task: Pick<PaletteTask, 'title' | 'parentTitle'>;
  words: readonly string[];
}) {
  return (
    <span className="min-w-0 flex-1 truncate">
      {task.parentTitle !== null && <span className="text-text-3">{task.parentTitle} › </span>}
      {highlight(task.title, words).map((part, index) =>
        part.match ? (
          <b key={index} className="font-bold">
            {part.text}
          </b>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </span>
  );
}

export interface TaskRowProps {
  task: PaletteTask;
  words: readonly string[];
  /** On another board: the board square and "Board · Colonne". */
  showBoard: boolean;
  onSelect: () => void;
}

/** A task found (approved mockup search-palette A): priority bars, title, column (and board). */
export function TaskRow({ task, words, showBoard, onSelect }: TaskRowProps) {
  const { t } = useTranslation();
  return (
    <Command.Item value={`task:${task.id}`} onSelect={onSelect} className={cn(ROW, 'gap-2.5')}>
      <span className="flex w-4 shrink-0 justify-center">
        <PriorityBars priority={task.priority} />
      </span>
      <TaskTitle task={task} words={words} />
      <span className="flex shrink-0 items-center gap-1.5 text-small whitespace-nowrap text-text-3">
        {showBoard ? (
          <>
            <BoardSquare name={task.boardName} color={task.boardColor} />
            {t('palette.location', { board: task.boardName, column: task.columnName })}
          </>
        ) : (
          <>
            <ColumnIcon
              icon={task.columnIcon}
              size={12}
              style={{ color: columnColorVar(task.columnColor) }}
            />
            {task.columnName}
          </>
        )}
      </span>
    </Command.Item>
  );
}

/** A board tag completing the `#prefix` being typed (approved board mockup: dot in the tag colour). */
export function TagRow({
  name,
  color,
  onSelect,
}: {
  name: string;
  color: ColumnColor;
  onSelect: () => void;
}) {
  return (
    <Command.Item value={`tag:${name}`} onSelect={onSelect} className={cn(ROW, 'gap-2.5 text-body')}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: columnColorVar(color) }}
      />
      #{name}
    </Command.Item>
  );
}
