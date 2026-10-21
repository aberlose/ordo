import type { BoardSummary, SearchHit } from '@ordo/contracts';
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
const invoke = vi.fn(async (channel: string, input: unknown) => {
  const data = (() => {
    switch (channel) {
      case 'boards.list':
        return boards;
      case 'boards.get':
        return board;
      case 'recent.list':
        return [headerHit, subtaskHit];
      case 'recent.record':
        return {};
      case 'search.tasks':
        return searchResults;
      case 'search.boardTaskIds': {
        const text = (input as { text: string }).text;
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
  invoke.mockClear();
  useSearchStore.setState({ byBoard: {}, preview: null });
  useTaskUi.setState({ openTaskId: null, quickAddColumnId: null });
  usePalette.setState({ open: false, initialQuery: '' });
  useLayout.setState({ sidebarCollapsed: false });
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
