import { attachmentUrl } from '@ordo/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeAttachmentUseCases, ORPHAN_MIN_AGE_MS, sourcePathProblem } from './attachments';
import { makeBoardUseCases } from './boards';
import { InvalidInputError, NotFoundError, RuleViolationError } from './errors';
import { fixedDeps, inMemoryRepositories } from './inMemory.testkit';
import { makeTaskUseCases } from './tasks';

let repos: ReturnType<typeof inMemoryRepositories>;
let deps: ReturnType<typeof fixedDeps>;
let boards: ReturnType<typeof makeBoardUseCases>;
let tasks: ReturnType<typeof makeTaskUseCases>;
let files: ReturnType<typeof makeAttachmentUseCases>;
let warnings: string[];

beforeEach(() => {
  repos = inMemoryRepositories();
  deps = fixedDeps();
  warnings = [];
  const log = { warn: (message: string) => void warnings.push(message) };
  boards = makeBoardUseCases({ ...repos, ...deps, log });
  tasks = makeTaskUseCases({ ...repos, ...deps });
  files = makeAttachmentUseCases({ ...repos, ...deps, log });
});

const COLUMN_NAMES: [string, string, string] = ['À faire', 'En cours', 'Terminé'];
const bytes = (...values: number[]) => new Uint8Array(values);

function seeded() {
  const board = boards.createBoard({ name: 'Perso', columnNames: COLUMN_NAMES });
  const task = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Relire' });
  repos.testing.outsideFiles.set('/Users/alice/Rapport.pdf', bytes(1, 2, 3));
  repos.testing.outsideFiles.set('/Users/alice/photo.png', bytes(9));
  repos.testing.outsideFiles.set('/Users/alice/Dossier', null);
  return { board, task };
}

describe('adding attachments', () => {
  it('copies each file, inserts its row and lists them oldest first', async () => {
    const { task } = seeded();
    const out = await files.addAttachments({
      taskId: task.id,
      paths: ['/Users/alice/Rapport.pdf', '/Users/alice/photo.png'],
    });
    expect(out.failures).toEqual([]);
    expect(out.attachments.map((a) => [a.fileName, a.mimeType, a.sizeBytes])).toEqual([
      ['Rapport.pdf', 'application/pdf', 3],
      ['photo.png', 'image/png', 1],
    ]);
    const [pdf] = out.attachments;
    expect(pdf!.url).toBe(attachmentUrl(pdf!.id));
    expect(repos.testing.storedFiles.get(`${pdf!.id}.pdf`)).toEqual(bytes(1, 2, 3));
    deps.setNow(deps.clock.now() + 10);
    await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/Rapport.pdf'] });
    expect(files.listAttachments(task.id).map((a) => a.fileName)).toEqual([
      'Rapport.pdf',
      'photo.png',
      'Rapport.pdf',
    ]);
    expect(tasks.getTask(task.id).attachmentCount).toBe(3);
  });

  it('reports the files it cannot add and still adds the others', async () => {
    const { task } = seeded();
    repos.testing.outsideFiles.set('/Users/alice/locked.txt', bytes(1));
    repos.testing.failures.import.add('/Users/alice/locked.txt');
    const out = await files.addAttachments({
      taskId: task.id,
      paths: [
        '/Users/alice/Dossier',
        '/nope/absent.doc',
        '/Users/alice/locked.txt',
        '/Users/alice/photo.png',
      ],
    });
    expect(out.attachments.map((a) => a.fileName)).toEqual(['photo.png']);
    expect(out.failures).toEqual([
      { path: '/Users/alice/Dossier', fileName: 'Dossier', message: 'Not a file' },
      { path: '/nope/absent.doc', fileName: 'absent.doc', message: 'File not found' },
      { path: '/Users/alice/locked.txt', fileName: 'locked.txt', message: 'EACCES: permission denied' },
    ]);
    expect(repos.testing.storedFiles.size).toBe(1);
  });

  it('removes the copied file when the row cannot be written', async () => {
    const { task } = seeded();
    repos.attachments.insert = () => {
      throw new Error('disk I/O error');
    };
    const out = await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/photo.png'] });
    expect(out.failures).toMatchObject([{ fileName: 'photo.png', message: 'disk I/O error' }]);
    expect(repos.testing.storedFiles.size).toBe(0);
  });

  it('refuses a deleted task and a task of an archived board, before copying anything', async () => {
    const { board, task } = seeded();
    const other = tasks.createTask({ columnId: board.columns[0]!.id, title: 'Autre' });
    tasks.deleteTask(other.id);
    const paths = ['/Users/alice/photo.png'];
    await expect(files.addAttachments({ taskId: other.id, paths })).rejects.toThrow(NotFoundError);
    boards.archiveBoard(board.id);
    await expect(files.addAttachments({ taskId: task.id, paths })).rejects.toThrow(RuleViolationError);
    await expect(files.pickAttachments(task.id)).rejects.toThrow(RuleViolationError);
    await expect(
      files.addAttachmentData({ taskId: task.id, fileName: '', mimeType: 'image/png', bytes: bytes(1) }),
    ).rejects.toThrow(RuleViolationError);
    expect(repos.testing.storedFiles.size).toBe(0);
  });

  it('works on sub-tasks', async () => {
    const { task } = seeded();
    const sub = tasks.createTask({ parentId: task.id, title: 'Sous-tâche' });
    await files.addAttachments({ taskId: sub.id, paths: ['/Users/alice/photo.png'] });
    expect(tasks.listSubtasks(task.id)[0]!.attachmentCount).toBe(1);
    expect(tasks.getTask(task.id).attachmentCount).toBe(0);
  });

  it('adds the files picked in the dialog, nothing when it is cancelled', async () => {
    const { task } = seeded();
    expect(await files.pickAttachments(task.id)).toEqual({ attachments: [], failures: [] });
    repos.testing.shellState.picked = ['/Users/alice/Rapport.pdf'];
    const out = await files.pickAttachments(task.id);
    expect(out.attachments.map((a) => a.fileName)).toEqual(['Rapport.pdf']);
  });

  it('names a pasted image after its type and keeps a given name', async () => {
    const { task } = seeded();
    const pasted = await files.addAttachmentData({
      taskId: task.id,
      fileName: '',
      mimeType: 'image/png',
      bytes: bytes(1, 2),
    });
    expect(pasted).toMatchObject({ fileName: 'image.png', mimeType: 'image/png', sizeBytes: 2 });
    expect(repos.testing.storedFiles.get(`${pasted.id}.png`)).toEqual(bytes(1, 2));
    const named = await files.addAttachmentData({
      taskId: task.id,
      fileName: 'capture',
      mimeType: 'IMAGE/PNG',
      bytes: bytes(1),
    });
    expect(named.fileName).toBe('capture.png');
    // Another extension of the same type is kept for display; the stored one is the type's own.
    const jpeg = await files.addAttachmentData({
      taskId: task.id,
      fileName: '../../x/photo.jpeg',
      mimeType: 'image/jpeg',
      bytes: bytes(1),
    });
    expect(jpeg).toMatchObject({ fileName: 'photo.jpeg', mimeType: 'image/jpeg' });
    expect(repos.testing.storedFiles.has(`${jpeg.id}.jpg`)).toBe(true);
  });

  it('takes the stored extension from the mime type, never from the given name', async () => {
    const { task } = seeded();
    const disguised = await files.addAttachmentData({
      taskId: task.id,
      fileName: 'invoice.pdf.exe',
      mimeType: 'image/gif',
      bytes: bytes(1),
    });
    expect(disguised).toMatchObject({ fileName: 'invoice.pdf.gif', mimeType: 'image/gif' });
    expect([...repos.testing.storedFiles.keys()]).toEqual([`${disguised.id}.gif`]);
    const mismatched = await files.addAttachmentData({
      taskId: task.id,
      fileName: 'shot.png',
      mimeType: 'image/jpeg',
      bytes: bytes(1),
    });
    expect(mismatched.fileName).toBe('shot.jpg');
    expect(repos.testing.storedFiles.has(`${mismatched.id}.jpg`)).toBe(true);
  });

  it('refuses pasted data that is not a known raster image, before writing anything', async () => {
    const { task } = seeded();
    for (const mimeType of [
      'image/svg+xml',
      'application/pdf',
      'application/x-msdownload',
      'text/html',
      'image/x-unknown',
      'not a type',
      '',
    ]) {
      await expect(
        files.addAttachmentData({ taskId: task.id, fileName: 'a.png', mimeType, bytes: bytes(1) }),
        mimeType,
      ).rejects.toThrow(InvalidInputError);
    }
    expect(repos.testing.storedFiles.size).toBe(0);
  });

  it('refuses device paths, and network paths unless picked in the dialog', async () => {
    const { task } = seeded();
    const device = ['\\\\?\\C:\\x.pdf', '\\\\.\\pipe\\x', '//./COM1', '//?/C:/x.pdf', '\\??\\C:\\x.pdf'];
    const network = ['\\\\server\\share\\a.pdf', '//server/share/a.pdf'];
    for (const path of [...device, ...network, '/Users/alice/photo.png']) {
      repos.testing.outsideFiles.set(path, bytes(1));
    }
    const added = await files.addAttachments({
      taskId: task.id,
      paths: [...device, ...network, '/Users/alice/photo.png'],
    });
    expect(added.attachments).toHaveLength(1);
    expect(added.failures.map((f) => f.message)).toEqual([
      ...device.map(() => 'Device paths are not supported'),
      ...network.map(() => 'Network paths are not supported'),
    ]);

    repos.testing.shellState.picked = [...network, device[0]!];
    const picked = await files.pickAttachments(task.id);
    expect(picked.attachments).toHaveLength(2);
    expect(picked.failures.map((f) => f.message)).toEqual(['Device paths are not supported']);
  });

  it('classifies source paths', () => {
    expect(sourcePathProblem('C:\\Users\\a.pdf', false)).toBeNull();
    expect(sourcePathProblem('/Users/alice/a.pdf', false)).toBeNull();
    expect(sourcePathProblem('\\\\server\\share', true)).toBeNull();
    expect(sourcePathProblem('\\/server/share', false)).toBe('Network paths are not supported');
    expect(sourcePathProblem('\\\\?', true)).toBe('Device paths are not supported');
    expect(sourcePathProblem('\\\\.\\', true)).toBe('Device paths are not supported');
  });
});

describe('using and deleting attachments', () => {
  async function withFile() {
    const { task } = seeded();
    const out = await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/Rapport.pdf'] });
    return { task, file: out.attachments[0]! };
  }

  it('opens and reveals the stored file, reporting the system error', async () => {
    const { file } = await withFile();
    expect(await files.openAttachment(file.id)).toEqual({ opened: true });
    expect(await files.revealAttachment(file.id)).toEqual({});
    const path = `/data/attachments/${file.id}.pdf`;
    expect(repos.testing.shellCalls).toEqual({ opened: [path], revealed: [path] });
    repos.testing.shellState.openError = 'No application knows how to open this file';
    await expect(files.openAttachment(file.id)).rejects.toThrow(/No application/);
  });

  it('never runs a program or a script: it is shown in the folder instead', async () => {
    const { task } = seeded();
    repos.testing.outsideFiles.set('/Users/alice/setup.exe', bytes(1));
    repos.testing.outsideFiles.set('C:\\Dl\\Facture.PDF.Lnk', bytes(1));
    repos.testing.outsideFiles.set('/Users/alice/install.command', bytes(1));
    const added = await files.addAttachments({
      taskId: task.id,
      paths: ['/Users/alice/setup.exe', 'C:\\Dl\\Facture.PDF.Lnk', '/Users/alice/install.command'],
    });
    for (const file of added.attachments) {
      expect(await files.openAttachment(file.id), file.fileName).toEqual({ opened: false });
    }
    // A row whose display name looks harmless but whose stored file is a program.
    const [exe] = added.attachments;
    repos.attachments.insert({
      ...repos.attachments.findById(exe!.id)!,
      id: 'renamed',
      fileName: 'Rapport.pdf',
    });
    expect(await files.openAttachment('renamed')).toEqual({ opened: false });
    expect(repos.testing.shellCalls.opened).toEqual([]);
    expect(repos.testing.shellCalls.revealed).toHaveLength(4);
    expect(repos.testing.shellCalls.revealed[0]).toBe(`/data/attachments/${exe!.id}.exe`);
  });

  it('reports a missing file or attachment as not found', async () => {
    const { file } = await withFile();
    repos.testing.storedFiles.clear();
    await expect(files.openAttachment(file.id)).rejects.toThrow(NotFoundError);
    await expect(files.revealAttachment(file.id)).rejects.toThrow(NotFoundError);
    await expect(files.openAttachment('nope')).rejects.toThrow(NotFoundError);
  });

  it('deletes the row then the file; a file already gone is only logged', async () => {
    const { task, file } = await withFile();
    expect(await files.deleteAttachment(file.id)).toEqual({ id: file.id });
    expect(files.listAttachments(task.id)).toEqual([]);
    expect(repos.testing.storedFiles.size).toBe(0);
    expect(tasks.getTask(task.id).attachmentCount).toBe(0);
    await expect(files.deleteAttachment(file.id)).rejects.toThrow(NotFoundError);

    const again = await withFile();
    repos.testing.storedFiles.clear();
    expect(await files.deleteAttachment(again.file.id)).toEqual({ id: again.file.id });
    expect(warnings).toEqual([`[attachments] file of ${again.file.id} was already gone`]);
  });

  it('keeps the files of a task sent to the trash', async () => {
    const { task, file } = await withFile();
    tasks.deleteTask(task.id);
    expect(repos.testing.storedFiles.has(`${file.id}.pdf`)).toBe(true);
    expect(repos.testing.allAttachments()).toHaveLength(1);
    expect(() => files.listAttachments(task.id)).toThrow(NotFoundError);
  });

  it('serves only known attachments, inside the folder', async () => {
    const { file } = await withFile();
    expect(files.servedFile(file.id)).toEqual({
      absolutePath: `/data/attachments/${file.id}.pdf`,
      mimeType: 'application/pdf',
    });
    expect(files.servedFile('nope')).toBeNull();
    repos.attachments.insert({
      ...repos.attachments.findById(file.id)!,
      id: 'evil',
      storedPath: '../../etc/passwd',
    });
    expect(files.servedFile('evil')).toBeNull();
  });
});

describe('orphan files', () => {
  it('removes old files without a row, keeps recent ones and the files of trashed tasks', async () => {
    const { task } = seeded();
    const { attachments } = await files.addAttachments({
      taskId: task.id,
      paths: ['/Users/alice/photo.png'],
    });
    const kept = `${attachments[0]!.id}.png`;
    const now = deps.clock.now();
    const old = now - ORPHAN_MIN_AGE_MS;
    repos.testing.storedModifiedAt.set(kept, old - 1);
    repos.testing.storedFiles.set('orphan-old.pdf', bytes(1));
    repos.testing.storedModifiedAt.set('orphan-old.pdf', old);
    repos.testing.storedFiles.set('orphan-recent.pdf', bytes(1));
    repos.testing.storedModifiedAt.set('orphan-recent.pdf', old + 1);
    tasks.deleteTask(task.id);

    expect(await files.sweepOrphanFiles()).toBe(1);
    expect([...repos.testing.storedFiles.keys()].sort()).toEqual([kept, 'orphan-recent.pdf'].sort());
  });

  it('logs a file it cannot remove and goes on', async () => {
    seeded();
    for (const name of ['a.pdf', 'b.pdf']) repos.testing.storedFiles.set(name, bytes(1));
    repos.testing.failures.remove.add('a.pdf');
    expect(await files.sweepOrphanFiles()).toBe(1);
    expect(warnings).toEqual(['[attachments] could not remove the orphan file a.pdf']);
    expect([...repos.testing.storedFiles.keys()]).toEqual(['a.pdf']);
  });
});

describe('notes', () => {
  const doc = (...texts: string[]) => ({
    type: 'doc' as const,
    content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  });

  it('stores the document with its derived text, and reads it back', () => {
    const { task } = seeded();
    expect(tasks.getDescription(task.id)).toEqual({ id: task.id, json: null, updatedAt: task.updatedAt });
    deps.setNow(deps.clock.now() + 5);
    const saved = tasks.updateDescription({ id: task.id, json: doc('Relire', 'le contrat') });
    expect(saved).toEqual({ id: task.id, json: doc('Relire', 'le contrat'), updatedAt: deps.clock.now() });
    expect(repos.testing.taskRow(task.id)).toMatchObject({
      descriptionJson: JSON.stringify(doc('Relire', 'le contrat')),
      descriptionText: 'Relire\nle contrat',
      updatedAt: deps.clock.now(),
    });
    expect(tasks.getDescription(task.id)).toEqual(saved);
    expect(tasks.getTask(task.id).updatedAt).toBe(deps.clock.now());
  });

  it('stores an empty document as no notes, but keeps a note made of an image', () => {
    const { task } = seeded();
    tasks.updateDescription({ id: task.id, json: doc('x') });
    expect(
      tasks.updateDescription({ id: task.id, json: { type: 'doc', content: [{ type: 'paragraph' }] } }).json,
    ).toBeNull();
    expect(repos.testing.taskRow(task.id)).toMatchObject({ descriptionJson: null, descriptionText: null });
    const image = { type: 'doc' as const, content: [{ type: 'image', attrs: { attachmentId: 'a' } }] };
    expect(tasks.updateDescription({ id: task.id, json: image }).json).toEqual(image);
    expect(repos.testing.taskRow(task.id)).toMatchObject({ descriptionText: '' });
    expect(tasks.updateDescription({ id: task.id, json: null }).json).toBeNull();
  });

  it('works on sub-tasks and refuses deleted tasks', () => {
    const { task } = seeded();
    const sub = tasks.createTask({ parentId: task.id, title: 'Sous-tâche' });
    expect(tasks.updateDescription({ id: sub.id, json: doc('Sub') }).json).toEqual(doc('Sub'));
    tasks.deleteTask(task.id);
    expect(() => tasks.getDescription(sub.id)).toThrow(NotFoundError);
    expect(() => tasks.updateDescription({ id: task.id, json: doc('x') })).toThrow(NotFoundError);
  });

  it('refuses notes nested deeper than 64 levels, before touching the task', () => {
    const { task } = seeded();
    const nested = (levels: number) => {
      // `levels` nodes deep, the doc included.
      let node: { type: string; content?: unknown[]; text?: string } = { type: 'text', text: 'x' };
      for (let i = 2; i < levels; i += 1) node = { type: 'blockquote', content: [node] };
      return { type: 'doc' as const, content: [node] };
    };
    expect(tasks.updateDescription({ id: task.id, json: nested(64) }).json).toEqual(nested(64));
    const before = repos.testing.taskRow(task.id)?.descriptionJson;
    for (const levels of [65, 100_000]) {
      expect(() => tasks.updateDescription({ id: task.id, json: nested(levels) })).toThrow(InvalidInputError);
    }
    expect(repos.testing.taskRow(task.id)?.descriptionJson).toBe(before);
  });

  it('allows notes and attachment deletion on an archived board (never shown, harmless)', async () => {
    const { board, task } = seeded();
    const [png] = (await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/photo.png'] }))
      .attachments;
    boards.archiveBoard(board.id);
    expect(tasks.updateDescription({ id: task.id, json: doc('Archivé') }).json).toEqual(doc('Archivé'));
    expect(await files.deleteAttachment(png!.id)).toEqual({ id: png!.id });
  });

  it('reads unreadable stored notes as no notes', () => {
    const { task } = seeded();
    repos.testing.describeTask(task.id, '{oops', 'x');
    expect(tasks.getDescription(task.id).json).toBeNull();
  });
});

describe('board duplication with attachments', () => {
  it('copies the files of the copied tasks and points the copied notes to them', async () => {
    const { board, task } = seeded();
    const sub = tasks.createTask({ parentId: task.id, title: 'Sous-tâche' });
    const [pdf, png] = (
      await files.addAttachments({
        taskId: task.id,
        paths: ['/Users/alice/Rapport.pdf', '/Users/alice/photo.png'],
      })
    ).attachments;
    const subFile = await files.addAttachmentData({
      taskId: sub.id,
      fileName: '',
      mimeType: 'image/png',
      bytes: bytes(7),
    });
    const note = {
      type: 'doc' as const,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Voir' }] },
        { type: 'image', attrs: { attachmentId: png!.id, width: 50 } },
        { type: 'image', attrs: { attachmentId: 'gone' } },
      ],
    };
    tasks.updateDescription({ id: task.id, json: note });

    const copy = await boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    const [copyTask] = boards.getBoard(copy.id).tasks;
    expect(copyTask!.attachmentCount).toBe(2);
    const copied = files.listAttachments(copyTask!.id);
    expect(copied.map((a) => [a.fileName, a.sizeBytes])).toEqual([
      ['Rapport.pdf', 3],
      ['photo.png', 1],
    ]);
    expect(copied.some((a) => a.id === pdf!.id || a.id === png!.id)).toBe(false);
    for (const a of copied)
      expect(repos.testing.storedFiles.has(`${a.id}.${a.fileName.split('.')[1]}`)).toBe(true);
    const copySub = tasks.listSubtasks(copyTask!.id)[0]!;
    expect(files.listAttachments(copySub.id).map((a) => a.fileName)).toEqual([subFile.fileName]);

    const copiedNote = tasks.getDescription(copyTask!.id).json;
    expect(copiedNote?.content?.[1]).toEqual({
      type: 'image',
      attrs: { attachmentId: copied[1]!.id, width: 50 },
    });
    expect(copiedNote?.content?.[2]).toEqual({ type: 'image', attrs: { attachmentId: 'gone' } });
    expect(repos.testing.taskRow(copyTask!.id)?.descriptionText).toBe('Voir');
    // The original is untouched.
    expect(tasks.getDescription(task.id).json).toEqual(note);
    expect(files.listAttachments(task.id).map((a) => a.id)).toEqual([pdf!.id, png!.id]);
  });

  it('skips a file it cannot copy: its images point to an id without a row', async () => {
    const { board, task } = seeded();
    const [png] = (await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/photo.png'] }))
      .attachments;
    repos.testing.failures.copy.add(`${png!.id}.png`);
    tasks.updateDescription({
      id: task.id,
      json: { type: 'doc', content: [{ type: 'image', attrs: { attachmentId: png!.id } }] },
    });
    const copy = await boards.duplicateBoard({ id: board.id, name: 'Copie', includeTasks: true });
    const [copyTask] = boards.getBoard(copy.id).tasks;
    expect(copyTask!.attachmentCount).toBe(0);
    const image = tasks.getDescription(copyTask!.id).json?.content?.[0] as {
      attrs: { attachmentId: string };
    };
    expect(image.attrs.attachmentId).not.toBe(png!.id);
    expect(repos.attachments.findById(image.attrs.attachmentId)).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it('copies no file without the tasks, and removes the copies when the rows cannot be written', async () => {
    const { board, task } = seeded();
    await files.addAttachments({ taskId: task.id, paths: ['/Users/alice/photo.png'] });
    await boards.duplicateBoard({ id: board.id, name: 'Bare', includeTasks: false });
    expect(repos.testing.storedFiles.size).toBe(1);

    repos.attachments.insertMany = () => {
      throw new Error('boom');
    };
    await expect(boards.duplicateBoard({ id: board.id, name: 'Full', includeTasks: true })).rejects.toThrow(
      'boom',
    );
    expect(repos.testing.storedFiles.size).toBe(1);
  });
});
