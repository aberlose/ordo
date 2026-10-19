import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { isExternalUrl } from './externalLinks';

const devServerUrl = process.env['ELECTRON_RENDERER_URL'];

/** URL prefix the renderer is allowed to run from (used to check IPC senders). */
export const trustedOrigin = (): string => devServerUrl ?? 'file://';

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

  // No navigation away from the app, no new windows. Links of the notes (`window.open`) open in the
  // system browser or mail app when they are http(s) or mailto; anything else is dropped.
  window.webContents.on('will-navigate', (event, url) => {
    if (!devServerUrl || !url.startsWith(devServerUrl)) event.preventDefault();
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
