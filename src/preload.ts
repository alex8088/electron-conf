import { contextBridge, ipcRenderer } from 'electron'

import type { ConfAPI } from './types'

const api: ConfAPI = {
  ipcRenderer: {
    invoke(channel, ...args) {
      return ipcRenderer.invoke(channel, ...args)
    }
  }
}

/**
 * Expose config in the specified preload script.
 */
export function exposeConf(): void {
  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld(`__ELECTRON_CONF__`, api)
    } catch (error) {
      console.error(error)
    }
  } else {
    // @ts-ignore (need dts)
    window.__ELECTRON_CONF__ = api
  }
}
