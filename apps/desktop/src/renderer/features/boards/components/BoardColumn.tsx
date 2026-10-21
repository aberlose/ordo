import type { Column, Task } from '@ordo/contracts';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { ColumnColor, MoveDirection } from '@ordo/domain';
import { ChevronUp, Ellipsis, Plus } from 'lucide-react';
import { memo, useEffect, useRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { cardDropDataForColumn, ColumnTasks, isTaskDrag, useTaskUi } from '@renderer/features/tasks';
import { keyboardTargetHandlers } from '@renderer/shared/keyboard/focus';
import { altKey } from '@renderer/shared/lib/platform';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { COLUMN_DRAG, isColumnDrag, useColumnDrag } from '../dnd/useColumnMoves';
import { ColumnSettings } from './ColumnSettings';

/** Classes of the column drag preview (mockup drag-and-drop/ColumnDrag B: straight, accent outline). */
const PREVIEW_CLASSES = ['rounded-xl', 'bg-canvas', 'p-2.5', 'ring-[1.5px]', 'ring-accent'];
const PREVIEW_PADDING = 24;
const PREVIEW_MAX_HEIGHT = 420;

const headerFocus = keyboardTargetHandlers('column');

/** Small icon button of the column header; highlighted while its popover is open (approved popover mockup). */
export const HEADER_BUTTON =
  'flex cursor-pointer rounded-md p-1 text-text-3 hover:bg-rail hover:text-text-2 data-[state=open]:bg-accent-soft data-[state=open]:text-accent data-[state=open]:outline-2 data-[state=open]:outline-accent';

export interface BoardColumnProps {
  boardId: string;
  column: Column;
  /** The column's cards shown under the board filters. */
  tasks: readonly Task[];
  /** Every card of the column, filtered or not (delete confirmation). */
  totalCount?: number;
  /** Board filters may hide cards. */
  filtered?: boolean;
  /** The filters' text result is on its way. */
  filterPending?: boolean;
  today: string;
  /** Empty board: call to action in the first column, drop hint in the others. */
  emptyHint: 'first' | 'other' | null;
  /** Colours of the board's columns, for the settings popover. */
  usedColors: readonly ColumnColor[];
  /** False for the last column of the board. */
  canDelete: boolean;
  onKeyboardMoveTask: (taskId: string, direction: MoveDirection) => boolean;
  onKeyboardMoveColumn: (columnId: string, direction: 'left' | 'right') => boolean;
  /** Plain arrows on a card. */
  onNavigateTask?: ComponentProps<typeof ColumnTasks>['onNavigate'];
}

/**
 * One column of the board. The whole header is the drag handle and takes ⌥/Alt + ←→ when focused
 * (approved mockup: drag-and-drop/ColumnDrag B).
 */
export const BoardColumn = memo(
  function BoardColumn({
    boardId,
    column,
    tasks,
    totalCount = tasks.length,
    filtered = false,
    filterPending = false,
    today,
    emptyHint,
    usedColors,
    canDelete,
    onKeyboardMoveTask,
    onKeyboardMoveColumn,
    onNavigateTask,
  }: BoardColumnProps) {
    const { t } = useTranslation();
    const sectionRef = useRef<HTMLElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const openQuickAdd = useTaskUi((state) => state.openQuickAdd);
    const focusRequested = useColumnDrag((state) => state.focusId === column.id);
    // "Replier" shows once a column past its display limit is expanded (mockup column-settings/ColumnStates B).
    const foldable = useTaskUi(
      (state) =>
        state.expandedColumnIds.has(column.id) &&
        column.displayLimit !== null &&
        tasks.length > column.displayLimit,
    );

    useEffect(() => {
      const element = sectionRef.current;
      const dragHandle = headerRef.current;
      if (!element || !dragHandle) return;
      return combine(
        draggable({
          element,
          dragHandle,
          getInitialData: () => ({ type: COLUMN_DRAG.column, columnId: column.id }),
          onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
            const rect = element.getBoundingClientRect();
            setCustomNativeDragPreview({
              nativeSetDragImage,
              getOffset: () => ({
                x: location.current.input.clientX - rect.left + PREVIEW_PADDING,
                y: location.current.input.clientY - rect.top + PREVIEW_PADDING,
              }),
              render: ({ container }) => {
                const clone = element.cloneNode(true) as HTMLElement;
                clone.style.width = `${rect.width}px`;
                clone.style.maxHeight = `${PREVIEW_MAX_HEIGHT}px`;
                clone.style.overflow = 'hidden';
                clone.classList.add(...PREVIEW_CLASSES);
                container.style.padding = `${PREVIEW_PADDING}px`;
                container.appendChild(clone);
              },
            });
          },
        }),
        // One registration for both: columns reorder around it, cards land in it.
        dropTargetForElements({
          element,
          canDrop: ({ source }) => isColumnDrag(source.data) || isTaskDrag(source.data),
          getData: ({ input, source }) =>
            isTaskDrag(source.data)
              ? cardDropDataForColumn(column.id)
              : attachClosestEdge(
                  { type: COLUMN_DRAG.columnTarget, columnId: column.id },
                  { element, input, allowedEdges: ['left', 'right'] },
                ),
        }),
      );
    }, [column.id]);

    useEffect(() => {
      if (!focusRequested) return;
      headerRef.current?.focus({ focusVisible: true } as FocusOptions);
      useColumnDrag.getState().set({ focusId: null });
    }, [focusRequested]);

    return (
      <section
        ref={sectionRef}
        aria-label={column.name}
        data-column-id={column.id}
        className="flex max-h-full w-column shrink-0 flex-col gap-3"
      >
        <div
          ref={headerRef}
          tabIndex={0}
          role="group"
          aria-roledescription={t('dnd.column.role')}
          aria-label={t('dnd.column.label', { column: column.name, count: tasks.length, alt: altKey() })}
          onKeyDown={(event) => {
            // Keys typed in the header buttons and in the settings popover (a React portal) bubble here.
            if (event.target !== event.currentTarget) return;
            if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
            event.preventDefault();
            onKeyboardMoveColumn(column.id, event.key === 'ArrowLeft' ? 'left' : 'right');
          }}
          {...headerFocus}
          className="flex cursor-grab items-center gap-2.5 rounded-t-md border-b-2 px-0.5 pb-2.5 active:cursor-grabbing"
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
          {foldable && (
            <button
              type="button"
              aria-label={t('column.foldLabel', { column: column.name })}
              onClick={(event) => {
                useTaskUi.getState().setColumnExpanded(column.id, false);
                // The button disappears: from the keyboard, the focus goes back to the header.
                if (event.detail === 0) headerRef.current?.focus();
              }}
              className="flex h-6 cursor-pointer items-center gap-1 rounded-md bg-accent-soft px-2 text-small font-semibold text-accent hover:brightness-95"
            >
              <ChevronUp size={12} strokeWidth={2.4} aria-hidden />
              {t('column.fold')}
            </button>
          )}
          <button
            type="button"
            aria-label={t('column.addTaskIn', { column: column.name })}
            onClick={() => openQuickAdd(column.id)}
            className={HEADER_BUTTON}
          >
            <Plus size={16} aria-hidden />
          </button>
          <ColumnSettings
            boardId={boardId}
            column={column}
            usedColors={usedColors}
            taskCount={totalCount}
            canDelete={canDelete}
            trigger={
              <button
                type="button"
                aria-label={t('columnSettings.open', { column: column.name })}
                className={HEADER_BUTTON}
              >
                <Ellipsis size={16} aria-hidden />
              </button>
            }
          />
        </div>
        <ColumnTasks
          boardId={boardId}
          column={column}
          tasks={tasks}
          today={today}
          emptyHint={emptyHint}
          onKeyboardMove={onKeyboardMoveTask}
          onNavigate={onNavigateTask}
          filtered={filtered}
          filterPending={filterPending}
        />
      </section>
    );
  },
  // A column re-renders only when its own cards changed: the board rebuilds every column's array on each change.
  (previous, next) =>
    previous.column === next.column &&
    previous.today === next.today &&
    previous.emptyHint === next.emptyHint &&
    previous.usedColors === next.usedColors &&
    previous.canDelete === next.canDelete &&
    previous.boardId === next.boardId &&
    previous.onKeyboardMoveTask === next.onKeyboardMoveTask &&
    previous.onKeyboardMoveColumn === next.onKeyboardMoveColumn &&
    previous.onNavigateTask === next.onNavigateTask &&
    previous.totalCount === next.totalCount &&
    previous.filtered === next.filtered &&
    previous.filterPending === next.filterPending &&
    previous.tasks.length === next.tasks.length &&
    previous.tasks.every((task, i) => task === next.tasks[i]),
);

/** Where a dragged column will land (mockup drag-and-drop/ColumnDrag B). */
export function ColumnSlot() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isColumnDrag(source.data),
      getData: () => ({ type: COLUMN_DRAG.slot }),
    });
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="h-full min-h-60 w-column shrink-0 rounded-xl border-strong border-dashed border-slot-border bg-slot-fill"
    />
  );
}
