import type { Column } from '@ordo/contracts';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@renderer/shared/ui/dropdown-menu';

export interface SubtaskStatusMenuProps {
  title: string;
  columnId: string;
  columns: readonly Column[];
  disabled?: boolean;
  /** Stories: the menu shown open. */
  defaultOpen?: boolean;
  /** The row stays tinted while the menu is open (the focus is then in the menu). */
  onOpenChange?: (open: boolean) => void;
  onChange: (columnId: string) => void;
}

/**
 * Approved mockup: tags-subtasks/SubtaskRows variant A — the status in small text, which turns into a
 * button on row hover or focus and lists the board's columns (as the Status menu of the detail).
 */
export function SubtaskStatusMenu({
  title,
  columnId,
  columns,
  disabled = false,
  defaultOpen,
  onOpenChange,
  onChange,
}: SubtaskStatusMenuProps) {
  const { t } = useTranslation();
  const column = columns.find((c) => c.id === columnId);
  return (
    <DropdownMenu {...(defaultOpen ? { defaultOpen } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t('subtasks.statusOf', { title, status: column?.name ?? '' })}
        className={cn(
          'flex h-6.5 shrink-0 items-center gap-1.5 rounded-md pr-1.5 pl-2 text-small text-text-3',
          'group-focus-within:text-text group-hover:text-text hover:bg-surface',
          'data-[state=open]:bg-accent-soft data-[state=open]:text-text',
        )}
      >
        {column && (
          <ColumnIcon
            icon={column.icon}
            size={12}
            strokeWidth={2.4}
            style={{ color: columnColorVar(column.color) }}
          />
        )}
        {column?.name}
        <ChevronDown
          size={13}
          className="text-text-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-data-[menu=open]:opacity-100"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-50">
        <DropdownMenuRadioGroup
          value={columnId}
          onValueChange={(next) => next !== columnId && onChange(next)}
        >
          {columns.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id}>
              <ColumnIcon
                icon={c.icon}
                size={14}
                strokeWidth={2.2}
                style={{ color: columnColorVar(c.color) }}
              />
              {c.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
