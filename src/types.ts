import type { JSONSchemaType, ValidateFunction } from 'ajv'

import type { BaseConf } from './conf'

export type JSONSchema<T> = JSONSchemaType<T>

export type ValidateFn = ValidateFunction

export interface Serializer<T> {
  /**
   * Deserialize the config object from a UTF-8 string when reading the config file.
   * @param raw UTF-8 encoded string.
   */
  read: (raw: string) => T
  /**
   * Serialize the config object to a UTF-8 string when writing the config file.
   * @param value The config object.
   */
  write: (value: T) => string
}

export type Migration<T extends Record<string, any>> = {
  /**
   * Migration version. The initial version must be greater than `0`. A new
   * version is defined on each migration and is incremented on the previous version.
   */
  version: number
  /**
   * Migration hook. You can perform operations to update your configuration.
   * @param instance config instance.
   * @param currentVersion current version.
   */
  hook: (instance: BaseConf<T>, currentVersion: number) => void
}

export type Options<T extends Record<string, any>> = {
  /**
   * The directory for storing your app's configuration file.
   *
   * @default app.getPath('userData')
   */
  dir?: string
  /**
   * Configuration file name without extension.
   *
   * @default 'config'
   */
  name?: string
  /**
   * Configuration file extension.
   *
   * @default '.json'
   */
  ext?: string
  /**
   * Default config used if there are no existing config.
   */
  defaults?: Readonly<T>
  /**
   * Provides functionality to serialize object types to UTF-8 strings and to
   * deserialize UTF-8 strings into object types.
   *
   * By default, `JSON.stringify` is used for serialization and `JSON.parse` is
   * used for deserialization.
   *
   * You would usually not need this, but it could be useful if you want to use
   * a format other than JSON.
   */
  serializer?: Serializer<T>
  /**
   * [JSON Schema](https://json-schema.org) to validate your config data.
   *
   * Under the hood, we use the [ajv](https://ajv.js.org/) JSON Schema
   * validator to validate config data.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/main'
   *
   * const schema = {
   *   type: 'object',
   *   properties: {
   *     foo: {
   *       type: 'string',
   *       maxLength: 10,
   *       nullable: true
   *     }
   *   }
   * }
   *
   * const conf = new Conf({ schema })
   * ```
   */
  schema?: JSONSchema<T>
  /**
   * You can customize versions and perform operations to migrate configurations.
   * When instantiated, it will be compared with the version number of the
   * configuration file and a higher version migration operation will be performed.
   *
   * **Note:** The migration version must be greater than `0`. A new version is
   * defined on each migration and is incremented on the previous version.
   *
   * @example
   * ```
   * import { Conf } from 'electron-conf/main'
   *
   * const migrations = [
   *  {
   *    version: 1,
   *    hook: (conf, version): void => {
   *      conf.set('foo', 'a')
   *      console.log(`migrate from ${version} to 1`) // migrate from 0 to 1
   *    }
   *  },
   *  {
   *    version: 2,
   *    hook: (conf, version): void => {
   *      conf.set('foo', 'b')
   *      console.log(`migrate from ${version} to 2`) // migrate from 1 to 2
   *    }
   *  }
   * ]
   *
   * const conf = new Conf({ migrations })
   * ```
   */
  migrations?: Migration<T>[]
}

export type OnDidChangeCallback<T> = (newValue?: T, oldValue?: T) => void

export type OnDidAnyChangeCallback<T> = (
  newValue?: Readonly<T>,
  oldValue?: Readonly<T>
) => void

export type Unsubscribe = () => void

export type ConfOptions<T extends Record<string, any>> = Options<T>

interface IpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>
}

export interface ConfAPI {
  ipcRenderer: IpcRenderer
}
