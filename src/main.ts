import { fileURLToPath } from 'node:url'
import { app, ipcMain, session as _session } from 'electron'
import { type Session } from 'electron'

import { BaseConf } from './conf'

import type { ConfOptions } from './types'

type Action = 'get' | 'set' | 'has' | 'reset' | 'delete' | 'clear'

export class Conf<
  T extends Record<string, any> = Record<string, unknown>
> extends BaseConf<T> {
  constructor(options: ConfOptions<T> = {}) {
    options.dir = options.dir || app.getPath('userData')

    super(options)
  }

  /**
   * Register the config ipc handler for use by renderer.
   */

  /**
   * Register the config ipc handler for use by renderer.
   * @param name The name used to define the renderer process Conf. Default to `config`.
   */
  registerRendererListener(name?: string): void {
    const channel = `__electron_conf_${name || this.name}_handler__`
    if (!ipcMain.eventNames().some((e) => e === channel)) {
      ipcMain.handle(
        channel,
        (_, action: Action, key: any, value?: unknown) => {
          if (action === 'get') {
            return this.get(key, value)
          }

          if (action === 'set') {
            this.set(key, value)
            return
          }

          if (action === 'has') {
            return this.has(key)
          }

          if (action === 'reset') {
            this.reset(key)
            return
          }

          if (action === 'delete') {
            this.delete(key)
            return
          }

          if (action === 'clear') {
            this.clear()
            return
          }

          return
        }
      )
    }
  }
}

export type { ConfOptions, Serializer, JSONSchema, Migration } from './types'

type Options = {
  /**
   * Attach ES module preload script.
   *
   * @default false
   */
  esModule: boolean
}

/**
 * Use Electron config for the specified session.
 */
export function useConf(
  session: Session = _session.defaultSession,
  options: Options = { esModule: false }
): void {
  session.setPreloads([
    ...session.getPreloads(),
    fileURLToPath(
      new URL(
        options.esModule
          ? 'electron-conf-preload.mjs'
          : 'electron-conf-preload.cjs',
        import.meta.url
      )
    )
  ])
}
