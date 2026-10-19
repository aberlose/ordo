import { attachmentUrl } from '@ordo/contracts';
import { IMAGE_NODE, IMAGE_WIDTH_MAX, clampImageWidth } from '@ordo/domain';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { NodeSelection } from '@tiptap/pm/state';
import { Extension, ReactNodeViewRenderer, type AnyExtension, type Editor, type Range } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Suggestion } from '@tiptap/suggestion';
import { filterBlocks, isAllowedLink, stepImageWidth, type Block, type BlockId } from './helpers';
import { ImageView } from './ImageView';
import type { SlashStore } from './slash';

/** What the extensions need from the editor component (set once, read at run time). */
export interface NotesBridge {
  placeholder: () => string;
  blockLabel: (id: BlockId) => string;
  slash: SlashStore;
  /** ⌘/Ctrl + K or the Link button. */
  openLinkPopover: () => void;
  /** The image block of the "/" menu: the file chooser. */
  pickImage: () => void;
}

/**
 * The notes' image: an attachment of the same task (`attachmentId`), shown at `width` % of the note
 * width (approved mockup: notes-attachments/NoteBlocks B). Never a remote or inline (data:) source.
 */
export const NoteImage = Image.extend({
  name: IMAGE_NODE,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-attachment-id'),
        renderHTML: (attributes) => ({ 'data-attachment-id': attributes['attachmentId'] as string }),
      },
      width: {
        default: IMAGE_WIDTH_MAX,
        parseHTML: (element) =>
          clampImageWidth(Number(element.getAttribute('data-width') ?? IMAGE_WIDTH_MAX)),
        renderHTML: (attributes) => ({ 'data-width': String(attributes['width']) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-attachment-id]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs['attachmentId'] as string | null;
    return [
      'img',
      { ...HTMLAttributes, src: id ? attachmentUrl(id) : '', style: `width: ${node.attrs['width']}%` },
    ];
  },
  // No Markdown `![](src)`: an image always comes from a file.
  addInputRules() {
    return [];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
  addKeyboardShortcuts() {
    const resize = (direction: -1 | 1) => () => {
      const { selection } = this.editor.state;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== IMAGE_NODE) return false;
      const width = stepImageWidth(selection.node.attrs['width'], direction);
      const { tr } = this.editor.state;
      tr.setNodeAttribute(selection.from, 'width', width);
      tr.setSelection(NodeSelection.create(tr.doc, selection.from));
      this.editor.view.dispatch(tr);
      return true;
    };
    return { ArrowLeft: resize(-1), ArrowRight: resize(1) };
  },
});

/** Runs a block of the "/" menu in place of the typed "/query". */
export function insertBlock(
  editor: Editor,
  range: Range,
  id: BlockId,
  bridge: Pick<NotesBridge, 'pickImage'>,
) {
  const chain = editor.chain().focus().deleteRange(range);
  switch (id) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
      chain.setNode('heading', { level: Number(id.slice(-1)) }).run();
      break;
    case 'taskList':
      chain.toggleTaskList().run();
      break;
    case 'bulletList':
      chain.toggleBulletList().run();
      break;
    case 'codeBlock':
      chain.setCodeBlock().run();
      break;
    case 'blockquote':
      chain.setBlockquote().run();
      break;
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case 'image':
      chain.run();
      bridge.pickImage();
      break;
  }
}

/** The "/" block menu (approved mockup: task-detail/FullScreen), drawn by `SlashMenu` from the store. */
const SlashCommand = Extension.create<{ bridge: NotesBridge | null }>({
  name: 'slashCommand',
  addOptions() {
    return { bridge: null };
  },
  addProseMirrorPlugins() {
    const bridge = this.options.bridge;
    if (!bridge) return [];
    const { slash } = bridge;
    return [
      Suggestion<Block, Block>({
        editor: this.editor,
        char: '/',
        // Not inside code: "/" is often typed there (paths, comments).
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name !== 'codeBlock';
        },
        items: ({ query }) => filterBlocks(query, bridge.blockLabel),
        command: ({ editor, range, props }) => insertBlock(editor, range, props.id, bridge),
        render: () => ({
          onStart: (props) => slash.open(props),
          onUpdate: (props) => slash.open(props),
          onExit: () => slash.close(),
          onKeyDown: ({ event }) => slash.keyDown(event),
        }),
      }),
    ];
  },
});

/**
 * The editor's extensions: StarterKit (Markdown shortcuts #, -, >, ```, links), checklists, tables
 * with a header row, attachment images, the placeholder of an empty note and the "/" menu.
 */
export function notesExtensions(bridge: NotesBridge | null): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      dropcursor: { color: false, width: 2, class: 'notes-dropcursor' },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['mailto'],
        isAllowedUri: (url) => isAllowedLink(url),
        HTMLAttributes: { target: null, rel: 'noopener noreferrer' },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ renderWrapper: true }),
    TableRow,
    TableHeader,
    TableCell,
    NoteImage,
    Placeholder.configure({
      placeholder: () => bridge?.placeholder() ?? '',
      showOnlyWhenEditable: true,
    }),
    SlashCommand.configure({ bridge }),
  ];
}
