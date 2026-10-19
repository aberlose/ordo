import { isChannel } from '@ordo/contracts/channels';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { OrdoApi } from '@ordo/contracts';

/** The only bridge between the sandboxed renderer and the main process. */
const api: OrdoApi = {
  invoke: (channel, input) => {
    if (!isChannel(channel)) return Promise.reject(new Error(`Unknown channel ${String(channel)}`));
    return ipcRenderer.invoke(channel, input);
  },
  // The only other entry point: the path of a dropped file, which the sandboxed page cannot read itself.
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file as File);
    } catch {
      return '';
    }
  },
};

contextBridge.exposeInMainWorld('api', api);
