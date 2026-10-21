import { EMPTY_FILTERS, type TaskFilters } from '@ordo/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { taggedBoard, tags } from '@renderer/test/fixtures';
import { FilterBar } from './components/FilterBar';
import { effectiveFilters, filterTasks, optionCounts } from './filtering';
import { useTextMatches } from './hooks/useTextMatches';
import { useSearchStore } from './store';

const board = taggedBoard;
const today = todayDay();
const [, writeUp, , overduePdf, header] = board.tasks;
const tagId = (name: string) => tags.find((t) => t.name === name)!.id;

beforeEach(() => useSearchStore.setState({ byBoard: {}, preview: null }));

const filtersOf = (boardId = board.id) => useSearchStore.getState().byBoard[boardId] ?? EMPTY_FILTERS;

describe('search store', () => {
  it('toggles values, clears a kind, the text, or everything, per board', () => {
    const { toggle, clearKind, clearText, clearAll, apply } = useSearchStore.getState();
    toggle(board.id, 'priorities', 4);
    toggle(board.id, 'priorities', 5);
    toggle(board.id, 'due', 'overdue');
    expect(filtersOf().priorities).toEqual([4, 5]);
    toggle(board.id, 'priorities', 4);
    expect(filtersOf().priorities).toEqual([5]);
    expect(filtersOf('other')).toBe(EMPTY_FILTERS);
    clearKind(board.id, 'priorities');
    expect(filtersOf()).toEqual({ ...EMPTY_FILTERS, due: ['overdue'] });
    apply(board.id, { priorities: [1], tags: [], due: [], text: 'pdf' });
    expect(filtersOf().text).toBe('pdf');
    clearText(board.id);
    expect(filtersOf()).toEqual({ ...EMPTY_FILTERS, priorities: [1] });
    clearAll(board.id);
    expect(filtersOf()).toBe(EMPTY_FILTERS);
  });

  it('holds a transient preview apart from the applied filters', () => {
    const preview: TaskFilters = { ...EMPTY_FILTERS, due: ['none'] };
    useSearchStore.getState().setPreview(board.id, preview);
    expect(useSearchStore.getState().preview).toEqual({ boardId: board.id, filters: preview });
    expect(filtersOf()).toBe(EMPTY_FILTERS);
    useSearchStore.getState().clearPreview();
    expect(useSearchStore.getState().preview).toBeNull();
  });
});

describe('filtering', () => {
  it('matches priority, tags, due date and the text results, and keeps the array when inactive', () => {
    expect(filterTasks(board.tasks, EMPTY_FILTERS, today, null)).toBe(board.tasks);
    const high = { ...EMPTY_FILTERS, priorities: [4, 5] as const };
    expect(filterTasks(board.tasks, high, today, null)).toEqual([writeUp, overduePdf, header]);
    const overdue = { ...EMPTY_FILTERS, due: ['overdue'] as const };
    expect(filterTasks(board.tasks, overdue, today, null)).toEqual([overduePdf]);
    const tagged = { ...EMPTY_FILTERS, tags: [tagId('contenu'), tagId('urgent')] };
    expect(filterTasks(board.tasks, tagged, today, null)).toEqual([writeUp, header]);
    const text = { ...EMPTY_FILTERS, text: 'pdf' };
    expect(filterTasks(board.tasks, text, today, new Set([overduePdf!.id]))).toEqual([overduePdf]);
  });

  it('drops tags the board no longer has', () => {
    const filters = { ...EMPTY_FILTERS, tags: [tagId('front'), 'deleted'] };
    expect(effectiveFilters(filters, new Set([tagId('front')])).tags).toEqual([tagId('front')]);
    const kept = { ...EMPTY_FILTERS, tags: [tagId('front')] };
    expect(effectiveFilters(kept, new Set([tagId('front')]))).toBe(kept);
  });

  it('counts every card per option', () => {
    const counts = optionCounts(board.tasks, today);
    expect(counts.priorities.get(4)).toBe(2);
    expect(counts.priorities.get(3)).toBe(1);
    expect(counts.tags.get(tagId('front'))).toBe(1);
    expect(counts.due.get('overdue')).toBe(1);
    // Tasks without a due date: the demo and the contract.
    expect(counts.due.get('none')).toBe(2);
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('FilterBar', () => {
  const renderBar = (shownCount = board.tasks.length, filtered = false) =>
    render(<FilterBar board={board} today={today} shownCount={shownCount} filtered={filtered} />, {
      wrapper,
    });

  it('shows the total count and the palette shortcut while nothing is filtered', () => {
    const openPalette = vi.spyOn(usePalette.getState(), 'openPalette');
    usePalette.setState({ openPalette });
    renderBar();
    expect(screen.getByText('6 tâches')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Effacer les filtres' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ou tapez un filtre/ }));
    expect(openPalette).toHaveBeenCalled();
  });

  it('toggles priorities from the menu, which stays open, and labels the active button', async () => {
    renderBar();
    const trigger = screen.getByRole('button', { name: 'Priorité' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    const menu = await screen.findByRole('menu', { name: 'Priorité' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Haute, 2 tâches' }));
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Très haute, 1 tâche' }));
    expect(filtersOf().priorities).toEqual([4, 5]);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(
      within(menu).getByRole('menuitemcheckbox', { name: 'Haute, 2 tâches' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Priorité : Très haute, Haute' })).toBeTruthy();
  });

  it('labels tags and due dates, clears one kind, the text, or everything', () => {
    useSearchStore.getState().apply(board.id, {
      priorities: [],
      tags: [tagId('front'), 'deleted-tag'],
      due: ['none', 'overdue'],
      text: 'export',
    });
    renderBar(1, true);
    expect(screen.getByRole('button', { name: 'Tags : #front' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Échéance : En retard, Sans date' })).toBeTruthy();
    expect(screen.getByText('Texte : « export »')).toBeTruthy();
    expect(screen.getByText('1 sur 6 tâches')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce filtre : Tags' }));
    expect(filtersOf().tags).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre texte' }));
    expect(filtersOf().text).toBe('');
    expect(screen.queryByText('Texte : « export »')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(filtersOf()).toBe(EMPTY_FILTERS);
    expect(screen.getByRole('button', { name: 'Échéance' })).toBeTruthy();
  });

  it('is disabled on a board without tasks', () => {
    render(<FilterBar board={{ ...board, tasks: [] }} today={today} shownCount={0} filtered={false} />, {
      wrapper,
    });
    expect(screen.getByRole('button', { name: 'Priorité' })).toHaveProperty('disabled', true);
    expect(screen.getByText('0 tâche')).toBeTruthy();
  });
});

describe('useTextMatches', () => {
  const invoke = vi.fn();
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((channel: string, input: { text: string }) =>
      Promise.resolve(
        channel === 'search.boardTaskIds'
          ? { ok: true, data: { taskIds: input.text === 'pdf' ? [overduePdf!.id] : [] } }
          : { ok: true, data: board },
      ),
    );
    vi.stubGlobal('api', { invoke, getPathForFile: () => '' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is null without text, then the ids the index returns after the debounce', async () => {
    const { result, rerender } = renderHook(({ text }) => useTextMatches(board.id, text), {
      wrapper,
      initialProps: { text: '' },
    });
    expect(result.current).toBeNull();
    rerender({ text: 'pdf' });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(new Set([overduePdf!.id])));
    const searches = invoke.mock.calls.filter(([channel]) => channel === 'search.boardTaskIds');
    expect(searches).toEqual([['search.boardTaskIds', { boardId: board.id, text: 'pdf' }]]);
    // Typing on keeps the previous result until the new one arrives.
    rerender({ text: 'pdfx' });
    expect(result.current).toEqual(new Set([overduePdf!.id]));
    await waitFor(() => expect(result.current).toEqual(new Set()));
    rerender({ text: '  ' });
    expect(result.current).toBeNull();
  });
});
