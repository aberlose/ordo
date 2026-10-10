import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button } from './button';
import { Kbd } from './kbd';

const meta = {
  title: 'Shared/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Annuler' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: (
      <>
        Nouvelle tâche <Kbd className="border-transparent bg-kbd-on-accent text-inherit">N</Kbd>
      </>
    ),
  },
};
export const Soft: Story = {
  args: {
    variant: 'soft',
    children: (
      <>
        <Plus size={14} /> Ajouter une tâche
      </>
    ),
  },
};
export const Ghost: Story = { args: { variant: 'ghost', children: 'Corbeille' } };
