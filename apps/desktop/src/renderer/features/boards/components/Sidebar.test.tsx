import type { BoardSummary } from '@ordo/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover, PopoverAnchor } from '@renderer/shared/ui/popover';
import { BoardDuplicateContent } from './BoardDuplicate';
import { BoardSettings, BoardSettingsContent } from './BoardSettings';
import { Sidebar, type SidebarProps } from './Sidebar';

const id = (n: number) => `01920000-0000-7000-8000-00000000000${n}`;
const boards: BoardSummary[] = [
  { id: id(1), name: 'Refonte site client', icon: 'kanban', color: 'blue', taskCount: 16 },
  { id: id(2), name: 'Perso', icon: 'house', color: 'green', taskCount: 9 },
  { id: id(3), name: 'Veille tech', icon: 'lightbulb', color: 'violet', taskCount: 23 },
];

const withClient = (children: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('BoardSettings', () => {
  it('creates a board with the first free colour, the board icon and the three-column hint', () => {
    const onSubmit = vi.fn();
    render(
      <BoardSettings
        usedColors={['slate', 'blue']}
        defaultOpen
        onSubmit={onSubmit}
        trigger={<button type="button">+</button>}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Nouveau board' });
    expect(within(dialog).getByRole('radio', { name: 'Cyan' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('radio', { name: 'Kanban' }).getAttribute('aria-checked')).toBe('true');
    expect(
      within(dialog).getByText('Il démarre avec trois colonnes : À faire, En cours, Terminé.'),
    ).toBeTruthy();
    const submit = within(dialog).getByRole('button', { name: 'Créer le board' });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nom' }), {
      target: { value: '  Lancement   newsletter ' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Rose' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Fusée' }));
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Lancement newsletter', icon: 'rocket', color: 'pink' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('edits the icon and colour of a board, with "Enregistrer" and no hint', () => {
    const onSubmit = vi.fn();
    render(
      <Popover open>
        <PopoverAnchor />
        <BoardSettingsContent board={boards[1]!} usedColors={[]} onSubmit={onSubmit} />
      </Popover>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Icône et couleur' });
    expect(within(dialog).getByRole('textbox', { name: 'Nom' })).toHaveProperty('value', 'Perso');
    expect(within(dialog).getByRole('radio', { name: 'Vert' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('radio', { name: 'Maison' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).queryByText(/trois colonnes/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Rouge' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Perso', icon: 'house', color: 'red' });
  });
});

describe('BoardDuplicateContent', () => {
  const renderDuplicate = (board: BoardSummary, onSubmit = vi.fn()) => {
    render(
      <Popover open>
        <PopoverAnchor />
        <BoardDuplicateContent board={board} onSubmit={onSubmit} />
      </Popover>,
    );
    return { dialog: screen.getByRole('dialog', { name: `Dupliquer « ${board.name} »` }), onSubmit };
  };

  it('suggests "Name (copie)" and includes the tasks by default', () => {
    const { dialog, onSubmit } = renderDuplicate(boards[1]!);
    expect(within(dialog).getByRole('textbox', { name: 'Nom de la copie' })).toHaveProperty(
      'value',
      'Perso (copie)',
    );
    const tasks = within(dialog).getByRole('checkbox', { name: 'Inclure les 9 tâches' });
    expect(tasks).toHaveProperty('checked', true);
    expect(tasks.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(tasks);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dupliquer' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Perso (copie)', includeTasks: false });
  });

  it('disables the task option on a board without tasks', () => {
    const { dialog, onSubmit } = renderDuplicate({ ...boards[1]!, taskCount: 0 });
    const tasks = within(dialog).getByRole('checkbox', { name: 'Aucune tâche à inclure' });
    expect(tasks).toHaveProperty('disabled', true);
    expect(tasks).toHaveProperty('checked', false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dupliquer' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Perso (copie)', includeTasks: false });
  });
});

describe('Sidebar', () => {
  function renderSidebar(props: Partial<SidebarProps> = {}) {
    const invoke = vi.fn((channel: string, input: { id?: string }) =>
      Promise.resolve(
        channel === 'boards.archive'
          ? { ok: true, data: { id: input.id, archivedAt: 0 } }
          : { ok: true, data: boards.find((b) => b.id === input.id) ?? boards[0] },
      ),
    );
    vi.stubGlobal('api', { invoke });
    const onSelectBoard = vi.fn();
    render(
      withClient(
        <Sidebar
          boards={boards}
          activeBoardId={id(2)}
          collapsed={false}
          onToggle={() => undefined}
          onSelectBoard={onSelectBoard}
          {...props}
        />,
      ),
    );
    return { invoke, onSelectBoard };
  }
  const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

  it('renames a board in place with F2: Enter saves and gives the focus back to the row', async () => {
    const { invoke } = renderSidebar();
    fireEvent.keyDown(row('Perso'), { key: 'F2' });
    const field = screen.getByRole('textbox', { name: 'Nom du board' });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Perso et maison' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.queryByRole('textbox', { name: 'Nom du board' })).toBeNull();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('boards.update', { id: id(2), name: 'Perso et maison' }),
    );
    expect(document.activeElement).toBe(row('Perso'));
  });

  it('cancels a rename with Escape or an empty name', () => {
    const { invoke } = renderSidebar();
    fireEvent.keyDown(row('Perso'), { key: 'F2' });
    const field = screen.getByRole('textbox', { name: 'Nom du board' });
    fireEvent.change(field, { target: { value: 'Autre nom' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Nom du board' })).toBeNull();
    expect(document.activeElement).toBe(row('Perso'));

    fireEvent.keyDown(row('Perso'), { key: 'F2' });
    const again = screen.getByRole('textbox', { name: 'Nom du board' });
    fireEvent.change(again, { target: { value: '   ' } });
    fireEvent.blur(again);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('opens the board menu on right click and archives the open board, opening the next one', async () => {
    const { invoke, onSelectBoard } = renderSidebar();
    fireEvent.contextMenu(row('Perso'));
    const menu = await screen.findByRole('menu', { name: 'Actions du board Perso' });
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);
    expect(items).toEqual(['RenommerF2', 'Icône et couleur…', 'Dupliquer…', 'Archiver']);
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archiver' }));
    });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('boards.archive', { id: id(2) }));
    expect(onSelectBoard).toHaveBeenCalledWith(id(3));
  });

  it('hands the focus to the rename field or the duplicate popover chosen in the menu', async () => {
    const { invoke } = renderSidebar();
    fireEvent.contextMenu(row('Perso'));
    let menu = await screen.findByRole('menu', { name: 'Actions du board Perso' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Renommer/ }));
    const field = await screen.findByRole('textbox', { name: 'Nom du board' });
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.keyDown(field, { key: 'Escape' });

    fireEvent.contextMenu(row('Perso'));
    menu = await screen.findByRole('menu', { name: 'Actions du board Perso' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Dupliquer…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dupliquer « Perso »' });
    const name = within(dialog).getByRole('textbox', { name: 'Nom de la copie' });
    await waitFor(() => expect(document.activeElement).toBe(name));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dupliquer' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('boards.duplicate', {
        id: id(2),
        name: 'Perso (copie)',
        includeTasks: true,
      }),
    );
  });

  it('marks the Archives row as the current page instead of a board', () => {
    const onOpenArchives = vi.fn();
    renderSidebar({ archivesActive: true, onOpenArchives });
    const archives = screen.getByRole('button', { name: 'Archives' });
    expect(archives.getAttribute('aria-current')).toBe('page');
    expect(row('Perso').getAttribute('aria-current')).toBeNull();
    fireEvent.click(archives);
    expect(onOpenArchives).toHaveBeenCalled();
  });
});
