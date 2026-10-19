import { TextSelection } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/react';
import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/shared/ui/dropdown-menu';

/**
 * Tables of the notes (approved mockup: notes-attachments/NoteBlocks B): "+" bands on hover, right
 * (add a column) and bottom (add a row); deletions from a right-click menu on a cell (also Shift+F10
 * or the context-menu key). Tab / Shift+Tab move between cells, Tab in the last cell adds a row.
 */

/** Puts the caret in the last cell of the table's last row or column, then runs `add`. */
export function appendToTable(editor: Editor, table: HTMLTableElement, what: 'row' | 'column') {
  const body = table.tBodies[0] ?? table;
  let pos: number;
  try {
    pos = editor.view.posAtDOM(body, 0);
  } catch {
    return;
  }
  const $pos = editor.state.doc.resolve(pos);
  let depth = $pos.depth;
  while (depth > 0 && $pos.node(depth).type.name !== 'table') depth--;
  const node = $pos.node(depth);
  if (node.type.name !== 'table') return;
  const start = $pos.start(depth);
  const map = TableMap.get(node);
  const cell = what === 'column' ? map.map[map.width - 1] : map.map[(map.height - 1) * map.width];
  if (cell === undefined) return;
  const { tr } = editor.state;
  tr.setSelection(TextSelection.near(tr.doc.resolve(start + cell + 1)));
  editor.view.dispatch(tr);
  const chain = editor.chain().focus();
  if (what === 'column') chain.addColumnAfter().run();
  else chain.addRowAfter().run();
}

export interface TableBandsProps {
  /** The hovered table's box, relative to the notes. */
  box: { left: number; top: number; width: number; height: number };
  onAdd: (what: 'row' | 'column') => void;
}

const band =
  'absolute flex items-center justify-center rounded-md border border-dashed border-border-strong text-text-3 hover:bg-accent-soft hover:text-accent';

/** The two "+" bands of a hovered table. Pointer only: the cell menu does the same from the keyboard. */
export function TableBands({ box, onAdd }: TableBandsProps) {
  const { t } = useTranslation();
  const column: CSSProperties = { left: box.left + box.width + 6, top: box.top, height: box.height };
  const row: CSSProperties = { left: box.left, top: box.top + box.height + 6, width: box.width };
  return (
    <>
      <button
        type="button"
        data-table-band
        tabIndex={-1}
        aria-label={t('notes.table.addColumn')}
        title={t('notes.table.addColumn')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onAdd('column')}
        style={column}
        className={cn(band, 'w-4')}
      >
        <Plus size={12} strokeWidth={2.4} aria-hidden />
      </button>
      <button
        type="button"
        data-table-band
        tabIndex={-1}
        aria-label={t('notes.table.addRow')}
        title={t('notes.table.addRow')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onAdd('row')}
        style={row}
        className={cn(band, 'h-4')}
      >
        <Plus size={12} strokeWidth={2.4} aria-hidden />
      </button>
    </>
  );
}

export interface TableMenuProps {
  editor: Editor;
  /** Where the menu opens, relative to the notes; `null` when closed. */
  at: { left: number; top: number } | null;
  onClose: () => void;
}

/** The right-click menu of a cell. */
export function TableMenu({ editor, at, onClose }: TableMenuProps) {
  const { t } = useTranslation();
  const run = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
    command(editor.chain().focus()).run();
  return (
    <DropdownMenu open={at !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none absolute size-0" style={at ?? undefined} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={t('notes.table.menu')}
        sideOffset={2}
        className="min-w-58"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuItem onSelect={run((c) => c.addRowBefore())}>
          {t('notes.table.rowAbove')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.addRowAfter())}>
          {t('notes.table.rowBelow')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.addColumnBefore())}>
          {t('notes.table.columnLeft')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.addColumnAfter())}>
          {t('notes.table.columnRight')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.toggleHeaderRow())}>
          {t('notes.table.headerRow')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={run((c) => c.deleteRow())}>{t('notes.table.deleteRow')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.deleteColumn())}>
          {t('notes.table.deleteColumn')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={run((c) => c.deleteTable())} className="text-danger">
          {t('notes.table.deleteTable')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
