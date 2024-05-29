# electron-conf

> Simple data persistence for your Electron app - save and load user settings, app state, cache, etc

> Another electron-store, minimal fork of conf, with more features.

electron-conf is a fork of [conf](https://github.com/sindresorhus/conf) (behind [electron-store](https://github.com/sindresorhus/electron-store)). What we try to achieve in this library, is to eliminate some dependencies and features that our target users don't need, and is designed only for Electron.

- ✅ Minimal and simple
- ✅ Read data form disk once, ~100x faster
- ✅ Simpler migration strategy
- ✅ Safer to use it in Electron renderer (no nodeIntegration)
- ✅ Written in TypeScript, and support CommonJS and ESM. For Electron 15.x and higher.
- ❌ No watch
- ❌ No encryption

_If you need features like watch or encryption, electron-store is a better choice for you._

## Install

```sh
$ npm install electron-conf
```

## Usage

### Using in Electron Main Process

```ts
import { Conf } from 'electron-conf/main'

const conf = new Conf()

conf.set('foo', '🌈')
console.log(conf.get('foo')) // => 🌈

// Use dot-notation to access nested properties
conf.set('a.b', true)
console.log(conf.get('a')) // => {b: true}

conf.delete('foo')
console.log(conf.get('foo')) // => undefined
```

### Using in Electron Renderer Process

1. Register a listener in main process, so that you can use it in the renderer process.

```ts
import { Conf } from 'electron-conf/main'

const conf = new Conf()

conf.registerRendererListener()
```

2. Expose the `Conf` API.

You can expose it in the specified preload script:

```ts
import { exposeConf } from 'electron-conf/preload'

exposeConf()
```

Or, you can expose it globally in the main process for all renderer processes:

```ts
import { useConf } from 'electron-conf/main'

useConf()
```

3. Use it in the renderer process

```ts
import { Conf } from 'electron-conf/renderer'

const conf = new Conf()

await conf.set('foo', 1)
```

> [!NOTE]
> Use the same way as the main process. The difference is that all APIs are promise-based.

## API

### Conf([options])

return a new instance.

> [!WARNING]
> It does not support multiple instances reading and writing the same configuration file.

### Constructor Options

> [!NOTE]
> `Conf` for the renderer process, only supports the `name` option.

#### `dir`

- Type: `string`
- Default: [`app.getPath('userData')`](https://www.electronjs.org/docs/latest/api/app#appgetpathname)

The directory for storing your app's configuration file.

#### `name`

- Type: `string`
- Default: `config`

Configuration file name without extension.

#### `ext`

- Type: `string`
- Default: `.json`

Configuration file extension.

#### `defaults`

- Type: `object`

Default config used if there are no existing config.

#### `serializer`

- Type: [`Serializer`](./src/types.ts)

Provides functionality to serialize object types to UTF-8 strings and to deserialize UTF-8 strings into object types.

By default, `JSON.stringify` is used for serialization and `JSON.parse` is used for deserialization.

You would usually not need this, but it could be useful if you want to use a format other than JSON.

<details>
<summary><b>Type Signature</b></summary>
<p></p>

```ts
interface Serializer<T> {
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
```

</details>

#### `schema`

- Type: [JSONSchema](https://json-schema.org/understanding-json-schema/reference/object#properties)

[JSON Schema](https://json-schema.org) to validate your config data.

Under the hood, we use the [ajv](https://ajv.js.org/) JSON Schema validator to validate config data.

You should define your schema as an object where each key is the name of your data's property and each value is a JSON schema used to validate that property.

```ts
import { Conf } from 'electron-conf/main'

const schema = {
  type: 'object',
  properties: {
    foo: {
      type: 'string',
      maxLength: 10,
      nullable: true
    }
  }
}

const conf = new Conf({ schema })
```

#### `migrations`

- type: [`Migration[]`](./src/types.ts)

You can customize versions and perform operations to migrate configurations. When instantiated, it will be compared with the version number of the configuration file and a higher version migration operation will be performed.

**Note:** The migration version must be greater than `0`. A new version is defined on each migration and is incremented on the previous version.

```ts
import { Conf } from 'electron-conf/main'

const migrations = [
  {
    version: 1,
    hook: (conf, version): void => {
      conf.set('foo', 'a')
      console.log(`migrate from ${version} to 1`) // migrate from 0 to 1
    }
  },
  {
    version: 2,
    hook: (conf, version): void => {
      conf.set('foo', 'b')
      console.log(`migrate from ${version} to 2`) // migrate from 1 to 2
    }
  }
]

const conf = new Conf({ migrations })
```

<details>
<summary><b>Type Signature</b></summary>
<p></p>

```ts
type Migration<T extends Record<string, any>> = {
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
```

</details>
<p></p>

### Instance Methods

You can use [dot-notation](https://github.com/sindresorhus/dot-prop) in a key to access nested properties.

The instance is [`iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

> [!NOTE]
> All methods in renderer are promise-based.

#### `.get(key, defaultValue?)`

Get an item or defaultValue if the item does not exist.

#### `.set(key, value)`

Set an item.

#### `.set(object)`

Set an item or multiple items at once.

```js
conf.set({ foo: 'boo', bar: { baz: 1 } })
```

#### `.reset(...keys)`

Reset items to their default values, as defined by the defaults or schema option.

#### `.has(key)`

Check if an item exists.

#### `.delete(key)`

Delete an item.

#### `.clear()`

Delete all items.

#### `.onDidChange(key, callback)`

- `callback`: `(newValue, oldValue) => {}`

Watches the given `key`, calling `callback` on any changes.

When a key is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.

Returns a function which you can use to unsubscribe:

```js
const unsubscribe = conf.onDidChange(key, callback)

unsubscribe()
```

> [!TIP]
> Not available in renderer

#### `.onDidAnyChange(callback)`

- `callback`: `(newValue, oldValue) => {}`

Watches the whole config object, calling `callback` on any changes.

`oldValue` and `newValue` will be the config object before and after the change, respectively. You must compare `oldValue` to `newValue `to find out what changed.

Returns a function which you can use to unsubscribe:

```js
const unsubscribe = store.onDidAnyChange(callback)

unsubscribe()
```

> [!TIP]
> Not available in renderer

#### `.fileName`

Get the configuration file path.

> [!TIP]
> Not available in renderer

## Credits

[Conf](https://github.com/sindresorhus/conf), simple config handling for your app or module.
