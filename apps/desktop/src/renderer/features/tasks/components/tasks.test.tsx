import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { today } from '@renderer/shared/lib/dates';
import { board, now, tasks } from '@renderer/test/fixtures';
import { QuickAdd } from './QuickAdd';
import { TaskCard } from './TaskCard';
import { TaskDetailView, type TaskDetailViewProps } from './TaskDetailView';

const overdue = tasks[3]!;

describe('TaskCard', () => {
  it('shows the title, priority and an overdue due date, and opens on click', () => {
    const onOpen = vi.fn();
    render(<TaskCard task={overdue} today={today()} onOpen={onOpen} />);
    expect(screen.getByRole('img', { name: 'Priorité : Haute' })).toBeTruthy();
    expect(screen.getByText(/En retard, échéance/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Corriger l'export PDF/ }));
    expect(onOpen).toHaveBeenCalledWith(overdue.id);
  });

  it('does not open a task that is still being saved', () => {
    const onOpen = vi.fn();
    render(<TaskCard task={{ ...overdue, id: 'temp-1' }} today={today()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('QuickAdd', () => {
  it('adds on Enter, stays open, and closes on Escape', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<QuickAdd open onOpen={() => undefined} onClose={onClose} onSubmit={onSubmit} />);
    const field = screen.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
    fireEvent.change(field, { target: { value: 'Relire le contrat' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('Relire le contrat');
    expect((field as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an "Add" link when closed', () => {
    const onOpen = vi.fn();
    render(<QuickAdd open={false} onOpen={onOpen} onClose={() => undefined} onSubmit={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('TaskDetailView', () => {
  const setup = (overrides: Partial<TaskDetailViewProps> = {}) => {
    const onChange = vi.fn();
    render(
      <TaskDetailView
        task={overdue}
        boardName={board.name}
        columns={board.columns}
        today={today()}
        now={now}
        expanded={false}
        dark={false}
        onChange={onChange}
        onDelete={() => undefined}
        onClose={() => undefined}
        onToggleExpanded={() => undefined}
        onToggleTheme={() => undefined}
        {...overrides}
      />,
    );
    return { onChange };
  };

  it('shows the properties and the overdue pill', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Haute' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('En retard de 2 jours')).toBeTruthy();
  });

  it('sets the priority by click and with the 1–5 keys', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Très haute' }));
    expect(onChange).toHaveBeenLastCalledWith({ priority: 5 });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Haute' }), { key: '1' });
    expect(onChange).toHaveBeenLastCalledWith({ priority: 1 });
  });

  it('saves a trimmed title on Enter and ignores an empty one', () => {
    const { onChange } = setup();
    const title = screen.getByRole('textbox', { name: 'Titre de la tâche' });
    fireEvent.change(title, { target: { value: '  Corriger   l’export  ' } });
    fireEvent.blur(title);
    expect(onChange).toHaveBeenCalledWith({ title: 'Corriger l’export' });
    onChange.mockClear();
    fireEvent.change(title, { target: { value: '   ' } });
    fireEvent.blur(title);
    expect(onChange).not.toHaveBeenCalled();
  });
});
