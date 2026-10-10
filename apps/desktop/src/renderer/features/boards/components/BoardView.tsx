import type { BoardDetail } from '@ordo/contracts';
import { ChevronDown, Moon, Plus, SquareKanban, Sun } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useResolvedMode, useAppearance } from '@renderer/shared/appearance/store';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { Kbd } from '@renderer/shared/ui/kbd';

export interface BoardViewProps {
  board: BoardDetail;
}

/** Approved mockups: docs/design/mockups/board and empty-states (new board). Cards come with the tasks feature. */
export function BoardView({ board }: BoardViewProps) {
  const { t } = useTranslation();
  const setMode = useAppearance((state) => state.setMode);
  const dark = useResolvedMode() === 'dark';
  const empty = board.taskCount === 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center gap-2.5 border-b border-border px-6">
        <SquareKanban size={16} className="text-accent" aria-hidden />
        <h1 className="m-0 text-title font-semibold">{board.name}</h1>
        <span className="text-text-3" aria-hidden>
          /
        </span>
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md px-2 text-text-2 hover:bg-rail"
        >
          {t('board.kanban')}
          <ChevronDown size={14} aria-hidden />
        </button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('board.toggleTheme')}
          onClick={() => setMode(dark ? 'light' : 'dark')}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </Button>
        <Button variant="primary">
          {t('board.newTask')}
          <Kbd className="border-transparent bg-kbd-on-accent text-inherit">N</Kbd>
        </Button>
      </header>

      <div className={cn('flex items-center gap-2 border-b border-border px-6 py-3', empty && 'opacity-50')}>
        {[t('board.priority'), t('board.tags'), t('board.due')].map((label) => (
          <button
            key={label}
            type="button"
            disabled={empty}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-border bg-surface pr-2 pl-3 text-meta text-text-2"
          >
            {label}
            <ChevronDown size={14} aria-hidden />
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-meta text-text-3">{t('board.taskCount', { count: board.taskCount })}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-7 overflow-x-auto px-6 pt-5.5 pb-6">
        {board.columns.map((column, index) => (
          <section key={column.id} aria-label={column.name} className="flex w-column shrink-0 flex-col gap-3">
            <div
              className="flex items-center gap-2.5 border-b-2 px-0.5 pb-2.5"
              style={{ borderColor: columnColorVar(column.color) }}
            >
              <ColumnIcon
                icon={column.icon}
                size={16}
                strokeWidth={2.2}
                style={{ color: columnColorVar(column.color) }}
              />
              <h2 className="m-0 text-sm font-semibold">{column.name}</h2>
              <span className="text-meta text-text-3 tabular-nums">0</span>
            </div>
            {index === 0 ? (
              <div className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4.5 py-5.5 text-center">
                <span className="text-sm font-semibold">{t('column.emptyTitle')}</span>
                <span className="text-meta leading-snug text-text-3">
                  <Trans i18nKey="column.emptyBody" components={{ kbd: <Kbd /> }} />
                </span>
                <Button variant="soft" className="mt-1">
                  <Plus size={14} strokeWidth={2.4} aria-hidden />
                  {t('column.addTask')}
                </Button>
              </div>
            ) : (
              <div className="flex h-19 items-center justify-center rounded-xl border-2 border-dashed border-border text-meta text-text-3">
                {t('column.dropHere')}
              </div>
            )}
          </section>
        ))}
        <button
          type="button"
          className="flex h-10 w-45 shrink-0 items-center gap-2 rounded-card px-1 text-text-3 hover:bg-rail"
        >
          <Plus size={16} aria-hidden />
          {t('board.newColumn')}
        </button>
      </div>
    </main>
  );
}
