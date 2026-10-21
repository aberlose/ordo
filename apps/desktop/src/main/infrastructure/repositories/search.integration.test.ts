import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from '../../application/boards';
import { makeColumnUseCases } from '../../application/columns';
import { NotFoundError } from '../../application/errors';
import { makeSearchUseCases, RECENT_TASKS_SETTING } from '../../application/search';
import { makeTagUseCases } from '../../application/tags';
import { makeTaskUseCases } from '../../application/tasks';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { attachmentStorage } from '../fs/attachmentStorage';
import { uuidv7, uuidv7Generator } from '../ids';
import { attachmentRepository } from './attachmentRepository';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';
import { searchRepository } from './searchRepository';
import { settingRepository } from './settingRepository';
import { tagRepository } from './tagRepository';
import { taskRepository } from './taskRepository';

const migrations = resolve(__dirname, '../db/migrations');
let opened: OpenedDatabase | undefined;

afterEach(() => opened?.close());

/** These tests do not touch files: the folder is never created. */
const unusedStorage = attachmentStorage(join(tmpdir(), 'ordo-tests-no-attachments'));

const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function setup() {
  opened = openDatabase(':memory:', migrations);
  let now = 1_000;
  const ports = {
    boards: boardRepository(opened.db),
    columns: columnRepository(opened.db),
    tasks: taskRepository(opened.db),
    tags: tagRepository(opened.db),
    attachments: attachmentRepository(opened.db),
    search: searchRepository(opened.db),
    settings: settingRepository(opened.db),
    storage: unusedStorage,
    log: { warn: () => undefined },
    tx: sqliteTransactor(opened.sqlite),
    clock: { now: () => (now += 1) },
    ids: uuidv7Generator(),
  };
  const search = makeSearchUseCases(ports);
  const sqlite = opened.sqlite;
  return {
    ...ports,
    sqlite,
    boards: makeBoardUseCases(ports),
    tasks: makeTaskUseCases(ports),
    columns: makeColumnUseCases(ports),
    tags: makeTagUseCases(ports),
    search,
    /** Titles found by the palette search, best first. */
    titles: (text: string, limit?: number) =>
      search.searchTasks({ text, ...(limit === undefined ? {} : { limit }) }).map((hit) => hit.title),
    boardIds: (boardId: string, text: string) => search.searchBoardTaskIds({ boardId, text }).taskIds.sort(),
  };
}

describe('full-text search on SQLite', () => {
  it('matches titles, notes and tag names, by prefix, ignoring case and accents, all words', () => {
    const { boards, tasks, tags, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const todo = board.columns[0]!.id;
    const header = tasks.createTask({ columnId: todo, title: 'Refaire le header' });
    const summer = tasks.createTask({ columnId: todo, title: 'Vacances d’Été' });
    const noted = tasks.createTask({ columnId: todo, title: 'Courses' });
    tasks.updateDescription({ id: noted.id, json: doc('Acheter du pain et un element de cuisine') });
    const tagged = tasks.createTask({ columnId: todo, title: 'Banque' });
    tags.createTag({ boardId: board.id, name: 'Administratif', taskId: tagged.id });

    expect(titles('head')).toEqual([header.title]);
    expect(titles('HEADER')).toEqual([header.title]);
    expect(titles('ete')).toEqual([summer.title]);
    expect(titles('été vacan')).toEqual([summer.title]);
    expect(titles('élément')).toEqual([noted.title]);
    expect(titles('pain')).toEqual([noted.title]);
    expect(titles('admin')).toEqual([tagged.title]);
    // Several words: every one must match (AND).
    expect(titles('pain cuisine')).toEqual([noted.title]);
    expect(titles('pain header')).toEqual([]);
    // One letter is a valid prefix too.
    expect(titles('b')).toEqual([tagged.title]);
  });

  it('never treats typed text as FTS5 syntax', () => {
    const { boards, tasks, titles, boardIds } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    tasks.createTask({ columnId: board.columns[0]!.id, title: 'Header OR footer' });
    for (const text of [
      '"',
      '"header',
      'head*',
      'OR',
      'header OR',
      'NEAR(header',
      'NOT',
      'AND (',
      ':',
      '{title}',
      '^',
      '-x',
      "l'ét",
    ]) {
      expect(() => titles(text)).not.toThrow();
      expect(() => boardIds(board.id, text)).not.toThrow();
    }
    expect(titles('or')).toEqual(['Header OR footer']);
    expect(titles('NEAR(header')).toEqual([]);
    expect(titles('"header')).toEqual(['Header OR footer']);
  });

  it('does not search task ids', () => {
    const { boards, tasks, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Plain' });
    expect(titles(task.id.slice(-12))).toEqual([]);
    expect(titles(task.id.slice(0, 8))).toEqual([]);
  });

  it('ranks title matches before tag matches before notes-only matches, then newest first', () => {
    const { boards, tasks, tags, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const todo = board.columns[0]!.id;
    const inNotes = tasks.createTask({ columnId: todo, title: 'Notes only' });
    tasks.updateDescription({ id: inNotes.id, json: doc('Il faut revoir le budget du trimestre') });
    const inTag = tasks.createTask({ columnId: todo, title: 'Tag only' });
    tags.createTag({ boardId: board.id, name: 'budget', taskId: inTag.id });
    tasks.createTask({ columnId: todo, title: 'Budget annuel' });
    tasks.createTask({ columnId: todo, title: 'Budget mensuel' });
    expect(titles('budget')).toEqual(['Budget mensuel', 'Budget annuel', 'Tag only', 'Notes only']);
    expect(titles('budget', 2)).toEqual(['Budget mensuel', 'Budget annuel']);
  });

  it('caps the palette search at its limit and returns everything for a board', () => {
    const { boards, tasks, titles, boardIds } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    for (let i = 0; i < 60; i += 1) tasks.createTask({ columnId: board.columns[0]!.id, title: `Item ${i}` });
    expect(titles('item')).toHaveLength(50);
    expect(titles('item', 5)).toHaveLength(5);
    expect(boardIds(board.id, 'item')).toHaveLength(60);
  });

  it('still fills the limit when the best matches are hidden', () => {
    const { boards, tasks, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const todo = board.columns[0]!.id;
    tasks.createTask({ columnId: todo, title: 'Rapport annuel détaillé' });
    tasks.createTask({ columnId: todo, title: 'Rapport mensuel détaillé' });
    // Shorter titles rank first; all of them are deleted (more than the ranked rows looked at).
    for (let i = 0; i < 12; i += 1)
      tasks.deleteTask(tasks.createTask({ columnId: todo, title: `Rapport ${i}` }).id);
    expect(titles('rapport', 2).sort()).toEqual(['Rapport annuel détaillé', 'Rapport mensuel détaillé']);
    expect(titles('rapport', 1)).toHaveLength(1);
  });

  it('returns hits with their board, column, parent and tags', () => {
    const { boards, tasks, tags, search, boardIds } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    boards.updateBoard({ id: board.id, icon: 'house', color: 'green' });
    const [, doing] = board.columns.map((c) => c.id) as [string, string];
    const parent = tasks.createTask({ columnId: doing, title: 'Site web' });
    tasks.updateTask({ id: parent.id, priority: 5, dueDate: '2026-11-02' });
    tags.createTag({ boardId: board.id, name: 'zone rouge', taskId: parent.id });
    tags.createTag({ boardId: board.id, name: 'Accueil', taskId: parent.id });
    const sub = tasks.createTask({ parentId: parent.id, title: 'Page web contact' });

    const hits = search.searchTasks({ text: 'web' }).sort((x, y) => x.title.localeCompare(y.title));
    expect(hits).toEqual([
      expect.objectContaining({
        id: sub.id,
        parentId: parent.id,
        parentTitle: 'Site web',
        columnId: board.columns[0]!.id,
        tagNames: [],
      }),
      {
        id: parent.id,
        title: 'Site web',
        parentId: null,
        parentTitle: null,
        boardId: board.id,
        boardName: 'Perso',
        boardIcon: 'house',
        boardColor: 'green',
        columnId: doing,
        columnName: 'En cours',
        columnIcon: board.columns[1]!.icon,
        columnColor: board.columns[1]!.color,
        columnCategory: 'in_progress',
        priority: 5,
        dueDate: '2026-11-02',
        completedAt: null,
        tagNames: ['Accueil', 'zone rouge'],
      },
    ]);
    // Board filters only look at cards: the sub-task is not one.
    expect(boardIds(board.id, 'web')).toEqual([parent.id]);
    expect(boardIds(board.id, 'contact')).toEqual([]);
    expect(boardIds(boards.createBoard({ name: 'Autre', columnNames: COLUMN_NAMES }).id, 'web')).toEqual([]);
  });
});

describe('full-text index kept in sync', () => {
  it('follows task creation, renames and notes', () => {
    const { boards, tasks, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Alpha' });
    expect(titles('alpha')).toEqual(['Alpha']);

    tasks.updateTask({ id: task.id, title: 'Bravo' });
    expect(titles('alpha')).toEqual([]);
    expect(titles('bravo')).toEqual(['Bravo']);

    tasks.updateDescription({ id: task.id, json: doc('Charlie delta') });
    expect(titles('charlie')).toEqual(['Bravo']);
    tasks.updateDescription({ id: task.id, json: doc('Echo') });
    expect(titles('charlie')).toEqual([]);
    expect(titles('echo')).toEqual(['Bravo']);
    tasks.updateDescription({ id: task.id, json: null });
    expect(titles('echo')).toEqual([]);
    // Other updates leave the row alone.
    tasks.updateTask({ id: task.id, priority: 1 });
    expect(titles('bravo')).toEqual(['Bravo']);
  });

  it('follows tags: add, remove, rename and delete', () => {
    const { boards, tasks, tags, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const todo = board.columns[0]!.id;
    const a = tasks.createTask({ columnId: todo, title: 'A' });
    const b = tasks.createTask({ columnId: todo, title: 'B' });
    const urgent = tags.createTag({ boardId: board.id, name: 'Urgent', taskId: a.id });
    tasks.addTag({ taskId: b.id, tagId: urgent.id });
    const later = tags.createTag({ boardId: board.id, name: 'Plus tard', taskId: a.id });
    expect(titles('urgent').sort()).toEqual(['A', 'B']);
    expect(titles('plus tard')).toEqual(['A']);

    tasks.removeTag({ taskId: b.id, tagId: urgent.id });
    expect(titles('urgent')).toEqual(['A']);

    tags.updateTag({ id: urgent.id, name: 'Pressé' });
    expect(titles('urgent')).toEqual([]);
    expect(titles('presse')).toEqual(['A']);
    expect(titles('plus')).toEqual(['A']);

    tags.deleteTag(later.id);
    expect(titles('plus')).toEqual([]);
    expect(titles('presse')).toEqual(['A']);
    tags.deleteTag(urgent.id);
    expect(titles('presse')).toEqual([]);
    expect(titles('a')).toEqual(['A']);
  });

  it('leaves out deleted tasks, sub-tasks of deleted parents, deleted columns and archived boards', () => {
    const { boards, tasks, columns, titles, boardIds } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const [todo, doing] = board.columns.map((c) => c.id) as [string, string];
    const gone = tasks.createTask({ columnId: todo, title: 'Topic gone' });
    const parent = tasks.createTask({ columnId: todo, title: 'Topic parent' });
    tasks.createTask({ parentId: parent.id, title: 'Topic sub' });
    tasks.createTask({ columnId: doing, title: 'Topic doing' });
    const kept = tasks.createTask({ columnId: todo, title: 'Topic kept' });

    tasks.deleteTask(gone.id);
    expect(titles('topic').sort()).toEqual(['Topic doing', 'Topic kept', 'Topic parent', 'Topic sub']);
    tasks.deleteTask(parent.id);
    columns.deleteColumn(doing);
    expect(titles('topic')).toEqual(['Topic kept']);
    expect(boardIds(board.id, 'topic')).toEqual([kept.id]);

    boards.archiveBoard(board.id);
    expect(titles('topic')).toEqual([]);
    boards.restoreBoard(board.id);
    expect(titles('topic')).toEqual(['Topic kept']);
  });

  it('indexes the tasks, notes and tags of a duplicated board', async () => {
    const { boards, tasks, tags, search } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Original' });
    tasks.updateDescription({ id: task.id, json: doc('Zulu') });
    tags.createTag({ boardId: board.id, name: 'Yankee', taskId: task.id });
    tasks.createTask({ parentId: task.id, title: 'Sous-tâche' });

    const copy = await boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    for (const text of ['original', 'zulu', 'yankee', 'sous tache']) {
      expect(
        search
          .searchTasks({ text })
          .map((hit) => hit.boardName)
          .sort(),
      ).toEqual(['Copie', 'Perso']);
    }
    expect(search.searchBoardTaskIds({ boardId: copy.id, text: 'zulu' }).taskIds).toHaveLength(1);
  });

  it('backfills tasks that existed before the migration, and removes purged ones', () => {
    const { boards, tasks, tags, sqlite, titles } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Avant' });
    tasks.updateDescription({ id: task.id, json: doc('Notes anciennes') });
    tags.createTag({ boardId: board.id, name: 'Ancien', taskId: task.id });
    // Rebuild the index from scratch with the migration's own backfill statement.
    sqlite.exec('delete from task_fts');
    expect(titles('avant')).toEqual([]);
    sqlite.exec(`insert into task_fts (task_id, title, description_text, tags)
      select t.id, t.title, coalesce(t.description_text, ''),
        (select coalesce(group_concat(tg.name, ' '), '') from task_tag tt join tag tg on tg.id = tt.tag_id
          where tt.task_id = t.id)
      from task t`);
    expect(titles('avant notes ancien')).toEqual(['Avant']);

    // A purge (lot 8) deletes the row: the index follows.
    sqlite.prepare('delete from task_tag where task_id = ?').run(task.id);
    sqlite.prepare('delete from task where id = ?').run(task.id);
    expect(sqlite.prepare('select count(*) as n from task_fts').get()).toEqual({ n: 0 });
  });
});

describe('recently opened on SQLite', () => {
  it('stores the list in the settings table and reads it back in order', () => {
    const { boards, tasks, search, settings } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const a = tasks.createTask({ columnId: board.columns[0]!.id, title: 'A' });
    const b = tasks.createTask({ columnId: board.columns[0]!.id, title: 'B' });
    const sub = tasks.createTask({ parentId: a.id, title: 'Sub' });
    expect(search.recordRecent(a.id)).toEqual({});
    search.recordRecent(sub.id);
    search.recordRecent(b.id);
    search.recordRecent(a.id);
    expect(search.listRecent().map((hit) => [hit.title, hit.parentTitle])).toEqual([
      ['A', null],
      ['B', null],
      ['Sub', 'A'],
    ]);
    expect(JSON.parse(settings.get(RECENT_TASKS_SETTING)!)).toEqual([a.id, b.id, sub.id]);

    tasks.deleteTask(b.id);
    expect(search.listRecent().map((hit) => hit.title)).toEqual(['A', 'Sub']);
    expect(() => search.recordRecent(b.id)).toThrow(NotFoundError);
    settings.set(RECENT_TASKS_SETTING, '[oops');
    expect(search.listRecent()).toEqual([]);
  });
});

describe('search performance', () => {
  const TASKS = 10_000;
  /** Budget (docs/architecture.md#performance-budgets): search on 10,000 tasks < 50 ms. */
  const BUDGET_MS = 50;

  /** Median of a few timed runs, after a warm-up run. */
  const median = (run: () => unknown) => {
    run();
    const times = Array.from({ length: 7 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    }).sort((x, y) => x - y);
    return times[3]!;
  };

  it(`searches ${TASKS.toLocaleString('en')} tasks within the budget`, async ({ annotate }) => {
    const { boards, tags, sqlite, search } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const columnIds = board.columns.map((c) => c.id);
    const tag = tags.createTag({ boardId: board.id, name: 'Générées' });
    const words = ['header', 'footer', 'budget', 'réunion', 'client', 'facture', 'design', 'été'];
    const insert = sqlite.prepare(
      `insert into task (id, board_id, column_id, key, title, description_text, rank, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const link = sqlite.prepare('insert into task_tag (task_id, tag_id) values (?, ?)');
    const seeded = performance.now();
    sqlite.transaction(() => {
      for (let i = 0; i < TASKS; i += 1) {
        const id = uuidv7(1_700_000_000_000 + i);
        const word = words[i % words.length]!;
        insert.run(
          id,
          board.id,
          columnIds[i % 3],
          i + 1,
          `Tâche générée ${i + 1} ${word}`,
          `Notes de la tâche ${i + 1} : préparer le ${word} avec l’équipe, relire les éléments, envoyer le compte rendu.`,
          `a${String(i).padStart(6, '0')}`,
          i,
          i,
        );
        if (i % 4 === 0) link.run(id, tag.id);
      }
    })();
    const seedMs = performance.now() - seeded;

    const timings = {
      // Matches every task: the worst case (all rows scored, sorted, cut to 50).
      'search.tasks "tache"': median(() => search.searchTasks({ text: 'tache' })),
      'search.tasks "head"': median(() => search.searchTasks({ text: 'head' })),
      'search.tasks "gen ete"': median(() => search.searchTasks({ text: 'gen ete' })),
      'search.boardTaskIds "tache"': median(() =>
        search.searchBoardTaskIds({ boardId: board.id, text: 'tache' }),
      ),
      'search.boardTaskIds "reunion"': median(() =>
        search.searchBoardTaskIds({ boardId: board.id, text: 'reunion' }),
      ),
    };
    expect(search.searchBoardTaskIds({ boardId: board.id, text: 'tache' }).taskIds).toHaveLength(TASKS);
    expect(search.searchTasks({ text: 'generees' })).toHaveLength(50);

    // Trigger cost on a full index: one tag link and one rename.
    const first = sqlite.prepare('select id from task order by key limit 1').get() as { id: string };
    const other = tags.createTag({ boardId: board.id, name: 'Autre' });
    const linkMs = median(() => {
      sqlite.prepare('delete from task_tag where task_id = ? and tag_id = ?').run(first.id, other.id);
      link.run(first.id, other.id);
    });
    const renameMs = median(() => tags.updateTag({ id: tag.id, name: `Générées ${Math.random()}` }));

    await annotate(
      `[perf] seeded ${TASKS} tasks in ${seedMs.toFixed(0)} ms; ` +
        Object.entries(timings)
          .map(([name, ms]) => `${name} ${ms.toFixed(1)} ms`)
          .join('; ') +
        `; link unlink+link ${linkMs.toFixed(2)} ms; tag rename (2,500 tasks) ${renameMs.toFixed(1)} ms`,
      'perf',
    );
    for (const ms of Object.values(timings)) expect(ms).toBeLessThan(BUDGET_MS);
  });
});
