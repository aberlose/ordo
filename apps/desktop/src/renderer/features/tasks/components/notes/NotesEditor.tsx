import { attachmentUrl } from '@ordo/contracts';
import { IMAGE_NODE, IMAGE_WIDTH_MAX, type DocNode } from '@ordo/domain';
import { EditorContent, getMarkRange, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import '@renderer/styles/notes.css';
import { useAddNoteImages, useDescription, useNotesAutosave, type NotesDoc } from '../../hooks/notes';
import { NotesContext, type NotesContextValue } from './context';
import { notesExtensions, type NotesBridge } from './extensions';
import { isAllowedLink } from './helpers';
import { LinkBubble, LinkPopover } from './LinkPopover';
import { NotesToolbar } from './NotesToolbar';
import { createSlashStore } from './slash';
import { SLASH_MENU_ID, SlashMenu } from './SlashMenu';
import { appendToTable, TableBands, TableMenu } from './TableControls';

const SAVED_VISIBLE_MS = 1800;
const BUBBLE_HIDE_MS = 250;
/** Space between a line of text and the menu under it. */
const GAP = 6;
/** Widths of the floating parts (tokens: popover 340, "/" menu 280), to keep them inside the notes. */
const POPOVER_WIDTH = 340;
const MENU_WIDTH = 280;

/** Opens an http, https or mailto link in the default browser (the main process's window-open handler). */
export function openExternal(href: string) {
  if (isAllowedLink(href)) window.open(href, '_blank', 'noopener');
}

const isImageFile = (file: File) => file.type.startsWith('image/');

/** A drag carrying at least one image file (types are readable during dragover). */
function dragHasImage(data: DataTransfer | null): boolean {
  if (!data) return false;
  return Array.from(data.items ?? []).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

interface Point {
  left: number;
  top: number;
}
type Box = Point & { width: number; height: number };
type Rect = { left: number; top: number; bottom: number };

/** A viewport rectangle placed under itself, relative to `origin`, kept inside it (`width` wide). */
function placeUnder(origin: HTMLElement | null, rect: Rect, width: number): Point {
  const box = origin?.getBoundingClientRect();
  if (!box) return { left: rect.left, top: rect.bottom + GAP };
  const left = rect.left - box.left;
  return { left: Math.max(0, Math.min(left, box.width - width)), top: rect.bottom - box.top + GAP };
}

function boxIn(origin: HTMLElement | null, element: Element): Box {
  const rect = element.getBoundingClientRect();
  const box = origin?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return { left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height };
}

interface LinkTarget extends Point {
  href: string;
  from: number;
  to: number;
}

interface PopoverState extends Point {
  from: number;
  to: number;
  initial: string;
}

/** Story and test hooks: opens a state that is otherwise reached with the mouse or the keyboard. */
export interface NotesHandle {
  editor: Editor;
  openLinkPopover: () => void;
  showLinkBubble: (pos: number) => void;
  showTableBands: () => void;
}

export interface NotesEditorViewProps {
  boardId: string;
  taskId: string;
  initialDoc: NotesDoc;
  /** Overrides the attachment file address (stories). */
  imageUrl?: (attachmentId: string) => string;
  /** Stories and tests get the editor here, once it is ready. */
  onReady?: (handle: NotesHandle) => void;
  /** The "Enregistré" hint shown from the start (stories). */
  initiallySaved?: boolean;
}

/**
 * The notes of a task (approved mockups: notes-attachments/NotesEditor A, NoteLinks A, NoteBlocks B;
 * task-detail toolbar and "/" menu). Saved 500 ms after the last change, on blur, on window close and
 * when the window shows another task (remount).
 */
export function NotesEditorView({
  boardId,
  taskId,
  initialDoc,
  imageUrl = attachmentUrl,
  onReady,
  initiallySaved = false,
}: NotesEditorViewProps) {
  const { t } = useTranslation();
  const wrapper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(initiallySaved);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { schedule, flush } = useNotesAutosave(taskId, () => {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
  });
  const addImages = useAddNoteImages(boardId, taskId);

  const [slash] = useState(() => createSlashStore());
  useLayoutEffect(() => slash.setPlace((caret) => placeUnder(wrapper.current, caret, MENU_WIDTH)), [slash]);
  const slashState = useSyncExternalStore(slash.subscribe, slash.get, slash.get);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [hoverLink, setHoverLink] = useState<LinkTarget | null>(null);
  const [caretLink, setCaretLink] = useState<LinkTarget | null>(null);
  const [bubbleHeld, setBubbleHeld] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [tableBox, setTableBox] = useState<{ box: Box; table: HTMLTableElement } | null>(null);
  const [tableMenu, setTableMenu] = useState<Point | null>(null);
  useEffect(
    () => () => {
      clearTimeout(savedTimer.current);
      clearTimeout(bubbleTimer.current);
    },
    [],
  );

  // The editor's handlers call back into this component through these (updated after each render).
  const actions = useRef({
    openLinkPopover: () => {},
    pickImage: () => {},
    insertImages: (_files: readonly File[], _pos: number) => {},
  });
  const [bridge] = useState<NotesBridge>(() => ({
    placeholder: () => t('notes.placeholder'),
    blockLabel: (id) => t(`notes.blocks.${id}`),
    slash,
    openLinkPopover: () => actions.current.openLinkPopover(),
    pickImage: () => actions.current.pickImage(),
  }));

  const editor = useEditor({
    extensions: notesExtensions(bridge),
    content: (initialDoc as JSONContent | null) ?? '',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'notes-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('notes.label'),
      },
      handleKeyDown: (_view, event) => {
        // ⌘/Ctrl + K is the link inside the notes, not the app's command palette.
        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
          actions.current.openLinkPopover();
          return true;
        }
        return false;
      },
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a');
        if (anchor && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          openExternal(anchor.getAttribute('href') ?? '');
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
        if (files.length === 0) return false;
        event.preventDefault();
        actions.current.insertImages(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.some(isImageFile)) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        actions.current.insertImages(files, at ?? view.state.selection.from);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => schedule(e.getJSON() as DocNode),
    onBlur: () => flush(),
  });

  /** Copies image files into the attachments, then inserts them at `pos` (clamped to the document). */
  const insertImages = useCallback(
    async (files: readonly File[], pos: number) => {
      const added = await addImages(files);
      if (editor.isDestroyed || added.length === 0) return;
      editor
        .chain()
        .focus()
        .insertContentAt(
          Math.min(pos, editor.state.doc.content.size),
          added.map((a) => ({ type: IMAGE_NODE, attrs: { attachmentId: a.id, width: IMAGE_WIDTH_MAX } })),
        )
        .run();
    },
    [addImages, editor],
  );

  const linkAt = useCallback(
    (pos: number): LinkTarget | null => {
      const type = editor.schema.marks['link'];
      if (!type) return null;
      const range =
        getMarkRange(editor.state.doc.resolve(pos), type) ??
        (pos > 0 ? getMarkRange(editor.state.doc.resolve(pos - 1), type) : undefined);
      if (!range) return null;
      const mark = editor.state.doc.nodeAt(range.from)?.marks.find((m) => m.type === type);
      const start = editor.view.coordsAtPos(range.from);
      const end = editor.view.coordsAtPos(range.to);
      return {
        href: (mark?.attrs['href'] as string | undefined) ?? '',
        from: range.from,
        to: range.to,
        ...placeUnder(
          wrapper.current,
          { left: Math.min(start.left, end.left), top: end.top, bottom: end.bottom },
          MENU_WIDTH,
        ),
      };
    },
    [editor],
  );

  const openLinkPopover = useCallback(
    (target?: { from: number; to: number; href: string }) => {
      let { from, to } = editor.state.selection;
      let initial = '';
      const existing = target ?? (editor.isActive('link') ? linkAt(from) : null);
      if (existing) {
        ({ from, to } = existing);
        initial = existing.href;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const rect = {
        left: Math.min(start.left, end.left),
        top: start.top,
        bottom: Math.max(start.bottom, end.bottom),
      };
      setHoverLink(null);
      setCaretLink(null);
      setPopover({ from, to, initial, ...placeUnder(wrapper.current, rect, POPOVER_WIDTH) });
    },
    [editor, linkAt],
  );

  useLayoutEffect(() => {
    actions.current.openLinkPopover = () => openLinkPopover();
    actions.current.pickImage = () => fileInput.current?.click();
    actions.current.insertImages = (files, pos) => void insertImages(files, pos);
  });

  const applyLink = (href: string | null) => {
    if (!popover) return;
    const { from, to } = popover;
    setPopover(null);
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (href === null) chain.extendMarkRange('link').unsetLink().run();
    else if (from === to)
      chain
        .insertContent({
          type: 'text',
          text: href.replace(/^mailto:/, ''),
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    else chain.extendMarkRange('link').setLink({ href }).run();
  };
  const cancelLink = () => {
    setPopover(null);
    editor.commands.focus();
  };

  // The caret in a link shows its bubble (keyboard path); hovering a link shows it too.
  useEffect(() => {
    const update = () => {
      const { empty, from } = editor.state.selection;
      setCaretLink(editor.isFocused && empty && editor.isActive('link') ? linkAt(from) : null);
    };
    const later = () => setTimeout(update, 0);
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    editor.on('blur', later);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
      editor.off('blur', later);
    };
  }, [editor, linkAt]);

  const onPointerOver = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('.notes-content a');
    if (anchor) {
      clearTimeout(bubbleTimer.current);
      try {
        const link = linkAt(Math.min(editor.view.posAtDOM(anchor, 0) + 1, editor.state.doc.content.size));
        if (link && link.from !== hoverLink?.from) setHoverLink(link);
      } catch {
        // Not in the document (being redrawn).
      }
    } else if (hoverLink && !target.closest('[data-link-bubble]')) {
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => setHoverLink(null), BUBBLE_HIDE_MS);
    }
    // Tables: the "+" bands follow the hovered table.
    const table = target.closest('.notes-content .tableWrapper')?.querySelector('table');
    if (table) setTableBox({ table, box: boxIn(wrapper.current, table) });
    else if (tableBox && !target.closest('[data-table-band]')) setTableBox(null);
  };

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest('.notes-content td, .notes-content th');
    // Shift+F10 / the context-menu key: the caret's cell.
    const fromKeyboard = !cell && editor.isActive('table') && target.closest('.notes-content') !== null;
    if (!cell && !fromKeyboard) return;
    event.preventDefault();
    if (cell) {
      const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
      if (pos !== undefined) editor.commands.setTextSelection(pos);
      const point = { left: event.clientX, top: event.clientY, bottom: event.clientY - GAP };
      setTableMenu(placeUnder(wrapper.current, point, 0));
    } else {
      const caret = editor.view.coordsAtPos(editor.state.selection.from);
      setTableMenu(placeUnder(wrapper.current, caret, 0));
    }
  };

  // Dropped image files are handled here: the window's drop overlay must not add them a second time.
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const stop = (event: DragEvent) => {
      if (!dragHasImage(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    element.addEventListener('dragover', stop);
    element.addEventListener('drop', stop);
    return () => {
      element.removeEventListener('dragover', stop);
      element.removeEventListener('drop', stop);
    };
  }, []);

  // The "/" menu is announced from the editor (the focus stays in the text).
  useEffect(() => {
    const dom = editor.view.dom;
    const active = slashState.open ? slashState.items[slashState.index] : undefined;
    const set = (name: string, value: string | null) =>
      value === null ? dom.removeAttribute(name) : dom.setAttribute(name, value);
    set('aria-controls', slashState.open ? SLASH_MENU_ID : null);
    set('aria-expanded', slashState.open ? 'true' : null);
    set('aria-haspopup', slashState.open ? 'listbox' : null);
    set('aria-activedescendant', active ? `${SLASH_MENU_ID}-${active.id}` : null);
  }, [editor, slashState]);

  useEffect(() => {
    onReady?.({
      editor,
      openLinkPopover: () => openLinkPopover(),
      showLinkBubble: (pos) => setHoverLink(linkAt(pos)),
      showTableBands: () => {
        const table = wrapper.current?.querySelector<HTMLTableElement>('.notes-content table');
        if (table) setTableBox({ table, box: boxIn(wrapper.current, table) });
      },
    });
    // Once, when the editor is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) void insertImages(files, editor.state.selection.from);
  };

  const bubble = popover ? null : (hoverLink ?? caretLink);
  const context = useMemo<NotesContextValue>(() => ({ taskId, imageUrl }), [taskId, imageUrl]);

  return (
    <NotesContext.Provider value={context}>
      <div
        ref={wrapper}
        className="relative w-full"
        data-notes
        // Escape closes the "/" menu or the link popover, not the window.
        {...(slashState.open || popover ? { 'data-escape-local': '' } : {})}
        onPointerOver={onPointerOver}
        onPointerLeave={() => {
          if (!bubbleHeld) setHoverLink(null);
          setTableBox(null);
        }}
        onContextMenu={onContextMenu}
      >
        <NotesToolbar
          editor={editor}
          linkOpen={popover !== null}
          onLink={() => openLinkPopover()}
          onImage={() => fileInput.current?.click()}
          saved={saved}
        />
        <EditorContent editor={editor} />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          tabIndex={-1}
          aria-hidden
          onChange={onFiles}
        />
        <SlashMenu store={slash} />
        {popover && (
          <LinkPopover
            initial={popover.initial}
            style={{ left: popover.left, top: popover.top }}
            onApply={applyLink}
            onCancel={cancelLink}
          />
        )}
        {bubble && (
          <div data-link-bubble>
            <LinkBubble
              href={bubble.href}
              style={{ left: bubble.left, top: bubble.top }}
              onPointerEnter={() => {
                clearTimeout(bubbleTimer.current);
                setBubbleHeld(true);
              }}
              onPointerLeave={() => setBubbleHeld(false)}
              onFocusChange={setBubbleHeld}
              onOpen={() => openExternal(bubble.href)}
              onEdit={() => openLinkPopover(bubble)}
              onRemove={() => {
                setHoverLink(null);
                setBubbleHeld(false);
                editor
                  .chain()
                  .focus()
                  .setTextSelection({ from: bubble.from, to: bubble.to })
                  .unsetLink()
                  .run();
              }}
            />
          </div>
        )}
        {tableBox && (
          <TableBands box={tableBox.box} onAdd={(what) => appendToTable(editor, tableBox.table, what)} />
        )}
        <TableMenu editor={editor} at={tableMenu} onClose={() => setTableMenu(null)} />
      </div>
    </NotesContext.Provider>
  );
}

/** Loads the task's notes, then the editor (one per task: switching task saves and remounts). */
export function NotesEditor({ boardId, taskId }: { boardId: string; taskId: string }) {
  const description = useDescription(taskId);
  if (!description.data) return <div className="min-h-24 w-full" />;
  return (
    <NotesEditorView key={taskId} boardId={boardId} taskId={taskId} initialDoc={description.data.json} />
  );
}

export default NotesEditor;
