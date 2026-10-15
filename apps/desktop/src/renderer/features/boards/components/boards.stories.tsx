import type { BoardSummary } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { useTaskUi } from '@renderer/features/tasks';
import i18n from '@renderer/i18n';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { BoardView } from './BoardView';
import { FirstLaunch } from './FirstLaunch';
import { board as boardWithTasks, emptyBoard } from '@renderer/test/fixtures';
import { BoardColumn, ColumnSlot } from './BoardColumn';
import { ColumnSettings } from './ColumnSettings';
import { Sidebar } from './Sidebar';

const board = emptyBoard;
const usedColors = boardWithTasks.columns.map((c) => c.color);
const today = new Date().toISOString().slice(0, 10);
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
        <MainArea>
          <BoardView board={board} />
        </MainArea>
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
        <MainArea>
          <BoardView board={board} />
        </MainArea>
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
        <MainArea>
          <BoardView board={boardWithTasks} />
        </MainArea>
      </>,
    ),
};
export const WithTasksDark: Story = { ...WithTasks, globals: { mode: 'dark' } };

/** Approved mockup: drag-and-drop/ColumnDrag B — header is the handle; a slot column opens at the destination. */
export const ColumnAndSlot: Story = {
  render: () =>
    frame(
      <div className="flex items-start gap-7 p-6">
        <BoardColumn
          boardId={boardWithTasks.id}
          column={boardWithTasks.columns[0]!}
          tasks={boardWithTasks.tasks.filter((t) => t.columnId === boardWithTasks.columns[0]!.id)}
          today={today}
          emptyHint={null}
          usedColors={usedColors}
          canDelete
          onKeyboardMoveTask={() => true}
          onKeyboardMoveColumn={() => true}
        />
        <div className="h-96">
          <ColumnSlot />
        </div>
      </div>,
    ),
};
export const ColumnAndSlotDark: Story = { ...ColumnAndSlot, globals: { mode: 'dark' } };

/** Approved mockup: column-settings/ColumnSettings (popover under the column's ⋯ button). */
export const ColumnSettingsEdit: Story = {
  render: () =>
    frame(
      <div className="flex w-full items-start justify-center self-start p-6">
        <ColumnSettings
          boardId={boardWithTasks.id}
          column={{ ...boardWithTasks.columns[1]!, displayLimit: 8 }}
          usedColors={usedColors}
          taskCount={2}
          canDelete
          defaultOpen
          trigger={<button type="button">⋯</button>}
        />
      </div>,
    ),
};
export const ColumnSettingsEditDark: Story = { ...ColumnSettingsEdit, globals: { mode: 'dark' } };

/** Same popover under "+ Nouvelle colonne": defaults from the domain, no delete. */
export const ColumnSettingsNew: Story = {
  render: () =>
    frame(
      <div className="flex w-full items-start justify-center self-start p-6">
        <ColumnSettings
          boardId={boardWithTasks.id}
          column={null}
          usedColors={usedColors}
          taskCount={0}
          canDelete={false}
          align="start"
          defaultOpen
          trigger={<button type="button">+</button>}
        />
      </div>,
    ),
};
export const ColumnSettingsNewDark: Story = { ...ColumnSettingsNew, globals: { mode: 'dark' } };

/** Approved mockup: column-settings/ColumnStates A — the footer turns into the confirmation. */
export const ColumnDeleteConfirm: Story = {
  ...ColumnSettingsEdit,
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: i18n.t('columnSettings.delete') }));
  },
};
export const ColumnDeleteConfirmDark: Story = { ...ColumnDeleteConfirm, globals: { mode: 'dark' } };

const limitedColumn = { ...boardWithTasks.columns[0]!, displayLimit: 2 };
const limitedTasks = boardWithTasks.tasks.filter((t) => t.columnId === limitedColumn.id);
const limitedFrame = () =>
  frame(
    <div className="flex h-96 items-start p-6">
      <BoardColumn
        boardId={boardWithTasks.id}
        column={limitedColumn}
        tasks={limitedTasks}
        today={today}
        emptyHint={null}
        usedColors={usedColors}
        canDelete
        onKeyboardMoveTask={() => true}
        onKeyboardMoveColumn={() => true}
      />
    </div>,
  );

/** Approved mockup: board — past the display limit the column ends with "Voir N de plus". */
export const ColumnShowMore: Story = {
  render: limitedFrame,
  beforeEach: () => useTaskUi.setState({ expandedColumnIds: new Set() }),
};
export const ColumnShowMoreDark: Story = { ...ColumnShowMore, globals: { mode: 'dark' } };

/** Approved mockup: column-settings/ColumnStates B — expanded, "Replier" sits in the header. */
export const ColumnExpanded: Story = {
  render: limitedFrame,
  beforeEach: () => {
    useTaskUi.setState({ expandedColumnIds: new Set([limitedColumn.id]) });
    return () => useTaskUi.setState({ expandedColumnIds: new Set() });
  },
};
export const ColumnExpandedDark: Story = { ...ColumnExpanded, globals: { mode: 'dark' } };

/** Decided 2026-10-14: the last column keeps a dimmed "Supprimer" and says why below. */
export const ColumnSettingsLastColumn: Story = {
  render: () =>
    frame(
      <div className="flex w-full items-start justify-center self-start p-6">
        <ColumnSettings
          boardId={boardWithTasks.id}
          column={boardWithTasks.columns[0]!}
          usedColors={usedColors}
          taskCount={3}
          canDelete={false}
          defaultOpen
          trigger={<button type="button">⋯</button>}
        />
      </div>,
    ),
};
export const ColumnSettingsLastColumnDark: Story = { ...ColumnSettingsLastColumn, globals: { mode: 'dark' } };

/** Icon search without a match. */
export const ColumnSettingsNoIcon: Story = {
  ...ColumnSettingsEdit,
  play: async () => {
    const body = within(document.body);
    await userEvent.type(await body.findByRole('searchbox'), 'zzz');
  },
};
export const ColumnSettingsNoIconDark: Story = { ...ColumnSettingsNoIcon, globals: { mode: 'dark' } };

/** The popover on the board, under the highlighted ⋯ of "En cours" (approved popover mockup). */
export const ColumnSettingsOnBoard: Story = {
  ...WithTasks,
  play: async () => {
    const body = within(document.body);
    const column = boardWithTasks.columns[1]!.name;
    await userEvent.click(
      await body.findByRole('button', { name: i18n.t('columnSettings.open', { column }) }),
    );
  },
};
export const ColumnSettingsOnBoardDark: Story = { ...ColumnSettingsOnBoard, globals: { mode: 'dark' } };
