import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, RuleViolationError } from '../application/errors';
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
    'boards.update': () => {
      throw new Error('not used');
    },
    'boards.move': () => {
      throw new Error('not used');
    },
    'boards.duplicate': () => {
      throw new Error('not used');
    },
    'boards.archive': ({ id }) => ({ id, archivedAt: 0 }),
    'boards.restore': () => {
      throw new Error('not used');
    },
    'boards.listArchived': () => [],
    'tasks.create': () => {
      throw new RuleViolationError('A task needs a title');
    },
    'tasks.update': () => {
      throw new Error('not used');
    },
    'tasks.delete': ({ id }) => ({ id }),
    'tasks.move': () => {
      throw new Error('not used');
    },
    'tasks.get': ({ id }) => {
      throw new NotFoundError('task', id);
    },
    'tasks.listSubtasks': () => [],
    'tasks.addTag': () => {
      throw new RuleViolationError('The tag belongs to another board');
    },
    'tasks.removeTag': () => {
      throw new Error('not used');
    },
    'tags.create': () => {
      throw new ConflictError('A tag named "x" already exists on the board');
    },
    'tags.update': () => {
      throw new Error('not used');
    },
    'tags.delete': ({ id }) => ({ id, removedFrom: 3 }),
    'columns.move': () => {
      throw new Error('not used');
    },
    'columns.create': () => {
      throw new Error('not used');
    },
    'columns.update': () => {
      throw new Error('not used');
    },
    'columns.delete': ({ id }) => ({ id, deletedTasks: 0 }),
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

  it('serves the tag and sub-task channels', async () => {
    const { invoke } = setup();
    const id = '0192f0a0-0000-7000-8000-000000000001';
    const other = '0192f0a0-0000-7000-8000-000000000002';
    expect(await invoke('tasks.listSubtasks', { parentId: id })).toEqual({ ok: true, data: [] });
    expect(await invoke('tasks.get', { id })).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(await invoke('tasks.addTag', { taskId: id, tagId: other })).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await invoke('tags.delete', { id })).toEqual({ ok: true, data: { id, removedFrom: 3 } });
  });

  it('maps a name conflict and validates tag input', async () => {
    const { invoke } = setup();
    const boardId = '0192f0a0-0000-7000-8000-000000000001';
    expect(await invoke('tags.create', { boardId, name: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(await invoke('tags.create', { boardId, name: '   ' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('tags.create', { boardId, name: 'x', color: 'beige' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });
});
