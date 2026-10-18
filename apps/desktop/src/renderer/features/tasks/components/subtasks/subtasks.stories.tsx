import type { BoardDetail, Task } from '@ordo/contracts';
import { columnForSubtaskCheck } from '@ordo/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { boardKeys } from '@renderer/shared/api/keys';
import { today } from '@renderer/shared/lib/dates';
import { boardWithSubtasks, columns, now, subtaskParent, subtasks, tags } from '@renderer/test/fixtures';
import { TaskDetailView } from '../TaskDetailView';
import { TaskTags } from '../tags/TaskTags';
import { SubtaskList } from './SubtaskList';

const meta = { title: 'Tasks/Sub-tasks' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** The list with local state: check, status, add and open work in the story. */
function ListDemo({
  initial = subtasks,
  adding = false,
  menuOpenId,
  onOpen = () => undefined,
}: {
  initial?: Task[];
  adding?: boolean;
  menuOpenId?: string;
  onOpen?: (task: Task) => void;
}) {
  const [list, setList] = useState(initial);
  const move = (task: Task, columnId: string) =>
    setList((current) => current.map((t) => (t.id === task.id ? { ...t, columnId } : t)));
  return (
    <SubtaskList
      subtasks={list}
      columns={columns}
      color="blue"
      defaultAdding={adding}
      {...(menuOpenId ? { menuOpenId } : {})}
      onToggle={(task, done) => {
        const columnId = columnForSubtaskCheck(columns, done);
        if (columnId) move(task, columnId);
      }}
      onMove={move}
      onOpen={onOpen}
      onAdd={(title) =>
        setList((current) => [
          ...current,
          { ...subtasks[4]!, id: `story-${current.length}`, title: title.trim(), rank: `z${current.length}` },
        ])
      }
    />
  );
}

const panel = (children: React.ReactNode) => (
  <div className="min-h-screen bg-surface p-7 text-text">
    <div className="max-w-150">{children}</div>
  </div>
);

/** Approved mockup: tags-subtasks/SubtaskRows variant A — hover or Tab a row to see the status button. */
export const Section: Story = { render: () => panel(<ListDemo />) };
export const SectionDark: Story = { ...Section, globals: { mode: 'dark' } };

/** Row of "Menu burger mobile" with its status menu open (the row stays tinted). */
export const RowStatusMenu: Story = { render: () => panel(<ListDemo menuOpenId={subtasks[3]!.id} />) };
export const RowStatusMenuDark: Story = { ...RowStatusMenu, globals: { mode: 'dark' } };

/** "Ajouter une sous-tâche": Enter adds and keeps the field, Escape closes. */
export const Adding: Story = { render: () => panel(<ListDemo adding />) };
export const AddingDark: Story = { ...Adding, globals: { mode: 'dark' } };

/** Empty state from variant B. */
export const Empty: Story = { render: () => panel(<ListDemo initial={[]} />) };
export const EmptyDark: Story = { ...Empty, globals: { mode: 'dark' } };

/** The list could not be loaded: the empty state's dashed box with the message and "Réessayer". */
export const LoadError: Story = {
  render: () =>
    panel(
      <SubtaskList
        subtasks={undefined}
        columns={columns}
        color="blue"
        loadError
        onRetry={() => undefined}
        onToggle={() => undefined}
        onMove={() => undefined}
        onOpen={() => undefined}
        onAdd={() => undefined}
      />,
    ),
};
export const LoadErrorDark: Story = { ...LoadError, globals: { mode: 'dark' } };

/** The board of the window stories, with tags (front and accessibilité on the sub-task, as in SubtaskDetail B). */
const tagged = (name: string) => tags.find((tag) => tag.name === name)!.id;
const windowBoard: BoardDetail = { ...boardWithSubtasks, tags };
const windowSubtask: Task = { ...subtasks[3]!, tagIds: [tagged('accessibilité'), tagged('front')] };

/**
 * The parent's window with its section; opening a sub-task shows its window (approved mockup:
 * tags-subtasks/SubtaskDetail variant B), whose "Sous-tâche de" button, breadcrumb and Parente row lead back.
 */
function WindowDemo({ dark, initial }: { dark: boolean; initial: Task | null }) {
  const client = useQueryClient();
  // No main process in Storybook: the board (its tags) is seeded in the cache.
  useState(() => {
    client.setQueryDefaults(boardKeys.detail(windowBoard.id), { staleTime: Infinity });
    client.setQueryData(boardKeys.detail(windowBoard.id), windowBoard);
    return null;
  });
  const [parent, setParent] = useState(subtaskParent);
  const [subtask, setSubtask] = useState(initial);
  const task = subtask ?? parent;
  return (
    <TaskDetailView
      task={task}
      boardName={boardWithSubtasks.name}
      columns={columns}
      today={today()}
      now={now}
      expanded={false}
      dark={dark}
      onChange={(change) =>
        subtask
          ? setSubtask({ ...subtask, ...change } as Task)
          : setParent((current) => ({ ...current, ...change }) as Task)
      }
      onDelete={() => setSubtask(null)}
      onClose={() => undefined}
      onToggleExpanded={() => undefined}
      onToggleTheme={() => undefined}
      tags={<TaskTags boardId={windowBoard.id} task={task} />}
      {...(subtask
        ? {
            parent: { title: parent.title, progress: parent.subtasks, color: 'blue' as const },
            onOpenParent: () => setSubtask(null),
          }
        : {
            subtasks: <ListDemo onOpen={setSubtask} />,
          })}
    />
  );
}

export const SubtaskWindow: Story = {
  render: (_args, { globals }) => <WindowDemo dark={globals['mode'] === 'dark'} initial={windowSubtask} />,
};
export const SubtaskWindowDark: Story = { ...SubtaskWindow, globals: { mode: 'dark' } };

export const ParentWindow: Story = {
  render: (_args, { globals }) => <WindowDemo dark={globals['mode'] === 'dark'} initial={null} />,
};
export const ParentWindowDark: Story = { ...ParentWindow, globals: { mode: 'dark' } };
