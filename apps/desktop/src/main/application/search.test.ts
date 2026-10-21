import { beforeEach, describe, expect, it } from 'vitest';
import { makeBoardUseCases } from './boards';
import { NotFoundError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeSearchUseCases, RECENT_TASKS_SETTING } from './search';
import { makeTagUseCases } from './tags';
import { makeTaskUseCases } from './tasks';

let repos: ReturnType<typeof inMemoryRepositories>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let tags: ReturnType<typeof makeTagUseCases>;
let search: ReturnType<typeof makeSearchUseCases>;

beforeEach(() => {
  repos = inMemoryRepositories();
  const deps = { ...repos, ...fixedDeps() };
  boards = makeBoardUseCases(deps);
  tasks = makeTaskUseCases(deps);
  tags = makeTagUseCases(deps);
  search = makeSearchUseCases(deps);
});

const newBoard = (name = 'Perso') =>
  boards.createBoard({ name, columnNames: ['À faire', 'En cours', 'Terminé'] });

const recentIds = () => search.listRecent().map((hit) => hit.id);

describe('search use cases', () => {
  it('finds nothing for punctuation-only text', () => {
    const board = newBoard();
    tasks.createTask({ columnId: board.columns[0]!.id, title: 'Header' });
    expect(search.searchTasks({ text: '" * -' })).toEqual([]);
    expect(search.searchBoardTaskIds({ boardId: board.id, text: '"' })).toEqual({ taskIds: [] });
  });

  it('returns hits with where the task lives and its tag names', () => {
    const board = newBoard();
    const task = tasks.createTask({ columnId: board.columns[1]!.id, title: 'Refaire le header' });
    tags.createTag({ boardId: board.id, name: 'Design', taskId: task.id });
    const sub = tasks.createTask({ parentId: task.id, title: 'Header mobile' });
    expect(search.searchTasks({ text: 'head' })).toEqual([
      expect.objectContaining({
        id: task.id,
        parentTitle: null,
        boardName: 'Perso',
        columnName: 'En cours',
        tagNames: ['Design'],
      }),
      expect.objectContaining({ id: sub.id, parentId: task.id, parentTitle: 'Refaire le header' }),
    ]);
    expect(search.searchBoardTaskIds({ boardId: board.id, text: 'head' })).toEqual({ taskIds: [task.id] });
    expect(search.searchTasks({ text: 'head', limit: 1 })).toHaveLength(1);
  });
});

describe('typed filters', () => {
  it('passes priorities, due options against today and folded tag names to the index', () => {
    const board = newBoard();
    const [todo, , done] = board.columns.map((c) => c.id) as [string, string, string];
    const late = tasks.createTask({ columnId: todo, title: 'Facture en retard' });
    tasks.updateTask({ id: late.id, priority: 5, dueDate: '2026-10-01' });
    const lateDone = tasks.createTask({ columnId: done, title: 'Facture payée' });
    tasks.updateTask({ id: lateDone.id, priority: 5, dueDate: '2026-10-01' });
    const tagged = tasks.createTask({ columnId: todo, title: 'Facture du gîte' });
    tags.createTag({ boardId: board.id, name: 'Été', taskId: tagged.id });
    const ids = (filters: object) =>
      search
        .searchTasks({ text: 'facture', ...filters })
        .map((hit) => hit.id)
        .sort();

    expect(ids({})).toHaveLength(3);
    expect(ids({ priorities: [5] })).toEqual([late.id, lateDone.id].sort());
    expect(ids({ due: ['overdue'], today: '2026-10-21' })).toEqual([late.id]);
    expect(ids({ due: ['none'], today: '2026-10-21' })).toEqual([tagged.id]);
    expect(ids({ tagNames: ['ETE', 'ÉTÉ'] })).toEqual([tagged.id]);
    expect(ids({ tagNames: ['ete'], priorities: [5] })).toEqual([]);
    // Due options without today are refused by the contract; the use case then ignores them.
    expect(ids({ due: ['overdue'] })).toHaveLength(3);
  });
});

describe('recently opened', () => {
  it('lists the last opened tasks, most recent first, without duplicates, at most 5', () => {
    const column = newBoard().columns[0]!.id;
    const ids = Array.from(
      { length: 7 },
      (_, i) => tasks.createTask({ columnId: column, title: `T${i}` }).id,
    );
    expect(search.listRecent()).toEqual([]);
    search.recordRecent(ids[0]!);
    search.recordRecent(ids[1]!);
    search.recordRecent(ids[0]!);
    expect(recentIds()).toEqual([ids[0], ids[1]]);
    for (const id of ids.slice(2)) search.recordRecent(id);
    expect(recentIds()).toEqual([ids[6], ids[5], ids[4], ids[3], ids[2]]);
    expect(JSON.parse(repos.testing.settingRows.get(RECENT_TASKS_SETTING)!)).toHaveLength(5);
  });

  it('leaves out deleted tasks and archived boards, and frees their slots', () => {
    const board = newBoard();
    const other = newBoard('Autre');
    const a = tasks.createTask({ columnId: board.columns[0]!.id, title: 'A' });
    const b = tasks.createTask({ columnId: board.columns[0]!.id, title: 'B' });
    const c = tasks.createTask({ columnId: other.columns[0]!.id, title: 'C' });
    for (const id of [a.id, b.id, c.id]) search.recordRecent(id);
    tasks.deleteTask(b.id);
    boards.archiveBoard(other.id);
    expect(recentIds()).toEqual([a.id]);

    const d = tasks.createTask({ columnId: board.columns[0]!.id, title: 'D' });
    search.recordRecent(d.id);
    expect(JSON.parse(repos.testing.settingRows.get(RECENT_TASKS_SETTING)!)).toEqual([d.id, a.id]);
  });

  it('refuses an unknown or deleted task', () => {
    const task = tasks.createTask({ columnId: newBoard().columns[0]!.id, title: 'A' });
    expect(() => search.recordRecent('00000000-0000-7000-8000-999999999999')).toThrow(NotFoundError);
    tasks.deleteTask(task.id);
    expect(() => search.recordRecent(task.id)).toThrow(NotFoundError);
    expect(repos.testing.settingRows.has(RECENT_TASKS_SETTING)).toBe(false);
  });

  it('reads a missing or corrupt setting as an empty list', () => {
    const task = tasks.createTask({ columnId: newBoard().columns[0]!.id, title: 'A' });
    for (const corrupt of ['not json', '{"a":1}', '42', 'null']) {
      repos.settings.set(RECENT_TASKS_SETTING, corrupt);
      expect(search.listRecent()).toEqual([]);
    }
    repos.settings.set(RECENT_TASKS_SETTING, JSON.stringify([7, task.id, null]));
    expect(recentIds()).toEqual([task.id]);
    repos.settings.set(RECENT_TASKS_SETTING, 'not json');
    search.recordRecent(task.id);
    expect(recentIds()).toEqual([task.id]);
  });
});
