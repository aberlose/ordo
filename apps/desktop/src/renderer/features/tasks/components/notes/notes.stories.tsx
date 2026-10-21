import type { Attachment } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useQueryClient } from '@tanstack/react-query';
import type { Editor, JSONContent } from '@tiptap/react';
import { useState } from 'react';
import { attachmentKeys } from '@renderer/shared/api/keys';
import type { NotesDoc } from '../../hooks/notes';
import { NotesEditorView, type NotesHandle } from './NotesEditor';

const meta = { title: 'Tasks/Notes' } satisfies Meta;
export default meta;
type Story = StoryObj;

const TASK = '01920000-0000-7000-8000-000000000105';
const BOARD = '01920000-0000-7000-8000-000000000001';
const IMAGE_ID = '01920000-0000-7000-8000-000000000901';
const GONE_ID = '01920000-0000-7000-8000-000000000999';

const attachments: Attachment[] = [
  {
    id: IMAGE_ID,
    taskId: TASK,
    fileName: 'maquette-header-v3.png',
    mimeType: 'image/png',
    sizeBytes: 182_400,
    createdAt: Date.now(),
    url: `ordo-file://attachment/${IMAGE_ID}`,
  },
];

/** A sample screenshot (the user's file in the app, served by the main process). */
const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6EFFF"/><stop offset="1" stop-color="#C9D9FB"/></linearGradient></defs>
  <rect width="600" height="240" rx="8" fill="url(#g)"/>
  <rect x="18" y="18" width="564" height="40" rx="6" fill="#FFFFFF"/>
  <rect x="30" y="29" width="18" height="18" rx="5" fill="#2563EB"/>
  <rect x="62" y="34" width="380" height="8" rx="4" fill="#DFE6F3"/>
  <rect x="510" y="31" width="60" height="14" rx="4" fill="#2563EB"/>
  <rect x="18" y="72" width="564" height="150" rx="6" fill="#FFFFFF" fill-opacity="0.6"/>
</svg>`,
)}`;

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const cell = (type: 'tableHeader' | 'tableCell', value: string): JSONContent => ({
  type,
  content: [paragraph(text(value))],
});
const row = (type: 'tableHeader' | 'tableCell', ...values: string[]): JSONContent => ({
  type: 'tableRow',
  content: values.map((v) => cell(type, v)),
});

const LINK = 'https://exemple.fr/maquettes/header';
const intro = paragraph(
  text(
    'Le client veut un header plus compact : logo à gauche, recherche intégrée, et un seul niveau de navigation. La maquette a été ',
  ),
  text('validée le 30 sept.'),
  text(' (voir pièce jointe '),
  text('maquette-header-v3.png', [{ type: 'link', attrs: { href: LINK } }]),
  text(').'),
);
const table: JSONContent = {
  type: 'table',
  content: [
    row('tableHeader', 'Écran', 'Hauteur', 'Sticky'),
    row('tableCell', 'Desktop', '64 px', 'Page produit'),
    row('tableCell', 'Mobile', '56 px', 'Non'),
  ],
};

/** Every block of the notes (approved mockups NotesEditor A, NoteLinks A, NoteBlocks B). */
const rich = {
  type: 'doc',
  content: [
    intro,
    { type: 'heading', attrs: { level: 2 }, content: [text("Points d'attention")] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            paragraph(
              text('Le header reste '),
              text('sticky', [{ type: 'bold' }]),
              text(' uniquement sur la page produit.'),
            ),
          ],
        },
        {
          type: 'listItem',
          content: [paragraph(text('Hauteur maximale de 64 px sur desktop, 56 px sur mobile.'))],
        },
        {
          type: 'listItem',
          content: [
            paragraph(
              text('Le menu burger doit être utilisable au clavier ('),
              text('Échap', [{ type: 'code' }]),
              text(' ferme le menu).'),
            ),
          ],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [paragraph(text('Valider la maquette avec le client'))],
        },
        { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('Intégrer la recherche'))] },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: null },
      content: [text('.site-header {\n  position: sticky;\n  top: 0;\n  height: var(--header-h, 64px);\n}')],
    },
    {
      type: 'blockquote',
      content: [
        paragraph(
          text(
            '« On garde le bleu du logo, mais le fond du header doit rester blanc. » — retour client du 2 oct.',
          ),
        ),
      ],
    },
    paragraph(text('Hauteurs retenues :')),
    table,
    paragraph(text('Maquette validée :')),
    { type: 'image', attrs: { attachmentId: IMAGE_ID, width: 70 } },
  ],
} as NonNullable<NotesDoc>;

function findText(editor: Editor, value: string) {
  let range = { from: 0, to: 0 };
  editor.state.doc.descendants((node, pos) => {
    const index = node.isText ? (node.text ?? '').indexOf(value) : -1;
    if (index >= 0) range = { from: pos + index, to: pos + index + value.length };
  });
  return range;
}
function findNode(editor: Editor, type: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === type) found = pos;
  });
  return found;
}

/** The detail window's left column: the title, then the notes. */
function Frame({
  doc,
  files = attachments,
  onReady,
  saved = false,
}: {
  doc: NotesDoc;
  files?: Attachment[];
  onReady?: (handle: NotesHandle) => void;
  saved?: boolean;
}) {
  const client = useQueryClient();
  useState(() => {
    client.setQueryDefaults(attachmentKeys.list(TASK), { staleTime: Infinity });
    client.setQueryData(attachmentKeys.list(TASK), files);
    return null;
  });
  return (
    <div className="min-h-screen bg-surface px-9 pt-8 pb-16 text-text">
      <div className="flex max-w-155 flex-col items-start gap-4.5">
        <h1 className="text-heading leading-tight font-semibold tracking-tight">
          Intégrer le nouveau header
        </h1>
        <NotesEditorView
          boardId={BOARD}
          taskId={TASK}
          initialDoc={doc}
          imageUrl={() => SAMPLE}
          initiallySaved={saved}
          {...(onReady ? { onReady: (handle) => requestAnimationFrame(() => onReady(handle)) } : {})}
        />
      </div>
    </div>
  );
}

/** NotesEditor A, "Note vide": the toolbar and « Ajoutez des notes… Tapez « / » pour insérer un bloc. ». */
export const Empty: Story = { render: () => <Frame doc={null} /> };
export const EmptyDark: Story = { ...Empty, globals: { mode: 'dark' } };

/** Every block (headings, lists, checklist, code, quote, table, image) and "Enregistré" after a save. */
export const RichNote: Story = { render: () => <Frame doc={rich} saved /> };
export const RichNoteDark: Story = { ...RichNote, globals: { mode: 'dark' } };

/** NoteLinks A, "Ajouter un lien": the popover under the selection. */
export const LinkPopoverOpen: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro] }}
      onReady={({ editor, openLinkPopover }) => {
        editor.chain().focus().setTextSelection(findText(editor, 'validée le 30 sept.')).run();
        openLinkPopover();
      }}
    />
  ),
};
export const LinkPopoverOpenDark: Story = { ...LinkPopoverOpen, globals: { mode: 'dark' } };

/** NoteLinks A, "Survol d'un lien": address, Ouvrir, Modifier, Retirer. */
export const LinkBubbleShown: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro] }}
      onReady={({ editor, showLinkBubble }) => showLinkBubble(findText(editor, 'maquette-header').from + 1)}
    />
  ),
};
export const LinkBubbleShownDark: Story = { ...LinkBubbleShown, globals: { mode: 'dark' } };

const imageDoc = (id: string) =>
  ({
    type: 'doc',
    content: [
      paragraph(text('Maquette validée :')),
      { type: 'image', attrs: { attachmentId: id, width: 70 } },
    ],
  }) as NonNullable<NotesDoc>;

/** NoteBlocks B, "Image redimensionnable": selected, two handles, the width hint (⌥/Alt + ← → also resize). */
export const ImageSelected: Story = {
  render: () => (
    <Frame
      doc={imageDoc(IMAGE_ID)}
      onReady={({ editor }) => editor.chain().focus().setNodeSelection(findNode(editor, 'image')).run()}
    />
  ),
};
export const ImageSelectedDark: Story = { ...ImageSelected, globals: { mode: 'dark' } };

/** NoteBlocks A, "Image supprimée": the attachment was deleted from the task. */
export const ImageDeleted: Story = { render: () => <Frame doc={imageDoc(GONE_ID)} /> };
export const ImageDeletedDark: Story = { ...ImageDeleted, globals: { mode: 'dark' } };

/** NoteBlocks B, "Tableau · poignées": the "+" bands of a hovered table (right: column, bottom: row). */
export const TableBands: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [paragraph(text('Hauteurs retenues :')), table] }}
      onReady={({ showTableBands }) => showTableBands()}
    />
  ),
};
export const TableBandsDark: Story = { ...TableBands, globals: { mode: 'dark' } };

/**
 * NoteLinks A, keyboard path: the caret in a link, then Tab — the bubble keeps the focus on Ouvrir
 * (its tooltip gives ⌥/Alt + Enter, which opens the link from the text).
 */
export const LinkBubbleFocused: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro] }}
      onReady={({ editor }) => {
        editor.commands.focus();
        editor.commands.setTextSelection(findText(editor, 'maquette-header').from + 3);
        requestAnimationFrame(() =>
          editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })),
        );
      }}
    />
  ),
};
export const LinkBubbleFocusedDark: Story = { ...LinkBubbleFocused, globals: { mode: 'dark' } };

/** Sets a field's value as typing would (React listens to `input`), then presses Enter in it. */
function typeAndEnter(field: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

/** NoteLinks A, "Adresse non valide" (approved with the lot 6 review): another scheme is refused. */
export const LinkInvalid: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro] }}
      onReady={({ editor, openLinkPopover }) => {
        editor.chain().focus().setTextSelection(findText(editor, 'validée le 30 sept.')).run();
        openLinkPopover();
        requestAnimationFrame(() => {
          const field = document.querySelector<HTMLInputElement>('section[role="dialog"] input');
          if (field) typeAndEnter(field, 'ftp://exemple.fr/maquettes');
        });
      }}
    />
  ),
};
export const LinkInvalidDark: Story = { ...LinkInvalid, globals: { mode: 'dark' } };

/** task-detail/FullScreen: the "/" menu under the caret, "Blocs" and their Markdown shortcuts. */
export const SlashMenuOpen: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro, { type: 'paragraph' }] }}
      onReady={({ editor }) => {
        editor.chain().focus('end').insertContent('/').run();
      }}
    />
  ),
};
export const SlashMenuOpenDark: Story = { ...SlashMenuOpen, globals: { mode: 'dark' } };

/** The "/" menu when nothing matches what was typed (approved with the lot 6 review). */
export const SlashMenuNoMatch: Story = {
  render: () => (
    <Frame
      doc={{ type: 'doc', content: [intro, { type: 'paragraph' }] }}
      onReady={({ editor }) => {
        editor.chain().focus('end').insertContent('/zzz').run();
      }}
    />
  ),
};
export const SlashMenuNoMatchDark: Story = { ...SlashMenuNoMatch, globals: { mode: 'dark' } };
