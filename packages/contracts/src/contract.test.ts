import { describe, expect, it } from 'vitest';
import { CHANNELS } from './channels';
import { contract } from './contract';
import { CreateBoardInput } from './schemas';

describe('contract', () => {
  it('lists exactly the channels of the contract', () => {
    expect([...CHANNELS].sort()).toEqual(Object.keys(contract).sort());
  });

  it('validates board creation input', () => {
    expect(
      CreateBoardInput.safeParse({ name: '  Perso ', columnNames: ['À faire', 'En cours', 'Terminé'] })
        .success,
    ).toBe(true);
    expect(CreateBoardInput.safeParse({ name: '', columnNames: ['a', 'b', 'c'] }).success).toBe(false);
    expect(CreateBoardInput.safeParse({ name: 'x', columnNames: ['a', 'b'] }).success).toBe(false);
  });
});
