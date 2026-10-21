import type { BoardDetail, Task } from '@ordo/contracts';
import { canDeleteColumn, visibleCount, type MoveDirection } from '@ordo/domain';
import { ChevronDown, Moon, Plus, SquareKanban, Sun } from 'lucide-react';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CARD_MOVE_HINT_ID,
  cardDropDataForBoard,
  isTaskDrag,
  TaskDetail,
  useTaskMoves,
  useTaskUi,
} from '@renderer/features/tasks';
import { FilterBar, useBoardFiltering } from '@renderer/features/search';
import { altKey } from '@renderer/shared/lib/platform';
import { useResolvedMode, useAppearance } from '@renderer/shared/appearance/store';
import { useLayout } from '@renderer/shared/layout/store';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { useNow } from '@renderer/shared/lib/useNow';
import { Button } from '@renderer/shared/ui/button';
import { Kbd } from '@renderer/shared/ui/kbd';
import { cardNavigationTarget } from '../dnd/cardNavigation';
import { COLUMN_DRAG, useColumnDrag, useColumnMoves } from '../dnd/useColumnMoves';
import { BoardColumn, ColumnSlot } from './BoardColumn';
import { ColumnSettings } from './ColumnSettings';

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

  // A card created by quick add under filters stays shown until the filters (applied or previewed) change.
  const keptTaskIds = useTaskUi((state) => state.keptTaskIds);
  const { filters, filtered, pending, visibleTasks } = useBoardFiltering(board, today, keptTaskIds);
  // Before paint: no frame shows the kept cards under the new filters.
  useLayoutEffect(() => {
    useTaskUi.getState().clearKeptTasks();
  }, [filters, board.id]);
  const countByColumn = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of board.tasks) map.set(task.columnId, (map.get(task.columnId) ?? 0) + 1);
    return map;
  }, [board.tasks]);

  // The cards shown under the filters: drag and drop, keyboard moves and navigation work on them.
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      const list = map.get(task.columnId);
      if (list) list.push(task);
      else map.set(task.columnId, [task]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    return map;
  }, [visibleTasks]);

  const usedColors = useMemo(() => board.columns.map((c) => c.color), [board.columns]);
  const canDelete = canDeleteColumn(board.columns.length);

  const taskMoves = useTaskMoves(board, tasksByColumn);
  const columnMoves = useColumnMoves(board);

  // Plain arrows between the cards on screen (past the display limit, hidden cards are skipped).
  const latest = useRef({ columns: board.columns, tasksByColumn });
  useEffect(() => {
    latest.current = { columns: board.columns, tasksByColumn };
  });
  const navigate = useCallback((taskId: string, direction: MoveDirection) => {
    const { columns, tasksByColumn: byColumn } = latest.current;
    const expanded = useTaskUi.getState().expandedColumnIds;
    const layout = columns.map((column) => {
      const ids = (byColumn.get(column.id) ?? []).map((task) => task.id);
      const shown = expanded.has(column.id)
        ? ids.length
        : visibleCount(ids.length, column.displayLimit).shown;
      return { id: column.id, taskIds: ids.slice(0, shown) };
    });
    return cardNavigationTarget(layout, taskId, direction);
  }, []);
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
        // Columns land past the last one; cards keep their slot while crossing the gaps.
        canDrop: ({ source }) => source.data['type'] === COLUMN_DRAG.column || isTaskDrag(source.data),
        getData: ({ source }) =>
          isTaskDrag(source.data) ? cardDropDataForBoard() : { type: COLUMN_DRAG.area },
      }),
    );
  }, []);

  // The palette's "Nouvelle colonne" opens the popover under "+ Nouvelle colonne", as a click would.
  const newColumnButton = useRef<HTMLButtonElement>(null);
  const newColumnRequest = useLayout((state) => state.newColumnRequest);
  const seenColumnRequest = useRef(newColumnRequest);
  useEffect(() => {
    if (newColumnRequest === seenColumnRequest.current) return;
    seenColumnRequest.current = newColumnRequest;
    const button = newColumnButton.current;
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    button?.click();
  }, [newColumnRequest]);

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

      <FilterBar board={board} today={today} shownCount={visibleTasks.length} filtered={filtered} />

      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 items-stretch gap-7 overflow-x-auto px-6 pt-5.5 pb-6"
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
              totalCount={countByColumn.get(column.id) ?? 0}
              filtered={filtered}
              filterPending={pending}
              today={today}
              emptyHint={empty ? (first ? 'first' : 'other') : null}
              usedColors={usedColors}
              canDelete={canDelete}
              onKeyboardMoveTask={taskMoves.moveWithKeyboard}
              onKeyboardMoveColumn={columnMoves.moveWithKeyboard}
              onNavigateTask={navigate}
            />
          );
        })}
        <ColumnSettings
          boardId={board.id}
          column={null}
          usedColors={usedColors}
          taskCount={0}
          canDelete={false}
          align="start"
          trigger={
            <button
              ref={newColumnButton}
              type="button"
              className="flex h-10 w-45 shrink-0 cursor-pointer items-center gap-2 rounded-card px-1 text-text-3 hover:bg-rail data-[state=open]:bg-accent-soft data-[state=open]:text-accent data-[state=open]:outline-2 data-[state=open]:outline-accent"
            >
              <Plus size={16} aria-hidden />
              {t('board.newColumn')}
            </button>
          }
        />
      </div>
      <span id={CARD_MOVE_HINT_ID} hidden>
        {t('dnd.cardHint', { alt: altKey() })}
      </span>
      <TaskDetail board={board} today={today} />
    </main>
  );
}
