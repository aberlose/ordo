import type { BoardSummary } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoardView } from './BoardView';
import { FirstLaunch } from './FirstLaunch';
import { board as boardWithTasks, emptyBoard } from '@renderer/test/fixtures';
import { Sidebar } from './Sidebar';

const board = emptyBoard;
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

/** Approved mockups: board and tasks (cards, quick add). */
export const WithTasks: Story = {
  render: () =>
    frame(
      <>
        <Sidebar
          boards={[{ ...boardWithTasks }]}
          activeBoardId={boardWithTasks.id}
          collapsed={false}
          onToggle={() => undefined}
          onSelectBoard={() => undefined}
        />
        <BoardView board={boardWithTasks} />
      </>,
    ),
};
export const WithTasksDark: Story = { ...WithTasks, globals: { mode: 'dark' } };
