import { describe, expect, it } from 'vitest';
import { CHANNELS } from './channels';
import { contract } from './contract';
import { CreateBoardInput, DuplicateBoardInput, MoveBoardInput, UpdateBoardInput } from './boards';
import { CreateColumnInput, UpdateColumnInput } from './columns';
import { AddAttachmentDataInput, AddAttachmentsInput, attachmentUrl } from './attachments';
import { CreateTagInput, TaskTagInput, UpdateTagInput } from './tags';
import { CreateTaskInput, UpdateDescriptionInput, UpdateTaskInput } from './tasks';

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
    expect(
      CreateBoardInput.safeParse({ name: 'x', columnNames: ['a', 'b', 'c'], icon: 'kanban', color: 'teal' })
        .success,
    ).toBe(true);
    expect(
      CreateBoardInput.safeParse({ name: 'x', columnNames: ['a', 'b', 'c'], icon: 'not-an-icon' }).success,
    ).toBe(false);
  });
});

describe('board inputs', () => {
  const id = '0192f0a0-0000-7000-8000-000000000001';

  it('accepts partial updates and rejects empty ones', () => {
    expect(UpdateBoardInput.safeParse({ id, name: ' Perso ' }).success).toBe(true);
    expect(UpdateBoardInput.safeParse({ id, color: 'pink', icon: 'heart' }).success).toBe(true);
    expect(UpdateBoardInput.safeParse({ id }).success).toBe(false);
    expect(UpdateBoardInput.safeParse({ id, name: '   ' }).success).toBe(false);
    expect(UpdateBoardInput.safeParse({ id, color: 'black' }).success).toBe(false);
  });

  it('validates moves and duplicates', () => {
    expect(MoveBoardInput.safeParse({ boardId: id, beforeId: null, afterId: id }).success).toBe(true);
    expect(MoveBoardInput.safeParse({ boardId: id }).success).toBe(false);
    expect(DuplicateBoardInput.safeParse({ id, name: 'Perso (copie)', includeTasks: true }).success).toBe(
      true,
    );
    expect(DuplicateBoardInput.safeParse({ id, name: 'Perso (copie)' }).success).toBe(false);
  });
});

describe('task inputs', () => {
  const id = '0192f0a0-0000-7000-8000-000000000001';

  it('trims and requires a title on creation', () => {
    expect(CreateTaskInput.parse({ columnId: id, title: '  Relire  ' }).title).toBe('Relire');
    expect(CreateTaskInput.safeParse({ columnId: id, title: '   ' }).success).toBe(false);
  });

  it('creates either in a column or under a parent', () => {
    expect(CreateTaskInput.safeParse({ parentId: id, title: 'Logo SVG' }).success).toBe(true);
    expect(CreateTaskInput.safeParse({ title: 'Logo SVG' }).success).toBe(false);
    expect(CreateTaskInput.safeParse({ columnId: id, parentId: id, title: 'Logo SVG' }).success).toBe(false);
  });

  it('accepts partial updates, null to clear a date, and rejects empty ones', () => {
    expect(UpdateTaskInput.safeParse({ id, priority: 5 }).success).toBe(true);
    expect(UpdateTaskInput.safeParse({ id, dueDate: null }).success).toBe(true);
    expect(UpdateTaskInput.safeParse({ id }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ id, title: undefined }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ id, priority: 6 }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ id, dueDate: '2026-02-30' }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ id, color: 'red' }).success).toBe(false);
  });
});

describe('column inputs', () => {
  const id = '0192f0a0-0000-7000-8000-000000000001';
  const base = {
    boardId: id,
    name: ' En revue ',
    icon: 'eye',
    color: 'violet',
    category: 'in_progress',
    displayLimit: null,
  };

  it('validates a new column', () => {
    expect(CreateColumnInput.parse(base).name).toBe('En revue');
    expect(CreateColumnInput.safeParse({ ...base, displayLimit: 0 }).success).toBe(false);
    expect(CreateColumnInput.safeParse({ ...base, color: '#ff0000' }).success).toBe(false);
    expect(CreateColumnInput.safeParse({ ...base, icon: '<svg>' }).success).toBe(false);
  });

  it('accepts partial updates only', () => {
    expect(UpdateColumnInput.safeParse({ id, displayLimit: 8 }).success).toBe(true);
    expect(UpdateColumnInput.safeParse({ id, displayLimit: null }).success).toBe(true);
    expect(UpdateColumnInput.safeParse({ id }).success).toBe(false);
  });
});

describe('tag inputs', () => {
  const id = '0192f0a0-0000-7000-8000-000000000001';

  it('trims and bounds the name, colour optional', () => {
    expect(CreateTagInput.parse({ boardId: id, name: '  urgent ' })).toEqual({ boardId: id, name: 'urgent' });
    expect(CreateTagInput.safeParse({ boardId: id, name: ' ' }).success).toBe(false);
    expect(CreateTagInput.safeParse({ boardId: id, name: 'x'.repeat(41) }).success).toBe(false);
    // Inner spaces are collapsed before the length is checked.
    expect(
      CreateTagInput.parse({ boardId: id, name: `à${' '.repeat(10)}${'x'.repeat(37)}` }).name,
    ).toHaveLength(39);
    expect(CreateTagInput.safeParse({ boardId: id, name: 'a', color: 'beige' }).success).toBe(false);
    expect(CreateTagInput.safeParse({ boardId: id, name: 'a', taskId: id, color: 'red' }).success).toBe(true);
  });

  it('accepts partial updates only', () => {
    expect(UpdateTagInput.safeParse({ id, color: 'violet' }).success).toBe(true);
    expect(UpdateTagInput.safeParse({ id }).success).toBe(false);
    expect(TaskTagInput.safeParse({ taskId: id, tagId: id }).success).toBe(true);
    expect(TaskTagInput.safeParse({ taskId: id }).success).toBe(false);
  });
});

describe('notes and attachment inputs', () => {
  const id = '0192f0a0-0000-7000-8000-000000000001';

  it('accepts a document or null, bounded', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Relire' }] }],
    };
    expect(UpdateDescriptionInput.safeParse({ id, json: doc }).success).toBe(true);
    expect(UpdateDescriptionInput.safeParse({ id, json: null }).success).toBe(true);
    expect(UpdateDescriptionInput.safeParse({ id, json: { type: 'paragraph' } }).success).toBe(false);
    const huge = { type: 'doc', content: [{ type: 'text', text: 'x'.repeat(2_000_001) }] };
    expect(UpdateDescriptionInput.safeParse({ id, json: huge }).success).toBe(false);
  });

  it('validates files to add', () => {
    expect(AddAttachmentsInput.safeParse({ taskId: id, paths: ['/Users/alice/a.pdf'] }).success).toBe(true);
    expect(AddAttachmentsInput.safeParse({ taskId: id, paths: [] }).success).toBe(false);
    const image = { taskId: id, fileName: 'image.png', mimeType: 'image/png' };
    expect(AddAttachmentDataInput.safeParse({ ...image, bytes: new Uint8Array([1, 2]) }).success).toBe(true);
    expect(AddAttachmentDataInput.safeParse({ ...image, bytes: new Uint8Array() }).success).toBe(false);
    expect(AddAttachmentDataInput.safeParse({ ...image, bytes: [1, 2] }).success).toBe(false);
    expect(attachmentUrl(id)).toBe(`ordo-file://attachment/${id}`);
  });
});
