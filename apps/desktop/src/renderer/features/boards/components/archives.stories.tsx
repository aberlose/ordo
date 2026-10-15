import type { ArchivedBoard } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Archives } from './Archives';

const day = 86_400_000;
/** Fixed reference time, so the archive dates (and the year shown for an old one) are stable. */
const now = new Date(2026, 9, 14, 10).getTime();
const archived: ArchivedBoard[] = [
  {
    id: '01920000-0000-7000-8000-000000000101',
    name: 'Mariage de Julie',
    icon: 'heart',
    color: 'pink',
    taskCount: 31,
    archivedAt: now - 12 * day,
  },
  {
    id: '01920000-0000-7000-8000-000000000102',
    name: 'Site v1 (2025)',
    icon: 'code',
    color: 'cyan',
    taskCount: 58,
    archivedAt: now - 30 * day,
  },
  {
    id: '01920000-0000-7000-8000-000000000103',
    name: 'Voyage au Portugal',
    icon: 'plane',
    color: 'orange',
    taskCount: 17,
    archivedAt: now - 45 * day,
  },
  {
    id: '01920000-0000-7000-8000-000000000104',
    name: 'Ancien board sans icône',
    icon: null,
    color: null,
    taskCount: 1,
    archivedAt: now - 400 * day,
  },
];

/** Restoring removes the row, as the optimistic update does in the app. */
function Interactive({ initial }: { initial: ArchivedBoard[] }) {
  const [boards, setBoards] = useState(initial);
  return (
    <Archives
      boards={boards}
      now={now}
      onRestore={(id) => setBoards((list) => list.filter((board) => board.id !== id))}
    />
  );
}

/** Approved mockup: docs/design/mockups/boards/BoardArchives (variant A). */
const meta = {
  title: 'Boards/Archives',
  render: () => <Interactive initial={archived} />,
  decorators: [
    (Story) => (
      <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};
export const ListDark: Story = { globals: { mode: 'dark' } };
export const Empty: Story = { render: () => <Interactive initial={[]} /> };
export const EmptyDark: Story = { ...Empty, globals: { mode: 'dark' } };
/** Approved with the lot 4 review (no mockup): the archives could not be loaded. */
export const LoadError: Story = {
  render: () => <Archives boards={undefined} loadError onRetry={() => {}} onRestore={() => {}} now={now} />,
};
export const LoadErrorDark: Story = { ...LoadError, globals: { mode: 'dark' } };
