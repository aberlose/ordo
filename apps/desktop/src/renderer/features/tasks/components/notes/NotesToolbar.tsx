import { useEditorState, type Editor } from '@tiptap/react';
import {
  Check,
  Image as ImageIcon,
  Link2,
  List,
  ListChecks,
  Table,
  TextQuote,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { altKey, modKey } from '@renderer/shared/lib/platform';

type ItemId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'heading'
  | 'bulletList'
  | 'taskList'
  | 'blockquote'
  | 'link'
  | 'image'
  | 'table';

interface Item {
  id: ItemId;
  /** Text glyph (B, I, S, </>, H2) or icon, as in the approved toolbar. */
  glyph?: string;
  glyphClass?: string;
  icon?: LucideIcon;
  /** Shortcut keys after the modifier ("B", "⇧8"…). */
  keys?: (shift: string, alt: string) => string;
  /** Separator before this item. */
  separated?: boolean;
}

const ITEMS: readonly Item[] = [
  { id: 'bold', glyph: 'B', glyphClass: 'font-bold', keys: () => 'B' },
  { id: 'italic', glyph: 'I', glyphClass: 'italic', keys: () => 'I' },
  { id: 'strike', glyph: 'S', glyphClass: 'line-through', keys: (shift) => `${shift}S` },
  { id: 'code', glyph: '</>', glyphClass: 'font-mono text-small', keys: () => 'E' },
  {
    id: 'heading',
    glyph: 'H2',
    glyphClass: 'text-label font-semibold',
    keys: (_, alt) => `${alt}2`,
    separated: true,
  },
  { id: 'bulletList', icon: List, keys: (shift) => `${shift}8` },
  { id: 'taskList', icon: ListChecks, keys: (shift) => `${shift}9` },
  { id: 'blockquote', icon: TextQuote, keys: (shift) => `${shift}B` },
  { id: 'link', icon: Link2, keys: () => 'K' },
  { id: 'image', icon: ImageIcon },
  { id: 'table', icon: Table },
];

function shortcut(keys: Item['keys']): string | null {
  if (!keys) return null;
  const mac = modKey() === '⌘';
  return `${modKey()}${keys(mac ? '⇧' : 'Shift+', mac ? altKey() : 'Alt+')}`;
}

export interface NotesToolbarProps {
  editor: Editor;
  /** The link popover is open (the Link button shows pressed). */
  linkOpen: boolean;
  onLink: () => void;
  onImage: () => void;
  /** "Enregistré", right of the bar, fading out after each save. */
  saved: boolean;
}

/**
 * Formatting bar above the notes (approved mockup: notes-attachments/NotesEditor A, task-detail toolbar):
 * a toolbar with one tab stop, ← → / Home / End move between buttons; pressed states follow the
 * selection; the tooltips give the shortcuts. Buttons keep the editor's selection (no focus steal on click).
 */
export function NotesToolbar({ editor, linkOpen, onLink, onImage, saved }: NotesToolbarProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const pressed = useEditorState({
    editor,
    selector: ({ editor: e }): Record<ItemId, boolean | undefined> => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      heading: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      // Insertions, not toggles: no pressed state.
      image: undefined,
      table: undefined,
    }),
  });

  const run = (id: ItemId) => {
    const chain = editor.chain().focus();
    switch (id) {
      case 'bold':
        return chain.toggleBold().run();
      case 'italic':
        return chain.toggleItalic().run();
      case 'strike':
        return chain.toggleStrike().run();
      case 'code':
        return chain.toggleCode().run();
      case 'heading':
        return chain.toggleHeading({ level: 2 }).run();
      case 'bulletList':
        return chain.toggleBulletList().run();
      case 'taskList':
        return chain.toggleTaskList().run();
      case 'blockquote':
        return chain.toggleBlockquote().run();
      case 'link':
        return onLink();
      case 'image':
        return onImage();
      case 'table':
        return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = ITEMS.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = active === last ? 0 : active + 1;
    else if (event.key === 'ArrowLeft') next = active === 0 ? last : active - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    bar.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  const buttons: ReactNode[] = [];
  ITEMS.forEach((item, index) => {
    const label = t(`notes.toolbar.${item.id}`);
    const keys = shortcut(item.keys);
    const isPressed = item.id === 'link' ? Boolean(pressed.link) || linkOpen : pressed[item.id];
    if (item.separated)
      buttons.push(<span key={`sep-${item.id}`} aria-hidden className="mx-1 h-4 w-px bg-border" />);
    buttons.push(
      <button
        key={item.id}
        type="button"
        aria-label={label}
        aria-pressed={isPressed}
        title={keys ? t('notes.toolbar.withShortcut', { label, shortcut: keys }) : label}
        tabIndex={index === active ? 0 : -1}
        onFocus={() => setActive(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run(item.id)}
        className={cn(
          'flex h-6.5 min-w-7 items-center justify-center rounded-lg px-1 text-text-2 hover:bg-rail',
          isPressed && 'bg-accent-soft text-accent hover:bg-accent-soft',
        )}
      >
        {item.icon ? (
          <item.icon size={15} strokeWidth={2} aria-hidden />
        ) : (
          <span aria-hidden className={item.glyphClass}>
            {item.glyph}
          </span>
        )}
      </button>,
    );
  });

  return (
    <div className="sticky top-0 z-10 -mt-2 flex items-center bg-surface py-2">
      <div
        ref={bar}
        role="toolbar"
        aria-label={t('notes.toolbar.label')}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex h-8.5 w-fit items-center gap-0.5 rounded-lg border border-border bg-surface px-1"
      >
        {buttons}
      </div>
      <span
        aria-hidden
        className={cn(
          'ml-2.5 flex items-center gap-1.25 text-small text-text-3 transition-opacity duration-700',
          saved ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Check size={13} strokeWidth={2.4} aria-hidden />
        {t('notes.saved')}
      </span>
    </div>
  );
}
