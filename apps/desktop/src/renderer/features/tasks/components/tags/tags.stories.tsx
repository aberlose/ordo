import type { BoardDetail, Task } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { boardKeys } from '@renderer/shared/api/keys';
import { today } from '@renderer/shared/lib/dates';
import { taggedBoard, taggedTasks, tags } from '@renderer/test/fixtures';
import { TaskCard } from '../TaskCard';
import { TagChip } from './TagChip';
import { TaskTags, type TaskTagsProps } from './TaskTags';

const meta = { title: 'Tasks/Tags' } satisfies Meta;
export default meta;
type Story = StoryObj;

const header = taggedTasks[4]!;
const design = tags.find((t) => t.name === 'design')!;

/** Seeds the story's query client with the tagged board (no main process in Storybook). */
function WithBoard({ children, board = taggedBoard }: { children: ReactNode; board?: BoardDetail }) {
  const client = useQueryClient();
  useState(() => {
    client.setQueryDefaults(boardKeys.detail(taggedBoard.id), { staleTime: Infinity });
    client.setQueryData(boardKeys.detail(taggedBoard.id), board);
    return null;
  });
  return children;
}

/** The detail's properties panel, as in the mockup, with the Tags row of the header task. */
function Properties({ picker, taskId = header.id }: Pick<TaskTagsProps, 'picker'> & { taskId?: string }) {
  const { t } = useTranslation();
  const { data } = useQuery<BoardDetail>({ queryKey: boardKeys.detail(taggedBoard.id) });
  const task = data?.tasks.find((candidate) => candidate.id === taskId) as Task | undefined;
  return (
    <div className="min-h-screen bg-surface p-10">
      <div className="flex w-detail-props flex-col rounded-xl border border-border bg-canvas px-4 py-3.5">
        <div className="flex items-start">
          <span className="w-prop-label shrink-0 pt-1.75 text-meta text-text-3">{t('tags.label')}</span>
          {task && <TaskTags boardId={taggedBoard.id} task={task} {...(picker ? { picker } : {})} />}
        </div>
      </div>
    </div>
  );
}

const properties = (picker?: TaskTagsProps['picker'], taskId?: string, board?: BoardDetail) => () => (
  <WithBoard {...(board ? { board } : {})}>
    <Properties {...(picker ? { picker } : {})} {...(taskId ? { taskId } : {})} />
  </WithBoard>
);

/** Approved mockup tags-subtasks/TagPicker A, "Retirer un tag": hover or Tab onto a chip to see its ×. */
export const Chips: Story = { render: properties() };
export const ChipsDark: Story = { ...Chips, globals: { mode: 'dark' } };

/** TagPicker A, open: ↑↓ move, Enter or click toggles, ⋯ on the active tag. */
export const PickerOpen: Story = { render: properties({ defaultOpen: true }) };
export const PickerOpenDark: Story = { ...PickerOpen, globals: { mode: 'dark' } };

/** TagPicker A, "Créer « relecture »". */
export const PickerCreating: Story = { render: properties({ defaultOpen: true, defaultQuery: 'relecture' }) };
export const PickerCreatingDark: Story = { ...PickerCreating, globals: { mode: 'dark' } };

/** TagPicker A: the tags matching the search, then "Créer « conte »" in the same list. */
export const PickerMatchesAndCreate: Story = {
  render: properties({ defaultOpen: true, defaultQuery: 'conte' }),
};
export const PickerMatchesAndCreateDark: Story = { ...PickerMatchesAndCreate, globals: { mode: 'dark' } };

/** A board without tags: "Aucun tag sur ce board. Tapez un nom pour en créer un." */
const boardWithoutTags: BoardDetail = {
  ...taggedBoard,
  tags: [],
  tasks: taggedBoard.tasks.map((task) => ({ ...task, tagIds: [] })),
};
export const PickerEmptyBoard: Story = {
  render: properties({ defaultOpen: true }, undefined, boardWithoutTags),
};
export const PickerEmptyBoardDark: Story = { ...PickerEmptyBoard, globals: { mode: 'dark' } };

/** Approved mockup tags-subtasks/TagManage A, "Modifier". */
export const PickerManaging: Story = {
  render: properties({ defaultOpen: true, defaultManageId: design.id }),
};
export const PickerManagingDark: Story = { ...PickerManaging, globals: { mode: 'dark' } };

/** TagManage A, the name already used on the board: the field turns red with the message under it. */
export const PickerNameConflict: Story = {
  render: properties({ defaultOpen: true, defaultManageId: design.id, defaultConflict: 'Front' }),
};
export const PickerNameConflictDark: Story = { ...PickerNameConflict, globals: { mode: 'dark' } };

/** TagManage A, "Confirmer la suppression". */
export const PickerDeleteConfirmation: Story = {
  render: properties({ defaultOpen: true, defaultManageId: design.id, defaultConfirming: true }),
};
export const PickerDeleteConfirmationDark: Story = { ...PickerDeleteConfirmation, globals: { mode: 'dark' } };

/** A task without tags: only the dashed "+". */
export const NoTags: Story = { render: properties(undefined, taggedTasks[0]!.id) };
export const NoTagsDark: Story = { ...NoTags, globals: { mode: 'dark' } };

/** Every colour of the palette, style G "soft". */
export const Palette: Story = {
  render: () => (
    <div className="flex min-h-screen flex-wrap content-start gap-1.5 bg-surface p-10">
      {tags.map((tag) => (
        <TagChip key={tag.id} name={tag.name} color={tag.color} />
      ))}
      <TagChip name="maquette" color="pink" />
      <TagChip name="à trier" color="slate" />
      <TagChip name="sprint 12" color="orange" />
    </div>
  ),
};
export const PaletteDark: Story = { ...Palette, globals: { mode: 'dark' } };

const looks = new Map(tags.map((tag) => [tag.id, tag]));
const allTags = tags.map((tag) => tag.id);

/**
 * Approved mockup tags-subtasks/CardTags A: one line of tags then "+N" (hover it, or Tab onto the card,
 * to see the hidden tags), the sub-task ring with `done/total` in the column colour; a card without
 * tags keeps its height.
 */
export const Cards: Story = {
  render: () => (
    <div className="flex min-h-screen [background:var(--canvas-bg)] p-6">
      <div className="flex w-column flex-col gap-2.5">
        <TaskCard
          task={{ ...header, subtasks: { done: 3, total: 5 } }}
          today={today()}
          tags={looks}
          color="blue"
          onOpen={() => undefined}
        />
        <TaskCard
          task={taggedTasks[1]!}
          today={today()}
          tags={looks}
          color="slate"
          onOpen={() => undefined}
        />
        <TaskCard
          task={{ ...taggedTasks[2]!, tagIds: allTags, subtasks: { done: 4, total: 4 } }}
          today={today()}
          tags={looks}
          color="green"
          onOpen={() => undefined}
        />
        <TaskCard
          task={{ ...taggedTasks[3]!, subtasks: { done: 0, total: 2 } }}
          today={today()}
          tags={looks}
          color="blue"
          onOpen={() => undefined}
        />
        <TaskCard task={taggedTasks[0]!} today={today()} tags={looks} onOpen={() => undefined} />
      </div>
    </div>
  ),
};
export const CardsDark: Story = { ...Cards, globals: { mode: 'dark' } };

/** CardTags A, the bubble of the hidden tags shown (as on hover of "+N" or keyboard focus of the card). */
export const CardMoreOpen: Story = {
  render: () => (
    <div className="flex min-h-screen [background:var(--canvas-bg)] p-6">
      <div className="flex w-column flex-col gap-2.5">
        <TaskCard
          task={{ ...taggedTasks[2]!, tagIds: allTags, subtasks: { done: 4, total: 4 } }}
          today={today()}
          tags={looks}
          color="green"
          tagsBubbleOpen
          onOpen={() => undefined}
        />
        <TaskCard task={taggedTasks[1]!} today={today()} tags={looks} onOpen={() => undefined} />
      </div>
    </div>
  ),
};
export const CardMoreOpenDark: Story = { ...CardMoreOpen, globals: { mode: 'dark' } };
