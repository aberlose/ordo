import { resolve } from 'node:path';
import { ranksAfter } from '@ordo/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from '../../application/boards';
import { makeColumnUseCases } from '../../application/columns';
import { ConflictError, RuleViolationError } from '../../application/errors';
import { makeTagUseCases } from '../../application/tags';
import { makeTaskUseCases } from '../../application/tasks';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { uuidv7Generator } from '../ids';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';
import { tagRepository } from './tagRepository';
import { taskRepository } from './taskRepository';

const migrations = resolve(__dirname, '../db/migrations');
let opened: OpenedDatabase | undefined;

afterEach(() => opened?.close());

const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];

function setup() {
  opened = openDatabase(':memory:', migrations);
  let now = 1_000;
  const ports = {
    boards: boardRepository(opened.db),
    columns: columnRepository(opened.db),
    tasks: taskRepository(opened.db),
    tags: tagRepository(opened.db),
    tx: sqliteTransactor(opened.sqlite),
    clock: { now: () => (now += 1) },
    ids: uuidv7Generator(),
  };
  const sqlite = opened.sqlite;
  return {
    ...ports,
    boardCases: makeBoardUseCases(ports),
    taskCases: makeTaskUseCases(ports),
    columnCases: makeColumnUseCases(ports),
    tagCases: makeTagUseCases(ports),
    sqlite,
    sql: <T>(query: string, ...params: unknown[]) => sqlite.prepare(query).all(...params) as T[],
  };
}

describe('sub-tasks on SQLite', () => {
  it('creates, lists, counts, re-statuses and deletes sub-tasks with their parent', () => {
    const { boardCases: boards, taskCases: tasks, sql } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const [todo, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
    const parent = tasks.createTask({ columnId: doing, title: 'Parent' });
    const a = tasks.createTask({ parentId: parent.id, title: 'A' });
    const b = tasks.createTask({ parentId: parent.id, title: 'B' });
    expect(a).toMatchObject({ parentId: parent.id, columnId: todo, key: 2 });
    expect(() => tasks.createTask({ parentId: a.id, title: 'Deep' })).toThrow(RuleViolationError);

    expect(tasks.updateTask({ id: a.id, columnId: done })).toMatchObject({ rank: a.rank, columnId: done });
    expect(tasks.getTask(parent.id).subtasks).toEqual({ done: 1, total: 2 });
    expect(boards.getBoard(board.id).tasks).toEqual([tasks.getTask(parent.id)]);
    expect(boards.getBoard(board.id).taskCount).toBe(1);
    expect(tasks.listSubtasks(parent.id).map((t) => t.title)).toEqual(['A', 'B']);

    // A deleted sub-task's rank is still taken into account at the end of the list.
    tasks.deleteTask(b.id);
    const c = tasks.createTask({ parentId: parent.id, title: 'C' });
    expect(c.rank > b.rank).toBe(true);

    tasks.deleteTask(parent.id);
    const rows = sql<{ title: string; deleted_at: number | null }>(
      'select title, deleted_at from task where board_id = ? order by key',
      board.id,
    );
    expect(rows.every((r) => r.deleted_at !== null)).toBe(true);
    const [parentRow] = sql<{ deleted_at: number }>('select deleted_at from task where id = ?', parent.id);
    expect(
      sql('select id from task where parent_id = ? and deleted_at = ?', parent.id, parentRow!.deleted_at),
    ).toHaveLength(2);
  });

  it('deletes a column with its sub-tasks and the sub-tasks of its tasks', () => {
    const { boardCases: boards, taskCases: tasks, columnCases: columns } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const [, doing, done] = board.columns.map((c) => c.id) as [string, string, string];
    const inDoing = tasks.createTask({ columnId: doing, title: 'In doing' });
    tasks.createTask({ parentId: inDoing.id, title: 'Its sub-task (todo)' });
    const keeper = tasks.createTask({ columnId: done, title: 'Keeper' });
    const moved = tasks.createTask({ parentId: keeper.id, title: 'Sub in doing' });
    tasks.updateTask({ id: moved.id, columnId: doing });
    tasks.createTask({ parentId: keeper.id, title: 'Stays' });

    expect(columns.deleteColumn(doing)).toEqual({ id: doing, deletedTasks: 3 });
    expect(tasks.getTask(keeper.id).subtasks).toEqual({ done: 0, total: 1 });
    expect(boards.getBoard(board.id).tasks.map((t) => t.title)).toEqual(['Keeper']);
  });
});

describe('tags on SQLite', () => {
  it('creates, links, renames, counts and deletes tags', () => {
    const { boardCases: boards, taskCases: tasks, tagCases: tags, sql } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const todo = board.columns[0]!.id;
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    const sub = tasks.createTask({ parentId: a.id, title: 'Sub' });
    const gone = tasks.createTask({ columnId: todo, title: 'Gone' });

    const urgent = tags.createTag({ boardId: board.id, name: 'Urgent', taskId: a.id });
    expect(urgent).toMatchObject({ name: 'Urgent', color: 'blue', taskCount: 1 });
    expect(() => tags.createTag({ boardId: board.id, name: 'urgent' })).toThrow(ConflictError);
    const ecrit = tags.createTag({ boardId: board.id, name: 'écrit' });
    expect(ecrit.color).toBe('cyan');

    const first = tasks.addTag({ taskId: a.id, tagId: ecrit.id });
    expect(first.tagIds).toEqual([ecrit.id, urgent.id]);
    expect(tasks.addTag({ taskId: a.id, tagId: ecrit.id }).updatedAt).toBe(first.updatedAt);
    tasks.addTag({ taskId: sub.id, tagId: ecrit.id });
    tasks.addTag({ taskId: gone.id, tagId: ecrit.id });
    tasks.deleteTask(gone.id);

    expect(tags.updateTag({ id: ecrit.id, name: 'Zèbre' })).toMatchObject({ name: 'Zèbre', taskCount: 2 });
    expect(() => tags.updateTag({ id: ecrit.id, name: 'URGENT' })).toThrow(ConflictError);
    const read = boards.getBoard(board.id);
    expect(read.tags.map((t) => [t.name, t.taskCount])).toEqual([
      ['Urgent', 1],
      ['Zèbre', 2],
    ]);
    expect(read.tasks[0]?.tagIds).toEqual([urgent.id, ecrit.id]);
    expect(tasks.listSubtasks(a.id)[0]?.tagIds).toEqual([ecrit.id]);

    expect(tasks.removeTag({ taskId: a.id, tagId: urgent.id }).tagIds).toEqual([ecrit.id]);
    expect(tasks.removeTag({ taskId: a.id, tagId: urgent.id }).tagIds).toEqual([ecrit.id]);

    expect(tags.deleteTag(ecrit.id)).toEqual({ id: ecrit.id, removedFrom: 2 });
    expect(sql('select * from task_tag where tag_id = ?', ecrit.id)).toEqual([]);
    expect(sql('select * from tag where id = ?', ecrit.id)).toEqual([]);
    expect(tasks.getTask(a.id).tagIds).toEqual([]);
  });

  it('rolls back a tag created on a task of another board', () => {
    const { boardCases: boards, taskCases: tasks, tagCases: tags, sql } = setup();
    const board = boards.createBoard({ name: 'A', columnNames: COLUMN_NAMES });
    const other = boards.createBoard({ name: 'B', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: other.columns[0]!.id, title: 'T' });
    expect(() => tags.createTag({ boardId: board.id, name: 'x', taskId: task.id })).toThrow(
      RuleViolationError,
    );
    expect(sql('select * from tag')).toEqual([]);
  });

  it('duplicates the tags and the links of the copied tasks', () => {
    const { boardCases: boards, taskCases: tasks, tagCases: tags } = setup();
    const board = boards.createBoard({ name: 'Source', columnNames: COLUMN_NAMES });
    const a = tasks.createTask({ columnId: board.columns[0]!.id, title: 'A' });
    const sub = tasks.createTask({ parentId: a.id, title: 'Sub' });
    const design = tags.createTag({ boardId: board.id, name: 'design', color: 'pink', taskId: a.id });
    tasks.addTag({ taskId: sub.id, tagId: design.id });

    const bare = boards.getBoard(
      boards.duplicateBoard({ id: board.id, name: 'Bare', includeTasks: false }).id,
    );
    expect(bare.tags.map((t) => [t.name, t.color, t.taskCount])).toEqual([['design', 'pink', 0]]);
    const full = boards.getBoard(
      boards.duplicateBoard({ id: board.id, name: 'Full', includeTasks: true }).id,
    );
    const [copyTag] = full.tags;
    expect(copyTag).toMatchObject({ name: 'design', taskCount: 2 });
    expect(copyTag!.id).not.toBe(design.id);
    expect(full.tasks[0]?.tagIds).toEqual([copyTag!.id]);
    expect(full.tasks[0]?.subtasks).toEqual({ done: 0, total: 1 });
    expect(boards.getBoard(board.id).tags[0]?.taskCount).toBe(2);
  });
});

describe('board detail at scale', () => {
  it('reads 10,000 tasks with their tags and progress in a constant number of queries', () => {
    const { boardCases: boards, tagCases: tags, tasks: taskRepo, tags: tagRepo, tx, sqlite } = setup();
    const board = boards.createBoard({ name: 'Big', columnNames: COLUMN_NAMES });
    const [todo, , done] = board.columns.map((c) => c.id) as [string, string, string];
    const tagIds = ['a', 'b', 'c'].map((name) => tags.createTag({ boardId: board.id, name }).id);
    const ranks = ranksAfter(null, 12_000);
    tx.run(() => {
      // 10,000 top-level tasks; every fifth one gets two sub-tasks, the first of them done.
      const records = ranks.slice(0, 10_000).map((rank, i) => ({
        id: `t-${i}`,
        boardId: board.id,
        columnId: todo,
        parentId: null,
        key: i + 1,
        title: `Task ${i}`,
        priority: 3 as const,
        startDate: null,
        dueDate: null,
        rank,
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
        descriptionJson: null,
        descriptionText: null,
      }));
      const subs = Array.from({ length: 2_000 }, (_, j) => ({
        ...records[0]!,
        id: `s-${j}`,
        parentId: `t-${Math.floor(j / 2) * 5}`,
        columnId: j % 2 === 0 ? done : todo,
        key: 10_001 + j,
        rank: ranks[10_000 + j]!,
      }));
      taskRepo.insertMany([...records, ...subs]);
      tagRepo.insertLinks(
        records.flatMap((t, i) => tagIds.slice(0, i % 3).map((tagId) => ({ taskId: t.id, tagId }))),
      );
    });

    let statements = 0;
    const prepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = ((source: string) => {
      statements += 1;
      return prepare(source);
    }) as typeof sqlite.prepare;
    const read = boards.getBoard(board.id);
    sqlite.prepare = prepare as typeof sqlite.prepare;

    expect(statements).toBeGreaterThan(0);
    expect(statements).toBeLessThanOrEqual(6);
    expect(read.tasks).toHaveLength(10_000);
    expect(read.taskCount).toBe(10_000);
    const byId = new Map(read.tasks.map((t) => [t.id, t]));
    expect(byId.get('t-0')).toMatchObject({ subtasks: { done: 1, total: 2 }, tagIds: [] });
    expect(byId.get('t-1')).toMatchObject({ subtasks: { done: 0, total: 0 }, tagIds: [tagIds[0]] });
    expect(byId.get('t-2')?.tagIds).toEqual(tagIds.slice(0, 2));
    expect(read.tags.map((t) => t.taskCount)).toEqual([6_666, 3_333, 0]);
  });
});
