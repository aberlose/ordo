import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeAttachmentUseCases } from '../../application/attachments';
import { makeBoardUseCases } from '../../application/boards';
import { makeTaskUseCases } from '../../application/tasks';
import { serveAttachment } from '../../app/attachmentProtocol';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { sqliteTransactor } from '../db/transactor';
import { attachmentStorage } from '../fs/attachmentStorage';
import { uuidv7Generator } from '../ids';
import { attachmentRepository } from './attachmentRepository';
import { boardRepository } from './boardRepository';
import { columnRepository } from './columnRepository';
import { tagRepository } from './tagRepository';
import { taskRepository } from './taskRepository';

const migrations = resolve(__dirname, '../db/migrations');
let opened: OpenedDatabase | undefined;
let dir: string | undefined;

afterEach(() => {
  opened?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];

function setup() {
  opened = openDatabase(':memory:', migrations);
  dir = mkdtempSync(join(tmpdir(), 'ordo-attachments-'));
  const folder = join(dir, 'userData', 'attachments');
  const outside = join(dir, 'Desktop');
  mkdirSync(outside);
  let now = 1_000;
  const shell = { opened: [] as string[], pickFiles: async () => [] as string[] };
  const ports = {
    boards: boardRepository(opened.db),
    columns: columnRepository(opened.db),
    tasks: taskRepository(opened.db),
    tags: tagRepository(opened.db),
    attachments: attachmentRepository(opened.db),
    storage: attachmentStorage(folder),
    shell: {
      pickFiles: () => shell.pickFiles(),
      openPath: async (path: string) => {
        shell.opened.push(path);
        return '';
      },
      showItemInFolder: () => undefined,
    },
    tx: sqliteTransactor(opened.sqlite),
    clock: { now: () => (now += 1) },
    ids: uuidv7Generator(),
    log: { warn: () => undefined },
  };
  const sqlite = opened.sqlite;
  const file = (name: string, content: string | Buffer) => {
    const path = join(outside, name);
    writeFileSync(path, content);
    return path;
  };
  return {
    ...ports,
    ports,
    folder,
    outside,
    file,
    shell,
    boards: makeBoardUseCases(ports),
    tasks: makeTaskUseCases(ports),
    files: makeAttachmentUseCases(ports),
    sql: <T>(query: string, ...params: unknown[]) => sqlite.prepare(query).all(...params) as T[],
    run: (query: string, ...params: unknown[]) => void sqlite.prepare(query).run(...params),
  };
}

describe('attachments on SQLite and disk', () => {
  it('counts the attachments of a board only, per task', async () => {
    const { boards, tasks, files, file, attachments } = setup();
    const one = boards.createBoard({ name: 'Un', columnNames: COLUMN_NAMES });
    const two = boards.createBoard({ name: 'Deux', columnNames: COLUMN_NAMES });
    const a = tasks.createTask({ columnId: one.columns[0]!.id, title: 'A' });
    const b = tasks.createTask({ columnId: one.columns[1]!.id, title: 'B' });
    tasks.createTask({ columnId: one.columns[0]!.id, title: 'Sans fichier' });
    const c = tasks.createTask({ columnId: two.columns[0]!.id, title: 'C' });
    const pdf = file('a.pdf', 'x');
    await files.addAttachments({ taskId: a.id, paths: [pdf, pdf] });
    await files.addAttachments({ taskId: b.id, paths: [pdf] });
    await files.addAttachments({ taskId: c.id, paths: [pdf] });
    const sorted = (rows: { taskId: string; count: number }[]) =>
      [...rows].sort((x, y) => (x.taskId < y.taskId ? -1 : 1));
    expect(sorted(attachments.countByBoard(one.id))).toEqual(
      sorted([
        { taskId: a.id, count: 2 },
        { taskId: b.id, count: 1 },
      ]),
    );
    expect(attachments.countByBoard(two.id)).toEqual([{ taskId: c.id, count: 1 }]);
  });

  it('sweeps old orphan files from the folder, never the files of a row', async () => {
    const { boards, tasks, files, file, folder, ports } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const [kept] = (await files.addAttachments({ taskId: task.id, paths: [file('a.pdf', 'a')] })).attachments;
    writeFileSync(join(folder, 'crashed-copy.pdf'), 'x');
    writeFileSync(join(folder, 'in-progress.pdf'), 'x');
    const old = (Date.now() - 60 * 60 * 1000) / 1000;
    for (const name of ['crashed-copy.pdf', `${kept!.id}.pdf`]) utimesSync(join(folder, name), old, old);
    // The use cases' clock is a counter here: give the sweep the real time.
    const sweeping = makeAttachmentUseCases({ ...ports, clock: { now: () => Date.now() } });
    expect(await sweeping.sweepOrphanFiles()).toBe(1);
    expect(readdirSync(folder).sort()).toEqual([`${kept!.id}.pdf`, 'in-progress.pdf'].sort());
  });

  it('copies files into the folder, counts, lists, serves and deletes them', async () => {
    const { boards, tasks, files, folder, outside, file, sql } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const pdf = file('Rapport final.pdf', 'pdf-bytes');

    const out = await files.addAttachments({
      taskId: task.id,
      paths: [pdf, outside, join(outside, 'absent')],
    });
    expect(out.failures.map((f) => f.message)).toEqual(['Not a file', 'File not found']);
    const [added] = out.attachments;
    expect(added).toMatchObject({ fileName: 'Rapport final.pdf', mimeType: 'application/pdf', sizeBytes: 9 });
    expect(readdirSync(folder)).toEqual([`${added!.id}.pdf`]);
    expect(readFileSync(join(folder, `${added!.id}.pdf`), 'utf8')).toBe('pdf-bytes');
    expect(sql('select stored_path from attachment')).toEqual([{ stored_path: `${added!.id}.pdf` }]);
    // The source is copied, not moved.
    expect(existsSync(pdf)).toBe(true);

    const image = await files.addAttachmentData({
      taskId: task.id,
      fileName: '',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
    expect(image.fileName).toBe('image.png');
    expect(files.listAttachments(task.id).map((a) => a.id)).toEqual([added!.id, image.id]);
    expect(boards.getBoard(board.id).tasks[0]!.attachmentCount).toBe(2);
    expect(tasks.getTask(task.id).attachmentCount).toBe(2);

    const served = await serveAttachment(new Request(image.url), (id) => files.servedFile(id));
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));

    await files.deleteAttachment(added!.id);
    expect(readdirSync(folder)).toEqual([`${image.id}.png`]);
    expect(tasks.getTask(task.id).attachmentCount).toBe(1);
    expect((await serveAttachment(new Request(added!.url), (id) => files.servedFile(id))).status).toBe(404);

    // The trash keeps the files.
    tasks.deleteTask(task.id);
    expect(readdirSync(folder)).toEqual([`${image.id}.png`]);
  });

  it('removes the copied file when the row cannot be inserted', async () => {
    const { boards, tasks, files, folder, file, run } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    run(`create trigger fail_attachments before insert on attachment begin select raise(abort, 'boom'); end`);
    const out = await files.addAttachments({ taskId: task.id, paths: [file('a.txt', 'a')] });
    expect(out.failures).toMatchObject([{ fileName: 'a.txt', message: 'boom' }]);
    expect(readdirSync(folder)).toEqual([]);
  });

  it('stores notes with their derived text', () => {
    const { boards, tasks, sql } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const doc = {
      type: 'doc' as const,
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Étape 1' }] },
      ],
    };
    const saved = tasks.updateDescription({ id: task.id, json: doc });
    expect(tasks.getDescription(task.id)).toEqual(saved);
    expect(
      sql('select description_json, description_text, updated_at from task where id = ?', task.id),
    ).toEqual([
      {
        description_json: JSON.stringify(doc),
        description_text: 'Plan\nÉtape 1',
        updated_at: saved.updatedAt,
      },
    ]);
    tasks.updateDescription({ id: task.id, json: { type: 'doc', content: [] } });
    expect(sql('select description_json, description_text from task where id = ?', task.id)).toEqual([
      { description_json: null, description_text: null },
    ]);
  });

  it('duplicates a board with copies of its files and remapped note images', async () => {
    const { boards, tasks, files, folder, file, sql } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const sub = tasks.createTask({ parentId: task.id, title: 'Sous-tâche' });
    const [png] = (await files.addAttachments({ taskId: task.id, paths: [file('photo.png', 'png')] }))
      .attachments;
    const [txt] = (await files.addAttachments({ taskId: sub.id, paths: [file('notes.txt', 'txt')] }))
      .attachments;
    tasks.updateDescription({
      id: task.id,
      json: { type: 'doc', content: [{ type: 'image', attrs: { attachmentId: png!.id, width: 40 } }] },
    });

    const copy = await boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    const [copyTask] = boards.getBoard(copy.id).tasks;
    const [copyPng] = files.listAttachments(copyTask!.id);
    const copySub = tasks.listSubtasks(copyTask!.id)[0]!;
    const [copyTxt] = files.listAttachments(copySub.id);
    expect(copyPng).toMatchObject({ fileName: 'photo.png', sizeBytes: 3 });
    expect(copyTxt).toMatchObject({ fileName: 'notes.txt', sizeBytes: 3 });
    expect(readdirSync(folder).sort()).toEqual(
      [png!.id, txt!.id, copyPng!.id, copyTxt!.id]
        .map((id, i) => `${id}.${i % 2 === 0 ? 'png' : 'txt'}`)
        .sort(),
    );
    expect(readFileSync(join(folder, `${copyPng!.id}.png`), 'utf8')).toBe('png');
    expect(tasks.getDescription(copyTask!.id).json).toEqual({
      type: 'doc',
      content: [{ type: 'image', attrs: { attachmentId: copyPng!.id, width: 40 } }],
    });
    expect(sql('select count(*) as n from attachment')).toEqual([{ n: 4 }]);

    // Deleting a copy leaves the original's file alone.
    await files.deleteAttachment(copyPng!.id);
    expect(existsSync(join(folder, `${png!.id}.png`))).toBe(true);
  });

  it('skips a missing file and removes the copies when the duplication fails', async () => {
    const { boards, tasks, files, folder, file, run } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const [a] = (await files.addAttachments({ taskId: task.id, paths: [file('a.txt', 'a')] })).attachments;
    const [b] = (await files.addAttachments({ taskId: task.id, paths: [file('b.txt', 'b')] })).attachments;
    rmSync(join(folder, `${a!.id}.txt`));

    const copy = await boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    expect(files.listAttachments(boards.getBoard(copy.id).tasks[0]!.id).map((x) => x.fileName)).toEqual([
      'b.txt',
    ]);

    const before = readdirSync(folder).sort();
    run(`create trigger fail_tasks before insert on task begin select raise(abort, 'boom'); end`);
    await expect(
      boards.duplicateBoard({ id: board.id, name: 'Encore', includeTasks: true }),
    ).rejects.toThrow();
    expect(readdirSync(folder).sort()).toEqual(before);
    expect(before).toContain(`${b!.id}.txt`);
  });

  it('opens the stored file through the shell', async () => {
    const { boards, tasks, files, folder, file, shell } = setup();
    const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
    const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
    const [a] = (await files.addAttachments({ taskId: task.id, paths: [file('a.txt', 'a')] })).attachments;
    await files.openAttachment(a!.id);
    expect(shell.opened).toEqual([join(folder, `${a!.id}.txt`)]);
  });
});
