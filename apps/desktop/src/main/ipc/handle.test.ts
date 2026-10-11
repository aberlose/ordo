import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { NotFoundError, RuleViolationError } from '../application/errors';
import { registerHandlers, type Handlers } from './handle';

type Listener = (event: IpcMainInvokeEvent, raw: unknown) => unknown;

function setup(overrides: Partial<Handlers> = {}) {
  const listeners = new Map<string, Listener>();
  const handlers: Handlers = {
    'app.info': () => ({ version: '0.1.0', platform: 'darwin', dataPath: '/tmp/ordo.db' }),
    'boards.list': () => [],
    'boards.get': ({ id }) => {
      throw new NotFoundError('board', id);
    },
    'boards.create': () => {
      throw new Error('boom');
    },
    'tasks.create': () => {
      throw new RuleViolationError('A task needs a title');
    },
    'tasks.update': () => {
      throw new Error('not used');
    },
    'tasks.delete': ({ id }) => ({ id }),
    ...overrides,
  };
  registerHandlers(
    { handle: (channel, listener) => void listeners.set(channel, listener as Listener) },
    handlers,
    () => 'file://',
  );
  const event = (url: string, parent: unknown = null) =>
    ({ senderFrame: { url, parent } }) as unknown as IpcMainInvokeEvent;
  const invoke = (channel: string, raw: unknown, from = event('file:///app/index.html')) =>
    listeners.get(channel)?.(from, raw);
  return { invoke, event };
}

describe('IPC adapter', () => {
  it('returns typed results', async () => {
    expect(await setup().invoke('boards.list', {})).toEqual({ ok: true, data: [] });
  });

  it('rejects invalid input before the use case', async () => {
    const result = await setup().invoke('boards.get', { id: 'not-a-uuid' });
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });

  it('maps domain errors and hides unexpected ones', async () => {
    const { invoke } = setup();
    expect(await invoke('boards.get', { id: '01920000-0000-7000-8000-000000000001' })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(await invoke('boards.create', { name: 'x', columnNames: ['a', 'b', 'c'] })).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Unexpected error' },
    });
  });

  it('ignores calls from other origins and sub-frames', async () => {
    const { invoke, event } = setup();
    expect(await invoke('boards.list', {}, event('https://evil.example'))).toMatchObject({ ok: false });
    expect(await invoke('boards.list', {}, event('file:///app/index.html', {}))).toMatchObject({ ok: false });
  });

  it('maps business-rule violations to a conflict', async () => {
    const { invoke } = setup();
    expect(
      await invoke('tasks.create', { columnId: '0192f0a0-0000-7000-8000-000000000001', title: 'x' }),
    ).toMatchObject({ ok: false, error: { code: 'conflict' } });
  });
});
