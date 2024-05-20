import { contextBridge, ipcRenderer } from 'electron/renderer'

import { exposeConf } from '../../dist/preload.mjs'

exposeConf()

try {
  contextBridge.exposeInMainWorld('api', {
    did: () => ipcRenderer.send('did')
  })
} catch (error) {
  console.error(error)
}
