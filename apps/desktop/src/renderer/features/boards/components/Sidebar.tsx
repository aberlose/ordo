import type { BoardSummary } from '@ordo/contracts';
import {
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  SquareKanban,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { modKey } from '@renderer/shared/lib/platform';
import { Kbd } from '@renderer/shared/ui/kbd';

export interface SidebarProps {
  boards: readonly BoardSummary[];
  activeBoardId?: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  onSelectBoard: (id: string) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
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

/** Approved mockup: docs/design/mockups/board (sidebar open by default, collapsible to a rail). */
export function Sidebar({ boards, activeBoardId, collapsed, onToggle, onSelectBoard }: SidebarProps) {
  const { t } = useTranslation();

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
        {boards.map((board) => (
          <button
            key={board.id}
            type="button"
            title={board.name}
            aria-label={board.name}
            aria-current={board.id === activeBoardId ? 'page' : undefined}
            onClick={() => onSelectBoard(board.id)}
            className={cn(
              'flex size-10 items-center justify-center rounded-card text-meta font-semibold text-accent hover:bg-rail',
              board.id === activeBoardId && 'bg-accent-soft ring-1 ring-accent hover:bg-accent-soft',
            )}
          >
            {initials(board.name)}
          </button>
        ))}
        <button
          type="button"
          aria-label={t('sidebar.newBoard')}
          className="flex size-10 items-center justify-center rounded-card border border-dashed border-border-strong text-text-3"
        >
          <Plus size={16} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={t('sidebar.settings')}
          className="flex size-10 items-center justify-center rounded-card text-text-2 hover:bg-rail"
        >
          <SlidersHorizontal size={18} />
        </button>
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
        className="mb-3 flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-left text-meta text-text-3"
      >
        <Search size={14} aria-hidden />
        <span className="flex-1">{t('sidebar.search')}</span>
        <Kbd>{modKey()}K</Kbd>
      </button>
      <div className="flex items-center px-2 pt-1.5 pb-1 text-caption font-medium text-text-3">
        <span className="flex-1">{t('sidebar.boards')}</span>
        <button type="button" aria-label={t('sidebar.newBoard')} className="flex p-0.5 text-text-3">
          <Plus size={14} />
        </button>
      </div>
      {boards.length === 0 ? (
        <p className="mx-2 my-1 rounded-lg border border-dashed border-border-strong p-3 text-label leading-snug text-text-3">
          {t('sidebar.noBoards')}
        </p>
      ) : (
        boards.map((board) => (
          <button
            key={board.id}
            type="button"
            aria-current={board.id === activeBoardId ? 'page' : undefined}
            onClick={() => onSelectBoard(board.id)}
            className={cn(
              'flex h-7.5 items-center gap-2.5 rounded-md px-2 text-left text-text-2 hover:bg-rail',
              board.id === activeBoardId && 'bg-accent-soft font-medium text-text hover:bg-accent-soft',
            )}
          >
            <SquareKanban size={14} className="text-accent" aria-hidden />
            <span className="flex-1 truncate">{board.name}</span>
            <span className="text-xs text-text-3 tabular-nums">{board.taskCount}</span>
          </button>
        ))
      )}
      <div className="flex-1" />
      {[
        { icon: Archive, label: t('sidebar.archives') },
        { icon: Trash2, label: t('sidebar.trash') },
        { icon: SlidersHorizontal, label: t('sidebar.settings') },
      ].map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          className="flex h-7.5 items-center gap-2.5 rounded-md px-2 text-left text-text-2 hover:bg-rail"
        >
          <Icon size={14} aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  );
}
