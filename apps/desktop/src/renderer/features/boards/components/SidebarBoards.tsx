import type { BoardSummary } from '@ordo/contracts';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { normalizeBoardName, type ColumnColor } from '@ordo/domain';
import { Ellipsis } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { keyboardTargetHandlers } from '@renderer/shared/keyboard/focus';
import { cn } from '@renderer/shared/lib/cn';
import { columnColorVar, columnTextColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { Popover, PopoverAnchor } from '@renderer/shared/ui/popover';
import { BOARD_DRAG, isBoardDrag, useBoardDrag } from '../dnd/useBoardMoves';
import { BoardDuplicateContent } from './BoardDuplicate';
import { BoardMenu, type BoardAction } from './BoardMenu';
import { BoardSettingsContent, type BoardStyle } from './BoardSettings';

/** Classes of the drag previews (mockup boards/BoardReorder A: straight, accent border). */
const ROW_PREVIEW = ['rounded-md', 'border-strong', 'border-accent', 'bg-surface', 'text-text'];
const TILE_PREVIEW = ['border-strong', 'border-accent', 'bg-surface'];

const boardFocus = keyboardTargetHandlers('board');

/** Colour of a board's icon and initials; boards created before lot 4 have none. */
export const boardColorVar = (color: ColumnColor | null): string =>
  color ? columnColorVar(color) : 'var(--accent)';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** What a row can do; the sidebar runs the mutations so they outlive the row's popovers. */
export interface BoardRowActions {
  onSelect: (id: string) => void;
  onRename: (board: BoardSummary, name: string) => void;
  onRestyle: (board: BoardSummary, style: BoardStyle) => void;
  onDuplicate: (board: BoardSummary, copy: { name: string; includeTasks: boolean }) => void;
  onArchive: (board: BoardSummary) => void;
  onKeyboardMove: (id: string, direction: 'up' | 'down') => boolean;
}

/** ⌥/Alt + ↑↓ moves the focused board; returns true when the key was handled. */
function moveKey(event: KeyboardEvent, id: string, onKeyboardMove: BoardRowActions['onKeyboardMove']) {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return false;
  event.preventDefault();
  onKeyboardMove(id, event.key === 'ArrowUp' ? 'up' : 'down');
  return true;
}

/** Draggable element that is also a drop target, edges on top and bottom (one registration). */
function useBoardDragAndDrop(
  ref: RefObject<HTMLElement | null>,
  boardId: string,
  previewClasses: readonly string[],
  enabled: boolean,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: BOARD_DRAG.board, boardId }),
        onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
          const rect = element.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: () => ({
              x: location.current.input.clientX - rect.left,
              y: location.current.input.clientY - rect.top,
            }),
            render: ({ container }) => {
              const clone = element.cloneNode(true) as HTMLElement;
              clone.style.width = `${rect.width}px`;
              clone.classList.add(...previewClasses);
              container.appendChild(clone);
            },
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isBoardDrag(source.data),
        getData: ({ input }) =>
          attachClosestEdge(
            { type: BOARD_DRAG.boardTarget, boardId },
            { element, input, allowedEdges: ['top', 'bottom'] },
          ),
      }),
    );
  }, [ref, boardId, previewClasses, enabled]);
}

/** Focus requested after a keyboard move or an archive (the row may have been re-created). */
function useFocusRequest(boardId: string, target: RefObject<HTMLElement | null>) {
  const requested = useBoardDrag((state) => state.focusId === boardId);
  useEffect(() => {
    if (!requested) return;
    target.current?.focus({ focusVisible: true } as FocusOptions);
    useBoardDrag.getState().set({ focusId: null });
  }, [requested, target]);
}

export interface BoardRowProps extends BoardRowActions {
  board: BoardSummary;
  active: boolean;
  /** Colours of the boards in the sidebar, for the icon and colour popover. */
  usedColors: readonly (ColumnColor | null)[];
  /** Hidden while dragged: the list closes up around it. */
  dragging: boolean;
  /** Id of the hidden keyboard hint (⌥/Alt + ↑↓, F2). */
  hintId: string;
  /** Initial state (stories, tests). */
  defaultState?: 'menu' | 'rename' | 'style' | 'duplicate';
}

/**
 * A board of the open sidebar (approved mockups boards/BoardMenu A and BoardReorder A): on hover or
 * focus a ⋯ button replaces the task count; right click opens the same menu; F2 renames in place;
 * the row is draggable and ⌥/Alt + ↑↓ moves it.
 */
export function BoardRow({
  board,
  active,
  usedColors,
  dragging,
  hintId,
  defaultState,
  onSelect,
  onRename,
  onRestyle,
  onDuplicate,
  onArchive,
  onKeyboardMove,
}: BoardRowProps) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(defaultState === 'menu');
  const [renaming, setRenaming] = useState(defaultState === 'rename');
  const [popover, setPopover] = useState<'style' | 'duplicate' | null>(
    defaultState === 'style' || defaultState === 'duplicate' ? defaultState : null,
  );
  const colorVar = boardColorVar(board.color);
  /** Enter and Escape in the rename field give the focus back to the row once it is back. */
  const refocusRow = useRef(false);
  useEffect(() => {
    if (renaming || !refocusRow.current) return;
    refocusRow.current = false;
    buttonRef.current?.focus();
  }, [renaming]);

  useBoardDragAndDrop(rowRef, board.id, ROW_PREVIEW, !renaming);
  useFocusRequest(board.id, buttonRef);

  const run = (action: BoardAction) => {
    if (action === 'rename') setRenaming(true);
    else if (action === 'archive') onArchive(board);
    else setPopover(action);
  };

  const endRename = (name: string | null, refocus: boolean) => {
    refocusRow.current = refocus;
    setRenaming(false);
    const normalized = name === null ? '' : normalizeBoardName(name);
    if (normalized && normalized !== board.name) onRename(board, normalized);
  };

  const closePopover = () => setPopover(null);

  return (
    <Popover open={popover !== null} onOpenChange={(open) => !open && closePopover()}>
      <div
        ref={rowRef}
        data-board-id={board.id}
        onContextMenu={(event) => {
          if (renaming) return;
          event.preventDefault();
          setMenuOpen(true);
        }}
        className={cn('group relative shrink-0', dragging && 'hidden')}
      >
        {renaming ? (
          <RenameField board={board} colorVar={colorVar} onEnd={endRename} />
        ) : (
          <button
            ref={buttonRef}
            type="button"
            aria-current={active ? 'page' : undefined}
            aria-describedby={hintId}
            onClick={() => onSelect(board.id)}
            onKeyDown={(event) => {
              if (moveKey(event, board.id, onKeyboardMove)) return;
              if (event.key === 'F2') {
                event.preventDefault();
                setRenaming(true);
              }
            }}
            {...boardFocus}
            className={cn(
              'flex h-7.5 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-text-2 group-focus-within:pr-8 group-hover:bg-rail group-hover:pr-8 focus-visible:bg-accent-soft focus-visible:text-text focus-visible:-outline-offset-1',
              // Menu open: the hover background, even on the active row (mockup boards/BoardMenu A).
              menuOpen
                ? 'bg-rail pr-8 text-text group-hover:bg-rail'
                : active && 'bg-accent-soft font-medium text-text group-hover:bg-accent-soft',
            )}
          >
            <ColumnIcon
              icon={board.icon ?? 'kanban'}
              size={14}
              strokeWidth={2.2}
              style={{ color: colorVar }}
            />
            <span className="flex-1 truncate">{board.name}</span>
            <span
              className={cn(
                'text-small text-text-3 tabular-nums group-focus-within:hidden group-hover:hidden',
                menuOpen && 'hidden',
              )}
            >
              {board.taskCount}
            </span>
          </button>
        )}
        {!renaming && (
          <BoardMenu
            name={board.name}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onAction={run}
            trigger={
              <PopoverAnchor asChild>
                <button
                  type="button"
                  aria-label={t('sidebar.boardActions', { name: board.name })}
                  className="absolute top-1 right-1 flex size-5.5 cursor-pointer items-center justify-center rounded-sm text-text-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-text-2 focus-visible:opacity-100 data-[state=open]:bg-accent-soft data-[state=open]:text-accent data-[state=open]:opacity-100"
                >
                  <Ellipsis size={14} aria-hidden />
                </button>
              </PopoverAnchor>
            }
          />
        )}
      </div>
      {popover === 'style' && (
        <BoardSettingsContent
          board={board}
          usedColors={usedColors}
          align="start"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
          onSubmit={(style) => {
            onRestyle(board, style);
            closePopover();
          }}
        />
      )}
      {popover === 'duplicate' && (
        <BoardDuplicateContent
          board={board}
          align="start"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
          onSubmit={(copy) => {
            onDuplicate(board, copy);
            closePopover();
          }}
        />
      )}
    </Popover>
  );
}

/** The row turned into a text field: Enter and blur save, Escape cancels, an empty name cancels. */
function RenameField({
  board,
  colorVar,
  onEnd,
}: {
  board: BoardSummary;
  colorVar: string;
  onEnd: (name: string | null, refocus: boolean) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(board.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const ended = useRef(false);
  // The field replaces the row the user chose to rename: it takes the focus, name selected.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const end = (name: string | null, refocus: boolean) => {
    if (ended.current) return;
    ended.current = true;
    onEnd(name, refocus);
  };
  return (
    <label className="flex h-7.5 items-center gap-2.5 rounded-md border-strong border-accent bg-surface px-1.75 ring-3 ring-accent-soft">
      <ColumnIcon icon={board.icon ?? 'kanban'} size={14} strokeWidth={2.2} style={{ color: colorVar }} />
      <input
        ref={inputRef}
        aria-label={t('sidebar.boardName')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            end(value, true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            end(null, true);
          }
        }}
        onBlur={() => end(value, false)}
        className="min-w-0 flex-1 border-0 bg-transparent text-input text-text outline-none"
      />
    </label>
  );
}

/** Where a dragged board will land (mockup boards/BoardReorder A); keeps the slot under the pointer. */
export function BoardSlot({ tile = false }: { tile?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isBoardDrag(source.data),
      getData: () => ({ type: BOARD_DRAG.slot }),
    });
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'shrink-0 border-strong border-dashed border-slot-border bg-slot-fill',
        tile ? 'size-10 rounded-card' : 'h-7.5 rounded-md',
      )}
    />
  );
}

/** The list of boards accepts drops in its gaps and below the last one. */
export function BoardList({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isBoardDrag(source.data),
      getData: () => ({ type: BOARD_DRAG.list }),
    });
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export interface BoardTileProps {
  board: BoardSummary;
  active: boolean;
  dragging: boolean;
  hintId: string;
  onSelect: (id: string) => void;
  onKeyboardMove: BoardRowActions['onKeyboardMove'];
}

/** A board of the collapsed rail: initials in the board's colour, draggable, ⌥/Alt + ↑↓. */
export function BoardTile({ board, active, dragging, hintId, onSelect, onKeyboardMove }: BoardTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useBoardDragAndDrop(ref, board.id, TILE_PREVIEW, true);
  useFocusRequest(board.id, ref);
  return (
    <button
      ref={ref}
      type="button"
      title={board.name}
      aria-label={board.name}
      aria-current={active ? 'page' : undefined}
      aria-describedby={hintId}
      onClick={() => onSelect(board.id)}
      onKeyDown={(event) => moveKey(event, board.id, onKeyboardMove)}
      {...boardFocus}
      className={cn(
        'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-card text-meta font-semibold hover:bg-rail',
        // Active: a 1 px accent outline 2 px away (mockup boards/BoardReorder A); focus keeps 2 px.
        active &&
          'bg-accent-soft outline-1 outline-offset-2 outline-accent hover:bg-accent-soft focus-visible:outline-2',
        dragging && 'hidden',
      )}
      style={{ color: board.color ? columnTextColorVar(board.color) : 'var(--accent)' }}
    >
      {initials(board.name)}
    </button>
  );
}
