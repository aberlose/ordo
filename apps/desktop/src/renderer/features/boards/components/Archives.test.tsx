import type { ArchivedBoard } from '@ordo/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Archives, ArchivesPage } from './Archives';

const now = new Date(2026, 9, 14).getTime();
const archived: ArchivedBoard[] = [
  {
    id: '01920000-0000-7000-8000-000000000101',
    name: 'Mariage de Julie',
    icon: 'heart',
    color: 'pink',
    taskCount: 31,
    archivedAt: new Date(2026, 9, 2).getTime(),
  },
  {
    id: '01920000-0000-7000-8000-000000000102',
    name: 'Site v1 (2025)',
    icon: 'code',
    color: 'cyan',
    taskCount: 1,
    archivedAt: new Date(2026, 8, 14).getTime(),
  },
  {
    id: '01920000-0000-7000-8000-000000000103',
    name: 'Voyage au Portugal',
    icon: null,
    color: null,
    taskCount: 17,
    archivedAt: new Date(2025, 7, 30).getTime(),
  },
];

const restoreButton = (name: string) => screen.getByRole('button', { name: `Restaurer « ${name} »` });

describe('Archives', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists archived boards with their task count and archive date', () => {
    render(<Archives boards={archived} onRestore={() => undefined} now={now} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Archives' })).toBeTruthy();
    expect(screen.getByText('3 boards')).toBeTruthy();
    const rows = within(screen.getByRole('list', { name: 'Boards archivés' })).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain('Mariage de Julie');
    expect(rows[0]!.textContent).toContain('31 tâches · archivé le 2 oct.');
    expect(rows[1]!.textContent).toContain('1 tâche · archivé le 14 sept.');
    // Another year shows the year.
    expect(rows[2]!.textContent).toContain('17 tâches · archivé le 30 août 2025');
  });

  it('restores a board and moves the focus to the next row, else the previous one, else the title', () => {
    const onRestore = vi.fn();
    const { rerender } = render(<Archives boards={archived} onRestore={onRestore} now={now} />);
    fireEvent.click(restoreButton('Site v1 (2025)'));
    expect(onRestore).toHaveBeenCalledWith(archived[1]!.id);
    expect(document.activeElement).toBe(restoreButton('Voyage au Portugal'));

    rerender(<Archives boards={[archived[0]!, archived[2]!]} onRestore={onRestore} now={now} />);
    fireEvent.click(restoreButton('Voyage au Portugal'));
    expect(document.activeElement).toBe(restoreButton('Mariage de Julie'));

    rerender(<Archives boards={[archived[0]!]} onRestore={onRestore} now={now} />);
    fireEvent.click(restoreButton('Mariage de Julie'));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('shows the empty state', () => {
    render(<Archives boards={[]} onRestore={() => undefined} />);
    expect(screen.getByText('Aucun board archivé')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/boards?$/)).toBeNull();
  });

  it('offers a retry when the archives cannot be loaded', () => {
    const onRetry = vi.fn();
    render(<Archives boards={undefined} loadError onRetry={onRetry} onRestore={() => {}} now={now} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger les archives.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls boards.restore and removes the row at once', async () => {
    const invoke = vi.fn((channel: string) => {
      if (channel === 'boards.listArchived') return Promise.resolve({ ok: true, data: archived });
      if (channel === 'boards.restore') return new Promise(() => undefined);
      return Promise.resolve({ ok: true, data: [] });
    });
    vi.stubGlobal('api', { invoke });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ArchivesPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurer « Mariage de Julie »' }));
    await waitFor(() => expect(screen.queryByText('Mariage de Julie')).toBeNull());
    expect(invoke).toHaveBeenCalledWith('boards.restore', { id: archived[0]!.id });
  });
});
