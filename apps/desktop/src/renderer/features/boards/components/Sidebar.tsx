import type { BoardSummary } from '@ordo/contracts';
import { boardAfterRemoval } from '@ordo/domain';
import {
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '@renderer/shared/feedback/store';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { useLayout } from '@renderer/shared/layout/store';
import { cn } from '@renderer/shared/lib/cn';
import { altKey, modKey } from '@renderer/shared/lib/platform';
import { Kbd } from '@renderer/shared/ui/kbd';
import { useBoardDrag, useBoardMoves } from '../dnd/useBoardMoves';
import { useArchiveBoard, useCreateBoard, useDuplicateBoard, useUpdateBoard } from '../hooks/queries';
import { BoardSettings, type BoardStyle } from './BoardSettings';
import {
  BoardList,
  BoardRow,
  BoardSlot,
  BoardTile,
  type BoardRowActions,
  type BoardRowProps,
} from './SidebarBoards';

export interface SidebarProps {
  boards: readonly BoardSummary[];
  activeBoardId?: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  onSelectBoard: (id: string) => void;
  /** The Archives page is open: its row is the active item, no board is. */
  archivesActive?: boolean;
  onOpenArchives?: () => void;
  /** The last board was archived from the sidebar while it was open. */
  onNoBoardLeft?: () => void;
  /** Initial state of one row (stories). */
  rowState?: { boardId: string; state: NonNullable<BoardRowProps['defaultState']> };
  /** "+" popover opened on first render (stories). */
  createOpen?: boolean;
}

const Logo = ({ large = false }: { large?: boolean }) => (
  <div
    aria-hidden
    className={cn(
      'flex items-center justify-center border-2 border-text font-bold',
      large ? 'size-8 rounded-tile text-meta' : 'size-5.5 rounded-md text-kbd',
    )}
  >
    O
  </div>
);

/** "+" highlighted while its popover is open (approved mockup boards/BoardCreate A). */
const PLUS_OPEN =
  'data-[state=open]:bg-accent-soft data-[state=open]:text-accent data-[state=open]:outline-2 data-[state=open]:outline-accent';

/**
 * Approved mockups: docs/design/mockups/board (sidebar open by default, collapsible to a rail) and
 * boards (create, menu, reorder, archives).
 */
export function Sidebar({
  boards,
  activeBoardId,
  collapsed,
  onToggle,
  onSelectBoard,
  archivesActive = false,
  onOpenArchives,
  onNoBoardLeft,
  rowState,
  createOpen = false,
}: SidebarProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const plusRef = useRef<HTMLButtonElement>(null);
  const create = useCreateBoard();
  const update = useUpdateBoard();
  const duplicate = useDuplicateBoard();
  const archive = useArchiveBoard();
  const { moveWithKeyboard } = useBoardMoves(boards);
  const draggingId = useBoardDrag((state) => state.draggingId);
  const targetIndex = useBoardDrag((state) => state.targetIndex);
  const usedColors = useMemo(() => boards.map((board) => board.color), [boards]);
  const activeId = archivesActive ? undefined : activeBoardId;
  const openPalette = usePalette((state) => state.openPalette);

  // The palette's "Nouveau board" opens the popover under "+" (sidebar or rail), as a click would.
  const newBoardRequest = useLayout((state) => state.newBoardRequest);
  const seenRequest = useRef(newBoardRequest);
  useEffect(() => {
    if (newBoardRequest === seenRequest.current) return;
    seenRequest.current = newBoardRequest;
    plusRef.current?.click();
  }, [newBoardRequest]);

  const createBoard = ({ name, icon, color }: BoardStyle) =>
    create.mutate(
      { name, icon, color, columnNames: [t('column.todo'), t('column.inProgress'), t('column.done')] },
      {
        onSuccess: (board) => {
          useFeedback.getState().announce(t('sidebar.created', { name: board.name }));
          onSelectBoard(board.id);
        },
      },
    );

  const actions: BoardRowActions = {
    onSelect: onSelectBoard,
    onKeyboardMove: moveWithKeyboard,
    onRename: (board, name) => update.mutate({ id: board.id, name }),
    onRestyle: (board, { name, icon, color }) => {
      const patch = {
        ...(name !== board.name ? { name } : {}),
        ...(icon !== board.icon ? { icon } : {}),
        ...(color !== board.color ? { color } : {}),
      };
      if (Object.keys(patch).length > 0) update.mutate({ id: board.id, ...patch });
    },
    onDuplicate: (board, copy) =>
      duplicate.mutate(
        { id: board.id, ...copy },
        {
          onSuccess: (created) =>
            useFeedback.getState().announce(t('boardMenu.duplicated', { name: created.name })),
        },
      ),
    // No confirmation (reversible): the board leaves at once and the next one opens if it was open.
    onArchive: (board) => {
      const next = boardAfterRemoval(
        boards.map((b) => b.id),
        board.id,
      );
      archive.mutate(board.id);
      useFeedback.getState().announce(t('boardMenu.archived', { name: board.name }));
      if (board.id === activeId) {
        if (next) onSelectBoard(next);
        else onNoBoardLeft?.();
      }
      if (next) useBoardDrag.getState().set({ focusId: next });
      else plusRef.current?.focus();
    },
  };

  // While a board is dragged it leaves its place and a slot opens at the destination (mockup BoardReorder A).
  const slotBefore = useMemo(() => {
    if (!draggingId || targetIndex === null) return null;
    const others = boards.filter((board) => board.id !== draggingId);
    return others[targetIndex]?.id ?? 'end';
  }, [boards, draggingId, targetIndex]);

  const withSlot = (render: (board: BoardSummary) => ReactNode, tile = false) => (
    <>
      {boards.map((board) => (
        <BoardEntry key={board.id} slot={slotBefore === board.id ? <BoardSlot tile={tile} /> : null}>
          {render(board)}
        </BoardEntry>
      ))}
      {slotBefore === 'end' && <BoardSlot tile={tile} />}
    </>
  );

  const hint = (
    <span id={hintId} hidden>
      {/* Tiles cannot be renamed: their hint leaves out F2. */}
      {t(collapsed ? 'sidebar.tileHint' : 'sidebar.boardHint', { alt: altKey() })}
    </span>
  );

  if (collapsed) {
    return (
      <nav
        aria-label={t('sidebar.boards')}
        className="side flex w-rail shrink-0 flex-col items-center gap-2.5 border-r border-border py-3 [background:var(--side-bg)]"
      >
        <Logo large />
        <button
          type="button"
          aria-label={t('sidebar.expand')}
          onClick={onToggle}
          className="mb-1.5 flex h-8 w-10 items-center justify-center rounded-lg text-text-3 hover:bg-rail"
        >
          <PanelLeftOpen size={16} />
        </button>
        <BoardList className="flex min-h-0 shrink flex-col items-center gap-2.5 overflow-y-auto p-1">
          {withSlot(
            (board) => (
              <BoardTile
                board={board}
                active={board.id === activeId}
                dragging={board.id === draggingId}
                hintId={hintId}
                onSelect={onSelectBoard}
                onKeyboardMove={moveWithKeyboard}
              />
            ),
            true,
          )}
        </BoardList>
        <BoardSettings
          usedColors={usedColors}
          side="right"
          align="start"
          defaultOpen={createOpen}
          onSubmit={createBoard}
          trigger={
            <button
              ref={plusRef}
              type="button"
              aria-label={t('sidebar.newBoard')}
              className={cn(
                'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-card border border-dashed border-border-strong text-text-3 hover:bg-rail',
                PLUS_OPEN,
              )}
            >
              <Plus size={16} />
            </button>
          }
        />
        <div className="flex-1" />
        <button
          type="button"
          aria-label={t('sidebar.archives')}
          title={t('sidebar.archives')}
          aria-current={archivesActive ? 'page' : undefined}
          onClick={onOpenArchives}
          className={cn(
            'flex size-10 items-center justify-center rounded-card text-text-2 hover:bg-rail',
            archivesActive && 'bg-accent-soft text-text ring-1 ring-accent hover:bg-accent-soft',
          )}
        >
          <Archive size={18} />
        </button>
        <button
          type="button"
          aria-label={t('sidebar.settings')}
          className="flex size-10 items-center justify-center rounded-card text-text-2 hover:bg-rail"
        >
          <SlidersHorizontal size={18} />
        </button>
        {hint}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t('sidebar.boards')}
      className="side flex w-sidebar shrink-0 flex-col gap-0.5 border-r border-border px-2.5 py-3 [background:var(--side-bg)]"
    >
      <div className="mb-2.5 flex h-7.5 items-center gap-2 pl-1.5 pr-1">
        <Logo />
        <span className="flex-1 font-semibold">Ordo</span>
        <button
          type="button"
          aria-label={t('sidebar.collapse')}
          onClick={onToggle}
          className="flex size-7 items-center justify-center rounded-md text-text-3 hover:bg-rail"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => openPalette()}
        className="mb-3 flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-left text-meta text-text-3"
      >
        <Search size={14} aria-hidden />
        <span className="flex-1">{t('sidebar.search')}</span>
        <Kbd>{modKey()}K</Kbd>
      </button>
      <div className="flex items-center px-2 pt-1.5 pb-1 text-caption font-medium text-text-3">
        <span className="flex-1">{t('sidebar.boards')}</span>
        <BoardSettings
          usedColors={usedColors}
          align="start"
          defaultOpen={createOpen}
          onSubmit={createBoard}
          trigger={
            <button
              ref={plusRef}
              type="button"
              aria-label={t('sidebar.newBoard')}
              className={cn('flex cursor-pointer rounded-sm p-0.75 text-text-3 hover:bg-rail', PLUS_OPEN)}
            >
              <Plus size={14} />
            </button>
          }
        />
      </div>
      {boards.length === 0 ? (
        <>
          <p className="mx-2 my-1 rounded-lg border border-dashed border-border-strong p-3 text-label leading-snug text-text-3">
            {t('sidebar.noBoards')}
          </p>
          <div className="flex-1" />
        </>
      ) : (
        <BoardList className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 py-1">
          {withSlot((board) => (
            <BoardRow
              board={board}
              active={board.id === activeId}
              usedColors={usedColors}
              dragging={board.id === draggingId}
              hintId={hintId}
              {...(rowState?.boardId === board.id ? { defaultState: rowState.state } : {})}
              {...actions}
            />
          ))}
        </BoardList>
      )}
      <button
        type="button"
        aria-current={archivesActive ? 'page' : undefined}
        onClick={onOpenArchives}
        className={cn(
          'flex h-7.5 shrink-0 items-center gap-2.5 rounded-md px-2 text-left text-text-2 hover:bg-rail',
          archivesActive && 'bg-accent-soft font-medium text-text hover:bg-accent-soft',
        )}
      >
        <Archive size={14} aria-hidden />
        {t('sidebar.archives')}
      </button>
      {[
        { icon: Trash2, label: t('sidebar.trash') },
        { icon: SlidersHorizontal, label: t('sidebar.settings') },
      ].map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          className="flex h-7.5 shrink-0 items-center gap-2.5 rounded-md px-2 text-left text-text-2 hover:bg-rail"
        >
          <Icon size={14} aria-hidden />
          {label}
        </button>
      ))}
      {hint}
    </nav>
  );
}

/** A board with the drop slot opened just before it. */
function BoardEntry({ slot, children }: { slot: ReactNode; children: ReactNode }) {
  return (
    <>
      {slot}
      {children}
    </>
  );
}
