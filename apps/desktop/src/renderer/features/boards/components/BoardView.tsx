import type { BoardDetail, Task } from '@ordo/contracts';
import { ChevronDown, Moon, Plus, SquareKanban, Sun } from 'lucide-react';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_MOVE_HINT_ID, TaskDetail, useTaskMoves, useTaskUi } from '@renderer/features/tasks';
import { altKey } from '@renderer/shared/lib/platform';
import { useResolvedMode, useAppearance } from '@renderer/shared/appearance/store';
import { cn } from '@renderer/shared/lib/cn';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { useNow } from '@renderer/shared/lib/useNow';
import { Button } from '@renderer/shared/ui/button';
import { Kbd } from '@renderer/shared/ui/kbd';
import { KeyboardHelp } from '@renderer/shared/ui/keyboard-help';
import { COLUMN_DRAG, useColumnDrag, useColumnMoves } from '../dnd/useColumnMoves';
import { BoardColumn, ColumnSlot } from './BoardColumn';

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

  const taskMoves = useTaskMoves(board, tasksByColumn);
  const columnMoves = useColumnMoves(board);
  const draggingColumnId = useColumnDrag((state) => state.draggingId);
  const columnTargetIndex = useColumnDrag((state) => state.targetIndex);

  // While a column is dragged it leaves its place and a slot opens at the destination (mockup ColumnDrag B).
  const columnsToShow = useMemo(() => {
    const list: (BoardDetail['columns'][number] | 'slot')[] = board.columns.filter(
      (c) => c.id !== draggingColumnId,
    );
    if (draggingColumnId && columnTargetIndex !== null) list.splice(columnTargetIndex, 0, 'slot');
    return list;
  }, [board.columns, draggingColumnId, columnTargetIndex]);

  // The board scrolls sideways while dragging near its edges, and accepts columns past the last one.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    return combine(
      autoScrollForElements({ element }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source.data['type'] === COLUMN_DRAG.column,
        getData: () => ({ type: COLUMN_DRAG.area }),
      }),
    );
  }, []);

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
    <main className="relative flex min-w-0 flex-1 flex-col">
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

      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 items-start gap-7 overflow-x-auto px-6 pt-5.5 pb-6"
      >
        {columnsToShow.map((entry, index) => {
          if (entry === 'slot') return <ColumnSlot key="column-slot" />;
          const column = entry;
          const tasks = tasksByColumn.get(column.id) ?? [];
          const first = index === 0 || (index === 1 && columnsToShow[0] === 'slot');
          return (
            <BoardColumn
              key={column.id}
              boardId={board.id}
              column={column}
              tasks={tasks}
              today={today}
              emptyHint={empty ? (first ? 'first' : 'other') : null}
              onKeyboardMoveTask={taskMoves.moveWithKeyboard}
              onKeyboardMoveColumn={columnMoves.moveWithKeyboard}
            />
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
      <KeyboardHelp />
      <span id={CARD_MOVE_HINT_ID} hidden>
        {t('dnd.cardHint', { alt: altKey() })}
      </span>
      <TaskDetail board={board} today={today} />
    </main>
  );
}
