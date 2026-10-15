import type { ArchivedBoard } from '@ordo/contracts';
import { format, isSameYear } from 'date-fns';
import { Archive, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '@renderer/shared/feedback/store';
import { cn } from '@renderer/shared/lib/cn';
import { dateLocale } from '@renderer/shared/lib/dates';
import { useNow } from '@renderer/shared/lib/useNow';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { useArchivedBoards, useRestoreBoard } from '../hooks/archives';

export interface ArchivesProps {
  /** Archived boards, newest archive first; `undefined` while loading. */
  boards: readonly ArchivedBoard[] | undefined;
  onRestore: (id: string) => void;
  loadError?: boolean;
  /** Loads the archives again after a load error. */
  onRetry?: () => void;
  /** Reference time for the archive dates (the year shows only when it differs). */
  now?: number;
}

/** Approved mockup: docs/design/mockups/boards/BoardArchives (variant A, page in the main area). */
export function Archives({ boards, onRestore, loadError = false, onRetry, now: fixedNow }: ArchivesProps) {
  const { t, i18n } = useTranslation();
  const currentNow = useNow();
  const now = fixedNow ?? currentNow;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>());
  const locale = dateLocale(i18n.language);

  const archivedOn = (at: number) =>
    format(at, t(isSameYear(at, now) ? 'archives.dateFormat' : 'archives.dateFormatWithYear'), { locale });

  // The row leaves the list: the focus goes to the next row's button, else the previous one, else the title.
  const restore = (index: number) => {
    if (!boards) return;
    const board = boards[index];
    if (!board) return;
    const neighbour = boards[index + 1] ?? boards[index - 1];
    const target = neighbour ? restoreButtons.current.get(neighbour.id) : headingRef.current;
    target?.focus();
    onRestore(board.id);
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex h-header shrink-0 items-center gap-2.5 border-b border-border px-6">
        <Archive size={16} className="text-text-2" aria-hidden />
        <h1 ref={headingRef} tabIndex={-1} className="m-0 text-title font-semibold outline-none">
          {t('archives.title')}
        </h1>
        {boards && boards.length > 0 && (
          <span className="text-small text-text-3 tabular-nums">
            {t('archives.count', { count: boards.length })}
          </span>
        )}
      </header>
      {loadError ? (
        // Approved with the lot 4 review: the empty state's dashed box, with a retry as in the error toast.
        <div
          role="alert"
          className="m-6 flex max-w-160 flex-col items-center gap-3 rounded-popover border-2 border-dashed border-border p-7 text-center"
        >
          <p className="m-0 text-meta leading-snug text-text-2">{t('archives.loadError')}</p>
          {onRetry && (
            <Button onClick={onRetry}>
              <RotateCcw size={14} aria-hidden />
              {t('feedback.retry')}
            </Button>
          )}
        </div>
      ) : !boards ? null : boards.length === 0 ? (
        <div className="m-6 flex max-w-160 flex-col items-center gap-2 rounded-popover border-2 border-dashed border-border p-7 text-center">
          <p className="m-0 font-semibold">{t('archives.emptyTitle')}</p>
          <p className="m-0 text-meta leading-snug text-text-3">{t('archives.emptyBody')}</p>
        </div>
      ) : (
        <div className="flex max-w-160 flex-col gap-3 p-6">
          <p className="m-0 text-meta leading-snug text-text-3">{t('archives.intro')}</p>
          <ul
            aria-label={t('archives.listLabel')}
            className="m-0 list-none overflow-hidden rounded-card border border-border bg-surface p-0"
          >
            {boards.map((board, index) => (
              <li
                key={board.id}
                className="flex items-center gap-3 border-b border-border px-3.5 py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rail"
                >
                  <ColumnIcon
                    icon={board.icon ?? 'kanban'}
                    size={16}
                    strokeWidth={2.2}
                    className={cn(!board.color && 'text-accent')}
                    style={board.color ? { color: columnColorVar(board.color) } : undefined}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{board.name}</span>
                  <span className="text-small leading-snug text-text-3">
                    {t('archives.meta', { count: board.taskCount, date: archivedOn(board.archivedAt) })}
                  </span>
                </span>
                <Button
                  aria-label={t('archives.restoreLabel', { name: board.name })}
                  ref={(element) => {
                    if (element) restoreButtons.current.set(board.id, element);
                    else restoreButtons.current.delete(board.id);
                  }}
                  onClick={() => restore(index)}
                >
                  <RotateCcw size={14} aria-hidden />
                  {t('archives.restore')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

/** The Archives route: archived boards with restore, the restored board going to the end of the sidebar. */
export function ArchivesPage() {
  const { t } = useTranslation();
  const { data: boards, isError, refetch } = useArchivedBoards();
  const restoreBoard = useRestoreBoard();
  return (
    <Archives
      boards={boards}
      loadError={isError && !boards}
      onRetry={() => void refetch()}
      onRestore={(id) => {
        const name = boards?.find((board) => board.id === id)?.name ?? '';
        restoreBoard.mutate(id, {
          onSuccess: () => useFeedback.getState().announce(t('archives.restored', { name })),
        });
      }}
    />
  );
}
