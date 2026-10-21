import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { isExternalUrl } from './externalLinks';
import { flushRenderer, isSameOrigin } from './windowGuards';

const devServerUrl = process.env['ELECTRON_RENDERER_URL'];

/** URL prefix the renderer is allowed to run from (used to check IPC senders). */
export const trustedOrigin = (): string => devServerUrl ?? 'file://';

// Set when the app is quitting (menu, Cmd+Q, end of session): after the flush, quit again rather
// than only closing the window (on macOS the app would otherwise stay open without a window).
let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Ordo',
    backgroundColor: '#F2F6FF',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Offline by construction: the spellchecker would download dictionaries on some platforms.
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Notes typed just before closing are still in the renderer's debounce: let it save them first.
  let flushed = false;
  let flushing = false;
  window.on('close', (event) => {
    if (flushed) return;
    event.preventDefault();
    if (flushing) return;
    flushing = true;
    void flushRenderer(window.webContents).finally(() => {
      flushed = true;
      if (quitting) app.quit();
      else if (!window.isDestroyed()) window.close();
    });
  });

  // No navigation away from the app, no new windows. Links of the notes (`window.open`) open in the
  // system browser or mail app when they are http(s) or mailto; anything else is dropped.
  window.webContents.on('will-navigate', (event, url) => {
    if (!devServerUrl || !isSameOrigin(url, devServerUrl)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell
        .openExternal(url)
        .catch((error: unknown) => console.warn('[window] could not open a link', error));
    }
    return { action: 'deny' };
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return window;
}
