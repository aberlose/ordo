import { isChannel } from '@ordo/contracts/channels';
import { contextBridge, ipcRenderer } from 'electron';
import type { OrdoApi } from '@ordo/contracts';

/** The only bridge between the sandboxed renderer and the main process. */
const api: OrdoApi = {
  invoke: (channel, input) => {
    if (!isChannel(channel)) return Promise.reject(new Error(`Unknown channel ${String(channel)}`));
    return ipcRenderer.invoke(channel, input);
  },
};

contextBridge.exposeInMainWorld('api', api);
