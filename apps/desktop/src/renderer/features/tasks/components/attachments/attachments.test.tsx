import type { AddAttachmentsOutput, Attachment } from '@ordo/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentKeys } from '@renderer/shared/api/keys';
import { today } from '@renderer/shared/lib/dates';
import { tasks } from '@renderer/test/fixtures';
import { TaskCard } from '../TaskCard';
import { AttachmentDropTarget } from './AttachmentDropTarget';
import { AttachmentSection } from './AttachmentSection';
import { useUploads } from './uploads';

const BOARD = '01920000-0000-7000-8000-000000000001';
const TASK = tasks[4]!.id;
const at = new Date(2026, 8, 30).getTime();
const file = (
  id: string,
  fileName: string,
  sizeBytes: number,
  mimeType: string | null = null,
): Attachment => ({
  id,
  taskId: TASK,
  fileName,
  mimeType,
  sizeBytes,
  createdAt: at,
  url: `ordo-file://attachment/${id}`,
});
const files = [
  file('01920000-0000-7000-8000-00000000a001', 'maquette-header-v3.png', 412 * 1024, 'image/png'),
  file('01920000-0000-7000-8000-00000000a002', 'cahier-des-charges.pdf', 1.8 * 1024 * 1024),
];

type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
type Handler = (input: Record<string, unknown>) => Promise<Reply> | Reply;
let invoke: ReturnType<typeof vi.fn<(channel: string, input: Record<string, unknown>) => Promise<Reply>>>;
let getPathForFile: ReturnType<typeof vi.fn<(file: unknown) => string>>;

const ok = (data: unknown): Reply => ({ ok: true, data });
const added = (output: AddAttachmentsOutput) => ok(output);

function fakeApi(handlers: Record<string, Handler> = {}) {
  let list = [...files];
  invoke = vi.fn(async (channel: string, input: Record<string, unknown>): Promise<Reply> => {
    const handler = handlers[channel];
    if (handler) {
      // The main process keeps what it copied: later list refetches include it.
      const reply = await handler(input);
      if (reply.ok && channel === 'attachments.add')
        list.push(...(reply.data as AddAttachmentsOutput).attachments);
      if (reply.ok && channel === 'attachments.addData') list.push(reply.data as Attachment);
      if (reply.ok && channel === 'attachments.list') list = reply.data as Attachment[];
      return reply;
    }
    switch (channel) {
      case 'attachments.list':
        return ok(list);
      case 'attachments.open':
        return ok({ opened: true });
      case 'attachments.delete':
        list = list.filter((a) => a.id !== input['id']);
        return ok(null);
      default:
        return ok(null);
    }
  });
  getPathForFile = vi.fn((f: unknown) => `/Users/me/${(f as File).name}`);
  vi.stubGlobal('api', { invoke, getPathForFile });
}

function renderSection({ withDrop = false, empty = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (!empty) client.setQueryData(attachmentKeys.list(TASK), files);
  render(
    <QueryClientProvider client={client}>
      <div data-testid="window">
        <AttachmentSection boardId={BOARD} taskId={TASK} />
        {withDrop && <AttachmentDropTarget boardId={BOARD} taskId={TASK} />}
      </div>
    </QueryClientProvider>,
  );
  return client;
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const text = (element: Element | null | undefined) => element?.textContent?.replace(/\u00a0/g, ' ') ?? '';
const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const calls = (channel: string) => invoke.mock.calls.filter(([c]) => c === channel).map(([, input]) => input);

function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions de ${name}` }), { key: 'Enter' });
  return screen.getByRole('menu');
}

function dropFiles(target: Element, dropped: File[]) {
  const dataTransfer = {
    files: dropped,
    types: ['Files'],
    items: dropped.map((f) => ({ kind: 'file', type: f.type })),
    dropEffect: 'none',
  };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  return () => fireEvent.drop(target, { dataTransfer });
}

beforeEach(() => {
  fakeApi();
  useUploads.setState({ uploads: [] });
});

describe('AttachmentSection', () => {
  it('lists the files with their size and date, then the add tile', () => {
    renderSection();
    const section = screen.getByRole('region', { name: 'Pièces jointes' });
    expect(text(section)).toContain('Pièces jointes2');
    expect(text(tile('maquette-header-v3.png'))).toContain('412 Ko · 30 sept.');
    expect(text(tile('cahier-des-charges.pdf'))).toContain('1,8 Mo · 30 sept.');
    // An image shows its thumbnail, another file its type badge.
    expect(tile('maquette-header-v3.png').querySelector('img')?.getAttribute('src')).toBe(files[0]!.url);
    expect(text(tile('cahier-des-charges.pdf'))).toContain('PDF');
    expect(screen.getByRole('button', { name: 'Ajouter ou déposer' })).toBeTruthy();
  });

  it('shows only the add tile when there is no file, which opens the file dialog', async () => {
    fakeApi({
      'attachments.list': () => ok([]),
      'attachments.pick': () => added({ attachments: [], failures: [] }),
    });
    renderSection({ empty: true });
    await settle();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ou déposer' }));
    await settle();
    expect(calls('attachments.pick')).toEqual([{ taskId: TASK }]);
  });

  it('opens a file on Enter and on double-click, not on a single click', async () => {
    renderSection();
    fireEvent.click(tile('cahier-des-charges.pdf'), { detail: 1 });
    expect(calls('attachments.open')).toEqual([]);
    fireEvent.keyDown(tile('cahier-des-charges.pdf'), { key: 'Enter' });
    fireEvent.doubleClick(tile('maquette-header-v3.png'));
    await settle();
    expect(calls('attachments.open')).toEqual([{ id: files[1]!.id }, { id: files[0]!.id }]);
  });

  it('tells the user when a file cannot be opened', async () => {
    fakeApi({ 'attachments.open': () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'gone' } }) });
    renderSection();
    fireEvent.keyDown(tile('cahier-des-charges.pdf'), { key: 'Enter' });
    await settle();
    const { useFeedback } = await import('@renderer/shared/feedback/store');
    expect(useFeedback.getState().toast?.message).toMatch(/^Ouverture impossible/);
  });

  it('does not run a program: the main process shows it in its folder and the toast says why', async () => {
    fakeApi({ 'attachments.open': () => ok({ opened: false }) });
    renderSection();
    fireEvent.keyDown(tile('cahier-des-charges.pdf'), { key: 'Enter' });
    await settle();
    const { useFeedback } = await import('@renderer/shared/feedback/store');
    // jsdom is neither macOS nor Windows: "dans son dossier".
    expect(useFeedback.getState().toast?.message).toBe(
      'Ce type de fichier ne s’ouvre pas depuis Ordo : il est affiché dans son dossier.',
    );
  });

  it('shows "Copie…" on the add tile while the file dialog and its copy run', async () => {
    let finish: (reply: Reply) => void = () => {};
    fakeApi({ 'attachments.pick': () => new Promise<Reply>((resolve) => (finish = resolve)) });
    renderSection();
    const add = screen.getByRole('button', { name: 'Ajouter ou déposer' });
    fireEvent.click(add);
    await settle();
    expect(add.getAttribute('aria-busy')).toBe('true');
    expect(text(add)).toContain('Copie…');
    // A second click does not open another dialog.
    fireEvent.click(add);
    await act(async () => finish(added({ attachments: [], failures: [] })));
    await settle();
    expect(calls('attachments.pick')).toHaveLength(1);
    expect(add.hasAttribute('aria-busy')).toBe(false);
    expect(text(add)).not.toContain('Copie…');
  });

  it('shows a load error in a dashed box with Réessayer', async () => {
    let failing = true;
    fakeApi({
      'attachments.list': () =>
        failing ? { ok: false, error: { code: 'INTERNAL', message: 'db' } } : ok(files.slice(0, 1)),
    });
    renderSection({ empty: true });
    const alert = await screen.findByRole('alert');
    expect(text(alert)).toContain('Impossible de charger les pièces jointes.');
    failing = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(tile('maquette-header-v3.png')).toBeTruthy();
  });

  it('opens and reveals a file from its ⋯ menu', async () => {
    renderSection();
    let menu = openMenu('cahier-des-charges.pdf');
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => text(item));
    expect(items).toEqual(['Ouvrir↵', 'Afficher dans le dossier', 'Supprimer…']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Ouvrir/ }));
    menu = openMenu('cahier-des-charges.pdf');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Afficher dans le dossier' }));
    await settle();
    expect(calls('attachments.open')).toEqual([{ id: files[1]!.id }]);
    expect(calls('attachments.reveal')).toEqual([{ id: files[1]!.id }]);
  });

  it('deletes a file only after the confirmation, then moves the focus to the next tile', async () => {
    renderSection();
    fireEvent.click(within(openMenu('maquette-header-v3.png')).getByRole('menuitem', { name: 'Supprimer…' }));
    let bubble = await screen.findByRole('alertdialog', { name: 'Supprimer la pièce jointe' });
    expect(text(bubble)).toContain('Supprimer « maquette-header-v3.png » ?');
    // An image: the notes lose it too.
    expect(text(bubble)).toContain('remplacée par un cadre vide');
    await settle();
    expect(document.activeElement).toBe(within(bubble).getByRole('button', { name: 'Annuler' }));

    fireEvent.click(within(bubble).getByRole('button', { name: 'Annuler' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls('attachments.delete')).toEqual([]);

    fireEvent.click(within(openMenu('maquette-header-v3.png')).getByRole('menuitem', { name: 'Supprimer…' }));
    bubble = await screen.findByRole('alertdialog');
    fireEvent.click(within(bubble).getByRole('button', { name: 'Supprimer' }));
    await settle();
    expect(calls('attachments.delete')).toEqual([{ id: files[0]!.id }]);
    expect(screen.queryByRole('button', { name: /^maquette-header-v3.png/ })).toBeNull();
    expect(document.activeElement).toBe(tile('cahier-des-charges.pdf'));
  });

  it('moves the focus to the add tile after deleting the last file', async () => {
    renderSection();
    fireEvent.click(within(openMenu('cahier-des-charges.pdf')).getByRole('menuitem', { name: 'Supprimer…' }));
    const bubble = await screen.findByRole('alertdialog');
    expect(text(bubble)).not.toContain('cadre vide');
    fireEvent.click(within(bubble).getByRole('button', { name: 'Supprimer' }));
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajouter ou déposer' }));
  });
});

describe('dropping files on the window', () => {
  it('shows the overlay, then copies the files by path with a "Copie…" tile each', async () => {
    let finish: (reply: Reply) => void = () => {};
    fakeApi({ 'attachments.add': () => new Promise<Reply>((resolve) => (finish = resolve)) });
    renderSection({ withDrop: true });
    const target = screen.getByTestId('window');
    const drop = dropFiles(target, [new File(['x'], 'brief.pdf'), new File(['y'], 'logo.svg')]);
    expect(text(document.querySelector('[data-attachment-drop]'))).toContain(
      'Déposez pour joindre2 fichiers · copiés dans le dossier d’Ordo',
    );

    drop();
    await settle();
    expect(document.querySelector('[data-attachment-drop]')).toBeNull();
    expect(calls('attachments.add')).toEqual([
      { taskId: TASK, paths: ['/Users/me/brief.pdf', '/Users/me/logo.svg'] },
    ]);
    expect(screen.getAllByText('Copie…')).toHaveLength(2);

    const saved = file('01920000-0000-7000-8000-00000000a003', 'brief.pdf', 2048);
    const logo = file('01920000-0000-7000-8000-00000000a004', 'logo.svg', 900, 'image/svg+xml');
    await act(async () => finish(added({ attachments: [saved, logo], failures: [] })));
    await settle();
    expect(screen.queryByText('Copie…')).toBeNull();
    expect(tile('brief.pdf')).toBeTruthy();
  });

  it('hides the overlay when the drag leaves the window or on Escape', () => {
    renderSection({ withDrop: true });
    const target = screen.getByTestId('window');
    dropFiles(target, [new File(['x'], 'a.txt')]);
    // A child entered then left: still over the window.
    fireEvent.dragEnter(tile('cahier-des-charges.pdf'), { dataTransfer: { types: ['Files'], items: [] } });
    fireEvent.dragLeave(tile('cahier-des-charges.pdf'), { dataTransfer: { types: ['Files'], items: [] } });
    expect(document.querySelector('[data-attachment-drop]')).not.toBeNull();
    fireEvent.dragLeave(target, { dataTransfer: { types: ['Files'], items: [] } });
    expect(document.querySelector('[data-attachment-drop]')).toBeNull();

    dropFiles(target, [new File(['x'], 'a.txt')]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-attachment-drop]')).toBeNull();
  });

  it('leaves image drags over the notes text to the editor, not other files', () => {
    const client = new QueryClient();
    client.setQueryData(attachmentKeys.list(TASK), files);
    render(
      <QueryClientProvider client={client}>
        <div data-testid="window">
          <div className="ProseMirror" data-testid="text" />
          <AttachmentDropTarget boardId={BOARD} taskId={TASK} />
        </div>
      </QueryClientProvider>,
    );
    const over = (type: string) =>
      fireEvent.dragEnter(screen.getByTestId('text'), {
        dataTransfer: { types: ['Files'], items: [{ kind: 'file', type }] },
      });
    over('application/pdf');
    expect(document.querySelector('[data-attachment-drop]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    over('image/png');
    expect(document.querySelector('[data-attachment-drop]')).toBeNull();
  });

  it('sends the bytes of a file that has no path', async () => {
    fakeApi({
      'attachments.addData': () =>
        ok(file('01920000-0000-7000-8000-00000000a005', 'image.png', 3, 'image/png')),
    });
    getPathForFile.mockReturnValue('');
    renderSection({ withDrop: true });
    const blob = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' });
    dropFiles(screen.getByTestId('window'), [blob])();
    await settle();
    const [input] = calls('attachments.addData');
    expect(input).toMatchObject({ taskId: TASK, fileName: 'image.png', mimeType: 'image/png' });
    expect(Array.from(input!['bytes'] as Uint8Array)).toEqual([1, 2, 3]);
    expect(calls('attachments.add')).toEqual([]);
  });

  it('keeps a failed copy as a red tile that can be retried or dismissed', async () => {
    let fail = true;
    fakeApi({
      'attachments.add': () =>
        fail
          ? added({
              attachments: [],
              failures: [{ path: '/Users/me/export.zip', fileName: 'export.zip', message: 'EACCES' }],
            })
          : added({
              attachments: [file('01920000-0000-7000-8000-00000000a006', 'export.zip', 10)],
              failures: [],
            }),
    });
    renderSection({ withDrop: true });
    dropFiles(screen.getByTestId('window'), [new File(['z'], 'export.zip')])();
    await settle();
    expect(screen.getByText('Copie impossible')).toBeTruthy();
    // Announced politely: the focus is elsewhere.
    const { useFeedback } = await import('@renderer/shared/feedback/store');
    await vi.waitFor(() =>
      expect(useFeedback.getState().announcement).toMatch(/^Copie impossible : export\.zip/),
    );

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer la copie de export.zip' }));
    await settle();
    expect(calls('attachments.add').at(-1)).toEqual({ taskId: TASK, paths: ['/Users/me/export.zip'] });
    expect(screen.queryByText('Copie impossible')).toBeNull();
    expect(tile('export.zip')).toBeTruthy();
  });

  it('dismisses a failed tile with ×', async () => {
    fakeApi({
      'attachments.add': () =>
        added({ attachments: [], failures: [{ path: '/Users/me/a.zip', fileName: 'a.zip', message: 'x' }] }),
    });
    renderSection({ withDrop: true });
    dropFiles(screen.getByTestId('window'), [new File(['z'], 'a.zip')])();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer a.zip' }));
    expect(screen.queryByText('Copie impossible')).toBeNull();
  });
});

describe('TaskCard', () => {
  it('shows the attachment count on the bottom line', () => {
    const { rerender } = render(<TaskCard task={tasks[4]!} today={today()} onOpen={() => {}} />);
    expect(text(screen.getByRole('button'))).not.toContain('pièce jointe');
    rerender(<TaskCard task={{ ...tasks[4]!, attachmentCount: 3 }} today={today()} onOpen={() => {}} />);
    expect(text(screen.getByRole('button'))).toContain('3 pièces jointes');
  });
});
