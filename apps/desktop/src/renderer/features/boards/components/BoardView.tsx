import type { BoardDetail, Task } from '@ordo/contracts';
import { ChevronDown, Moon, Plus, SquareKanban, Sun } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ColumnTasks, TaskDetail, useTaskUi } from '@renderer/features/tasks';
import { useResolvedMode, useAppearance } from '@renderer/shared/appearance/store';
import { cn } from '@renderer/shared/lib/cn';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { useNow } from '@renderer/shared/lib/useNow';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { Kbd } from '@renderer/shared/ui/kbd';

export interface BoardViewProps {
  board: BoardDetail;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Approved mockups: docs/design/mockups/board, empty-states (new board) and tasks. */
export function BoardView({ board }: BoardViewProps) {
  const { t } = useTranslation();
  const setMode = useAppearance((state) => state.setMode);
  const dark = useResolvedMode() === 'dark';
  const empty = board.tasks.length === 0;
  const today = todayDay(new Date(useNow()));
  const openQuickAdd = useTaskUi((state) => state.openQuickAdd);
  const quickAddColumnId = useTaskUi((state) => state.quickAddColumnId);
  const firstColumnId = board.columns[0]?.id;

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of board.tasks) {
      const list = map.get(task.columnId);
      if (list) list.push(task);
      else map.set(task.columnId, [task]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    return map;
  }, [board.tasks]);

  // N opens quick add in the first column (full shortcut system: lot 7).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('[role="dialog"]')) return;
      if (!firstColumnId) return;
      event.preventDefault();
      openQuickAdd(firstColumnId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [firstColumnId, openQuickAdd]);

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
        <Button variant="primary" onClick={() => firstColumnId && openQuickAdd(firstColumnId)}>
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
        <span className="text-meta text-text-3">{t('board.taskCount', { count: board.tasks.length })}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-7 overflow-x-auto px-6 pt-5.5 pb-6">
        {board.columns.map((column, index) => {
          const tasks = tasksByColumn.get(column.id) ?? [];
          const quickAddOpen = quickAddColumnId === column.id;
          return (
            <section
              key={column.id}
              aria-label={column.name}
              className="flex max-h-full w-column shrink-0 flex-col gap-3"
            >
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
                <span className="text-meta text-text-3 tabular-nums">{tasks.length}</span>
                <div className="flex-1" />
                <button
                  type="button"
                  aria-label={t('column.addTaskIn', { column: column.name })}
                  onClick={() => openQuickAdd(column.id)}
                  className="flex rounded-md p-1 text-text-3 hover:bg-rail hover:text-text-2"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>
              {/* Side and top padding offset by negative margins, bottom padding inside: room for the hover
                  shadow and focus ring, which the scroll area would clip, without breaking the 24 px bottom gap. */}
              <div className="-mx-4 -mt-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto px-4 pt-1 pb-6">
                {empty && !quickAddOpen && index === 0 && (
                  <div className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4.5 py-5.5 text-center">
                    <span className="text-sm font-semibold">{t('column.emptyTitle')}</span>
                    <span className="text-meta leading-snug text-text-3">
                      <Trans i18nKey="column.emptyBody" components={{ kbd: <Kbd /> }} />
                    </span>
                    <Button variant="soft" className="mt-1" onClick={() => openQuickAdd(column.id)}>
                      <Plus size={14} strokeWidth={2.4} aria-hidden />
                      {t('column.addTask')}
                    </Button>
                  </div>
                )}
                {empty && !quickAddOpen && index > 0 && (
                  <div className="flex h-19 items-center justify-center rounded-xl border-2 border-dashed border-border text-meta text-text-3">
                    {t('column.dropHere')}
                  </div>
                )}
                <ColumnTasks
                  boardId={board.id}
                  column={column}
                  tasks={tasks}
                  today={today}
                  hideAddLink={empty}
                />
              </div>
            </section>
          );
        })}
        <button
          type="button"
          className="flex h-10 w-45 shrink-0 items-center gap-2 rounded-card px-1 text-text-3 hover:bg-rail"
        >
          <Plus size={16} aria-hidden />
          {t('board.newColumn')}
        </button>
      </div>
      <TaskDetail board={board} today={today} />
    </main>
  );
}
