import type { BoardDetail, BoardSummary } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoardView } from './BoardView';
import { FirstLaunch } from './FirstLaunch';
import { Sidebar } from './Sidebar';

const board: BoardDetail = {
  id: '01920000-0000-7000-8000-000000000001',
  name: 'Mon premier board',
  icon: null,
  color: null,
  taskCount: 0,
  columns: [
    {
      id: '01920000-0000-7000-8000-000000000011',
      name: 'À faire',
      icon: 'inbox',
      color: 'slate',
      category: 'todo',
      displayLimit: null,
      rank: 'V',
    },
    {
      id: '01920000-0000-7000-8000-000000000012',
      name: 'En cours',
      icon: 'play',
      color: 'blue',
      category: 'in_progress',
      displayLimit: null,
      rank: 'k',
    },
    {
      id: '01920000-0000-7000-8000-000000000013',
      name: 'Terminé',
      icon: 'circle-check',
      color: 'green',
      category: 'done',
      displayLimit: null,
      rank: 's',
    },
  ],
};
const boards: BoardSummary[] = [
  board,
  { ...board, id: '01920000-0000-7000-8000-000000000002', name: 'Perso', taskCount: 9 },
];

const meta = { title: 'Boards/Screens' } satisfies Meta;
export default meta;
type Story = StoryObj;

const frame = (children: React.ReactNode) => (
  <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">{children}</div>
);

/** Approved mockup: docs/design/mockups/empty-states (first launch). */
export const FirstLaunchScreen: Story = {
  render: () =>
    frame(
      <>
        <Sidebar boards={[]} collapsed={false} onToggle={() => undefined} onSelectBoard={() => undefined} />
        <FirstLaunch onCreateEmpty={() => undefined} />
      </>,
    ),
};

/** Approved mockup: docs/design/mockups/empty-states (new board). */
export const NewBoard: Story = {
  render: () =>
    frame(
      <>
        <Sidebar
          boards={boards}
          activeBoardId={board.id}
          collapsed={false}
          onToggle={() => undefined}
          onSelectBoard={() => undefined}
        />
        <BoardView board={board} />
      </>,
    ),
};

export const CollapsedSidebar: Story = {
  render: () =>
    frame(
      <>
        <Sidebar
          boards={boards}
          activeBoardId={board.id}
          collapsed
          onToggle={() => undefined}
          onSelectBoard={() => undefined}
        />
        <BoardView board={board} />
      </>,
    ),
};

export const FirstLaunchDark: Story = { ...FirstLaunchScreen, globals: { mode: 'dark' } };
export const NewBoardDark: Story = { ...NewBoard, globals: { mode: 'dark' } };

export const FirstLaunchCreating: Story = {
  render: () =>
    frame(
      <>
        <Sidebar boards={[]} collapsed={false} onToggle={() => undefined} onSelectBoard={() => undefined} />
        <FirstLaunch onCreateEmpty={() => undefined} creating />
      </>,
    ),
};

export const CollapsedSidebarNoBoard: Story = {
  render: () =>
    frame(
      <>
        <Sidebar boards={[]} collapsed onToggle={() => undefined} onSelectBoard={() => undefined} />
        <FirstLaunch onCreateEmpty={() => undefined} />
      </>,
    ),
};
