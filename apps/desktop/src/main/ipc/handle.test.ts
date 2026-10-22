import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { ConflictError, InvalidInputError, NotFoundError, RuleViolationError } from '../application/errors';
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
    'tasks.getDescription': ({ id }) => ({ id, json: null, updatedAt: 1 }),
    'tasks.updateDescription': ({ id, json }) => ({ id, json, updatedAt: 2 }),
    'attachments.list': () => [],
    'attachments.add': ({ paths }) => ({
      attachments: [],
      failures: paths.map((path) => ({ path, fileName: 'a.pdf', message: 'File not found' })),
    }),
    'attachments.pick': () => ({ attachments: [], failures: [] }),
    'attachments.addData': ({ mimeType }) => {
      throw new InvalidInputError(`Only images can be pasted (${mimeType})`);
    },
    'attachments.open': ({ id }) => {
      throw new RuleViolationError(`Could not open ${id}: no application`);
    },
    'attachments.reveal': ({ id }) => {
      throw new NotFoundError('attachment file', id);
    },
    'attachments.delete': async ({ id }) => ({ id }),
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
    'search.boardTaskIds': ({ boardId }) => ({ taskIds: [boardId] }),
    'search.tasks': () => [],
    'recent.list': () => [],
    'recent.record': ({ taskId }) => {
      throw new NotFoundError('task', taskId);
    },
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

  it('serves the notes and attachment channels', async () => {
    const { invoke } = setup();
    const id = '0192f0a0-0000-7000-8000-000000000001';
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(await invoke('tasks.getDescription', { id })).toEqual({
      ok: true,
      data: { id, json: null, updatedAt: 1 },
    });
    expect(await invoke('tasks.updateDescription', { id, json: doc })).toEqual({
      ok: true,
      data: { id, json: doc, updatedAt: 2 },
    });
    expect(await invoke('tasks.updateDescription', { id, json: { type: 'paragraph' } })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('attachments.add', { taskId: id, paths: ['/x/a.pdf'] })).toMatchObject({
      ok: true,
      data: { failures: [{ path: '/x/a.pdf', message: 'File not found' }] },
    });
    expect(await invoke('attachments.add', { taskId: id, paths: [] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(
      await invoke('attachments.addData', {
        taskId: id,
        fileName: 'a.png',
        mimeType: 'image/png',
        bytes: [1],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(
      await invoke('attachments.addData', {
        taskId: id,
        fileName: 'a.svg',
        mimeType: 'image/svg+xml',
        bytes: new Uint8Array([1]),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_input', message: expect.stringContaining('images') },
    });
    // So deep that the schema's own refinement overflows the stack: refused, not thrown.
    let deep: Record<string, unknown> = { type: 'text', text: 'x' };
    for (let i = 0; i < 200_000; i += 1) deep = { type: 'paragraph', content: [deep] };
    expect(
      await invoke('tasks.updateDescription', { id, json: { type: 'doc', content: [deep] } }),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('attachments.pick', { taskId: id })).toEqual({
      ok: true,
      data: { attachments: [], failures: [] },
    });
    expect(await invoke('attachments.open', { id })).toMatchObject({
      ok: false,
      error: { code: 'conflict', message: expect.stringContaining('no application') },
    });
    expect(await invoke('attachments.reveal', { id })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(await invoke('attachments.delete', { id })).toEqual({ ok: true, data: { id } });
    expect(await invoke('attachments.list', { taskId: id })).toEqual({ ok: true, data: [] });
  });

  it('serves the search channels and validates their input', async () => {
    const { invoke } = setup();
    const id = '0192f0a0-0000-7000-8000-000000000001';
    expect(await invoke('search.boardTaskIds', { boardId: id, text: ' header ' })).toEqual({
      ok: true,
      data: { taskIds: [id] },
    });
    expect(await invoke('search.boardTaskIds', { boardId: id, text: '   ' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('search.tasks', { text: 'x', limit: 51 })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('search.tasks', { text: 'x'.repeat(201) })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('search.tasks', { text: 'x' })).toEqual({ ok: true, data: [] });
    // Typed filters: due options need the renderer's today.
    expect(await invoke('search.tasks', { text: 'x', due: ['overdue'] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(
      await invoke('search.tasks', {
        text: 'x',
        priorities: [4, 5],
        due: ['overdue', 'none'],
        today: '2026-10-21',
        tagNames: ['Été'],
      }),
    ).toEqual({ ok: true, data: [] });
    expect(await invoke('search.tasks', { text: 'x', due: [], tagNames: [] })).toEqual({
      ok: true,
      data: [],
    });
    expect(await invoke('search.tasks', { text: 'x', priorities: [6] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('search.tasks', { text: 'x', tagNames: ['  '] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await invoke('recent.list', {})).toEqual({ ok: true, data: [] });
    expect(await invoke('recent.record', { taskId: id })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});
