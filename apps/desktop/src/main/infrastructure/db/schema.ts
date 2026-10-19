import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Mirrors docs/data-model.md. Change it only with an approved migration. */

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

export const board = sqliteTable('board', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  rank: text('rank').notNull(),
  archivedAt: integer('archived_at'),
  deletedAt: integer('deleted_at'),
  ...timestamps,
});

export const boardColumn = sqliteTable(
  'board_column',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => board.id),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color').notNull(),
    category: text('category', { enum: ['todo', 'in_progress', 'done'] }).notNull(),
    displayLimit: integer('display_limit'),
    rank: text('rank').notNull(),
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [
    index('board_column_board_rank').on(t.boardId, t.rank),
    check('board_column_category', sql`${t.category} in ('todo','in_progress','done')`),
  ],
);

export const task = sqliteTable(
  'task',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => board.id),
    columnId: text('column_id')
      .notNull()
      .references(() => boardColumn.id),
    parentId: text('parent_id'),
    key: integer('key').notNull(),
    title: text('title').notNull(),
    descriptionJson: text('description_json'),
    descriptionText: text('description_text'),
    priority: integer('priority').notNull().default(3),
    startDate: text('start_date'),
    dueDate: text('due_date'),
    rank: text('rank').notNull(),
    completedAt: integer('completed_at'),
    archivedAt: integer('archived_at'),
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [
    index('task_column_rank')
      .on(t.columnId, t.rank)
      .where(sql`${t.deletedAt} is null`),
    index('task_parent').on(t.parentId),
    index('task_due').on(t.boardId, t.dueDate),
    uniqueIndex('task_board_key').on(t.boardId, t.key),
    check('task_priority', sql`${t.priority} between 1 and 5`),
  ],
);

export const tag = sqliteTable(
  'tag',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => board.id),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => [uniqueIndex('tag_board_name').on(t.boardId, t.name)],
);

export const taskTag = sqliteTable(
  'task_tag',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id),
  },
  // The primary key serves lookups by task; `task_tag_tag` serves the per-tag counts and deletes.
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] }), index('task_tag_tag').on(t.tagId)],
);

export const attachment = sqliteTable('attachment', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => task.id),
  fileName: text('file_name').notNull(),
  storedPath: text('stored_path').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  createdAt: integer('created_at').notNull(),
});

export const setting = sqliteTable('setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
