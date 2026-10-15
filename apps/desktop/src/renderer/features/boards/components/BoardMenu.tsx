import { Archive, Copy, Palette, Pencil } from 'lucide-react';
import { useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/shared/ui/dropdown-menu';

export type BoardAction = 'rename' | 'style' | 'duplicate' | 'archive';

export interface BoardMenuProps {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The ⋯ button of the row (it also anchors the menu after a right click). */
  trigger: ReactElement;
  /** Runs once the menu has closed, so a rename field or a popover can take the focus. */
  onAction: (action: BoardAction) => void;
}

const ITEM = 'px-2.5';
const ICON = 'text-text-2';

/**
 * Board menu (approved mockup boards/BoardMenu A): Renommer (F2), Icône et couleur…, Dupliquer…,
 * then Archiver. Opened from the row's ⋯ (hover or focus) or a right click on the row.
 */
export function BoardMenu({ name, open, onOpenChange, trigger, onAction }: BoardMenuProps) {
  const { t } = useTranslation();
  const pending = useRef<BoardAction | null>(null);
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={t('sidebar.boardActions', { name })}
        className="w-menu min-w-0 gap-0 p-1"
        onCloseAutoFocus={(event) => {
          const action = pending.current;
          if (!action) return;
          // The action decides where the focus goes (rename field, popover, next board).
          event.preventDefault();
          pending.current = null;
          onAction(action);
        }}
      >
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => {
            pending.current = 'rename';
          }}
        >
          <Pencil size={15} className={ICON} aria-hidden />
          {t('boardMenu.rename')}
          <span className="ml-auto font-mono text-kbd text-text-3" aria-hidden>
            F2
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => {
            pending.current = 'style';
          }}
        >
          <Palette size={15} className={ICON} aria-hidden />
          {t('boardMenu.iconColor')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => {
            pending.current = 'duplicate';
          }}
        >
          <Copy size={15} className={ICON} aria-hidden />
          {t('boardMenu.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ITEM}
          onSelect={() => {
            pending.current = 'archive';
          }}
        >
          <Archive size={15} className={ICON} aria-hidden />
          {t('boardMenu.archive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
