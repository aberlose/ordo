import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useKeyboardTarget } from '../keyboard/focus';
import { KeyboardHelp } from './keyboard-help';

afterEach(() => useKeyboardTarget.getState().set(null));

describe('KeyboardHelp', () => {
  it('documents plain arrows for a focused card, first', () => {
    render(<KeyboardHelp />);
    act(() => useKeyboardTarget.getState().set('card'));
    const bar = screen.getByText('1 carte sélectionnée').parentElement!;
    expect(bar.textContent).toMatch(
      /^1 carte sélectionnée·Flèches naviguer·.+ordre·.+colonne·Entrée ouvrir$/,
    );
  });

  it('does not offer arrows on a column header', () => {
    render(<KeyboardHelp />);
    act(() => useKeyboardTarget.getState().set('column'));
    expect(screen.getByText('1 colonne sélectionnée').parentElement!.textContent).not.toMatch(/naviguer/);
  });
});
