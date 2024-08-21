import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import TestRPC from './test.mjs'
import { Conf } from '../../dist/main.mjs'

app.name = 'electron-conf'

function createWindow() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(import.meta.dirname, './preload.mjs'),
        sandbox: false
      }
    })

    win.loadFile(join(import.meta.dirname, './index.html'))

    ipcMain.once('did', (_, arg) => {
      resolve(arg)
      win.close()
    })
  })
}

app.whenReady().then(() => {
  const conf = new Conf()
  conf.registerRendererListener()
  conf.set('foo', 1)

  const rpc = new TestRPC()

  rpc.ready()

  rpc.register('electron_user_data_dir', () => {
    return app.getPath('userData')
  })

  rpc.register('config_file_path', () => {
    return conf.fileName
  })

  rpc.register('renderer', async () => {
    const zoo = await createWindow()
    return {
      baz: conf.get('bar.baz'),
      zoo
    }
  })
})
