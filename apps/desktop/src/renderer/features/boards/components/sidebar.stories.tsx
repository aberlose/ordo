import type { BoardSummary } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useKeyboardTarget } from '@renderer/shared/keyboard/focus';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { board as boardWithTasks } from '@renderer/test/fixtures';
import { useBoardDrag } from '../dnd/useBoardMoves';
import { BoardView } from './BoardView';
import { Sidebar, type SidebarProps } from './Sidebar';

const id = (n: number) => `01920000-0000-7000-8000-00000000010${n}`;
/** The boards of the approved mockups (docs/design/mockups/boards). */
const boards: BoardSummary[] = [
  { ...boardWithTasks, icon: 'kanban', color: 'blue', taskCount: 16 },
  { id: id(2), name: 'Perso', icon: 'house', color: 'green', taskCount: 9 },
  { id: id(3), name: 'Veille tech', icon: 'lightbulb', color: 'violet', taskCount: 23 },
  { id: id(4), name: 'Déménagement', icon: 'package', color: 'amber', taskCount: 12 },
];
/** A board without tasks: "Inclure les tâches" is disabled in the duplicate popover. */
const withEmpty: BoardSummary[] = [
  ...boards,
  { id: id(5), name: 'Idées', icon: 'sparkles', color: 'teal', taskCount: 0 },
];

const meta = { title: 'Boards/Sidebar' } satisfies Meta;
export default meta;
type Story = StoryObj;

const screen = (props: Partial<SidebarProps> = {}, activeBoardId = boards[0]!.id) => (
  <div className="flex h-screen overflow-hidden [background:var(--canvas-bg)]">
    <Sidebar
      boards={boards}
      activeBoardId={activeBoardId}
      collapsed={false}
      onToggle={() => undefined}
      onSelectBoard={() => undefined}
      onOpenArchives={() => undefined}
      {...props}
    />
    <MainArea>
      <BoardView board={{ ...boardWithTasks, icon: 'kanban', color: 'blue' }} />
    </MainArea>
  </div>
);

/** Boards with their icon and colour; the rail shows initials in the board's colour. */
export const Boards: Story = { render: () => screen() };
export const BoardsDark: Story = { ...Boards, globals: { mode: 'dark' } };
export const Rail: Story = { render: () => screen({ collapsed: true }) };
export const RailDark: Story = { ...Rail, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardCreate A — popover under the highlighted "+". */
export const CreateBoard: Story = { render: () => screen({ createOpen: true }) };
export const CreateBoardDark: Story = { ...CreateBoard, globals: { mode: 'dark' } };
/** Same popover from the "+" tile of the collapsed rail. */
export const CreateBoardFromRail: Story = { render: () => screen({ collapsed: true, createOpen: true }) };
export const CreateBoardFromRailDark: Story = { ...CreateBoardFromRail, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardMenu A — ⋯ replaces the count, menu open. */
export const BoardMenu: Story = {
  render: () => screen({ rowState: { boardId: id(2), state: 'menu' } }, id(2)),
};
export const BoardMenuDark: Story = { ...BoardMenu, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardMenu A — the row turns into a field. */
export const Rename: Story = {
  render: () => screen({ rowState: { boardId: id(2), state: 'rename' } }, id(2)),
};
export const RenameDark: Story = { ...Rename, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardMenu A — "Dupliquer…" popover (320 px). */
export const Duplicate: Story = {
  render: () => screen({ rowState: { boardId: id(2), state: 'duplicate' } }, id(2)),
};
export const DuplicateDark: Story = { ...Duplicate, globals: { mode: 'dark' } };
/** Same popover for a board with no task: the checkbox is disabled ("Aucune tâche à inclure"). */
export const DuplicateNoTasks: Story = {
  render: () => screen({ boards: withEmpty, rowState: { boardId: id(5), state: 'duplicate' } }, id(5)),
};
export const DuplicateNoTasksDark: Story = { ...DuplicateNoTasks, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardCreate A — "Icône et couleur…" opens the same popover with "Enregistrer". */
export const IconAndColour: Story = {
  render: () => screen({ rowState: { boardId: id(2), state: 'style' } }, id(2)),
};
export const IconAndColourDark: Story = { ...IconAndColour, globals: { mode: 'dark' } };

/**
 * Approved mockup: boards/BoardReorder A — the dragged board leaves its place, a slot opens. The row
 * that follows the pointer (accent border) is a native drag preview: it does not show in Storybook.
 */
export const DragInProgress: Story = {
  render: () => screen(),
  beforeEach: () => {
    useBoardDrag.setState({ draggingId: id(3), targetIndex: 1 });
    return () => useBoardDrag.setState({ draggingId: null, targetIndex: null });
  },
};
export const DragInProgressDark: Story = { ...DragInProgress, globals: { mode: 'dark' } };
/** Same in the collapsed rail; the dragged tile preview is native and not visible in Storybook. */
export const DragInRail: Story = { ...DragInProgress, render: () => screen({ collapsed: true }) };
export const DragInRailDark: Story = { ...DragInRail, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardReorder A — keyboard focus on a board shows the help bar. */
export const KeyboardFocus: Story = {
  render: () => screen(),
  play: () => {
    document.querySelector<HTMLButtonElement>(`[data-board-id="${id(3)}"] button`)?.focus({
      focusVisible: true,
    } as FocusOptions);
    useKeyboardTarget.getState().set('board');
  },
};
export const KeyboardFocusDark: Story = { ...KeyboardFocus, globals: { mode: 'dark' } };

/** Approved mockup: boards/BoardArchives A — "Archives" is the active item. */
export const ArchivesActive: Story = { render: () => screen({ archivesActive: true }) };
export const ArchivesActiveDark: Story = { ...ArchivesActive, globals: { mode: 'dark' } };
