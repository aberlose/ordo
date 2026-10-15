import type { BoardSummary } from '@ordo/contracts';
import { BOARD_NAME_MAX_LENGTH, normalizeBoardName } from '@ordo/domain';
import { useId, useState, type ComponentProps, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { PopoverClose } from '@renderer/shared/ui/popover';
import { FieldLabel, SettingsHeader, SettingsPopoverContent } from './SettingsPopover';

export interface BoardDuplicateContentProps extends Omit<
  ComponentProps<typeof SettingsPopoverContent>,
  'titleId' | 'onSubmit' | 'children'
> {
  board: BoardSummary;
  /** Normalised name of the copy; the caller saves and closes the popover. */
  onSubmit: (copy: { name: string; includeTasks: boolean }) => void;
}

/**
 * "Dupliquer…" from the board menu (approved mockup boards/BoardMenu A): a 320 px popover with the
 * name of the copy and "Inclure les N tâches", checked by default (disabled without tasks). To be
 * rendered inside a `Popover` anchored to the row.
 */
export function BoardDuplicateContent({
  board,
  onSubmit,
  className,
  ...content
}: BoardDuplicateContentProps) {
  const titleId = useId();
  return (
    <SettingsPopoverContent titleId={titleId} className={cn('w-popover-sm', className)} {...content}>
      <BoardDuplicateForm board={board} titleId={titleId} onSubmit={onSubmit} />
    </SettingsPopoverContent>
  );
}

function BoardDuplicateForm({
  board,
  titleId,
  onSubmit,
}: {
  board: BoardSummary;
  titleId: string;
  onSubmit: BoardDuplicateContentProps['onSubmit'];
}) {
  const { t } = useTranslation();
  const ids = useId();
  const [name, setName] = useState(() =>
    normalizeBoardName(t('boardDuplicate.defaultName', { name: board.name })),
  );
  const hasTasks = board.taskCount > 0;
  const [includeTasks, setIncludeTasks] = useState(hasTasks);
  const normalized = normalizeBoardName(name);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (normalized) onSubmit({ name: normalized, includeTasks: hasTasks && includeTasks });
  };

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <SettingsHeader titleId={titleId} title={t('boardDuplicate.title', { name: board.name })} />
      <div className="flex flex-col gap-3.5 px-4 py-3.5">
        <label className="block">
          <FieldLabel>{t('boardDuplicate.name')}</FieldLabel>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOARD_NAME_MAX_LENGTH}
            required
            className="h-9 w-full rounded-lg border-strong border-border-strong bg-surface px-2.5 text-input outline-none focus:border-accent"
          />
        </label>
        <div className={cn('flex items-start gap-2.5 text-body', !hasTasks && 'opacity-45')}>
          <input
            id={`${ids}-tasks`}
            type="checkbox"
            checked={hasTasks && includeTasks}
            disabled={!hasTasks}
            onChange={(event) => setIncludeTasks(event.target.checked)}
            aria-describedby={`${ids}-hint`}
            className="m-0 mt-0.5 cursor-pointer accent-accent disabled:cursor-default"
          />
          <div className="flex flex-col gap-0.75">
            <label htmlFor={`${ids}-tasks`} className={cn(hasTasks && 'cursor-pointer')}>
              {t('boardDuplicate.includeTasks', { count: board.taskCount })}
            </label>
            <span id={`${ids}-hint`} className="text-small leading-snug text-text-3">
              {t('boardDuplicate.hint')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <PopoverClose asChild>
          <Button>{t('boardDuplicate.cancel')}</Button>
        </PopoverClose>
        <Button type="submit" variant="primary" disabled={!normalized} className="px-3.5">
          {t('boardDuplicate.submit')}
        </Button>
      </div>
    </form>
  );
}
