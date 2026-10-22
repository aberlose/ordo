import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { makeAttachmentUseCases } from './application/attachments';
import { makeBoardUseCases } from './application/boards';
import { makeColumnUseCases } from './application/columns';
import { makeSearchUseCases } from './application/search';
import { makeTagUseCases } from './application/tags';
import { makeTaskUseCases } from './application/tasks';
import { electronShell, handleAttachmentProtocol, registerAttachmentScheme } from './app/electronAdapters';
import { createMainWindow, trustedOrigin } from './app/window';
import { openDatabase } from './infrastructure/db/client';
import { sqliteTransactor } from './infrastructure/db/transactor';
import { attachmentStorage } from './infrastructure/fs/attachmentStorage';
import { systemClock, uuidv7Generator } from './infrastructure/ids';
import { attachmentRepository } from './infrastructure/repositories/attachmentRepository';
import { boardRepository } from './infrastructure/repositories/boardRepository';
import { columnRepository } from './infrastructure/repositories/columnRepository';
import { searchRepository } from './infrastructure/repositories/searchRepository';
import { settingRepository } from './infrastructure/repositories/settingRepository';
import { tagRepository } from './infrastructure/repositories/tagRepository';
import { taskRepository } from './infrastructure/repositories/taskRepository';
import { createHandlers } from './ipc/handlers';
import { registerHandlers } from './ipc/handle';

/** Composition root: the only place where infrastructure is wired into use cases and IPC. */

/** The orphan file sweep waits a little after the window shows, so the first paint has the CPU. */
const ORPHAN_SWEEP_DELAY_MS = 3_000;

function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(app.getAppPath(), 'src/main/infrastructure/db/migrations');
}

// End-to-end tests run against a throwaway data folder (never in a packaged build).
const testDataDir = process.env['ORDO_USER_DATA'];
if (testDataDir && !app.isPackaged) app.setPath('userData', testDataDir);

// `ordo-file://attachment/<id>` serves attachment files; schemes must be privileged before ready.
registerAttachmentScheme();

// One instance only: a second launch focuses the first one and exits before touching the database.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

function start(): void {
  const dataFile = join(app.getPath('userData'), 'ordo.db');
  const database = openDatabase(dataFile, migrationsFolder());
  app.on('will-quit', () => database.close());

  const boardRepo = boardRepository(database.db);
  const ports = {
    boards: boardRepo,
    columns: columnRepository(database.db),
    tasks: taskRepository(database.db),
    tags: tagRepository(database.db),
    attachments: attachmentRepository(database.db),
    search: searchRepository(database.db),
    settings: settingRepository(database.db),
    storage: attachmentStorage(join(app.getPath('userData'), 'attachments')),
    shell: electronShell,
    tx: sqliteTransactor(database.sqlite),
    clock: systemClock,
    ids: uuidv7Generator(),
    log: { warn: (message: string, error?: unknown) => console.warn(message, error ?? '') },
  };
  const boards = makeBoardUseCases(ports);
  const tasks = makeTaskUseCases(ports);
  const columns = makeColumnUseCases(ports);
  const tags = makeTagUseCases(ports);
  const attachments = makeAttachmentUseCases(ports);
  const search = makeSearchUseCases(ports);
  handleAttachmentProtocol((id) => attachments.servedFile(id));

  registerHandlers(
    ipcMain,
    createHandlers(boards, tasks, columns, tags, attachments, search, () => ({
      version: app.getVersion(),
      platform: process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux',
      dataPath: dataFile,
    })),
    trustedOrigin,
  );

  const window = createMainWindow();
  // Housekeeping off the startup path: once the window shows, remove old files without a row.
  window.once('show', () => {
    setTimeout(() => {
      attachments
        .sweepOrphanFiles()
        .catch((error: unknown) => console.warn('[attachments] orphan sweep failed', error));
    }, ORPHAN_SWEEP_DELAY_MS);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

app
  .whenReady()
  .then(start)
  .catch((error: unknown) => {
    console.error('[startup]', error);
    dialog.showErrorBox('Ordo', `Ordo n'a pas pu démarrer / Ordo could not start.\n\n${String(error)}`);
    app.exit(1);
  });

app.on('second-instance', () => {
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
