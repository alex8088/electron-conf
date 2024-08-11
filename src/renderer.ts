import type { ConfAPI } from './types'

type ConfOptions = {
  /**
   * The configuration file name should be the name of the listener
   * registered by the main process.
   *
   * @default 'config'
   */
  name?: string
}

export class Conf<T extends Record<string, any> = Record<string, unknown>> {
  private api: ConfAPI
  private channel: string

  constructor(options: ConfOptions = {}) {
    const { name = 'config' } = options

    this.channel = `__electron_conf_${name}_handler__`

    this.api =
      (globalThis || window).__ELECTRON_CONF__ ||
      (globalThis || window).electron
  }

  /**
   * Get an item.
   * @param key The key of the item to get.
   * @param defaultValue The default value if the item does not exist.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/renderer'
   *
   * const conf = new Conf()
   *
   * await conf.get('foo')
   * await conf.get('a.b')
   * ```
   */
  get<K extends keyof T>(key: K): Promise<T[K]>
  get<K extends keyof T>(
    key: K,
    defaultValue: Required<T>[K]
  ): Promise<Required<T>[K]>
  get<K extends string, V = unknown>(
    key: Exclude<K, keyof T>,
    defaultValue?: V
  ): Promise<V>
  get(key: string, defaultValue?: unknown): Promise<unknown>
  get(key: string, defaultValue?: unknown): Promise<unknown> {
    return this.api.ipcRenderer.invoke(this.channel, 'get', key, defaultValue)
  }

  /**
   * Set an item or multiple items at once.
   *
   * @param key The key of the item or a hashmap of items to set at once.
   * @param value Must be JSON serializable. Trying to set the type `undefined`, `function`, or `symbol` will result in a `TypeError`.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/renderer'
   *
   * const conf = new Conf()
   *
   * await conf.set('foo', 1)
   * await conf.set('a.b', 2)
   * await conf.set({ foo: 1, a: { b: 2 }})
   * ```
   */
  set<K extends keyof T>(key: K, value?: T[K]): Promise<void>
  set(key: string, value: unknown): Promise<void>
  set(object: Partial<T>): Promise<void>
  set<K extends keyof T>(
    key: Partial<T> | K | string,
    value?: T[K] | unknown
  ): Promise<void>
  set<K extends keyof T>(
    key: Partial<T> | K | string,
    value?: T[K] | unknown
  ): Promise<void> {
    return this.api.ipcRenderer.invoke(this.channel, 'set', key, value)
  }

  /**
   * Check if an item exists.
   * @param key The key of the item to check.
   */
  has<Key extends keyof T>(key: Key | string): Promise<boolean> {
    return this.api.ipcRenderer.invoke(this.channel, 'has', key)
  }

  /**
   * Reset items to their default values, as defined by the `defaults` or `schema` option.
   * @param keys The keys of the items to reset.
   */
  reset<Key extends keyof T>(...keys: Key[]): Promise<void> {
    return this.api.ipcRenderer.invoke(this.channel, 'reset', keys)
  }

  /**
   * Delete an item.
   * @param key The key of the item to delete.
   */
  delete<Key extends keyof T>(key: Key): Promise<void>
  delete(key: string): Promise<void>
  delete(key: string): Promise<void> {
    return this.api.ipcRenderer.invoke(this.channel, 'delete', key)
  }

  /**
   * Delete all items. This resets known items to their default values, if
   * defined by the `defaults` or `schema` option.
   */
  clear(): Promise<void> {
    return this.api.ipcRenderer.invoke(this.channel, 'clear')
  }
}
