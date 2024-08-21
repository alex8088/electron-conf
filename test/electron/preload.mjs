import { contextBridge, ipcRenderer } from 'electron/renderer'

import { exposeConf } from '../../dist/preload.mjs'

exposeConf()

try {
  contextBridge.exposeInMainWorld('api', {
    did: (arg) => ipcRenderer.send('did', arg)
  })
} catch (error) {
  console.error(error)
}
