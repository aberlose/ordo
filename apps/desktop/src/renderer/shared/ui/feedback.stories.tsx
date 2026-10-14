import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '../feedback/store';
import { useKeyboardTarget, type KeyboardTarget } from '../keyboard/focus';
import { KeyboardHelp } from './keyboard-help';
import { Feedback } from './toast';

const meta = { title: 'Shared/Feedback' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Toast() {
  const { t } = useTranslation();
  useEffect(() => {
    useFeedback.getState().showToast(t('feedback.failed.move'), () => undefined);
  }, [t]);
  return (
    <div className="relative h-screen [background:var(--canvas-bg)]">
      <Feedback persistent />
    </div>
  );
}

function Help({ target }: { target: Exclude<KeyboardTarget, null> }) {
  useEffect(() => {
    useKeyboardTarget.getState().set(target);
    return () => useKeyboardTarget.getState().set(null);
  }, [target]);
  return (
    <div className="relative h-screen [background:var(--canvas-bg)]">
      <KeyboardHelp />
    </div>
  );
}

/** Approved mockup: drag-and-drop/Toast A (hides after 6 s; reload the story to see it again). */
export const ErrorToast: Story = { render: () => <Toast /> };
export const ErrorToastDark: Story = { ...ErrorToast, globals: { mode: 'dark' } };

/** Approved mockup: drag-and-drop/KeyboardMove B. */
export const CardHelpBar: Story = { render: () => <Help target="card" /> };
export const CardHelpBarDark: Story = { ...CardHelpBar, globals: { mode: 'dark' } };
export const ColumnHelpBar: Story = { render: () => <Help target="column" /> };
export const ColumnHelpBarDark: Story = { ...ColumnHelpBar, globals: { mode: 'dark' } };
