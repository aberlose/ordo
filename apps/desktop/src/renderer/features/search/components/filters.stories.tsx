import { EMPTY_FILTERS } from '@ordo/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { taggedBoard as board, tags } from '@renderer/test/fixtures';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { useSearchStore } from '../store';
import { FilterBar } from './FilterBar';

const meta = { title: 'Search/FilterBar' } satisfies Meta;
export default meta;
type Story = StoryObj;

const today = todayDay();
const tagId = (name: string) => tags.find((t) => t.name === name)!.id;
const reset = () => useSearchStore.setState({ byBoard: {}, preview: null });

const frame = (children: React.ReactNode) => (
  <div className="min-h-80 [background:var(--canvas-bg)]">{children}</div>
);

/** Approved mockup: board — nothing filtered. */
export const Inactive: Story = {
  beforeEach: reset,
  render: () =>
    frame(<FilterBar board={board} today={today} shownCount={board.tasks.length} filtered={false} />),
};
export const InactiveDark: Story = { ...Inactive, globals: { mode: 'dark' } };

/** Approved mockup: board — "Priorité : Très haute, Haute", a tag, the text chip, "2 sur 6 tâches". */
export const ActiveFilters: Story = {
  beforeEach: () => {
    reset();
    useSearchStore.getState().apply(board.id, {
      ...EMPTY_FILTERS,
      priorities: [4, 5],
      tags: [tagId('front')],
      text: 'header',
    });
  },
  render: () => frame(<FilterBar board={board} today={today} shownCount={2} filtered />),
};
export const ActiveFiltersDark: Story = { ...ActiveFilters, globals: { mode: 'dark' } };

/** Approved mockup: board — the priority checkbox menu, open, with counts and one value checked. */
export const OpenMenu: Story = {
  beforeEach: () => {
    reset();
    useSearchStore.getState().apply(board.id, { ...EMPTY_FILTERS, priorities: [4] });
  },
  render: () =>
    frame(<FilterBar board={board} today={today} shownCount={2} filtered defaultOpenMenu="priorities" />),
};
export const OpenMenuDark: Story = { ...OpenMenu, globals: { mode: 'dark' } };

/** The tag menu: board tags alphabetical with their colour dot. */
export const TagMenu: Story = {
  beforeEach: reset,
  render: () =>
    frame(
      <FilterBar
        board={board}
        today={today}
        shownCount={board.tasks.length}
        filtered={false}
        defaultOpenMenu="tags"
      />,
    ),
};
export const TagMenuDark: Story = { ...TagMenu, globals: { mode: 'dark' } };

/** Empty board: the bar stays disabled (approved mockup: empty-states). */
export const Disabled: Story = {
  beforeEach: reset,
  render: () =>
    frame(<FilterBar board={{ ...board, tasks: [] }} today={today} shownCount={0} filtered={false} />),
};
export const DisabledDark: Story = { ...Disabled, globals: { mode: 'dark' } };
