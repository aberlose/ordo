import type { BoardSummary, SearchHit } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BoardView } from '@renderer/features/boards';
import { boardKeys, searchKeys } from '@renderer/shared/api/keys';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { columns, taggedBoard } from '@renderer/test/fixtures';
import { paletteTasksKey } from '../hooks/usePaletteSearch';
import { Palette } from './CommandPalette';

const board = { ...taggedBoard, icon: 'kanban', color: 'blue' as const };
const id = (n: number) => `01920000-0000-7000-8000-00000000080${n}`;
/** The boards of the approved mockups (docs/design/mockups/command-palette). */
const boards: BoardSummary[] = [
  { ...board, taskCount: board.tasks.length },
  { id: id(1), name: 'Perso', icon: 'house', color: 'blue', taskCount: 9 },
  { id: id(2), name: 'Veille tech', icon: 'lightbulb', color: 'violet', taskCount: 23 },
  { id: id(3), name: 'Déménagement', icon: 'package', color: 'amber', taskCount: 12 },
];

const hit = (fields: Partial<SearchHit> & Pick<SearchHit, 'id' | 'title'>): SearchHit => ({
  parentId: null,
  parentTitle: null,
  boardId: board.id,
  boardName: board.name,
  boardIcon: board.icon,
  boardColor: board.color,
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
const header = board.tasks[4]!;
const recent: SearchHit[] = [
  hit({ id: header.id, title: header.title, priority: 5 }),
  hit({ id: board.tasks[1]!.id, title: board.tasks[1]!.title, columnName: columns[0]!.name, priority: 4 }),
  hit({ id: board.tasks[3]!.id, title: board.tasks[3]!.title, priority: 4 }),
];
/** Approved mockup search-palette A, "header": two cards and a sub-task here, two tasks elsewhere. */
const headerHits: SearchHit[] = [
  hit({ id: header.id, title: header.title, priority: 5 }),
  hit({
    id: id(5),
    title: 'Version mobile du header',
    parentId: header.id,
    parentTitle: header.title,
    columnName: columns[0]!.name,
    columnIcon: columns[0]!.icon,
    columnColor: columns[0]!.color,
  }),
  hit({ id: id(6), title: 'Header : contraste du logo', priority: 2 }),
  hit({
    id: id(7),
    title: 'Lire « Sticky headers done right »',
    boardId: id(2),
    boardName: 'Veille tech',
    boardColor: 'violet',
    columnName: 'À lire',
  }),
  hit({
    id: id(8),
    title: 'Header de la newsletter perso',
    priority: 1,
    boardId: id(1),
    boardName: 'Perso',
    columnName: 'À faire',
  }),
];

/** "haute header": the header card here, a high task elsewhere. */
const highHeaderHits: SearchHit[] = [
  headerHits[0]!,
  hit({
    id: id(9),
    title: 'Header sticky sur mobile',
    priority: 4,
    boardId: id(2),
    boardName: 'Veille tech',
    boardColor: 'violet',
    columnName: 'À lire',
  }),
];
/** Ten hits on other boards: six rows and "+ 4 autres — affinez la recherche". */
const noteHits: SearchHit[] = Array.from({ length: 10 }, (_, i) =>
  hit({
    id: `01920000-0000-7000-8000-0000000007${String(i).padStart(2, '0')}`,
    title: `Note de lecture ${i + 1}`,
    boardId: i % 2 === 0 ? id(2) : id(3),
    boardName: i % 2 === 0 ? 'Veille tech' : 'Déménagement',
    boardColor: i % 2 === 0 ? 'violet' : 'amber',
    columnName: 'À lire',
  }),
);

function seeded(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(boardKeys.all, boards);
  client.setQueryData(boardKeys.detail(board.id), board);
  client.setQueryData(searchKeys.recent, recent);
  client.setQueryData(paletteTasksKey('header'), headerHits);
  client.setQueryData(paletteTasksKey('hedaer'), []);
  // What the main process returns with the typed filters (applied before the limit).
  client.setQueryData(
    paletteTasksKey('header', { priorities: [4, 5], due: [], tagNames: [] }),
    highHeaderHits,
  );
  client.setQueryData(paletteTasksKey('note'), noteHits);
  client.setQueryData(searchKeys.board(board.id, 'note'), { taskIds: [] });
  client.setQueryData(searchKeys.board(board.id, 'header'), { taskIds: [header.id, id(6)] });
  client.setQueryData(searchKeys.board(board.id, 'hedaer'), { taskIds: [] });
  return client;
}

function Screen({ query, noBoard = false }: { query: string; noBoard?: boolean }) {
  const [client] = useState(seeded);
  return (
    <QueryClientProvider client={client}>
      <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">
        <MainArea>{!noBoard && <BoardView board={board} />}</MainArea>
        <Palette
          open
          initialQuery={query}
          onClose={() => undefined}
          boardId={noBoard ? undefined : board.id}
          onShowBoard={() => undefined}
        />
      </div>
    </QueryClientProvider>
  );
}

const meta = { title: 'Command palette/Palette' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Approved mockup command-palette: recently opened, actions, go to board; "Nouvelle tâche" selected. */
export const EmptyQuery: Story = { render: () => <Screen query="" /> };
export const EmptyQueryDark: Story = { ...EmptyQuery, globals: { mode: 'dark' } };

/** Approved mockup search-palette A: free text, this board first, then the other boards. */
export const TypedQuery: Story = { render: () => <Screen query="header" /> };
export const TypedQueryDark: Story = { ...TypedQuery, globals: { mode: 'dark' } };

/** Approved board mockup: typed filters as chips, the board behind filtered live. */
export const TypedFilters: Story = { render: () => <Screen query="haute #front" /> };
export const TypedFiltersDark: Story = { ...TypedFilters, globals: { mode: 'dark' } };

/** Tag suggestions for an unknown "#prefix". */
export const TagSuggestions: Story = { render: () => <Screen query="#de" /> };
export const TagSuggestionsDark: Story = { ...TagSuggestions, globals: { mode: 'dark' } };

/** Approved mockup search-palette A: no result anywhere, the commands stay. */
export const NoResult: Story = { render: () => <Screen query="hedaer" /> };
export const NoResultDark: Story = { ...NoResult, globals: { mode: 'dark' } };

/** Approved board mockup "haute header" with a task selected (↓): "↵ sur une tâche l’ouvre". */
export const TaskSelected: Story = {
  render: () => <Screen query="haute header" />,
  play: async () => {
    const input = document.querySelector<HTMLInputElement>('[cmdk-input]');
    for (let i = 0; i < 50 && !document.querySelector('[cmdk-item][data-value^="task:"]'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  },
};
export const TaskSelectedDark: Story = { ...TaskSelected, globals: { mode: 'dark' } };

/** Approved with the lot 7 review: a group cut at 6 rows, the rest in a grey row. */
export const ManyResults: Story = { render: () => <Screen query="note" /> };
export const ManyResultsDark: Story = { ...ManyResults, globals: { mode: 'dark' } };

/** Approved with the lot 7 review: filters only, no card of this board matches. */
export const NoBoardMatch: Story = { render: () => <Screen query="#back" /> };
export const NoBoardMatchDark: Story = { ...NoBoardMatch, globals: { mode: 'dark' } };

/** Approved with the lot 7 review: no board shown, the typed filters are ignored. */
export const NoBoardShown: Story = { render: () => <Screen query="haute header" noBoard /> };
export const NoBoardShownDark: Story = { ...NoBoardShown, globals: { mode: 'dark' } };

/** Approved with the lot 7 review: the search failed (no main process in Storybook), "Réessayer". */
export const SearchError: Story = { render: () => <Screen query="zzz" /> };
export const SearchErrorDark: Story = { ...SearchError, globals: { mode: 'dark' } };
