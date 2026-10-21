import { EMPTY_FILTERS } from '@ordo/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useSearchStore } from '@renderer/features/search';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { taggedBoard as board } from '@renderer/test/fixtures';
import { BoardColumn } from './BoardColumn';
import { BoardView } from './BoardView';

const meta = { title: 'Boards/Filters' } satisfies Meta;
export default meta;
type Story = StoryObj;

const today = todayDay();
const usedColors = board.columns.map((c) => c.color);

const frame = (children: React.ReactNode) => (
  <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">{children}</div>
);

/** Approved mockup: board — a column with no card under the filters shows the dashed box. */
export const NoMatchColumn: Story = {
  render: () =>
    frame(
      <div className="flex items-start gap-7 p-6">
        <BoardColumn
          boardId={board.id}
          column={board.columns[2]!}
          tasks={[]}
          totalCount={1}
          filtered
          today={today}
          emptyHint={null}
          usedColors={usedColors}
          canDelete
          onKeyboardMoveTask={() => true}
          onKeyboardMoveColumn={() => true}
        />
      </div>,
    ),
};
export const NoMatchColumnDark: Story = { ...NoMatchColumn, globals: { mode: 'dark' } };

/** Approved mockup: board — "Priorité : Très haute, Haute": matching cards, filtered counts, an empty column. */
export const FilteredBoard: Story = {
  beforeEach: () => {
    useSearchStore.setState({ byBoard: {}, preview: null });
    useSearchStore.getState().apply(board.id, { ...EMPTY_FILTERS, priorities: [4, 5] });
  },
  render: () =>
    frame(
      <MainArea>
        <BoardView board={board} />
      </MainArea>,
    ),
};
export const FilteredBoardDark: Story = { ...FilteredBoard, globals: { mode: 'dark' } };
