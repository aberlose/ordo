import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchStore } from '@renderer/features/search';
import { taggedBoard as board } from '@renderer/test/fixtures';
import { BoardView } from './BoardView';

// jsdom has no layout: give the virtualised columns a size so they render their cards.
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 800, right: 300, width: 300, height: 800 };
const original = HTMLElement.prototype.getBoundingClientRect;
const sizes = ['offsetWidth', 'offsetHeight'] as const;
const descriptors = sizes.map((size) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, size));
beforeAll(() => {
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
