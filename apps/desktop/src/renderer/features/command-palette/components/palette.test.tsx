import type { BoardDetail, BoardSummary, SearchHit, Task } from '@ordo/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchStore } from '@renderer/features/search';
import { useTaskUi } from '@renderer/features/tasks';
import { useAppearance } from '@renderer/shared/appearance/store';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { useLayout } from '@renderer/shared/layout/store';
import { columns, taggedBoard as board, tags } from '@renderer/test/fixtures';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useRecordRecentOpens } from '../hooks/useRecentOpens';
import { Palette } from './CommandPalette';

const id = (n: number) => `01920000-0000-7000-8000-00000000090${n}`;
const boards: BoardSummary[] = [
  { id: board.id, name: board.name, icon: 'kanban', color: 'blue', taskCount: board.tasks.length },
  { id: id(1), name: 'Perso', icon: 'house', color: 'green', taskCount: 9 },
  { id: id(2), name: 'Veille tech', icon: 'lightbulb', color: 'violet', taskCount: 23 },
];
const header = board.tasks[4]!; // "Intégrer le nouveau header", priority 5, #front…

const hit = (fields: Partial<SearchHit> & Pick<SearchHit, 'id' | 'title'>): SearchHit => ({
  parentId: null,
  parentTitle: null,
  boardId: board.id,
  boardName: board.name,
  boardIcon: 'kanban',
  boardColor: 'blue',
  columnId: columns[1]!.id,
  columnName: columns[1]!.name,
  columnIcon: columns[1]!.icon,
  columnColor: columns[1]!.color,
  columnCategory: 'in_progress',
  priority: 3,
  dueDate: null,
  completedAt: null,
  tagNames: [],
  ...fields,
});
const headerHit = hit({ id: header.id, title: header.title, priority: 5, tagNames: ['front', 'design'] });
const subtaskHit = hit({
  id: id(5),
  title: 'Version mobile du header',
  parentId: header.id,
  parentTitle: header.title,
  columnName: columns[0]!.name,
});
const otherHit = hit({
  id: id(6),
  title: 'Header de la newsletter perso',
  priority: 1,
  boardId: id(1),
  boardName: 'Perso',
  boardColor: 'green',
  columnName: 'À faire',
});

let searchResults: SearchHit[] = [];
let shownBoard: BoardDetail = board;
/** Ids `search.boardTaskIds` returns; by default this board's card hits. */
let boardIds: string[] | null = null;
let searchFails = false;
const invoke = vi.fn(async (channel: string, input: unknown) => {
  const data = (() => {
    switch (channel) {
      case 'boards.list':
        return boards;
      case 'boards.get':
        return shownBoard;
      case 'recent.list':
        return [headerHit, subtaskHit];
      case 'recent.record':
        return {};
      case 'search.tasks':
        if (searchFails) return { error: true };
        return searchResults;
      case 'search.boardTaskIds': {
        const text = (input as { text: string }).text;
        if (boardIds) return { taskIds: boardIds };
        return {
          taskIds: searchResults
            .filter((h) => h.boardId === board.id && !h.parentId && text)
            .map((h) => h.id),
        };
      }
      default:
        throw new Error(`Unexpected ${channel}`);
    }
  })();
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: { code: 'internal', message: 'Search failed' } };
  }
  return { ok: true, data };
});

beforeEach(() => {
  vi.stubGlobal('api', { invoke, getPathForFile: vi.fn() });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  searchResults = [];
  shownBoard = board;
  boardIds = null;
  searchFails = false;
  invoke.mockClear();
  useSearchStore.setState({ byBoard: {}, preview: null });
  useTaskUi.setState({ openTaskId: null, quickAddColumnId: null });
  usePalette.setState({ open: false, initialQuery: '' });
  useLayout.setState({ sidebarCollapsed: false, newColumnRequest: 0 });
});
afterEach(() => vi.unstubAllGlobals());

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const onShowBoard = vi.fn(() => Promise.resolve());

function Harness({ boardId }: { boardId: string | undefined }) {
  const [open, setOpen] = useState(true);
  return <Palette open={open} onClose={() => setOpen(false)} boardId={boardId} onShowBoard={onShowBoard} />;
}

function renderPalette(boardId: string | undefined) {
  render(<Harness boardId={boardId} />, { wrapper });
  return screen.getByRole('combobox', { name: 'Rechercher, filtrer ou lancer une commande' });
}

const option = (name: RegExp | string) => screen.getByRole('option', { name });
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

describe('Palette — empty query', () => {
  it('shows the recently opened tasks, the actions and the other boards, "Nouvelle tâche" selected', async () => {
    const input = renderPalette(board.id);
    expect(input.getAttribute('placeholder')).toBe(
      'Rechercher une tâche, filtrer (#tag, haute…) ou lancer une commande',
    );
    await screen.findByText('Récemment ouvertes');
    expect(option(/^Intégrer le nouveau headerEn cours$/).textContent).toContain('En cours');
    // A sub-task names its parent.
    expect(option(/Version mobile du header/).textContent).toContain('Intégrer le nouveau header › ');
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(option(/^Nouvelle tâche/).getAttribute('aria-selected')).toBe('true');
    for (const name of ['Nouveau board', 'Basculer clair / sombre', 'Réduire la barre latérale']) {
      expect(option(new RegExp(name))).toBeTruthy();
    }
    // Hidden until lots 8 and 9.
    expect(screen.queryByRole('option', { name: /réglages|corbeille/i })).toBeNull();
    await screen.findByText('Aller au board');
    expect(option(/^Perso/).textContent).toContain('9 tâches');
    expect(screen.queryByRole('option', { name: /^Refonte site client/ })).toBeNull();
    expect(screen.getByText('naviguer')).toBeTruthy();
  });

  it('hides the actions that need a board when none is shown', async () => {
    renderPalette(undefined);
    await screen.findByText('Aller au board');
    expect(screen.queryByRole('option', { name: /^Nouvelle tâche/ })).toBeNull();
    expect(option(/^Refonte site client/)).toBeTruthy();
  });

  it('opens a recent task on another board after showing that board', async () => {
    renderPalette(id(2));
    fireEvent.click(await screen.findByRole('option', { name: /^Intégrer le nouveau headerEn cours$/ }));
    await waitFor(() => expect(useTaskUi.getState().openTaskId).toBe(header.id));
    expect(onShowBoard).toHaveBeenCalledWith(board.id);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Palette — typed query', () => {
  it('shows the recognised filters, previews them on the board and applies them with Enter', async () => {
    const input = renderPalette(board.id);
    await screen.findByText('Aller au board');
    type(input, 'haute #front');
    expect(screen.getByText('Priorité ≥ Haute')).toBeTruthy();
    expect(screen.getByText('#front')).toBeTruthy();
    expect(screen.getByText('1 tâche sur 6 sur ce board — le board se met à jour en direct')).toBeTruthy();
    const group = screen.getByText('Ce board · Refonte site client · 1').parentElement!;
    expect(within(group).getByRole('option', { name: /Intégrer le nouveau header/ })).toBeTruthy();
    const front = tags.find((tag) => tag.name === 'front')!.id;
    expect(useSearchStore.getState().preview).toEqual({
      boardId: board.id,
      filters: { priorities: [4, 5], tags: [front], due: [], text: '' },
    });
    await waitFor(() =>
      expect(option(/Appliquer comme filtres du board/).getAttribute('aria-selected')).toBe('true'),
    );

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useSearchStore.getState().byBoard[board.id]).toEqual({
      priorities: [4, 5],
      tags: [front],
      due: [],
      text: '',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useSearchStore.getState().preview).toBeNull();
  });

  it('says when nothing is recognised', async () => {
    const input = renderPalette(board.id);
    type(input, '#zz');
    expect(screen.getByText('aucun — essayez #front, haute, retard')).toBeTruthy();
    type(input, 'zzz');
    expect(screen.queryByText('aucun — essayez #front, haute, retard')).toBeNull();
    expect(screen.getByText('texte : « zzz »')).toBeTruthy();
  });

  it('chips "Priorité : Haute"-style labels for other priority sets and due words', async () => {
    const input = renderPalette(board.id);
    type(input, 'très haute retard semaine');
    expect(screen.getByText('Priorité : Très haute')).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByText('Cette semaine')).toBeTruthy();
    type(input, 'basse');
    expect(screen.getByText('Priorité ≤ Basse')).toBeTruthy();
  });

  it('groups free-text hits: this board (with sub-tasks), then other boards, matched words bold', async () => {
    searchResults = [headerHit, subtaskHit, otherHit];
    const input = renderPalette(board.id);
    type(input, 'header');
    await screen.findByText('Ce board · Refonte site client · 2');
    const sub = option(/Version mobile du header/);
    expect(within(sub).getByText('Intégrer le nouveau header ›', { exact: false }).className).toContain(
      'text-text-3',
    );
    expect(within(sub).getByText('header').tagName).toBe('B');
    expect(screen.getByText('Autres boards · 1')).toBeTruthy();
    const other = option(/Header de la newsletter perso/);
    expect(other.textContent).toContain('Perso · À faire');
    expect(within(other).getByText('P')).toBeTruthy();
    expect(within(other).getByText('Header').tagName).toBe('B');
    await screen.findByText('1 tâche sur 6 sur ce board — le board se met à jour en direct');
  });

  it('applies the typed priority to other boards too, and says when nothing is left there', async () => {
    searchResults = [headerHit, otherHit];
    const input = renderPalette(board.id);
    type(input, 'haute header');
    await screen.findByText('Ce board · Refonte site client · 1');
    expect(screen.getByText('Autres boards · 0')).toBeTruthy();
    expect(screen.getByText('Aucune tâche ailleurs.')).toBeTruthy();
  });

  it('says when no task matches anywhere, and keeps the commands', async () => {
    searchResults = [];
    const input = renderPalette(board.id);
    type(input, 'hedaer');
    await screen.findByText('Tâches · 0');
    expect(
      screen.getByText(
        'Aucune tâche ne correspond à « hedaer », ni sur ce board ni ailleurs. Vérifiez l’orthographe ou retirez un filtre.',
      ),
    ).toBeTruthy();
    expect(option(/Appliquer comme filtres du board/)).toBeTruthy();
    expect(option(/^Nouvelle tâche/)).toBeTruthy();
  });

  it('suggests board tags for an unknown "#prefix" and completes the query', async () => {
    const input = renderPalette(board.id);
    await screen.findByText('Aller au board');
    type(input, 'haute #fr');
    expect(screen.getByText('Tags')).toBeTruthy();
    fireEvent.click(option('#front'));
    expect((input as HTMLInputElement).value).toBe('haute #front ');
    expect(screen.queryByText('Tags')).toBeNull();
    expect(screen.getByText('#front')).toBeTruthy();
  });

  it('opens the selected task with Enter and closes the palette', async () => {
    searchResults = [otherHit];
    const input = renderPalette(board.id);
    type(input, 'header');
    await screen.findByText('Autres boards · 1');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(option(/Header de la newsletter perso/).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('0 tâche sur 6 sur ce board')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(useTaskUi.getState().openTaskId).toBe(otherHit.id));
    expect(onShowBoard).toHaveBeenCalledWith(id(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/** A board of `count` cards titled "Tâche n", all in the first column. */
function bigBoard(count: number): BoardDetail {
  const cards: Task[] = Array.from({ length: count }, (_, i) => ({
    ...board.tasks[0]!,
    id: `01920000-0000-7000-8000-${String(i).padStart(12, '0')}`,
    title: `Tâche ${i + 1}`,
    priority: 3,
    dueDate: null,
    tagIds: [],
    rank: `a${String(i).padStart(3, '0')}`,
  }));
  return { ...board, tags, taskCount: count, tasks: cards };
}

const lastInput = (channel: string) =>
  invoke.mock.calls.filter(([c]) => c === channel).at(-1)?.[1] as Record<string, unknown> | undefined;

describe('Palette — lot 7 review states', () => {
  it('builds "Ce board" from every matching card past the search limit, 6 rows and a grey rest', async () => {
    shownBoard = bigBoard(60);
    boardIds = shownBoard.tasks.map((task) => task.id);
    // The search limit: 50 hits, all on this board.
    searchResults = shownBoard.tasks.slice(0, 50).map((task) => hit({ id: task.id, title: task.title }));
    const input = renderPalette(board.id);
    type(input, 'tâche');
    const heading = await screen.findByText('Ce board · Refonte site client · 60');
    const group = heading.parentElement!;
    expect(within(group).getAllByRole('option')).toHaveLength(6);
    const rest = within(group).getByText('+ 54 autres — ↵ sur Appliquer pour tout voir sur le board');
    expect(rest.closest('[role="option"]')).toBeNull();
    expect(screen.getByText('60 tâches sur 60 sur ce board — le board se met à jour en direct')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Home' });
    expect(screen.getByText('60 tâches sur 60 sur ce board — ↵ sur une tâche l’ouvre')).toBeTruthy();
  });

  it('sends the typed filters with the text so the limit applies after them, and cuts other boards at 6', async () => {
    searchResults = Array.from({ length: 50 }, (_, i) =>
      hit({
        id: `01920000-0000-7000-8000-1${String(i).padStart(11, '0')}`,
        title: `Header ${i}`,
        priority: 5,
        tagNames: ['Front'],
        dueDate: '2020-01-01',
        boardId: id(1),
        boardName: 'Perso',
      }),
    );
    const input = renderPalette(board.id);
    await screen.findByText('Aller au board');
    type(input, 'haute retard #front header');
    await screen.findByText('Autres boards · 50+');
    expect(lastInput('search.tasks')).toMatchObject({
      text: 'header',
      limit: 50,
      priorities: [4, 5],
      due: ['overdue'],
      tagNames: ['front'],
    });
    expect(lastInput('search.tasks')?.['today']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const group = screen.getByText('Autres boards · 50+').parentElement!;
    expect(within(group).getAllByRole('option')).toHaveLength(6);
    expect(within(group).getByText('+ 44 autres ou plus — affinez la recherche')).toBeTruthy();
  });

  it('counts "+ N autres" exactly when the search did not hit its limit', async () => {
    searchResults = Array.from({ length: 8 }, (_, i) =>
      hit({
        id: `01920000-0000-7000-8000-2${String(i).padStart(11, '0')}`,
        title: `Header ${i}`,
        boardId: id(1),
      }),
    );
    const input = renderPalette(board.id);
    type(input, 'header');
    await screen.findByText('Autres boards · 8');
    expect(screen.getByText('+ 2 autres — affinez la recherche')).toBeTruthy();
  });

  it('with no board shown, finds tasks under "Tâches", ignores the typed filters and says so', async () => {
    searchResults = [headerHit, otherHit];
    const input = renderPalette(undefined);
    type(input, 'haute header');
    await screen.findByText('Tâches · 2');
    expect(screen.getByText('Ouvrez un board pour filtrer')).toBeTruthy();
    expect(lastInput('search.tasks')).toEqual({ text: 'header', limit: 50 });
    expect(option(/Header de la newsletter perso/).textContent).toContain('Perso · À faire');
    expect(screen.queryByText('Commandes')).toBeNull();
  });

  it('with no board shown and filters only, offers the boards to open instead of an empty list', async () => {
    const input = renderPalette(undefined);
    type(input, 'haute');
    expect(screen.getByText('Ouvrez un board pour filtrer')).toBeTruthy();
    await screen.findByText('Aller au board');
    expect(option(/^Refonte site client/)).toBeTruthy();
  });

  it('says when the board has no card for filters only', async () => {
    const input = renderPalette(board.id);
    await screen.findByText('Aller au board');
    type(input, '#back');
    expect(screen.getByText('Ce board · Refonte site client · 0')).toBeTruthy();
    expect(screen.getByText('Aucune tâche de ce board ne correspond aux filtres.')).toBeTruthy();
    expect(screen.queryByText(/ni sur ce board ni ailleurs/)).toBeNull();
    expect(option(/Appliquer comme filtres du board/)).toBeTruthy();
  });

  it('shows a failed search with "Réessayer", which searches again', async () => {
    searchFails = true;
    const input = renderPalette(board.id);
    type(input, 'header');
    expect((await screen.findByRole('alert')).textContent).toBe('La recherche a échoué.');
    expect(option(/Appliquer comme filtres du board/)).toBeTruthy();
    searchFails = false;
    searchResults = [otherHit];
    fireEvent.click(option(/^Réessayer/));
    await screen.findByText('Autres boards · 1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('"Nouvelle colonne" asks the board for its new-column popover, and needs a board', async () => {
    renderPalette(board.id);
    await screen.findByRole('option', { name: 'Nouvelle colonne' });
    const actions = screen.getByText('Actions').parentElement!;
    const names = within(actions)
      .getAllByRole('option')
      .map((row) => row.textContent);
    expect(names.slice(0, 3)).toEqual(['Nouvelle tâcheN', 'Nouvelle colonne', 'Nouveau board']);
    fireEvent.click(option('Nouvelle colonne'));
    await waitFor(() => expect(useLayout.getState().newColumnRequest).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides "Nouvelle colonne" with no board shown', async () => {
    renderPalette(undefined);
    await screen.findByText('Aller au board');
    expect(screen.queryByRole('option', { name: 'Nouvelle colonne' })).toBeNull();
  });

  it('labels the theme shortcut with words off macOS', async () => {
    renderPalette(board.id);
    await screen.findByText('Actions');
    expect(option(/Basculer clair/).textContent).toBe('Basculer clair / sombreCtrlShiftL');
  });
});

describe('global shortcuts', () => {
  it('⌘/Ctrl + K toggles the palette, but not from inside the notes editor', () => {
    renderHook(() => useGlobalShortcuts());
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(usePalette.getState().open).toBe(true);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(usePalette.getState().open).toBe(false);

    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.className = 'ProseMirror';
    document.body.append(editor);
    fireEvent.keyDown(editor, { key: 'k', ctrlKey: true });
    expect(usePalette.getState().open).toBe(false);
    editor.remove();
  });

  it('"/" opens the palette outside text fields only', () => {
    renderHook(() => useGlobalShortcuts());
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: '/' });
    expect(usePalette.getState().open).toBe(false);
    field.remove();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(usePalette.getState().open).toBe(true);
  });

  it('toggles light / dark and the sidebar', () => {
    renderHook(() => useGlobalShortcuts());
    document.documentElement.dataset['mode'] = 'light';
    fireEvent.keyDown(document.body, { key: 'L', ctrlKey: true, shiftKey: true });
    expect(useAppearance.getState().mode).toBe('dark');
    fireEvent.keyDown(document.body, { key: '\\', ctrlKey: true });
    expect(useLayout.getState().sidebarCollapsed).toBe(true);
    // Plain keys are left alone.
    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('recently opened', () => {
  it('records every task opening', async () => {
    renderHook(() => useRecordRecentOpens(), { wrapper });
    act(() => useTaskUi.getState().openTask(header.id));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('recent.record', { taskId: header.id }));
  });
});
