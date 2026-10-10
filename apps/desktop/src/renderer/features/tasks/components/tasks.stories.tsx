import type { Task } from '@ordo/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { today } from '@renderer/shared/lib/dates';
import { board, now, tasks } from '@renderer/test/fixtures';
import { DatePicker } from './DatePicker';
import { QuickAdd } from './QuickAdd';
import { TaskCard } from './TaskCard';
import { TaskDetailView } from './TaskDetailView';

const meta = { title: 'Tasks/Components' } satisfies Meta;
export default meta;
type Story = StoryObj;

const column = (children: React.ReactNode) => (
  <div className="flex min-h-screen [background:var(--canvas-bg)] p-6">
    <div className="flex w-column flex-col gap-2.5">{children}</div>
  </div>
);

/** Approved mockup: board (card) and tasks/CardStates variant A — hover and Tab to see the states. */
export const Cards: Story = {
  render: () =>
    column(
      <>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} today={today()} onOpen={() => undefined} />
        ))}
        <TaskCard
          task={{ ...tasks[2]!, id: 'temp-1', title: 'Relire le contrat de maintenance' }}
          today={today()}
          highlighted
          onOpen={() => undefined}
        />
      </>,
    ),
};
export const CardsDark: Story = { ...Cards, globals: { mode: 'dark' } };

function QuickAddDemo() {
  const [open, setOpen] = useState(true);
  return (
    <QuickAdd
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onSubmit={() => undefined}
    />
  );
}

/** Approved mockup: tasks/QuickAdd variant B. */
export const QuickAddOpen: Story = {
  render: () =>
    column(
      <>
        <TaskCard task={tasks[0]!} today={today()} onOpen={() => undefined} />
        <QuickAddDemo />
      </>,
    ),
};
export const QuickAddOpenDark: Story = { ...QuickAddOpen, globals: { mode: 'dark' } };

function DetailDemo({ expanded = false, dark = false }: { expanded?: boolean; dark?: boolean }) {
  const [task, setTask] = useState(tasks[3]!);
  const [isExpanded, setExpanded] = useState(expanded);
  return (
    <TaskDetailView
      task={task}
      boardName={board.name}
      columns={board.columns}
      today={today()}
      now={now}
      expanded={isExpanded}
      dark={dark}
      onChange={(change) => setTask((current) => ({ ...current, ...change }) as Task)}
      onDelete={() => undefined}
      onClose={() => undefined}
      onToggleExpanded={() => setExpanded((value) => !value)}
      onToggleTheme={() => undefined}
    />
  );
}

/** Approved mockups: task-detail (centred window), tasks/Menus (status A, priority B). */
export const Detail: Story = {
  render: (_args, { globals }) => <DetailDemo dark={globals['mode'] === 'dark'} />,
};
export const DetailDark: Story = { ...Detail, globals: { mode: 'dark' } };
export const DetailFullScreen: Story = {
  render: (_args, { globals }) => <DetailDemo expanded dark={globals['mode'] === 'dark'} />,
};
export const DetailFullScreenDark: Story = { ...DetailFullScreen, globals: { mode: 'dark' } };

function DatePickerDemo() {
  const { t } = useTranslation();
  const [value, setValue] = useState<string | null>(tasks[3]!.dueDate);
  return (
    <div className="p-6">
      <DatePicker
        label={t('date.pickDue')}
        value={value}
        today={today()}
        notBefore={tasks[3]!.startDate}
        period={{ start: tasks[3]!.startDate, due: value }}
        onChange={setValue}
      >
        <button type="button" className="rounded-md border border-border px-3 py-1.5 text-body">
          {value ?? t('date.none')}
        </button>
      </DatePicker>
    </div>
  );
}

/** Approved mockup: tasks/DatePicker variant B — click the button to open. */
export const DatePickerStory: Story = { name: 'Date picker', render: () => <DatePickerDemo /> };
export const DatePickerDark: Story = {
  ...DatePickerStory,
  name: 'Date picker (dark)',
  globals: { mode: 'dark' },
};
