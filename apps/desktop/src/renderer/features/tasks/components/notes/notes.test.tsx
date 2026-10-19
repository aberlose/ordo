import type { Attachment } from '@ordo/contracts';
import { IMAGE_WIDTH_MAX, IMAGE_WIDTH_MIN } from '@ordo/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeSelection } from '@tiptap/pm/state';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@renderer/i18n';
import { attachmentKeys, descriptionKeys } from '@renderer/shared/api/keys';
import { createAutosave, useNotesAutosave } from '../../hooks/notes';
import {
  dragImageWidth,
  filterBlocks,
  isAllowedLink,
  linkLabel,
  normalizeLink,
  stepImageWidth,
} from './helpers';
import { LinkPopover } from './LinkPopover';
import { NotesEditorView, type NotesHandle } from './NotesEditor';

const TASK = '01920000-0000-7000-8000-000000000105';
const BOARD = '01920000-0000-7000-8000-000000000001';
const IMAGE_ID = '01920000-0000-7000-8000-000000000901';

type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
let invoke: ReturnType<typeof vi.fn<(channel: string, input: Record<string, unknown>) => Promise<Reply>>>;

beforeEach(() => {
  invoke = vi.fn(async (channel: string, input: Record<string, unknown>): Promise<Reply> => {
    if (channel === 'tasks.updateDescription')
      return { ok: true, data: { id: input['id'], json: input['json'], updatedAt: 1 } };
    return { ok: true, data: [] };
  });
  vi.stubGlobal('api', { invoke, getPathForFile: () => '' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function wrapper(
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } }),
) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('autosave', () => {
  it('saves once, 500 ms after the last change, with the last document', () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = createAutosave<string>(save);
    autosave.schedule('a');
    vi.advanceTimersByTime(300);
    autosave.schedule('ab');
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith('ab');
  });

  it('flushes a pending document at once, and only once', () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = createAutosave<string>(save);
    autosave.flush();
    expect(save).not.toHaveBeenCalled();
    autosave.schedule('abc');
    expect(autosave.pending).toBe(true);
    autosave.flush();
    expect(save).toHaveBeenCalledWith('abc');
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves the pending notes when the editor goes away (window closed, other task)', async () => {
    vi.useFakeTimers();
    let schedule: ((d: never) => void) | undefined;
    function Probe() {
      schedule = useNotesAutosave(TASK).schedule as (d: never) => void;
      return null;
    }
    const view = render(<Probe />, { wrapper: wrapper() });
    act(() => schedule?.(doc('Bonjour') as never));
    view.unmount();
    await vi.advanceTimersByTimeAsync(0);
    const saves = invoke.mock.calls.filter(([channel]) => channel === 'tasks.updateDescription');
    expect(saves).toHaveLength(1);
    expect(saves[0]?.[1]).toEqual({ id: TASK, json: doc('Bonjour') });
  });

  it('stores an empty note as null', async () => {
    vi.useFakeTimers();
    let schedule: ((d: never) => void) | undefined;
    function Probe() {
      schedule = useNotesAutosave(TASK).schedule as (d: never) => void;
      return null;
    }
    render(<Probe />, { wrapper: wrapper() });
    act(() => schedule?.({ type: 'doc', content: [{ type: 'paragraph' }] } as never));
    await vi.advanceTimersByTimeAsync(500);
    expect(invoke).toHaveBeenCalledWith('tasks.updateDescription', { id: TASK, json: null });
  });
});

describe('links', () => {
  it('normalises addresses typed without a scheme', () => {
    expect(normalizeLink('exemple.fr')).toBe('https://exemple.fr');
    expect(normalizeLink('  exemple.fr/maquettes/header ')).toBe('https://exemple.fr/maquettes/header');
    expect(normalizeLink('localhost:3000')).toBe('https://localhost:3000');
    expect(normalizeLink('nom@exemple.fr')).toBe('mailto:nom@exemple.fr');
    expect(normalizeLink('http://exemple.fr')).toBe('http://exemple.fr');
    expect(normalizeLink('mailto:nom@exemple.fr')).toBe('mailto:nom@exemple.fr');
  });

  it('accepts only http, https and mailto', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('file:///etc/passwd')).toBeNull();
    expect(normalizeLink('ftp://exemple.fr')).toBeNull();
    expect(normalizeLink('data:text/html,hello')).toBeNull();
    expect(normalizeLink('')).toBeNull();
    expect(normalizeLink('deux mots')).toBeNull();
    expect(normalizeLink('notes')).toBeNull();
    expect(isAllowedLink('https://exemple.fr')).toBe(true);
    expect(isAllowedLink('ordo-file://attachment/x')).toBe(false);
    expect(linkLabel('https://exemple.fr/maquettes/header/')).toBe('exemple.fr/maquettes/header');
  });

  it('applies a normalised address on Enter, and refuses another scheme', () => {
    const onApply = vi.fn();
    render(<LinkPopover initial="" style={{}} onApply={onApply} onCancel={() => {}} />);
    const field = screen.getByRole('textbox', { name: i18n.t('notes.link.address') });
    fireEvent.change(field, { target: { value: 'javascript:alert(1)' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onApply).not.toHaveBeenCalled();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(i18n.t('notes.link.invalid'))).toBeTruthy();
    fireEvent.change(field, { target: { value: 'exemple.fr' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith('https://exemple.fr');
  });

  it('cancels on Escape and removes the link when the field is emptied', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<LinkPopover initial="https://exemple.fr" style={{}} onApply={onApply} onCancel={onCancel} />);
    const field = screen.getByRole('textbox', { name: i18n.t('notes.link.address') });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith(null);
  });
});

describe('"/" menu', () => {
  const label = (id: string) => i18n.t(`notes.blocks.${id}`);

  it('lists every block for "/" and filters as you type (accents ignored)', () => {
    expect(filterBlocks('', label).map((b) => b.id)).toHaveLength(9);
    expect(filterBlocks('tit', label).map((b) => b.id)).toEqual(['heading1', 'heading2', 'heading3']);
    expect(filterBlocks('cit', label).map((b) => b.id)).toEqual(['blockquote']);
    expect(filterBlocks('TABL', label).map((b) => b.id)).toEqual(['table']);
    expect(filterBlocks('coch', label).map((b) => b.id)).toEqual(['taskList']);
    expect(filterBlocks('code', label).map((b) => b.id)).toEqual(['codeBlock']);
    expect(filterBlocks('zzz', label)).toEqual([]);
  });

  it('matches English keywords in French and French ones in English', async () => {
    expect(filterBlocks('quote', label).map((b) => b.id)).toEqual(['blockquote']);
    await i18n.changeLanguage('en');
    try {
      expect(filterBlocks('titre', label).map((b) => b.id)).toEqual(['heading1', 'heading2', 'heading3']);
      expect(filterBlocks('check', label).map((b) => b.id)).toEqual(['taskList']);
    } finally {
      await i18n.changeLanguage('fr');
    }
  });
});

describe('"/" menu in the editor', () => {
  it('opens under "/", filters as you type, ↓ and Enter insert the block', async () => {
    const client = new QueryClient();
    client.setQueryData(attachmentKeys.list(TASK), []);
    let handle: NotesHandle | undefined;
    render(
      <NotesEditorView boardId={BOARD} taskId={TASK} initialDoc={null} onReady={(h) => (handle = h)} />,
      {
        wrapper: wrapper(client),
      },
    );
    const editor = handle!.editor;
    act(() => void editor.chain().focus().insertContent('/ti').run());
    const menu = await screen.findByRole('listbox', { name: i18n.t('notes.blocks.label') });
    const options = () => Array.from(menu.querySelectorAll('[role="option"]'));
    expect(options().map((o) => o.textContent)).toEqual(['Titre 1#', 'Titre 2##', 'Titre 3###']);
    expect(editor.view.dom.getAttribute('aria-activedescendant')).toBe('notes-slash-menu-heading1');
    act(() => void fireEvent.keyDown(editor.view.dom, { key: 'ArrowDown' }));
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true');
    act(() => void fireEvent.keyDown(editor.view.dom, { key: 'Enter' }));
    expect(editor.getJSON().content?.[0]).toEqual({ type: 'heading', attrs: { level: 2 } });
    await vi.waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
});

describe('images', () => {
  it('clamps the width given by the keyboard and the handles', () => {
    expect(stepImageWidth(70, 1)).toBe(75);
    expect(stepImageWidth(98, 1)).toBe(IMAGE_WIDTH_MAX);
    expect(stepImageWidth(22, -1)).toBe(IMAGE_WIDTH_MIN);
    expect(stepImageWidth(undefined, -1)).toBe(95);
    expect(dragImageWidth(70, 60, 600, 'right')).toBe(80);
    expect(dragImageWidth(70, 60, 600, 'left')).toBe(60);
    expect(dragImageWidth(70, -2000, 600, 'right')).toBe(IMAGE_WIDTH_MIN);
  });

  function renderNotes(width: number) {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const attachment: Attachment = {
      id: IMAGE_ID,
      taskId: TASK,
      fileName: 'maquette-header-v3.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      createdAt: 1,
      url: `ordo-file://attachment/${IMAGE_ID}`,
    };
    client.setQueryData(attachmentKeys.list(TASK), [attachment]);
    client.setQueryData(descriptionKeys.detail(TASK), null);
    let handle: NotesHandle | undefined;
    render(
      <NotesEditorView
        boardId={BOARD}
        taskId={TASK}
        initialDoc={{
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Maquette validée :' }] },
            { type: 'image', attrs: { attachmentId: IMAGE_ID, width } },
          ],
        }}
        onReady={(h) => (handle = h)}
      />,
      { wrapper: wrapper(client) },
    );
    const editor = handle!.editor;
    let imagePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imagePos = pos;
    });
    act(() => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos)));
    });
    const widthNow = () => editor.state.doc.nodeAt(imagePos)?.attrs['width'] as number;
    const press = (key: string) => act(() => void fireEvent.keyDown(editor.view.dom, { key }));
    return { editor, widthNow, press };
  }

  it('resizes the selected image by 5 % with ← →, within 20–100 %', async () => {
    const { widthNow, press, editor } = renderNotes(90);
    press('ArrowRight');
    expect(widthNow()).toBe(95);
    press('ArrowRight');
    press('ArrowRight');
    expect(widthNow()).toBe(IMAGE_WIDTH_MAX);
    for (let i = 0; i < 20; i++) press('ArrowLeft');
    expect(widthNow()).toBe(IMAGE_WIDTH_MIN);
    // The image stays selected (handles and hint shown).
    expect(editor.state.selection instanceof NodeSelection).toBe(true);
    expect(
      await screen.findByText(i18n.t('notes.image.resizeHint', { width: IMAGE_WIDTH_MIN })),
    ).toBeTruthy();
  });

  it('shows "Image supprimée" when the attachment is gone', () => {
    const client = new QueryClient();
    client.setQueryData(attachmentKeys.list(TASK), []);
    render(
      <NotesEditorView
        boardId={BOARD}
        taskId={TASK}
        initialDoc={{
          type: 'doc',
          content: [{ type: 'image', attrs: { attachmentId: IMAGE_ID, width: 70 } }],
        }}
      />,
      { wrapper: wrapper(client) },
    );
    expect(screen.getByRole('img', { name: i18n.t('notes.image.deletedLabel') })).toBeTruthy();
    expect(screen.getByText(i18n.t('notes.image.deleted'))).toBeTruthy();
  });
});
