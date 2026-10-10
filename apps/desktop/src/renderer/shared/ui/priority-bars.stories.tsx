import { PRIORITIES } from '@ordo/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { PriorityBar, PriorityBars } from './priority-bars';

const meta = { title: 'Shared/PriorityBars', parameters: { layout: 'centered' } } satisfies Meta;
export default meta;
type Story = StoryObj;

function All() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 bg-surface p-6 text-meta text-text-2">
      {PRIORITIES.map((p) => (
        <div key={p} className="flex items-center gap-3">
          <PriorityBars priority={p} label={t(`priority.${p}`)} />
          <span className="flex h-6.5 items-end gap-1">
            {PRIORITIES.map((level) => (
              <PriorityBar key={level} level={level} filled={p} />
            ))}
          </span>
          {t(`priority.${p}`)}
        </div>
      ))}
    </div>
  );
}

/** Card bars (mockup: board) and picker bars (mockup: tasks/Menus, priority B). */
export const Levels: Story = { render: () => <All /> };
export const LevelsDark: Story = { ...Levels, globals: { mode: 'dark' } };
