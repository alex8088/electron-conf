/*
 * The core code was conceived by sindresorhus and is taken from the following repository:
 * https://github.com/sindresorhus/conf/blob/main/source/index.ts
 * license: https://github.com/sindresorhus/conf/blob/main/license
 */

import path from 'node:path'
import fs from 'node:fs'
import Ajv from 'ajv'
import { writeFileSync as atomicWriteFileSync } from 'atomically'
import { getProperty, hasProperty, setProperty, deleteProperty } from 'dot-prop'

import {
  deepEqual,
  createPlainObject,
  cloneObject,
  mergeObject,
  deepCloneObject
} from './utils'

import type {
  Options,
  Serializer,
  ValidateFn,
  Migration,
  OnDidChangeCallback,
  OnDidAnyChangeCallback,
  Unsubscribe
} from './types'

const JsonSerializer: Serializer<any> = {
  read: (value): any => JSON.parse(value),
  write: (value): string => JSON.stringify(value, undefined, '\t')
}

const INTERNAL_KEY = '__internal__'
const MIGRATION_KEY = `${INTERNAL_KEY}.migrationVersion`

const BAN_TYPES = new Set(['undefined', 'symbol', 'function'])

export class BaseConf<T extends Record<string, any> = Record<string, unknown>>
  implements Iterable<[keyof T, T[keyof T]]>
{
  /**
   * Configuration file name without extension.
   */
  readonly name: string
  /**
   * Configuration file path.
   */
  readonly fileName: string
  readonly events: EventTarget

  private _store?: T

  private dir: string

  private serializer: Serializer<T>
  private validator?: ValidateFn
  defaultValues: Partial<T> = {}

  constructor(options: Options<T> = {}) {
    const {
      dir = process.cwd(),
      name = 'config',
      ext = '.json',
      serializer,
      schema,
      defaults,
      migrations
    } = options

    this.dir = dir
    this.name = name

    this.fileName = path.join(dir, `${name}${ext}`)

    this.events = new EventTarget()

    this.serializer = serializer || JsonSerializer

    if (schema) {
      this.validator = new Ajv({ allErrors: true }).compile(schema)
    }

    // call the getter to read the store file.
    const fileStore = this.store

    if (defaults) {
      this.defaultValues = { ...defaults }

      const store = mergeObject<T>(deepCloneObject(defaults), fileStore)
      this.validate(store)

      if (!deepEqual(fileStore, store)) {
        this.store = store
      }
    }

    this.migrate(migrations)
  }

  *[Symbol.iterator](): IterableIterator<[keyof T, T[keyof T]]> {
    for (const [key, value] of Object.entries(this.store)) {
      yield [key, value]
    }
  }

  get store(): T {
    if (this._store) {
      return cloneObject(this._store)
    }

    this._store = this.read()
    this.validate(this._store)
    return this._store
  }

  set store(value: T) {
    this.validate(value)
    this.write(value)

    this._store = value

    this.events.dispatchEvent(new Event('change'))
  }

  private migrate(migrations?: Migration<T>[]): void {
    if (migrations && migrations.length) {
      let version: number = getProperty(this.store, MIGRATION_KEY, 0)
      const _migrations = migrations
        .sort((a, b) => a.version - b.version)
        .filter((m) => m.version > version)

      for (const migration of _migrations) {
        migration.hook(this, version)

        const { store } = this
        setProperty(store, MIGRATION_KEY, migration.version)

        version = migration.version

        this.store = store
      }
    }
  }

  /**
   * Get an item.
   * @param key The key of the item to get.
   * @param defaultValue The default value if the item does not exist.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/main'
   *
   * const conf = new Conf()
   *
   * conf.get('foo')
   * conf.get('a.b')
   * ```
   */
  get<K extends keyof T>(key: K): T[K]
  get<K extends keyof T>(key: K, defaultValue: Required<T>[K]): Required<T>[K]
  get<K extends string, V = unknown>(
    key: Exclude<K, keyof T>,
    defaultValue?: V
  ): V
  get(key: string, defaultValue?: unknown): unknown
  get(key: string, defaultValue?: unknown): unknown {
    return getProperty(this.store, key, defaultValue)
  }

  /**
   * Set an item or multiple items at once.
   *
   * @param key The key of the item or a hashmap of items to set at once.
   * @param value Must be JSON serializable. Trying to set the type `undefined`, `function`, or `symbol` will result in a `TypeError`.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/main'
   *
   * const conf = new Conf()
   *
   * conf.set('foo', 1)
   * conf.set('a.b', 2)
   * conf.set({ foo: 1, a: { b: 2 }})
   * ```
   */
  set<K extends keyof T>(key: K, value?: T[K]): void
  set(key: string, value: unknown): void
  set(object: Partial<T>): void
  set<K extends keyof T>(
    key: Partial<T> | K | string,
    value?: T[K] | unknown
  ): void
  set<K extends keyof T>(
    key: Partial<T> | K | string,
    value?: T[K] | unknown
  ): void {
    if (typeof key !== 'string' && typeof key !== 'object') {
      throw new TypeError(
        `Expected 'key' to be of type 'string' or 'object', got '${typeof key}'.`
      )
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('Use `delete()` to clear values.')
    }

    if (this.containsReservedKey(key)) {
      throw new TypeError(
        `Please don't use the ${INTERNAL_KEY} key, as it's used to manage this module internal operations.`
      )
    }

    const { store } = this

    const set = (key: string, value?: T[K] | T | unknown): void => {
      const type = typeof value

      if (BAN_TYPES.has(type)) {
        throw new TypeError(
          `Setting a value of type '${type}' for key '${key}' is not allowed as it's not supported.`
        )
      }

      setProperty(store, key, value)
    }

    if (typeof key === 'object') {
      const object = key
      for (const [key, value] of Object.entries(object)) {
        set(key, value)
      }
    } else {
      set(key, value)
    }

    this.store = store
  }

  /**
   * Check if an item exists.
   * @param key The key of the item to check.
   */
  has<Key extends keyof T>(key: Key | string): boolean {
    return hasProperty(this.store, key as string)
  }

  /**
   * Reset items to their default values, as defined by the `defaults` or `schema` option.
   * @param keys The keys of the items to reset.
   */
  reset<Key extends keyof T>(...keys: Key[]): void {
    for (const key of keys) {
      const value = deepCloneObject(this.defaultValues[key])
      if (value !== undefined && value !== null) {
        this.set(key, value)
      }
    }
  }

  /**
   * Delete an item.
   * @param key The key of the item to delete.
   */
  delete<Key extends keyof T>(key: Key): void
  delete(key: string): void
  delete(key: string): void {
    const { store } = this

    deleteProperty(store, key)

    this.store = store
  }

  /**
   * Delete all items. This resets known items to their default values, if
   * defined by the `defaults` or `schema` option.
   */
  clear(): void {
    this.store = createPlainObject()

    this.reset(...Object.keys(this.defaultValues))
  }

  private ensureDirectory(): void {
    fs.mkdirSync(this.dir, { recursive: true })
  }

  private read(): T {
    if (!fs.existsSync(this.fileName)) {
      this.ensureDirectory()
      return createPlainObject()
    }

    const data = fs.readFileSync(this.fileName, 'utf8')
    const deserializedData = this.serializer.read(data)

    return cloneObject(deserializedData)
  }

  private write(value: T): void {
    this.ensureDirectory()

    const data: string = this.serializer.write(value)

    const wOptions = { mode: 0o666 }
    if (process.env.SNAP) {
      fs.writeFileSync(this.fileName, data, wOptions)
    } else {
      try {
        atomicWriteFileSync(this.fileName, data, wOptions)
      } catch (error: unknown) {
        if ((error as any)?.code === 'EXDEV') {
          fs.writeFileSync(this.fileName, data, wOptions)
          return
        }

        throw error
      }
    }
  }

  private validate(data: T | unknown): void {
    if (!this.validator) {
      return
    }

    const valid = this.validator(data)
    if (valid || !this.validator.errors) {
      return
    }

    const errorsText = this.validator.errors
      .map(({ instancePath, message }) => `${instancePath} ${message}`)
      .join('; ')

    throw new Error('Config schema violation: ' + errorsText)
  }

  private containsReservedKey(key: string | Partial<T>): boolean {
    if (typeof key === 'object') {
      const firstKey = Object.keys(key)[0]

      if (firstKey === INTERNAL_KEY) {
        return true
      }
    }

    if (typeof key !== 'string') {
      return false
    }

    if (key.startsWith(`${INTERNAL_KEY}.`)) {
      return true
    }

    return false
  }

  /**
   * Watches the given `key`, calling `callback` on any changes.
   * @param key The key to watch.
   * @param callback A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
   * @returns A function, that when called, will unsubscribe.
   */
  onDidChange<Key extends keyof T>(
    key: Key,
    callback: OnDidChangeCallback<T[Key]>
  ): Unsubscribe
  onDidChange<Key extends keyof T>(
    key: string,
    callback: OnDidChangeCallback<T[Key]>
  ): Unsubscribe
  onDidChange<Key extends keyof T>(
    key: string,
    callback: OnDidChangeCallback<T[Key]>
  ): Unsubscribe {
    if (typeof key !== 'string') {
      throw new TypeError(
        `Expected 'key' to be of type 'string', got '${typeof key}'.`
      )
    }

    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected 'callback' to be of type 'function', got '${typeof callback}'.`
      )
    }

    return this.handleChange(() => this.get(key), callback)
  }

  /**
   * Watches the whole config object, calling `callback` on any changes.
   * @param callback A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
   * @returns A function, that when called, will unsubscribe.
   */
  onDidAnyChange(callback: OnDidAnyChangeCallback<T>): Unsubscribe {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected 'callback' to be of type 'function', got '${typeof callback}'.`
      )
    }

    return this.handleChange(() => this.store, callback)
  }

  private handleChange<K extends keyof T>(
    getter: () => T | undefined,
    callback: OnDidAnyChangeCallback<T[K]>
  ): Unsubscribe
  private handleChange<K extends keyof T>(
    getter: () => T[K] | undefined,
    callback: OnDidChangeCallback<T[K]>
  ): Unsubscribe
  private handleChange<K extends keyof T>(
    getter: () => T | T[K] | undefined,
    callback: OnDidAnyChangeCallback<T | T[K]> | OnDidChangeCallback<T | T[K]>
  ): Unsubscribe {
    let currentValue = getter()

    const onChange = (): void => {
      const oldValue = currentValue
      const newValue = getter()

      if (deepEqual(newValue, oldValue)) {
        return
      }

      currentValue = newValue
      callback.call(this, newValue, oldValue)
    }

    this.events.addEventListener('change', onChange)

    return () => {
      this.events.removeEventListener('change', onChange)
    }
  }
}
