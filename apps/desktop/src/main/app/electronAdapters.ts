import { ATTACHMENT_PROTOCOL } from '@ordo/contracts';
import { BrowserWindow, dialog, protocol, shell } from 'electron';
import type { ServedFile } from '../application/attachments';
import type { DesktopShell } from '../application/ports';
import { ATTACHMENT_SCHEME_PRIVILEGES, serveAttachment } from './attachmentProtocol';

/** Must run before the app is ready. */
export function registerAttachmentScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ATTACHMENT_PROTOCOL, privileges: ATTACHMENT_SCHEME_PRIVILEGES },
  ]);
}

/** Serves `ordo-file://attachment/<id>` on the default session (the one the window uses). */
export function handleAttachmentProtocol(lookup: (id: string) => ServedFile | null): void {
  protocol.handle(ATTACHMENT_PROTOCOL, (request) => serveAttachment(request, lookup));
}

export const electronShell: DesktopShell = {
  pickFiles: async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const options: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'] };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  },
  openPath: (absolutePath) => shell.openPath(absolutePath),
  showItemInFolder: (absolutePath) => shell.showItemInFolder(absolutePath),
};
