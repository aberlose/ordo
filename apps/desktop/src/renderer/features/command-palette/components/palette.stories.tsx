import type { BoardSummary, SearchHit } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BoardView } from '@renderer/features/boards';
import { boardKeys, searchKeys } from '@renderer/shared/api/keys';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { columns, taggedBoard } from '@renderer/test/fixtures';
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

function seeded(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(boardKeys.all, boards);
  client.setQueryData(boardKeys.detail(board.id), board);
  client.setQueryData(searchKeys.recent, recent);
  client.setQueryData(searchKeys.tasks('header'), headerHits);
  client.setQueryData(searchKeys.tasks('hedaer'), []);
  const version = client.getQueryState(boardKeys.detail(board.id))?.dataUpdatedAt ?? 0;
  client.setQueryData(searchKeys.board(board.id, 'header', version), { taskIds: [header.id, id(6)] });
  client.setQueryData(searchKeys.board(board.id, 'hedaer', version), { taskIds: [] });
  return client;
}

function Screen({ query }: { query: string }) {
  const [client] = useState(seeded);
  return (
    <QueryClientProvider client={client}>
      <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">
        <MainArea>
          <BoardView board={board} />
        </MainArea>
        <Palette
          open
          initialQuery={query}
          onClose={() => undefined}
          boardId={board.id}
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
