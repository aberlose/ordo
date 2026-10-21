import type { Column, Task } from '@ordo/contracts';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { visibleCount, type MoveDirection } from '@ordo/domain';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { Kbd } from '@renderer/shared/ui/kbd';
import { DRAG, isTaskDrag, useTaskDrag, type TaskDragData } from '../dnd/state';
import { useCreateTask } from '../hooks/mutations';
import { useTagLooks, type TagLook } from '../hooks/tags';
import { useTaskUi } from '../store';
import { QuickAdd } from './QuickAdd';
import { TaskCard, TEMP_ID_PREFIX } from './TaskCard';

let tempCounter = 0;
const HIGHLIGHT_MS = 1600;
/** Estimated card height (px) before measuring; cards are measured once rendered. */
const ESTIMATED_CARD = 72;
/** Gap between cards (px): `gap-2.5`, as in the board mockup. */
const GAP = 10;
/** Drag preview (mockup drag-and-drop/CardDrag B: straight, accent border; no shadow, asked 2026-10-14). */
const PREVIEW_CLASSES = ['border-accent', 'shadow-none'];
/** Classes of a card's transient states, dropped from its drag preview. */
const TRANSIENT_CLASSES = ['bg-accent-soft/70', 'border-accent/35', 'shadow-card'];

const ARROWS: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

type Row = { kind: 'card'; task: Task } | { kind: 'slot' };

/** Where plain arrows go from a card: the card to focus, or `null` at an edge. */
export type CardNavigate = (
  taskId: string,
  direction: MoveDirection,
) => { taskId: string; columnId: string } | null;

export interface ColumnTasksProps {
  boardId: string;
  column: Column;
  tasks: readonly Task[];
  today: string;
  /** Empty board: the first column shows the call to action, the others a drop hint (mockup empty-states). */
  emptyHint: 'first' | 'other' | null;
  /** ⌥/Alt + arrows on a card. */
  onKeyboardMove: (taskId: string, direction: MoveDirection) => boolean;
  /** Plain arrows on a card: the card to focus next. */
  onNavigate?: CardNavigate | undefined;
  /** Board filters may hide cards: an empty column says that nothing matches (approved board mockup). */
  filtered?: boolean;
}

interface DraggableCardProps {
  task: Task;
  columnId: string;
  color: Column['color'];
  tags: ReadonlyMap<string, TagLook>;
  today: string;
  highlighted: boolean;
  flash: boolean;
  onOpen: (id: string) => void;
  onKeyboardMove: (taskId: string, direction: MoveDirection) => boolean;
  onNavigate: CardNavigate | undefined;
  measure: (element: Element | null) => void;
  index: number;
  start: number;
}

const DraggableCard = memo(function DraggableCard({
  task,
  columnId,
  color,
  tags,
  today,
  highlighted,
  flash,
  onOpen,
  onKeyboardMove,
  onNavigate,
  measure,
  index,
  start,
}: DraggableCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pending = task.id.startsWith(TEMP_ID_PREFIX);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      measure(node);
    },
    [measure],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const direction = ARROWS[event.key];
      if (!direction) return;
      if (event.altKey) {
        event.preventDefault();
        onKeyboardMove(task.id, direction);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      // Plain arrows move the focus; the target column brings the card into view and focuses it.
      event.preventDefault();
      const target = onNavigate?.(task.id, direction);
      if (target) useTaskDrag.setState({ focus: target });
    },
    [onKeyboardMove, onNavigate, task.id],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || pending) return;
    return combine(
      draggable({
        element,
        getInitialData: (): TaskDragData => ({
          type: DRAG.task,
          taskId: task.id,
          columnId,
          height: element.getBoundingClientRect().height,
        }),
        onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
          // The row wrapper is absolutely positioned by the virtual list: snapshot the card itself.
          const card = element.querySelector('button') ?? element;
          const rect = card.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: () => ({
              x: location.current.input.clientX - rect.left,
              y: location.current.input.clientY - rect.top,
            }),
            render: ({ container }) => {
              const clone = card.cloneNode(true) as HTMLElement;
              clone.style.width = `${rect.width}px`;
              clone.style.transform = 'none';
              clone.classList.remove(...TRANSIENT_CLASSES);
              clone.classList.add(...PREVIEW_CLASSES);
              container.appendChild(clone);
            },
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isTaskDrag(source.data),
        getData: ({ input }) =>
          attachClosestEdge(
            { type: DRAG.taskTarget, taskId: task.id, columnId },
            { element, input, allowedEdges: ['top', 'bottom'] },
          ),
      }),
    );
  }, [task.id, columnId, pending]);

  return (
    <div
      ref={setRef}
      data-index={index}
      // Above the next cards while hovered or focused: the "+N" tag bubble overlaps them.
      className="absolute inset-x-0 top-0 focus-within:z-10 hover:z-10"
      style={{ transform: `translateY(${start}px)` }}
    >
      <TaskCard
        task={task}
        tags={tags}
        color={color}
        today={today}
        highlighted={highlighted}
        flash={flash}
        onOpen={onOpen}
        onKeyDown={onKeyDown}
      />
    </div>
  );
});

function Slot({
  columnId,
  height,
  measure,
  index,
  start,
}: {
  columnId: string;
  height: number;
  measure: (element: Element | null) => void;
  index: number;
  start: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      measure(node);
    },
    [measure],
  );
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isTaskDrag(source.data),
      getData: () => ({ type: DRAG.slot, columnId }),
    });
  }, [columnId]);
  return (
    <div
      ref={setRef}
      data-index={index}
      className="absolute inset-x-0 top-0"
      style={{ transform: `translateY(${start}px)` }}
    >
      <div
        aria-hidden
        className="rounded-card border-strong border-dashed border-slot-border bg-slot-fill"
        style={{ height }}
      />
    </div>
  );
}

function EmptyHint({ kind, onAdd }: { kind: 'first' | 'other'; onAdd: () => void }) {
  const { t } = useTranslation();
  if (kind === 'other') {
    return (
      <div className="flex h-19 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-meta text-text-3">
        {t('column.dropHere')}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4.5 py-5.5 text-center">
      <span className="text-sm font-semibold">{t('column.emptyTitle')}</span>
      <span className="text-meta leading-snug text-text-3">
        <Trans i18nKey="column.emptyBody" components={{ kbd: <Kbd /> }} />
      </span>
      <Button variant="soft" className="mt-1" onClick={onAdd}>
        <Plus size={14} strokeWidth={2.4} aria-hidden />
        {t('column.addTask')}
      </Button>
    </div>
  );
}

/**
 * The scrollable body of a column: virtualised cards (TanStack Virtual), the drop slot while a
 * card is dragged over it, then quick add. Approved mockups: board, empty-states, tasks, drag-and-drop.
 */
export const ColumnTasks = memo(function ColumnTasks({
  boardId,
  column,
  tasks,
  today,
  emptyHint,
  onKeyboardMove,
  onNavigate,
  filtered = false,
}: ColumnTasksProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Card holding the focus: kept rendered even when scrolled out of the virtual window. */
  const focusedId = useRef<string | null>(null);
  const open = useTaskUi((state) => state.quickAddColumnId === column.id);
  const focusRequest = useTaskUi((state) =>
    state.quickAddColumnId === column.id ? state.quickAddRequest : 0,
  );
  // Only the column holding the highlighted card re-renders when the highlight changes.
  const highlightedTaskId = useTaskUi((state) =>
    state.highlightedTaskId !== null && tasks.some((t) => t.id === state.highlightedTaskId)
      ? state.highlightedTaskId
      : null,
  );
  const draggingId = useTaskDrag((state) => state.dragging?.taskId ?? null);
  const slotIndex = useTaskDrag((state) =>
    state.target?.columnId === column.id ? state.target.index : null,
  );
  const slotHeight = useTaskDrag((state) => state.dragging?.height ?? ESTIMATED_CARD);
  const flashTaskId = useTaskDrag((state) =>
    state.flashTaskId !== null && tasks.some((t) => t.id === state.flashTaskId) ? state.flashTaskId : null,
  );
  const focusTaskId = useTaskDrag((state) =>
    state.focus?.columnId === column.id ? state.focus.taskId : null,
  );
  const { openQuickAdd, closeQuickAdd, openTask, highlight } = useTaskUi.getState();
  const create = useCreateTask(boardId);
  const tags = useTagLooks(boardId);

  const expanded = useTaskUi((state) => state.expandedColumnIds.has(column.id));

  // Past the display limit the column ends with "Voir N de plus" until expanded (mockup column-settings/ColumnStates B).
  const { rows, hidden } = useMemo(() => {
    const remaining = tasks.filter((t) => t.id !== draggingId);
    const { shown, hidden } = expanded
      ? { shown: remaining.length, hidden: 0 }
      : visibleCount(remaining.length, column.displayLimit);
    const cards: Row[] = remaining.slice(0, shown).map((task) => ({ kind: 'card', task }));
    if (slotIndex !== null) cards.splice(Math.min(slotIndex, cards.length), 0, { kind: 'slot' });
    return { rows: cards, hidden };
  }, [tasks, draggingId, slotIndex, expanded, column.displayLimit]);

  // TanStack Virtual returns functions the React Compiler cannot memoise; this component is memoised by hand.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === 'slot' ? slotHeight : ESTIMATED_CARD),
    getItemKey: (i) => {
      const row = rows[i];
      return row?.kind === 'card' ? row.task.id : 'slot';
    },
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      const focused = focusedId.current;
      const index = focused ? rows.findIndex((r) => r.kind === 'card' && r.task.id === focused) : -1;
      return index === -1 || indexes.includes(index) ? indexes : [...indexes, index].sort((a, b) => a - b);
    },
    gap: GAP,
    overscan: 6,
  });

  // The column body accepts cards (drop below the last card) and scrolls while dragging near its edges.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    return combine(
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isTaskDrag(source.data),
        getData: () => ({ type: DRAG.columnBody, columnId: column.id }),
      }),
      autoScrollForElements({ element, canScroll: ({ source }) => isTaskDrag(source.data) }),
    );
  }, [column.id]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const timer = setTimeout(() => highlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedTaskId, highlight]);

  // After a keyboard move, bring the card into view and give it the focus back. Runs after each
  // render until the card is mounted (it may first need to be scrolled into the virtual window).
  useEffect(() => {
    if (!focusTaskId) return;
    const index = rows.findIndex((row) => row.kind === 'card' && row.task.id === focusTaskId);
    if (index === -1) return;
    const element = scrollRef.current?.querySelector<HTMLElement>(`[data-task-id="${focusTaskId}"]`);
    if (element) {
      // Keep the visible focus ring after a keyboard move (FocusOptions.focusVisible).
      element.focus({ focusVisible: true } as FocusOptions);
      useTaskDrag.getState().focused();
    } else {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }
  });

  return (
    // Side and top padding offset by negative margins, bottom padding inside: room for the hover
    // shadow and focus ring (4 px, plus the 1 px hover lift), which the scroll area would clip, without breaking the 24 px bottom gap.
    // The scroll padding keeps a focused card clear of the keyboard help bar.
    <div
      ref={scrollRef}
      onFocus={(event) => {
        focusedId.current = (event.target as HTMLElement).dataset['taskId'] ?? null;
      }}
      onBlur={() => {
        focusedId.current = null;
      }}
      className={cn(
        '-mx-4 -mt-2 flex min-h-0 scroll-pb-16 flex-col gap-2.5 overflow-y-auto rounded-xl px-4 pt-2 pb-6 transition-colors',
        slotIndex !== null && 'bg-drop-tint',
      )}
    >
      {emptyHint && !open && <EmptyHint kind={emptyHint} onAdd={() => openQuickAdd(column.id)} />}
      {!emptyHint && filtered && tasks.length === 0 && (
        <div className="shrink-0 rounded-card border border-dashed border-border-strong px-3 py-4.5 text-center text-meta text-text-3">
          {t('filters.noMatch')}
        </div>
      )}
      {rows.length > 0 && (
        <div className="relative w-full shrink-0" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return row.kind === 'slot' ? (
              <Slot
                key="slot"
                columnId={column.id}
                height={slotHeight}
                measure={virtualizer.measureElement}
                index={item.index}
                start={item.start}
              />
            ) : (
              <DraggableCard
                key={row.task.id}
                task={row.task}
                columnId={column.id}
                color={column.color}
                tags={tags}
                today={today}
                highlighted={row.task.id === highlightedTaskId}
                flash={row.task.id === flashTaskId}
                onOpen={openTask}
                onKeyboardMove={onKeyboardMove}
                onNavigate={onNavigate}
                measure={virtualizer.measureElement}
                index={item.index}
                start={item.start}
              />
            );
          })}
        </div>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(event) => {
            // From the keyboard, the focus goes to the first card revealed (the button disappears).
            const first = event.detail === 0 ? rows.filter((r) => r.kind === 'card').length : -1;
            const revealed = tasks.filter((t) => t.id !== draggingId)[first];
            useTaskUi.getState().setColumnExpanded(column.id, true);
            if (revealed) useTaskDrag.setState({ focus: { taskId: revealed.id, columnId: column.id } });
          }}
          className="flex h-8.5 shrink-0 cursor-pointer items-center justify-center rounded-card bg-rail text-meta text-text-2 hover:text-text"
        >
          {t('column.showMore', { count: hidden })}
        </button>
      )}
      {(open || emptyHint === null) && (
        <QuickAdd
          open={open}
          focusRequest={focusRequest}
          onOpen={() => openQuickAdd(column.id)}
          onClose={closeQuickAdd}
          onSubmit={(title) => {
            const tempId = `${TEMP_ID_PREFIX}${++tempCounter}`;
            // The new task goes to the bottom: show it even past the display limit.
            if (column.displayLimit !== null && tasks.length >= column.displayLimit) {
              useTaskUi.getState().setColumnExpanded(column.id, true);
            }
            highlight(tempId);
            create.mutate(
              { columnId: column.id, title, tempId },
              {
                onSuccess: (task) => useTaskUi.getState().highlightedTaskId === tempId && highlight(task.id),
              },
            );
          }}
        />
      )}
    </div>
  );
});
