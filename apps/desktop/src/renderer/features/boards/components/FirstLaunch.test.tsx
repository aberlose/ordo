import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstLaunch } from './FirstLaunch';

describe('FirstLaunch', () => {
  it('welcomes the user and creates an empty board', () => {
    const onCreateEmpty = vi.fn();
    render(<FirstLaunch onCreateEmpty={onCreateEmpty} />);
    expect(screen.getByRole('heading', { name: 'Bienvenue dans Ordo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Créer un board vide/ }));
    expect(onCreateEmpty).toHaveBeenCalledOnce();
  });

  it('does not offer the example board yet', () => {
    render(<FirstLaunch onCreateEmpty={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Découvrir avec un exemple/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
