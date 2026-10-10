import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { makeBoardUseCases } from './application/boards';
import { createMainWindow, trustedOrigin } from './app/window';
import { openDatabase } from './infrastructure/db/client';
import { sqliteTransactor } from './infrastructure/db/transactor';
import { systemClock, uuidv7Generator } from './infrastructure/ids';
import { boardRepository } from './infrastructure/repositories/boardRepository';
import { columnRepository } from './infrastructure/repositories/columnRepository';
import { createHandlers } from './ipc/handlers';
import { registerHandlers } from './ipc/handle';

/** Composition root: the only place where infrastructure is wired into use cases and IPC. */

function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(app.getAppPath(), 'src/main/infrastructure/db/migrations');
}

// End-to-end tests run against a throwaway data folder (never in a packaged build).
const testDataDir = process.env['ORDO_USER_DATA'];
if (testDataDir && !app.isPackaged) app.setPath('userData', testDataDir);

// One instance only: a second launch focuses the first one and exits before touching the database.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

function start(): void {
  const dataFile = join(app.getPath('userData'), 'ordo.db');
  const database = openDatabase(dataFile, migrationsFolder());
  app.on('will-quit', () => database.close());

  const boards = makeBoardUseCases({
    boards: boardRepository(database.db),
    columns: columnRepository(database.db),
    tx: sqliteTransactor(database.sqlite),
    clock: systemClock,
    ids: uuidv7Generator(),
  });

  registerHandlers(
    ipcMain,
    createHandlers(boards, () => ({
      version: app.getVersion(),
      platform: process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux',
      dataPath: dataFile,
    })),
    trustedOrigin,
  );

  createMainWindow();

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
