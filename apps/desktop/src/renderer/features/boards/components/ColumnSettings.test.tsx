import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { board } from '@renderer/test/fixtures';
import { ColumnSettings, type ColumnSettingsProps } from './ColumnSettings';

const column = board.columns[1]!;
const usedColors = board.columns.map((c) => c.color);

function renderSettings(props: Partial<ColumnSettingsProps> = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ColumnSettings
        boardId={board.id}
        column={column}
        usedColors={usedColors}
        taskCount={2}
        canDelete
        defaultOpen
        trigger={<button type="button">⋯</button>}
        {...props}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole('dialog');
}

describe('ColumnSettings', () => {
  it('starts from the column and finds icons without accents, in French or English', () => {
    const dialog = renderSettings();
    expect(within(dialog).getByRole('textbox', { name: 'Nom' })).toHaveProperty('value', 'En cours');
    expect(within(dialog).getByRole('radio', { name: 'Bleu' }).getAttribute('aria-checked')).toBe('true');
    const search = within(dialog).getByRole('searchbox', { name: 'Rechercher une icône' });
    fireEvent.change(search, { target: { value: 'oeil' } });
    expect(within(dialog).getAllByRole('radio', { name: 'Œil' })).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'house' } });
    expect(within(dialog).getByRole('radio', { name: 'Maison' })).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(within(dialog).getByText('Aucune icône ne correspond.')).toBeTruthy();
  });

  it('turns the footer into the delete confirmation, with the task count', () => {
    const dialog = renderSettings();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    const confirm = within(dialog).getByRole('alertdialog');
    expect(confirm.textContent).toContain('Supprimer « En cours » et ses 2 tâches ?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(within(dialog).queryByRole('alertdialog')).toBeNull();
  });

  it('keeps the last column of a board', () => {
    const dialog = renderSettings({ canDelete: false });
    const remove = within(dialog).getByRole('button', { name: 'Supprimer' });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(remove.getAttribute('aria-describedby')).toBeTruthy();
    expect(within(dialog).getByText('Un board garde au moins une colonne.')).toBeTruthy();
    fireEvent.click(remove);
    expect(within(dialog).queryByRole('alertdialog')).toBeNull();
  });

  it('adds a column with the defaults: in progress, no limit, first free colour', () => {
    const dialog = renderSettings({ column: null, canDelete: false });
    expect(within(dialog).getByRole('heading', { name: 'Nouvelle colonne' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Supprimer' })).toBeNull();
    expect(within(dialog).getByRole('radio', { name: 'En cours' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('checkbox', { name: 'Aucune limite' })).toHaveProperty('checked', true);
    expect(within(dialog).getByRole('radio', { name: 'Cyan' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('button', { name: 'Ajouter la colonne' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
