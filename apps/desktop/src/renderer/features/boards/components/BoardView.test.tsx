import type { BoardDetail, Task } from '@ordo/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchStore } from '@renderer/features/search';
import { useTaskUi } from '@renderer/features/tasks';
import { useLayout } from '@renderer/shared/layout/store';
import { taggedBoard as board } from '@renderer/test/fixtures';
import { BoardView } from './BoardView';

// jsdom has no layout: give the virtualised columns a size so they render their cards.
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 800, right: 300, width: 300, height: 800 };
const original = HTMLElement.prototype.getBoundingClientRect;
const sizes = ['offsetWidth', 'offsetHeight'] as const;
const descriptors = sizes.map((size) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, size));
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
  HTMLElement.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
  for (const size of sizes) {
    Object.defineProperty(HTMLElement.prototype, size, { configurable: true, get: () => 800 });
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
  sizes.forEach((size, i) => {
    const descriptor = descriptors[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, size, descriptor);
  });
  vi.unstubAllGlobals();
});

beforeEach(() => {
  useSearchStore.setState({ byBoard: {}, preview: null });
  vi.stubGlobal('api', {
    invoke: () => Promise.resolve({ ok: true, data: board }),
    getPathForFile: () => '',
  });
});

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['boards', board.id], board);
  return render(
    <QueryClientProvider client={client}>
      <BoardView board={board} />
    </QueryClientProvider>,
  );
}

const card = (title: RegExp) => screen.getByRole('button', { name: title });
const column = (name: string) => screen.getByRole('region', { name });

describe('BoardView filters', () => {
  it('shows only matching cards, filtered counts, and the dashed box in empty columns', () => {
    useSearchStore.getState().apply(board.id, { priorities: [4, 5], tags: [], due: [], text: '' });
    renderBoard();
    expect(within(column('À faire')).getAllByRole('button', { name: /Rédiger/ })).toHaveLength(1);
    expect(within(column('À faire')).queryByRole('button', { name: /Mettre à jour/ })).toBeNull();
    expect(
      within(column('En cours')).getAllByRole('button', { name: /export PDF|nouveau header/ }),
    ).toHaveLength(2);
    expect(within(column('Terminé')).getByText('Aucune tâche ne correspond aux filtres')).toBeTruthy();
    expect(screen.getByText('3 sur 6 tâches')).toBeTruthy();
  });
});

describe('BoardView keyboard navigation', () => {
  it('moves the focus with plain arrows between visible cards and columns', async () => {
    renderBoard();
    const first = card(/Mettre à jour les dépendances/);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(card(/Rédiger le compte rendu/)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(card(/nouveau header/)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    // "Terminé" has a single card: the last one at that position.
    await waitFor(() => expect(document.activeElement).toBe(card(/Relire le contrat/)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(card(/Relire le contrat/));
  });

  it('skips the cards hidden by the filters', async () => {
    useSearchStore.getState().apply(board.id, { priorities: [4, 5], tags: [], due: [], text: '' });
    renderBoard();
    const writeUp = card(/Rédiger le compte rendu/);
    writeUp.focus();
    fireEvent.keyDown(writeUp, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(card(/export PDF/)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    // "Terminé" shows no card: nothing further right.
    expect(document.activeElement).toBe(card(/export PDF/));
  });
});

describe('BoardView quick add', () => {
  const doneColumn = board.columns[2]!;
  const created: Task = {
    ...board.tasks[5]!,
    id: '01920000-0000-7000-8000-000000000999',
    title: 'Nouvelle tâche hors filtre',
    priority: 3,
    rank: 'z',
    tagIds: [],
  };

  /** The board as the app shows it: read from the query cache, so optimistic patches show. */
  function LiveBoard() {
    const { data } = useQuery<BoardDetail>({ queryKey: ['boards', board.id], queryFn: () => board });
    return data ? <BoardView board={data} /> : null;
  }

  function renderLive(data: BoardDetail = board) {
    vi.stubGlobal('api', {
      invoke: (channel: string) =>
        Promise.resolve({ ok: true, data: channel === 'tasks.create' ? created : board }),
      getPathForFile: () => '',
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['boards', board.id], data);
    render(
      <QueryClientProvider client={client}>
        <LiveBoard />
      </QueryClientProvider>,
    );
    return client;
  }

  beforeEach(() =>
    useTaskUi.setState({ quickAddColumnId: null, keptTaskIds: new Set(), expandedColumnIds: new Set() }),
  );

  it('keeps the new card shown until the filters change, without the dashed box while adding', async () => {
    useSearchStore.getState().apply(board.id, { priorities: [5], tags: [], due: [], text: '' });
    renderLive();
    const done = column('Terminé');
    expect(within(done).getByText('Aucune tâche ne correspond aux filtres')).toBeTruthy();

    act(() => useTaskUi.getState().openQuickAdd(doneColumn.id));
    expect(within(done).queryByText('Aucune tâche ne correspond aux filtres')).toBeNull();

    const input = within(done).getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
    fireEvent.change(input, { target: { value: created.title } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Shown at once (temporary id), then as the saved task, although its priority does not match.
    expect(await within(done).findByRole('button', { name: /Nouvelle tâche hors filtre/ })).toBeTruthy();
    await waitFor(() => expect(useTaskUi.getState().keptTaskIds).toEqual(new Set([created.id])));
    expect(within(done).getByRole('button', { name: /Nouvelle tâche hors filtre/ })).toBeTruthy();
    expect(screen.getByText('2 sur 7 tâches')).toBeTruthy();

    act(() => useSearchStore.getState().toggle(board.id, 'priorities', 4));
    expect(within(done).queryByRole('button', { name: /Nouvelle tâche hors filtre/ })).toBeNull();
    expect(useTaskUi.getState().keptTaskIds.size).toBe(0);
  });

  it('keeps nothing when no filter is active', () => {
    renderLive();
    act(() => useTaskUi.getState().openQuickAdd(doneColumn.id));
    const input = within(column('Terminé')).getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
    fireEvent.change(input, { target: { value: created.title } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useTaskUi.getState().keptTaskIds.size).toBe(0);
  });

  it('expands the column when tasks are added past its limit faster than they show', () => {
    // "Terminé" holds one task and shows two: the second quick add, typed before the first card is
    // in the board, is the one past the limit.
    renderLive({
      ...board,
      columns: board.columns.map((c) => (c.id === doneColumn.id ? { ...c, displayLimit: 2 } : c)),
    });
    act(() => useTaskUi.getState().openQuickAdd(doneColumn.id));
    const input = within(column('Terminé')).getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
    for (const title of ['Première', 'Deuxième']) {
      fireEvent.change(input, { target: { value: title } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(useTaskUi.getState().expandedColumnIds.has(doneColumn.id)).toBe(true);
  });
});

describe('BoardView new column request', () => {
  it('opens the new-column popover when the palette asks for it', async () => {
    renderBoard();
    expect(screen.queryByText('Nouvelle colonne', { selector: 'h2, h3, [id]' })).toBeNull();
    act(() => useLayout.getState().requestNewColumn());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(within(screen.getByRole('dialog')).getAllByText('Nouvelle colonne').length).toBeGreaterThan(0);
  });
});
